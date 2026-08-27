-- Add chronological parent comment threads to each carpool segment.

create table private.slot_comments (
  id bigint generated always as identity primary key,
  carpool_slot_id bigint not null references private.carpool_slots(id) on delete restrict,
  author_name text not null,
  body text not null,
  edit_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint slot_comments_author_not_blank check (btrim(author_name) <> ''),
  constraint slot_comments_author_length check (char_length(author_name) <= 60),
  constraint slot_comments_body_not_blank check (btrim(body) <> ''),
  constraint slot_comments_body_length check (char_length(body) <= 500),
  constraint slot_comments_edit_token_hash_not_blank check (btrim(edit_token_hash) <> '')
);

create index slot_comments_active_slot_created_idx
  on private.slot_comments (carpool_slot_id, created_at, id)
  where deleted_at is null;

create trigger slot_comments_set_updated_at
before update on private.slot_comments
for each row execute function private.set_updated_at();

alter table private.slot_comments enable row level security;
alter table private.slot_comments force row level security;

revoke all on private.slot_comments from public, anon, authenticated, service_role;
revoke all on sequence private.slot_comments_id_seq from public, anon, authenticated, service_role;

grant select, insert, update on private.slot_comments to service_role;
grant usage, select on sequence private.slot_comments_id_seq to service_role;
