# Tokenized calendar endpoint progress

## 2026-08-27 — design checkpoint

- Chose a separate read-only ICS credential rather than embedding the team web magic link in Google Calendar.
- Token format: `v1.<credential id>.<HMAC-SHA256 signature>`.
- The HMAC binds the credential id to its team id. The implementation prefers `ICS_SIGNING_SECRET` and falls back to Supabase's existing server-only function key when project-secret permissions are unavailable.
- Revocation remains database-driven through `private.access_tokens.revoked_at`; rotation creates a new `purpose = 'ics'` credential.
- The validated team schedule response returns the feed URL. This keeps the subscription address off the public static page.
- The ICS endpoint exposes upcoming listed events only, with stable event UIDs and driver-dependent summaries.

## Implementation status

- [x] Current Supabase docs and changelog checked.
- [x] Endpoint and browser integration written locally.
- [x] Signing key source established; creating a dedicated project secret was blocked by Supabase account privileges, so the server-only key fallback is active.
- [x] One active Blue Pumas ICS credential created and exercised.
- [x] `team-calendar` version 3 and `team-schedule` version 4 deployed and active.
- [x] Valid feed returns 28 upcoming events; a one-character token change returns HTTP 401.
- [x] ICS output verified for CRLF endings, stable UIDs, 75-octet-safe physical lines, and requested summaries.
- [x] Temporary two-slot signup verified `BP Practice - Stefanie Driving`; both test signups were cancelled and zero active signups remain.
- [x] Local browser verified the live subscription URL, enabled copy/open controls, success toast, and no console errors.
- [x] Security and performance advisors rechecked; only expected informational notices remain.
