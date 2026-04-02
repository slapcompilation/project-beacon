-- Unit of Measure on product_variants
-- Free-text field (e.g. "bottles", "kg", "cases", "rolls", "portions").
-- Empty string means no UoM is set (displays as bare number).
-- Intentionally free-text: hotel operators define their own units.

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS unit_of_measure text NOT NULL DEFAULT '';

COMMENT ON COLUMN product_variants.unit_of_measure IS
  'Human-readable unit label, e.g. "bottles", "kg", "cases". Empty = no unit displayed.';
