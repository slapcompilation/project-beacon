# The branch overlay — saving onto a branch, and the merge that applies it

```
verify: strict
pages: global-branching/core-concepts.md ·
       ontologies/branching-ontology.md (test-changes-in-ontology.md is a
       byte-identical duplicate under a second URL) ·
       global-branching/resource-protection-and-approval-policies.md ·
       ontologies/review-ontology-proposals.md
built already: 420 (branches, proposals, tasks, reviews, blockers, merge shell) ·
               426–429 (working state, base capture, three-way conflicts) ·
               454 (project permissions — protection's precondition)
dead end: ontologies/ontologies-proposals 404s UPSTREAM — the URL in
          all-foundry-urls.txt is stale, not a mirror failure.
```

Read because the promoted-proposal wiring hit the floor: `save_working_state(p_branch)`
raises `BranchSaveNotImplemented`, and `merge_proposal` marks merged without
applying anything.

## 1 — What a branch is to the ontology

The overlay is total for ontology resources, unlike the rest of the platform:

> Within your branch, you can make changes to Foundry resources without affecting the `main` branch. However, creating or deleting Foundry resources on a branch will affect `main`. This does not apply to ontology resources: you can create, modify, or delete entities on the branch without affecting the `main` branch.
> — global-branching/core-concepts.md

Branches come only off main:

> You can only branch from the main ontology, also known as `main` branch.
> — ontologies/branching-ontology.md

And a branch has BOTH a saved state and a working state — the rebase text keeps
them distinct:

> During rebasing, changes from `main` are loaded onto your branch, while any previously saved changes from your current branch are reloaded back into the working state, which you can see in the **All changes** tab.
> — ontologies/branching-ontology.md

## 2 — The proposal, and who approves

> When you [create a Global Branching proposal] on a branch that includes ontology changes, an ontology proposal is automatically created to track the ontology-specific changes.
> — ontologies/branching-ontology.md

> Creating a proposal requires the branch `Owner` role or space `Administrator` privileges.
> — global-branching/core-concepts.md

> Non-protected resources still require approval from a user with edit-level permissions, which may be granted automatically when the contributor satisfies the policy.
> — global-branching/core-concepts.md

> Default policies are satisfied in one of two ways: **Automatically**, when the contributor's own permissions cover the policy. **Through review**, when a separate user with the required permission approves the change.
> — global-branching/resource-protection-and-approval-policies.md

420 already carries this shape: `proposal_tasks.auto_approved`, reviews where
one rejection dominates, `proposal_blockers()` as the single mergeability
answer. The review page's task/approval mechanics matched 420 clause for
clause when re-read now.

## 3 — The merge

> When merging a proposal, you can trigger builds for the affected resources […] In case of a partial merge failure, the proposal page will show which resources successfully merged and which failed to merge and remain on the branch. You cannot currently revert a partially-failed merge.
> — global-branching/core-concepts.md

> Global Branching auto-resolves any non-conflicting changes during a rebase. For true conflicts — where the same property of the same resource was edited on both `main` and your branch — there is no automatic resolution; you must pick one version manually before the rebase can proceed.
> — global-branching/core-concepts.md

The conflict definition is exactly 428/429's three-way field rule, already
built for the working state.

## 4 — Protection (slice 2, not slice 1)

> Protected resources cannot be changed directly; instead, changes must be made on a branch and then approved before merging into the main branch.
> — global-branching/resource-protection-and-approval-policies.md

> When modifying protected resources, the **Save** dialog is replaced with **Create and save to branch**, requiring you to save changes to a new branch.
> — ontologies/branching-ontology.md

Five protectable kinds (object/action/link/interface/shared property — not
type groups), gated on project permissions, which 454 built. Custom policies:
eligible reviewers, N approvals, contributor-approval toggle, project-level.

## 5 — Decisions

**D1. The overlay IS the entry table.** `working_state_changes` already
carries `branch_id` and base snapshots. Saving on a branch marks the entries
**saved** (a `saved_at` stamp) and leaves them in place — main's tables are
never touched, which is the quoted total-overlay rule. Author attribution
stays per entry ("Edits are categorized by author").

**D2. Merge applies the branch's saved entries** through the SAME arms
`save_working_state` uses (apply_object_type / apply_action_type /
apply_interface / the generic arm), in created order, inside
`merge_proposal`'s transaction, then checks `ontology_violations()` the way a
main save does. **Ours is atomic — no partial merge.** Upstream documents
partial failure as a current limitation of a multi-service platform; one
database gives us the stronger property for free, and taking the weaker one
on purpose would be a deliberate regression. *Marked as ours.*

**D3. Staleness blocks merge.** A saved entry whose base no longer matches
main is a true conflict; `proposal_blockers()` gains that reason, computed by
the existing `working_state_conflicts()` rule. Resolution is a re-save on the
branch (keep / take main / custom — the page's three options). The dedicated
rebase surface is later; the blocker is now.

**D4. Promoted rides the merge.** `guard_promotion` learns one exception:
during `merge_proposal` (a transaction-local setting names the proposal), a
promotion applies when that proposal's task for the object type carries an
approval from an ontology **owner** — "approval by an Ontology Owner on the
ontology level" (metadata-statuses). Direct promotion stays owner-only.

**D5. Branch-from-main-only** becomes a guard on branch creation (parent must
be the trunk).

**D6. Slice 2 = protection**: `protected` on the five kinds + the project's
auto-protect toggle + refusing a DIRECT save of a protected resource (the
save-to-branch path exists after slice 1). Custom approval policies
(reviewers/N/contributor toggle) ride `proposal_blockers()`.

**D7. Deferred, recorded:** branch data indexing and the Preview status tab
(E2 is main-only today); inactive/archived lifecycle and retention timers
(nothing here runs on a timer by design); the build-options dialog at merge
(no pipeline builds exist to trigger).

## 6 — Questions

**Q1.** Does Foundry run save-blocking validation on a BRANCH save, or only
at merge? Not attested on any page read. Slice 1 validates what an overlay
can (CHECK-level shape at entry time) and leaves `ontology_violations()` to
the merge, where the tables exist to ask. *Inference, marked.*

**Q2.** "Checks will run on each resource" — the checks named for ontology
resources are the rebase/conflict check and approvals. Whether more exist
(naming collisions with main, for instance) is unattested; collisions surface
at merge as apply errors under D2 regardless.

**Q3.** The ontology proposal is "automatically created" when a Global
Branching proposal includes ontology changes. We have no second proposal
kind — 420's `ontology_proposals` IS the one object. Nothing to build unless
a non-ontology branching surface ever exists.
