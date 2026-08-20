-- `guard_function_version` refuses a breaking signature change without a major
-- bump. That refusal is deliberate and recorded — the functions reading's
-- Decision 5 says Foundry warns where we refuse, on the grounds that we have no
-- human release-review step, and marks it as stricter than documented. This
-- migration does not overturn that.
--
-- It fixes the part the decision never considered. The versioning page exempts
-- initial development from the recommendation entirely:
--
--   "If these checks fail for any reason, it is recommended that you release a
--    major version. However, this does not apply if you are still in the initial
--    development phase (that is, you are still at major version `0`)."
--
--   "Major version `0` (`0.y.z`) is for initial development. During initial
--    development, the function may change at any time and your functions should
--    not be considered stable by consumers."
--
--   — functions/functions-versioning.md
--
-- We refused at 0.x too, which is not "stricter with a reason" — it contradicts
-- a stated exemption, and it makes initial development impossible: the only way
-- to change a signature at 0.1.0 was to release 1.0.0, which ends the very phase
-- the exemption exists for. Verified against the database before this ran.
--
-- Found by parsing an image I had claimed to have read and had not. Foundry
-- computes the check and SHOWS it beside three offered bumps; it does not block
-- on it. The dialog prints the finding in as many words:
--
--   "Comparing the current commit with latest version 0.0.1."
--   "No breaking changes have been detected."
--   — functions/images/new-functions-tag.png

-- ── §1 the check's finding is recorded, not only enforced ─────────────────
-- Where the refusal no longer fires, the warning still has to reach someone:
-- the page says you "will be warned", and at 0.x that is now all that happens.
-- Stored on the version so the finding survives the insert that produced it.
ALTER TABLE public.function_versions
  ADD COLUMN breaking_changes text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.function_versions.breaking_changes IS
  'What signature_breaks() found against the previous version at publish time. '
  'Non-empty on a major bump, and on any 0.x release that changed its signature '
  'incompatibly — initial development is exempt from the major-bump rule, not '
  'from the warning.';

CREATE OR REPLACE FUNCTION public.guard_function_version()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
DECLARE prev record; breaks text[];
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Functions:VersionsAreImmutable — a released version cannot be changed; publish a new one';
  END IF;

  SELECT * INTO prev FROM public.function_versions v
   WHERE v.function_id = NEW.function_id
   ORDER BY v.major DESC, v.minor DESC, v.patch DESC,
            (v.prerelease IS NULL) DESC,
            public.semver_prerelease_key(v.prerelease) DESC
   LIMIT 1;
  IF prev IS NULL THEN RETURN NEW; END IF;

  IF (NEW.major, NEW.minor, NEW.patch) <= (prev.major, prev.minor, prev.patch)
     AND NEW.prerelease IS NULL THEN
    RAISE EXCEPTION 'Functions:VersionGoesForward — %.%.% does not follow %.%.%',
      NEW.major, NEW.minor, NEW.patch, prev.major, prev.minor, prev.patch;
  END IF;

  breaks := public.signature_breaks(prev.signature, NEW.signature);
  NEW.breaking_changes := coalesce(breaks, '{}');

  -- Stricter than Foundry ON PURPOSE, and only past initial development: at
  -- major 0 "the function may change at any time", so the finding is recorded
  -- and the release stands.
  IF array_length(breaks, 1) > 0 AND NEW.major = prev.major AND prev.major > 0 THEN
    RAISE EXCEPTION 'Functions:BreakingChangeNeedsMajor — %', array_to_string(breaks, '; ')
      USING HINT = 'Release a major version, or restore the previous signature.';
  END IF;
  RETURN NEW;
END $fn$;

-- ── §2 the warning, where the refusal no longer is ────────────────────────
-- 589 made warnings a second list precisely so an advisory finding has a home
-- that does not block. A 0.x release that broke its signature is exactly that:
-- published, legal, and worth telling someone about.
CREATE OR REPLACE FUNCTION public.ontology_warnings()
RETURNS TABLE(object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $fn$
  SELECT t.api_name, 'property', pr.property_id,
         format('The primary key has a discouraged base type. %s',
                public.primary_key_advice(pr.base_type))
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
   WHERE pr.is_primary_key
     AND public.primary_key_eligibility(pr.base_type) = 'discouraged'

  UNION ALL

  -- "you will be warned about any of the following breaking changes" — and
  -- during initial development that warning is all there is.
  SELECT f.api_name, 'function',
         public.function_version_string(v.major, v.minor, v.patch, v.prerelease),
         format('Released with a breaking signature change during initial development: %s',
                array_to_string(v.breaking_changes, '; '))
    FROM public.function_versions v
    JOIN public.functions f ON f.id = v.function_id
   WHERE cardinality(v.breaking_changes) > 0 AND v.major = 0
$fn$;

DO $$
DECLARE n int;
BEGIN
  -- Every existing version predates the column and claims no breaks.
  SELECT count(*) INTO n FROM public.function_versions WHERE breaking_changes IS NULL;
  IF n > 0 THEN RAISE EXCEPTION '% version(s) carry a null break list', n; END IF;

  -- Both warning arms answer.
  PERFORM 1 FROM public.ontology_warnings() LIMIT 1;
END $$;
