-- Initial multi-team carpool schema.
-- Remote migration version: 20260827210642.
--
-- The browser will not access these tables directly. Future Edge Functions will
-- validate a team access token, resolve the team server-side, and perform scoped
-- operations with a privileged server credential.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table private.teams (
  id bigint generated always as identity primary key,
  slug text not null,
  display_name text not null,
  short_code text not null,
  timezone text not null default 'America/New_York',
  page_path text not null,
  theme jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_slug_key unique (slug),
  constraint teams_page_path_key unique (page_path),
  constraint teams_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint teams_page_path_format check (page_path ~ '^/[a-z0-9-]+/$'),
  constraint teams_display_name_not_blank check (btrim(display_name) <> ''),
  constraint teams_short_code_not_blank check (btrim(short_code) <> '')
);

create table private.team_seasons (
  id bigint generated always as identity primary key,
  team_id bigint not null references private.teams(id) on delete restrict,
  label text not null,
  starts_on date,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_seasons_team_label_key unique (team_id, label),
  constraint team_seasons_label_not_blank check (btrim(label) <> ''),
  constraint team_seasons_date_order check (
    starts_on is null or ends_on is null or starts_on <= ends_on
  )
);

create table private.calendar_sources (
  id bigint generated always as identity primary key,
  provider text not null,
  external_calendar_id text not null,
  display_name text not null,
  timezone text not null default 'America/New_York',
  credential_secret_name text not null,
  next_sync_token text,
  last_synced_at timestamptz,
  last_error text,
  consecutive_failures integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_sources_external_key unique (provider, external_calendar_id),
  constraint calendar_sources_provider_check check (provider in ('google')),
  constraint calendar_sources_external_id_not_blank check (btrim(external_calendar_id) <> ''),
  constraint calendar_sources_display_name_not_blank check (btrim(display_name) <> ''),
  constraint calendar_sources_secret_name_not_blank check (btrim(credential_secret_name) <> ''),
  constraint calendar_sources_failures_nonnegative check (consecutive_failures >= 0)
);

create table private.calendar_rules (
  id bigint generated always as identity primary key,
  team_season_id bigint not null references private.team_seasons(id) on delete restrict,
  calendar_source_id bigint not null references private.calendar_sources(id) on delete restrict,
  match_kind text not null default 'title_contains',
  match_value text not null,
  case_sensitive boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_rules_definition_key unique (
    team_season_id,
    calendar_source_id,
    match_kind,
    match_value
  ),
  constraint calendar_rules_kind_check check (match_kind in ('title_contains', 'manual')),
  constraint calendar_rules_match_value_not_blank check (btrim(match_value) <> '')
);

create index calendar_rules_calendar_source_id_idx
  on private.calendar_rules (calendar_source_id);

create table private.source_events (
  id bigint generated always as identity primary key,
  calendar_source_id bigint not null references private.calendar_sources(id) on delete restrict,
  external_event_id text not null,
  ical_uid text,
  recurring_event_id text,
  original_start_at timestamptz,
  status text not null,
  title text,
  all_day boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  starts_on date,
  ends_on date,
  location text,
  source_updated_at timestamptz,
  removed_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_events_external_key unique (calendar_source_id, external_event_id),
  constraint source_events_status_check check (status in ('confirmed', 'tentative', 'cancelled')),
  constraint source_events_external_id_not_blank check (btrim(external_event_id) <> ''),
  constraint source_events_time_shape check (
    (
      all_day
      and starts_on is not null
      and ends_on is not null
      and starts_at is null
      and ends_at is null
      and starts_on <= ends_on
    )
    or
    (
      not all_day
      and starts_at is not null
      and ends_at is not null
      and starts_on is null
      and ends_on is null
      and starts_at <= ends_at
    )
  )
);

create index source_events_upcoming_timed_idx
  on private.source_events (calendar_source_id, starts_at)
  where removed_at is null and not all_day;

create index source_events_upcoming_all_day_idx
  on private.source_events (calendar_source_id, starts_on)
  where removed_at is null and all_day;

create index source_events_recurring_event_id_idx
  on private.source_events (calendar_source_id, recurring_event_id)
  where recurring_event_id is not null;

create table private.team_events (
  id bigint generated always as identity primary key,
  team_season_id bigint not null references private.team_seasons(id) on delete restrict,
  source_event_id bigint not null references private.source_events(id) on delete restrict,
  matched_rule_id bigint references private.calendar_rules(id) on delete restrict,
  visibility text not null default 'listed',
  manually_included boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_events_season_source_key unique (team_season_id, source_event_id),
  constraint team_events_visibility_check check (
    visibility in ('listed', 'unlisted', 'needs_review')
  )
);

create index team_events_source_event_id_idx
  on private.team_events (source_event_id);

create index team_events_matched_rule_id_idx
  on private.team_events (matched_rule_id)
  where matched_rule_id is not null;

create index team_events_listed_idx
  on private.team_events (team_season_id, source_event_id)
  where visibility = 'listed';

create table private.carpool_slots (
  id bigint generated always as identity primary key,
  team_event_id bigint not null references private.team_events(id) on delete restrict,
  direction text not null,
  label text not null,
  sort_order smallint not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carpool_slots_event_direction_key unique (team_event_id, direction),
  constraint carpool_slots_direction_check check (direction in ('to_event', 'home')),
  constraint carpool_slots_label_not_blank check (btrim(label) <> ''),
  constraint carpool_slots_sort_order_nonnegative check (sort_order >= 0)
);

create table private.signups (
  id bigint generated always as identity primary key,
  carpool_slot_id bigint not null references private.carpool_slots(id) on delete restrict,
  driver_name text not null,
  edit_token_hash text not null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint signups_driver_name_not_blank check (btrim(driver_name) <> ''),
  constraint signups_edit_token_hash_not_blank check (btrim(edit_token_hash) <> '')
);

create unique index signups_one_active_per_slot_idx
  on private.signups (carpool_slot_id)
  where cancelled_at is null;

create index signups_carpool_slot_id_idx
  on private.signups (carpool_slot_id);

create index signups_created_by_user_id_idx
  on private.signups (created_by_user_id)
  where created_by_user_id is not null;

create table private.pickup_addresses (
  id bigint generated always as identity primary key,
  team_id bigint not null references private.teams(id) on delete restrict,
  child_or_family_name text not null,
  address_text text not null,
  edit_token_hash text not null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint pickup_addresses_name_not_blank check (btrim(child_or_family_name) <> ''),
  constraint pickup_addresses_address_not_blank check (btrim(address_text) <> ''),
  constraint pickup_addresses_edit_token_hash_not_blank check (btrim(edit_token_hash) <> '')
);

create index pickup_addresses_team_id_idx
  on private.pickup_addresses (team_id);

create index pickup_addresses_active_team_name_idx
  on private.pickup_addresses (team_id, child_or_family_name)
  where archived_at is null;

create index pickup_addresses_created_by_user_id_idx
  on private.pickup_addresses (created_by_user_id)
  where created_by_user_id is not null;

create table private.access_tokens (
  id bigint generated always as identity primary key,
  team_id bigint not null references private.teams(id) on delete restrict,
  purpose text not null,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  constraint access_tokens_token_hash_key unique (token_hash),
  constraint access_tokens_purpose_check check (purpose in ('web', 'ics', 'admin')),
  constraint access_tokens_hash_not_blank check (btrim(token_hash) <> ''),
  constraint access_tokens_expiration_order check (
    expires_at is null or expires_at > created_at
  )
);

create index access_tokens_team_id_idx
  on private.access_tokens (team_id);

create index access_tokens_active_team_purpose_idx
  on private.access_tokens (team_id, purpose)
  where revoked_at is null;

create table private.sync_issues (
  id bigint generated always as identity primary key,
  source_event_id bigint not null references private.source_events(id) on delete restrict,
  team_event_id bigint references private.team_events(id) on delete restrict,
  issue_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint sync_issues_type_check check (
    issue_type in (
      'multiple_team_matches',
      'event_no_longer_matches',
      'source_event_cancelled',
      'sync_failure'
    )
  )
);

create unique index sync_issues_one_open_type_per_event_idx
  on private.sync_issues (source_event_id, issue_type)
  where resolved_at is null;

create index sync_issues_source_event_id_idx
  on private.sync_issues (source_event_id);

create index sync_issues_team_event_id_idx
  on private.sync_issues (team_event_id)
  where team_event_id is not null;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger teams_set_updated_at
before update on private.teams
for each row execute function private.set_updated_at();

create trigger team_seasons_set_updated_at
before update on private.team_seasons
for each row execute function private.set_updated_at();

create trigger calendar_sources_set_updated_at
before update on private.calendar_sources
for each row execute function private.set_updated_at();

create trigger calendar_rules_set_updated_at
before update on private.calendar_rules
for each row execute function private.set_updated_at();

create trigger source_events_set_updated_at
before update on private.source_events
for each row execute function private.set_updated_at();

create trigger team_events_set_updated_at
before update on private.team_events
for each row execute function private.set_updated_at();

create trigger carpool_slots_set_updated_at
before update on private.carpool_slots
for each row execute function private.set_updated_at();

create trigger signups_set_updated_at
before update on private.signups
for each row execute function private.set_updated_at();

create trigger pickup_addresses_set_updated_at
before update on private.pickup_addresses
for each row execute function private.set_updated_at();

create trigger sync_issues_set_updated_at
before update on private.sync_issues
for each row execute function private.set_updated_at();

alter table private.teams enable row level security;
alter table private.teams force row level security;
alter table private.team_seasons enable row level security;
alter table private.team_seasons force row level security;
alter table private.calendar_sources enable row level security;
alter table private.calendar_sources force row level security;
alter table private.calendar_rules enable row level security;
alter table private.calendar_rules force row level security;
alter table private.source_events enable row level security;
alter table private.source_events force row level security;
alter table private.team_events enable row level security;
alter table private.team_events force row level security;
alter table private.carpool_slots enable row level security;
alter table private.carpool_slots force row level security;
alter table private.signups enable row level security;
alter table private.signups force row level security;
alter table private.pickup_addresses enable row level security;
alter table private.pickup_addresses force row level security;
alter table private.access_tokens enable row level security;
alter table private.access_tokens force row level security;
alter table private.sync_issues enable row level security;
alter table private.sync_issues force row level security;

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant select, insert, update, delete on all tables in schema private to service_role;
grant usage, select on all sequences in schema private to service_role;
grant execute on function private.set_updated_at() to service_role;

alter default privileges for role postgres in schema private
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema private
  grant usage, select on sequences to service_role;

insert into private.teams (
  slug,
  display_name,
  short_code,
  page_path,
  theme
)
values
  (
    'blue-pumas',
    'Blue Pumas',
    'BP',
    '/bluepuma/',
    '{"primary":"#102A43","accent":"#35B8D0","highlight":"#F6DC65"}'::jsonb
  ),
  (
    'red-tigers',
    'Red Tigers',
    'RT',
    '/redtigers/',
    '{"primary":"#7F1D1D","accent":"#DC3C3C","highlight":"#F6DC65"}'::jsonb
  );

insert into private.team_seasons (
  team_id,
  label,
  starts_on,
  ends_on
)
select
  id,
  'Fall 2026',
  date '2026-09-01',
  date '2026-11-30'
from private.teams
where slug in ('blue-pumas', 'red-tigers');
