# Bestim: release readiness report (draft, started 2026-10-29)

Plan: all three stores together (Google Play, Huawei AppGallery, App Store). Real phones available: Android + iPhone (no Huawei phone). Every live change is listed here and done only after the founder's yes.
Legend: GREEN = ready, AMBER = fix or accept before launch, RED = blocks launch.

## Step 1: automated gates (2026-10-29)
| Check | Result |
|---|---|
| `npm run check` (11 suites), `tsc --noEmit` | GREEN |
| `expo lint` | GREEN (13 warnings, 0 errors) |
| Secrets in repo | GREEN (none; only public Supabase URL / anon key / Google client IDs) |
| `expo-doctor` | AMBER: `@expo/ui` installed twice (57.0.22 and 57.0.26 via `expo-widgets`); 11 Expo packages one patch behind (`npx expo install --fix`) |
| `npm audit` (prod) | AMBER: 21 items (1 critical `shell-quote`, 8 high), almost all build tooling that does not ship in the app; `zod` ^4.6.5 should be >= 4.6.6 (used by the sign-in forms) |
| Stray `--check` file, `zod` | FIXED (file deleted; zod 4.6.7; the remaining audit hit is a copy nested inside Expo tooling) |
| Git | RED: 16 files uncommitted (all widget code, widget patch, 3 live migrations, 2 edited edge functions, types). Stray file `--check` (a generated SQL file) should be deleted. Branch `cars-only-and-records`, not merged |

## Step 2: backend and security review (Opus, read-only)
No critical findings. RLS on every table; anon key gets 401 on every private table; SECURITY DEFINER functions all pin `search_path`; edge functions require a real signed-in user and have daily limits; storage private and per-user; migrations local = remote (30).
| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | HIGH | Account deletion leaves profile photos (`avatars/<uid>`) behind (`src/app/delete-account.tsx:17-25`) | FIXED in code (both buckets emptied before the delete call); not yet run with a throwaway account |
| 2 | HIGH | `supabase/config.toml:178` `enable_anonymous_sign_ins = true` (live is off; a `config push` would turn it on) | FIXED in `config.toml` and PROGRESS.md (live project already off) |
| 3 | MED | No per-user caps on uploads/rows | Count cap in receipts policy or trigger |
| 4 | MED | Demo-request form (`connect_leads`) can be spammed | Captcha or per-phone daily cap |
| 5 | MED | Every admin role (even viewer/content) sees users' emails and records | `admin_user_list` / `admin_user_detail`: require owner/admin/support |
| 6 | MED | `skip_nonce_check = true` (Google sign-in replay window) | Pass hashed nonce on iOS, turn check back on |
| 7 | LOW | Users can insert `log_corrections` directly, forging history that `accept_share` copies | Revoke insert grant, make `correct_log` SECURITY DEFINER with owner check |
| 8 | LOW | `log_ai_usage` can be padded by users | Revoke from `authenticated` |
| 9 | LOW | Edge functions trust `content-length` only | Reject missing header |
| 10 | LOW | Provider error text (300 chars) in logs | Optional |
| 11 | LOW | Widget keys survive a password change / other-device sign-out | Trigger on password change |
| 12 | LOW | `secure_password_change = false`; no password rule beyond length 8 | Turn on |
| 13 | LOW | `src/types/database.ts` lacks widget tables/functions | `npm run types` |
| 14 | LOW | Session and widget key in AsyncStorage (unencrypted) | SecureStore later |
| 15 | LOW | Four foreign keys unindexed | Add when tables grow |

## Step 3: simulator walk-through (Sonnet, iPhone 16 simulator, 2026-10-29)
Covered: Home, Notifications page, + sheet, Car page, edit/delete a record, Update odometer, Part page, Expenses, Cars tab, Account (theme, language, notification settings, export, share) in Arabic light/dark and English light/dark. Not covered: voice, camera, Google sign-in, offline, larger text, Undo, calendar picking, saving a fuel record, Privacy/Support links.
| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | BLOCKER (confirmed in code) | After the first saved record, tapping "Later" on the notification permission screen crashes ("Object is not a function"), then a "Something went wrong" screen and a blank screen. Cause: `src/app/notify-permission.tsx:18` `useEffect(() => useSettings.getState().set(...), [])` returns the store call's result as the cleanup function. Every new user would hit it | FIXED 2026-10-29: effect no longer returns a value; checked on the simulator (Later goes to the success screen) |
| 2 | Minor | Home "this month" 1,700 EGP vs Expenses October 5,610 EGP (per car vs all cars?). Home card does not say which | needs decision |
| 3 | Minor | English UI shows Arabic service/car names and ISO dates (2026-10-12) in the Expenses list | FIXED: dates formatted per language; Arabic service names stay (the user's own record text) |
| 4 | Minor | Checklist expects a "Saved · Undo" toast but a success screen appears; delete has no confirm and no Undo seen (not conclusive) | verify on a phone |
| 5 | Minor | Wrong plurals: "5 سجل صيانة", "تم حذف 1 سجلات", "2 car(s)" | FIXED: counts reworded ("Cars: 2", "سجلات الصيانة: 5") so they read right for any number |
| 6 | Minor | Update odometer: no "+" chips seen, and a typed number did not show with the simulator keyboard | verify on a phone |
| 7 | Minor | Add-record default interval 5,000 km vs oil part page 10,000 km | needs decision |
| 8 | Polish | Export: main button below the fold; heading tight under the header; keyboard Done bar is English (iOS system, simulator artifact likely); mixed direction in English greeting with Arabic name | open |
| 9 | Watch | After a crashed or deep-linked start, headers vanished until the app was relaunched; make sure a cold start never lands there | verify on a phone |
Notes: the app has four tabs (Home, Cars, Expenses, Account); there is no Reminders tab, so `docs/store/phone-test-checklist.md` rows C7 and the "Reminders" wording are out of date. Swiping between periods on the Expenses chart did nothing in this run, the arrows work (Q111 says swipe should work; re-check on a phone).

## Round 2 (2026-10-29, "go auto"): done on this Mac, nothing live changed
- Decisions logged as Q116: Home card = selected car, Expenses tab = all cars; reminder interval = service default unless the owner's own record says otherwise (both by design).
- Migration `20261029090000_release_hardening_2.sql` WRITTEN, NOT PUSHED, NOT RUN against any database (no local database here): PII admin roles, widget keys die on password change, row caps, four indexes. Verify after the push.
- Sign in with Apple restored for iPhone (Apple guideline 4.8): `expo-apple-authentication`, button above Google on Sign in and Create account, shown on iOS only, entitlement added by the config plugin (not in the free-Apple-ID test build). `supabase/config.toml` lists the Apple provider (file only).
- Expo packages aligned to SDK 57 patch versions; duplicate `@expo/ui` removed; `expo-doctor` 21/21.
- Checklists: Android list fixed (no Reminders tab), new `docs/store/iphone-test-checklist.md`.
- Website source has no guest-mode wording (store docs already say there is none).

## What only the founder (or a live approval) can unblock
Each item below changes something live, costs money, or needs an account login that I may not use.
| # | Item | Who | Why it blocks launch |
|---|---|---|---|
| 1 | ~~Push migration `20261029090000`~~ DONE 2026-10-30: pushed by the founder, types regenerated, anon key gets 401 on the new/changed functions and tables. Not yet exercised with a real user: row caps, widget keys dying on password change, viewer-role admin refused (needs test accounts) | done | |
| 2 | Supabase dashboard: Authentication > Providers > Apple > enable, Authorized Client ID `com.bestim.app` (no secret). Do NOT use `config push` | founder | Without it the Apple button fails and App Review rejects |
| 3 | Apple Developer: App ID `com.bestim.app` with Sign in with Apple, Push, App Group `group.com.bestim.app`; widget extension ID; APNs key | founder / Ahmed | iPhone build, push and widgets |
| 4 | Server push for iPhone (APNs key + scheduled function) | founder gives key, then I build the function | On-device reminders work, but server push is still missing |
| 5 | App Store Connect and Google Play Console apps, privacy labels / data safety, reviewer account, screenshots from the final UI | founder | Store forms are in `docs/store/` |
| 6 | Google Play closed test: 12 testers for 14 days | founder starts the clock | Personal Google account rule; decides the launch date |
| 7 | Plans: Supabase Pro, Vercel Pro, Resend paid, Gemini cap + owner | founder (money) | Free limits (100 emails/day) and no backups |
| 8 | Redeploy the two edited edge functions (`process-voice-log`, `read-odometer`) | founder says yes | Edited locally 2026-10-22/23 but the review found them fine; confirm they are what is live |
| 9 | EAS production builds (iOS, Android AAB, Huawei APK) and smoke test on real phones | founder + me | Uses the Expo build queue |
| 10 | Real-phone checklists: Android `phone-test-checklist.md`, iPhone `iphone-test-checklist.md`; Huawei has no phone | founder | Voice, camera, push, widgets on real hardware |
| 11 | Google sign-in branding verification and Play signing SHA-1 in Google Cloud | founder | Google sign-in window shows the app name |

Verdict today: NOT READY to publish. The code is in a good state, but items 1 to 11 must happen first. Closest honest status: "ready for store setup and real-phone testing".
