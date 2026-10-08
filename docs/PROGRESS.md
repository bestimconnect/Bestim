# Bestim: Build Progress

Updated 2026-10-05. Read this first in any new session. The spec is `docs/BESTIM-TECH-PLAN.md`, the product decisions are in `docs/decisions.md`, and the conventions are in `CLAUDE.md`.

## Phase status

| Phase | Scope (spec §14) | Status |
|---|---|---|
| 1 · Foundation | Expo scaffold, tokens, Supabase, i18n/RTL, UI kit, root layout | ✅ Done |
| 2 · Auth & onboarding | Screens 01, 02, 03–05, 30–35, 49, 50 + reset password; email + Google login | ✅ Done (Apple deferred: decisions Q6) |
| 3 · Core features | Home (06/07/36), vehicles (08/09), parts (11/12), capture (13–17), history (10/18/19/20/39), feature gate (37), guest mode | ✅ Done |
| 4 · Reminders & expenses | Reminders (21/22/38), update odometer (25), expenses (23/24/40) | ✅ Done |
| 5 · Account & polish | Account (26), notification prefs (28), export (27), share/receive (41/42), feedback (43–48), on-device reminders, offline, delete vehicle/account | ✅ Built (QA gaps below) |
| 6 · Release | Needs the Apple Developer account: Sign in with Apple, server push, TestFlight, Android Google key, universal links, store submission | ⏭ Next |

## App flow (decisions Q8)
Splash → Language (01) → Tour 33→34→35 (once per device, `settingsStore.tourSeen`) → Welcome (02) → Sign in (30) / Create account (31) → Your profile (32, only if `profiles.full_name` is empty) → Add vehicle 03→04→05 → Home (tabs).
The gate lives in `src/app/_layout.tsx`. `profiles.onboarding_completed` = "first vehicle added".

## What exists (Phases 1–5)
- **UI kit** (`src/components/ui/`): Text, Button, Field, Card, Item, Header, Note, Divider, Progress, Choice (`className` for the track), Metric, GoogleIcon. Also `Hero`, `TourSlide`, `TabBar`, `PartMetric` in `src/components/`.
- **Data hooks** (`src/lib/queries.ts`): vehicles, current vehicle, logs, log, service types, parts (`useVehicleParts` + `needsAttention`), snoozes, expenses, `useIsGuest`. Part status math: `src/lib/parts.ts` (pure, checked by `npm run check`). Voice: see "Voice logging" below.
- **Flow stores:** `settingsStore` (language, theme, tourSeen, currentVehicleId), `vehicleDraft` (onboarding / `?mode=extra` add vehicle), `logDraft` (capture → review → save, and corrections).
- **Tabs:** Home, Vehicles (stack: 08 → 09), Reminders (21), Account (Phase 5 placeholder with an Expenses row; stack → 23). The center + opens the capture sheet (13).
- **Guest mode:** "Continue as guest" = Supabase anonymous user. Guests see Home (36); everything else opens the gate (37). Register/Google upgrade the same user (`updateUser` / `linkIdentity`). A guest can't merge into an account that already exists.
- **DB** (migrations in `supabase/migrations/`):
  - odometer trigger (flags suspicious readings as needs_review and moves the vehicle odometer, decisions Q9/Q20);
  - `correct_log` RPC (atomic corrections);
  - a log's cost auto-becomes an expense (`from_log`), so expenses is the single money source;
  - snooze = a `reminders` row with status dismissed + due_date;
  - private `receipts` storage bucket;
  - `vehicles.odometer_updated_at`.
- **Auth:** email/password, Google, anonymous (guest), email-link deep links, reset password.
- **Theme:** the user setting (Account → Dark mode). Auth + first-run onboarding are always light. **The dark theme is our own palette, not Figma's** (decisions Q50): `bg-paper` < `bg-white` < `bg-panel`; `bg-sheet` for sheets/modals.
- **Phase 5:**
  - Account (theme, language, sign out, delete account);
  - on-device reminders (`src/lib/reminderPlan.ts` rules + `src/lib/notifications.ts`);
  - export PDF/CSV/JSON (`src/lib/export.ts`);
  - share by QR/link + receive (`accept_share` copies the vehicle and history);
  - success screens, permission screen, delete vehicle;
  - offline: cached data is persisted and a log saved offline is queued (`src/lib/queryClient.ts`, `src/lib/saveLog.ts`);
  - `Toast`, pull-to-refresh (`useRefresh`).
- **2026-10-02 edits (decisions Q52–Q54):** vehicle types with pictures (`src/lib/vehicleArt.ts`), update-odometer ruler + voice (`src/components/OdometerRuler.tsx`), home hero with the vehicle picture. Checked on the simulator in Arabic light, Arabic dark and English dark; English light and the microphone (real phone) are not checked yet.
- **Motion (Q57):** values in `src/lib/motion.ts`, `PressableScale` and `Rise` in the UI kit, floating + in `TabBar`. Checked on the simulator that every screen renders and the controls land in the right place (Arabic, light; nav bar also dark). Not checked: the feel on a real phone, English, and the phone's Reduce Motion setting.
- **Vehicle switching (Q56):** swipe the picture on Home, or the switch-vehicle sheet (`pickVehicle()` → `src/app/switch-vehicle.tsx`) from Home, Reminders and Share. Checked on the simulator in Arabic and English, sheet and Home also in dark. Not checked: the sheet opened from Share, and the vibration (real phone).
- **No system pop-ups (Q55):** confirmations and pickers use `sheet()` from `src/lib/sheet.ts` (route `src/app/sheet.tsx`), never `Alert.alert`. The sign-out button inside the sheet has not been pressed in testing.
- **Checks:** `npm run check` runs 6 checks (parts, voice records, odometer scan, export, reminder rules, and locales: every label used in code must exist in both languages).
- **Update odometer (2026-10-03, decisions Q71–Q72):** three ways to set the reading: voice through + (the voice flow below), the slider, the camera.
  - Slider: `src/components/OdometerRuler.tsx` (drag with fling, drawn from a shared value) + `src/components/RollingNumber.tsx` (digits roll like a car odometer). One Reanimated shared value in `src/app/update-odometer.tsx` drives both. Typing still works by tapping the number. The page microphone and `src/lib/voice.ts` are gone.
  - Camera (decisions Q72–Q75): `src/components/OdometerScanner.tsx` reads the live video on the phone, the same way on iPhone and Android (`react-native-vision-camera` v5 + `react-native-vision-camera-ocr-plus`, Google ML Kit on both). Wide camera window, no shutter; only the middle band of the frame is read. `src/lib/odometerScan.ts` picks the number (`pickReading`: at or above the current reading, within a believable jump; `pickOutlier`: otherwise the longest display-like number). Two frames must agree, then the number shows large with "Confirm and save"; a lower reading goes to the page for its reason. Test builds show the raw text read under the window.
  - Checked on the simulator (Arabic, light): the page renders, dragging rolls the number and moves the ruler, the reading snaps to 10 km, typing sets the value. Not checked: dark theme, English, hours vehicles, a lower reading through the new page, Save.
  - Camera history: the first version took a picture every second (worked on the founder's iPhone, but too slow); the second took smaller pictures (still too slow); the third is the live reader. **The live reader is not confirmed on a phone yet, and nothing of the camera has run on Android** (no Android tools on this Mac; it needs an EAS build). ML Kit may not build for the iOS simulator on Apple Silicon; not checked yet. If real dashboards read badly (digital displays are the weak spot), the fallback is sending a frame to Gemini (`docs/IDEAS.md`).
- **Voice logging (2026-10-03, decisions Q58–Q70):** the user speaks freely (Egyptian Arabic, English, or mixed) and gets a list of records: maintenance, expenses, an odometer update, with "next due" intervals when said.
  - Flow: `capture/voice.tsx` records (the phone's live text is only a preview) → Edge Function `supabase/functions/process-voice-log` (Google Gemini 3.8 Flash hears the recording and returns what was said plus the records, in one call) → `src/lib/voiceRecords.ts` cleans the answer (never trusted as-is) → `capture/review-all.tsx` (a card per record, edit or remove, save all) → `success` with `kind: 'batch'`.
  - Editing a card reuses the existing forms with a `batch` param (`capture/manual.tsx`, `add-expense.tsx`): they write back to `src/stores/voiceBatch.ts` instead of saving.
  - Guards in the function: real account only (no guests), 30 recordings per user per day (`voice_usage` table + `bump_voice_usage()`), about 90 seconds per recording, the recording is not kept by us or by Google.
  - Switching the model: secret `GEMINI_MODEL` (default `gemini-3.8-flash`). Another provider means rewriting `understand()` in that one file; the app does not change.
  - Model test: `scripts/voice-eval.ts` + `scripts/voice-eval.cases.json` (21 written sentences; real voice notes go in the git-ignored `scripts/voice-eval/`).
  - **Status (2026-10-03): live.** Migration applied, function deployed, `GEMINI_API_KEY` set. Checked on the iPhone 16 simulator with a typed English sentence (the simulator has no speech recognition): 4 records came back right (oil change with reading, cost and interval; oil filter; fuel; an insurance expense with no amount, blocked until filled), edit an expense card, remove a card, save all, success screen, Home shows the new reading and the month's expenses without double counting. The function refuses callers who are not signed in.
  - **Not checked yet:** a real recording (needs a phone), Arabic and mixed speech, editing a maintenance card and the odometer card, the daily limit and the guest refusal, a partly failed save, Android, and the written test (`scripts/voice-eval.ts` needs a test account's email and password).
  - The old keyword parser, the one-question screen (17) and `USE_MOCK` are gone. `src/lib/voice.ts` only keeps `parseReading` for the update-odometer screen.

## Open items
- **Not verified yet (QA):**
  - English/LTR layout of the Phase 3–5 screens;
  - light mode of the Phase 5 screens (they were reviewed in dark);
  - tapping through: voice → save, receipt photo, correction, add expense, export share sheet, share → receive → accept, delete vehicle/account, offline queue, scheduled notifications list.
  - The database rules behind these were tested on the live DB.
- A red error with no message appears when the success screen is deep-linked straight into the permission modal (not a user path). Cause unknown.
- Android test build: `eas.json` is ready (profile `preview` = APK). Needs the founder's Expo login, then `npx eas-cli init` and `npx eas-cli build -p android --profile preview`. Google sign-in won't work on Android until the Android OAuth client exists.
- **Phase 6 (after the Apple Developer account):** Sign in with Apple (decisions Q6), server push (APNs + a scheduled Edge Function; on-device stays as fallback), TestFlight build, Android Google client + SHA-1, universal links for share links, store submission.

## Release readiness (2026-10-05, decisions Q76–Q84)
A full pass for Google Play and Huawei AppGallery. Store texts and form answers: `../docs/store/`. Pictures: `../assets/store/`.

**Done in code (merged into `main` 2026-10-08, PR 1; not built). The website side is live on `bestim-eg.com` (privacy text, `/receive`, AppGallery button):**
- Store rules: Privacy · Terms · Support links in Account and a consent line at sign-up (`src/lib/links.ts`, no env setting any more); AI notice on the voice screen; guests can delete their data from the gate screen; account deletion removes every receipt photo; camera permission text matches what the camera does; Android backups off; unneeded permissions blocked; notification icon and category name.
- Security: email links use a one-time code tied to the phone (`flowType: 'pkce'`, `src/lib/session.ts`); the cache is cleared whenever the signed-in user changes (`src/lib/queryClient.ts`); passwords 8+; CSV formulas defused; `process-voice-log` hardened.
- Huawei and older Android: Google button hidden without Google services (`useGoogleAvailable`); voice records directly with `expo-audio` when there is no speech service or on Android 12 and older (`capture/voice.tsx`, sends `audio/aac`); Android back closes the odometer camera.
- Polish: `errorText()` (`src/lib/errors.ts`) instead of raw server messages; root `ErrorBoundary`; dead "add photo" button removed.
- Share links are `https://bestim-eg.com/receive?token=…` (website page `/receive`).
- New build profile `huawei` in `eas.json` (store-signed APK). `production` stays an app bundle for Google.

**Waiting for a go-ahead (live changes):**
- The password minimum (8) on the live project: set it in the Supabase dashboard (Authentication → Sign In / Providers → Email), not with `supabase config push`, which would overwrite every other live auth setting with `config.toml`. The app already asks for 8 on sign-up and reset.
- Resend account + sender on `bestim-eg.com`, then raise the email limit in Supabase.
- Google Cloud: Android sign-in entries for `com.bestim.app` (the EAS build key's fingerprint, and Google Play's own key once the app exists there). Daily spending cap on the Gemini key.

**Checked on the iPhone 16 simulator (Arabic, light, 2026-10-08):** the app still opens signed in after the sign-in change; Account shows Privacy · Terms · Support and the links open the live pages in the phone's browser; the agreement line on Create account; the AI notice on the voice screen; a wrong email or password shows the Arabic message, not the server's English. The camera packages build for the simulator.

**Applied to the live project (2026-10-08):** migration `20261005090000_release_hardening.sql` (listed as applied); `process-voice-log` version 2 (refuses callers who are not signed in; a spoken test in the simulator came back with the right record: oil change, 251,500 km, 900 EGP); `src/types/database.ts` regenerated. No test value of `VOICE_DAILY_LIMIT` is set.

**Not verified yet:**
- English and dark for the screens above; the guest "delete my data" path; the "something went wrong" screen (it only shows on a crash).
- Nothing has run on Android or Huawei. The new direct voice recording has not been heard by the AI yet (format `audio/aac`): first thing to try on the Android phone.
- The email-link flow end to end (needs the live settings above).

## Environment & gotchas (learned the hard way)
- `.env` is **git-ignored** and holds EXPO_PUBLIC_SUPABASE_URL/ANON_KEY, EXPO_PUBLIC_GOOGLE_WEB/IOS_CLIENT_ID and SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET. A new machine or cloud session must recreate it.
- Supabase project ref `wlepubflnjcguosicuak`. `supabase link` is needed on a new machine. Schema changes go through migrations only.
- **Email links must be opened on the phone that asked for them** (sign-up, reset password): the link carries a one-time code and the phone holds the other half. A link opened on another phone lands on Sign in with a plain notice.
- **Website links open in the phone's own browser** (`Linking.openURL`), not the in-app browser sheet: the sheet came up blank on the simulator, and the plain browser behaves the same on iPhone, Android and Huawei.
- **`ios/` was regenerated for the simulator on 2026-10-05.** For the real iPhone with the free Apple ID, run the `PERSONAL_TEAM=1` steps below again.
- **`expo-audio` is installed without its config plugin on purpose:** the plugin adds a background-playback service and "foreground service" permissions that Google Play asks to justify. The microphone permission already comes from the speech plugin.
- **`supabase config push` applies immediately, with no prompt.** Before pushing, make config.toml match the remote (email confirmations on, TOTP MFA on, OTP length 8, max_frequency 1m0s). Load `.env` first (`set -a; . ./.env; set +a`) so the Google secret resolves.
- **Tailwind font sizes/line heights must be px strings.** A unitless lineHeight is a multiplier and pushes text off-screen.
- NativeWind resolves conflicting classes by stylesheet order, not className order. That's why `Text` only defaults to `text-ink` when no color class is passed.
- RN mirrors `left`/`right` in RTL. Use `fromLeft(x)` for art pinned to the physical left.
- Dynamic RTL (language switch) needs an app reload and doesn't work in Expo Go. Use the dev build.
- **Write migration files directly** (`YYYYMMDDHHMMSS_name.sql`); `supabase migration new` inside `$(...)` hung twice and left an empty file that push recorded as applied. Verify after each push.
- `router.replace()` from an iOS formSheet only closes the sheet. Use `router.back()` then `router.push()` (see `capture/index.tsx`).
- Image picker plugin: don't set `microphonePermission: false`; it deletes the mic key that speech recognition needs, and iOS kills the app.
- RN `TextInput` doesn't flip `textAlign: 'left'` in RTL. Use `I18nManager.isRTL ? 'right' : 'left'`.
- **Real iPhone with a free Apple ID (until the paid developer account exists):** `PERSONAL_TEAM=1 npx expo prebuild -p ios`, pick the Personal Team once in Xcode (Bestim target → Signing & Capabilities), then `PERSONAL_TEAM=1 npx expo run:ios --device`. The flag (see `app.config.js`) drops the push entitlement and uses `com.bestim.app.dev`, so the real identifier is never claimed by a personal account. Google sign-in does not work in that build; the build expires after 7 days. Run `npx expo prebuild -p ios` without the flag to get the normal project back before a simulator or store build.
- `expo prebuild` resets the signing team chosen in Xcode. For the free-Apple-ID build, pass it on the command line instead: `xcodebuild … -allowProvisioningUpdates DEVELOPMENT_TEAM=<team id> CODE_SIGN_STYLE=Automatic` (the id is in `codesign -dv` of the last built `Bestim.app`).
- New native packages (camera, image crop, text reader, added 2026-10-03) need a fresh build on every device and simulator; an old build shows a red "Cannot find native module" screen.
- `pod install` crashes with "Unicode Normalization not appropriate for ASCII-8BIT" unless the shell has `LANG=en_US.UTF-8`.
- Reviewing on the simulator: deep links (`xcrun simctl openurl booted "bestim://reminders"`) are more reliable than taps after many hot reloads.
- **Query data must be plain JSON** (no Map/Set/Date): the cache is persisted to disk for offline use. Bump the key in `src/lib/queryClient.ts` when a query's shape changes.
- **Local dates only:** `toLocaleDateString('en-CA')` or date-fns `format`; `toISOString().slice(0,10)` is UTC and is a day off in Egypt.
- Screen builders write text to `src/locales/pending/`; until it's merged the screen shows raw keys. Merge before showing the founder.
- Changing `src/lib/palette.js` (Tailwind colors) needs Metro restarted with `--clear`.
- Dev-client quirks (not bugs): it can replay the last deep link on reload, and the dev-menu intro sheet reappears after reloads.
- Figma MCP is on the Starter plan (20 reads/month, used up). Design source = `screens/` PNG exports + `docs/figma-metadata.xml`.
- iOS simulator dev build: `npx expo run:ios --device "iPhone 16"` (needs `LANG=en_US.UTF-8` for CocoaPods). It needs macOS + Xcode, so a cloud session can't run it. The founder verifies on their Mac.

## Cloud sessions (Claude Code on the web)
- The environment variables hold only the public `EXPO_PUBLIC_*` values (Supabase URL + anon key, Google web/iOS client IDs). The setup script writes them to `.env`: `printenv | grep '^EXPO_PUBLIC_' > .env && npm ci`.
- Network is set to Custom and allows `*.supabase.co`, `api.supabase.com`, `docs.expo.dev`.
- **Migrations:** the cloud session writes the SQL file and pushes it. The founder runs `supabase db push` + `npm run types` on the Mac. There's no Supabase access token in the cloud.
- There's no simulator in the cloud. The founder pulls and runs `npx expo start` on the Mac to review.

## How work is organized
- ponytail **ultra** every session.
- Opus = architecture, schema/RLS, auth, review. Sonnet subagents = screens from the PNGs. Haiku = mechanical work.
- Product questions go to a **PM subagent** that decides and logs in `docs/decisions.md`. Ask the founder only about credentials, accounts, money, or scope.
- GitHub: `bestimconnect/Bestim` on `main`, pushed as **Shady110**.

## Phase 6 kickoff checklist
1. Finish the QA list under "Open items" first (English pass, light mode of Phase 5, tap-through flows).
2. Android APK for testers (steps under "Open items").
3. With the Apple Developer account: restore Apple sign-in (Q6), EAS iOS build → TestFlight, push keys.
4. Briefs for screen builders: `docs/phase3-brief.md`, `phase4-brief.md`, `phase5-brief.md`. PM decisions continue at Q51.
