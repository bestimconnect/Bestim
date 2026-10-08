# Product decisions log

Decisions for Bestim made on the founder's behalf while they're away. Scope: Phases 1+2 (auth + onboarding) are closed; Phase 3 (home, guest home screen 36, vehicles, logs, voice) and Phase 4 (reminders tab 21/22/38, expenses 23/24/40) are in scope, per `docs/BESTIM-TECH-PLAN.md` and the phase plans. Phase 5 (account, notifications, export/share, success/offline/error screens, QA; Q33+) is now in scope. Phase 6 (needs the Apple Developer account: Sign in with Apple, server push, TestFlight, store submission, universal links) is not.

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



## 2026-10-01 (Phase 5)

Founder rules in force: theme (light/dark) is the user's choice in Account settings (default light); notifications are on-device (local scheduled) in this phase. Designs checked: AR light PNGs of 26, 27, 28, 41-48 (and the EN metadata strings).

### Q33: Account (26): theme switch, sign out, delete account, privacy

**Decision:** Keep 26 exactly as designed (name header, Language + Currency cards, rows Expenses / Notifications / Export / Share, footer). Add after "Share Vehicle History":
1. **Dark mode** row: same row style, icon `Moon`, **trailing `Toggle`** instead of a chevron; flipping it applies instantly (`settingsStore.theme` light/dark). No sheet, no "system" option (founder rule).
2. **Sign out** row: icon `LogOut`, no chevron, no subtitle. Tap opens a native `Alert` (below). On confirm: cancel all scheduled notifications, `supabase.auth.signOut()`, reset `currentVehicleId`, clear the query cache + persisted cache, then the root gate sends the user to `/welcome`.
3. **Delete account**: a second small **danger text link** under the footer line (same style as "Delete vehicle data"; the design's footer keeps its two items, this one sits on its own line below, start-aligned). Opens `/delete-account` (Q34).
4. **Privacy** (footer): opens `process.env.EXPO_PUBLIC_PRIVACY_URL` with `expo-web-browser`. If that variable is unset, render only "Bestim 1.0" (no dead link). The founder must supply the URL before store submission (Phase 6).
5. Name header: avatar + `profiles.full_name` + the subtitle from the design; not tappable (no profile editing this phase).
6. Rows' subtitles come from the PNG: Expenses "Review your total expenses", Notifications "Choose what suits you", Export "PDF, CSV or JSON", Share "Move the history to the new owner".

**Why:** The two rows with a toggle/no chevron read clearly as "settings" vs "navigation", and a toggle is the least code for a two-state choice. Sign-out is frequent and harmless so it's a row; account deletion is rare and destructive so it is a quiet link, matching how the designer treated "delete vehicle data".

| Element | AR | EN |
|---|---|---|
| Dark mode title / subtitle | الوضع الداكن / مريح للعين في الليل | Dark mode / Easier on the eyes at night |
| Sign out | تسجيل الخروج | Sign out |
| Sign-out alert title / body | تسجيل الخروج؟ / ستحتاج إلى تسجيل الدخول مرة أخرى. | Sign out? / You'll need to sign in again. |
| Alert buttons | إلغاء / تسجيل الخروج | Cancel / Sign out |
| Delete account link | حذف حسابي | Delete my account |

---

### Q34: Delete account flow

**Decision:** New root route `delete-account.tsx` that **reuses the 46 layout** (header "Delete account", red trash circle, title, body, a secondary "Export first" button, the lime "Keep my account" and the red "Delete permanently"). "Export first" opens `/account/export` (Q42). "Keep my account" goes back. "Delete permanently": best-effort remove the user's receipt photos from storage (list the `{userId}/` folder), call `delete_my_account()`, then sign out locally (clear stores and caches, cancel notifications). The gate lands on `/welcome` and a toast "Your account was deleted" shows there. On failure: stay on the screen with an inline error and a retry (the button).

**Why:** Account deletion is an App Store requirement and must be reachable in-app; the second red button on 46 is already the "are you sure" step, so no typed confirmation.

| Element | AR | EN |
|---|---|---|
| Header | حذف الحساب | Delete account |
| Title | حذف حسابك نهائياً؟ | Delete your account permanently? |
| Body | ستُحذف حسابك وكل سياراتك وسجلاتها ومواعيدها ومصاريفها. لن تتمكن من استرجاعها بعد الحذف. | Your account and all your vehicles, records, reminders and expenses will be deleted. You won't be able to get them back. |
| Buttons | صدّر السجل أولاً / احتفظ بحسابي / حذف نهائي | Export first / Keep my account / Delete permanently |
| Toast on welcome | تم حذف حسابك | Your account was deleted |
| Error | تعذّر حذف الحساب. حاول مرة أخرى. | We couldn't delete your account. Try again. |

---

### Q35: Language and currency cards on 26

**Decision:**
- **Language** card is tappable and switches AR↔EN (two languages, no list). It opens a native `Alert` (below). On confirm: save to `settingsStore.language` and (best effort) `profiles.language`, set `I18nManager.forceRTL(lang === 'ar')`, then reload the app (`expo-updates` `reloadAsync()`; `DevSettings.reload()` in dev). The reload lands on the Account tab. The card shows the current language name as in the design ("العربية" / "Arabic"); when tapped there is no chevron.
- **Currency** card: **read-only EGP** ("جنيه مصري" / "EGP"), not tappable, no chevron. (Q19.4 stands; the `profiles.currency` column is untouched.)

**Why:** The reload is unavoidable for the RTL flip, so tell the user in the dialog and make it cheap to cancel. Currency has one value in every list and in the DB, so editing would be a control with nothing to choose.

| Element | AR | EN |
|---|---|---|
| Alert title | التبديل إلى الإنجليزية؟ | Switch to Arabic? |
| Alert body | سيُعاد تشغيل التطبيق لتطبيق اللغة. | Bestim will restart to apply the language. |
| Alert buttons | إلغاء / تبديل | Cancel / Switch |

(The title names the target language: in AR UI "التبديل إلى الإنجليزية؟", in EN UI "Switch to Arabic?".)

---

### Q36: "Delete vehicle data" (26 footer) and 46

**Decision:** Targets the **current vehicle** (Home's state); no picker. 46 shows the vehicle name as a muted line under its title (same pattern as Q29) so the target is never ambiguous; with 2+ vehicles the user switches vehicle on Home first. Hide the link if the user has no vehicles. Route `delete-vehicle.tsx?vehicleId`. Buttons: "Export first" opens `/account/export` (Q42); "Keep vehicle" goes back; "Delete permanently": remove the vehicle's receipt photos from storage, delete the `vehicles` row (cascades logs, reminders, expenses, shares), invalidate all queries. Then: set `currentVehicleId` to the user's most recently created remaining vehicle and `replace('/')` with a toast "Vehicle deleted". **If it was the only vehicle**: `currentVehicleId = null`, `replace('/')`; Home's existing no-vehicle empty state (the `home.empty.*` block, "add vehicle") shows. `profiles.onboarding_completed` stays true (do not replay onboarding). Also cancel/resync notifications.

**Why:** A user with 0 vehicles is a valid state Home already handles; replaying onboarding would feel like a reset, and keeps the gate simple.

| Element | AR | EN |
|---|---|---|
| Title (design) | حذف السيارة من حسابك؟ | Delete vehicle from your account? |
| Muted line | {vehicle name} | {vehicle name} |
| Toast | تم حذف السيارة | Vehicle deleted |

---

### Q37: Notification toggles to on-device behaviour (28)

**Decision:** `syncReminders` (`src/lib/notifications.ts`) cancels everything and reschedules for the **current vehicle** only (ponytail: all vehicles + km-based timing need server push, Phase 6). It runs on app open/foreground, after a log save, odometer update, snooze, pref change, and vehicle switch. Nothing is scheduled for guests, when OS permission isn't granted, or after sign out. All fire times are 09:00 local unless stated, then pass through quiet hours (Q38). iOS keeps 64 pending notifications: schedule the 60 soonest.

Each notification has a deterministic id `{kind}:{partId}:{target}` (target = due date or km goal). The first computed fire time is stored in `settingsStore.notifyFire` and reused, and a time already in the past is **not** rescheduled, so each state change fires **once** and never repeats daily (the 28 footnote). New log = new target = new notification. Prune stored keys that no longer exist.

| Toggle | Fires | Notes |
|---|---|---|
| Due soon (اقتراب موعد الصيانة) | Date-based part: **3 days before** the due date at 09:00 (`DUE_SOON_DAYS = 3`, matches `reminders.notify_before_days`). If that moment has already passed while the part is "soon" (Q10) and no key exists: next 09:00. Km-based part: when, at app open, remaining is <= 1,000 km (50 h) and no key exists: **next 09:00** (an alert while the app is open is pointless). | Skips snoozed parts (Q24) until the snooze date. |
| Overdue (صيانة متأخرة) | Date-based: the day **after** the due date, 09:00. Km-based: at app open when remaining <= 0 and no key exists: next 09:00. | Once per target. |
| Odometer (تحديث العداد) | One notification at `odometer_updated_at + 14 days`, 09:00 (if already past: next 09:00), only when the vehicle has at least one part (Q23). Re-planned on every open/odometer update, so effectively "every two weeks of silence". | Id `odometer:{vehicleId}`. |
| Weekly summary (ملخّص أسبوعي) | **Friday 09:00, repeating weekly** (calendar trigger, weekday 6). Default **off**. | Static text (no counts that go stale). |

Tap behaviour: part notifications open `/reminder` for that part; odometer opens `/update-odometer`; weekly opens Home.

| Notification | AR title | AR body | EN title | EN body |
|---|---|---|---|---|
| Due soon | موعد {part} يقترب | موعدها {date}. احجز قبل فوات الوقت. (km: باقي {km} كم) | {part} is coming up | Due {date}. Book in time. (km: {km} km left) |
| Overdue | {part} تحتاج متابعة | تجاوزت موعدها. سجّل الصيانة بعد إجرائها. | {part} needs attention | It's past its date. Log the service once it's done. |
| Odometer | حدّث العداد | {vehicle}: آخر قراءة منذ {n} يوماً. | Update your odometer | {vehicle}: last reading {n} days ago. |
| Weekly | ملخّصك الأسبوعي | تعرّف على مواعيد {vehicle} القادمة. | Your weekly summary | See what's coming up for {vehicle}. |

(`{part}` and the km units follow Q10; the titles for soon/overdue are the Q10 titles.)

**Why:** The Reminders tab computes everything from logs, so scheduling from the same data keeps the app and the phone consistent; the stored-key rule is what delivers "no daily repeat".

---

### Q38: Quiet hours (28), editable in this phase

**Decision:** Editable, with **presets, not steppers**. Tapping the "Quiet hours" card expands an inline list of 4 radio options: "10 PM to 8 AM" (default), "11 PM to 10 AM", "12 AM to 12 PM", "Off". The card shows the current choice. Stored as `quiet_from`/`quiet_to` (hours, 0-24; both `null` = off) in `profiles.notification_prefs`. Rule: a planned fire time inside `[from, to)` moves to `to` of that morning (a 09:00 notification is pushed to 10:00 under "11 PM to 10 AM"); a time at exactly `to` is allowed. Weekly Friday notification applies the same shift. The "Save my preferences" button writes the JSON, shows a toast "Preferences saved" and calls `syncReminders`; no dirty tracking. If the OS permission isn't granted, show a banner on top of 28 (below) with an action that requests the permission (undetermined) or opens iOS Settings (denied).

**Why:** Four fixed choices are the least UI, can't produce an invalid range, and still make the setting real. The default window never touches the 09:00 times, which is expected.

| Element | AR | EN |
|---|---|---|
| Options | 10 مساءً إلى 8 صباحاً / 11 مساءً إلى 10 صباحاً / 12 صباحاً إلى 12 ظهراً / بدون ساعات هدوء | 10 PM to 8 AM / 11 PM to 10 AM / 12 AM to 12 PM / No quiet hours |
| Toast | تم حفظ التفضيلات | Preferences saved |
| Banner | التنبيهات متوقفة لـ Bestim على هذا الجهاز. | Notifications are off for Bestim on this device. |
| Banner action | فعّل التنبيهات | Turn on notifications |

---

### Q39: Notification permission (45)

**Decision:** Shown **once**, immediately after the **first log the user ever saves**, before the success screen 43, and only if `!settingsStore.notifyAsked`, the user isn't a guest and the OS permission is undetermined. Entry points that count: onboarding first log (05) with a service chosen, manual entry, voice review. It does not appear after "Log it later" (the 44 case) or for guests. Flow: set `notifyAsked = true` the moment 45 shows; "Turn on notifications" calls `requestPermissionsAsync()`, then continues to 43 whatever the answer; "Later" continues to 43 without asking the OS. **Later never re-prompts automatically**; the user's way back is the banner on 28 (Q38). If a guest registers later, their next log shows 45 (flag still false). After permission is granted, run `syncReminders`.

**Why:** The first log is when "a reminder for your next service" is concrete, which is the best moment to ask. One automatic ask avoids nagging, and iOS only allows the system dialog once anyway.

| Element | AR | EN |
|---|---|---|
| Strings | per 45 PNG (title "دعنا نذكّرك في وقتها", buttons "فعّل التنبيهات" / "لاحقاً") | "Let us remind you on time", "Turn on notifications" / "Later" |

---

### Q40: Log saved (43)

**Decision:** Route `success.tsx?kind=log&vehicleId&logId`; replaces the toast-to-history hop of Q19.5 for saves from 15 (and from onboarding's 05 when a log was chosen). The odometer-only save from 25 keeps going to Home with a toast. Buttons: **"To Home"** = `dismissAll` then `replace('/')`; **"Add another record"** = `replace('/capture')` (the same capture chooser the + opens). Back gesture is disabled (go to Home).
- Title uses the first name: "Great step, {name}!" (no name: "Great step!"); body "We saved the record and updated your next maintenance date."
- **"Your next date" row** (shown only if the log's service type has an interval, from the log's `interval_km`/`interval_months`, else the type defaults): subtitle "At {odometer+interval_km} {unit} or after {interval_months} months"; km only: "At {n} {unit}"; months only: "On {date}" (service date + months). Tap opens `/reminder` for that part. No interval: hide the row and use the body "We saved the record."
- Log with `status = needs_review` (Q20): body becomes "We saved the record. The reading looks unusual, so it's marked for review."
- Saved offline (Q45): hide the row; body "Saved on this device. We'll sync it when you're back online."

| Element | AR | EN |
|---|---|---|
| Title | خطوة رائعة، {name}! / خطوة رائعة! | Great step, {name}! / Great step! |
| Body | حفظنا السجل، وحدّثنا موعد الصيانة القادم. / حفظنا السجل. | We saved the record and updated your next maintenance date. / We saved the record. |
| Review body | حفظنا السجل. القراءة تبدو غير معتادة، لذا وُضع عليه علامة للمراجعة. | We saved the record. The reading looks unusual, so it's marked for review. |
| Row title | موعدك القادم | Your next date |
| Row subtitle | عند {n} كم أو بعد {m} شهراً / عند {n} كم / في {date} | At {n} km or after {m} months / At {n} km / On {date} |
| Offline body | حُفظ على جهازك. سنزامنه عند عودة الإنترنت. | Saved on this device. We'll sync it when you're back online. |
| Buttons | إلى الرئيسية / أضف سجلاً آخر | To Home / Add another record |

---

### Q41: Vehicle added (44)

**Decision:** Route `success.tsx?kind=vehicle&vehicleId`. Shown after add-vehicle (05 finish) **only when no log was saved** ("Log it later" or nothing chosen); when a log was saved the user gets 43 (after 45 if due) instead. Applies to both the first vehicle and extra vehicles (`mode=extra`). The new vehicle is already the current one. Buttons: **"Log my first service"** = `replace('/capture')`; **"To Home"** = `replace('/')` (for an extra vehicle `dismissAll` then Home tab). For a **guest** (Q17: capture is gated) hide the primary button and show only "To Home" as the primary-styled button. The "log by voice" path (05's "Log it by voice") skips 44 and goes straight to voice capture as today.

**Why:** 44's own body says "next step: log your last service", which is wrong after a log was just saved.

| Element | AR | EN |
|---|---|---|
| Title / body | per 44 PNG ("سيارتك أصبحت معنا") | Your vehicle is with us / Next step? Log your last service and we'll arrange its reminders. |
| Buttons | أسجّل أول صيانة / إلى الرئيسية | Log my first service / To Home |

---

### Q42: Export (27)

**Decision:**
- **Scope:** the current vehicle only (name as a muted line under the title when the user has 2+ vehicles; no picker). Format segments PDF (default) / CSV / JSON. With 0 logs the button is disabled with a muted note "No records to export yet."
- **Toggles** (defaults as in the PNG: costs on, receipts on, plate off, notes off; "Maintenance logs" on and locked):

| Toggle | Included when on | Excluded when off |
|---|---|---|
| Maintenance logs (always) | date, service title, odometer + unit, status needs_review as "Unverified" | n/a |
| Costs | `cost` + `currency` per log, total row (PDF), `total_cost` (JSON) | cost/currency columns and totals |
| Receipts & workshop names | `location` (workshop) and a "Receipt attached" yes/no flag (from `photos`) | both columns. Images are never exported this phase |
| Plate & VIN | vehicle `plate_number`, `vin` in the vehicle header | both |
| My notes | log `description` | the column. `voice_transcript` and correction reasons are **never** exported |

- **Excluded-items line (the 27 footnote):** `N` = the number of data points actually withheld = for each OFF toggle, the count of logs that have a value in the withheld fields (cost, location or photo, description) plus 1 each for plate and VIN when set. If N = 0 the line is omitted. Text: AR "استبعد المالك {N} عنصراً دون عرض محتواها." / EN "The owner excluded {N} items (their content isn't shown)." In PDF: footer line; in CSV: a last row `excluded_items,{N}`; in JSON: top-level `"excluded_items": N`.
- **File name:** `Bestim_{make}_{model}_{YYYY-MM-DD}.{pdf|csv|json}`, spaces to `_`, keep Unicode letters/digits, strip everything else.
- **Language:** the app language for PDF and CSV headers/labels; JSON keys are fixed English. CSV is UTF-8 **with BOM** (Excel and Arabic). Numbers in Western digits, dates ISO `YYYY-MM-DD` in CSV/JSON, localized short date in PDF.
- **PDF layout** (HTML via `expo-print`, `dir=rtl` in AR, system font): title "Bestim · Maintenance log"; vehicle block (name, year, current odometer + unit, optional plate/VIN, generated date); table, newest first: Date | Service | Odometer | [Cost] | [Workshop] | [Receipt] | [Notes]; total row if costs on; excluded-items line; footer "Generated by Bestim".
- "Prepare the file" builds the file, then opens the share sheet (`expo-sharing`). Progress state on the button; error toast on failure.

| Element | AR | EN |
|---|---|---|
| PDF title | Bestim · سجل الصيانة | Bestim · Maintenance log |
| Columns | التاريخ / الخدمة / العداد / التكلفة / الورشة / الفاتورة / ملاحظات | Date / Service / Odometer / Cost / Workshop / Receipt / Notes |
| Receipt flag | مرفق / لا | Attached / No |
| Total / Unverified | الإجمالي / غير موثّق | Total / Unverified |
| Empty note | لا توجد سجلات للتصدير بعد. | No records to export yet. |
| Footer | أُنشئ بواسطة Bestim | Generated by Bestim |

**Why:** Costs, workshops and notes are what a seller may not want to show; plate/VIN identify the car. The recipient seeing "N withheld" is what makes the file trustworthy without leaking content.

---

### Q43: Share vehicle history (41)

**Decision:**
- **Segments** "QR code" / "Share link" only choose the first view of the result; both encode the same `bestim://receive?token={share_token}`.
- **Vehicle picker:** the card defaults to the current vehicle; tapping opens a simple list modal when the user has 2+ vehicles (chevron hidden with 1). Subtitle "{n} maintenance records · {m} reminders" (m = computed parts, Q10).
- **"Prepare share"** inserts a `vehicle_shares` row (`includes_expenses = false`, 7-day expiry); if an unexpired pending share already exists for that vehicle it is reused. Disabled with a note when the vehicle has 0 logs.
- **After creating**, the form stays; the card region below the picker shows: QR segment = the QR (white card, ~220 pt) + "Valid for 7 days"; link segment = the link text (selectable) + a "Copy link" text button. The lime button becomes **"Share link"** and opens the system share sheet with the message below (works for QR users too).
- **Cancel/revoke:** not in this phase; the share lapses after 7 days (and becomes unusable once accepted).
- **Receiver without the app / custom scheme:** `bestim://` links often aren't tappable in chat apps; until universal links (Phase 6), 41 has a small text link "Received a link?" that opens `/receive` without a token (a paste field, Q44).

| Element | AR | EN |
|---|---|---|
| Segments | رمز QR / رابط مشاركة | QR code / Share link |
| Validity | صالح لمدة 7 أيام. | Valid for 7 days. |
| Buttons | جهّز المشاركة / شارك الرابط / نسخ الرابط | Prepare share / Share link / Copy link |
| Share message | شاركتُ معك تاريخ صيانة {vehicle} على Bestim: {link} | I shared the maintenance history of {vehicle} on Bestim: {link} |
| Copied toast | تم نسخ الرابط | Link copied |
| Empty note | أضف سجلاً واحداً على الأقل للمشاركة. | Add at least one record to share. |
| Paste link | وصلك رابط؟ | Received a link? |

---

### Q44: Receive vehicle history (42)

**Decision:**
- **Accept ("Accept the history")** calls `accept_share(token)`: creates a **new vehicle** in the receiver's account with copies of: make, model, year, color, nickname, vehicle type, odometer + unit, and all logs (title, description, service type, odometer, cost, currency, date, location, status, intervals). **Not copied:** plate, VIN, photo, receipt photos, voice transcripts, correction history, expenses (shares have `includes_expenses = false`). The vehicle is primary only if the receiver has none. The owner keeps theirs; the share becomes `accepted`. **No per-log "received" marker** (kept simple). After accept: set it as the current vehicle, invalidate queries, `replace('/')` with toast "Added to your vehicles".
- **Decline:** no server call; `replace('/')` (the share stays valid until expiry). If the receiver has no account state to return to, the root gate decides.
- **Signed-out receiver:** the deep link stores `settingsStore.pendingShareToken`; the gate runs sign-in/onboarding as usual and then opens `/receive?token=` instead of Home. **Guest receiver:** `feature-gate?feature=receive` (Q47); "Create my account" links the account and the pending token is kept.
- **No token** (opened from the paste link): a text field + "Continue", which extracts the `token` query value from the pasted link.
- **Invalid, expired, already used, or your own share:** replace the content with the 48-style state: icon `CloudOff`-like muted circle, title, body, and one button "To Home". Network failure (not a bad token): normal 48 with retry (Q46).
- Header, card and layout per the 42 PNG; "Shared by" shows the sharer's profile name ("A Bestim user" when empty). Buttons "Accept the history" / "Decline".

| Element | AR | EN |
|---|---|---|
| Accept / Decline | أقبل السجل / رفض | Accept the history / Decline |
| Toast | أُضيفت إلى سياراتك | Added to your vehicles |
| Invalid title / body | هذا الرابط غير صالح | This link isn't valid |
| | قد يكون انتهت صلاحيته أو استُخدم من قبل. اطلب من المرسل مشاركة جديدة. | It may have expired or been used already. Ask the sender to share again. |
| Own share | هذه مشاركتك. افتح الرابط على هاتف الشخص الآخر. | This is your own share. Open the link on the other person's phone. |
| Sharer fallback | مستخدم Bestim | A Bestim user |
| Paste field label / button | الصق رابط المشاركة / متابعة | Paste the share link / Continue |
| Guest gate title | استلام سجل سيارة | Receive vehicle history |

---

### Q45: Offline (47) and writing offline

**Decision:**
- **When:** Home shows the 47 variant when `onlineManager` says offline (netinfo) **and** cached data exists. It replaces the priority section with: the blue banner, the vehicle row with subtitle "Last data saved on this device", the dark card "Last saved reading" (cached odometer + unit + "check your connection to update schedules"), the lime button and the voice caption. Back online, Home returns to normal automatically. Offline with no cache: 48 (Q46).
- **"Write a new record"** goes to **manual entry (16)** directly, not the capture chooser. The mutation is queued (persisted); the UI shows 43's offline body (Q40). On reconnect the queue flushes, queries refetch, toast "Synced".
- **Pending state in history (10):** an optimistic row in the logs cache flagged `pending`, with a muted "Waiting to sync" tag in place of the status label; it is replaced on sync.
- **Voice offline:** the + capture chooser keeps the voice option visible but disabled with the caption "Voice recording needs a connection."; manual stays enabled.
- **Not available offline** (kept simple): receipt photos (attach control disabled with "Photos need a connection."), corrections, odometer update, expenses, export prep of uncached data, share, account actions. Their save buttons show a toast "You're offline. Try again when you're connected." Read-only screens render from the persisted cache.

| Element | AR | EN |
|---|---|---|
| Banner | أنت غير متصل الآن / يمكنك كتابة سجل جديد. سنزامنه عند عودة الإنترنت. | You're offline now / You can write a new record. We'll sync it when you're back online. |
| Vehicle row subtitle | آخر بيانات محفوظة على الجهاز | Last data saved on this device |
| Card label | آخر قراءة محفوظة | Last saved reading |
| Card footnote | {unit} · راجع الاتصال لتحديث المواعيد | {unit} · check your connection to update schedules |
| Button / caption | اكتب سجلاً جديداً / التسجيل الصوتي يحتاج إلى اتصال. | Write a new record / Voice recording needs a connection. |
| Pending tag | بانتظار المزامنة | Waiting to sync |
| Synced toast | تمت المزامنة | Synced |
| Photos note | الصور تحتاج إلى اتصال. | Photos need a connection. |
| Offline toast | أنت غير متصل. حاول مرة أخرى عند عودة الاتصال. | You're offline. Try again when you're connected. |

---

### Q46: Data load error (48)

**Decision:** `ErrorState` replaces a screen's content when its **main query fails and there is no cached data** for it: Home, vehicles list, vehicle detail (09), history (10), reminders (21), expenses (23), receive (42). A failure with cached data shows the cached data silently (no banner). Forms and write actions never use it (they use an inline error/toast). **"Try again"** refetches the failed queries (spinner on the button). **"View what's saved on this device"** is shown only when the persisted cache holds the user's vehicles: it sets an in-memory `showSaved` flag and `replace('/')`, where Home renders the 47 variant from cache (cleared on the next successful fetch or app restart); otherwise the button is hidden.

| Element | AR | EN |
|---|---|---|
| Strings | per 48 PNG ("نحاول مرة أخرى؟", "حاول مرة أخرى", "عرض المحفوظ على الجهاز") | Shall we try again? / We couldn't load your data right now. Your saved records are still there. / Try again / View what's saved on this device |

---

### Q47: Guests and the Phase 5 screens

**Decision:** Reachable by a guest: 43 and 44 (they finish onboarding, Q17), 47 and 48 (Home). Never shown to a guest: 45 (Q39). Gated (`isAnonymous` → `replace` to `feature-gate`, as Q31, one line per screen, because deep links bypass the tab gate): 26 (already via the account tab), 27, 28, 41, 46, delete-account (all `feature=account`), and 42 (`feature=receive`). Add `receive` to the gate features. No notifications are scheduled for guests.

| Feature | AR title | EN title |
|---|---|---|
| receive | استلام سجل سيارة | Receive vehicle history |

Body and buttons as Q17.

---

### Q48: Other gaps the devs will hit

**Decision / Spec for dev:**
1. **Account name header** with an empty `full_name`: show the localized "My account" / "حسابي" in its place.
2. **Theme and language are device-level** (`settingsStore`), kept across sign-out; auth and onboarding stay light (existing rule). The language alert/reload keeps the user on Account.
3. **Sign out / delete account** also reset `notifyFire`, `pendingShareToken`, `currentVehicleId`; keep `notifyAsked`, `tourSeen`, `language`, `theme`.
4. **Snoozing a part** (Q24) cancels its notifications and re-plans at the snooze date; "I did the service" gets new keys through the new log.
5. **Notification permission revoked in iOS Settings:** `syncReminders` checks the permission on each run and does nothing; 28 shows the Q38 banner.
6. **Tapping a notification for a part that no longer exists** (vehicle deleted, log corrected): open Home.
7. **Export and 46/Delete-account "Export first"** use the current vehicle; on return the user lands back on the confirmation screen (plain `push`).
8. **Toast strings** all go through the existing toast helper; none stay on screen over the success screens.
9. **Privacy URL and store listing details** are pending from the founder (Phase 6 item); the code reads `EXPO_PUBLIC_PRIVACY_URL` only.

---

### Q49: Phase 5 as built (refines Q37, Q44)

**Decision:**
- **Notifications cover all the user's vehicles**, not only the current one (Q37 said current only). The scheduler loads every vehicle's logs itself, so there's no reason to drop the second car's reminders. Fire-once memory lives in AsyncStorage (`notifySent`), not `settingsStore`.
- **A received share keeps the correction trail and each log's status** (Q44 said corrections aren't copied). Screen 19's footnote says corrections show when a vehicle's history is shared, and that is the point of a trustworthy history. Plate, VIN, voice transcripts and receipt photos are not copied. Costs and other expenses are copied only when the share has `includes_expenses` (default off; there's no toggle on 41 in this phase).

**Spec for dev:** `src/lib/reminderPlan.ts` (pure rules + check), `src/lib/notifications.ts` (scheduling), `accept_share` in `supabase/migrations/20261001100000_share_privacy.sql`.

---

### Q50: Dark theme is our own design (founder, 2026-10-01)

**Decision:** Ignore the Figma dark screens. They invert the hero, the tab bar and the dark cards to white, which the founder rejected ("looks horrible"). Our dark theme keeps dark surfaces dark in three depth steps: page `paper` #0E1411, cards `white` #171F1B, brand panels `panel` #212E27 (hero, tab bar, dark cards, dark button). Text is light (`ink` #F2F5F3, `muted` #93A39A), lime stays the accent, teal is brightened (#3ECFC0), and the tinted badges/notes use deep tints.

**Spec for dev:** `src/lib/palette.js`. New tokens `panel` / `onpanel` (same role in both themes). Use `bg-panel` + `text-onpanel` for any dark brand surface; never `bg-ink` for a surface (ink is the text color and flips). `useLightStatusBar()` restores the theme's status-bar style on blur.

---

### Q51: Bestim Connect landing page (Shady, 2026-10-02)

**Decision:**
- **Audience:** companies with many vehicles first (shipping, factories, distribution, equipment, rental, field service), plus one section for workshops.
- **Pitch:** written as a live product, not "coming soon". The dashboard is not built yet, so its pictures are drawn in code and a company that books a demo is onboarded by hand until it exists.
- **Main action:** "Book a demo": a short form saved in `connect_leads` (visitors can only add a row) and a WhatsApp button that appears once a business number is set.
- **Look:** dark hero and navbar, light body, teal and dark blocks; mix of the four Dribbble references Shady shared, in Bestim's ink / lime / teal.
- **Kept from the consumer site:** no prices or plans, no invented testimonials / customer logos / usage numbers. New: no GPS or live-tracking claims.
- **Tech:** the future dashboard lives in the same Next.js site as the landing page (`/app`), same Supabase project and auth.

**Spec for dev:** `bestim-connect/README.md`, `bestim-connect/src/dictionaries/`, `supabase/migrations/20261002090000_connect_leads.sql`.

---

### Q52: Vehicle types with pictures (Shady, 2026-10-02)

**Decision:** The add-vehicle step shows a sideways row of picture cards instead of the 4-button switch. Types: sedan, hatchback, SUV, coupe, sports, convertible, pickup, van, motorcycle (scooter picture), equipment (gear icon until artwork exists). Vehicles saved earlier as `car` keep working and show the sedan picture.

**Spec for dev:** pictures in `assets/images/vehicles/` (resized from the 6000px originals in `../Car Types/`), map in `src/lib/vehicleArt.ts`, list in `src/stores/vehicleDraft.ts`, DB rule in `supabase/migrations/20261002100000_vehicle_body_types.sql`. The row is a `FlatList`: a plain horizontal `ScrollView` opens at the far end in Arabic.

---

### Q53: Update-odometer ruler and voice (Shady, 2026-10-02)

**Decision:** Screen 25 gets a ruler under the big number (drag with momentum; 1,000 km per labelled step, reading rounded to 10 km; 100 h steps for hours), the number is still typeable (tapping it starts a fresh number), a "+X km since last update" pill, and a "say it" microphone with an ع / EN switch. Brand lime on the dark panel, not the orange of the reference. The ruler reads left to right in Arabic too, numbers grow to the right (founder, 2026-10-02; `inverted` on the list undoes the RTL mirroring). Saving rules are unchanged (a lower reading still needs a reason and is flagged).

**Spec for dev:** `src/components/OdometerRuler.tsx`, `src/app/update-odometer.tsx`, `parseReading()` in `src/lib/voice.ts` (digits only; spelled-out numbers wait for the partner's function). Voice needs a real phone build. The ruler is not used on onboarding screen 04 (it starts at 0, typing is faster).

---

### Q54: Home refresh (Shady, 2026-10-02)

**Decision:** The hero shows the vehicle's picture, large and centered, between the vehicle name and the odometer card (nothing for equipment). Priority rows are the standard white `Item` cards with a pink (overdue) or amber (soon) badge. (The lime "Log what you did" button was removed the same day: the + in the nav bar already does it, see Q57.) The expenses card gets an icon badge. Guest, empty and offline homes are unchanged.

**Spec for dev:** `src/app/(tabs)/index.tsx` (`Today`).

---

### Q55: No system pop-ups, use a bottom sheet (founder, 2026-10-02)

**Decision:** The grey iOS pop-up (`Alert.alert`) is not used anywhere. Confirmations (switch language, sign out) and short pickers (switch vehicle on Home, Reminders, Share) open our own bottom sheet, in the same frame as the capture sheet (13). One answer shows as a button (red when destructive) above Cancel; several answers show as a list. A plain error message ("couldn't snooze") is a toast.

**Spec for dev:** call `sheet(title, body, actions)` from `src/lib/sheet.ts` (same arguments as `Alert.alert`); it opens the `src/app/sheet.tsx` route. Don't add new `Alert.alert` calls.

---

### Q56: Switching between vehicles (founder, 2026-10-02)

**Decision:**
- **Home:** swipe the vehicle picture left/right to move to the next vehicle; dots under it show how many there are. The page it settles on becomes the current vehicle (same shared setting as before), with a light vibration.
- **Sheet:** tapping the vehicle name (Home, Reminders, Share) opens a switch-vehicle bottom sheet: picture, name, year and mileage per vehicle, a lime tick on the current one, a red dot on any vehicle with overdue maintenance, and a last row "Add a vehicle".
- **My vehicles:** the list and the detail screen show the vehicle picture instead of the small icon (icon stays for equipment).
- The generic confirm sheet (Q55) no longer shows lists; it is for confirmations only.

**Spec for dev:** `pickVehicle(currentId, onPick)` in `src/lib/sheet.ts` opens `src/app/switch-vehicle.tsx`. The pager lives in `Today` in `src/app/(tabs)/index.tsx`. `Item` takes `image` and `aside`. Don't put a `ScrollView` inside a fit-to-content sheet: it breaks the layout (so the sheet doesn't scroll; fine for a handful of vehicles).

---

### Q57: Motion rules, floating + button (founder, 2026-10-02)

**Decision:** The app moves, at a level between calm and playful: short movements, a light spring on entrances, a real pop only on rare happy moments.
- **Moves:** press feedback on every button and row (dips to 96%, rows 98%, the + 92%, settles back with a small overshoot); the toast slides in from the top and leaves the same way; the segmented pill, toggle knob, onboarding/tour step bars and Home car dots slide; Home's odometer card and priority list fade in fresh when the vehicle changes; rows rise in 50 ms apart when a screen first opens (Home, My vehicles, Reminders, vehicle detail, switch-vehicle sheet); success screens, tour slides and the empty Home pop/rise, with one success vibration; a ring pulses from the mic while it listens.
- **Never moves:** tab switching, numbers the user reads or edits (no count-ups), the expenses bars, anything idle or looping for decoration. Screen and sheet transitions stay the system's own.
- **Nav bar:** the + floats: a 60pt lime circle lifted above the bar, ringed in the bar's colour. The "Log what you did" button on Home is removed (same action).
- **Reduce Motion** (phone setting) is respected: changes still happen, without the movement.

**Spec for dev:** shared values in `src/lib/motion.ts` (`EASE_OUT`, `BACK_OUT`, `rise()`, `POP`, `SWAP`). Use `PressableScale` (not `Pressable`) for buttons and cards, `Rise` for entering rows (not inside virtualized lists). State changes use Reanimated CSS transitions; their curves must come from `cubicBezier()`, a CSS string throws. CSS transitions don't follow Reduce Motion by themselves: gate them with `useReducedMotion()` as `PressableScale`, `Choice` and `Toggle` do.


---

## Voice logging: free speech to a list of records (2026-10-03)

The user speaks freely; an AI returns a list of records (maintenance, expenses, odometer update) that the user reviews on one screen and saves together. Strings: `capture.batch.*`.

### Q58: Review list screen text (PM, 2026-10-03)

**Decision:** Header "راجع سجلاتك" / "Review your records". Big title "هذا ما فهمناه" / "Here's what we understood". The transcript box is labelled "ما قلته" / "What you said". A small line under the cards says "اضغط على أي سجل لتعديله." The save button shows the count only when there is more than one card: "احفظ السجل" for one, "احفظ الكل (3)" for several.
**Why:** "Save all (3)" avoids Arabic number grammar (2 / 3-10 / 11+) and tells the user exactly how much will be saved.

### Q59: Card content (PM, 2026-10-03)

**Decision:** Every card has a small kind tag (Maintenance / Expense / Odometer), a title and a one-line subtitle. Parts the AI did not find are left out, never shown as "not mentioned".
- **Maintenance:** title is the service type. Subtitle is reading · cost · date, for example "48,200 كم · 650 ج.م · اليوم".
- **Expense:** title is the category (existing `expenses.chip` words). Subtitle is amount · place · date.
- **Odometer:** title "قراءة العداد". Subtitle is the new reading with its unit.
- **Vehicle name:** shown next to the kind tag only when the user has more than one vehicle.

**Why:** The card must be readable in one glance. Showing the vehicle only when it can be ambiguous keeps it short.

### Q60: Date not mentioned (PM, 2026-10-03)

**Decision:** Stay silent. The card shows "اليوم" / "Today" in the date position, like any other date. No banner or warning.
**Why:** Today is the right guess almost every time, the date is visible on the card, and the card opens for editing in one tap.

### Q61: Expense with no amount (PM, 2026-10-03)

**Decision:** The card stays in the list with an amber line: "أضف المبلغ لنتمكن من الحفظ". Tapping opens the add-expense form. The save button is disabled while any such card exists; the same amber line is repeated above the button. The save button never skips a card silently.
**Why:** Skipping would quietly lose what the user said. Disabled plus a visible reason always has a way out.

### Q62: User removes every card (PM, 2026-10-03)

**Decision:** The same screen shows an empty state with the transcript still visible. Title "لا يوجد ما نحفظه", body "حذفت كل السجلات. سجّل مرة أخرى أو أدخل السجل بنفسك.", buttons "سجّل مرة أخرى" (back to the recorder) and "أدخل يدوياً" (manual entry).
**Why:** Two clear next steps, no dead end, no new screen.

### Q63: AI understood nothing (PM, 2026-10-03)

**Decision:** An empty list lands on the same empty state as Q62, with the body "لم نفهم أي سجل من كلامك. جرّب مرة أخرى بجملة أوضح، أو أدخله يدوياً." If there is no transcript at all (silence), the recorder's own `capture.voice.noSpeech` message applies instead.
**Why:** Showing what we heard lets the user see whether the problem was the recording or the sentence.

### Q64: AI call failed (PM, 2026-10-03)

**Decision:** The user goes straight to manual entry with the note "تعذّر فهم التسجيل الآن. أدخل السجل يدوياً." No blame, no mention of servers.
**Why:** Manual entry is the trustworthy fallback and it already exists. A retry button would loop users on a bad connection.

### Q65: Daily limit reached (PM, 2026-10-03)

**Decision:** Same route as Q64, with the note "وصلت إلى حد التسجيل الصوتي اليوم. أدخل السجل بنفسك، وسيعود التسجيل الصوتي غداً." The number (30 a day) is never shown.
**Why:** The user is told why and that it is temporary, and logging is never blocked.

**Spec for dev (as built):** the limit is only known when the recording is sent, so the note appears after the user taps done, not before recording.

### Q66: Recording reaches 90 seconds (PM, 2026-10-03)

**Decision:** Auto-stop and continue to the review list. One hint replaces the usual one from 75 seconds: "اقتربت من الحد الأقصى. سننهي التسجيل تلقائياً." No countdown.
**Why:** Nothing is lost, because the review list is where the user fixes things.

### Q67: Success after saving several records (PM, 2026-10-03)

**Decision:** Reuse the success screen (43) with `kind: 'batch'`. Title is the existing `feedback.success.logTitle`. Body: "حفظنا سجلك." for one, "حفظنا سجلاتك (3)." for several. If any saved reading was flagged as unusual, one more sentence: "إحدى القراءات بدت غير معتادة، لذا وُضعت عليها علامة للمراجعة." Same two buttons.
**Why:** The user must know about a flag even in a batch, but it is one sentence, not a list.

### Q68: Some cards saved, one failed (PM, 2026-10-03)

**Decision:** Saved cards leave the list, so nothing can be saved twice. Failed cards stay with a red line "لم يُحفظ، حاول مرة أخرى". A note at the top: "حفظنا {{saved}} من {{total}}. تعذّر حفظ الباقي وما زال في القائمة." The save button then saves only what is left.
**Why:** No lost data and no duplicates. Retry is one tap.

### Q69: Retire the clarify screen, Q18 (PM, 2026-10-03)

**Decision:** Q18's one-question screen (17, interval vs product name) is removed. The AI decides (an oil named by its distance, "زيت 10 آلاف", sets the interval) and the review list is where the user corrects it. Q18's speech-permission fallbacks still apply.
**Why:** One confirmation point beats a one-question interruption before it.

**Spec for dev:** when a card is opened from the list, the form's main button reads "تم" / "Done" and returns to the list instead of saving.

### Q70: Voice AI, limits and scope (founder, 2026-10-03)

**Decision:**
- **AI:** Google Gemini 3.8 Flash, bought directly from Google (not through OpenRouter). It hears the recording itself and is the expected best on Egyptian Arabic mixed with English. About 7 cents per user per month at 20 recordings of 30 s (about $70 per 1,000 users). OpenAI (two steps, a misheard word gets carried into the record) and OpenRouter (same prices plus a 5.5% top-up fee) were considered and dropped. Cheaper Gemini models are tried by changing the `GEMINI_MODEL` secret; keep the cheapest that passes the test on real voice notes. The partner developer's function is dropped.
- **The recording itself is sent** (the phone's live text is only a preview, and the fallback when no recording exists: simulator, Android below 13).
- **One recording can create:** maintenance records, expenses (fuel, parts, insurance, registration, other; parking counts as other), an odometer update, and the "next due" interval of a logged service. Free reminders ("remind me on 1 December") are a later feature (`docs/IDEAS.md`).
- **Always review, then save all.** Nothing is saved before the user confirms.
- **Guards:** real accounts only, 30 recordings per user per day, about 90 seconds each, recordings are not stored.
- **A spoken reading lower than the vehicle's current one is never written silently:** the odometer card is blocked with "أقل من القراءة الحالية" until the user fixes or removes it (same spirit as Q9). Lowering a reading stays on the update-odometer screen, which asks for a reason.
- A maintenance cost is never also listed as an expense (the database already turns a log's cost into an expense).

---

## Update odometer: slider and camera (2026-10-03)

### Q71: Update odometer, three ways (Shady, 2026-10-03)

**Decision:** The reading can be set three ways: voice (through the + button, Q70), the slider, and the camera.
- **Slider:** redrawn light, with a big number that rolls like a car's odometer, following the founder's reference video. It replaces Q53's dark panel and the page's own microphone (voice now lives on the + button).
- **Rolling number:** this is the one screen where a number counts/rolls. It is an exception to Q57's "no count-ups".
- **Typing:** tapping the big number still lets the user type.
- **Camera:** reads the kilometer digits on the phone itself first (free, offline). If real dashboards read badly, Gemini becomes the fallback.
- **The camera never saves by itself.** Nothing is saved until the user taps "Save reading".

**Spec for dev:** supersedes the ruler and page-microphone parts of Q53. The saving rules (a lower reading needs a reason and is flagged) are unchanged. One Reanimated shared value drives `RollingNumber` and `OdometerRuler`; the app root is wrapped in `GestureHandlerRootView` for the ruler's drag.

### Q72: Camera reading, wording and behaviour (PM, 2026-10-03)

**Decision:**
- **Row on the page:** "اقرأه بالكاميرا" / "Read with camera", subtitle "Point it at the number under the speedometer."
- **Scanner:** dark full screen with a wide, short camera window (the shape of an odometer display), one line of hint, torch and close buttons. No shutter button. Only what is inside the window is read.
- **A number is accepted only if** it is at or above the last saved reading, not unbelievably far above it (1,000 km a day since the last update, at least 5,000 km), and two looks in a row agree. Then the scanner closes and the number rolls into place.
- **After about 8 seconds with no reading:** the scanner stays open and offers one action, "Type it instead", which closes it and puts the cursor in the number.
- **Permission denied:** one plain line and a button that opens the phone's settings.
- **After a successful read:** one line under the ruler, "قرأناه من الكاميرا. راجعه ثم احفظ." It goes away when the user changes the number.
- **No camera on the device:** one calm line and the "type it" action.

**Why:** Dashboards are dark and digits are easy to misread, so the user must always check before saving. A single way out is clearer than two.

**Spec for dev:** strings under `odometer.scan`; picking the number is `pickReading()` in `src/lib/odometerScan.ts` (checked by `npm run check`).

### Q73: Camera sees a number that doesn't fit the saved reading (dev, 2026-10-04; founder can overrule)

**Decision:** When the camera clearly reads a display-like number (four digits or more, the same in two looks) that is lower than the saved reading or far above it, it no longer ignores it. The scanner pauses and says "قرأنا 205,343، وهو أقل من القراءة المحفوظة (250,500). هل نستخدمه؟" with "استخدم هذا الرقم" and "حاول مرة أخرى". Using it only fills the page; a lower reading still needs a reason there, and nothing is saved before "Save reading".
**Why:** On the first phone test the camera read nothing, because the test car's saved reading was above every dashboard tried. Silence looks broken; a wrong saved reading is exactly when the user needs the camera.

### Q74: Camera: instant read, big number, confirm saves (Shady, 2026-10-04)

**Decision:** After the first phone test the founder asked for the camera to be fast and to finish on the scanner itself. The first clear number is accepted (no waiting for two looks) and shown large on the scanner with "تأكيد وحفظ" / "Confirm and save" and "حاول مرة أخرى" / "Look again". Confirm saves the reading and leaves the page. This replaces Q72's "rolls into place, then Save" and Q73's "use it?" question: a number that is lower than the saved reading, or far above it, is shown the same way with a one-line note. A lower one still cannot save without a reason, so Confirm puts it on the page and asks for the reason there.
**Why:** The user is looking at the number when confirming, so the second look and the extra Save tap only added waiting.

**Spec for dev:** pictures are taken at 1920x1080 on iPhone with no pause between looks. Test builds show the timing of each step under the camera window.

### Q75: Camera reads live, on iPhone and Android alike (Shady, 2026-10-04)

**Decision:** The picture-by-picture reader was still too slow, so the camera now reads the video as it streams: the number is picked up while the user is still aiming. A number counts when two frames in a row agree (a fraction of a second), then Q74's big number and "Confirm and save" follow. The same code runs on iPhone and Android; an iPhone-only fast path with a slower Android fallback was rejected. Standing rule from the founder: every feature must work, with the same feel, on both platforms.
**Why:** "Point and it reads" only feels right when it is instant, and the two platforms must not drift apart.

**Spec for dev:** `react-native-vision-camera` v5 + `react-native-vision-camera-ocr-plus` (Google ML Kit on both platforms, on the device, no cost) replace `expo-camera`, `expo-image-manipulator` and `expo-text-extractor`. Only the middle band of the frame is read (`scanRegion`), matching the window. `pickReading()` / `pickOutlier()` are unchanged.

---

## Store release prep: sign-in, privacy, errors (2026-10-05)

### Q76: Google sign-in on phones without Google services (PM, 2026-10-05)

**Decision:** On phones without Google services (Huawei), the "Continue with Google" button is hidden. Email sign-in and "Continue as guest" stay. Huawei ID sign-in goes to `docs/IDEAS.md` for later.
**Why:** Today the button opens a Google dialog and then an English error. A button that cannot work is worse than no button, and Huawei ID is a large job that is not needed to launch.

**Spec for dev:** check once at startup whether Google services exist; if not, do not render the button (and its "or" divider). Add the Huawei ID idea to `docs/IDEAS.md`.

### Q77: Guests can delete their data (PM, 2026-10-05)

**Decision:** On the "create an account" gate screen (screen 37), a small quiet text link at the bottom: "Delete my guest data". It opens the existing delete-account confirmation screen with guest wording ("Delete your guest data?"). After deleting, the app signs the guest out and returns to the Welcome screen, with a short toast.
**Why:** A guest's vehicle lives on our servers, and the stores expect every user to be able to remove their data. The Account tab is locked for guests, so the gate screen is the only place they land. A quiet link keeps the main goal (create an account) the loudest thing on screen.

**Spec for dev:** same deletion call as `feedback.deleteAccount`, different strings (`feedback.deleteGuest.*`, `toast.guestDeleted`). The link is shown only to guests.

### Q78: Telling users that voice goes to an AI service (PM, 2026-10-05)

**Decision:** One small muted line on the voice recording screen, under the hint, always visible: no pop-up, no extra tap. It says the recording is sent to an AI service to write the records and is not kept. The full explanation (Google's Gemini, what is sent, what is not stored) goes into the privacy policy.
**Why:** The user is told before recording without being slowed down. A pop-up would be tapped away without reading; a line that is always there is honest and costs nothing.

**Spec for dev:** string `capture.voice.aiNotice`; the privacy page on the website must name the AI service before release.

### Q79: Voice logging without a built-in speech service (PM, 2026-10-05)

**Decision:** On phones with no built-in speech service (Huawei, Android 12 or older), the phone records the voice and sends it directly; the AI writes the records as usual. Because no words appear while speaking, the screen keeps the same listening animation and shows one calm line in place of the live words: "We're recording. Your records appear when you tap done." The review screen afterwards is identical.
**Why:** Silent fallback to manual entry took the best feature away from exactly the phones that need it. Saying plainly why no words appear stops people thinking it is broken.

**Spec for dev:** string `capture.voice.noPreview`; no change to the review, limits (Q70) or the "recordings are not stored" rule.

### Q80: Agreement line at sign-up, links in Account (PM, 2026-10-05)

**Decision:** Under the "Create account" button: "By creating an account you agree to the Terms and the Privacy Policy", both names are links to the website pages. No checkbox. In the Account screen footer: Privacy, Terms and Support links, each opening the website page in the app's language.
**Why:** The stores require the links to be reachable; a checkbox adds a step and a way to fail without adding legal weight over the clear line.

**Spec for dev:** strings `auth.register.consent*`, `account.terms`, `account.support`. The three pages must be live before store review.

### Q81: Friendly error messages (PM, 2026-10-05)

**Decision:** Eleven screens show the server's raw English message to Arabic users. Replace all of it with a fixed set of friendly messages in both languages: generic, network, wrong login, email already used, email not confirmed, too many attempts, weak password, same password, Google sign-in failed. Anything not recognised shows the generic message. Raw server text is never shown on screen. A full-screen "Something went wrong" fallback with a "Try again" button covers crashes.
**Why:** An English technical line is meaningless to an Arabic-first user and looks broken. Fewer, clearer messages are enough.

**Spec for dev:** one helper turns an error into one of the `errors.*` keys; the raw message goes to the log only. Strings under `errors.*`, `errorScreen.*`, `notifPrefs.saveError`.

### Q82: Password minimum is 8 characters (PM, 2026-10-05)

**Decision:** New passwords need at least 8 characters (was 6). People who already have a shorter password keep it and can sign in; the rule applies when they create or change one.
**Why:** Security hardening before launch at almost no cost to users.

**Spec for dev:** change the app check and the Supabase minimum password length (in `config.toml`, aligned first because it applies on push). Email links now work only on the phone that requested them and expire; the failure message is `auth.login.linkExpired`.

### Q83: Target age and content rating on the store forms (PM, 2026-10-05)

**Decision:** Declare the target audience as **18 and over** on Google Play, and the equivalent on Huawei AppGallery. Content rating questionnaire: answer "no" to everything (no ads, no purchases, no chat between users, no location, no violence or similar content); data collected is account, vehicles and voice recordings, declared as such.
**Why:** The app is for people who own and drive vehicles, so adults. Picking an under-18 band would trigger the extra Families requirements for no benefit. The privacy policy says "not directed at children under 13"; that stays true and does not conflict.

### Q84: Share links become normal web links (Shady, 2026-10-05)

**Decision:** Share links are `https://bestim-eg.com/receive?token=...`. They open a small page on the website with an "Open in Bestim" button and store buttons (app not installed yet). This replaces the `bestim://` links, which chat apps do not make tappable. It supersedes the "paste field only until Phase 6" part of Q43; the paste field stays as a backup.
**Why:** A link people can tap in WhatsApp is the whole point of sharing. Founder approved on 2026-10-05.

**Spec for dev:** the app must handle the web link (Android App Links / iOS Universal Links) as well as `bestim://`; the website page is a `bestim-landing` task. Note it in `docs/UPDATES.md`.
