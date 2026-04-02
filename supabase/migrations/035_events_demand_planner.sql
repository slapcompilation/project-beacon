-- Migration 035: Event Demand Planner
-- Stores hotel events (conferences, weddings, large bookings) so the system
-- can pre-calculate consumption gaps and generate event-specific POs.

create table if not exists events (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid not null references hotels(id) on delete cascade,
  name          text not null,
  event_date    date not null,
  guest_count   integer not null check (guest_count > 0),
  event_type    text not null default 'general',
  -- multiplier applied to avg daily consumption to estimate event demand
  -- e.g. 2.5 means expect 2.5× normal daily consumption per guest
  demand_factor numeric(4,2) not null default 1.0,
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column events.event_type is
  'e.g. conference, wedding, gala, sports, concert, general';

comment on column events.demand_factor is
  'Multiplier on avg_daily consumption for this event type. 1.0 = baseline, 2.0 = double usage.';

-- RLS
alter table events enable row level security;

create policy "events_select" on events for select  using (hotel_id = auth_hotel_id());
create policy "events_insert" on events for insert  with check (hotel_id = auth_hotel_id());
create policy "events_update" on events for update  using (hotel_id = auth_hotel_id());
create policy "events_delete" on events for delete  using (hotel_id = auth_hotel_id());

-- Auto-update updated_at
create or replace function update_events_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_events_updated_at
  before update on events
  for each row execute procedure update_events_updated_at();

-- Index for hotel+date queries
create index if not exists idx_events_hotel_date on events(hotel_id, event_date);
