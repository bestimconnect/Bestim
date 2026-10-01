# Phase 3 screen brief (for screen-builder agents)

Repo: /Users/shadygamal/Bestim (Expo SDK 57, Expo Router, NativeWind v4, TanStack Query v5, zustand, i18next). Read `CLAUDE.md`, `docs/decisions.md` (Q9–Q19 are the Phase 3 product decisions, and they are binding), and `/Users/shadygamal/.claude/plans/snoopy-knitting-meteor.md` (the plan).

## Design source
- PNG (primary): `screens/arabic light screens/Bestim/انطلاقة جديدة/<NN>/…png`. English: `screens/english light screens/Bestim/…/<NN>/`. Dark: `screens/arabic dark screens/…`. Look at the PNGs with the Read tool and match layout, spacing, sizes, colors and copy closely.
- Exact strings and sizes: `docs/figma-metadata.xml` (grep by the node IDs in `docs/figma-screens.md` or by Arabic text).
- Do NOT use the Figma MCP.

## Already built (reuse, don't duplicate)
- UI kit `@/components/ui`: `Text` (variants display/title/heading/body/label/caption/number/small-number; always use it for text), `Button` (primary/secondary/dark/danger, `icon`, `loading`), `Field`, `Card`, `Item` (72h row, icon badge tones mint/paper/sky/amber/blush, chevron), `Header` (back button + title + `right`), `Note` (tones info/success/alert/warning), `Divider`, `Progress`, `Choice` (segmented; pass `className="bg-line"` on paper screens), `Metric` (big number cards: tones white/lime/glass, `aside` slot).
- `@/components/Hero`: `useLightStatusBar()` for screens with an ink header, `fromLeft()`.
- Data hooks in `@/lib/queries`: `useIsGuest`, `useVehicles`, `useCurrentVehicle`, `useVehicle(id)`, `useServiceTypes`, `useVehicleLogs(vehicleId)`, `useLog(id)`, `useVehicleParts(vehicle)` (→ `parts: {serviceType, log, status}` sorted most urgent first; `status.state` ok|soon|overdue, `remainingKm`, `remainingDays`, `dueOdometer`, `dueDate`). Types `Vehicle`, `Log`, `ServiceType`, `Part`.
- `@/lib/parts` (pure status math), `@/lib/voice` (`parseTranscript` = the mock voice parser; returns `{service_type (name_en), parts, cost, odometer, needs_clarification, questions:[{kind:'interval_or_product', value, phrase}]}`).
- Stores: `@/stores/logDraft` (`useLogDraft`: in-progress log for capture → clarify → review → save, and for corrections via `logId`), `@/stores/settingsStore` (`currentVehicleId`, `setCurrentVehicle`, `language`, `theme`).
- `supabase` from `@/lib/supabase` (typed). DB has:
  - `maintenance_logs.interval_km/interval_months`;
  - `vehicles.odometer_updated_at`;
  - RPC `correct_log(log_id uuid, changes jsonb, reason text)` (changes = only the changed fields as strings; keys title, service_type_id, odometer_reading, cost, service_date, location, description);
  - storage bucket `receipts` (private, object path must start with `<auth.uid()>/`);
  - a DB trigger that sets `status='needs_review'` on suspicious readings and bumps `vehicles.current_odometer`.
- After writes: `queryClient.invalidateQueries({ queryKey: ['vehicles'] })` and `['logs']` (and `['log', id]`).
- Routes (placeholder files already exist; replace their content):
  - `src/app/(tabs)/index.tsx`, `(tabs)/vehicles/index.tsx`, `(tabs)/vehicles/[id].tsx`;
  - `capture/index|voice|clarify|review|manual.tsx`;
  - `history.tsx`, `part.tsx`, `part-history.tsx`;
  - `log/[id].tsx`, `log/corrections.tsx`, `log/review-reading.tsx`;
  - `update-odometer.tsx`, `feature-gate.tsx`.
  - Typed routes: `router.push({ pathname: '/part', params: {...} })`.
  - The tab bar is absolute (68px + safe-area bottom): give tab screens bottom padding ~120 so content isn't hidden.
  - Add another vehicle = `router.push({ pathname: '/add-vehicle', params: { mode: 'extra' } })`.

## Conventions
- Colors only via classes `bg-paper text-ink bg-white text-muted text-teal bg-mint bg-amber bg-blush bg-sky bg-lime bg-line`, etc. No `dark:` prefix. Icon colors come from `useColors()` (`@/lib/theme`). Text on lime uses fixed `text-[#222E29]`. Shadows: `style={{ boxShadow: shadows.soft }}`.
- Tab screens follow the user's theme (light/dark), so check that classes, not hex, are used, except for the fixed on-lime/on-ink text.
- RTL: Arabic is RTL via I18nManager. Use flex-row and start/end (`ps-`, `pe-`, `ms-`, `me-`); never hardcode left/right. Chevrons: see `Item.tsx`. Numbers: `toLocaleString('en-US')` (the design shows Latin digits).
- Icons: lucide-react-native. Map `service_types.icon` (a lucide name string like 'Droplets') with `import * as Icons from 'lucide-react-native'` → `(Icons as any)[name] ?? Icons.Wrench`, or use a small map. Keep it simple.
- Dates: date-fns `format` with the `ar`/`enUS` locale by `i18n.language`.
- React Compiler is on: no manual memo needed. Keep files lean; no new abstractions unless two of *your* screens share it (then put it in `src/components/`, named clearly).
- Code comments: one line with the screen number and the Figma node (see `(onboarding)/first-log.tsx` for style).

## i18n (important: avoid edit collisions)
Do NOT edit `src/locales/ar.json` / `en.json` (other agents work in parallel). Put ALL your new strings in `src/locales/pending/<your-agent-letter>.ar.json` and `.en.json`, nested under your top-level namespace (given in your task). Use them with `t('<namespace>.<key>')` as if they were already merged. The lead merges them. Arabic copy must match the PNG exactly; English copy comes from the English PNGs/XML, or decisions.md when given.

## Done criteria
- `npx tsc --noEmit` passes (ignore errors in files owned by other agents, but none may be in yours) and `npx expo lint` shows no errors in your files.
- Don't run the simulator, don't commit, don't touch files outside your list (except new files in `src/components/` and your pending locale files). If you need a change in a shared file (ui kit, queries, stores, layouts), don't make it: describe it in your final report.
- Final report: files created, any shared-file change requests, any decision you made that isn't in decisions.md (a one-liner each).
