# Carpool Scheduler Requirements — Progress

## 2026-08-23 — Initial decisions captured

- Audience: parents on one team.
- Slot meaning: a driver volunteering for a route and time.
- Schedule visibility: all parents see the full schedule.
- Calendar: one shared schedule that parents subscribe to in Google Calendar.
- Initial access: anyone who knows the URL.
- Deferred: Google authentication if URL-only access later becomes a problem.
- Obsidian draft: `Carpool Scheduler Requirements.md`.

Next: clarify route creation, recurrence, capacity, and schedule-change behavior.

## 2026-08-27 — Updated requirements and repository direction

- Slots will be generated from the team schedule through the coding harness.
- Each driver volunteers for one date rather than a repeating series.
- No rider capacity or vehicle details are required.
- A claimed slot displays the parent who signed up.
- Parents can edit or cancel their own sign-ups without a departure-time cutoff.
- No separate notifications are required; calendar updates are sufficient.
- Administrative corrections can be made directly through the site with a coding agent.
- The existing `schmidtfam-site` repository will host the prototype.
- Development is isolated on `codex/carpool-scheduler`; current family pages will remain untouched.

Next: build a local interactive mockup, then apply the frontend-design skill and evaluate it.

## 2026-08-27 — Frontend direction

- Subject: parents coordinating rides for one youth team.
- Primary job: see uncovered trips and claim one in seconds.
- Palette: navy `#102A43`, pool blue `#35B8D0`, safety yellow `#F6DC65`, coral `#FF6B5E`, cloud `#F4F8FB`, white `#FFFFFF`.
- Type: `Anybody` for expressive headings, `DM Sans` for interface copy, and `IBM Plex Mono` for dates and schedule data.
- Layout: a compact team header, a week-level route rail, then date-grouped trip cards with calendar actions alongside.
- Signature: the week is drawn as a transit-style route whose stops communicate whether each day is covered.
- Revision after critique: avoided the existing cream/serif family-site treatment and generic dashboard metric cards; the schedule itself is the hero.

## 2026-08-27 — Prototype validation

- Added the local prototype under `carpool/` without changing the existing family pages.
- Tested signup, edit, cancellation, coverage counts, calendar guidance, and `.ics` generation.
- Verified desktop and 390px mobile layouts in a real browser.
- Verified there is no horizontal mobile overflow and no browser console error during the tested flows.
- Verified `carpool/app.js` parses successfully and `git diff --check` reports no whitespace errors.
- Remaining implementation boundary: real shared signups and an auto-updating hosted calendar feed require a backend.

## 2026-08-27 — Simplification from last year’s sheet

- Read the prior `Sofia & Penelope Soccer carpool` Google Sheet without modifying it.
- Prior structure: date rows with fixed ride columns for home-to-field, field-to-home, and an occasional extra pickup.
- Prior interactions were name entry plus occasional free-text schedule notes.
- Simplification direction: preserve the familiar date-by-route matrix and remove the large hero, route rail, coverage count, trip-card stack, and large calendar promotion.
- Calendar subscription remains available as a secondary action.
- Optional date-level schedule notes are supported for exceptions.

## 2026-08-27 — Simplified prototype validation

- Verified the simplified desktop matrix uses the full 1040px content width and preserves its three-column date/ride layout.
- Verified the mobile version converts each date row into two clearly labeled ride slots with no horizontal overflow.
- Tested signup, edit access, cancellation, and Google Calendar guidance with no console errors.
- Verified `carpool/app.js` parses successfully and `git diff --check` passes.

## 2026-08-27 — Lara calendar source connected

- Confirmed the connected `LMFC Soccer - Schmidt - 2024-2025 Season` calendar contains events for multiple children despite its legacy title.
- Lara's schedule rule is: future events whose title contains `Blue Puma`, matched case-insensitively so `Blue Pumas` is included.
- The current lookup returned 28 events from September 10 through November 15, 2026: 20 practices and 8 games.
- Replaced the placeholder schedule with a static snapshot of those events, including source title, Eastern time, and location.
- Each source event now exposes two deliberately time-neutral signup slots, `To event` and `Home`; the UI does not invent pickup or departure times.
- Updated the `.ics` preview to create one calendar event per source event with both driver assignments in its description.
- Updated the Obsidian requirements note at `carpool-scheduler-requirements.md` with the calendar source and filter decision.
- Revalidated desktop, 390px mobile, signup/edit/cancel, calendar guidance, JavaScript syntax, whitespace, and browser console state.

Next: choose the shared-data backend and implement recurring calendar ingestion so source changes and signups propagate without code edits.

## 2026-08-27 — Header identity and date-spacing refinement

- Replaced the temporary `BP` letter badge with an original, transparent blue-puma cartoon mark generated for the project in the existing navy, pool-blue, and safety-yellow palette.
- Added the optimized 256×256 RGBA asset at `carpool/assets/blue-puma-logo.png` and display it at 48×48 in the team header.
- Gave the date/weekday block a protected grid column and a fixed gap before event details so long weekday names cannot collide with practice titles.
- Verified a 12px desktop separation, 10px mobile separation, successful logo loading, no horizontal overflow, and no JavaScript or whitespace errors.

## 2026-08-27 — ICS event naming

- Confirmed the MVP calendar output will be an app-hosted ICS subscription feed rather than a separate shared Google Calendar.
- Calendar titles now surface whether coverage is complete: `BP Practice - Driver Needed` while either ride is open, `BP Practice - Stefanie Driving` when one parent covers both rides, and `BP Practice - Stefanie + Brian Driving` when two parents split them.
- Game titles use the equivalent `BP Game` prefix.
- The event description retains the separate `To event` and `Home` assignments.

## 2026-08-27 — Rolling schedule window

- The website now derives today from the `America/New_York` timezone rather than the viewer's local timezone.
- Events with dates before today are omitted; today's events remain visible until the New York calendar day ends.
- After the first event becomes historical, initial page load automatically scrolls to the schedule board so the current or next event is immediately visible.
- The board header now shows `Today` with the current date and recalculates the remaining event count.
- Added a season-complete state for the period after the final event.
- Tested inclusion on the current date, removal beginning the next date, the New York midnight boundary, live browser rendering, and console state.

## 2026-08-27 — Source-calendar sync recommendation

- Recommended an hourly incremental Google Calendar sync rather than one full check each morning.
- The implementation should persist Google's sync token, upsert changes by Google event ID, process deletions, and fall back to a full reconciliation after HTTP `410 Gone`.
- Carpool signups should be keyed by Google event ID plus direction so source time/location edits preserve driver assignments.
- Recommended an administrator-only `Sync now` action for urgent corrections and deferring expiring Google push-notification channels until faster-than-hourly freshness is necessary.
- Saved the implementation research at `docs/research/google-calendar-sync-strategy.md`.

## 2026-08-27 — Production deployment recommendation

- Confirmed the existing repository already owns the GitHub Pages custom domain through the root `CNAME` value `schmidtfam.co`.
- Recommended publishing the frontend from a `bluepuma/` directory at `https://schmidtfam.co/bluepuma/`; no path-specific DNS change is required.
- GitHub Pages remains the static frontend host, while Supabase provides shared signups, source-event storage, Edge Function APIs, the live ICS response, and the hourly sync job.
- The production shared link should include a revocable random team token because the clean `/bluepuma/` path and all GitHub Pages content are public.
- Saved the detailed deployment plan at `docs/research/production-deployment.md`.

## 2026-08-27 — Pickup address directory

- Added a compact, expandable `Pickup addresses` section between the page introduction and the full team schedule.
- Parents can save a child or family name and pickup address once, then use the directory as a standing reference when coordinating rides.
- The section includes a saved-address count, an empty state, and edit/remove controls for entries created in the current browser.
- Added a privacy reminder because the directory contains home addresses and should only be shared through the private team link.
- The prototype persists addresses in browser `localStorage`; production must move them to the shared backend so every team parent sees the same directory.
- Verified the expanded mobile layout has no horizontal overflow and keeps the schedule immediately below the directory.

## 2026-08-27 — Multi-team Supabase preparation

- Confirmed that Blue Pumas and Sofia's Red Tigers should share one Supabase project, API surface, and calendar-sync service.
- Recommended polling the shared LMFC calendar once into source-level event records, then classifying events into team seasons with data-driven title rules.
- Added explicit team boundaries for schedules, signups, pickup addresses, web tokens, and ICS tokens; home addresses remain isolated even when a family participates on both teams.
- Added `team_seasons`, `calendar_sources`, `calendar_rules`, `source_events`, and `team_events` boundaries so a renamed or moved Google event does not detach its carpool signups.
- Recommended an unexposed private database schema behind token-validating Edge Functions because the MVP does not yet use Supabase Auth.
- Documented the proposed schema, security model, ingestion loop, pricing/limitations, and implementation steps at `docs/research/multi-team-supabase-schema.md`.

## 2026-08-27 — Initial Supabase migration applied

- Connected to the new hosted Supabase project `carpool-scheduler` (`fmrgosorbzkhcssondak`) in `ca-central-1`; it was active, healthy, and had no prior application tables or migrations.
- Initialized the checked-in local Supabase structure and created migration `20260827210642_initial_multi_team_schema.sql`.
- Validated the complete migration in a remote transaction that was rolled back before applying it persistently.
- Applied the migration successfully and created 11 application tables in an unexposed `private` schema.
- Seeded Blue Pumas and Red Tigers with active `Fall 2026` seasons while leaving calendar IDs, rules, credentials, and tokens unset until their exact values are available.
- Enabled and forced RLS on all 11 tables, revoked private-schema access from `anon` and `authenticated`, and granted server-only access to `service_role`.
- Verified both seed records, all RLS settings, role privileges, constraints, foreign keys, indexes, and the migration-history entry.
- Ran Supabase security and performance advisors. They returned no errors or warnings; only expected informational notices for deliberately policy-free private tables and indexes that cannot yet be used in an empty database.

Next: configure the exact LMFC calendar source and team matching rules, then implement the token-validating API layer before connecting the frontend.
