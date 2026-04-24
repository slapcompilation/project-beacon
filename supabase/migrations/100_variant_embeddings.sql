-- Migration 100: Variant embeddings for similar_to edge computation
-- Enables pgvector similarity search across variant consumption profiles.
-- similar_to edges are written to relationship_edges after computation.
-- Edge function: supabase/functions/compute-similar-variants/index.ts

create extension if not exists vector;

create table if not exists variant_embeddings (
  variant_id   uuid        primary key references product_variants(id) on delete cascade,
  hotel_id     uuid        not null references hotels(id) on delete cascade,
  -- 1536-dim vector from text-embedding-ada-002 or text-embedding-3-small
  -- Input text: "{product_name} {variant_name} — avg_daily:{x} waste_rate:{y} category:{z}"
  embedding    vector(1536),
  computed_at  timestamptz not null default now()
);

-- IVFFlat index for approximate nearest-neighbour cosine search
create index if not exists variant_embeddings_ivfflat
  on variant_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

create index on variant_embeddings (hotel_id);

alter table variant_embeddings enable row level security;

create policy "hotel members can read embeddings" on variant_embeddings
  for select using (
    hotel_id = auth_hotel_id()
  );

-- Service role (edge functions) can insert/update
create policy "service role full access" on variant_embeddings
  using (true) with check (true);
