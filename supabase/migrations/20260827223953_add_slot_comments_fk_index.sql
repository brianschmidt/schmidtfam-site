-- Cover the full foreign-key column for relationship checks and future slot maintenance.

create index slot_comments_carpool_slot_id_idx
  on private.slot_comments (carpool_slot_id);
