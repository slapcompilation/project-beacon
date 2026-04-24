-- Migration 099: Copilot feedback + eval fixtures
-- Palantir Principle: AI transparency + eval-before-ship
-- Operators rate copilot answers; negative ratings capture corrections
-- that feed back into the eval test suite.

create table if not exists copilot_feedback (
  id              uuid        primary key default gen_random_uuid(),
  hotel_id        uuid        not null references hotels(id) on delete cascade,
  actor_id        uuid        references auth.users(id) on delete set null,
  query           text        not null,
  answer          text        not null,
  tools_called    text[]      not null default '{}',
  graph_hops_total int        not null default 0,
  rating          smallint    not null check (rating in (-1, 1)), -- 1 = helpful, -1 = wrong
  correction      text,                                           -- operator correction when rating = -1
  created_at      timestamptz not null default now()
);

create index on copilot_feedback (hotel_id, created_at desc);
create index on copilot_feedback (hotel_id, rating, created_at desc);

alter table copilot_feedback enable row level security;

create policy "hotel members can insert feedback" on copilot_feedback
  for insert with check (
    hotel_id = auth_hotel_id()
  );

create policy "hotel admins can read feedback" on copilot_feedback
  for select using (
    hotel_id = auth_hotel_id()
    and auth_role() in ('admin', 'owner')
  );
