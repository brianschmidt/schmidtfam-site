# Multi-team Supabase schema for Blue Pumas and Red Tigers

## 1. Key findings

- Use one Supabase project and make `team_id` or `team_season_id` an explicit tenant boundary throughout the carpool domain. Do not create a Blue-Pumas-specific database that must be duplicated for Sofia's team.
- Separate calendar ingestion from team classification. Poll the shared LMFC Google Calendar once, store every source event once, then map matching events to team seasons through rules such as case-insensitive title contains `Blue Puma` or `Red Tiger`.
- Store the Google incremental sync token on the calendar source, not on a team. Google's sync token represents a particular event collection and query shape; separate team-level tokens would duplicate work and create inconsistent snapshots.
- Keep raw `source_events` independent from `team_events`. A source event can be reclassified without re-fetching Google, and changes to a team's matching rule can be replayed against already-synchronized events.
- Key driver signups to a generated `carpool_slot`, not to a date or title. A Google time, location, or title edit then preserves the signup.
- Add a stable `teams` row and optional `team_seasons` rows now. The public slug, branding, title prefix, calendar rule, and season dates should be data, not branches in application code.
- Keep pickup addresses team-scoped even when a family appears on both teams. This intentionally duplicates a small amount of data but prevents an address shared with one team's link from automatically becoming visible to another team.
- Because version one uses URL tokens rather than Supabase Auth, place application tables in an unexposed `private` schema and make Edge Functions the only application entry point. Supabase documents that custom schemas can remain hidden from the Data API, while secret/service clients bypass RLS; therefore every privileged function must resolve the token to exactly one team and scope every query to that team.
- Store only hashes of web, calendar, edit, and administrative tokens. The web token grants team read/create access; the ICS token is independently revocable; per-signup and per-address edit tokens preserve the current-browser “edit mine” behavior without requiring user accounts.
- Treat a source event that changes teams, stops matching, is deleted, or matches multiple rules as a reviewable classification change. Hide it from the affected schedule but retain signups and create an administrative issue rather than silently moving or deleting carpool commitments.
- Use one parameterized frontend codebase. `/bluepuma/` and `/redtigers/` may have separate static entry pages, but both should load configuration and schedule data by a stable team slug from the same API and shared UI modules.

Recommended relationship model:

```text
calendar_sources ──< source_events
       │                   │
       └──< calendar_rules │
                   │       │
teams ──< team_seasons ──< team_events ──< carpool_slots ──< signups
  │
  ├──< pickup_addresses
  └──< access_tokens
```

Recommended calendar flow:

```text
One hourly source sync
        ↓
LMFC calendar incremental changes
        ↓
Upsert each Google event once in source_events
        ↓
Apply all active team/season rules
        ├── title contains "Blue Puma" → Blue Pumas season
        └── title contains "Red Tiger" → Red Tigers season
        ↓
Team-specific schedules, signups, addresses, and ICS feeds
```

Official references:

- [Supabase tables and private schemas](https://supabase.com/docs/guides/database/tables)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Securing Supabase Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Supabase database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [Google Calendar incremental synchronization](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Google Calendar event resource](https://developers.google.com/workspace/calendar/api/v3/reference/events)
- [Google Calendar recurring events](https://developers.google.com/workspace/calendar/api/guides/recurringevents)

## 2. Pricing and limitations

- Adding Red Tigers to the same Supabase project does not require another project, database, OAuth grant, or calendar poll. It adds only a small number of rows and another classification rule, so the incremental infrastructure cost should be negligible at this scale.
- One source-level cron job is preferable to one job per team. Supabase currently recommends no more than eight concurrent Cron jobs and that each job finish within ten minutes; a single worker that loops over active calendar sources remains well inside those boundaries for this project.
- URL tokens are bearer credentials. Anyone who receives a team link can view that team's schedule and home-address directory until the token is revoked. Keep Blue Pumas and Red Tigers tokens separate, rate-limit public functions, and provide token rotation.
- A Supabase secret/service client bypasses RLS. RLS alone cannot protect a privileged Edge Function that forgets to scope a query, so use a private schema, narrow database routines, integration tests, and mandatory `team_id` parameters as additional boundaries.
- Without account authentication, edit ownership is browser-bound. Store a random edit token in that browser and only its hash in the database. Editing from another device requires an administrator until Google sign-in or a recovery flow is added.
- Title matching is pragmatic but imperfect. A renamed or ambiguous Google event can stop matching or match both teams. The sync should surface these cases for review and never transfer existing signups automatically.
- Google recurring instances need careful identity handling. With `singleEvents=true`, instances have individual Google event IDs; also retain `recurringEventId` and immutable `originalStartTime` so exceptions and rescheduled instances can be reconciled.
- Pickup addresses are sensitive data. Do not include them in ICS feeds, logs, analytics payloads, or raw error messages, and do not return addresses for one team when validating another team's token.

## 3. Code snippets for integration

Illustrative first migration; exact grants and function signatures should be added with the implementation:

```sql
create schema if not exists private;

create table private.teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  short_code text not null,
  timezone text not null default 'America/New_York',
  page_path text not null unique,
  theme jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table private.team_seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references private.teams(id),
  label text not null,
  starts_on date,
  ends_on date,
  active boolean not null default true,
  unique (team_id, label)
);

create table private.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'google'),
  external_calendar_id text not null,
  display_name text not null,
  timezone text not null default 'America/New_York',
  credential_secret_name text not null,
  next_sync_token text,
  last_synced_at timestamptz,
  last_error text,
  active boolean not null default true,
  unique (provider, external_calendar_id)
);

create table private.calendar_rules (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null references private.team_seasons(id),
  calendar_source_id uuid not null references private.calendar_sources(id),
  match_kind text not null default 'title_contains'
    check (match_kind in ('title_contains', 'manual')),
  match_value text not null,
  case_sensitive boolean not null default false,
  active boolean not null default true,
  unique (team_season_id, calendar_source_id, match_kind, match_value)
);

create table private.source_events (
  id uuid primary key default gen_random_uuid(),
  calendar_source_id uuid not null references private.calendar_sources(id),
  external_event_id text not null,
  ical_uid text,
  recurring_event_id text,
  original_start_at timestamptz,
  status text not null,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  source_updated_at timestamptz,
  removed_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  unique (calendar_source_id, external_event_id)
);

create table private.team_events (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null references private.team_seasons(id),
  source_event_id uuid not null references private.source_events(id),
  matched_rule_id uuid references private.calendar_rules(id),
  visibility text not null default 'listed'
    check (visibility in ('listed', 'unlisted', 'needs_review')),
  manually_included boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_season_id, source_event_id)
);

create table private.carpool_slots (
  id uuid primary key default gen_random_uuid(),
  team_event_id uuid not null references private.team_events(id),
  direction text not null check (direction in ('to_event', 'home')),
  label text not null,
  sort_order integer not null,
  active boolean not null default true,
  unique (team_event_id, direction)
);

create table private.signups (
  id uuid primary key default gen_random_uuid(),
  carpool_slot_id uuid not null references private.carpool_slots(id),
  driver_name text not null,
  edit_token_hash text not null,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create unique index one_active_signup_per_slot
  on private.signups (carpool_slot_id)
  where cancelled_at is null;

create table private.pickup_addresses (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references private.teams(id),
  child_or_family_name text not null,
  address_text text not null,
  edit_token_hash text not null,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table private.access_tokens (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references private.teams(id),
  purpose text not null check (purpose in ('web', 'ics', 'admin')),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz
);

create index team_seasons_team_idx on private.team_seasons(team_id);
create index calendar_rules_source_idx on private.calendar_rules(calendar_source_id);
create index source_events_source_idx on private.source_events(calendar_source_id);
create index team_events_season_idx on private.team_events(team_season_id);
create index pickup_addresses_team_idx on private.pickup_addresses(team_id);
```

One worker should sync a calendar source once and then apply every rule attached to that source:

```ts
for (const source of await listActiveCalendarSources()) {
  const changes = await fetchIncrementalGoogleChanges(source);

  await transaction(async (tx) => {
    for (const googleEvent of changes.events) {
      const sourceEvent = await tx.upsertSourceEvent(source.id, googleEvent);
      const rules = await tx.listActiveRulesForSource(source.id);
      const matches = rules.filter((rule) => ruleMatches(rule, sourceEvent));

      if (matches.length > 1) {
        await tx.flagClassificationIssue(sourceEvent.id, matches);
        continue;
      }

      await tx.reconcileTeamEvent(sourceEvent, matches[0] ?? null, {
        preserveExistingSignups: true,
      });
    }

    await tx.saveNextSyncToken(source.id, changes.nextSyncToken);
  });
}
```

The public Edge Function validates the opaque team token before any schedule query:

```toml
# The team token is our opaque credential, not a Supabase JWT. The function must
# perform its own validation before touching application data.
[functions.team-api]
verify_jwt = false
```

```ts
const rawToken = readBearerToken(request);
const team = await resolveActiveTeamByTokenHash(hashWithServerPepper(rawToken));

if (!team) {
  return Response.json({ error: 'Invalid or expired team link' }, { status: 401 });
}

// Every database routine takes the resolved team ID; never trust a team ID from the browser.
const schedule = await loadTeamSchedule(team.id);
return Response.json(schedule);
```

During the local-only phase, namespace browser state now so the two static sites cannot collide in one browser:

```js
const teamSlug = 'blue-pumas'; // Red Tigers supplies 'red-tigers'
const storageKey = (name) => `carpool:${teamSlug}:${name}:v1`;

localStorage.setItem(storageKey('owner'), ownerToken);
localStorage.setItem(storageKey('signup-edits'), JSON.stringify(editTokens));
```

## 4. Next steps

1. Create the Supabase project and check in `supabase/config.toml`, migrations, seed data, and database tests rather than building the schema only through the dashboard.
2. Implement the schema above with two seeded teams, two seasons, one LMFC calendar source, and the initial `Blue Puma` and `Red Tiger` title rules.
3. Add classification tests for case-insensitive plurals, renamed events, deleted events, recurring instances, zero matches, and multiple matches.
4. Add a source-level `sync-calendar-sources` Edge Function and one hourly Cron invocation. Store Google credentials in Edge Function secrets or Vault; do not place them in team rows.
5. Add token-validation helpers and team-scoped database routines before exposing schedule, signup, address, or ICS endpoints.
6. Add concurrency tests proving that two simultaneous signup attempts cannot claim the same slot and cross-team tests proving a Blue Pumas token cannot read or mutate Red Tigers data.
7. Parameterize the current frontend by team configuration and namespace all remaining local-storage keys before cloning or routing the Red Tigers entry page.
8. Keep pickup addresses out of calendar output and logs, and test token revocation independently for web and ICS access.
9. When Google sign-in is added, introduce `team_members(team_id, user_id, role)`, populate the nullable `created_by_user_id` fields, and apply membership-based RLS without redesigning the event or carpool tables.
