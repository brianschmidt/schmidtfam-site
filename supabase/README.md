# Carpool Scheduler Supabase backend

The connected hosted project is `carpool-scheduler` (`fmrgosorbzkhcssondak`) in `ca-central-1`, running PostgreSQL 17.

## Current state

- Migration `20260827210642_initial_multi_team_schema.sql` is applied remotely.
- Blue Pumas and Red Tigers each have an active `Fall 2026` season.
- Eleven application tables live in the unexposed `private` schema.
- RLS is enabled and forced on every application table.
- `anon` and `authenticated` have no schema usage or table privileges.
- `service_role` is the only application role currently granted access.

The absence of browser-facing RLS policies is intentional. The first version will use Edge Functions that validate a hashed team URL token, resolve its team server-side, and scope every database operation to that team. Never put a Supabase secret/service key in frontend code.

## Tables

- `teams` and `team_seasons`
- `calendar_sources`, `calendar_rules`, and `source_events`
- `team_events` and `carpool_slots`
- `signups` and `pickup_addresses`
- `access_tokens` and `sync_issues`

## Local workflow

Docker must be running before starting the local Supabase stack.

```sh
supabase start
supabase db reset
supabase db lint --local --schema private --fail-on error
```

Keep schema changes in timestamped files under `supabase/migrations/`. Keep Google credentials, service keys, raw access tokens, and edit tokens out of Git.

## Next backend slice

1. Record the exact LMFC calendar ID and add the Blue Pumas and Red Tigers matching rules.
2. Create hashed team web and ICS tokens.
3. Implement token-validating schedule, signup, and pickup-address Edge Functions.
4. Add the source-level Google Calendar sync and hourly Cron job.
