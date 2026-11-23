# Bestim: release readiness report (started 2026-10-29, refreshed 2026-11-04)

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

## Round 3: final production check (2026-11-04)
Three read-only audits (backend and security, app code, release setup), then fixes. **Nothing committed, pushed, deployed or run against the live database.**

### Fixed in the app (code only, checked with tsc / lint / `npm run check` / expo-doctor 21/21)
| Problem | Fix |
|---|---|
| Arabic counts from 11 to 99 showed a raw key (`home.lastReading_many` and friends); found on the simulator: Hermes has no plural rules, so every count in both languages read the "other" form ("3 سجل", "1 records") | Plural polyfill added (`@formatjs/intl-pluralrules`, Arabic + English, in `src/lib/i18n.ts`); all six Arabic forms added; `locales.check.ts` fails if a plural is incomplete |
| Typing `12,5` or `١٢٫٥` for an amount or litres saved 125 | `src/lib/numberInput.ts` (+ check) |
| A retried save could write the same record twice | The record id is made on the phone; the database's "already exists" answer counts as saved; an orphan receipt photo is removed |
| Signing in as another account on the same phone could show the earlier account's queued voice notes, notifications and chosen car | Wiped when the signed-in user changes (`queryClient.ts`) |
| Record, odometer-review and part screens could spin forever when the data failed to load | They show the retry screen |
| A voice recording stayed on the phone if you left the screen | Deleted on leaving (Q70) |
| Double tap on Google / Apple sign-in opened two sheets | Guarded |
| Error messages used the green check icon | Warning icon (`toastError`) |
| The offline cache could grow past Android's 2 MB row limit | Brand list, signed links and shared records are not stored |
| History rendered every row at once | "Show more" (50 at a time) |
| English "1 records" | Singular added |
| Dead code | `Rotator360` removed; ten old design mock-ups moved to `docs/design-archive/`; two duplicate direct dependencies removed (expo-router installs them) |
| Dependencies | `npm audit fix` (no force). Production audit 22 items; every remaining "high" is inside Expo's own tooling and its fix would downgrade Expo, so it is left |
| Tests | `planRules.check.ts` (plan gates and upgrade targets), `numberInput.check.ts`, plural completeness; `npm run verify` = tsc + lint + all checks |
| Arabic permission texts (iPhone microphone, speech, camera, photos), Apple privacy manifest, `.env*` ignored | `app.json`, `assets/native-locales/ar.json`. **Only provable in the first real iPhone build** |

### Crash reports (Sentry, free plan)
Code is in (`src/lib/monitoring.ts`, root wrapped, screen crashes and 3D / widget-sync errors reported). It does nothing until the key is set: add `"EXPO_PUBLIC_SENTRY_DSN": "<the project's DSN>"` to the `env` of the production profile in `eas.json` (EAS rejects an empty value, so there is no placeholder). Emails and URL query strings are masked, no screenshots, no replays, no performance traces. Adding the native module means **the next iPhone / Android build must be a new one** (the current dev build does not contain it). For readable stack traces add the `@sentry/react-native/expo` plugin with the organisation and project names and an `SENTRY_AUTH_TOKEN` secret in EAS when the account exists. Store forms: `docs/store/google-data-safety.md` now says "crash logs, collected once Sentry is on"; Apple's privacy answers need the same line (Diagnostics > Crash Data, not linked to the user, not for tracking), and the website privacy page needs one sentence.

### Database hardening: WRITTEN, NOT PUSHED, NOT RUN (no Docker on this Mac)
`supabase/migrations/20261104090000_db_hardening.sql`, reviewed by reading only:
1. A log's `created_at`, `status`, `source` and a car's `removed_records` can no longer be changed through the API (stops resetting the 24-hour edit window and faking "verified" or "N records removed"). Inserts reset them to the real values.
2. `correct_log` runs as the database with its own owner check; nobody can write `log_corrections` directly (closes old finding 7).
3. Text length limits (NOT VALID: old rows are untouched) and row caps on reminders (500), shares (200), corrections (5,000), odometer readings (10,000) (closes old finding 3).
4. Receipt-photo uploads and widget keys now follow the plan switch in the database; guests cannot start a trial; the catalog audit function is no longer callable from the API.
5. `config.toml`: anonymous sign-in off, `secure_password_change` on (matches the live project).
6. Edge function `process-voice-log` now checks who is calling before reading the upload. A missing `content-length` is still accepted (refusing it could reject real phones; Supabase's gateway caps the size too).
After pushing: `npm run types`, then test as a normal user: changing `created_at` or `status` on a log fails, `correct_log` works on your own log and fails on another's, a direct insert into `log_corrections` fails, ordinary edits / deletes / sharing / widget taps still work. Note: a record saved offline with a photo, then synced after the plan lost receipt photos, will fail at the upload.

## What only the founder (or a live approval) can unblock
Each item changes something live, costs money, or needs a login I may not use. Order is roughly the order to do them.
| # | Item | Who | Why |
|---|---|---|---|
| 1 | **Commit and push the work** (about 140 changed paths on `cars-only-and-records`). EAS builds only what is committed | founder says yes | A build today would not contain any of this |
| 2 | Push the database migrations (the plans ones from 2026-10-30 / 11-03 and `20261104090000_db_hardening`), then `npm run types` and the tests above | founder says yes | Plans are not live until then; the hardening is not either |
| 3 | Redeploy the two AI functions (`process-voice-log`, `read-odometer`) and try one voice note and one scan | founder says yes | The live ones are older |
| 4 | **Supabase Pro** (daily backups; free projects pause) and a separate **staging project**; all three EAS profiles point at production today | founder (money) | One bad migration or test account hits real users with no backup |
| 5 | Resend paid plan, Gemini spend cap + budget alert | founder (money) | 100 emails/day on free; unbounded AI cost |
| 6 | Sentry account (free), create a React Native project, add the DSN to `eas.json`; add the plugin + auth token for readable traces | founder | Without it nobody hears about crashes |
| 7 | Apple Developer: App ID `com.bestim.app` with Sign in with Apple, Push, App Group `group.com.bestim.app`, widget ID, APNs key; Apple provider in the Supabase dashboard (never `config push`) | founder / Ahmed | iPhone build, Apple sign-in, push, widgets |
| 8 | Create the three store apps; privacy labels / data safety; **fix store and privacy text** (no guest mode; Sign in with Apple exists; voice sends audio to Google AI for processing, not kept; crash reports) | founder | The old text still describes guest mode |
| 9 | First real builds (iPhone, Android AAB, Huawei APK). Check in them: notification permission on Android 13+, `aps-environment` = production, app icon has no transparency, Arabic permission pop-ups | founder + me | Cannot be proven on a Mac simulator |
| 10 | Real-phone tests: `docs/store/phone-test-checklist.md`, `iphone-test-checklist.md` (voice, camera, widgets, push, offline, Android, Huawei) | founder | Hardware only |
| 11 | Google Play closed test: 12 testers for 14 days | founder starts the clock | Decides the launch date |
| 12 | Rotate the reviewer account password after store review | founder | It is written in `docs/store/reviewer-account.md` |
| 13 | Safer settings: Google sign-in nonce check (`skip_nonce_check`), spam protection on the demo-request form (`connect_leads`), admin accounts with two-step login, encrypted storage for the sign-in session | planned | Medium / low risk, not launch blockers |
| 14 | Decide: turn on over-the-air updates (`expo-updates` is installed but off) or remove it | founder | Lets bug fixes reach phones without a store review |

**Not verifiable here:** Android and Huawei behaviour, voice / camera / push / widgets on real hardware, the live Supabase state, Sentry delivery, the new database file (never executed).

Verdict today: **not ready to publish; ready for store setup and real-phone testing** once items 1 to 4 are done. Nothing found in the code is a launch-blocking bug any more.
