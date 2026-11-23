# Flows 11–14 audit (2026-11-23, branch `flows-11-14` from `v2`)

"Built" = a real route exists AND a tap path from Home reaches it. Paths are under `src/`. Read-only audit, no code changed.

**Headline:** Phases 3–6 of v2 are not started. The v2 database exists only as migration **files** (not pushed). The app still runs on the old `maintenance_logs` model. Nothing in `src/` calls `save_visit`, `search_catalog`, `recompute_tracked`, `car_health`, or any soft-delete function.

## Flow 11: Car, history and parts

| Screen | Route / file | Entry point | Reachable? | Matches design? | Data wired? | Gap |
|---|---|---|---|---|---|---|
| Update odometer | `app/update-odometer.tsx` | Home hero `(tabs)/index.tsx:161`, `lib/reading.ts:23`, `log/review-reading.tsx:89` | Yes | Yes (#1, #2, #4, #5 done; #3 needs a feel pass on device) | Real (`vehicles.update`) | No reading row, no health recompute call |
| Edit car | `app/edit-vehicle.tsx` | Pencil `vehicle/[id].tsx:76`, `switch-vehicle.tsx:56` | Yes | Yes (#24 ok: VIN tile read-only) | Real | none |
| Delete car | `app/delete-vehicle.tsx`, `DeleteConfirm.tsx` | `edit-vehicle.tsx:59`, `switch-vehicle.tsx:52`, `CarTabs.tsx:95` | Yes | Partly: typed confirm ok, no 30-day note | **Hard delete** (`delete-vehicle.tsx:23`) | #22 not fixed: needs `soft_delete_vehicle` |
| Pick a part | `app/pick.tsx` | `pickOption()` `lib/sheet.ts:38` | Yes, but generic | No | In-memory list | Not a part search over the 2,047-part tree |
| All records | `app/history.tsx` (re-export of Timeline) | none | **No** (no entry) | n/a | Old logs | Counts as missing |
| Correct record | `log/corrections.tsx`, `log/[id].tsx` | rows from Timeline, Part, Money, CarTabs | Yes | Mostly (header differs: `TabHeader` vs `PageHeader`) | Real (`log_corrections`) | Record delete is hard (`lib/removeRecord.ts:25`), no visit soft delete |
| Review reading | `log/review-reading.tsx` | Timeline `:175`, `log/[id].tsx:69` | Yes | Mostly | Real | Hard-coded `en-US`, 6-digit pad |
| Alerts | `components/home/Alerts.tsx`, `notifications.tsx` | `BellButton.tsx:20` | Yes | Partly: Today/Yesterday/Earlier, design has New/Earlier | **Local only** (`stores/notifyInbox.ts`) | #14 read state not in DB; #15 deep links done; dead `void [...]` at `:15` |
| Upgrade | `app/upgrade.tsx`, `plans.tsx` | `showUpgrade()` from limits, export, share, scanner 429, voice, `account/index.tsx:65,77` | Yes | Yes | Real (plans, entitlements) | none |

## Flow 12: Services and workshop visits

| Screen | Route / file | Entry point | Reachable? | Matches design? | Data wired? | Gap |
|---|---|---|---|---|---|---|
| Services tracked grid | missing | none (tabs: index, timeline, expenses, garage) | No | n/a | `tracked_items` + `tracked_health` exist in SQL only | New tab, `TabBar.tsx` icons/labels |
| All visits | missing (`history.tsx` is just Timeline) | none | No | n/a | `visits` in SQL only | Filters by specialist, system, date |
| Visit details | missing (`log/[id].tsx` is old single-log) | none | No | n/a | SQL only | new |
| Add: who did it | missing | none | No | n/a | `specialists` in SQL only | new |
| Add: what was done | missing | none | No | n/a | `job_types`, `search_catalog` in SQL only | new |
| Add: parts and labor | missing | none | No | n/a | `line_items` in SQL only | one labor line per job (enforced by `save_visit`) |
| Add: visit details | missing | none | No | n/a | `visits` | new |
| Add: review | missing | none | No | n/a | `save_visit` | new |
| Search a part | missing (`pick.tsx` is the base) | none | No | n/a | `catalog_items` + aliases | new |
| Browse all parts | missing | none | No | n/a | `systems`, `catalog_items` | new |

Entry points that exist but go to the OLD flow `/capture`: fan pencil `TabBar.tsx:149`, Timeline "Mark done" `ItemSheet.tsx:75`, Part page "Log this" `part.tsx:72,143`.

**Health:** `lib/health.ts` / `lib/parts.ts` compute client-side from the last log. "Due soon" is ≤1,000 km or ≤30 days, the server `item_health` uses ≤30% health. Car health is a plain average (design: lowest item or weighted). Client and server would disagree.

## Flow 13: Safeguards and permissions

| Screen | Route / file | Entry point | Reachable? | Matches design? | Data wired? | Gap |
|---|---|---|---|---|---|---|
| Log ready | `capture/review-all.tsx` | `voice.tsx:179`, `VoiceQueueCard.tsx:36` | Yes | Yes | Real (old `saveLog`) | Old shape, not visit/jobs |
| Log understanding (steps) | `capture/voice.tsx`, `VoiceSheet.tsx` | `lib/reading.ts:33`, fan mic | Yes | Yes (#19, #21 fixed; #20 UI done) | Real (`process-voice-log`) | Speed not measured; hex colours `VoiceSheet.tsx:47,105,147,164,168`; hard-coded "B" `:168` |
| Odometer scan | `components/OdometerScanner.tsx` | `update-odometer.tsx:144`, `add-vehicle.tsx:295` | Yes | Mostly | Real (`read-odometer`) | Hex `#F5F7F5/#FFFFFF` `:100,284,295`; OCR reliability unchecked (#11) |
| Photo source | `lib/sheet.ts` action sheet | Avatar only `account/edit.tsx:38` | Partly | No | n/a | Receipt photos launch the library directly (`capture/index.tsx:211`, `AddExpense.tsx:71`) |
| Camera permission | none (scanner shows a denied state `OdometerScanner.tsx:361`) | n/a | **No** | n/a | n/a | No pre-prompt screen (#18 usage strings are present) |
| Recently deleted | `account/deleted.tsx` | **none** (no link in `account/index.tsx`) | **No** | Partly | Hard-coded empty | Needs `my_deleted_items`, `restore_vehicle/visit` |
| Account restore | `(auth)/restore-account.tsx` | **none** (`_layout.tsx:141` never reads `deleted_at`) | **No** | Partly | Empty handlers | Needs `restore_my_account`, sign-in routing; hex `:28` |
| Delete account (feeds restore) | `app/delete-account.tsx` | `account/index.tsx` | Yes | Partly | **Hard delete** (`delete_my_account` `:40`) | #23 not fixed: needs `soft_delete_my_account` |

## Flow 14: Add a record by hand

| Screen | Route / file | Entry point | Reachable? | Data wired? | Gap / reuse |
|---|---|---|---|---|---|
| Add: start | missing (fan pencil opens old `/capture`) | `TabBar.tsx:149` → `openManual` `lib/reading.ts:38` | No | none | New `AddRecordSheet.tsx`; reuse `topChips` (`quickAdd.ts`), `tracked_health` for Due now |
| While typing | missing | none | No | none | New `catalog.ts` local cache; reuse `fold()` / `matches()` (`search.ts`) |
| No result (custom job) | missing | none | No | none | Reuse `pick.tsx:56` custom row |
| Quick form | missing (`capture/index.tsx` is the old single form) | none | No | none | Reuse Field, Chip, date picker, `tooLow` guard, `PartArt`, Toast Undo |
| Details | missing | none | No | none | Reuse `LOG_FIELDS`, receipt upload in `saveLog.ts` |
| More than one job | missing | none | No | none | Pattern: `capture/review-all.tsx` |
| Offline | partial | `useOnline`, `OfflineHome`, paused-mutation pattern in `saveLog.ts` | n/a | Old payload | Payload must become `save_visit` with idempotency id |

Not present: `catalog_version`, `VisitDraft` (`stores/visitDraft.ts`), local catalog cache. Voice (`voiceBatch.ts`, `normalizeRecords`) and manual (`capture/index.tsx` state) are separate drafts. `process-voice-log` still returns `maintenance / expense / odometer` records (`index.ts:81-85`).

## Backend (read-only check)

| Item | State |
|---|---|
| Schema, seeds (16 systems, 31 specialists, 225 job types, 2,428 catalog items), `save_visit`, `recompute_tracked`, `car_health`, `search_catalog`, `normalize_ar` (this is the SQL "fold") | Files in `supabase/migrations/20261121*` |
| `job_types.suggested_items uuid[]` | Exists (`...090000:87`), seeded |
| `catalog_version` | **Missing** |
| Soft delete + restore RPCs, `my_deleted_items`, `purge_soft_deleted` | Files exist; **pg_cron not enabled**, nothing schedules the purge; purge does not clean receipt photos |
| RLS and GRANTs on new tables | Written in the migration (reference read-only, visits/jobs/items/tracked own-row); anon-key check **not done** |
| Applied to remote | **Yes** (corrected 2026-11-23: the founder applied them; `my_deleted_items`, `save_visit`, `soft_delete_vehicle` confirmed in `pg_proc`). The docs saying "files only" were stale. Anon-key RLS check still to do |
| `src/types/database.ts` | Does not include any new table or RPC |
| Latest PM decision | Q143, next is Q144 |

## 28 bugs touching these flows
Fixed in code: #1, #2, #4, #5, #19, #21, #24 (and #15 deep links). Partly: #3 (feel pass), #11 (UI only), #14 (local read state), #18 (usage strings, no pre-prompt), #20 (UI, speed unmeasured). Not fixed: #22, #23 (no soft delete or restore wired), #27, #28 (Services), #25 (health ring depends on server health), #16 and the rest not checked in this pass.

## What this means for the build
1. Everything in Flows 12 and 14, plus delete/restore in Flow 13, needs the v2 migrations applied. **I cannot verify the RPCs, RLS or anon-key grants until you approve a push.** Until then I'd build against hand-written types and verify SQL in PGlite.
2. Voice and manual must end in one `VisitDraft` saved through `save_visit`, so `process-voice-log` output changes too.
