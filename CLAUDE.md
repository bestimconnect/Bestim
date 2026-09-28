@AGENTS.md

# Bestim

Spec: `docs/BESTIM-TECH-PLAN.md`. Figma: https://www.figma.com/design/69ivy8SOlNYxeSTUxM00Km/Bestim

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
