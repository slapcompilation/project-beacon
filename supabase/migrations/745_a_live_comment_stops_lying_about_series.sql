-- 745 — a live comment stops lying about series.
--
-- The COMMENT 629 wrote onto `object_type_capabilities` ends: "The list-shaped
-- Time series panel is not built: no base type admits a series, and its table
-- was a pre-teardown orphan dropped by 628."
--
-- "No base type admits a series" has been false since 408, which put
-- `time_series` and `geotemporal_series` among the twenty-two —
-- `property_base_types()` returns true for both today. 628's own DO block
-- asserted the COUNT of the set and never its membership, which is how the
-- claim survived: an assertion that counts a catalogue proves the catalogue
-- has a size. The half about the panel is still true — the Time series panel
-- is not built, and that work is queued behind its reading (8 of 42 pages
-- read) — so the comment keeps that half and loses the false premise.
--
-- Applied migrations are immutable; a comment is not part of one, so this is
-- the one correction that CAN land in place. A false live comment is read
-- next session as fact, which is why it ranks a migration at all.

COMMENT ON TABLE public.object_type_capabilities IS
  'An object type nominating its properties against platform capability slots — what type classes became. Slot-based panels only. The list-shaped Time series panel is not built YET: its reading is incomplete (8 of 42 time-series pages read), not because the base types are missing — time_series and geotemporal_series have been among the twenty-two since 408. 629''s earlier claim here that "no base type admits a series" was false when written; 628 asserted the set''s count, never its membership. Corrected 745.';

-- ── PROVED BY DOING — the comment agrees with the catalogue it describes ────

DO $$
DECLARE c text;
BEGIN
  SELECT obj_description('public.object_type_capabilities'::regclass) INTO c;
  -- The corrected text QUOTES the false claim while refuting it, so the probe
  -- asks for the refutation rather than the phrase's absence.
  IF c NOT LIKE '%was false when written%' OR c NOT LIKE '%Corrected 745%' THEN
    RAISE EXCEPTION 'the correction did not land: %', c;
  END IF;
  IF NOT ('time_series' = ANY (public.property_base_types())
          AND 'geotemporal_series' = ANY (public.property_base_types())) THEN
    RAISE EXCEPTION 'the corrected comment would itself be false — the series types are not in the set';
  END IF;
END $$;
