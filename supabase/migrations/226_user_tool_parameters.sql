-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 226 — authored tools take input parameters
--
-- Foundry's functions take input parameters. Ours had fixed filters, so
-- "count urgent requests" needed a separate tool per urgency: authoring one
-- question at a time instead of one question SHAPE.
--
-- A filter may now take its comparison value from a named parameter supplied at
-- call time. The parameter list is the tool's typed input schema — what an LLM
-- sees, and what the agent runtime validates a call against before it runs.
--
-- Grammar is CHECK-constrained here as well as in code: the database is the last
-- word on what a tool may be, not the composer.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_tools
  ADD COLUMN IF NOT EXISTS parameters jsonb NOT NULL DEFAULT '[]'::jsonb;

-- A CHECK may not contain a subquery, so the per-element grammar lives in an
-- IMMUTABLE pure function. Not SECURITY DEFINER: it touches no tables.
CREATE OR REPLACE FUNCTION public.user_tool_params_valid(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(p) = 'array' AND coalesce(bool_and(
      jsonb_typeof(e) = 'object'
      AND coalesce(e->>'key', '') ~ '^[a-z][a-z0-9_]*$'
      AND coalesce(e->>'type', '') IN ('text','number','boolean','date')
      AND jsonb_typeof(e->'required') = 'boolean'
    ), true)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p) = 'array' THEN p ELSE '[]'::jsonb END) e;
$$;

COMMENT ON FUNCTION public.user_tool_params_valid(jsonb) IS
  'Grammar for user_tools.parameters — every element is {key: lower_snake, type: text|number|boolean|date, required: bool}.';

ALTER TABLE public.user_tools DROP CONSTRAINT IF EXISTS user_tools_parameters_shape;
ALTER TABLE public.user_tools
  ADD CONSTRAINT user_tools_parameters_shape CHECK (public.user_tool_params_valid(parameters));

COMMENT ON COLUMN public.user_tools.parameters IS
  'Values the caller supplies at call time. A filter references one via its "param" key; the filter''s stored value is then the fallback for an optional parameter.';
