# Bestim: Build Progress

Updated 2026-09-28. Read this first in any new session. The spec is `docs/BESTIM-TECH-PLAN.md`, the product decisions are in `docs/decisions.md`, and the conventions are in `CLAUDE.md`.

## Phase status

| Phase | Scope (spec §14) | Status |
|---|---|---|
| 1 · Foundation | Expo scaffold, tokens, Supabase, i18n/RTL, UI kit, root layout | ✅ Done |
| 2 · Auth & onboarding | Screens 01, 02, 03–05, 30–35, 49, 50 + reset password; email + Google login | ✅ Done (Apple deferred: decisions Q6) |
| 3 · Core features | Home (06/07/36), vehicles (08/09), parts (11/12), capture (13–17), history (10/18/19/20/39), feature gate (37) | ⏭ Next |
| 4 · Reminders & expenses | Reminders (21/22/25/38), expenses (23/24/40) | Upcoming |
| 5 · Account & polish | Account (26/27/28/41/42), feedback (43–48), push, offline, QA | Upcoming |

## App flow (decisions Q8)
Splash → Language (01) → Tour 33→34→35 (once per device, `settingsStore.tourSeen`) → Welcome (02) → Sign in (30) / Create account (31) → Your profile (32, only if `profiles.full_name` is empty) → Add vehicle 03→04→05 → Home (tabs).
The gate lives in `src/app/_layout.tsx`. `profiles.onboarding_completed` = "first vehicle added".

## What exists (Phases 1–2)
- **UI kit** (`src/components/ui/`): Text, Button (with `icon`), Field, Card, Item, Header, Note, Divider, Progress, Choice, GoogleIcon. Also `Hero` (+ `Wordmark`, `fromLeft`, `useLightStatusBar`) and `TourSlide` in `src/components/`.
- **Tab bar:** `src/components/TabBar.tsx`, a custom ink nav with a lime center button. The tabs in `src/app/(tabs)/` are **placeholders**. Phase 3 replaces them.
- **Auth:** email/password, Google (native `@react-native-google-signin/google-signin` → `signInWithIdToken`), email-link deep links (`sessionFromUrl` in `src/lib/session.ts`), and reset password.
- **DB:** 3 migrations in `supabase/migrations/`, with RLS tested (two-user test passed). Tables: profiles, vehicles (+ nickname, vehicle_type, odometer unit km/mi/h), service_types (18 seeded), maintenance_logs, log_corrections, reminders, expenses, vehicle_shares + the `get_share(token)` RPC.
- **Theme:** the user setting `settingsStore.theme` (default light). Auth and onboarding are always light.

## Open items (not blocking Phase 3)
- Sign in with Apple: add before App Store submission (decisions Q6 has the restore steps).
- Google on Android needs an Android OAuth client + SHA-1 from the first EAS build.
- Guest browsing ("Continue as guest", screen 36) is hidden until Phase 3 builds the guest home (Q4).
- Voice backend (partner's Edge Function) isn't ready. Mock it in Phase 3 (spec §8).

## Environment & gotchas (learned the hard way)
- `.env` is **git-ignored** and holds EXPO_PUBLIC_SUPABASE_URL/ANON_KEY, EXPO_PUBLIC_GOOGLE_WEB/IOS_CLIENT_ID and SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET. A new machine or cloud session must recreate it.
- Supabase project ref `wlepubflnjcguosicuak`. `supabase link` is needed on a new machine. Schema changes go through migrations only.
- **`supabase config push` applies immediately, with no prompt.** Before pushing, make config.toml match the remote (email confirmations on, TOTP MFA on, OTP length 8, max_frequency 1m0s). Load `.env` first (`set -a; . ./.env; set +a`) so the Google secret resolves.
- **Tailwind font sizes/line heights must be px strings.** A unitless lineHeight is a multiplier and pushes text off-screen.
- NativeWind resolves conflicting classes by stylesheet order, not className order. That's why `Text` only defaults to `text-ink` when no color class is passed.
- RN mirrors `left`/`right` in RTL. Use `fromLeft(x)` for art pinned to the physical left.
- Dynamic RTL (language switch) needs an app reload and doesn't work in Expo Go. Use the dev build.
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

## Phase 3 kickoff checklist
1. Build Home first (06 today / 07 empty / 36 guest) in `src/app/(tabs)/index.tsx`, and restore "Continue as guest" on login (Q4).
2. Decide the routing for detail screens: vehicle `[id]`, part `[id]`, log detail, and whether they hide the tab bar. Check the PNGs.
3. The voice capture UI (13/14/17/15) uses a mocked `processVoiceLog` (spec §8). expo-speech-recognition needs a native rebuild.
4. Maintenance history + corrections (10/18/19/20/39) write `log_corrections` on edit.
