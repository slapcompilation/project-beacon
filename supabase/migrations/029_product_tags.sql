-- Feature: Multi-tag support on products
-- Mirrors Sortly's tags array — each product can have multiple free-form labels
-- independent of its single category_id FK. Useful for cross-cutting concerns
-- like "Bar", "Kitchen", "Premium", "Seasonal", "Allergen".

alter table products
  add column if not exists tags text[] not null default '{}';

comment on column products.tags is 'Free-form tags for cross-cutting classification (e.g. ["Bar","Premium"])';

-- GIN index for fast array containment queries
create index if not exists idx_products_tags on products using gin(tags);
