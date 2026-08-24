---
verify: strict
---

# The action form trio: defaults, overrides, sections

Three short pages the sweep queue bundled because they are one subject — what
an action form does between "parameters exist" and "the user submits". Phase
C closed without them.

**What I read, counted rather than asserted.** The three pages whole:
`action-types/parameters-default-value` (43), `parameters-override` (35),
`configure-sections` (25); plus the rows of
`object-link-types/metadata-typeclasses` that the defaults page points at for
type-class prefills.

**Images: ten of ten parsed** — `default_value_static_configuration.png`,
`default_value_object_configuration.png`,
`default_value_type_class_configuration.png`, `default_value_static_example.png`,
`default_value_object_example.png`, `override_pop_up.png`, `override_tab.png`,
`override_block.png`, `form-overview.png`, `section-config.png`. Nothing
skipped.

**Two editor eras in one page's captures.** The default-value captures show
the parameter editor as stacked sections — General, Constraints, Default
value — where General carries three toggles, **Visible / Disabled /
Required**, each with its own "Add override" button
(`action-types/images/default_value_static_configuration.png`); the override
captures show an older tabbed editor — Value | Display | Overrides | Details
(`action-types/images/override_tab.png`). The three-toggle triple is the
newer capture's, and it maps onto our columns exactly: exposed, editable
(inverted), required.

## 1. Default values: three sources, one precedence rule

> "Default values for action type parameters are used to prefill parameters in the action form."

— `action-types/parameters-default-value.md`

The configuration offers a radio pair — "Object parameter property" | "As
static value" (`action-types/images/default_value_static_configuration.png`)
— and a third source rides type classes:

- **Static** — a fixed value.
- **Object property** — prefill from a property of an object parameter, with
  an ordering rule:

> "Only object reference parameters that are placed above the parameter in the input list are available to be used as a default value."

— `action-types/parameters-default-value.md`

  The example capture shows the form prefilled from the selected object and
  an "Edited" chip appearing on the one value the user changed
  (`action-types/images/default_value_object_example.png`) —

> "Note that the `Lifetime Hours` value shows as edited once this default value is updated by the action user."

— `action-types/parameters-default-value.md`

- **Type class prefills** — the capture draws them as namespace:name rows on
  the parameter, "actions : generate_uuid"
  (`action-types/images/default_value_type_class_configuration.png`), and the
  typeclasses page enumerates the actions namespace's three: `generate_uuid`
  ("Replaces a string parameter with a UUID." —
  `object-link-types/metadata-typeclasses.md`), `prefill_current_user`
  ("Replaces a string parameter with the current user." —
  `object-link-types/metadata-typeclasses.md`), and `view_object_with_type`
  ("Shows the created/modified object in the success toast." —
  `object-link-types/metadata-typeclasses.md`) — the third is a toast hint,
  not a prefill. And the guidance:

> "In most cases, you should set the parameter visibility to `hidden`, so that users do not manually change these special prefilled values."

— `action-types/parameters-default-value.md`

**Precedence** is stated once and generally:

> "Local default values (for example, Workshop variables) always take precedence over global default values."

— `action-types/parameters-default-value.md`

A default is a form-time prefill the user may override ("Set a default value
for the input. It can be overriden by users." is the editor's own caption —
`action-types/images/default_value_static_configuration.png`), never a
server-side fallback.

## 2. Overrides: if/then blocks, first true wins

> "Overrides are used to change a parameter's behavior and configuration under specific circumstances."

— `action-types/parameters-override.md`

The block is the unit — a header summarising the logic ("Condition on Ticket
overrides requiredness" — `action-types/images/override_block.png`), an
**If** holding a Match-All/Any tree of conditions, and a **Then** holding one
or more effect rows ("Is Hidden", "Is Required" with a toggle —
`action-types/images/override_pop_up.png`,
`action-types/images/override_block.png`). Ordering is the tie-break:

> "Every parameter can contain multiple override blocks, however, if more than one is true, only the first one will be executed."

— `action-types/parameters-override.md`

**The conditions are submission criteria's conditions**, reused wholesale —
the Add-override dialog's sidebar offers the same two templates verbatim,
"Based on current user" and "Based on parameter"
(`action-types/images/override_pop_up.png`) — with one narrowing:

> "The only difference between override conditions and submission criteria conditions is that only parameters which appear above the current parameter in the form hierarchy can be referenced in override conditions."

— `action-types/parameters-override.md`

What an override may change:

> "An override can change the configuration of the parameter's constraints, visibility, requiredness, and default values."

— `action-types/parameters-override.md`

And the advisory case is named as a warning, not a refusal:

> "If an override is configured to take on the same value as the default already set on the parameter, a warning will be shown on the override itself."

— `action-types/parameters-override.md`

## 3. Sections: grouping, columns, and their own overrides

> "These sections provide a logical grouping of parameters to organize an action form. Sections also support columns, descriptions, and conditional overrides."

— `action-types/configure-sections.md`

The section configuration capture carries the full grammar: Title,
Description, **Layout as 1 Column | 2 Columns** cards, a **Show title bar**
toggle captioned "Only sections with a title can be collapsed."
(`action-types/images/section-config.png`),
**Visibility as Visible | Hidden** cards, an ID (`section-1`) and a RID, a
SECTION CONTENT list with drag handles and "Create new parameter" / "Add
existing parameter", and an "Add a conditional override" button at the foot
(`action-types/images/section-config.png`). The rendered form shows sections
as bordered groups — two side-by-side fields in a two-column section, and a
collapsed "Business Targets" row (`action-types/images/form-overview.png`).

> "The description is not stylized and, unlike parameter descriptions, will always be shown in the section itself, not in a tooltip."

— `action-types/configure-sections.md`

> "A section can be hidden at first and only shown based on a prior parameter."

— `action-types/configure-sections.md`

Ordering is one list:

> "Parameters and sections display in the form based on their order in this **Form Content** section."

— `action-types/configure-sections.md`

## 4. What our substrate holds, probed

`action_type_parameters` (418) has required/exposed/editable/position and no
default-value or constraint columns; `action_type_submission_criteria` (421)
is already the exact condition tree the override dialog reuses (templates
current_user/parameter, logical all/any/none, the three value sources). No
constraints storage exists (min/max length, regex — the Constraints card is
unbuilt), so the constraints override arm is ledger-blocked the way
function-rule metrics were.

## Decisions

1. **Defaults are columns on the parameter**: `default_source`
   (`static | object_property | type_class`, NULL = none), `default_static`
   jsonb, `default_object_parameter_id` + `default_property_id` for the
   property source — with a guard holding the above-in-the-list rule — and
   `type_classes` as a text[] over the actions namespace's published trio
   (emit-only: `generate_uuid`, `prefill_current_user`,
   `view_object_with_type`).
2. **A default is a form-time prefill**; the surface prefills static and
   object-property values and marks user edits (the Edited chip). The two
   prefill type classes are ALSO honoured server-side in `apply_action` when
   the submitted value is absent — a hidden generate_uuid parameter must work
   without trusting the client. `view_object_with_type` stays a surface hint.
3. **Override blocks are rows**: `action_type_parameter_overrides`
   (parameter XOR section target, position for first-true-wins, and an
   `effects` jsonb validated per key — visible, disabled, required,
   default). Constraints effects wait for constraints storage.
4. **Conditions are the existing criteria tree, not a copy**:
   `action_type_submission_criteria` gains a nullable `override_block_id`, so
   one grammar serves both consumers (composed, never restated). A guard
   holds the only-parameters-above narrowing; the equal-to-base case lands in
   `ontology_warnings()` — the page says warned, not refused.
5. **Sections are rows**: `action_type_form_sections` (action, title,
   description, columns 1|2, show_title_bar, visible, position, api_name and
   a RID — the capture shows both; grammar inference). Parameters join by a
   nullable `section_id` + their existing position; the form is one ordered
   list of sections and loose parameters, the Form Content order.
6. **The resolver is a function**: `action_form_effective(action, params)`
   returns the per-parameter effective visible/disabled/required/default
   after first-true-wins blocks — the one place the semantics live, consumed
   by the form surface and by `apply_action` for requiredness at submit.
7. **The surface follows as its own PR**: the action form renderer grows
   sections (columns, collapse, description), default prefills with the
   Edited chip, and override-driven show/hide — consuming the resolver, never
   reimplementing it.

## Questions

1. **Does requiredness enforcement move server-side in Foundry?** Unstated;
   ours: `apply_action` consults the resolver so a required-by-override
   parameter cannot be omitted by a raw caller. `blocks: nothing.`
2. **Can a section reference its own parameters in its override conditions?**
   The above-only rule is stated for parameters; ours applies the same rule
   to sections (only strictly-prior form content). `blocks: nothing.`
3. **What does a constraints override contain?** Moot until constraints
   storage exists; recorded with it. `blocks: nothing.`
