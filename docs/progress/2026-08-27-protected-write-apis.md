# Protected write APIs progress

## Goal

Move carpool signups and pickup addresses from browser-only prototype storage into shared Supabase data without adding user accounts.

## Access model

- The existing Blue Pumas magic link authorizes access to that team only.
- Creating a signup or address requires the team link.
- The server generates a separate high-entropy edit secret for each new record.
- Only the edit-secret hash is stored in Supabase; the raw edit secret is returned once and retained in the creator's browser.
- Updating or cancelling a record requires both the team link and that record's edit secret.

## Completed

- Reviewed current Supabase Edge Function, custom authorization, CORS, and direct Postgres guidance.
- Checked the current Supabase changelog; no breaking change affects this design.
- Confirmed the existing `signups` and `pickup_addresses` tables already contain the required edit-token hash columns and active/cancelled state.
- Defined six actions: signup create/update/cancel and address create/update/archive.
- Deployed `team-actions` version 2 with team authorization, record edit-token validation, strict action routing, input/body limits, team-scoped parameterized SQL, and historical-event protection.
- Deployed `team-schedule` version 3 with signup IDs and shared pickup-address reads.
- Connected both existing frontend forms to the protected API and retained only per-record edit secrets in the creator's browser.
- Verified signup create, edit, reload persistence, cancel, and duplicate-slot rejection.
- Verified address create, edit, reload persistence, and archive.
- Verified invalid team credentials return 401, wrong record edit secrets return 403, and occupied slots return 409.
- Confirmed the final database has no active test signups or test addresses.
- Confirmed Edge Function logs show the expected 200/201/204/401/403/409 responses without server errors.
- Ran database advisors. Remaining findings are INFO-only: intentional no-policy notices for private locked tables and unused-index notices expected on a new database.

## Remaining

- Tokenized ICS endpoint.
- Automated Google Calendar synchronization.
- Organizer recovery/cleanup controls.
- GitHub Pages production deployment and production-origin testing.
