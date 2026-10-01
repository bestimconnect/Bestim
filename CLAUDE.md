@AGENTS.md

# Bestim (mobile app)

**Shared briefing for all Bestim projects (product, brand, backend, accounts, updates):** `../CLAUDE.md`. Add a dated line to `../docs/UPDATES.md` when something changes that the other projects care about.

**Start here:** `docs/PROGRESS.md` (phase status, flow, gotchas). Spec: `docs/BESTIM-TECH-PLAN.md`. Decisions: `docs/decisions.md`.

## Design source: `screens/` (use this, NOT the Figma MCP)
- PNG exports: `screens/<arabic|english> <light|dark> screens/Bestim/انطلاقة جديدة/<NN>/<name>.png`, where NN = the screen ID from spec §9. The component sheets are in `screens/components <light|dark> arabic/…/Components/fresh/<component>/…png` and `screens/english <light|dark> components/…`.
- Arabic light is the primary reference. Check English for copy/LTR. Ignore the dark PNGs (see Conventions).
- Exact sizes, positions and all text strings: `docs/figma-metadata.xml` (the full Figma layer tree). Node IDs are in `docs/figma-screens.md`.
- Figma MCP (Starter plan, 20 reads/month): only as a last resort.

## Session rules
- Run every session with `/ponytail:ponytail ultra`.
- Product/design questions go to a **PM subagent** that decides; log each decision in `docs/decisions.md`. Ask the user only about credentials, accounts, money, irreversible actions, or scope (like starting a new phase).
- Delegate to cheaper models when quality holds: Opus = architecture, schema/RLS, auth, review. Sonnet subagents = screens/components from Figma once patterns exist. Haiku = mechanical work (i18n strings, repetitive files).

## Conventions (deviations from the spec are deliberate)
- Code lives in `src/` (Expo SDK 57 template). Routes in `src/app/`.
- Colors: `src/lib/palette.js` is the single source. Tailwind classes (`bg-paper`, `text-ink`) resolve to CSS vars set per theme in `_layout.tsx`. No `dark:` prefixes. For icon colors use `useColors()`.
- Theme = the user's setting (`settingsStore.theme`, default light, changed in Account settings), NOT the OS appearance. `(auth)` and `(onboarding)` are always light (`useScheme()` in src/lib/theme.ts).
- **Dark theme is our own, not Figma's** (founder, 2026-10-01: Figma's dark screens invert the hero/tab bar/cards to white). Don't use the dark PNGs as a reference. Depth: `bg-paper` (page) < `bg-white` (cards) < `bg-panel` (hero, tab bar, dark cards). Text on `bg-panel` is `text-onpanel` (light in both themes). `bg-ink`/`text-paper` are only for inverted selection pills (Choice).
- Text on lime/danger is fixed hex (`text-[#222E29]` on lime).
- Shadows: `style={{ boxShadow: shadows.x }}` from `src/lib/theme.ts`.
- Always render text with `components/ui/Text` (picks Tajawal/Poppins by language).
- No services/ layer or extra stores until duplication demands it. Query hooks call `supabase` directly.
- One locale file per language: `src/locales/{ar,en}.json`.
- Dynamic RTL switching does not work in Expo Go (dev build only).
- Google/Apple sign-in and expo-speech-recognition need a dev build.

## Supabase
Schema changes only through migrations: `supabase migration new <name>` → edit SQL → `supabase db push` → `npm run types`.

## Reviewing in the simulator
- Xcode dev build on the **iPhone 16** simulator: `npx expo run:ios --device "iPhone 16"` (first time or after native deps change). Otherwise `npx expo start` and press `i`.
- `ios/` and `android/` are generated. Never edit them; they're git-ignored.
