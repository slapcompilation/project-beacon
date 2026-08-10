-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 339 — two of Foundry's advanced base types, and the rule that comes
-- with them.
--
-- Our property vocabulary was four values: text, number, boolean, date.
-- Foundry's base types are those plus Vector, Geopoint, Geoshape, Attachment,
-- Time series, Geotemporal series, Media reference, Cipher text and Struct
-- (`mirror/object-link-types/base-types.md`).
--
-- TWO OF THE NINE, because two have consumers today and the other seven do not:
--
--   media_reference  "A media reference property type allows you to have media on
--                     your objects... points to a specific media item within a
--                     media set. The media reference contains information about
--                     the media file, which means Foundry can display the media
--                     wherever the media reference is used."
--                    `documents.storage_path` is this in everything but type,
--                    which is why nothing can render a source page beside the
--                    chunk that cites it.
--
--   vector           "for storing vectors on objects for use in a semantic
--                     search". `document_chunks.embedding` is exactly that, in a
--                    column the ontology cannot see.
--
-- AND THE RULE THEY BRING, from properties-overview: Media Reference and Vector
-- are valid as NEITHER a title key NOR a primary key. That is not arbitrary — a
-- title is something a person reads, and neither of these is readable. Enforced
-- here rather than left as a note, because `object_types.title_key` exists and
-- would happily point at either.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Shared properties may now be declared with either type.
ALTER TABLE public.shared_properties DROP CONSTRAINT IF EXISTS shared_properties_base_type_check;
ALTER TABLE public.shared_properties ADD CONSTRAINT shared_properties_base_type_check
  CHECK (base_type IN ('text', 'number', 'boolean', 'date', 'media_reference', 'vector'));

CREATE OR REPLACE FUNCTION public.enforce_title_key_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE t text;
BEGIN
  IF NEW.title_key IS NULL THEN RETURN NEW; END IF;

  SELECT p->>'type' INTO t
  FROM jsonb_array_elements(NEW.properties) p
  WHERE p->>'key' = NEW.title_key;

  -- A title key naming no property is a separate problem and not this trigger's;
  -- built-in registrations title from a column rather than a jsonb property.
  IF t IS NULL THEN RETURN NEW; END IF;

  IF t IN ('media_reference', 'vector') THEN
    RAISE EXCEPTION
      'Ontology:InvalidTitleKey "%" is a % property, which cannot title a record. A title is something a person reads.',
      NEW.title_key, t;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_title_key_type ON public.object_types;
CREATE TRIGGER trg_title_key_type
  BEFORE INSERT OR UPDATE OF title_key, properties ON public.object_types
  FOR EACH ROW EXECUTE FUNCTION public.enforce_title_key_type();

DO $$
DECLARE v_org uuid; v_user uuid; v_t uuid;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT created_by_user_id INTO v_user FROM object_types WHERE organization_id = v_org LIMIT 1;

  BEGIN
    -- A media property is allowed; titling by it is not.
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id, properties)
    VALUES (v_org, 'probe_media', 'Probe Media', v_user,
            '[{"key":"scan","label":"Scan","type":"media_reference","required":false},
              {"key":"name","label":"Name","type":"text","required":true}]'::jsonb)
    RETURNING id INTO v_t;

    BEGIN
      UPDATE object_types SET title_key = 'scan' WHERE id = v_t;
      RAISE EXCEPTION 'Migration 339: a media_reference property was accepted as the title key';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Ontology:InvalidTitleKey%' THEN RAISE; END IF;
    END;

    -- A readable property still works.
    UPDATE object_types SET title_key = 'name' WHERE id = v_t;

    -- And a shared property can be declared with the new base types.
    INSERT INTO shared_properties (organization_id, api_name, label, base_type, created_by_user_id)
    VALUES (v_org, 'probe_scan', 'Scan', 'media_reference', v_user),
           (v_org, 'probe_vec', 'Embedding', 'vector', v_user);

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
