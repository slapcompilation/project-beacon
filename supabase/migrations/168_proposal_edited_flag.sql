-- Track whether an operator edited a proposal's fields before approving it
-- (completes corrections #6 — calibration label fidelity).
--
-- The review queue's "Edit & approve" path (ReviewQueuePage) already lets an
-- operator tweak a proposal's action before it dispatches, but the approval was
-- recorded as a plain 'approved' — indistinguishable from a clean one-click
-- approve. That overstates the agent: a call the operator had to correct isn't a
-- full hit. This column lets calibration give it partial credit.
--
-- Default false: every existing + clean approval is unedited. NULL not used.

BEGIN;

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS edited_before_approval boolean NOT NULL DEFAULT false;

COMMIT;
