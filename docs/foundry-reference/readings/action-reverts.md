---
verify: strict
---

# Reverting an action: a compensating append, not an undo

The queue's entry named the substrate exactly right — `object_edits` is
the log a revert compensates against — and 422's own table comment already
quotes the sentence that shapes the whole design: "There is no mechanism to
directly undo a single user edit"; the log is append-only.

**What I read, counted rather than asserted.** `action-types/action-reverts`
whole, and 422's table for the substrate half. **Images: three of three
parsed** — `action-types/images/action-reverts-form-button.png`,
`action-reverts-revert-action.png`, `action-reverts-edits-reverted.png`.
Nothing skipped.

## 1. What a revert is, and how long you have

> "Action reverts in [Ontology Manager](/docs/foundry/ontology-manager/overview/) allow an action to be reverted (that is, undone) immediately after the action has been applied. You can revert an action by selecting **Undo** in the success message after any successful action application."

— `action-types/action-reverts.md`

> "New actions are revertible by default."

— `action-types/action-reverts.md`

The window is the toast, and the page says so as a warning:

> "The toast below is your only opportunity to revert the action. This is especially important to note when performing delete actions."

— `action-types/action-reverts.md`

And who may:

> "Currently, actions can only be reverted by the user who applied the action."

— `action-types/action-reverts.md`

## 2. The toggle, and its one-way behaviour

> "In the **Form** tab of an action, toggle on the **Allow revert after action submission** button. Once this toggle is correctly configured and saved to the Ontology, your action can be reverted."

— `action-types/action-reverts.md`

The capture (`action-types/images/action-reverts-form-button.png`) places it
precisely: the Form tab holds a `Form content` card (parameters, `+ Add new
parameter`, `Add section`) above a **`Submission options`** card whose three
rows are `Customize submit button` (off), `Customize success message` (off),
and `Allow revert after action submission` (ON), the last with a subtitle —
"Directly after clicking submit button on an action, display option to
revert." The action's left rail reads Overview, Rules, Form, Capabilities,
Security & Submission Criteria, Automations.

The caveat that makes the flag stateful rather than a live read:

> "An action cannot be reverted if action reverts have been toggled off after action submission, even if action reverts have been toggled on again."

— `action-types/action-reverts.md`

Toggling off does not merely pause reverts — it **destroys** the
revertibility of applications already submitted, permanently. So an
application must carry its own revertible flag, and turning the toggle off
must clear it on the applications that exist.

## 3. What blocks a revert

> "An action on an object cannot be reverted once any subsequent edit has been made to the object, even if the edit is on a different property. In other words, an action on an object can only be reverted if the action is the most recent edit to an object."

— `action-types/action-reverts.md`

And what a revert does not reach:

> "An action revert only reverts the edits to the object instance, but it will not revert side effects, such as notifications or webhooks, nor will it call them in the same way that the applied action would have."

— `action-types/action-reverts.md`

The OSv2 restriction is ours already by construction — we have no OSv1 —
but the page states it, and the remediation when the toast is gone is
stark: migrate to a new object type and copy edits with functions, or
"Drop all edits on the object type."

**A documentation bug, recorded because I looked at the images.** The page
captions two toasts "Edits applied:" and "Edits reverted:", but its alt
text has them the other way round: `action-reverts-revert-action.png` is
alt-texted "Edits successfully reverted" while the image actually reads
**"Edits successfully applied." with a `Revert` button** beside a close ×;
`action-types/images/action-reverts-edits-reverted.png` is alt-texted
"Edits successfully applied" while the image reads **"Edits successfully reverted"**. The
captions are right and the alt text is swapped. Also worth noting: the
prose says the success message offers **Undo**, and the drawn button says
**Revert**.

## 4. What our substrate holds, probed

`object_edits` (object_type_id, primary_key, instruction ∈
create/modify/delete, properties, applied_at, applied_by_user_id,
action_type_id, seq) — append-only, with `seq` giving the order a revert
needs. `apply_action` writes one edit per writing rule, stamping
`action_type_id` but **nothing that identifies one submission**: two
applications of the same action are indistinguishable in the log, so there
is nothing a revert could name. `object_state` replays the log to a
current state; `object_current_value(type, pk, property)` answers one
property. `action_types` has no revert flag. The apply surface
(`explorer/ActionsMenu.tsx`) already toasts on success — the place the
Revert button belongs.

## Decisions

1. **`action_applications`** — one row per submission (action_type_id,
   applied_by_user_id, applied_at, `revertible` boolean, reverted_at,
   reverted_by_user_id), and `object_edits.application_id` referencing it.
   This is the missing identity: a revert names an application, not an
   action type.
2. **`action_types.allow_revert` boolean NOT NULL DEFAULT true** — "New
   actions are revertible by default", stated plainly. The Form tab's
   toggle.
3. **The application captures its revertibility at submission**, and
   turning the toggle off clears `revertible` on the action's existing
   unreverted applications — a trigger, because the page says re-enabling
   does not bring them back. Recording this as the reason the flag is a
   stored column rather than a join to `action_types.allow_revert`: a
   live read would let re-enabling restore what the page says is gone.
4. **The before-image is captured at apply time**, not reconstructed at
   revert time. `object_edits.before` holds the prior values of exactly
   the properties an edit touched (empty for a create; the whole object
   for a delete). Reconstructing by replaying the log to a point is
   possible but would need a second replay path beside `object_state`;
   capturing is one column and cannot drift from what actually happened.
5. **`revert_action(application)`** appends compensating edits — create
   compensates with delete, modify with a modify back to `before`, delete
   with a create from `before` — refusing by name when: the caller is not
   the applier, the application is not revertible, it is already reverted,
   or **any touched object has a later edit than this application's**,
   which is the page's own "most recent edit" rule. Nothing is deleted
   from the log; the revert is more log.
6. **Side effects are not reverted, and the divergence is Foundry's own** —
   the page states it, so our revert touches only `object_edits` and says
   so in its comment.
7. **The surface**: the Form tab's Submission options card with the toggle
   (the two Customize rows the capture shows are not built — no custom
   submit label or success message exists here, recorded), and the apply
   toast gaining a **Revert** action, which is the only window.

## Questions

1. **Undo or Revert?** The prose says Undo, the button says Revert. Ours
   follows the drawn button. `blocks: nothing.`
2. **How long does the toast live?** Unstated beyond "immediately after";
   ours is the toast's own lifetime, and the application stays revertible
   until something later edits the object. `blocks: nothing.`
3. **May an admin revert someone else's action?** "Currently... only by
   the user who applied" — the word *currently* hints it may widen. Ours
   refuses everyone else, admins included. `blocks: nothing.`
