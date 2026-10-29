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

## Steps 4 to 8
Not started: real phones, stores and compliance, release builds, live-service readiness, final sign-off.
