-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 268 — a model's output becomes a property of the object type.
--
-- Tier 3.3. The audit's finding (§3.4): a Variant has no projected_demand
-- property a model fills, so a forecast is visible only where somebody
-- explicitly called a tool. Meanwhile forecast_observations already holds 146
-- rows covering every variant — the number exists, it simply is not part of the
-- ontology.
--
-- Foundry's answer is that a model deployment POPULATES OBJECT PROPERTIES, and
-- the object type's backing datasource carries them. Ours is the same shape: the
-- `variant` type is repointed at a view that is product_variants plus its latest
-- forecast, so the forecast appears everywhere a Variant appears — in a cohort
-- filter, in an authored tool's aggregation, in the object view — without any
-- caller knowing a model was involved.
--
-- Latest-per-variant, not an average: a forecast is a statement about now, and
-- averaging it with last month's would produce a number that was never true.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE VIEW public.variant_ontology
WITH (security_invoker = true) AS
  SELECT v.*,
         f.projected_units  AS projected_demand,
         f.basis            AS forecast_basis,
         f.confidence       AS forecast_confidence,
         f.horizon_days     AS forecast_horizon_days,
         f.as_of            AS forecast_as_of
  FROM public.product_variants v
  LEFT JOIN LATERAL (
    SELECT fo.projected_units, fo.basis, fo.confidence, fo.horizon_days, fo.as_of
    FROM public.forecast_observations fo
    WHERE fo.variant_id = v.id
    ORDER BY fo.as_of DESC
    LIMIT 1
  ) f ON true;

COMMENT ON VIEW public.variant_ontology IS
  'The Variant object type''s datasource: product_variants plus the latest forecast for each. A model output that is not a property is invisible to cohorts, tools and object views — this is what makes it one.';

-- Repoint the object type at its new datasource, and derive the properties from
-- it so the forecast columns become real, filterable properties.
UPDATE public.object_types
   SET source_table = 'variant_ontology', updated_at = now()
 WHERE kind = 'builtin' AND api_name = 'variant';

UPDATE public.object_types t
   SET properties = public.derive_object_type_properties('variant_ontology'), updated_at = now()
 WHERE t.kind = 'builtin' AND t.api_name = 'variant';

-- The forecast must actually have arrived as a property; a binding that yields
-- nothing is worse than no binding, because a cohort would filter on a column
-- that is always null and report zero with confidence.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM object_types t, jsonb_array_elements(t.properties) p
  WHERE t.api_name = 'variant' AND t.kind = 'builtin'
    AND p->>'key' IN ('projected_demand','forecast_basis','forecast_confidence');
  IF n < 3 THEN
    RAISE EXCEPTION 'Migration 268: expected the 3 forecast properties on Variant, derived %', n;
  END IF;
END $$;

COMMIT;
