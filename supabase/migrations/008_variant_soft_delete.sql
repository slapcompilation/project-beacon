-- ─────────────────────────────────────────────────────────────────────────────
-- Project Beacon — Variant Soft Delete
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- Add enabled flag to product_variants (mirrors products.enabled pattern).
-- Disabled variants are hidden from UI but preserved so stock_log FKs stay valid.
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
