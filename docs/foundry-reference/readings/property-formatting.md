---
verify: strict
---

# Property formatting: conditional rules and value formatters

Two pages, one property-pane subject: how a raw value becomes the thing a
user reads. The queue's hook was 634's import caveat — an error name
(`OntologyMetadata:UnreferencedRuleSets`) about a thing our property model
could not hold.

**What I read, counted rather than asserted.**
`object-link-types/conditional-formatting` (76) and `value-formatting` (84),
whole. **Images: thirteen of thirteen parsed** —
`conditional-formatting-cond-form-example.png`, `-wifi-rules.png`,
`-type-rules.png`, `-cond-form-oma.png`, `-rule.png`,
`-rule-editor-string.png`, `-copy-rule-select-annotated.png`,
`-copy-rule.png`, `value-formatting-numeric-formatting-example.png`,
`-toggle.png`, `-numeric-formatting.png`, `-date-formatting.png`,
`-relative-to-now.png`. Nothing skipped.

## 1. Conditional formatting: ordered rules on a property

> "**Conditional formatting** enables the configuration of rules for any property and dictates how that property's values will be rendered (e.g. coloring, alignment, etc.) in user facing applications. When you configure conditional formatting in the Ontology Manager, the formatting rules will apply in Object Explorer, Object Views, Quiver, and Workshop."

— `object-link-types/conditional-formatting.md`

The property pane's card is the storage shape in miniature: "CONDITIONAL
FORMATTING — Rules (evaluated from top to bottom)", one row per rule with a
color swatch, a sentence summary ('Type is "A320".'), a delete ×, and
up/down reorder arrows, under an "Add a rule" button
(`object-link-types/images/conditional-formatting-type-rules.png`).
**Order is the semantics** — evaluated top to bottom, and the prose's
fallback advice ("Use **Always true** as a fallback in case your other rules
do not match") only works if the first matching rule wins.

**The rule editor** (`object-link-types/images/conditional-formatting-rule-editor-string.png`)
is two halves. RULE: a three-way switch — Standard | Always true | Math —
then an Apply-formatting-if property picker, marked as this-property but
reassignable:

> "The rule will always be applied to the property from which you selected **Add a rule**; however, this dropdown allows you to choose to apply the rule based on the value of another property."

— `object-link-types/conditional-formatting.md`

then a comparison typed by the property ("for strings **String comparison**
and **Is null** are available. For numeric types, **Numeric range** or
**Exact numeric match**"), an operator ("**String comparison** has **Is
exactly**, **Contains**, **Starts with**, etc."), values entered as a
constant or referenced from another property (the editor's Add-constant and
Add-reference links), a case-sensitivity toggle, and a True/False polarity
("To color all planes in blue that are **not** A320, switch this to
**False**"). The boolean variant offers an exact-boolean-match comparison
with an is-true toggle
(`object-link-types/images/conditional-formatting-rule.png`).

FORMATTING: a kind dropdown — the boolean capture shows **Intent →
Success**, the string capture **Custom color → Cobalt 4** with a swatch
(`object-link-types/images/conditional-formatting-rule.png`,
`object-link-types/images/conditional-formatting-rule-editor-string.png`) —
matching:

> "Use Blueprint colors and intents or add your own custom color. You can also switch alignment."

— `object-link-types/conditional-formatting.md`

PREVIEW renders "in display context…" — Table, or a Property card.

**Copy rules** is a dialog (COPY RULES FROM → TO, multi-select of target
properties) whose footer states the semantics twice
(`object-link-types/images/conditional-formatting-copy-rule.png`):

> "Copied rules will continue referencing their original properties. For example, if a rule states that `wifi` values should appear green when "true," and that rule is copied to the `customer experience` property, values of the `customer experience` property will also be green when the object's `wifi` value is "true.""

— `object-link-types/conditional-formatting.md`

> "If the properties you are copying to already have their own conditional formatting rules, they will be overwritten by the new rules."

— `object-link-types/conditional-formatting.md`

Rendering: the Explorer table draws matching values as tinted chips —
colored text on a light tint with a border, per cell
(`object-link-types/images/conditional-formatting-cond-form-example.png`).
Precedence over type classes is stated: "Conditional formatting takes
precedence over existing type classes".

## 2. Value formatting: one formatter per property, typed by base type

> "**Value formatting** refers to applying a special formatter to the value of a property, transforming the raw value to a more readable version."

— `object-link-types/value-formatting.md`

The published kinds, from the page's own table: numeric, date and time,
Foundry ID ("Display a Foundry ID as a user's first and last name or group
name."), resource RID ("Display a Foundry resource ID (RID) as an icon and
resource name, with a clickable link that routes to that resource."), and
artifact GID. The pane shows the formatter card typed by the base type —
a plain "VALUE FORMATTING" toggle for a string, "NUMERIC FORMATTING" /
"DATE AND TIME FORMATTING" for those types
(`object-link-types/images/value-formatting-toggle.png`,
`object-link-types/images/value-formatting-numeric-formatting.png`).

**Numeric options** (prose table + capture): base type (Currency, Unit,
Percentage, Prefix/Suffix, Fixed Values — the capture's dropdown reads
"Standard unit" with a unit picker "Pound"), use grouping, notation
(Compact/Scientific/Engineer), min/max fraction digits, min/max significant
digits, minimum integer digits — and the capture adds an option the prose
table omits: **"Negative to parenthesis"**
(`object-link-types/images/value-formatting-numeric-formatting.png`). A
PREVIEW RESULT input renders live ("123456" → "123,456 lb").

**Date and time options** — a vocabulary split: the prose table says "Date
and time (long)" / "Date and time (short)"; the capture's dropdown says
"Date and time" / "Date and time, short"
(`object-link-types/images/value-formatting-date-formatting.png`). The six:
Date, Date and time, Date and time short, ISO instant, Relative to now,
Time — with the relative cap:

> "When formatting **Relative to now**, applications will only format in relative terms up to 24 hours ago. After this, it will render in **Date and time (short)** form with the day of the week: `Wed, Jul 22, 2020, 1:00 PM`."

— `object-link-types/value-formatting.md`

and timezones:

> "If you are formatting a timestamp, you can specify which timezone to render the timestamp, either as a static timezone that you input, or as the application user's current timezone."

— `object-link-types/value-formatting.md`

**User IDs** are the Multipass username option — typically for actions that
stored `prefill_current_user`-style IDs. **Resource RID formatting** is the
renderer the schedule rule's status link already waits on (668's recorded
residual): icon + name + live status as a link.

## 3. The 634 caveat, decoded

> "An exported Ontology working state with conditional formatting rules configured on its properties cannot be imported to an Ontology other than the one it was exported from."

— `ontology-manager/export-import.md`

> "If you receive the error `OntologyMetadata:UnreferencedRuleSets`, you are trying to import an Ontology working state with conditional formatting rules that are not defined in that Ontology and cannot be transferred over."

— `ontology-manager/export-import.md`

The error name says Foundry stores conditional formatting as **rule sets**,
ontology-scoped entities that properties reference — which is exactly why a
cross-ontology import dangles. No page surfaces rule sets as a first-class
thing a user manages; the UI edits them purely per property.

## 4. What our substrate holds, probed

`object_type_properties` has no formatting columns; 634's `import` path
exists (`export_working_state` and its import partner); the Explorer table
and object pages are the rendering consumers. Blueprint intents and palette
are already our tokens.

## Decisions

1. **Two jsonb columns on the property**, validated per shape the
   audit-categories way: `format_rules` (an ordered ARRAY — top to bottom is
   the semantics — of {kind standard|always_true, condition {property_id,
   comparison, operator, values[], case_sensitive, negate}, formatting
   {type intent|custom, intent?, color?, alignment?}}) and
   `value_formatting` ({kind numeric|datetime|user|resource_rid, options
   per kind — numeric with the capture's full option set including
   negative-to-parenthesis; datetime with the six styles and a timezone
   static-or-user}). Rules referencing other properties carry property_id,
   which makes the copy-rules semantics ("continue referencing their
   original properties") fall out of a plain jsonb copy.
2. **Not a rule-set entity.** The error name hints Foundry stores rule sets
   ontology-scoped, but no page lets a user touch one; per-property jsonb is
   what every capture edits. Inference, stated: if a rule-sets page ever
   surfaces, this is the recorded divergence to revisit.
3. **The Math rule kind is excluded** with its reason: it runs "math
   operators on some of your properties" — an expression grammar no page
   specifies beyond one sentence. Recorded, not invented.
4. **Artifact GID formatting is excluded** — artifacts are a product we do
   not have. Resource RID formatting is admitted and doubles as the schedule
   rule's status-link renderer.
5. **The save path carries both columns** (the 670 pattern), and the 634
   import guard closes the queue's hook: importing a working state whose
   format rules reference properties that do not exist in the target
   ontology refuses with the page's own name,
   `OntologyMetadata:UnreferencedRuleSets`.
6. **The surface**: the property pane's two cards (VALUE FORMATTING /
   CONDITIONAL FORMATTING with ordered rule rows and reorder arrows), the
   rule editor's two halves with live preview, copy rules, and the Explorer
   table rendering (tinted chips, formatted numerics and dates) — its own
   PR, built to the captures.

## Questions

1. **First match wins?** Stated only through the fallback advice; ours:
   first matching rule top-to-bottom applies, Always-true matches
   everything. `blocks: nothing.`
2. **What exactly does alignment admit?** "switch alignment" and "align the
   boxes on the right hand side" — ours: left|right. `blocks: nothing.`
3. **Fixed Values numeric base** — named in the options list, never
   specified. Excluded from the numeric options until a page shows it.
   `blocks: nothing.`
