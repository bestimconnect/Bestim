# Bestim: Build Progress

Updated 2026-10-02. Read this first in any new session. The spec is `docs/BESTIM-TECH-PLAN.md`, the product decisions are in `docs/decisions.md`, and the conventions are in `CLAUDE.md`.

## Phase status

| Phase | Scope (spec §14) | Status |
|---|---|---|
| 1 · Foundation | Expo scaffold, tokens, Supabase, i18n/RTL, UI kit, root layout | ✅ Done |
| 2 · Auth & onboarding | Screens 01, 02, 03–05, 30–35, 49, 50 + reset password; email + Google login | ✅ Done (Apple deferred: decisions Q6) |
| 3 · Core features | Home (06/07/36), vehicles (08/09), parts (11/12), capture (13–17), history (10/18/19/20/39), feature gate (37), guest mode | ✅ Done |
| 4 · Reminders & expenses | Reminders (21/22/38), update odometer (25), expenses (23/24/40) | ✅ Done |
| 5 · Account & polish | Account (26), notification prefs (28), export (27), share/receive (41/42), feedback (43–48), on-device reminders, offline, delete vehicle/account | ✅ Built (QA gaps below) |
| 6 · Release | Needs the Apple Developer account: Sign in with Apple, server push, TestFlight, Android Google key, universal links, store submission, partner's voice function | ⏭ Next |

## App flow (decisions Q8)
Splash → Language (01) → Tour 33→34→35 (once per device, `settingsStore.tourSeen`) → Welcome (02) → Sign in (30) / Create account (31) → Your profile (32, only if `profiles.full_name` is empty) → Add vehicle 03→04→05 → Home (tabs).
The gate lives in `src/app/_layout.tsx`. `profiles.onboarding_completed` = "first vehicle added".

## What exists (Phases 1–5)
- **UI kit** (`src/components/ui/`): Text, Button, Field, Card, Item, Header, Note, Divider, Progress, Choice (`className` for the track), Metric, GoogleIcon. Also `Hero`, `TourSlide`, `TabBar`, `PartMetric` in `src/components/`.
- **Data hooks** (`src/lib/queries.ts`): vehicles, current vehicle, logs, log, service types, parts (`useVehicleParts` + `needsAttention`), snoozes, expenses, `useIsGuest`. Part status math: `src/lib/parts.ts` (pure, checked by `npm run check`). Voice parser mock: `src/lib/voice.ts` (swap point `USE_MOCK` in `capture/voice.tsx`).
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
- **Checks:** `npm run check` runs 5 checks (parts, voice, export, reminder rules, and locales: every label used in code must exist in both languages).

## Open items
- **Not verified yet (QA):**
  - English/LTR layout of the Phase 3–5 screens;
  - light mode of the Phase 5 screens (they were reviewed in dark);
  - tapping through: voice → save, receipt photo, correction, add expense, export share sheet, share → receive → accept, delete vehicle/account, offline queue, scheduled notifications list.
  - The database rules behind these were tested on the live DB.
- A red error with no message appears when the success screen is deep-linked straight into the permission modal (not a user path). Cause unknown.
- Privacy policy URL (`EXPO_PUBLIC_PRIVACY_URL`) is not set, so the Account footer link is hidden.
- Android test build: `eas.json` is ready (profile `preview` = APK). Needs the founder's Expo login, then `npx eas-cli init` and `npx eas-cli build -p android --profile preview`. Google sign-in won't work on Android until the Android OAuth client exists.
- **Phase 6 (after the Apple Developer account):** Sign in with Apple (decisions Q6), server push (APNs + a scheduled Edge Function; on-device stays as fallback), TestFlight build, Android Google client + SHA-1, universal links for share links, store submission, the partner's `process-voice-log` function (`USE_MOCK` in `capture/voice.tsx`).

## Environment & gotchas (learned the hard way)
- `.env` is **git-ignored** and holds EXPO_PUBLIC_SUPABASE_URL/ANON_KEY, EXPO_PUBLIC_GOOGLE_WEB/IOS_CLIENT_ID and SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET. A new machine or cloud session must recreate it.
- Supabase project ref `wlepubflnjcguosicuak`. `supabase link` is needed on a new machine. Schema changes go through migrations only.
- **`supabase config push` applies immediately, with no prompt.** Before pushing, make config.toml match the remote (email confirmations on, TOTP MFA on, OTP length 8, max_frequency 1m0s). Load `.env` first (`set -a; . ./.env; set +a`) so the Google secret resolves.
- **Tailwind font sizes/line heights must be px strings.** A unitless lineHeight is a multiplier and pushes text off-screen.
- NativeWind resolves conflicting classes by stylesheet order, not className order. That's why `Text` only defaults to `text-ink` when no color class is passed.
- RN mirrors `left`/`right` in RTL. Use `fromLeft(x)` for art pinned to the physical left.
- Dynamic RTL (language switch) needs an app reload and doesn't work in Expo Go. Use the dev build.
- **Write migration files directly** (`YYYYMMDDHHMMSS_name.sql`); `supabase migration new` inside `$(...)` hung twice and left an empty file that push recorded as applied. Verify after each push.
- `router.replace()` from an iOS formSheet only closes the sheet. Use `router.back()` then `router.push()` (see `capture/index.tsx`).
- Image picker plugin: don't set `microphonePermission: false`; it deletes the mic key that speech recognition needs, and iOS kills the app.
- RN `TextInput` doesn't flip `textAlign: 'left'` in RTL. Use `I18nManager.isRTL ? 'right' : 'left'`.
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
