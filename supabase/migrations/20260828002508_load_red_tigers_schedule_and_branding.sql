-- Configure the shared board branding and load Sofia's Red Tigers schedule.
-- The connected LMFC calendar identifies this team as "2014 Girls Premier".
-- All-day placeholders are retained for sync traceability but held for review
-- until a specific carpool time is available.

update private.teams
set theme = case slug
  when 'blue-pumas' then jsonb_build_object(
    'primary', '#102A43',
    'primaryDeep', '#091C2D',
    'accent', '#35B8D0',
    'accentSoft', '#D8F4F7',
    'highlight', '#F6DC65',
    'highlightSoft', '#FFF8D6',
    'calendarAccent', '#FF6B5E',
    'logoPath', './assets/blue-puma-logo.png'
  )
  when 'red-tigers' then jsonb_build_object(
    'primary', '#4B1029',
    'primaryDeep', '#24072F',
    'accent', '#F21D2F',
    'accentSoft', '#FFE2E4',
    'highlight', '#F5C542',
    'highlightSoft', '#FFF4C4',
    'calendarAccent', '#F21D2F',
    'logoPath', './assets/red-tiger-logo.png'
  )
  else theme
end,
updated_at = now()
where slug in ('blue-pumas', 'red-tigers');

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
  '2014 Girls Premier',
  false
from private.team_seasons season
join private.teams team on team.id = season.team_id
cross join private.calendar_sources source
where team.slug = 'red-tigers'
  and season.label = 'Fall 2026'
  and source.provider = 'google'
  and source.external_calendar_id = '6j59fn1d7l4kddoiv8lc7v7qtiu9tpu9@import.calendar.google.com'
on conflict (team_season_id, calendar_source_id, match_kind, match_value) do update
set case_sensitive = excluded.case_sensitive,
    active = true;

with desired_events (
  external_event_id,
  title,
  all_day,
  starts_at,
  ends_at,
  starts_on,
  ends_on,
  location,
  recurring_event_id,
  original_start_at
) as (
  values
    ('_6pgjecpo6co3cb9jc8s3ab9k69j3gbb26or3eb9o64s3ep9h75h3gdj1ck', 'Pre-Season Camp (2014 Girls Premier)', false, '2026-08-31T17:00:00-04:00'::timestamptz, '2026-08-31T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park Alma', null, null::timestamptz),
    ('_74sm4phk60p66b9i6gq34b9k6kr68b9pckqm4b9nc4p38opp6ph62c1m68', 'Practice: 2014 Girls Premier (Soccer Roof)', false, '2026-09-09T16:00:00-04:00'::timestamptz, '2026-09-09T17:00:00-04:00'::timestamptz, null::date, null::date, 'Soccer Roof, 29 Lecount Pl 3rd Floor, New Rochelle, NY 10801', null, null::timestamptz),
    ('_c9ijaor260r32b9icor62b9k6dim4b9p61ijib9pcoq64e1h6somaoj16o', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-09-10T18:15:00-04:00'::timestamptz, '2026-09-10T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_70r6cpb365h62b9hc9gjgb9k74rm4bb274sjab9i64q6copg6kr3achjck', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-09-14T18:15:00-04:00'::timestamptz, '2026-09-14T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_6lj34dj66som4b9l6crm8b9kchi38bb268s34b9g6pi36c9ickrj4c1pc8', 'Practice: 2014 Girls Premier (Soccer Roof)', false, '2026-09-16T16:00:00-04:00'::timestamptz, '2026-09-16T17:00:00-04:00'::timestamptz, null::date, null::date, 'Soccer Roof, 29 Lecount Pl 3rd Floor, New Rochelle, NY 10801', null, null::timestamptz),
    ('_cdgjed1h64om4b9o64sjgb9kchi6abb2c9gjebb3cdgj8d32cph38or674', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-09-17T18:15:00-04:00'::timestamptz, '2026-09-17T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_ccsm6ohlckr3ab9p6gp34b9kc8pjebb1c4s68b9o6gr3icho6dhj6o9jcc', '2014 Girls Premier vs Manhattan SC Pre-ECNL G2014/15', false, '2026-09-19T13:30:00-04:00'::timestamptz, '2026-09-19T14:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma', null, null::timestamptz),
    ('_74smceb2cpj6cbb368s3ab9k65j66bb168o62bb66hgm6opjclgjep9mc4', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-09-21T18:15:00-04:00'::timestamptz, '2026-09-21T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_68r3eohpcksj6b9g60s62b9kchj6abb16tj6abb264pjcdb670r32cpi6c', 'Practice: 2014 Girls Premier (Soccer Roof)', false, '2026-09-23T16:00:00-04:00'::timestamptz, '2026-09-23T17:00:00-04:00'::timestamptz, null::date, null::date, 'Soccer Roof, 29 Lecount Pl 3rd Floor, New Rochelle, NY 10801', null, null::timestamptz),
    ('_6gsjgo9pclgm6b9lcgr3cb9k60q32bb2ccsj8bb66tj3ephj68p3ip31co', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-09-24T18:15:00-04:00'::timestamptz, '2026-09-24T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_71j6cd9ockr6cbb56th32b9k64p3cbb1ckr64b9m6hi3cdpjcopj6p1l70', '2014 Girls Premier at DUSC Girls 2013/2014 GA II', false, '2026-09-27T15:00:00-04:00'::timestamptz, '2026-09-27T16:00:00-04:00'::timestamptz, null::date, null::date, 'Randall''s Island - 83', null, null::timestamptz),
    ('_cgpmcc356cr3gbb2ckr32b9k6crj6bb1ccpj0b9kcdi30dpj61i64chh6o', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-09-28T18:15:00-04:00'::timestamptz, '2026-09-28T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_c8r3idpi64r64b9l6spj6b9k6cp64b9p69h6ab9kcphmap356li64phi6g', '2014 Girls Premier at Success Academy Soccer Program SA 2013/14G - Showcase', true, null::timestamptz, null::timestamptz, '2026-09-29'::date, '2026-09-30'::date, 'TBD', null, null::timestamptz),
    ('_74rm6e9o6di66b9kc9hj6b9k65i38bb26kq64bb5cks6apj1c9ijcp1p6c', 'Practice: 2014 Girls Premier (Soccer Roof)', false, '2026-09-30T16:00:00-04:00'::timestamptz, '2026-09-30T17:00:00-04:00'::timestamptz, null::date, null::date, 'Soccer Roof, 29 Lecount Pl 3rd Floor, New Rochelle, NY 10801', null, null::timestamptz),
    ('_60r30cb1c9gjeb9icdj34b9k70p32bb2cksm8bb165i3edb674o66e1n6k', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-10-01T18:15:00-04:00'::timestamptz, '2026-10-01T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_6cs3ep9p6gr36b9j68pj0b9kc4r64bb1c8q3eb9lcopjio9j6go62oppcg', '2014 Girls Premier vs Manhattan SC Westchester Legacy G2013/14 Red', false, '2026-10-03T13:30:00-04:00'::timestamptz, '2026-10-03T14:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma', null, null::timestamptz),
    ('_6hijepb36cpm6b9gchhj8b9k60s64bb2cdgjebb4cpi32d9nchh32cj560', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-10-05T18:15:00-04:00'::timestamptz, '2026-10-05T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_6gqj4p9oc9hj0bb46di64b9k6lgm4b9pc4om8b9p64q6ao9n6sq32dhkc4', 'Practice: 2014 Girls Premier (Soccer Roof)', false, '2026-10-07T16:00:00-04:00'::timestamptz, '2026-10-07T17:00:00-04:00'::timestamptz, null::date, null::date, 'Soccer Roof, 29 Lecount Pl 3rd Floor, New Rochelle, NY 10801', null, null::timestamptz),
    ('_6himco9l74oj8b9l6osj8b9k70qjgb9o70s36bb26gqjedpgcor6cpj3cc', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-10-08T18:15:00-04:00'::timestamptz, '2026-10-08T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_clj34p336kpj4bb56gqm8b9kclj36bb2cgs62b9h61hmcdj36so36cj4c4', 'FC Force Tournament (2014 Girls Premier)', true, null::timestamptz, null::timestamptz, '2026-10-11'::date, '2026-10-12'::date, 'tbd, MW High School 155 Dunderberg Road Central Valley, NY 10917', null, null::timestamptz),
    ('_cgs36p1n6oq68b9i68q34b9k64s6cb9p6grmabb3cksjep356gpjidj6cc', 'Practice: 2014 Girls Premier (Soccer Roof)', false, '2026-10-14T16:00:00-04:00'::timestamptz, '2026-10-14T17:00:00-04:00'::timestamptz, null::date, null::date, 'Soccer Roof, 29 Lecount Pl 3rd Floor, New Rochelle, NY 10801', null, null::timestamptz),
    ('_60sjacr470p36b9hcko3gb9k6gs30b9ocoom6b9lc8oj6dj174o62chg6s', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-10-15T18:15:00-04:00'::timestamptz, '2026-10-15T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_6dhm2cpocgq30bb565h30b9kc4r3ib9o61h68b9o71ij0e9pclh62oj16c', '2014 Girls Premier at Chelsea Piers Chelsea Piers SC G2013-14', true, null::timestamptz, null::timestamptz, '2026-10-17'::date, '2026-10-18'::date, 'TBD', null, null::timestamptz),
    ('_cgo6aohhc4rj2bb371gjeb9k6li6abb26oo6cbb561j3ed9mcoq3gd9kc4', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-10-19T18:15:00-04:00'::timestamptz, '2026-10-19T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_65ij4opp68s3gb9gc8r36b9k68oj6bb16os62bb16orjao9kclhjichmck', 'Practice: 2014 Girls Premier (Soccer Roof)', false, '2026-10-21T16:00:00-04:00'::timestamptz, '2026-10-21T17:00:00-04:00'::timestamptz, null::date, null::date, 'Soccer Roof, 29 Lecount Pl 3rd Floor, New Rochelle, NY 10801', null, null::timestamptz),
    ('_68p38db1ckpj4b9m71i64b9k69j38bb26so3cb9l6kq6ao9j6gsmap9h74', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-10-22T18:15:00-04:00'::timestamptz, '2026-10-22T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_60s68chk6gq38bb265gjab9kc8pj4b9p6gp3gbb2cor36o9pc4s3ed9o6o', '2014 Girls Premier vs Fox Soccer Academy Premier FSA Nirvana 2013/14', false, '2026-10-24T16:45:00-04:00'::timestamptz, '2026-10-24T17:45:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma', null, null::timestamptz),
    ('_ckpj4chg75gj6b9nc4p38b9k6hhmab9o64pm8bb6chijephk6cpmcchh60', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-10-26T18:15:00-04:00'::timestamptz, '2026-10-26T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_6gs62c9n6kojgb9n71h38b9k68p62b9pcgs3ibb6cgpjior369ijcpb160', 'Practice: 2014 Girls Premier (Soccer Roof)', false, '2026-10-28T16:00:00-04:00'::timestamptz, '2026-10-28T17:00:00-04:00'::timestamptz, null::date, null::date, 'Soccer Roof, 29 Lecount Pl 3rd Floor, New Rochelle, NY 10801', null, null::timestamptz),
    ('_74s38c1lcos68b9m74oj4b9k70pjabb16krjcb9g6pj3iopo64r62cb1co', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-10-29T18:15:00-04:00'::timestamptz, '2026-10-29T19:30:00-04:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_chgj4db2cpj66bb5ccrm6b9kcor62bb1c5ijcbb3ccpj8d9g60rj8db6c4', '2014 Girls Premier at Chelsea Piers SC Celtic', false, '2026-10-31T11:30:00-04:00'::timestamptz, '2026-10-31T12:30:00-04:00'::timestamptz, null::date, null::date, 'Greenwich Academy - Field 1 - Greenwich Academy Field 1', null, null::timestamptz),
    ('_6hhmap3674rjeb9pcgo68b9k61h32b9o75i34b9j6lgjcd1k74r6cc1l64', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-11-02T18:15:00-05:00'::timestamptz, '2026-11-02T19:30:00-05:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_6crm6o9m6dh3ib9l6kpjeb9kc9i62bb160rj4b9m68r36or46osjcp9i6o', 'Practice: 2014 Girls Premier (Soccer Roof)', false, '2026-11-04T16:00:00-05:00'::timestamptz, '2026-11-04T17:00:00-05:00'::timestamptz, null::date, null::date, 'Soccer Roof, 29 Lecount Pl 3rd Floor, New Rochelle, NY 10801', null, null::timestamptz),
    ('_c8sjaopn6sp3ib9oclj66b9k75i36b9oc8s32bb26tj64c1lccojecj5cg', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-11-05T18:15:00-05:00'::timestamptz, '2026-11-05T19:30:00-05:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_68om8p1l60q6cb9k6thj6b9kckrj4b9o70r62bb2chi6ad1h6gr32o9pcg', '2014 Girls Premier vs Gotham Girls 2013/2014 Courage', false, '2026-11-07T13:30:00-05:00'::timestamptz, '2026-11-07T14:30:00-05:00'::timestamptz, null::date, null::date, 'Flint Park - Alma', null, null::timestamptz),
    ('_6dgj0d1p6goj4b9n6phmab9k6phmab9oc8r30b9j60qjepj2cgo38c9j6c', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-11-09T18:15:00-05:00'::timestamptz, '2026-11-09T19:30:00-05:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_chj32eb56grjab9h6gpm2b9k65i30bb1ccojgbb461hmacr4c4r3go9j60', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-11-12T18:15:00-05:00'::timestamptz, '2026-11-12T19:30:00-05:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_chijcp1gccs6cb9kc9gjib9kccpjibb264q3gb9k6dj30cpp6pij8db164', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-11-16T18:15:00-05:00'::timestamptz, '2026-11-16T19:30:00-05:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_74qjaohncgqj8b9n6os68b9k64rjeb9oc4q6ab9jcgr3gpb36lh62d346s', 'Practice: 2014 Girls Premier (Soccer Roof)', false, '2026-11-18T16:00:00-05:00'::timestamptz, '2026-11-18T17:00:00-05:00'::timestamptz, null::date, null::date, 'Soccer Roof, 29 Lecount Pl 3rd Floor, New Rochelle, NY 10801', null, null::timestamptz),
    ('_c4qm2p1k74r38bb260rj6b9k6krm8b9ocpj3cb9ic5h32p9gc8qjgc9i70', 'Practice: 2014 Girls Premier (Flint Park - Alma Turf)', false, '2026-11-19T18:15:00-05:00'::timestamptz, '2026-11-19T19:30:00-05:00'::timestamptz, null::date, null::date, 'Flint Park - Alma Turf, Larchmont Flint Park, Locust Ave, Larchmont, NY 10538', null, null::timestamptz),
    ('_68o3edpp70oj2b9j70r30b9k60s34bb26oqm6b9lccpjacpo6phmae1g6g', '2014 Girls Premier at Manhattan SC Pre-ECNL G2014/15', false, '2026-11-21T12:30:00-05:00'::timestamptz, '2026-11-21T13:30:00-05:00'::timestamptz, null::date, null::date, 'Randall''s Island - 83', null, null::timestamptz)
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
  starts_on,
  ends_on,
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
  event.all_day,
  event.starts_at,
  event.ends_at,
  event.starts_on,
  event.ends_on,
  nullif(event.location, ''),
  jsonb_build_object(
    'calendar_event_id', event.external_event_id,
    'source_team_name', '2014 Girls Premier'
  )
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
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
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
  case when event.all_day then 'needs_review' else 'listed' end
from private.calendar_rules rule
join private.calendar_sources source on source.id = rule.calendar_source_id
join private.source_events event on event.calendar_source_id = source.id
join private.team_seasons season on season.id = rule.team_season_id
join private.teams team on team.id = season.team_id
where team.slug = 'red-tigers'
  and season.label = 'Fall 2026'
  and rule.match_kind = 'title_contains'
  and rule.match_value = '2014 Girls Premier'
  and event.status <> 'cancelled'
  and event.removed_at is null
  and event.title ilike '%2014 Girls Premier%'
on conflict (team_season_id, source_event_id) do update
set matched_rule_id = excluded.matched_rule_id,
    visibility = excluded.visibility;

insert into private.carpool_slots (team_event_id, direction, label, sort_order)
select event.id, slot.direction, slot.label, slot.sort_order
from private.team_events event
join private.team_seasons season on season.id = event.team_season_id
join private.teams team on team.id = season.team_id
join private.source_events source_event on source_event.id = event.source_event_id
cross join (
  values
    ('to_event', 'To event', 0::smallint),
    ('home', 'Home', 1::smallint)
) as slot(direction, label, sort_order)
where team.slug = 'red-tigers'
  and season.label = 'Fall 2026'
  and event.visibility = 'listed'
  and not source_event.all_day
on conflict (team_event_id, direction) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    active = true;

update private.calendar_sources
set last_synced_at = now(),
    last_error = null,
    consecutive_failures = 0
where provider = 'google'
  and external_calendar_id = '6j59fn1d7l4kddoiv8lc7v7qtiu9tpu9@import.calendar.google.com';
