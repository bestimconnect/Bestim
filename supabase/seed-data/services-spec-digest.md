# Services rework: spec digest (Bug report 2026-11-17, section 2, bug #27 + #25/#28)

Source: docs/ahmed-reports-2026-11-17/Bestim_Bug_Report.pdf pages 30-55. Catalog data is in services-catalog.json.

## Model: Visit > Job > Line items (2.2)
1. Visit: date, odometer, workshop/person name and phone (optional), notes, receipt photos. Visit total = sum of its jobs.
2. Job: specialist + job type (catalog or free text) + position if relevant + labor cost (required, 0 allowed) + notes. Job total = labor + sum of line items. Specialist is attached to the JOB (one visit can have a mechanic and an electrician).
3. Line item: type, name, qty, unit, unit price, total, optional brand, origin, condition, part number, warranty.
Catalog levels for picking: Specialist > Category > Job type > suggested items (tappable chips that pre-fill line items; custom item always allowed).
Example: 2026-11-11, 282,400 km, workshop Hassan; head gasket job: labor 800, gasket 600, head bolts x10 150, sealant 80, cleaner spray 60, sensor 400, head skimming (machine shop) 250 = EGP 2,340.

## Line item types (2.3)
part, consumable, labor (one per job, required, 0 for DIY), machine_shop, diagnostic, towing, tip, other. (Catalog uses P/C/S: S = service/fee incl. special labor, machine shop, inspection.)
Optional attributes: origin (OEM/dealer, Korean, Japanese, German, Turkish, Taiwanese, Chinese, Egyptian/local, Other), condition (New, Used scrapyard, Imported used, Rebuilt), position (FL, FR, RL, RR, front pair, rear pair, all four), unit (piece, set/kit, pair, litre, can/bottle, kg, metre), brand, part number, warranty months. Origin must be settable with one tap.

## Specialists (2.4): 28 with jobs + Dealer + Self/DIY + Other
Dealer and DIY show ALL jobs; DIY labor defaults to 0; Other = free text name. Instrument cluster: do NOT offer odometer changes.

## Screens (2.6)
- Tab renamed Parts -> Services (Arabic label = Arabic word for services).
- Default view: tracked items grid grouped by system (24 systems, 2.5), tile = health ring, remaining km, last done date. Only job types with an interval are tracked.
- Second view (segmented): history, chronological visits; filters: specialist, system, date range; tap opens editable details. Specialist is NOT a car-screen tab/filter bar.
- Add flow: 1 who (specialist grid + search, optional workshop name/phone remembered) 2 what (job picker filtered by specialist, multi-select, EN+AR search with aliases, "Custom job") 3 per job: chips, qty and price, labor (required, 0 allowed, default 0 DIY) 4 visit: date (default today), odometer (default latest, must be >= previous), notes, receipts 5 review: totals labor / parts / consumables / other; "Add another specialist".
- After save: update tracked items per tracked job type (last done km + date), write ONE expense per visit (category Maintenance, with breakdown), recompute health.
- Voice ("Say it") and typed must produce the same visit > jobs > line items structure, matching catalog and aliases.
- Migration: each existing Parts record -> one visit, one job (specialist Unknown / Mechanic), one Part line item holding the old amount. Keep interval tracking.

## Data model (2.7)
Specialist {id,key,name_en,name_ar,icon}; SystemGroup {id,name_en,name_ar,order}
JobType {id, specialist_keys[], category_en, category_ar, system_id, name_en, name_ar, aliases_ar[], tracked bool, default_interval_km?, default_interval_months?, needs_position bool, suggested_items[] (CatalogItem.id)}
CatalogItem {id, kind: part|consumable|service, name_en, name_ar, aliases_ar[], default_unit}
ServiceVisit {id, car_id, date, odometer_km, workshop_name?, workshop_phone?, notes?, receipt_photos[], created_at, updated_at, deleted_at? (soft delete, 30-day recovery like #22/#23)}; totals derived, never stored by hand
ServiceJob {id, visit_id, specialist_key, specialist_custom_name?, job_type_id?, custom_job_name?, position?, labor_cost, notes?, next_due_km_override?, next_due_months_override?}
LineItem {id, job_id, type: part|consumable|machine_shop|diagnostic|towing|tip|other, catalog_item_id?, name, qty, unit, unit_price, total, brand?, origin?, condition?, part_number?, warranty_months?}
TrackedItem {car_id, job_type_id, interval_km, interval_months, last_done_km?, last_done_date?, source_job_id?}; health computed, not stored.

## Health (2.8, fixes #25 and #28)
- km_used = current_odometer - last_done_km; months_used = months since last_done_date.
- usage = max(km_used / interval_km, months_used / interval_months), only limits that exist.
- health = clamp(1 - usage, 0, 1). Remaining km = interval_km - km_used. Due date estimate = today + remaining_km / daily_average_km (from odometer history).
- Status: Good (health > 30%), Due soon (<= 30% or within 1,000 km / 30 days), Overdue (<= 0). Show remaining km + estimated due date on the part screen.
- Recalculate on every odometer update, every new record, and app open.
- Car health (Overview, #25): lowest health of tracked items, or weighted average with safety items (brakes, tyres, brake fluid) weighing more. Ring always renders; empty state "Not tracked yet" / 0 items; 100% or 0% both acceptable if visible.
- #28 example: brake pads done 11 Nov, interval 40,000 km; 7 days and some km later ring must move and show "39,xxx km left".
- Default intervals editable per car; general figures (Egyptian/Arab guides), not manufacturer values: engine oil 5,000 km (mineral) to 10,000 km (synthetic) or 6 months; air filter 20,000-30,000 km; fuel filter 30,000-40,000 km; spark plugs about 32,000-48,000 km; brakes 30,000-60,000 km; brake fluid every 2 years (about 40,000 km); automatic gearbox oil 40,000-60,000 km; timing belt and accessory belts around 60,000 km and up. Later per-model schedules (e.g. Nissan Sunny) override.
  (Note: catalog 2.10 itself says spark plugs 30,000-60,000 km, brakes per job as listed; use the catalog values for seeding.)

## Related fixes (2.9)
- Expenses "Where does the money go?" sorted by amount, highest first (#16); show labor vs parts once labor exists.
- Fuel consumption (#7, #26): full-to-full method (litres added at next full fill-up / km since previous full fill-up); explain exactly what data is missing when not computable.
- Deleting a visit = soft delete, 30-day recovery (#22, #23).

## Aliases (2.12)
Store as aliases_ar; normalise Arabic before matching (alef forms, taa marbuta/haa, yaa/alef maqsura, remove tatweel and diacritics). 30 groups in services-catalog.json "aliasGroups".

## Acceptance criteria (2.13)
1. Tab named "Services"; old Parts grid replaced by tracked-items view; second view lists all services by visit.
2. One visit, several jobs, one or more specialists, each job own labor cost and any number of line items (2.3 types).
3. Every job type and item in 2.10 available in EN and AR, search by aliases; custom jobs and items allowed.
4. Totals derived (labor, parts, consumables, other) and flow into Expenses; Expenses breakdown sorted highest first.
5. Tracked items show health, remaining km, estimated due date, update after each odometer update; Overview health ring always renders.
6. Voice and typed logging create the same structure.
7. Existing Parts data migrated without loss.
8. Deleting a visit is soft delete with 30-day recovery.

## Not in the PDF
No fuel-type (diesel/hybrid/EV) hints exist anywhere in section 2; every job has "fuel": null.
