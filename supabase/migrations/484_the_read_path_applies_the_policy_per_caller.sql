-- A restricted view backs an object type, and the read path applies its
-- policy per caller.
--
-- "After creation, the restricted view can be used as the backing data source
-- for an object type in your Ontology. For example, if one row represents one
-- object, the restricted view controls what objects users can see based on
-- the object type it backs." (security/restricted-views.md)
--
-- "Policies are defined as templates into which user attributes, group
-- memberships, and data values can be filled. When the consuming application
-- requests data … the template is converted into a query. This query returns
-- only rows or objects specific to the user's attributes and permissions."
-- (platform-security-management/manage-granular-policies.md)
--
-- The policy is per-caller, so it cannot bake into the shared index: the
-- index stays whole in the no-grants objects schema, and every reader's WHERE
-- carries the compiled policy. This is the phase's central design decision.

-- ── the binding ─────────────────────────────────────────────────────────────
-- "To provide access to specific objects of a given object type in Object
-- Explorer, set a restricted view as the backing dataset in the Ontology
-- Manager." (platform-security-management/manage-restricted-views.md)
ALTER TABLE public.object_type_datasources
  ADD COLUMN restricted_view_id uuid REFERENCES public.restricted_views(id) ON DELETE RESTRICT;
ALTER TABLE public.object_type_datasources ALTER COLUMN dataset_id DROP NOT NULL;
ALTER TABLE public.object_type_datasources ALTER COLUMN branch_id DROP NOT NULL;
ALTER TABLE public.object_type_datasources
  ADD CONSTRAINT object_type_datasources_one_backing CHECK (
    (dataset_id IS NOT NULL AND branch_id IS NOT NULL AND restricted_view_id IS NULL)
    OR (restricted_view_id IS NOT NULL AND dataset_id IS NULL AND branch_id IS NULL));

-- A restricted view backs alone: merged index rows cannot be attributed back
-- to the datasource they came from, so mixing a policy-gated source with an
-- open one would either leak or over-hide. Ours refuses the mix; no page
-- shows one either way.
CREATE OR REPLACE FUNCTION public.guard_rv_datasource()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE input uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.object_type_datasources o
     WHERE o.object_type_id = NEW.object_type_id AND o.id <> NEW.id
       AND (NEW.restricted_view_id IS NOT NULL OR o.restricted_view_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'Ontology:RestrictedViewBacksAlone — a restricted view is an object type''s only datasource';
  END IF;
  IF NEW.restricted_view_id IS NOT NULL THEN
    SELECT v.input_dataset_id INTO input FROM public.restricted_views v
     WHERE v.id = NEW.restricted_view_id;
    -- "To successfully configure and save an object type backed by a
    -- restricted view, you must have View access to the input dataset of the
    -- restricted view." (manage-restricted-views.md)
    IF auth.uid() IS NOT NULL AND NOT public.can_read_dataset(input) THEN
      RAISE EXCEPTION 'Ontology:RestrictedViewInputNotVisible — backing an object type with a restricted view takes View access to its input dataset';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_rv_datasource BEFORE INSERT OR UPDATE ON public.object_type_datasources
FOR EACH ROW EXECUTE FUNCTION public.guard_rv_datasource();

-- The standing datasource guard, restated whole from the live definition: it
-- read NEW.dataset_id directly, and a restricted-view row resolves through
-- the view to its input dataset instead. The register-once rule applies per
-- backing kind, and the MAP scan reads whichever schema actually backs.
CREATE OR REPLACE FUNCTION public.guard_object_type_datasource()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  n int; holder uuid; bad text; ds_org uuid; ot_ont uuid; eff_ds uuid; fields jsonb;
BEGIN
  eff_ds := COALESCE(NEW.dataset_id,
    (SELECT v.input_dataset_id FROM public.restricted_views v WHERE v.id = NEW.restricted_view_id));
  SELECT organization_id INTO ds_org FROM public.datasets WHERE id = eff_ds;
  SELECT ontology_id INTO ot_ont FROM public.object_types WHERE id = NEW.object_type_id;
  -- The dataset's organization must be one the ontology's space serves — the
  -- from-space restatement of the old same-organization rule.
  IF NOT EXISTS (
    SELECT 1 FROM public.ontologies o
    JOIN public.space_organizations so ON so.space_id = o.space_id
   WHERE o.id = ot_ont AND so.organization_id = ds_org) THEN
    RAISE EXCEPTION 'Ontology:DatasourceInAnotherOrganization — the dataset''s organization is not in this ontology''s space';
  END IF;

  IF NEW.dataset_id IS NOT NULL THEN
    SELECT object_type_id INTO holder FROM public.object_type_datasources
     WHERE dataset_id = NEW.dataset_id AND branch_id = NEW.branch_id
       AND id IS DISTINCT FROM NEW.id;
  ELSE
    SELECT object_type_id INTO holder FROM public.object_type_datasources
     WHERE restricted_view_id = NEW.restricted_view_id
       AND id IS DISTINCT FROM NEW.id;
  END IF;
  IF holder IS NOT NULL THEN
    RAISE EXCEPTION 'Phonograph2:DatasetAndBranchAlreadyRegistered — this datasource is already backing a different object type and cannot be used again'
      USING HINT = 'Pick another dataset, or another branch of this one.';
  END IF;

  SELECT count(*) INTO n FROM public.object_type_datasources
   WHERE object_type_id = NEW.object_type_id AND id IS DISTINCT FROM NEW.id;
  IF n >= 70 THEN
    RAISE EXCEPTION 'Ontology:TooManyDatasources — an object type is limited to 70 datasources, and this one already has %', n;
  END IF;

  fields := CASE WHEN NEW.dataset_id IS NOT NULL
    THEN public.dataset_branch_schema(NEW.branch_id)
    ELSE public.dataset_current_fields(eff_ds) END;
  SELECT string_agg(f ->> 'name', ', ') INTO bad
    FROM jsonb_array_elements(coalesce(fields, '[]'::jsonb)) f
   WHERE f ->> 'type' = 'MAP';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Ontology:UnsupportedColumnType — a backing datasource may not contain MAP columns (%)', bad
      USING HINT = 'Map is not a property base type; there is nothing a MAP column could back.';
  END IF;

  RETURN NEW;
END $$;

-- ── the caller's attributes ─────────────────────────────────────────────────
-- "Group names: The names of all the groups that have the user as a member
-- (direct and inherited)."
CREATE OR REPLACE FUNCTION public.auth_group_names()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(g.name), '{}') FROM public.groups g
   WHERE g.id = ANY (public.auth_group_ids())
$$;

-- "Marking IDs: The IDs of all Markings that the user has permission to view."
-- Membership is what grants viewing (399's marking_members).
CREATE OR REPLACE FUNCTION public.auth_marking_ids()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(m.marking_id::text), '{}') FROM public.marking_members m
   WHERE m.user_id = auth.uid()
$$;

-- ── the compiler: template → query ──────────────────────────────────────────
-- One term as SQL. Attributes compile to function calls so they evaluate at
-- query time under the caller's claims. Two compile fail-closed and are
-- recorded in the reading: authorized_group_ids until scoped sessions bind
-- it, organization_marking_ids until an organization is backed by a marking —
-- "These tokens may lack the attribute … causing the condition to pass" is
-- exactly why an absent attribute must grant nothing.
CREATE OR REPLACE FUNCTION public.granular_term_sql(
  p_term jsonb, p_fields jsonb, p_alias text,
  OUT o_sql text, OUT o_kind text, OUT o_collection boolean)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s record; el jsonb; parts text[] := '{}';
BEGIN
  SELECT * INTO s FROM public.granular_term_shape(p_term, p_fields);
  o_kind := s.kind; o_collection := s.is_collection;

  IF s.kind = 'user_attribute' THEN
    o_sql := CASE p_term->>'user_attribute'
      WHEN 'user_id'                  THEN 'auth.uid()::text'
      WHEN 'username'                 THEN '(auth.jwt() ->> ''email'')'
      WHEN 'group_ids'                THEN 'public.auth_group_ids()::text[]'
      WHEN 'group_names'              THEN 'public.auth_group_names()'
      WHEN 'authorized_group_ids'     THEN '''{}''::text[]'
      WHEN 'organization_marking_ids' THEN '''{}''::text[]'
      WHEN 'marking_ids'              THEN 'public.auth_marking_ids()'
    END;
  ELSIF s.kind = 'column' THEN
    o_sql := format('%s.%I', p_alias, p_term->>'column');
  ELSE
    IF o_collection THEN
      FOR el IN SELECT * FROM jsonb_array_elements(p_term->'value') LOOP
        parts := parts || CASE WHEN jsonb_typeof(el) = 'string'
          THEN quote_literal(el #>> '{}') ELSE el::text END;
      END LOOP;
      o_sql := 'ARRAY[' || array_to_string(parts, ', ') || ']::text[]';
    ELSIF jsonb_typeof(p_term->'value') = 'string' THEN
      o_sql := quote_literal(p_term->>'value');
    ELSE
      o_sql := p_term->>'value';
    END IF;
  END IF;
END $$;

-- One comparison as SQL. When a user attribute (text-typed) meets a column or
-- value, the other side is cast to text so the comparison is well-typed;
-- otherwise columns and values compare natively.
CREATE OR REPLACE FUNCTION public.granular_comparison_sql(
  p_comp jsonb, p_fields jsonb, p_alias text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  cmp text := p_comp->>'comparison';
  l record; r record; ls text; rs text; attr boolean;
BEGIN
  SELECT * INTO l FROM public.granular_term_sql(p_comp->'left', p_fields, p_alias);
  SELECT * INTO r FROM public.granular_term_sql(p_comp->'right', p_fields, p_alias);
  attr := l.o_kind = 'user_attribute' OR r.o_kind = 'user_attribute';

  IF cmp IN ('equal', 'less_than', 'less_than_or_equal', 'greater_than_or_equal', 'greater_than') THEN
    ls := CASE WHEN attr AND l.o_kind <> 'user_attribute' THEN '(' || l.o_sql || ')::text' ELSE l.o_sql END;
    rs := CASE WHEN attr AND r.o_kind <> 'user_attribute' THEN '(' || r.o_sql || ')::text' ELSE r.o_sql END;
    RETURN format('(%s %s %s)', ls, CASE cmp
      WHEN 'equal' THEN '=' WHEN 'less_than' THEN '<' WHEN 'less_than_or_equal' THEN '<='
      WHEN 'greater_than_or_equal' THEN '>=' ELSE '>' END, rs);
  END IF;

  -- The three collection comparisons: promote a scalar side to a one-element
  -- array, cast non-attribute sides to text[] when an attribute is involved.
  ls := CASE
    WHEN NOT l.o_collection THEN 'ARRAY[(' || l.o_sql || ')::text]'
    WHEN attr AND l.o_kind <> 'user_attribute' THEN '(' || l.o_sql || ')::text[]'
    ELSE l.o_sql END;
  rs := CASE
    WHEN NOT r.o_collection THEN 'ARRAY[(' || r.o_sql || ')::text]'
    WHEN attr AND r.o_kind <> 'user_attribute' THEN '(' || r.o_sql || ')::text[]'
    ELSE r.o_sql END;
  RETURN format('(%s %s %s)', ls, CASE cmp
    WHEN 'intersects' THEN '&&' WHEN 'subset_of' THEN '<@' ELSE '@>' END, rs);
END $$;

CREATE OR REPLACE FUNCTION public.granular_policy_sql(
  p_policy jsonb, p_fields jsonb, p_alias text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  rule jsonb; inner_rule jsonb; parts text[] := '{}'; sub text[]; joiner text;
BEGIN
  PERFORM public.granular_policy_check(p_policy, p_fields);
  FOR rule IN SELECT * FROM jsonb_array_elements(p_policy->'rules') LOOP
    IF rule ? 'rules' THEN
      sub := '{}';
      FOR inner_rule IN SELECT * FROM jsonb_array_elements(rule->'rules') LOOP
        sub := sub || public.granular_comparison_sql(inner_rule, p_fields, p_alias);
      END LOOP;
      joiner := CASE WHEN rule->>'match' = 'any' THEN ' OR ' ELSE ' AND ' END;
      parts := parts || ('(' || array_to_string(sub, joiner) || ')');
    ELSE
      parts := parts || public.granular_comparison_sql(rule, p_fields, p_alias);
    END IF;
  END LOOP;
  joiner := CASE WHEN p_policy->>'match' = 'any' THEN ' OR ' ELSE ' AND ' END;
  RETURN '(' || array_to_string(parts, joiner) || ')';
END $$;

COMMENT ON FUNCTION public.granular_policy_sql(jsonb, jsonb, text) IS
  '"The template is converted into a query": the validated policy compiled to a WHERE fragment over the backing dataset''s materialized table, caller attributes as function calls evaluated at query time.';

-- The per-type gate every reader appends: NULL when the type is not
-- restricted-view-backed, else an EXISTS joining the index row (alias o) to
-- the input dataset's current view by primary key, gated by the policy.
CREATE OR REPLACE FUNCTION public.restricted_view_predicate(p_object_type uuid)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE b record;
BEGIN
  SELECT v.policy, v.input_dataset_id, ds.physical_table, mb.id AS master_branch,
         pkp.property_id AS pk_prop, pkp.backing_column AS pk_col
    INTO b
    FROM public.object_type_datasources d
    JOIN public.restricted_views v ON v.id = d.restricted_view_id
    JOIN public.datasets ds ON ds.id = v.input_dataset_id
    LEFT JOIN public.dataset_branches mb
      ON mb.dataset_id = v.input_dataset_id AND mb.name = 'master'
    JOIN public.object_type_properties pkp
      ON pkp.object_type_id = d.object_type_id AND pkp.is_primary_key
   WHERE d.object_type_id = p_object_type;
  IF b IS NULL THEN RETURN NULL; END IF;

  RETURN format(
    'EXISTS (SELECT 1 FROM datasets.%I d
              WHERE d.%I::text = o.%I::text
                AND d._file IN (SELECT file_id FROM public.dataset_view(%L))
                AND %s)',
    b.physical_table, b.pk_col, b.pk_prop, b.master_branch,
    public.granular_policy_sql(b.policy, public.dataset_current_fields(b.input_dataset_id), 'd'));
END $$;

COMMENT ON FUNCTION public.restricted_view_predicate(uuid) IS
  'The policy gate for one object type, or NULL when it is not restricted-view-backed. The index stays whole; this is the only door.';

-- ── the index builds THROUGH the view ───────────────────────────────────────
-- Restated whole from the live definition; the one change is the FOR ds
-- header, which now resolves a restricted-view datasource to its input
-- dataset and that dataset's master branch. The index stays whole on purpose.
CREATE OR REPLACE FUNCTION public.index_object_type(p_object_type uuid)
RETURNS object_type_indexes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  ont      uuid;
  tbl      text := 'ot_' || replace(p_object_type::text, '-', '');
  cols     text;
  pk_prop  text;
  n        bigint := 0;
  ds       record;
  rows_sql text;
  merged   record;
  staged   record;
  bad      text;
  result   public.object_type_indexes;
BEGIN
  SELECT ontology_id INTO ont FROM public.object_types WHERE id = p_object_type;
  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;
  END IF;

  INSERT INTO public.object_type_indexes (object_type_id)
  VALUES (p_object_type)
  ON CONFLICT (object_type_id) DO NOTHING;

  BEGIN
    -- Well-formedness first: an index of a type with no primary key is not a
    -- thing that can fail later; it is a thing that cannot start.
    SELECT string_agg(problem, '; ') INTO bad
      FROM public.object_type_problems(p_object_type) v;
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION '%', bad;
    END IF;

    SELECT property_id INTO pk_prop FROM public.object_type_properties
     WHERE object_type_id = p_object_type AND is_primary_key;

    -- The staging area the merge-changes job writes: one row per primary key,
    -- keyed the way the edit log keys properties.
    CREATE TEMP TABLE _staged (pk text PRIMARY KEY, row jsonb) ON COMMIT DROP;

    -- Changelog + gather, per datasource: the current view's rows only. A
    -- restricted-view datasource indexes through to its input dataset — the
    -- policy gates reads, never the build.
    FOR ds IN
      SELECT COALESCE(d.dataset_id, v.input_dataset_id) AS dataset_id,
             COALESCE(d.branch_id, mb.id) AS branch_id,
             ds2.physical_table
        FROM public.object_type_datasources d
        LEFT JOIN public.restricted_views v ON v.id = d.restricted_view_id
        LEFT JOIN public.dataset_branches mb
          ON mb.dataset_id = v.input_dataset_id AND mb.name = 'master'
        JOIN public.datasets ds2 ON ds2.id = COALESCE(d.dataset_id, v.input_dataset_id)
       WHERE d.object_type_id = p_object_type AND ds2.physical_table IS NOT NULL
    LOOP
      -- Each physical row becomes jsonb keyed by property_id via its
      -- backing_column, which is the shape object_state() replays edits onto.
      SELECT string_agg(format('%L, r.%I', p.property_id, p.backing_column), ', ')
        INTO cols
        FROM public.object_type_properties p
       WHERE p.object_type_id = p_object_type AND p.source = 'column'
         AND p.backing_column IS NOT NULL;
      CONTINUE WHEN cols IS NULL;

      rows_sql := format(
        'SELECT jsonb_build_object(%s) AS row FROM datasets.%I r
          WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))',
        cols, ds.physical_table, ds.branch_id);

      FOR merged IN EXECUTE rows_sql LOOP
        IF merged.row ->> pk_prop IS NULL THEN
          RAISE EXCEPTION 'a datasource row has no value in the primary key column';
        END IF;
        -- "You may not have duplicate primary keys" — the failure the deep
        -- dive names ("such as non-unique primary keys").
        BEGIN
          INSERT INTO _staged VALUES (merged.row ->> pk_prop, merged.row);
        EXCEPTION WHEN unique_violation THEN
          RAISE EXCEPTION 'non-unique primary keys: "%" appears more than once in the backing datasources',
            merged.row ->> pk_prop;
        END;
      END LOOP;
    END LOOP;

    -- "it is possible for users to create additional objects that do not exist
    --  in the backing datasource" — edit-only objects join the merge by pk.
    INSERT INTO _staged
    SELECT DISTINCT e.primary_key, NULL::jsonb
      FROM public.object_edits e
     WHERE e.object_type_id = p_object_type
    ON CONFLICT (pk) DO NOTHING;

    -- The index dataset: a real table, real columns, one per property.
    SELECT string_agg(format('%I %s', p.property_id, public.property_column_type(p.base_type)),
                      ', ' ORDER BY p.position)
      INTO cols
      FROM public.object_type_properties p WHERE p.object_type_id = p_object_type;

    EXECUTE format('DROP TABLE IF EXISTS objects.%I', tbl);
    EXECUTE format('CREATE TABLE objects.%I (%s, PRIMARY KEY (%I))', tbl, cols, pk_prop);

    -- Merge changes: the datasource row replayed through the edit log, per
    -- object, dropping the deleted.
    FOR staged IN SELECT s.pk, s.row FROM _staged s LOOP
      SELECT * INTO merged FROM public.object_state(p_object_type, staged.pk, staged.row);
      CONTINUE WHEN merged.deleted;
      -- Value types enforce at index time; a violation fails the whole build.
      PERFORM 1 FROM public.object_type_properties vp
        JOIN public.value_types vvt ON vvt.id = vp.value_type_id
       WHERE vp.object_type_id = p_object_type
         AND NOT public.value_conforms(merged.properties -> vp.property_id, vp.value_type_id);
      IF FOUND THEN
        SELECT format('property "%s" of object "%s": %s', vp.property_id, staged.pk, vvt.failure_message)
          INTO bad
          FROM public.object_type_properties vp
          JOIN public.value_types vvt ON vvt.id = vp.value_type_id
         WHERE vp.object_type_id = p_object_type
           AND NOT public.value_conforms(merged.properties -> vp.property_id, vp.value_type_id)
         LIMIT 1;
        RAISE EXCEPTION '%', bad;
      END IF;
      EXECUTE format(
        'INSERT INTO objects.%I SELECT * FROM jsonb_populate_record(NULL::objects.%I, $1)',
        tbl, tbl) USING merged.properties;
      n := n + 1;
    END LOOP;

    DROP TABLE _staged;

    UPDATE public.object_type_indexes
       SET status = 'success', error = NULL, object_count = n,
           index_table = tbl, indexed_at = now(), updated_at = now()
     WHERE object_type_id = p_object_type;

  EXCEPTION WHEN OTHERS THEN
    -- The pipeline failed; the record of why is the deliverable.
    DROP TABLE IF EXISTS _staged;
    UPDATE public.object_type_indexes
       SET status = 'failed', error = sqlerrm, object_count = NULL, updated_at = now()
     WHERE object_type_id = p_object_type;
  END;

  SELECT * INTO result FROM public.object_type_indexes WHERE object_type_id = p_object_type;
  RETURN result;
END $$;

-- ── every reader appends the gate ───────────────────────────────────────────
-- object_set_where is the WHERE builder every exploration reader shares
-- (475); appending here enforces evaluate, count, aggregate, histogram and
-- the saved-set paths at once. Restated whole; the change is the tail.
CREATE OR REPLACE FUNCTION public.object_set_where(p_object_type uuid, p_filters jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  e jsonb; v jsonb; frag text; parts text[] := '{}';
  prop record; lk record; tok text; vals text[];
  other_tbl text; fk_prop text; one_pk text; cond text;
BEGIN
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_filters, '[]'::jsonb)) LOOP
    v := e->'value';

    IF e->>'type' = 'propertyFilter' THEN
      SELECT p.property_id, p.base_type, p.visibility, p.searchable
        INTO prop
        FROM public.object_type_properties p
       WHERE p.object_type_id = p_object_type
         AND (p.api_name = e->>'propertyType' OR p.property_id = e->>'propertyType');
      IF prop IS NULL THEN
        RAISE EXCEPTION 'Ontology:PropertyNotFound — % is not a property of this object type', e->>'propertyType';
      END IF;
      IF prop.visibility = 'hidden' THEN
        RAISE EXCEPTION 'Ontology:PropertyIsHidden — hidden properties do not appear anywhere in Object Explorer';
      END IF;

      CASE v->>'type'
        WHEN 'textFilter' THEN
          -- "Matches objects where the property contains all search tokens."
          IF NOT prop.searchable THEN
            RAISE EXCEPTION 'Ontology:PropertyNotSearchable — the Searchable render hint is not enabled on %', e->>'propertyType';
          END IF;
          frag := 'true';
          FOREACH tok IN ARRAY regexp_split_to_array(btrim(v->>'text'), '\s+') LOOP
            CONTINUE WHEN tok = '';
            frag := frag || format(' AND o.%I::text ILIKE %L',
              prop.property_id, '%' || replace(replace(tok, '_', '\_'), '%', '\%') || '%');
          END LOOP;
          parts := parts || ('(' || frag || ')');
        WHEN 'valuesFilter' THEN
          SELECT array_agg(x) INTO vals FROM jsonb_array_elements_text(v->'values') x;
          parts := parts || format('(o.%I::text = ANY (%L::text[]))', prop.property_id, vals);
        WHEN 'numberRangeFilter' THEN
          frag := 'true';
          IF v->'min' IS NOT NULL THEN frag := frag || format(' AND o.%I >= %s', prop.property_id, (v->>'min')::numeric); END IF;
          IF v->'max' IS NOT NULL THEN frag := frag || format(' AND o.%I <= %s', prop.property_id, (v->>'max')::numeric); END IF;
          parts := parts || ('(' || frag || ')');
        WHEN 'dateRangeFilter' THEN
          frag := 'true';
          IF v->'dateRangeFilter'->>'start' IS NOT NULL THEN
            frag := frag || format(' AND o.%I >= %L::date', prop.property_id, (v->'dateRangeFilter'->>'start')::date);
          END IF;
          IF v->'dateRangeFilter'->>'end' IS NOT NULL THEN
            frag := frag || format(' AND o.%I <= %L::date', prop.property_id, (v->'dateRangeFilter'->>'end')::date);
          END IF;
          parts := parts || ('(' || frag || ')');
        WHEN 'relativeDateFilter' THEN
          frag := 'true';
          IF v->'sinceDaysAgo' IS NOT NULL THEN
            frag := frag || format(' AND o.%I >= current_date - %s', prop.property_id, (v->>'sinceDaysAgo')::int);
          END IF;
          IF v->'untilDaysAgo' IS NOT NULL THEN
            frag := frag || format(' AND o.%I <= current_date - %s', prop.property_id, (v->>'untilDaysAgo')::int);
          END IF;
          parts := parts || ('(' || frag || ')');
        WHEN 'timestampRangeFilter' THEN
          frag := 'true';
          IF v->'startMillis' IS NOT NULL THEN
            frag := frag || format(' AND o.%I >= to_timestamp(%s / 1000.0)', prop.property_id, (v->>'startMillis')::numeric);
          END IF;
          IF v->'endMillis' IS NOT NULL THEN
            frag := frag || format(' AND o.%I <= to_timestamp(%s / 1000.0)', prop.property_id, (v->>'endMillis')::numeric);
          END IF;
          parts := parts || ('(' || frag || ')');
        WHEN 'relativeTimestampFilter' THEN
          frag := 'true';
          IF v->'sinceMillisAgo' IS NOT NULL THEN
            frag := frag || format(' AND o.%I >= now() - make_interval(secs => %s / 1000.0)', prop.property_id, (v->>'sinceMillisAgo')::numeric);
          END IF;
          IF v->'untilMillisAgo' IS NOT NULL THEN
            frag := frag || format(' AND o.%I <= now() - make_interval(secs => %s / 1000.0)', prop.property_id, (v->>'untilMillisAgo')::numeric);
          END IF;
          parts := parts || ('(' || frag || ')');
      END CASE;

    ELSIF e->>'type' = 'linkFilter' THEN
      SELECT l.* INTO lk
        FROM public.link_types l
        JOIN public.object_types t ON t.id = p_object_type AND t.ontology_id = l.ontology_id
       WHERE (l.api_name = e->>'linkType' OR l.id::text = e->>'linkType')
         AND (l.source_object_type_id = p_object_type OR l.target_object_type_id = p_object_type);
      IF lk IS NULL THEN
        RAISE EXCEPTION 'Ontology:LinkTypeNotFound — % is not a link type of this object type', e->>'linkType';
      END IF;
      IF lk.backing_kind IS DISTINCT FROM 'foreign_key' THEN
        RAISE EXCEPTION 'Ontology:LinkFilterBackingUnsupported — a presence filter reads foreign-key backing; % is backed by %',
          lk.api_name, coalesce(lk.backing_kind, 'nothing');
      END IF;

      -- The FK property lives on the source; the target joins on its primary
      -- key ("the 'one' side of the Cardinality is unique", 417's guard).
      SELECT p.property_id INTO fk_prop
        FROM public.object_type_properties p
       WHERE p.object_type_id = lk.source_object_type_id AND p.backing_column = lk.backing_column;
      SELECT p.property_id INTO one_pk
        FROM public.object_type_properties p
       WHERE p.object_type_id = lk.target_object_type_id AND p.is_primary_key;
      SELECT x.index_table INTO other_tbl
        FROM public.object_type_indexes x
       WHERE x.object_type_id = CASE WHEN lk.source_object_type_id = p_object_type
                                     THEN lk.target_object_type_id ELSE lk.source_object_type_id END
         AND x.status = 'success';
      IF fk_prop IS NULL OR one_pk IS NULL OR other_tbl IS NULL THEN
        RAISE EXCEPTION 'Ontology:LinkedTypeNotIndexed — the other side of % has no successful index to join', lk.api_name;
      END IF;

      IF lk.source_object_type_id = p_object_type THEN
        cond := format('EXISTS (SELECT 1 FROM objects.%I x WHERE x.%I::text = o.%I::text)',
                       other_tbl, one_pk, fk_prop);
      ELSE
        cond := format('EXISTS (SELECT 1 FROM objects.%I x WHERE x.%I::text = o.%I::text)',
                       other_tbl, fk_prop, one_pk);
      END IF;
      IF v->>'matchType' = 'MUST_NOT_HAVE' THEN cond := 'NOT ' || cond; END IF;
      parts := parts || cond;
    END IF;
  END LOOP;

  -- The policy gate, when this type is restricted-view-backed. Every reader
  -- shares this WHERE, so the gate cannot be forgotten by a new one.
  frag := public.restricted_view_predicate(p_object_type);
  IF frag IS NOT NULL THEN parts := parts || frag; END IF;

  RETURN CASE WHEN parts = '{}' THEN 'true' ELSE array_to_string(parts, ' AND ') END;
END $$;

-- indexed_objects reads the raw index (442); it takes the gate directly.
CREATE OR REPLACE FUNCTION public.indexed_objects(p_object_type uuid, p_limit int DEFAULT 100)
RETURNS SETOF jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE tbl text; ont uuid;
BEGIN
  SELECT t.ontology_id, x.index_table INTO ont, tbl
    FROM public.object_types t
    LEFT JOIN public.object_type_indexes x ON x.object_type_id = t.id AND x.status = 'success'
   WHERE t.id = p_object_type;
  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;
  END IF;
  IF tbl IS NULL THEN
    RETURN; -- not indexed yet: no objects to see, which is the point of E2
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT to_jsonb(o) FROM objects.%I o WHERE %s LIMIT %s',
    tbl, COALESCE(public.restricted_view_predicate(p_object_type), 'true'),
    greatest(p_limit, 0));
END $$;

-- Quicksearch reads per type (443); the gate joins its per-type WHERE.
CREATE OR REPLACE FUNCTION public.search_objects(p_query text, p_limit int DEFAULT 8)
RETURNS TABLE (object_type_id uuid, object_type_label text, primary_key text, title text)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  matched int;
  remaining int := greatest(least(p_limit, 25), 0);
BEGIN
  IF btrim(coalesce(p_query, '')) = '' THEN RETURN; END IF;

  FOR t IN
    SELECT ot.id, ot.label, x.index_table,
           pt.property_id AS title_col, pk.property_id AS pk_col
      FROM public.object_types ot
      JOIN public.object_type_indexes x
        ON x.object_type_id = ot.id AND x.status = 'success'
      JOIN public.object_type_properties pt
        ON pt.object_type_id = ot.id AND pt.is_title_key
      JOIN public.object_type_properties pk
        ON pk.object_type_id = ot.id AND pk.is_primary_key
     WHERE ot.status <> 'deprecated'
       AND ot.visibility <> 'hidden'
       AND public.auth_in_ontology(ot.ontology_id)
     -- "prioritized by Active object types with Prominent, then Normal, and
     -- then Experimental" — promoted sorts first, as active's protected form.
     ORDER BY CASE
       WHEN ot.status = 'promoted' THEN 0
       WHEN ot.status = 'active' AND ot.visibility = 'prominent' THEN 0
       WHEN ot.status = 'active' THEN 1
       WHEN ot.status = 'experimental' THEN 2
       ELSE 3
     END, ot.created_at
     LIMIT 250
  LOOP
    EXIT WHEN remaining <= 0;
    RETURN QUERY EXECUTE format(
      'SELECT %L::uuid, %L::text, o.%I::text, o.%I::text
         FROM objects.%I o
        WHERE o.%I::text ILIKE %L
          AND %s
        LIMIT %s',
      t.id, t.label, t.pk_col, t.title_col, t.index_table,
      t.title_col, '%' || p_query || '%',
      COALESCE(public.restricted_view_predicate(t.id), 'true'), remaining);
    GET DIAGNOSTICS matched = ROW_COUNT;
    remaining := remaining - matched;
  END LOOP;
END $$;

-- The OpenSearch index is shared across callers and cannot carry a per-caller
-- policy, so restricted-view-backed types do not travel there at all: honest
-- narrowing, recorded in the reading. Postgres remains their search path.
CREATE OR REPLACE FUNCTION public.search_visible_types()
RETURNS TABLE (object_type_id uuid, object_type_label text,
               index_table text, title_property text, primary_key_property text)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ot.id, ot.label, x.index_table, pt.property_id, pk.property_id
    FROM public.object_types ot
    JOIN public.object_type_indexes x
      ON x.object_type_id = ot.id AND x.status = 'success'
    JOIN public.object_type_properties pt
      ON pt.object_type_id = ot.id AND pt.is_title_key
    JOIN public.object_type_properties pk
      ON pk.object_type_id = ot.id AND pk.is_primary_key
   WHERE ot.status <> 'deprecated'
     AND ot.visibility <> 'hidden'
     AND public.auth_in_ontology(ot.ontology_id)
     AND NOT EXISTS (SELECT 1 FROM public.object_type_datasources d
                      WHERE d.object_type_id = ot.id AND d.restricted_view_id IS NOT NULL)
   ORDER BY CASE
     WHEN ot.status = 'promoted' THEN 0
     WHEN ot.status = 'active' AND ot.visibility = 'prominent' THEN 0
     WHEN ot.status = 'active' THEN 1
     WHEN ot.status = 'experimental' THEN 2
     ELSE 3
   END, ot.created_at
   LIMIT 250
$$;

-- ── assertions: two callers, two views of one whole index ───────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; txn uuid; fid uuid;
  ptbl text; rv uuid; t uuid; src uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); before text;
  x public.object_type_indexes; n bigint; hits int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('rv-484') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rv484a@beacon.test'),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rv484b@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (u1, 'rv484a@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

  SET LOCAL ROLE authenticated;
  sp := public.create_space('RV484');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'rv484', 'RV 484', false) RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'rv484', 'RV484') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, u1, 'owner', org);

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'sales484', 'Sales') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (ds, txn, '[
    {"name":"sale_id","type":"STRING"},
    {"name":"owner_id","type":"STRING"},
    {"name":"region","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'sales.parquet', 3) RETURNING id INTO fid;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  ptbl := public.dataset_materialize(ds, txn);
  EXECUTE format(
    'INSERT INTO datasets.%I (_file, sale_id, owner_id, region) VALUES
       ($1, ''S1'', $2, ''ATH''), ($1, ''S2'', $3, ''ATH''), ($1, ''S3'', $3, ''SKG'')',
    ptbl) USING fid, u1::text, u2::text;

  -- The view: each caller sees the rows whose owner_id is their own user id.
  INSERT INTO public.restricted_views (project_id, input_dataset_id, api_name, name, policy)
  VALUES (proj, ds, 'sales_by_owner', 'Sales by owner', '{"match":"all","rules":[
    {"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}}]}')
  RETURNING id INTO rv;

  RESET ROLE;
  INSERT INTO public.object_types (ontology_id, api_name, label)
  VALUES (ont, 'Sale484', 'Sale') RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, restricted_view_id)
  VALUES (t, rv) RETURNING id INTO src;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type,
     backing_column, required, is_primary_key, is_title_key)
  VALUES (t, 'sale_id', 'Sale Id', 'saleId', 'string', 'sale_id', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type,
     backing_column, datasource_id, required)
  VALUES (t, 'owner_id', 'Owner', 'ownerId', 'string', 'owner_id', src, false),
         (t, 'region', 'Region', 'region', 'string', 'region', src, false);
  SET LOCAL ROLE authenticated;

  -- 1. The index builds through the view to the input dataset, and stays
  --    whole: all three rows, no caller in sight.
  x := public.index_object_type(t);
  IF x.status <> 'success' OR x.object_count <> 3 THEN
    RAISE EXCEPTION 'index expected success/3, got %/% (%)', x.status, x.object_count, x.error;
  END IF;

  -- 2. Each caller reads only their rows, through every reader.
  n := public.count_object_set(t, '[]');
  IF n <> 1 THEN RAISE EXCEPTION 'u1 expected 1 visible object, got %', n; END IF;
  SELECT count(*) INTO n FROM public.evaluate_object_set(t);
  IF n <> 1 THEN RAISE EXCEPTION 'u1 evaluate expected 1 row, got %', n; END IF;
  SELECT count(*) INTO n FROM public.indexed_objects(t);
  IF n <> 1 THEN RAISE EXCEPTION 'u1 indexed_objects expected 1 row, got %', n; END IF;
  SELECT count(*) INTO hits FROM public.search_objects('S', 25) s WHERE s.object_type_id = t;
  IF hits <> 1 THEN RAISE EXCEPTION 'u1 quicksearch expected 1 hit, got %', hits; END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'limited_access', 'org_id', org))::text, true);
  n := public.count_object_set(t, '[]');
  IF n <> 2 THEN RAISE EXCEPTION 'u2 expected 2 visible objects, got %', n; END IF;
  SELECT count(*) INTO n FROM public.evaluate_object_set(t);
  IF n <> 2 THEN RAISE EXCEPTION 'u2 evaluate expected 2 rows, got %', n; END IF;

  -- 3. The shared search index never carries a restricted-view-backed type.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  SELECT count(*) INTO hits FROM public.search_visible_types() v WHERE v.object_type_id = t;
  IF hits <> 0 THEN RAISE EXCEPTION 'a restricted-view-backed type reached the shared search index'; END IF;

  -- 4. A restricted view backs alone.
  BEGIN
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
    VALUES (t, ds, br);
    RAISE EXCEPTION 'a second datasource joined a restricted-view-backed type';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Ontology:RestrictedViewBacksAlone%' THEN RAISE; END IF;
  END;

  -- 5. A marking-membership rule reads the caller's markings at query time:
  --    widen the policy to "owner, or anyone who can see the ATH region" —
  --    region equal ATH OR user's markings intersect a granted value.
  UPDATE public.restricted_views SET policy = '{"match":"any","rules":[
    {"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}},
    {"left":{"user_attribute":"group_names"},"comparison":"intersects","right":{"value":["Sales Leads 484"]}}]}'
  WHERE id = rv;
  INSERT INTO public.groups (organization_id, name) VALUES (org, 'Sales Leads 484');
  INSERT INTO public.group_members (group_id, member_user_id)
  SELECT g.id, u2 FROM public.groups g WHERE g.name = 'Sales Leads 484';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'limited_access', 'org_id', org))::text, true);
  n := public.count_object_set(t, '[]');
  IF n <> 3 THEN RAISE EXCEPTION 'group membership should widen u2 to 3 objects, got %', n; END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '484: the index stays whole, and the read path applies the policy per caller';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
