-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 279 — the curated answers become findable. Tier 5.1.
--
-- Audit §1.3 = §11.3: we have ApprovedAnswer — a curated Q&A cache meant to be
-- served BEFORE any fresh LLM call — with hit counts and an Object View. The
-- store exists; the surface does not. The evidence is in the data: three live
-- answers, every one of them hit_count = 0. Knowledge nobody can reach is
-- knowledge we do not have.
--
-- Searching is not serving, so they are two functions. A search that quietly
-- incremented a counter would make "how often did this help somebody" mean
-- "how often did anyone type near it", and the hit count is the only signal we
-- have about which curated answers are worth keeping.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE INDEX IF NOT EXISTS idx_approved_answers_search
  ON public.approved_answers USING gin (to_tsvector('english', question || ' ' || answer))
  WHERE retired_at IS NULL;

CREATE OR REPLACE FUNCTION public.help_search(p_query text, p_limit integer DEFAULT 5)
RETURNS TABLE (id uuid, question text, answer text, hit_count integer, rank real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT a.id, a.question, a.answer, a.hit_count,
         ts_rank(to_tsvector('english', a.question || ' ' || a.answer),
                 websearch_to_tsquery('english', p_query)) AS rank
  FROM approved_answers a
  WHERE a.retired_at IS NULL
    AND hotel_is_in_user_scope(a.hotel_id)
    AND (
      to_tsvector('english', a.question || ' ' || a.answer) @@ websearch_to_tsquery('english', p_query)
      -- Fallback so a partial word still finds the obvious answer; ranked below
      -- a real text match rather than beside it.
      OR a.question ILIKE '%' || p_query || '%'
    )
  ORDER BY rank DESC, a.hit_count DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.help_search(text, integer) IS
  'Curated answers matching a question, scope-gated. Tier-1 lookup: this is what should be consulted before spending an LLM call. STABLE — searching is not serving.';

CREATE OR REPLACE FUNCTION public.record_answer_served(p_answer_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_hits integer;
BEGIN
  UPDATE approved_answers
     SET hit_count = hit_count + 1, last_served_at = now()
   WHERE id = p_answer_id AND retired_at IS NULL
     AND hotel_is_in_user_scope(hotel_id)
  RETURNING hit_count INTO v_hits;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ApprovedAnswer:NotServable' USING
      DETAIL = 'The answer is retired, or outside your scope.';
  END IF;
  RETURN v_hits;
END $$;

REVOKE ALL ON FUNCTION public.record_answer_served(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_answer_served(uuid) TO authenticated;

COMMENT ON FUNCTION public.record_answer_served(uuid) IS
  'Called when an answer is actually shown, not when it is found. Kept separate from help_search so hit_count means "this helped somebody" rather than "somebody typed near it" — it is the only signal we have about which curated answers earn their place.';

COMMIT;
