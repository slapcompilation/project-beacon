-- Recovered from supabase_migrations version 20260722053045.
-- Applied through the Supabase MCP and never written to the repo; exported
-- here so the schema is reproducible from files alone. Already applied in
-- production — the history reconciliation marks it so.

CREATE OR REPLACE FUNCTION sensitivity_rank(s text) RETURNS int
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE s
    WHEN 'public' THEN 0 WHEN 'internal' THEN 1
    WHEN 'confidential' THEN 2 WHEN 'restricted' THEN 3
    ELSE 1 END;
$$;

CREATE OR REPLACE FUNCTION user_doc_clearance() RETURNS int
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN auth_role() IN ('owner', 'admin') THEN 3 ELSE 1 END;
$$;
