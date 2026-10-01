# Phase 4 screen brief (for screen-builder agents)

First read `docs/phase3-brief.md`: its design sources, UI kit, conventions, i18n "pending" rule and done criteria all apply unchanged. Binding product decisions: `docs/decisions.md` **Q21–Q32** (read them fully), plus Q10 (part states and copy) and Q17 (guests).

## New since Phase 3
- **DB:**
  - A log's cost automatically becomes an `expenses` row (`category='maintenance'`, `from_log=true`, `log_id`) via a trigger. Never insert those yourself.
  - `expenses.category` ∈ maintenance, fuel, insurance, registration, parking, parts, other.
  - User-added expenses have `from_log=false`; `log_id` is optional ("linked to a maintenance log", Q28).
  - **Snooze** (Q24) = insert into `reminders` `{ vehicle_id, service_type_id, title, status: 'dismissed', due_date: today + 7 (YYYY-MM-DD) }`. `user_id` defaults to `auth.uid()`. Snoozing again: delete the vehicle+type's active dismissed rows first, then insert.
- **`@/lib/queries`:**
  - `Part` now has `snoozedUntil`;
  - `needsAttention(parts)` = soon/overdue and not snoozed;
  - `useSnoozes(vehicleId)`;
  - `useExpenses()` = all of the user's expenses since `expensesSince()` (Jan 1st, or 6 months back if earlier), each with `vehicles(id, make, model, nickname)`. Filter by year/vehicle client-side;
  - `Expense` type.
  - After writes, invalidate `['expenses']`, `['snoozes']`, `['logs']`, `['vehicles']` as relevant.
- **Routes** (placeholders exist; replace them):
  - `src/app/(tabs)/reminders.tsx` (21 + 38 empty);
  - `src/app/reminder.tsx?vehicleId&serviceTypeId` (22, root stack, no tab bar);
  - `src/app/(tabs)/account/expenses.tsx` (23 + 40 empty; a stack inside the Account tab, so the tab bar shows; give it bottom padding ~120 and a back button);
  - `src/app/add-expense.tsx` (24, root).
  - `(tabs)/account/index.tsx` is the lead's Phase 5 placeholder: don't edit it, but it uses the key `expenses.title`, so agent F must define it.
- "I did the service" (Q24): `useLogDraft.getState().reset({ vehicleId, serviceTypeId, title: <type name in current language>, source: 'manual' })` then `router.push('/capture/manual')`.
- Stale odometer (Q23): `vehicles.odometer_updated_at`; target `/update-odometer`.
- Guests (Q31): at the top of 22/23/24, `if (useIsGuest()) return <Redirect href={{ pathname: '/feature-gate', params: { feature: 'reminders' | 'expenses' } }} />`. Add the `gate` title for `expenses` in your pending file under `gate.title.expenses` (agent F only).
