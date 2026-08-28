-- Keep the source calendar and team-event history intact while presenting
-- carpool coordination only for practices. The API and ICS functions apply
-- the practice-only filter; this migration updates the surviving slot label.
update private.carpool_slots slot
set label = 'To practice'
from private.team_events team_event
join private.team_seasons season on season.id = team_event.team_season_id
join private.teams team on team.id = season.team_id
join private.source_events source_event on source_event.id = team_event.source_event_id
where slot.team_event_id = team_event.id
  and slot.direction = 'to_event'
  and team.slug in ('blue-pumas', 'red-tigers')
  and source_event.title ilike 'Practice:%'
  and slot.label is distinct from 'To practice';
