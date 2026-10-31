# Red Tigers signup editing progress

## Report

- A parent can edit two November 4 signups but cannot edit her November 5 signup.
- The November 5 slot renders the parent as `Driving` with no `Edit` button.

## Diagnosis

- Signup editing is authorized by a per-signup edit token stored only in browser `localStorage`.
- The November 5 signup was created on August 30, 2026.
- The editable November 4 signups were created from the reporting iPhone on October 31, 2026.
- The current browser no longer has the older signup's edit token, so the UI correctly treats it as a different browser's signup.
- Supabase logs show successful signup creation and schedule requests, with no failed edit request.

## Decision needed

- Recommended for the current URL-gated v1: treat the team magic link as team-level edit permission so parents can edit or cancel any occupied team slot.
- More private alternative: add parent identity/authentication and attach signups to parent accounts.

## Status

- [x] Inspect screenshots and reproduce the ownership-state mismatch from production data.
- [x] Review Supabase logs and current advisories.
- [x] Identify the missing browser edit credential as the root cause.
- [x] Confirm the intended permission model: the team magic link grants team-wide signup editing.
- [x] Implement team-wide signup editing in the shared frontend and protected write endpoint.
- [x] Deploy and verify the protected write endpoint.
- [ ] Publish and verify the shared frontend.

## Implementation

- Every occupied carpool slot now renders an `Edit` button.
- Signup update and cancellation requests use the team magic link rather than a browser-local edit token.
- The write endpoint still requires a valid, unrevoked team token and verifies that the signup belongs to that active team, slot, season, listed event, and upcoming date.
- Pickup-address and comment editing remain protected by their browser-local edit tokens.

## Backend verification

- Deployed `team-actions` version 4 with custom team-token authorization retained.
- The Red Tigers token successfully updated signup `22` without a browser edit token while preserving the same driver name.
- The Blue Pumas token was rejected from updating that Red Tigers signup with HTTP 404.
- Post-change Supabase advisors reported only the existing informational private-schema RLS and unused-index notices; no warning or error findings were introduced.
