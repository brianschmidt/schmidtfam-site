# Practice-only schedules progress

## Scope

- Remove games from the Blue Pumas and Red Tigers carpool boards without deleting their source-calendar or team-event records.
- Remove games from both teams' subscribed ICS feeds so the board and calendar remain consistent.
- Rename the outbound practice segment from `To event` to `To practice` while preserving slot IDs, signups, and comment threads.
- Version the frontend asset URLs to prevent the stale HTML/JavaScript mismatch observed after the previous GitHub Pages deployment.

## Status

- [x] Confirm GitHub and Supabase deployment access.
- [x] Add the practice-only filters to the shared schedule and calendar functions.
- [x] Add the slot-label migration and parent-facing practice copy.
- [x] Apply and deploy the backend changes.
- [x] Verify both teams' web schedules and ICS feeds.
- [x] Push the feature branch for the GitHub Pages deployment.

## Verification target

- Every returned event has a source title beginning with `Practice:`.
- Blue Pumas and Red Tigers return no games.
- Every outbound slot is labeled `To practice`; home slots remain `Home`.
- Both ICS feeds contain only practice events.

## Verified result

- Blue Pumas: 19 upcoming practices, 0 games, and 19 `To practice` slots on the board and ICS feed.
- Red Tigers: 30 upcoming practices, 0 games, and 30 `To practice` slots on the board and ICS feed.
- Preserved internally for reversibility: 9 Blue Pumas games and 8 Red Tigers non-practice events.
- Edge Function versions `team-schedule` v7 and `team-calendar` v4 returned HTTP 200 during verification.
- Supabase advisors reported no errors or warnings; existing private-schema and young-index notices remain informational.
