# Tokenized ICS endpoint

## Key findings

- A calendar subscription URL is retained by Google Calendar and may be shared independently of the team page. It should therefore use a separate read-only credential, not the web magic link that authorizes signups and address changes.
- Supabase Edge Functions support custom production secrets through environment variables. `ICS_SIGNING_SECRET` is preferred; when project-secret permissions are unavailable, the code falls back to Supabase's existing server-only function key. The database row supplies revocation, expiration, team scope, and usage tracking.
- Stable `UID` values let calendar clients update existing events when driver assignments change. `LAST-MODIFIED` and `SEQUENCE` are derived from the latest event, slot, or signup update, including cancellations so the sequence never rolls backward when a driver withdraws.
- The feed uses CRLF line endings, ICS text escaping, and 75-octet line folding for broad calendar-client compatibility.

## Pricing and limitations

- This uses the existing Supabase project, database, and Edge Function allocation; there is no separate calendar-hosting service.
- Google controls subscription refresh timing. The feed advertises an hourly refresh, but Google Calendar may refresh less frequently.
- Anyone who obtains the ICS URL can read the team schedule and driver names. The URL cannot create or change signups, and it can be revoked independently.
- Because calendar clients require a self-contained URL, the read-only credential can appear in Supabase function access logs. Restrict dashboard/log access and never paste the URL into public tickets or documentation.
- The first version includes upcoming listed events. Historical entries are omitted, matching the carpool board.
- Until a dedicated `ICS_SIGNING_SECRET` is added, rotating the Supabase server key also changes derived subscription URLs. Parents would need to subscribe again after that uncommon operation.

## Code snippets for integration

The protected team response supplies the subscription URL:

```js
calendarFeedUrl = payload.calendarFeedUrl;
await navigator.clipboard.writeText(calendarFeedUrl);
```

The calendar endpoint validates an HMAC-bound credential before querying the team:

```ts
const expected = await expectedSignature(tokenId, access.team_id);
if (!timingSafeEqual(signature, expected)) {
  return errorResponse("Calendar link is invalid or no longer active", 401);
}
```

## Next steps

1. When project-secret permissions are available, add a dedicated `ICS_SIGNING_SECRET`; this immediately changes derived URLs, so coordinate the change before parents subscribe.
2. For routine feed rotation, revoke the active `purpose = 'ics'` row and create a replacement row for the same team. Opening the web magic link will then return the replacement subscription URL.
3. Do not publish the raw feed URL in source control or general documentation. Share it through the validated carpool page.
4. Add the same credential row for Red Tigers when that season launches; the shared endpoint derives its event prefix from `teams.short_code`.

Rotation is operational data rather than a schema migration. The intended transaction is:

```sql
begin;

update private.access_tokens
set revoked_at = now()
where team_id = :team_id
  and purpose = 'ics'
  and revoked_at is null;

insert into private.access_tokens (team_id, purpose, token_hash)
values (:team_id, 'ics', :temporary_unique_hash);

commit;
```

The next authenticated schedule read replaces the temporary hash with the hash of the derived signed token before returning the new URL.
