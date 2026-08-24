---
verify: strict
---

# Required properties

The sweep's standing defect: the flag exists (408) and nothing checks it.
The page puts the check in exactly two places, and neither is the save.

**What I read, counted rather than asserted.**
`object-link-types/required-properties` (91 lines) whole, including the
worked two-datasource Movie example; both its images parsed —
`required_property.png` and `advanced_required_property.png`. Nothing
skipped.

## 1. Two enforcement points, and neither is the save

> "Required properties are object type properties that must have a value. You can use this object type property to validate that there are no objects that have a null value for this property, or an empty array if it is an array property. This validation applies to data from the backing datasource and edits via actions."

— `object-link-types/required-properties.md`

> "**Validation happens when data is being indexed into the object:** The check for null values happens as backing datasources are indexed into Object Storage. This means that the ontology modification itself will succeed if the column backing a required property contains null values."

— `object-link-types/required-properties.md`

> "**Changes via actions are validated at apply time:** If you attempt to write a null or empty value to a property via an action, the action will fail to execute."

— `object-link-types/required-properties.md`

And the failure mode at index time is stated for the editing flow too:

> "Note that if there is any null value currently set on the backing column for the property, the reindex will fail. To fix this, you must either update the backing datasource to no longer have nulls in the column, or unset the property as required."

— `object-link-types/required-properties.md`

So: the save succeeds, the INDEX fails, the ACTION refuses — our
`index_object_type` (which already fails a build job on a value-type
violation) and `apply_action` are the two homes, and `save_working_state`
stays out of it.

## 2. The empty-array half is its own toggle

> "**Array properties cannot be empty:** Setting an array property to required ensures the presence of at least one item."

— `object-link-types/required-properties.md`

> "You can configure your required property to allow empty arrays. This means that the property will still reject null values, but will accept empty arrays."

— `object-link-types/required-properties.md`

The capture settles the storage shape: the Configuration pane's toggle is
labeled "Require values" — not the prose's "Required" — with a gear
(`object-link-types/images/required_property.png`), and the gear opens two
switches, "No null values" and "No empty arrays"
(`object-link-types/images/advanced_required_property.png`). Two flags, not
one flag with an option.

The action-side consequence is stated precisely:

> "It is important to note that Actions will write an empty array to any property that is mapped to a parameter, but the parameter is not set. This means that if you have a required property that allows empty arrays, and you leave the parameter blank in an Action, the Action will succeed and write an empty array to the property."

— `object-link-types/required-properties.md`

## 3. The multi-datasource rule, with a printed answer

The worked Movie example (two datasources, `Genre` required and supplied by
the second) prints the answer the engine must reproduce:

> "The example above will successfully get indexed into the Ontology, despite the fact that the resulting object would have no value for the required property."

— `object-link-types/required-properties.md`

An object present only in datasource 1 indexes with a null required
property; an object present in both fails without `Genre`. Requiredness is
scoped to PRESENCE in the property's own datasource. Actions follow the same
rule:

> "However if the Action adds a property to the object that is sourced from `Datasource 2`, such as `Budget`, then the Action will be invalid and will fail to execute. This is because the object will now be present on `Datasource 2` and thus `Genre` must be set."

— `object-link-types/required-properties.md`

An edit touching ANY property of a datasource makes that datasource's
required properties bind for the object.

Object Storage v2 only — which our per-type index tables are.

## Decisions

1. **A second flag joins the first**: `object_type_properties` gains
   `allow_empty_arrays` (default false) — the gear's second switch inverted;
   `required` remains no-nulls. No CHECK ties it to array types; the page
   scopes it to arrays but a stored flag on a scalar is inert, not invalid.
2. **Index-time enforcement in `index_object_type`**: after the merge, a row
   violating a required property fails the build job by name — but ONLY for
   objects present in the property's own datasource, the worked example's
   rule. Null always violates; empty array violates unless allowed.
3. **Apply-time enforcement in `apply_action`**: an edit writing null (or an
   empty value) to a required property refuses by name — and the
   multi-datasource rule holds: the properties an edit binds are those of
   every datasource the edit touches, so writing `Budget` makes `Genre`
   required. The blank-mapped-array-parameter behaviour falls out of the
   flags: an empty array passes only when allowed.
4. **The probe encodes the printed answer**: the Movie example's two shapes —
   present-in-one-datasource indexes with the hole, present-in-both refuses
   without the value — plus the action-side pair.
5. **The surface**: the OMA property editor's Require-values toggle with the
   gear pair, recorded as a residual with the other Studio editor gaps.

## Questions

1. **What does "empty value" mean for a scalar via actions?** The page says
   "null or empty value"; for strings ours treats '' as empty (apply_action
   already treats blank as missing for required PARAMETERS). Applied here to
   the written property value. `blocks: nothing.`
2. **Does the reindex failure name the object or the property?** Unstated;
   ours names both in the job error. `blocks: nothing.`
