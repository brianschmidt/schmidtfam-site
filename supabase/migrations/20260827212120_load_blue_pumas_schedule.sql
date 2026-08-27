-- Load the first Blue Pumas schedule snapshot from the connected family calendar.
-- The calendar source and title rule are shared infrastructure for later sync jobs.

insert into private.calendar_sources (
  provider,
  external_calendar_id,
  display_name,
  timezone,
  credential_secret_name,
  last_synced_at
)
values (
  'google',
  '6j59fn1d7l4kddoiv8lc7v7qtiu9tpu9@import.calendar.google.com',
  'LMFC Soccer - Schmidt - 2024-2025 Season',
  'America/New_York',
  'GOOGLE_CALENDAR_REFRESH_TOKEN',
  now()
)
on conflict (provider, external_calendar_id) do update
set display_name = excluded.display_name,
    timezone = excluded.timezone,
    credential_secret_name = excluded.credential_secret_name,
    last_synced_at = excluded.last_synced_at,
    last_error = null,
    consecutive_failures = 0,
    active = true;

insert into private.calendar_rules (
  team_season_id,
  calendar_source_id,
  match_kind,
  match_value,
  case_sensitive
)
select
  season.id,
  source.id,
  'title_contains',
  'Blue Puma',
  false
from private.team_seasons season
join private.teams team on team.id = season.team_id
cross join private.calendar_sources source
where team.slug = 'blue-pumas'
  and season.label = 'Fall 2026'
  and source.provider = 'google'
  and source.external_calendar_id = '6j59fn1d7l4kddoiv8lc7v7qtiu9tpu9@import.calendar.google.com'
on conflict (team_season_id, calendar_source_id, match_kind, match_value) do update
set case_sensitive = excluded.case_sensitive,
    active = true;

with desired_events (
  external_event_id,
  title,
  starts_at,
  ends_at,
  location,
  recurring_event_id,
  original_start_at
) as (
  values
    ('_6ss3id9j6limabb474omab9k74o3ab9o71h6cb9m6pi3gdb66gsj2ohn74', 'Practice: Blue Pumas (Harbor Island)', '2026-09-10T15:30:00-04:00'::timestamptz, '2026-09-10T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_ccs36opj6dgjibb2cos6ab9kcdgjab9p6so64bb36ti38e9n6srj2pj2c4', 'Blue Pumas vs Harrison Wave', '2026-09-13T16:15:00-04:00'::timestamptz, '2026-09-13T17:45:00-04:00'::timestamptz, 'Harbor Island Park - Croce West', null, null::timestamptz),
    ('_6lh66phjcoojab9m6cq36b9k60ojgbb1cgpjib9h6kq34p9j6lj3goj1co', 'Practice: Blue Pumas (Harbor Island)', '2026-09-14T15:30:00-04:00'::timestamptz, '2026-09-14T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_60r30d33cgr64bb4cdh3eb9k60p6cbb16oo34b9gc8q68c9hcoqj4e9m6c', 'Practice: Blue Pumas (Harbor Island)', '2026-09-17T15:30:00-04:00'::timestamptz, '2026-09-17T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_6lgjeeb2chh38b9o6hh36b9kc9h6cb9pcoojib9icor32opjccs3ce9mco', 'Blue Pumas vs Manhattan SC Albion G2017/18', '2026-09-20T10:15:00-04:00'::timestamptz, '2026-09-20T11:45:00-04:00'::timestamptz, 'Harbor Island Park - 5', null, null::timestamptz),
    ('_6lh3ac9iccq62b9g6pijab9k74s6cbb2c4r32b9p6kqm4pj56sr3gchmco', 'Practice: Blue Pumas (Harbor Island)', '2026-09-21T15:30:00-04:00'::timestamptz, '2026-09-21T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_6spj2dr565gjgbb46pj3gb9kccq3cbb1cdgj0bb2cop68or674rmad1h6c', 'Practice: Blue Pumas (Harbor Island)', '2026-09-24T15:30:00-04:00'::timestamptz, '2026-09-24T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_ckr36d1gckr36b9nchi64b9kc8o66b9p6kpm8b9gcorj4cj374rjacpgcc', 'Blue Pumas vs John Jay FC G2017 White', '2026-09-27T10:30:00-04:00'::timestamptz, '2026-09-27T12:00:00-04:00'::timestamptz, 'Harbor Island Park - 4', null, null::timestamptz),
    ('_61hm2dr5ccoj4bb474rjib9k75i68bb271gm6bb268qjgoph6sqj8dj56s', 'Practice: Blue Pumas (Harbor Island)', '2026-09-28T15:30:00-04:00'::timestamptz, '2026-09-28T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_6kr30cr661i30b9mchij4b9k75gm6bb16gr3gb9k6kq66c9i6sqj6pj6c8', 'Practice: Blue Pumas (Harbor Island)', '2026-10-01T15:30:00-04:00'::timestamptz, '2026-10-01T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_6cpj6cj5c4r30b9k6lj30b9k70qjgbb165hjeb9ncpi30d9nc4r3icr26g', 'Blue Pumas at Hillcrest FC Hurricanes', '2026-10-04T11:30:00-04:00'::timestamptz, '2026-10-04T13:00:00-04:00'::timestamptz, 'Rory O''Moore - Field 1', null, null::timestamptz),
    ('_ccq3id32ckp6ab9h6pgjib9kccs3ib9o6ksmcb9hc4q6cor3c8qm6o9k60', 'Practice: Blue Pumas (Harbor Island)', '2026-10-05T15:30:00-04:00'::timestamptz, '2026-10-05T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_cdijcchpcoo36b9kc8sjcb9k6sq3ab9p64q34bb66pim8ob56hhj4dhk6s', 'Practice: Blue Pumas (Harbor Island)', '2026-10-08T15:30:00-04:00'::timestamptz, '2026-10-08T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_6dgj6or16csjab9l74r3gb9k6lj36bb169gjgbb4cgr64dhmccpj6p9l70', 'Practice: Blue Pumas (Harbor Island)', '2026-10-12T15:30:00-04:00'::timestamptz, '2026-10-12T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_68pm2p9i61hmabb5cgsjib9k68q68b9pc8oj4b9o74rjcchm6or66d9g70', 'Practice: Blue Pumas (Harbor Island)', '2026-10-15T15:30:00-04:00'::timestamptz, '2026-10-15T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_68r68cb16ss3cb9m6cq6cb9k70rmcbb261j68b9o70o3cd316com2pj66s', 'Blue Pumas at Scarsdale Rangers', '2026-10-18T15:15:00-04:00'::timestamptz, '2026-10-18T16:45:00-04:00'::timestamptz, 'Crossway - 5', null, null::timestamptz),
    ('_c4q6ce9j65j38b9i6spj4b9k74qm2bb2c4o3cb9gcko3ap1l6gpmcchg6k', 'Practice: Blue Pumas (Harbor Island)', '2026-10-19T15:30:00-04:00'::timestamptz, '2026-10-19T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_65gm2p1g6lj32b9h6ti32b9k64sm8b9p70om2b9k6kr3aphmc8s6ae9l70', 'Practice: Blue Pumas (Harbor Island)', '2026-10-22T15:30:00-04:00'::timestamptz, '2026-10-22T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_ccq34pb3cgpjab9m6gq3gb9k6tijgb9p6tj68b9o60p6cohnckqj8oj368', 'Blue Pumas vs Eastchester Legacy', '2026-10-25T12:00:00-04:00'::timestamptz, '2026-10-25T13:30:00-04:00'::timestamptz, 'Harbor Island Park - Croce West', null, null::timestamptz),
    ('_6th68p1g6oqm8bb670pm8b9k74o6cbb270o32b9n71im6pb364s64dpn6g', 'Practice: Blue Pumas (Harbor Island)', '2026-10-26T15:30:00-04:00'::timestamptz, '2026-10-26T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_74r6ap3275h68bb475gj6b9kccr3ib9o64pjib9mcdim4e9h70sm6ob3co', 'Practice: Blue Pumas (Harbor Island)', '2026-10-29T15:30:00-04:00'::timestamptz, '2026-10-29T16:45:00-04:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_64s3cor360o32b9n6li3eb9k60p34bb2cgr36b9m60p38e1mckqj4cb16c', 'Blue Pumas vs Armonk SC Pumas', '2026-11-01T12:00:00-05:00'::timestamptz, '2026-11-01T13:30:00-05:00'::timestamptz, 'Harbor Island Park - Croce East', null, null::timestamptz),
    ('_c8oj4d1o60rm4b9m6tj38b9k6kp3cbb1cgrm2bb4clhmcp33chi3ad1l64', 'Practice: Blue Pumas (Harbor Island)', '2026-11-02T15:30:00-05:00'::timestamptz, '2026-11-02T16:45:00-05:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_71hjgo9pc4r3ab9ncgr3eb9k6sq3cb9p74qj2bb4cgp64cb2cgo3copl6k', 'Practice: Blue Pumas (Harbor Island)', '2026-11-05T15:30:00-05:00'::timestamptz, '2026-11-05T16:45:00-05:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_74q3cpb2c9ij6b9m74s36b9k6co34bb26gqjab9g68pjiohl6kqj2pj668', 'Blue Pumas at Mahopac Stars', '2026-11-08T12:30:00-05:00'::timestamptz, '2026-11-08T14:00:00-05:00'::timestamptz, 'Airport Park - Field 3', null, null::timestamptz),
    ('_69hjeo9l6hj64bb3c4p38b9kc8o3abb2c8pm2bb574qjae1oc9gj8dhico', 'Practice: Blue Pumas (Harbor Island)', '2026-11-09T15:30:00-05:00'::timestamptz, '2026-11-09T16:45:00-05:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_c4s3ecpic5ijeb9l69gmcb9k6cr3ib9p6li3abb6cksjeob3c8sj2db268', 'Practice: Blue Pumas (Harbor Island)', '2026-11-12T15:30:00-05:00'::timestamptz, '2026-11-12T16:45:00-05:00'::timestamptz, 'Harbor Island', null, null::timestamptz),
    ('_6tj3edb6clim2bb468o3eb9k6tgmabb26op3cbb164s3id1h6pgmad31ck', 'Blue Pumas at Gotham Girls Sparks', '2026-11-15T14:30:00-05:00'::timestamptz, '2026-11-15T16:00:00-05:00'::timestamptz, 'Pier 40 - Pier 40 Rooftop', null, null::timestamptz)
),
source as (
  select id
  from private.calendar_sources
  where provider = 'google'
    and external_calendar_id = '6j59fn1d7l4kddoiv8lc7v7qtiu9tpu9@import.calendar.google.com'
)
insert into private.source_events (
  calendar_source_id,
  external_event_id,
  recurring_event_id,
  original_start_at,
  status,
  title,
  all_day,
  starts_at,
  ends_at,
  location,
  raw_payload
)
select
  source.id,
  event.external_event_id,
  event.recurring_event_id,
  event.original_start_at,
  'confirmed',
  event.title,
  false,
  event.starts_at,
  event.ends_at,
  nullif(event.location, ''),
  jsonb_build_object('calendar_event_id', event.external_event_id)
from desired_events event
cross join source
on conflict (calendar_source_id, external_event_id) do update
set recurring_event_id = excluded.recurring_event_id,
    original_start_at = excluded.original_start_at,
    status = excluded.status,
    title = excluded.title,
    all_day = excluded.all_day,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    starts_on = null,
    ends_on = null,
    location = excluded.location,
    removed_at = null,
    raw_payload = excluded.raw_payload;

insert into private.team_events (
  team_season_id,
  source_event_id,
  matched_rule_id,
  visibility
)
select
  rule.team_season_id,
  event.id,
  rule.id,
  'listed'
from private.calendar_rules rule
join private.calendar_sources source on source.id = rule.calendar_source_id
join private.source_events event on event.calendar_source_id = source.id
join private.team_seasons season on season.id = rule.team_season_id
join private.teams team on team.id = season.team_id
where team.slug = 'blue-pumas'
  and season.label = 'Fall 2026'
  and rule.match_kind = 'title_contains'
  and rule.match_value = 'Blue Puma'
  and event.status <> 'cancelled'
  and event.removed_at is null
  and event.title ilike '%Blue Puma%'
on conflict (team_season_id, source_event_id) do update
set matched_rule_id = excluded.matched_rule_id,
    visibility = excluded.visibility;

insert into private.carpool_slots (team_event_id, direction, label, sort_order)
select event.id, slot.direction, slot.label, slot.sort_order
from private.team_events event
join private.team_seasons season on season.id = event.team_season_id
join private.teams team on team.id = season.team_id
cross join (
  values
    ('to_event', 'To event', 0::smallint),
    ('home', 'Home', 1::smallint)
) as slot(direction, label, sort_order)
where team.slug = 'blue-pumas'
  and season.label = 'Fall 2026'
on conflict (team_event_id, direction) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    active = true;
