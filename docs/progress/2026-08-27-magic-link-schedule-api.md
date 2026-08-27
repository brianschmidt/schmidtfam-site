# Magic-link schedule API progress

## Goal

Connect the Blue Pumas prototype to a team-scoped Supabase schedule API protected by one private magic link per team.

## Completed

- Confirmed the connected source calendar ID for `LMFC Soccer - Schmidt - 2024-2025 Season`.
- Read the bounded August 27–December 31, 2026 calendar window and selected the 28 events whose titles contain `Blue Puma` case-insensitively.
- Added and applied `20260827211917_load_blue_pumas_schedule.sql`.
- Stored the calendar source, Blue Pumas matching rule, 28 source/team events, and 56 carpool slots in the private schema.
- Generated a high-entropy Blue Pumas web token, stored only its SHA-256 hash in `private.access_tokens`, and kept the raw value outside the repository.

## Completed, continued

- Deployed `team-schedule` version 2 with custom bearer-token validation, private-schema queries, explicit CORS origins, and upcoming-season support.
- Connected the static page to the live endpoint and added loading, missing-link, and invalid-link states.
- Verified in the local browser that the valid link loads all 28 events and 56 slots; an invalid token returns 401; no token reveals no schedule.
- Verified the deployed logs show the expected 200, 401, and CORS 204 responses without function errors.
- Ran Supabase advisors. There are no warning/error findings. The remaining INFO notices are intentional no-policy notices for locked private tables and unused-index notices expected on a new database.

## Remaining

- Shared signup and pickup-address write APIs.
- Tokenized ICS endpoint.
- Automated Google Calendar synchronization.
- GitHub Pages production deployment and DNS/path configuration.

## Deliberately deferred

- Shared signup and address write APIs.
- The live Google Calendar polling job and OAuth secret.
- The subscribable ICS endpoint.
