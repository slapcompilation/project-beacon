-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 161 — Phase K2: perishability primitive for waste_triage
--
-- waste_triage proposes WRITE_OFF for stock that will spoil before it's used.
-- But the ontology had no perishability signal — no shelf-life, expiry, or
-- perishable flag anywhere. Cron-wiring the agent without it would propose
-- writing off non-perishables (spirits never spoil) the moment they hold more
-- than a week's consumption. That's nonsensical, and WRITE_OFF is the most
-- destructive action type.
--
-- Add `shelf_life_days` to products: NULL = non-perishable (the default, so
-- spirits + sealed mixers are untouched); a positive integer = perishable with
-- that many days before spoilage. The waste cron scans only NOT-NULL rows.
--
-- Depends on: 159 (seed_demo_world catalogue)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS shelf_life_days int
    CHECK (shelf_life_days IS NULL OR shelf_life_days > 0);

COMMENT ON COLUMN products.shelf_life_days IS
  'Days before the item spoils once on hand. NULL = non-perishable (spirits, sealed goods). Drives the waste_triage candidate scan (K2).';

-- Seed perishability for the demo catalogue (both properties). Fresh items get
-- a short shelf life; spirits + sealed mixers stay NULL (non-perishable).
UPDATE products SET shelf_life_days = 5  WHERE name = 'Orange Juice';
UPDATE products SET shelf_life_days = 7  WHERE name = 'Lime';
