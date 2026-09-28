@AGENTS.md

# Bestim

Spec: `docs/BESTIM-TECH-PLAN.md`.

## Design source: `screens/` (use this, NOT the Figma MCP)
- PNG exports: `screens/<arabic|english> <light|dark> screens/Bestim/انطلاقة جديدة/<NN>/<name>.png`, where NN = the screen ID from spec §9. The component sheets are in `screens/components <light|dark> arabic/…/Components/fresh/<component>/…png` and `screens/english <light|dark> components/…`.
- Arabic light is the primary reference. Check dark for colors and English for copy/LTR.
- Exact sizes, positions and all text strings: `docs/figma-metadata.xml` (the full Figma layer tree). Node IDs are in `docs/figma-screens.md`.
- Figma MCP (Starter plan, 20 reads/month): only as a last resort.

## Session rules
- Run every session with `/ponytail:ponytail ultra`.
- Delegate to cheaper models when quality holds: Opus = architecture, schema/RLS, auth, review. Sonnet subagents = screens/components from Figma once patterns exist. Haiku = mechanical work (i18n strings, repetitive files).

## Conventions (deviations from the spec are deliberate)
- Code lives in `src/` (Expo SDK 57 template). Routes in `src/app/`.
- Colors: `src/lib/palette.js` is the single source. Tailwind classes (`bg-paper`, `text-ink`) resolve to CSS vars set per theme in `_layout.tsx`. No `dark:` prefixes. For icon colors use `useColors()`.
- Text on lime/danger is fixed hex (ink/white invert in dark mode).
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
