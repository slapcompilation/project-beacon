-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 229 — G3 prep: two gaps the registry convergence audit found.
--
-- 1. approved_answer got an Object View (#422) and an explorer list, but never a
--    built-in registration — so it has no source_table, no derived properties,
--    no title_key, and cannot implement interfaces. Register it like the other
--    fifteen (223), derive like 228.
-- 2. proposal.title_key was set NULL in 228 as "no single column reads as a
--    title" — but the explorer has titled proposals by action_type all along.
--    The registry is the source of truth; make it say what the UI already does.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.object_types
  (organization_id, api_name, label, icon, description, properties, kind, source_table, created_by_user_id)
SELECT o.id, 'approved_answer', 'Approved Answer', 'bookmark',
       'Curated Q&A served before any fresh LLM call.', '[]'::jsonb, 'builtin', 'approved_answers',
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
ON CONFLICT (organization_id, api_name) DO NOTHING;

UPDATE public.object_types t
SET properties = public.derive_object_type_properties(t.source_table),
    title_key  = 'question',
    updated_at = now()
WHERE t.kind = 'builtin' AND t.api_name = 'approved_answer';

UPDATE public.object_types
SET title_key = 'action_type', updated_at = now()
WHERE kind = 'builtin' AND api_name = 'proposal';
