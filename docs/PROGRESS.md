# Bestim: Build Progress

Updated 2026-09-29. Read this first in any new session. The spec is `docs/BESTIM-TECH-PLAN.md`, the product decisions are in `docs/decisions.md`, and the conventions are in `CLAUDE.md`.

## Phase status

| Phase | Scope (spec §14) | Status |
|---|---|---|
| 1 · Foundation | Expo scaffold, tokens, Supabase, i18n/RTL, UI kit, root layout | ✅ Done |
| 2 · Auth & onboarding | Screens 01, 02, 03–05, 30–35, 49, 50 + reset password; email + Google login | ✅ Done (Apple deferred: decisions Q6) |
| 3 · Core features | Home (06/07/36), vehicles (08/09), parts (11/12), capture (13–17), history (10/18/19/20/39), feature gate (37), guest mode | ✅ Done |
| 4 · Reminders & expenses | Reminders (21/22/38), update odometer (25), expenses (23/24/40) | ✅ Done |
| 5 · Account & polish | Account (26/27/28/41/42), feedback (43–48), push, offline, QA | ⏭ Next |

## App flow (decisions Q8)
Splash → Language (01) → Tour 33→34→35 (once per device, `settingsStore.tourSeen`) → Welcome (02) → Sign in (30) / Create account (31) → Your profile (32, only if `profiles.full_name` is empty) → Add vehicle 03→04→05 → Home (tabs).
The gate lives in `src/app/_layout.tsx`. `profiles.onboarding_completed` = "first vehicle added".

## What exists (Phases 1–4)
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
- **Theme:** the user setting (default light; the switch comes with Account in Phase 5). Auth + first-run onboarding are always light.

## Open items (not blocking Phase 3)
- Sign in with Apple: add before App Store submission (decisions Q6 has the restore steps).
- Google on Android needs an Android OAuth client + SHA-1 from the first EAS build.
- Voice backend (partner's Edge Function) isn't ready: `processVoiceLog` is mocked (`src/lib/voice.ts`). Speech recognition needs a real iPhone (the simulator shows a dev text box instead).
- Push notifications for due reminders: Phase 5.
- Not visually reviewed yet: English/LTR for the Phase 3–4 screens (strings are complete in both languages).

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

## Phase 5 kickoff checklist
1. Account & settings (26) replaces `src/app/(tabs)/account/index.tsx` and keeps the Expenses row. The theme switch lives here (`settingsStore.setTheme`), plus language (`applyLanguage`) and sign out.
2. Notification prefs (28) + push for reminders due soon (expo-notifications needs a native rebuild).
3. Export (27), share/receive history (41/42): `get_share(token)` already exists.
4. Feedback sheets (43–48), offline banner + offline manual logs.
5. The screen-builder brief pattern: `docs/phase3-brief.md` + `docs/phase4-brief.md`. PM decisions continue at Q33.
