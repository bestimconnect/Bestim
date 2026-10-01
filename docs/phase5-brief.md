# Phase 5 screen brief (for screen-builder agents)

First read `docs/phase3-brief.md` and `docs/phase4-brief.md`: design sources, UI kit, conventions, the i18n "pending" rule and done criteria all apply unchanged. Binding product decisions: `docs/decisions.md` **Q33–Q49** (read them fully; they contain all the copy that isn't in the PNGs).

Designs: `screens/arabic light screens/Bestim/انطلاقة جديدة/{26,27,28,41,42,43,44,45,46,47,48}/`.

## New since Phase 4 (already built; reuse, don't duplicate)
- **UI kit:** `Toggle` (`value`, `onChange`, `label`).
- **Auth:** `signOut()` in `@/lib/auth` (signs out, clears the cache and the current vehicle, cancels reminders). The root gate then routes to Welcome by itself.
- **Theme / language:** `useSettings` → `theme`, `setTheme('light' | 'dark')`; `language`, `setLanguage` + `applyLanguage(lng)` from `@/lib/i18n` (flips RTL and reloads the app).
- **Notifications** (`@/lib/notifications`): `notificationsAllowed()`, `requestNotifications()` (asks the OS, then schedules), `syncNotifications()` (call it after saving prefs). Prefs live in `profiles.notification_prefs` (jsonb: `due_soon, overdue, odometer, weekly, quiet_from, quiet_to`; both quiet values `null` = off); the type `Prefs` and `DEFAULT_PREFS` are in `@/lib/reminderPlan.ts` (import with the `.ts` extension, like the existing imports of it). `settingsStore.notifyAsked` + `set({ notifyAsked: true })` for screen 45.
- **Export** (`@/lib/export`): `toCsv(vehicle, logs, options, labels)`, `toJson(vehicle, logs, options)`, `toHtml(vehicle, logs, options, labels)`, `excludedCount`. Build `labels` from your i18n keys. PDF: `expo-print` `printToFileAsync({ html })`. CSV/JSON: write with `expo-file-system` (read `node_modules/expo-file-system/README.md` or its types for the SDK 57 API: the new `File`/`Paths` API). Share sheet: `expo-sharing` `shareAsync(uri)`.
- **Share:** table `vehicle_shares` (insert `{ vehicle_id }` → returns `share_token`, expires in 7 days). RPCs: `supabase.rpc('get_share', { token })` → rows with `make, model, year, nickname, vehicle_type, log_count, shared_by_name, own`; `supabase.rpc('accept_share', { token })` → the new vehicle id (throws 'share not found' / 'own share'). QR: `react-native-qrcode-svg` (`<QRCode value={link} size={200} />`). Link: `bestim://receive?token=…`. A token opened while signed out or as a guest is stored by the root layout in `settingsStore.pendingShareToken` and reopened after sign-in. You don't handle that.
- **Delete account:** `supabase.rpc('delete_my_account')`. Remove the user's receipt files first: `supabase.storage.from('receipts').list(userId)` → `.remove(paths)`. Then `signOut()`.
- **Delete vehicle:** `supabase.from('vehicles').delete().eq('id', id)` (logs, expenses and reminders cascade). Remove that vehicle's receipt files first (paths in its logs' `photos`).
- **Offline:**
  - `onlineManager` from `@tanstack/react-query`; `useSyncExternalStore(onlineManager.subscribe, () => onlineManager.isOnline())` gives a live "online" boolean.
  - Cached queries are persisted, so screens keep their last data offline.
  - Saving a log is the shared mutation `useMutation({ mutationKey: SAVE_LOG_KEY })` (`@/lib/saveLog`: `SAVE_LOG_KEY`, type `SaveLogInput`; the function and its cache invalidation are registered globally in `@/lib/queryClient`).
  - Offline it stays paused and is sent on reconnect. `useMutationState({ filters: { mutationKey: SAVE_LOG_KEY, status: 'pending' } })` lists queued logs (their `variables` are the `SaveLogInput`).
- **Routes** (placeholders exist; replace them):
  - `(tabs)/account/index.tsx` (26), `(tabs)/account/notifications.tsx` (28), `(tabs)/account/export.tsx` (27), `(tabs)/account/share.tsx` (41);
  - `receive.tsx?token` (42);
  - `delete-vehicle.tsx?vehicleId` (46), `delete-account.tsx` (Q34);
  - `success.tsx?kind=log|vehicle…` (43/44);
  - `notify-permission.tsx` (45, presented as a modal).
  - Screens inside `(tabs)/account/` show the tab bar: bottom padding ~120.
- Guests (Q47): guard gated screens with `if (useIsGuest()) return <Redirect href={{ pathname: '/feature-gate', params: { feature } }} />`.
- Lessons from earlier phases:
  - RN `TextInput` doesn't flip `textAlign` in RTL: use `I18nManager.isRTL ? 'right' : 'left'`.
  - From an iOS formSheet/modal, use `router.back()` then `router.push()`, not `replace`.
  - Dates: use local dates (`toLocaleDateString('en-CA')`), never `toISOString().slice(0, 10)`.
  - Text on an ink card that must flip with the theme uses `text-paper`, not fixed white.
