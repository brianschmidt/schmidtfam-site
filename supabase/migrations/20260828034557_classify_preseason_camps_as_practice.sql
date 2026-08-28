-- Camps are practice sessions for carpool purposes even though the source
-- calendar title does not begin with the standard "Practice:" prefix.
update private.carpool_slots slot
set label = 'To practice'
from private.team_events team_event
join private.source_events source_event on source_event.id = team_event.source_event_id
where slot.team_event_id = team_event.id
  and slot.direction = 'to_event'
  and source_event.title ilike 'Pre-Season Camp%'
  and slot.label is distinct from 'To practice';
