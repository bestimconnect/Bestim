-- One-off import of the four bugs from Linear (BES-5 to BES-8, team "Bestim", project "Home screen fixes") into the Team tracker.
-- Run once in the SQL editor (it runs as the database owner, so it needs no sign-in). Safe to run twice: a bug whose
-- legacy_ref already exists is skipped, and its note is not added again.
-- Linear had no Severity label on these, so all four are Medium (change it on the item page). They were reported by Ahmed
-- on TestFlight build 1.0.0 (4); there were no comments and no screenshots in Linear.
with ins as (
  insert into public.team_items (legacy_ref, kind, title, status, severity, platform, area, build, screen, steps, expected, actual, created_at)
  values
  ('BES-5', 'bug', $q$Home: header looks split from the screen while loading$q$, 'New', 'Medium', 'iPhone', 'App', $q$1.0.0 (4) TestFlight$q$, 'Home',
   $q$1. Open the Home screen.
2. Pull down to reload the screen.
3. Look at the top of the screen while it is loading.$q$,
   $q$The header and the rest of the screen look like one continuous surface while loading.$q$,
   $q$While loading, the dark header ends with a visible edge and a different background color sits below it, so the top part looks like a separate piece cut off from the screen.$q$,
   '2026-11-09T21:29:15.611Z'),
  ('BES-6', 'bug', $q$Home: tutorial "Example" card shown among real user data$q$, 'New', 'Medium', 'iPhone', 'App', $q$1.0.0 (4) TestFlight$q$, 'Home',
   $q$1. Open the Home screen with real user data (real odometer reading and expenses).
2. Look at the Today's priority section.$q$,
   $q$Example or tutorial content only appears during the tutorial and is removed afterwards. Real users never see it next to their real data.$q$,
   $q$An "Oil change" card with an "Example" badge and the text "Your real reminders appear after your first service." stays under Today's priority, mixed in with the user's real data.$q$,
   '2026-11-09T21:29:16.723Z'),
  ('BES-7', 'bug', $q$Home: dark olive background shows under the content when scrolled to the bottom$q$, 'New', 'Medium', 'iPhone', 'App', $q$1.0.0 (4) TestFlight$q$, 'Home',
   $q$1. Open the Home screen.
2. Scroll all the way to the bottom.$q$,
   $q$The white content area stays in place at the bottom and no background color shows underneath it.$q$,
   $q$The white content area lifts up and the dark olive background color shows below it, behind the bottom navigation bar.$q$,
   '2026-11-09T21:29:17.896Z'),
  ('BES-8', 'bug', $q$Home: white patches behind the header's rounded bottom corners$q$, 'New', 'Medium', 'iPhone', 'App', $q$1.0.0 (4) TestFlight$q$, 'Home',
   $q$1. Open the Home screen.
2. Look at the two rounded bottom corners of the dark header, just above Today's priority.$q$,
   $q$The area behind the rounded corners matches the gradient background below, so the header blends smoothly into the screen.$q$,
   $q$A white patch shows behind each rounded corner and does not match the gradient below it, so the join between the header and the content looks broken.$q$,
   '2026-11-09T21:29:19.388Z')
  on conflict (legacy_ref) do nothing
  returning id, legacy_ref
)
insert into public.team_comments (item_id, body, via)
select id, 'Imported from Linear ' || legacy_ref || '. Reported by Ahmed (TestFlight). Project: Home screen fixes.', 'dashboard' from ins;
