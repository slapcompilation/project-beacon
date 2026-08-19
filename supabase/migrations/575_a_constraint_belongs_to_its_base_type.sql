-- A regex constraint on an integer was accepted, and did nothing.
--
-- ── THE GAP ────────────────────────────────────────────────────────────────
-- `value_type_constraints` checks its own vocabulary and its own structure —
-- `kind` against eight tokens, `nested`/`element` against
-- `referenced_value_type_id`, `element` against `struct_field` — and never once
-- against the parent's `base_type`. `mint_value_type_version()` writes caller
-- JSON straight through. So a `regex` constraint on an `integer` value type is
-- stored happily, and `value_conforms()` — an interpreter, not a validator —
-- silently declines to apply it. No error at write, no error at read, no
-- validation.
--
-- Found by the 2026-08-19 gap run.
--
-- ── HOW FOUNDRY TREATS IT: THE PAIRING IS UNREPRESENTABLE ──────────────────
-- There is no rejection message anywhere in the value-types section, because
-- there is no way to author the mismatch. `create-value-type` orders the wizard
-- so the base type is chosen first:
--
--   "5. Choose a base type for your value type."
--   "6. (Optional) Define a constraint for your value type. Validators can be
--       regular expressions for `String` types, enums, ranges, or other
--       validation methods depending on the base type."
--
-- and `value-type-create-constraint.png` shows it is the PICKER that depends,
-- not the author: for a String value type the Constraint type control offers
-- exactly RID, UUID, Length, Regex and Enum. Uniqueness and Nested (Array) and
-- Element (Struct) are not rendered at all.
--
-- ── SO A TRIGGER IS NOT US BEING STRICTER THAN FOUNDRY ─────────────────────
-- It is the same guarantee at the layer where our authoring happens. Foundry's
-- enforcement point is its only authoring surface. Ours is
-- `mint_value_type_version()` taking caller JSON, and the generated client is
-- not the only writer — so the table is where "cannot be expressed" has to mean
-- something.
--
-- This is the OPPOSITE case to `readings/value-types.md` Decision 6, and the
-- distinction is worth keeping straight: that one is a property BINDING to a
-- value type, where the docs show Foundry lets you save a binding the data
-- violates, so a CHECK there would be stricter than Foundry. This is a value
-- type's own internal coherence, where Foundry is not permissive at all.
-- Reading Decision 6 as precedent for both would enforce the case Foundry
-- allows and permit the case Foundry forbids.
--
-- ── AND THE MISTAKE WOULD BE PERMANENT ─────────────────────────────────────
--   "The base type metadata and the constraints that define the validation
--    rules for the type are immutable."
--
-- A constraint cannot be edited once its version exists — only superseded. So a
-- malformed constraint minted into version 3 is version 3's forever, which is
-- why this is a trigger and not an `ontology_violations()` row. A lint that
-- reports "version 3 is malformed" leaves nothing to do about version 3.
--
-- A CHECK cannot do it either: the pairing spans two tables, so the rule
-- placement ladder's first rung is unavailable and the trigger is the first
-- that works.
--
-- ── THE HOLE THAT ISN'T ────────────────────────────────────────────────────
-- A guard on the child is worthless if the parent can move underneath it. It
-- cannot: 452 already refuses a `base_type` change after save
-- (`Ontology:ValueTypeBaseIsFixed`), which is Foundry's immutability rule and
-- was built before there was anything depending on it. Asserted below rather
-- than assumed, because that is the whole argument for the trigger being
-- sufficient.

BEGIN;

-- The published pairing, per kind. Two shapes in the source and both are here:
-- Enum and Range carry explicit "Valid base types" lists; the rest are grouped
-- under the type that owns them ("the following property types have additional
-- type-specific constraints available").
CREATE OR REPLACE FUNCTION public.value_type_constraint_base_types(p_kind text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE p_kind
    -- "Valid base types: String, Boolean, Decimal, Double, Float, Integer, or Short."
    WHEN 'enum' THEN ARRAY['string','boolean','decimal','double','float','integer','short']
    -- "Valid base types: Decimal, Double, Float, Integer, Short, Date,
    --  Timestamp, String, or Array." For String it constrains length, for Array
    --  it constrains size — which is why the picker calls it Length on a String.
    WHEN 'range' THEN ARRAY['decimal','double','float','integer','short','date','timestamp','string','array']
    -- "String: Regex … RID … UUID"
    WHEN 'regex' THEN ARRAY['string']
    WHEN 'rid'   THEN ARRAY['string']
    WHEN 'uuid'  THEN ARRAY['string']
    -- "Array: Uniqueness … Nested"
    WHEN 'uniqueness' THEN ARRAY['array']
    WHEN 'nested'     THEN ARRAY['array']
    -- "Struct: Element constraints"
    WHEN 'element' THEN ARRAY['struct']
  END
$fn$;

COMMENT ON FUNCTION public.value_type_constraint_base_types(text) IS
  'Which base types a constraint kind may be applied to, from value-type-constraints. NULL for an unknown kind. `long` and `byte` are deliberately absent from enum and range: the page lists neither, and adding them because they look numeric would be inventing a pairing.';

CREATE OR REPLACE FUNCTION public.guard_value_type_constraint()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE bt text; allowed text[];
BEGIN
  SELECT base_type INTO bt FROM public.value_types WHERE id = NEW.value_type_id;
  allowed := public.value_type_constraint_base_types(NEW.kind);

  -- An unknown kind is the CHECK's business, not ours; if it ever gets past
  -- that, refusing here beats silently allowing anything.
  IF allowed IS NULL THEN
    RAISE EXCEPTION 'Ontology:ValueTypeConstraintKindUnknown — % has no published base types', NEW.kind;
  END IF;

  IF NOT (bt = ANY (allowed)) THEN
    RAISE EXCEPTION 'Ontology:ConstraintNotValidForBaseType — a % constraint cannot apply to a % value type', NEW.kind, bt
      USING HINT = format('%s applies to: %s.', NEW.kind, array_to_string(allowed, ', '));
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER value_type_constraint_matches_base_type
  BEFORE INSERT OR UPDATE ON public.value_type_constraints
  FOR EACH ROW EXECUTE FUNCTION public.guard_value_type_constraint();

-- ── assertions, which try every pairing the page publishes ─────────────────
DO $do$
DECLARE
  org uuid; sp uuid; vt uuid; n int; ok boolean; kinds text[]; k text; bt text;
  -- one value type per base type we need to aim a constraint at
  ids jsonb := '{}'::jsonb;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe575') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe575') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);

    FOREACH bt IN ARRAY ARRAY['string','integer','array','struct','boolean','timestamp','long'] LOOP
      INSERT INTO public.value_types (space_id, api_name, display_name, base_type)
        VALUES (sp, 'probe575_' || bt, 'Probe ' || bt, bt) RETURNING id INTO vt;
      ids := ids || jsonb_build_object(bt, vt::text);
    END LOOP;

    -- ── every published pairing is accepted ────────────────────────────────
    -- Walked from the function itself, so the table and the assertions cannot
    -- drift apart: whatever it permits must actually insert.
    FOREACH k IN ARRAY ARRAY['enum','range','regex','rid','uuid','uniqueness','nested','element'] LOOP
      FOREACH bt IN ARRAY public.value_type_constraint_base_types(k) LOOP
        CONTINUE WHEN NOT (ids ? bt);   -- only the base types this probe made
        INSERT INTO public.value_type_constraints
          (value_type_id, version, kind, params, referenced_value_type_id, struct_field)
        VALUES ((ids->>bt)::uuid, 1, k, '{}'::jsonb,
                CASE WHEN k IN ('nested','element') THEN (ids->>'string')::uuid END,
                CASE WHEN k = 'element' THEN 'field_' || bt END);
        DELETE FROM public.value_type_constraints WHERE value_type_id = (ids->>bt)::uuid;
      END LOOP;
    END LOOP;

    -- ── and the mismatches are refused, one per kind ───────────────────────
    -- The case the gap run found: a regex on an integer.
    ok := false;
    BEGIN
      INSERT INTO public.value_type_constraints (value_type_id, version, kind)
        VALUES ((ids->>'integer')::uuid, 1, 'regex');
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%ConstraintNotValidForBaseType%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a regex constraint still applies to an integer'; END IF;

    -- Uniqueness is Array's; a string may not have it.
    ok := false;
    BEGIN
      INSERT INTO public.value_type_constraints (value_type_id, version, kind, referenced_value_type_id)
        VALUES ((ids->>'string')::uuid, 1, 'uniqueness', NULL);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%ConstraintNotValidForBaseType%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a uniqueness constraint applied to a string'; END IF;

    -- Element is Struct's.
    ok := false;
    BEGIN
      INSERT INTO public.value_type_constraints
        (value_type_id, version, kind, referenced_value_type_id, struct_field)
        VALUES ((ids->>'array')::uuid, 1, 'element', (ids->>'string')::uuid, 'f');
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%ConstraintNotValidForBaseType%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'an element constraint applied to an array'; END IF;

    -- A boolean takes an enum and nothing else — the page lists it under enum
    -- only, and range does not name it.
    INSERT INTO public.value_type_constraints (value_type_id, version, kind)
      VALUES ((ids->>'boolean')::uuid, 1, 'enum');
    DELETE FROM public.value_type_constraints WHERE value_type_id = (ids->>'boolean')::uuid;
    ok := false;
    BEGIN
      INSERT INTO public.value_type_constraints (value_type_id, version, kind)
        VALUES ((ids->>'boolean')::uuid, 1, 'range');
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%ConstraintNotValidForBaseType%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a range constraint applied to a boolean'; END IF;

    -- `long` looks numeric and the page lists it under NEITHER enum nor range.
    -- Following the page rather than the intuition is the whole discipline.
    ok := false;
    BEGIN
      INSERT INTO public.value_type_constraints (value_type_id, version, kind)
        VALUES ((ids->>'long')::uuid, 1, 'range');
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%ConstraintNotValidForBaseType%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'range applied to long, which the page does not list'; END IF;

    -- ── the guard is only sufficient because the parent cannot move ────────
    INSERT INTO public.value_type_constraints (value_type_id, version, kind)
      VALUES ((ids->>'string')::uuid, 1, 'regex');
    ok := false;
    BEGIN
      UPDATE public.value_types SET base_type = 'integer' WHERE id = (ids->>'string')::uuid;
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%ValueTypeBaseIsFixed%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN
      RAISE EXCEPTION 'the base type moved under a constraint, so this trigger guards nothing';
    END IF;

    RAISE EXCEPTION 'probe575:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe575:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe575';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '575: a constraint belongs to its base type';
END $do$;

COMMIT;
