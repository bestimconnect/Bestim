# Product decisions log

Decisions for Bestim made on the founder's behalf while they're away. Scope: Phases 1+2 (auth + onboarding) are closed; Phase 3 (home, guest home screen 36, vehicles, logs, voice) and Phase 4 (reminders tab 21/22/38, expenses 23/24/40) are in scope, per `docs/BESTIM-TECH-PLAN.md` and the phase plans. Phase 5 (account) is still out of scope.

Format: one entry per decision — **Q**, **Decision**, **Why**, **Spec for dev**. Append new entries below; don't edit past ones except to mark them superseded.

---

## 2026-09-28

### Q1: Password reset landing (no "set new password" screen in the design)

**Decision:** Add one new screen, `Reset password`, between the email link and login. On success, sign the user out and send them to `/login` with a success note. On an expired/invalid link, send them to `/login` with an error note.

**Why:** The design covers "forgot password" (49) and "check your email" (50) but stops before the actual password change — that step has to exist for the flow to work at all, and `src/lib/session.ts` already has an unused `sessionFromUrl()` helper built for exactly this (parses `bestim://…#access_token=…&type=recovery` and restores the session).

**Spec for dev:**
- New file `src/app/(auth)/reset-password.tsx`. Mirror screen 49's layout exactly: `Header`, icon circle (`bg-mint`, `LockKeyhole`), `Text variant="title"`, muted subtitle, then fields and a primary `Button` (reuse register.tsx's password/confirmPassword `refine` schema).
- Wire the deep link: in `src/app/_layout.tsx`, listen for incoming URLs (`Linking.addEventListener` / initial URL), call `sessionFromUrl(url)`. If it resolves `'recovery'`, `router.push('/reset-password')`.
- On submit: `supabase.auth.updateUser({ password })` → `supabase.auth.signOut()` → `router.replace({ pathname: '/login', params: { resetSuccess: '1' } })`.
- On `sessionFromUrl` throwing (expired/invalid link): `router.replace({ pathname: '/login', params: { resetError: '1' } })`.
- `login.tsx`: if `resetSuccess` param present, show `<Note tone="success" .../>` above the form; if `resetError`, show `<Note tone="warning" .../>`.

Copy:
| Element | AR | EN |
|---|---|---|
| Header title | إعادة تعيين كلمة المرور | Reset password |
| Heading | كلمة مرور جديدة | New password |
| Subtitle | اختر كلمة مرور جديدة لحسابك. | Choose a new password for your account. |
| Field 1 | كلمة المرور الجديدة | New password |
| Field 2 | تأكيد كلمة المرور | Confirm password |
| Button | حفظ كلمة المرور | Save password |
| Login success note | تم تحديث كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن. | Password updated. You can sign in now. |
| Login error note | انتهت صلاحية الرابط. يرجى طلب رابط جديد. | This link has expired. Please request a new one. |

Navigation on success: `/reset-password` → `/login` (signed out, success note).

---

### Q2: Email confirmation landing

**Decision:** No new screen. Wire the same deep-link handler (Q1) to call `sessionFromUrl(url)` for the sign-up confirmation link (`type: 'signup'`) too. Once it sets the session, the existing root gate in `src/app/_layout.tsx` already does the right thing on its own: signed-in + `onboarding_completed === false` → redirect to `/tour-voice`. On an expired/invalid confirmation link, send to `/login` with an error note (same copy/pattern as Q1's reset-error case).

**Why:** Register already ends at screen 50 ("check your email"); the root gate already redirects any signed-in, onboarding-incomplete user to `/tour-voice`. Confirming email just needs to *establish the session* — the routing logic to land them in onboarding already exists and shouldn't be duplicated in a second screen. Smallest scope that's still a complete, trustworthy experience (no dead-end, no "your email is confirmed, now what?" screen the design never specified).

**Spec for dev:**
- In the same `_layout.tsx` deep-link handler from Q1: if `sessionFromUrl(url)` resolves `'signup'`, do nothing extra — just let the existing `ready`/`profile.data` effect run; it will push `/tour-voice`.
- If it throws, `router.replace({ pathname: '/login', params: { resetError: '1' } })` (reuse Q1's error note — same copy works for "link expired," doesn't need to be reworded per link type).
- No new copy needed beyond Q1's error note.

---

### Q3: Screen 05 (first log) — 3-bucket mapping to `service_types`

**Decision:** Show exactly the 3 rows the design specifies, each mapped to one `service_types` row by `name_en`. No 4th "more/all types" option — the third bucket doubles as the catch-all, which the design's own copy and icon already signal.

| Design label (EN) | Design subtitle (EN) | Maps to `service_types.name_en` | Icon match |
|---|---|---|---|
| Engine oil | Oil or filter change | `Oil Change` | `Droplets` ✓ matches seed icon |
| Brakes | Inspection or replacement | `Brake Pad Replacement` | `Disc` ✓ matches seed icon |
| Tires & battery | Or any other maintenance | `General Repair` | `Wrench` ✓ matches seed icon |

**Why:** Confirmed by reading the actual design PNG (`screens/english light screens/Bestim/.../05/Add Vehicle/First Log.png` and the AR equivalent) — the 3 rows' icons aren't tire/battery-specific, they're literally the `Droplets` / `Disc` / `Wrench` icons already sitting on 3 of the 18 seed rows. The third row's own subtitle ("Or any other maintenance") confirms it's meant as the catch-all, so a separate "more" option would be redundant. This keeps the DB and seed untouched — it's a display filter, not a schema change.

**Spec for dev:**
- In `src/app/(onboarding)/first-log.tsx`, filter `serviceTypes.data` to only the 3 rows whose `name_en` is in `['Oil Change', 'Brake Pad Replacement', 'General Repair']`, in that order, instead of listing all 18.
- Remove the `// ponytail: ... regrouping would change the query/data shape` comment once this ships — it's now regrouped, filtering by name is a one-line change, not a shape change.
- Copy for the 3 rows must exactly match the design's `name_ar`/`name_en` + subtitle pairs above (subtitles are UI copy, not stored on `service_types` — add them as i18n strings keyed to the 3 buckets, not derived from the DB row).

---

### Q4: "Continue as guest" on sign-in (30)

**Decision:** Hide the button entirely for this release. Bring it back only when guest home (36) ships in Phase 3.

**Why:** Guest home (36) doesn't exist yet, so tapping it can't land the user "in the app" as a guest — the only options are a fake action or a real one. `src/app/(auth)/login.tsx` currently has it wired to `router.replace('/')`, which just bounces back through the root gate to `/welcome` (no session) — not a loop, but it's a dead-end tap that promises guest browsing and delivers nothing, which reads as broken. Hiding it is more trustworthy than shipping a button that does nothing useful, and it's a straight design-parity trade the founder can reverse in one PR when 36 ships.

**Spec for dev:**
- `src/app/(auth)/login.tsx`: remove (don't just disable) the `continueAsGuest` `Button` and its `ponytail` comment block.
- Leave the `auth.login.continueAsGuest` i18n string in place (both AR/EN) — it'll be reused as-is when guest mode ships.
- No navigation change needed since the button no longer exists.

---

### Q5: Odometer unit choice on screen 04 (Kilometers / Operating hours)

**Decision:** Keep the design's fixed order in both AR and EN — don't mirror it in RTL, even though other `Choice` controls do.

**Why:** The design is consistent about this across both language variants (checked both AR and EN screen-04 PNGs) — it's a deliberate choice, not a missed mirror. Unit toggles read like a fixed technical pairing (km first, then hours) rather than a direction-dependent binary choice like yes/no or male/female, so keeping it stable reduces confusion for anyone who's seen the screen in the other language (e.g. switching app language later).

**Spec for dev:**
- `src/app/(onboarding)/add-odometer.tsx` currently passes `options={['km','h'].map(...)}` straight into the shared `Choice` component, which lays out with `flex-row` — under RTL that auto-mirrors, so today this screen silently mirrors in AR, contradicting the design.
- Fix at the call site only (don't change `Choice`'s default RTL-mirroring behavior — other screens rely on it): wrap this one `Choice` instance in a container with an explicit `style={{ flexDirection: 'row' }}` (or add an opt-out `mirror={false}` prop to `Choice` if a second screen ever needs the same override).
- No copy change; order stays `['km', 'h']` (Kilometers, Operating hours) in both languages.

---

### Q6: Sign in with Apple — deferred (founder decision, 2026-09-28)

**Decision:** Ship Google-only social login for now; the founder will add Apple later.
**Why:** Founder's call. Note App Store Review Guideline 4.8 generally requires Sign in with Apple (or an equivalent privacy-focused login) when an iOS app offers Google login, so add it back before App Store submission.
**Spec for dev:** A complete implementation exists in commit `1450452` (`signInWithApple` in src/lib/auth.ts, `AppleIcon` in BrandIcons.tsx, the login/register buttons). Restore it with `npx expo install expo-apple-authentication`, gate `ios.usesAppleSignIn` + `appleTeamId` on `APPLE_TEAM_ID` in app.config.js, and enable `[auth.external.apple]` (client_id `com.bestim.app`) in supabase/config.toml.

---

### Q7: Screen 32 "Your profile" — where it belongs in the flow

**Decision:** Screen 32 is a universal post-auth gate, not a sign-up step. The root gate in `src/app/_layout.tsx` sends any signed-in user whose `profiles.full_name` is empty to `/profile-setup` first; only once a name is on file does it move on to the existing `onboarding_completed` check (→ `/tour-voice`). `register.tsx` keeps its full name field as-is.

**Why:** Email sign-up (31) already collects full name and the `handle_new_user` trigger writes it to `profiles.full_name`, so an email user who filled the field out correctly has nothing left for screen 32 to do — inserting it unconditionally after sign-up would be a redundant tap before they even reach their inbox. Google sign-in is the actual gap: `full_name` comes from Google's metadata and can be empty or a name the user doesn't want stored. Gating on the data (`full_name` empty) rather than the signup method handles both paths with one check, covers the edge case of an email user who's cleared their metadata name, and needs no change to register.tsx or the email-confirmation flow from Q2. This is the smallest change: one extra branch in the gate that's already doing this kind of redirect, reusing profile-setup.tsx exactly as built (it already writes `full_name` and routes to `/tour-voice` on submit).

**Spec for dev:**
- `src/app/_layout.tsx`, in the `ready` effect: change
  `else if (profile.data && !profile.data.onboarding_completed) router.replace('/tour-voice');`
  to check name first:
  `else if (profile.data && !profile.data.full_name) router.replace('/profile-setup');`
  `else if (profile.data && !profile.data.onboarding_completed) router.replace('/tour-voice');`
- No change to `src/app/(auth)/profile-setup.tsx` — it already updates `profiles.full_name` and does `router.replace('/tour-voice')` on success, which is exactly the next hop once the gate gets here.
- No change to `register.tsx` — keep the full name field; that's what lets most email sign-ups skip screen 32 entirely.
- Photo upload stays UI-only per the existing `ponytail` comment in profile-setup.tsx (no image picker dependency yet) — unchanged by this decision.

---

### Q8: App flow order (founder decision, 2026-09-28)

**Decision:** Splash → Language (01) → Tour (33→34→35) → Welcome (02) → Sign in (30) / Create account (31) → Your profile (32, only if full_name is empty) → Add vehicle (03→04→05) → Home.
**Why:** Founder's call. Show what the app does before asking for an account; add the car after sign-up.
**Spec for dev:** The tour is pre-auth and runs once per device (`settingsStore.tourSeen`, set by `endTour()` in src/components/TourSlide.tsx). `profiles.onboarding_completed` now means "first vehicle added" and is set by first-log. The gate in src/app/_layout.tsx: no language → /language; signed out → /tour-voice until the tour is seen, then /welcome; no name → /profile-setup; onboarding not completed → /add-vehicle.

---

## 2026-09-29 (Phase 3)

### Q9: "Needs review" threshold for an odometer reading (screen 20)

**Decision:** A new log is `needs_review` when its reading is below the vehicle's current odometer, or the jump from the previous reading exceeds **1,000 km/day** (`h` unit: **24 h/day**; `mi` treated like km). Days = calendar days since the previous reading, minimum 1. A reading equal to the current one is fine. A flagged *jump* does not raise `vehicles.current_odometer` until the user taps "Reading is correct" on 20; a flagged *low* reading never lowers it (existing `greatest`).

**Why:** Screen 20's own example (115,400 to 125,000 in 4 days = 9,600 km, 2,400/day) must trip it, and 1,000/day is already far beyond real driving (a 12 h drive is about 1,000 km). Without holding back a typo like 1,250,000, every part would flip to overdue and reminders would be wrong until someone noticed. 24 h/day is the physical ceiling for a running machine.

**Spec for dev:**
- Trigger (Phase 3 migration): compare against `vehicles.current_odometer` before the bump; previous-reading date = the vehicle's `odometer_updated_at` (see Q19). Skip the bump when flagged as a jump.
- Screen 20 "Reading is correct" = `update vehicles set current_odometer = <reading>`; status stays `needs_review` (the design note says confirming doesn't remove the flag). "Correct the reading" = correction form (Q19).
- Unit-aware constant in one place (`src/lib/parts.ts`): `MAX_PER_DAY = { km: 1000, mi: 1000, h: 24 }`.

---

### Q10: "Soon" vs overdue for part status (screen 06 / 09 / 11)

**Decision:** Per part, remaining = interval minus what has passed since the last log, in km (or h) and in days. **Overdue:** either remaining is <= 0. **Soon:** either remaining is <= **1,000 km** (`h`: **50 h**) or <= **30 days**. Otherwise `ok`. Parts with no interval at all (both null) and service types never logged don't appear in any parts list.

**Why:** The design's amber example (450 km or 12 days left) and red example (overdue by 800 km) are both consistent with this. 1,000 km is about 2 weeks of average driving and 30 days is a month, so the warning comes early enough to book a workshop. Never-logged parts have no baseline, so guessing would show fake urgency; screen 36 also only shows parts derived from an actual log.

**Spec for dev:**
- Sort: overdue first (largest overrun first), then soon (smallest remaining fraction first). Home "Today's priority" shows the top 3 of overdue+soon; when none, show the calm empty state from screen 07.
- Subtitle picks the dimension that is worse (or km when equal). Show both when soon and both known, like the design.

| State | AR | EN |
|---|---|---|
| Soon (both) | باقي {km} كم أو {d} يوماً | {km} km or {d} days left |
| Soon (km only) | باقي {km} كم | {km} km left |
| Soon (days only) | باقي {d} يوماً | {d} days left |
| Overdue (km) | متأخرة بـ {km} كم | Overdue by {km} km |
| Overdue (days) | متأخرة بـ {d} يوماً | Overdue by {d} days |
| Hours | replace كم / km with ساعة / h | |
| Title (soon) | موعد {part} يقترب | {part} is coming up |
| Title (overdue) | {part} تحتاج متابعة | {part} needs attention |

---

### Q11: History filter chips (screen 10)

**Decision:** Keep the design's 4 static chips: All / Oils / Brakes / Tires. Others show only under All.

| Chip (AR / EN) | `service_types.name_en` included |
|---|---|
| الكل / All | everything |
| زيوت / Oils | Oil Change, Oil Filter |
| فرامل / Brakes | Brake Inspection, Brake Pad Replacement |
| إطارات / Tires | Tire Rotation, Tire Replacement |

**Why:** Tires do exist in the seed (2 rows), so no schema change; these are the three groups that own the most-searched maintenance in the seed. Ad-hoc chips per category would add noise the design didn't ask for.

**Spec for dev:** Map by `name_en` in `history.tsx` (same technique as Q3). A chip with no rows shows a muted line: "لا سجلات في هذه الفئة" / "No records in this category" (no CTA; the bottom "Add record" button remains). Screen 39 stays for the truly empty vehicle only.

---

### Q12: Workshop-verified banner (18) and screen 10 row labels

**Decision:** No workshop feature, so replace "verified by a service center" with a banner based on `source` and `status`. Priority: `needs_review` > `corrected` > `source`. Same slot/shape as the design's green banner.

| State | Banner tone | AR title / body | EN title / body |
|---|---|---|---|
| manual | green | سجّلته بنفسك / أضفت هذا السجل يدوياً. | Logged by you / You added this record manually. |
| voice | green | سُجّل بالصوت / أنشأناه من كلامك وراجعته أنت. | Logged by voice / Created from what you said, reviewed by you. |
| corrected | blue | تم تصحيح هذا السجل / التصحيحات تظهر بجانب الأصل. | This record was corrected / Corrections appear next to the original. |
| needs_review | amber | قراءة تحتاج مراجعة / اضغط لمراجعة القراءة. | Reading needs review / Tap to review the reading. |

Tapping the amber banner opens 20. The blue "Original stays saved" box below stays as designed, always.

Screen 10 row: subtitle = `{reading} km · {cost} EGP` plus a suffix, in order: receipt attached if `photos` is non-empty, otherwise logged by you (manual) / logged by voice. The teal caption above a row (design: "verified by workshop") is used only for status: `needs_review` shows amber "تحتاج مراجعة" / "Needs review", `corrected` shows "تم التصحيح" / "Corrected"; verified rows show no caption.

| Suffix | AR | EN |
|---|---|---|
| Receipt | فاتورة مرفقة | Receipt attached |
| Manual | سجّلته بنفسك | Logged by you |
| Voice | سُجّل بالصوت | Logged by voice |

**Why:** Claiming "verified by a workshop" with no workshop data would be false; the honest, useful axis we actually have is how the record was created and whether it was flagged or corrected. Reuses the design's layouts, no new components.

---

### Q13: Home "View all" and bell before Phase 4

**Decision:** "View all" opens the current vehicle's detail (09) on the **Reminders** segment (the computed parts list, Q15). The bell opens the Reminders tab (placeholder until Phase 4), no badge. For guests both open the feature gate (Q17).

**Why:** "Today's priority" is a subset of exactly that list, so "all" of it lives on 09; the bell's natural target is the Reminders tab, and a placeholder there is honest and needs no work now.

**Spec for dev:** `router.push({ pathname: '/vehicles/[id]', params: { id: currentVehicleId, tab: 'reminders' } })`; bell `router.push('/reminders')`. Vehicle detail reads the optional `tab` param for its initial segment.

---

### Q14: Expense cards (Home "this month", 09 "year") before the expenses table exists

**Decision:** Home card = sum of `maintenance_logs.cost` for the **current vehicle in the current calendar month**; the 6 bars = last 6 calendar months oldest to newest, current month in lime and the rest light gray, height scaled to the max of the 6 (min height for zero months). Vehicle detail's "year" card = same sum for the current calendar year. Amount shows in the log currency (EGP shown as ج.م / EGP); no target on tap. Phase 4 swaps the source to `expenses`.

**Why:** Log cost is the only expense data that exists; it is also what the user just entered, so the number is explainable. Calendar month is easier to read than rolling 30 days and matches the label "this month".

**Spec for dev:** One query of `service_date, cost` for the vehicle for the last 6 months, reduce client-side. Zero total shows "0" (never hide the card). Labels: AR "مصاريف هذا الشهر" / "مصاريف السنة"; EN "This month's expenses" / "Year expenses".

---

### Q15: Vehicle detail (09) segments before Phase 4

**Decision:** Segments Overview / Log / Reminders. **Reminders** = the computed parts list for the vehicle (all parts with a state, sorted per Q10, each row tapping into part detail 11), with an empty line if none: "أضف سجلاً لتظهر مواعيد القطع" / "Add a record to see part schedules". **Log** = the same rows as history 10 (no chips, latest 10) plus the link "All records" (Q16). **Overview** = "Parts needing attention" (only overdue+soon).

**Why:** Keeps the third segment truthful and useful without inventing reminders records; Phase 4 replaces it with real reminders.

---

### Q16: Vehicle detail links

**Decision:** "Tire history" opens `history.tsx?vehicleId` with the **Tires** chip preselected (`?category=tires`). "All records" opens `history.tsx?vehicleId` with All.

**Why:** Part history (12) is per single service type, but tires span rotation and replacement; the chip view covers both with no new screen.

---

### Q17: Guest mode (anonymous account) gating

**Decision:** A guest can: complete add-vehicle onboarding (03-05), see home 36, and use the Home tab. Everything else opens the feature gate (37): the vehicles, capture (+), reminders and account tabs; the car row and reminder rows on 36; the bell. The gate's "Create account" goes to register (links the anonymous user, keeping data); "Keep browsing" dismisses back to home.

**Why:** 36's design shows a single car row and two reminder rows that each have a chevron but the guest's value is *seeing* the app; 37 is designed as the "save your data first" moment. Blocking capture is deliberate: guests are likelier to lose the device/session and their data, so writes after the first log are gated until there is an account, and it makes account creation the natural next step.

**Spec for dev:** Gate title reflects the tapped feature; the vehicle card appears only when triggered from the car row. Params: `feature-gate?feature=car|vehicles|capture|reminders|account&vehicleId`.

| Feature | AR title | EN title |
|---|---|---|
| car | {vehicle name} | {vehicle name} |
| vehicles | سياراتي | My vehicles |
| capture | إضافة سجل | Add a record |
| reminders | المواعيد | Reminders |
| account | حسابي | Account |

Body (all): AR "كل التفاصيل، في حسابك" + "أنشئ حساباً للاحتفاظ بتاريخ الصيانة ومتابعة القطع والمصاريف." / EN "All the details, in your account" + "Create an account to keep your maintenance history and track parts and expenses." Buttons: "أنشئ حسابي" / "Create my account", "أكمل التصفّح" / "Keep browsing". Guest home copy per 36 PNG (welcome note + "Create account" button, "Your car ahead", "Upcoming").

---

### Q18: Voice clarification (17) and speech fallback

**Decision:** Ask at most **one** clarification per log, only when the transcript has a number that isn't the odometer or cost and could be either a change interval or a product name (the design example: "موبيل 10 آلاف"). Mock rule: a second number between 1,000 and 50,000 (incl. "ألف/آلاف/k"), not followed by a currency word, and adjacent to a brand keyword (موبيل, mobil, كاسترول, castrol, شل, shell, توتال, total, ليكوي, liqui). Options: "Interval: {n} km" sets `interval_km`; "This is a product name" puts it in `description`; "Continue without interval" saves with the type default. If speech permission is denied or the recognizer is unavailable, `replace` to manual entry (16) with a note; a `no-speech` timeout stays on 14 with a "didn't catch that" line and an "Enter manually" link.

**Why:** The design's copy asks precisely about interval vs. product; asking about every number would make voice slower than typing. Falling back to manual keeps the user moving and never dead-ends.

| Element | AR | EN |
|---|---|---|
| Permission-denied note | لم نتمكن من استخدام الميكروفون. أدخل السجل يدوياً. | We couldn't use the microphone. Enter the record manually. |
| No speech | لم نسمعك جيداً، حاول مرة أخرى. | We didn't catch that. Try again. |
| Link | أدخل يدوياً | Enter manually |

Other clarify strings per the 17 PNG.

---

### Q19: Gaps the designs don't cover

**Decision / Spec for dev:**
1. **Correction form**: reuse manual entry (16) with `?logId`, prefilled; editable fields = title, service type, reading, cost, date, location/notes; `source`, photos and voice transcript are not editable. A required **Reason** field (min 3 chars) sits above the button, "Save correction" / "احفظ التصحيح". Only changed fields go into `correct_log`.
2. **Update odometer (25)**: one field. Uses `vehicles.odometer_unit` for the label (كيلومتر / km, ساعة / hour). Reading >= current: update `vehicles.current_odometer` directly (no log). Reading lower: the blue note becomes a required **Reason** field; on save also insert one log titled "تحديث العداد" / "Odometer update" (no service type, reason in description, `status='needs_review'`). A jump over the Q9 limit uses the Q9 rules.
3. **Add `vehicles.odometer_updated_at timestamptz not null default now()`** to the Phase 3 migration, set whenever `current_odometer` changes (trigger). Screen 06's "last reading, 3 days ago" and Q9's day count read it; `updated_at` moves on any edit, so it can't be used.
4. **Currency**: fixed EGP for now (column already defaults to it); no picker.
5. **Save success** from 15 goes to the vehicle's history (10) with a toast "تم حفظ السجل" / "Record saved"; from 25 back to Home.
6. **Single vehicle**: Home's vehicle switcher is a chevron that shows only when the user has 2+ vehicles.
7. **Log delete**: none (append-only history; corrections only).

---

### Q20: Needs-review rule, as built (refines Q9)

**Decision:** "Previous reading" = the latest reading on or before the log's date: an earlier log, or the vehicle odometer (screen 25 updates it without a log) if that was set later. A new log is flagged if it's below the highest earlier reading, or climbs faster than 1,000 km|mi/day (24 h/day) since that previous reading. A backdated log (e.g. last year's oil change) is only compared with what came before it, so it isn't flagged just for being below today's odometer.

**Why:** Q9's "below the current odometer" would flag every honest backdated entry, which is exactly what people do when they first add their history.

**Spec for dev:** Lives in the DB trigger `public.log_odometer` (migration `20260929084605_odometer_updated_at.sql`). Correcting a flagged/inflated reading via `correct_log` pulls the vehicle odometer back down when that log had set it.

---

## 2026-09-29 (Phase 4)

### Q21: Reminders tab (21/38) scope

**Decision:** Current vehicle only, the same current vehicle as Home. The header shows the vehicle name as a muted line under the "Reminders" title; with 2+ vehicles it has the same chevron switcher as Home (Q19.6), with 1 vehicle plain text.

**Why:** Parts, odometer and intervals are all per vehicle; a merged list would need a vehicle label on every row and the design has none. Reusing Home's state means the bell, "View all" and the tab always agree.

**Spec for dev:** Use the shared current-vehicle state/switcher from Home. No vehicles, or a vehicle with no computed parts (Q10): show 38 (CTA "سجّل أول صيانة" / "Log your first service" opens `/capture`).

---

### Q22: Segments "needs attention" vs "all dates"

**Decision:**
- **Needs attention** (default): parts with state overdue or soon that are not snoozed, sorted per Q10, preceded by the stale-odometer row (Q23) when it applies. If nothing qualifies, show the calm state "خطوتك القادمة واضحة" / "Your next step is clear" with the line "لا شيء يحتاج متابعة الآن" / "Nothing needs attention right now".
- **All dates**: every part that has a status (Q10), including ok and snoozed, sorted by next due date (earliest first, then by urgency; overdue first). Snoozed rows keep their state color and show the "Snoozed until" subtitle instead of the remaining text. No stale-odometer row here.

**Why:** "Needs attention" is the to-do; "all dates" is the full schedule the user can trust. Showing snoozed items only in the second list makes snooze feel reversible and never loses them.

| Element | AR | EN |
|---|---|---|
| Segments | يحتاج متابعة / كل المواعيد | Needs attention / All dates |
| Snoozed subtitle | مؤجّل حتى {date} | Snoozed until {date} |
| Calm title (design) | خطوتك القادمة واضحة | Your next step is clear |
| Calm body | لا شيء يحتاج متابعة الآن. | Nothing needs attention right now. |

---

### Q23: Stale-odometer row (21)

**Decision:** Show when `now - vehicles.odometer_updated_at >= 30 days` and the vehicle has at least one part with a status (otherwise there is nothing the reading would affect). It is the first row of "Needs attention". Tap opens `/update-odometer?vehicleId`. The design's "Tires:" prefix is generalised to the vehicle name.

**Why:** Every remaining-km figure is only as good as the last reading; 30 days is roughly one month of driving, and the design's 47 days example is over it. It is a nudge, not an alarm, so it uses the amber tone and never counts in Home's priority list.

| Element | AR | EN |
|---|---|---|
| Title | {vehicle}: حدّث العداد | {vehicle}: update the odometer |
| Subtitle | آخر قراءة منذ {n} يوماً | Last reading {n} days ago |

**Spec for dev:** Days = `differenceInCalendarDays(today, odometer_updated_at)`. Constant `STALE_ODOMETER_DAYS = 30` in `src/lib/parts.ts`. Saving on 25 resets it (Q19.3 trigger).

---

### Q24: Reminder detail (22) actions and copy

**Decision:**
- **"أنجزت الصيانة" / "I did the service"**: opens manual entry (16) with the service type prefilled (title = the type name, date = today, reading = current odometer). Saving creates a normal log, which resets the part. Nothing is written to `reminders` by this button itself. Cancelling leaves everything as is.
- **"أجّل التذكير أسبوعاً" / "Snooze a week"**: writes a `reminders` row (`status='dismissed'`, `due_date = today + 7`), goes back, and the part leaves "needs attention" until that date; it reappears if still soon/overdue. Snoozing again replaces the active snooze (max one per part). Overdue parts can be snoozed too. Toast: "تم التأجيل حتى {date}" / "Snoozed until {date}".
- If the part is `ok`, the action bar keeps only "I did the service" (snooze has nothing to hide).
- Metric card, rows and titles reuse Q10 wording; the row labels are those in the 22 PNG (last service, odometer then, interval, next date).

**Why:** The reminder is computed from logs, so the only honest way to "complete" it is to record the service. Snooze is a hide flag, not a new due date; the computed date stays true.

| Element | AR | EN |
|---|---|---|
| How it's calculated (title) | كيف حُسب الموعد؟ | How is the date calculated? |
| Body (km + months) | حسب القراءة الأخيرة {odo} {unit}، والجدول العام لهذه القطعة: كل {km} {unit} أو {m} شهراً، أيّهما أقرب. | Based on your latest reading of {odo} {unit} and the standard schedule for this part: every {km} {unit} or {m} months, whichever comes first. |
| Body (km only) | حسب القراءة الأخيرة {odo} {unit}، وفترة التغيير: كل {km} {unit}. | Based on your latest reading of {odo} {unit} and the interval: every {km} {unit}. |
| Body (months only) | حسب تاريخ آخر صيانة، وفترة التغيير: كل {m} شهراً. | Based on the last service date and the interval: every {m} months. |
| Buttons | أنجزت الصيانة / أجّل التذكير أسبوعاً | I did the service / Snooze a week |

`{unit}` = كم/km, ساعة/h per the vehicle's `odometer_unit`. "Standard schedule" is used when the interval comes from the service type default, "your schedule" (جدولك / your schedule) when the log set its own `interval_km`/`interval_months`.

---

### Q25: Row subtitle for ok parts (All dates)

**Decision:** Design's "within the recorded schedule" for ok parts, plus the next due date when known.

| State | AR | EN |
|---|---|---|
| ok | ضمن الجدول المسجّل · {date} | Within the recorded schedule · {date} |
| ok, no date (km only) | ضمن الجدول المسجّل · عند {odo} {unit} | Within the recorded schedule · at {odo} {unit} |
| soon/overdue | per Q10 | per Q10 |

**Why:** Confirms "nothing to do" while still telling the user when it will matter. Date preferred (it is what the row sorts by).

---

### Q26: Expense categories (24 chips) and the 23 breakdown

**Decision:** Add `'parts'` to the enum (DB migration). Chips on 24, in this order: Maintenance, Fuel, Spare parts, Insurance, Registration, Other. (The design shows 4; insurance and other must be reachable or the enum is dead, and registration and insurance are different money, so they get separate chips. `Choice` wraps to a second row.) `parking` is dropped from the UI but stays in the enum for old data. Default chip: Maintenance.

Breakdown rows on 23 (only rows with a non-zero total are shown, in this order):

| Row | AR | EN | Enum values |
|---|---|---|---|
| 1 | صيانة | Maintenance | maintenance |
| 2 | وقود | Fuel | fuel |
| 3 | تأمين وترخيص | Insurance & registration | insurance, registration |
| 4 | قطع غيار | Spare parts | parts |
| 5 | أخرى | Other | parking, other |

Chip labels: صيانة / Maintenance, وقود / Fuel, قطع غيار / Spare parts, تأمين / Insurance, ترخيص / Registration, أخرى / Other. Sorted-by-amount is not applied; fixed order keeps the list stable.

**Why:** Matches the design's four rows exactly while mapping every enum value; hiding zero rows avoids a wall of "0 ج.م". No Other row is shown unless used, so the design's look holds for typical data.

---

### Q27: Expenses (23) scope, year and bars

**Decision:** All the user's vehicles, current calendar year only, no year picker. Title "إجمالي مصاريف {year}" / "Total expenses {year}", subtitle "جنيه مصري · على {n} مركبات" / "EGP · on {n} vehicles" where n = the user's vehicle count (singular forms: "على مركبة واحدة" / "on 1 vehicle"). Bars = the last 6 calendar months ending with the current one, oldest first (design: 04..09 in September), labeled by two-digit month number, height scaled to the max (min height for zero months), current month in teal, others light gray. Bars may include months of last year in Jan to May; they are the recent trend, not the year total, and the labels make that clear.

**Why:** A year picker needs history that most users won't have yet; YAGNI until asked. Rolling 6 months matches Home's bars (Q14) and the design.

**Spec for dev:** One `expenses` query for `expense_date >= min(start of year, first day 5 months ago)` for the user's vehicles, reduce client-side. Empty (no expenses in the window, none this year): show 40 (CTA "أضف أول مصروف" / "Add your first expense" opens `/add-expense`). The "+" header button always opens 24.

---

### Q28: Expenses auto-created from logs, and 24's "linked log"

**Decision:** The optional field is a **reference** meaning "an extra cost for that log" (for example parts bought separately). The picker lists the current vehicle's latest 20 logs (title + date), whether or not they have a cost; it also has a "No link" option. Saving stores `expenses.log_id`. The log's own cost is already represented by its auto-created expense, so nothing is double counted: the linked expense is a *separate* amount by definition, and 23 sums both. Suggested default category when a log is linked: keep the user's choice, no auto change.

To keep automatic and manual rows apart, the migration adds `expenses.from_log boolean not null default false`. The insert trigger sets it `true`; the cost-update logic in `correct_log` (and any backfill) only touches rows with `from_log = true` for that `log_id`. Manual rows with `log_id` are never rewritten.

**Why:** Without this flag, a correction to a log's cost would overwrite the user's extra expense. Linking is context, not a second copy of the cost.

| Element | AR | EN |
|---|---|---|
| Field | مرتبط بسجل صيانة (اختياري) | Linked to a maintenance log (optional) |
| Picker title | اختر سجلاً | Choose a record |
| No link | بدون ربط | No link |
| Hint under field | يُضاف كتكلفة إضافية لهذا السجل. | Added as an extra cost for this record. |

---

### Q29: Which vehicle a new expense belongs to

**Decision:** The current vehicle (the same state as Home). It shows as a muted line under the header title on 24, the vehicle name (no picker). To use another vehicle, switch it on Home first. An optional `?vehicleId` param overrides the current one (used by nothing yet).

**Why:** Adds no field the design doesn't have, and expenses are almost always for the car the user is looking at. The visible name prevents the wrong-car surprise.

---

### Q30: Currency footnote on 23

**Decision:** Hide "لكل عملة إجمالي مستقل." / "Each currency has its own total." while every row is EGP (Q19.4). Show it again only if a currency picker ever exists. The "جنيه مصري · على N مركبات" line stays.

**Why:** A note about a situation that can't happen is noise.

---

### Q31: Guest gating for Phase 4 screens

**Decision:** Everything is gated. The reminders tab already opens the feature gate (Q17). Screens 22, 23, 24 and their entry points also gate: if `isAnonymous`, `replace` to `/feature-gate?feature=expenses` (reminder detail uses `reminders`). Add `expenses` to the gate features.

| Feature | AR title | EN title |
|---|---|---|
| expenses | المصاريف | Expenses |

Body and buttons as Q17.

**Why:** Guests reach nothing in Phase 4 through the UI, but deep links and notifications can; a guard costs one line per screen.

---

### Q32: How the user reaches Expenses (23) before Phase 5

**Decision:** Three entry points, all to `/account/expenses`: (1) an "Expenses" row on the Account tab placeholder (icon wallet, chevron; the rest of the placeholder is Phase 5), (2) the Home "this month" card, (3) the 09 vehicle detail "year" card. Both cards get a chevron/pressed state. Q14's card sources switch to `expenses` (all categories, still scoped to the current vehicle), while 23 is all vehicles; the card label stays per vehicle, so the totals differing is expected.

| Element | AR | EN |
|---|---|---|
| Account row | المصاريف | Expenses |

**Why:** The design nests 23 under Account, which doesn't exist until Phase 5; a single placeholder row plus the two natural tap targets keeps it reachable and needs no navigation rework later.

