---
verify: strict
---

# Submission criteria: the engine is right, and nothing draws it

**Why this reading exists.** The priority list drawn from
`docs/foundry-deep-dives/text/01-ontology/` puts this first. The course's
conclusion calls the Ontology "the nouns of your organization, but also the
verbs", and names three values of which the third is well-defined actions that
enforce constraints. 421 built the criteria tree faithfully. **Nothing on any
screen reads it, and there are zero rows.**

**Page read:** `action-types/submission-criteria` in full.

**Images parsed (5 of 5):** `submission_criteria_overview.png`,
`submission_criteria_select_condition_template.png`,
`submission_criteria_select_a_value_left.png`,
`submission_criteria_select_an_operator.png`,
`submission_criteria_select_a_value_right.png`.

---

## 1. What the page says the thing is

> **Submission criteria** (formerly known as validations) are the conditions that determine whether an action can be submitted. Submission criteria support encoding business logic into data editing permissions, ensuring Ontology data quality and editing governance.

— `action-types/submission-criteria.md`

and the boundary matters for what we build:

> Actions can only be submitted if all the submission criteria are met. This is independent from the permissions that govern whether a user can edit the action type itself.

— `action-types/submission-criteria.md`

So this is not action-type editing permission. It is a per-submission gate, and
each action type has its own.

## 2. The schema 421 built is right, with one gap

| the page | ours |
|---|---|
| a tree of conditions and logical operators | `parent_id` + `position` + `node_type` |
| "all, any, or no conditions underneath it" | `logical_operator` ∈ `all, any, none` |
| templates: Current user, Parameter, **Execution context** | `template` ∈ `current_user, parameter` — **two of three** |
| user ID, group IDs, other multipass attribute | `user_field` ∈ `user_id, group_ids, attribute` |
| ten operators, five single and five multi | `submission_operators()`, ten, split by arity |
| "an existing parameter, a static value, or no value" | `value_source` ∈ `parameter, static, none` |
| "Every condition and logical operator on the root level has its own failure message" | `failure_message` |

**The gap is `execution_context`.** 421's header lists four things it had missed
on a first pass and corrected; execution context is not among them, and the word
appears nowhere in that migration. The page's section says a criterion can test
whether the action was submitted inside an Ontology Scenario — and
`readings/api-action-type.md` already established that **we have no scenario at
all**, so the missing template is the same absence seen from a second direction,
not a separate defect.

## 3. What the images add, which is most of the surface

**The overview** draws the whole editor as a card titled `Execution`:

- a root row reading `Match All conditions below:` with the operator word in
  amber — the word is the control;
- every row carries a **drag handle**, conditions and logical operators alike;
- nesting is shown by a vertical rule per level, and a nested
  `Match Any conditions below:` sits inside the outer `All`;
- a condition reads as a sentence: an object-type tile, the parameter, a `›`
  path separator, a base-type glyph, the property, the operator in *italic*, the
  value;
- each level ends with `+ Add a condition or a logical operator`, where
  "condition" and "logical operator" are separate links.

**The three pickers are one flow**, and each keeps a live sentence preview at the
top made of coloured pills — the parameter path, the operator, the value — with
the pill being edited highlighted. Every step is filtered:
`Only showing compatible options` on the value list and
`Only showing compatible operators` on the operator list, which is the page's

> operators are pre-filtered to only show a selection of operators valid for the parameter

— `action-types/submission-criteria.md`

made visible.

**The value picker's three kinds are tabs**: `Parameter`, `Specific value`,
`No value`. The page calls the middle one "a static value"; the UI calls it
`Specific value`, and ours stores `static`.

**Two naming differences worth recording rather than adopting.** The operator
table prints `matches`; the operator list in the screenshot reads
`matches regex`. The table is the enumeration, so `matches` — which is what
`submission_operators()` holds — is right by the rule CLAUDE.md now carries.

And the condition-template picker describes its three choices in a way the prose
does not:

> Current user — Define user attribute conditions that must be met in order to view rows.
> Parameter — Define what the value of parameters and environment variables must be in order to execute this action type.
> — action-types/images/submission_criteria_select_condition_template.png

**"in order to view rows"** is row-level-security wording on an action screen,
where the other two say "execute this action type". Recorded as an oddity of the
picker, not as a statement about what a criterion does — §1's prose is
unambiguous that it gates submission.

## 4. One warning that belongs in the surface, not just the schema

> Avoid using `NOT` conditions with group, marking, or organization memberships. Using a `NOT` condition in these circumstances is a misconfiguration. The platform supports scoped tokens, which carry only a subset of a user's permissions. These tokens may lack the attribute the `NOT` condition checks against, causing the condition to pass and grant more access than intended.

— `action-types/submission-criteria.md`

A `none` logical operator over a `group_ids` condition is exactly that shape. The
page calls it a misconfiguration and explains the mechanism, so this is an
`ontology_warnings()` arm — advisory, because the page warns rather than refuses.

## 5. The gate IS enforced, and this reading first said otherwise

I wrote that `apply_action` does not read these rows. **It does**, on the line
after its required-parameter loop:

```
pk_val := public.submission_criteria_verdict(p_action_type, p_parameters);
IF pk_val IS NOT NULL THEN
  RAISE EXCEPTION 'Actions:SubmissionCriteriaFailed — %', pk_val;
END IF;
```

`submission_criteria_verdict` conjoins the roots and returns the first failure's
message; `eval_criterion` walks the tree, implements `all`/`any`/`none`, and
handles **all ten operators**. That is the whole evaluation half, built and
wired, and its position matches the order `action-types/test-run` prints for the
execution log:

> **Execution log:** A step-by-step breakdown of the run, covering metadata loading, dependency validation, submission criteria, parameter validation, and edits calculation.

— `action-types/test-run.md`

**What is genuinely missing is narrower and more interesting.** The left side of a
condition evaluates for the `parameter` template and for `current_user.user_id`.
The other two user fields raise:

```
RAISE EXCEPTION 'Actions:CriterionNotEvaluable — current_user.% is not modeled yet'
  USING HINT = 'Groups and user attributes do not exist here; only user_id evaluates.';
```

**That hint is stale.** Groups exist — the security phase built them and
`auth_group_ids()` is a live helper. The branch was written before they did and
nobody revisited it, which is CLAUDE.md's "verify we do not have X" failure
sitting inside our own evaluator. It is also the exact field the page's worked
example needs, twice:

> Since a user in our example is a member of many groups but the comparison is to a single group, we need to select the `includes` operator to check for an overlap.

— `action-types/submission-criteria.md`

So a criterion of the kind the page teaches raises rather than evaluates.

**And I said the opposite to the operator before checking.** Third time today a
"we do not have X" claim of mine was wrong, against a rule that is written down.

## Decisions

1. **Build the editor as the page draws it**: a card, a root logical operator
   whose word is the control, drag handles, one vertical rule per nesting level,
   and `+ Add a condition or a logical operator` at every level.
2. **A condition renders as a sentence**, not a row of form fields — tile,
   parameter, `›`, property, italic operator, value.
3. **Filter both lists, and say so.** `submission_operators()` already carries
   the arity split; the value list filters by what the template allows. Both
   banners are the page's own wording.
4. **`execution_context` is NOT added.** The template it needs tests for a
   Scenario, and we have none. A third enum value whose only meaning is a feature
   we do not have is the half-built version CLAUDE.md forbids.
5. **The `NOT` warning becomes an `ontology_warnings()` arm**, not a CHECK. The
   page says avoid, not refuse, and `ontology_violations()` blocks a save.
6. **Attachment and object set parameters are excluded from the picker** — "These
   parameter types are removed from the selection panel."
7. **No test run in this pass.** The page ends by pointing at one; it is a
   separate page and a separate engine.
8. **Make `current_user.group_ids` evaluable**, using `auth_group_ids()`. The
   evaluator refuses it on a hint that stopped being true when the security
   phase shipped groups, and it is the field the page's own example needs.
9. **`current_user.attribute` maps to what we actually have**, and fails closed
   otherwise — the page says "If a user does not have access to an attribute,
   they will fail the condition", so an unknown attribute name is a failing
   condition rather than an error.

## Questions

1. **Where does this live in our Ontology Manager?** The course names a
   "Security & Submission Criteria" tab; the screenshot's card is titled
   `Execution`. We have neither, and `ActionTypesPage` has no tabs at all.
2. ~~What evaluates a criterion at submission time?~~ **Answered, and this
   reading had it wrong — see §5.**
3. **Is `attribute` enough for "any other multipass attribute"?** Ours stores an
   `attribute_name`; the page also describes an `Other user attribute` field for
   attributes the user cannot see, which may be a second flag.
