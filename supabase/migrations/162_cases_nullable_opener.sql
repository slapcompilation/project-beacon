-- System-authored Cases. The unattended cycle (cron, service role) opens a Case
-- per queued proposal so the operator decision has a home, but it has no
-- operator to attribute the opener to. Mirror proposals.created_by_user_id,
-- already nullable for ai-authored rows.
--
-- Authenticated inserts are unaffected: the RLS INSERT policy still requires
-- opened_by_user_id = auth.uid(), so a user can't pass NULL — only the service
-- role (RLS-bypassed) can.

BEGIN;

ALTER TABLE cases ALTER COLUMN opened_by_user_id DROP NOT NULL;

COMMIT;
