# Product decisions log

Decisions for Bestim made on the founder's behalf while they're away. Scope: closing Phases 1+2 (auth + onboarding) per `docs/BESTIM-TECH-PLAN.md`. Phase 3 (home, guest home screen 36, vehicles, logs, voice) is out of scope and must not be pulled in.

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
