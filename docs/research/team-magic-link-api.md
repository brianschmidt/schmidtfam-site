# Team magic-link schedule API

## 1. Key findings

- A team-specific opaque token works well for v1 because everyone with the link needs the same read access and individual identity is not yet required.
- The browser keeps the token in the URL fragment (`#access=...`). Fragments are not sent in normal HTTP requests, so the page explicitly sends the token to the Edge Function in an `Authorization: Bearer` header.
- Supabase stores only the SHA-256 token hash. The Edge Function hashes the presented value and resolves the team from `private.access_tokens`; the client never submits or chooses a team ID.
- The `team-schedule` function reads the private schema through `SUPABASE_DB_URL`. Anonymous browser clients have no direct access to those tables.
- CORS is limited to the local development origins and `schmidtfam.co` origins. Missing, invalid, expired, or revoked credentials do not return schedule data.
- Shared writes use a second layer of possession-based authorization: each created signup or address gets its own random edit token, and only its SHA-256 hash is stored in Postgres.
- `team-actions` supports signup create/update/cancel and address create/update/archive. Every query scopes the target row back to the team resolved from the magic link.
- The partial unique index on active signups makes slot claiming atomic. Two simultaneous create requests cannot both take the same ride; the loser receives HTTP 409.

## 2. Pricing and limitations

- This uses one Supabase Edge Function invocation per schedule load plus a small number of Postgres queries. It should remain within typical early-stage Supabase usage, but plan limits and pricing should be checked again before launch.
- A shared link is authorization by possession: any recipient can forward it. The organizer can revoke the hashed token and issue a new one if the link spreads.
- Schedule reads and signup/address writes are live. The creator's browser stores only the raw per-record edit tokens needed to recognize and edit its own records.
- Clearing browser site data or switching devices loses the ability to edit records created in the original browser. An organizer cleanup mechanism is a useful follow-up before launch.
- The team link still allows anyone who possesses it to create records. Input limits, team scoping, historical-event checks, and slot uniqueness reduce abuse, but v1 does not yet have per-person rate limits or identity.
- The first 28 events are a connector-derived snapshot. Automatic Google Calendar polling and OAuth secret storage are separate follow-up work.
- The future ICS subscription should use a separate `purpose = 'ics'` token so web-link rotation does not silently break subscribers.

## 3. Integration snippets

Browser request:

```js
const token = new URLSearchParams(location.hash.slice(1)).get("access");
const response = await fetch(SCHEDULE_API_URL, {
  headers: { Authorization: `Bearer ${token}` }
});
```

Protected write request:

```js
const response = await fetch(ACTIONS_API_URL, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${teamToken}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    action: "signup.create",
    slotId,
    driverName
  })
});
const { signup, editToken } = await response.json();
```

Server-side credential resolution:

```ts
const tokenHash = await sha256(token);
const accessRows = await sql`
  select team.id, team.slug
  from private.access_tokens access
  join private.teams team on team.id = access.team_id
  where access.token_hash = ${tokenHash}
    and access.purpose = 'web'
    and access.revoked_at is null
    and (access.expires_at is null or access.expires_at > now())
`;
```

## 4. Next steps

1. Build the tokenized ICS endpoint and replace the prototype calendar URL.
2. Configure Google Calendar OAuth and a daily sync job with an organizer-triggered refresh option.
3. Add an organizer recovery/cleanup path for records whose browser edit token is lost.
4. Consider lightweight per-team write throttling after observing production use.
5. Publish the static frontend at `/bluepuma/`, then test the production origin against the existing CORS allowlist.
