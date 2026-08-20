---
verify: strict
---

# The link type view, and ten more columns with no surface

**Why this reading exists.** The unread-column sweep, refined to tell an engine
with no caller from dead weight, put `link_types` at the top: **ten columns no
screen reads**, eight of them used by SQL and two named only where they were
created. They are not scattered leftovers — together they are one documented
page we have not built.

**This reading verifies as it goes.** The last one presented six decisions, three
of which did not survive the operator's verification request, because I had
grepped the mirror and not the courses. Every claim below is checked against
mirror, course and screenshot *before* being written down.

**Pages read:** `ontology-manager/overview` §Link type view, and
`object-link-types/create-link-type` §"Choose the relationship type" and
§"Foreign key relationship type".

**Course read:** `docs/foundry-deep-dives/01-ontology.md` §6, "Create the link type".

**Image parsed (1):** `ontology-manager/images/oma-user-interface-link-type.png`.

**Not parsed**, and named so the gap is on the record: the create page's
`create-link-relationship-type.png`. It belongs to the creation dialog, which
this reading does not cover.

---

## 1. Three join methods, and we have a column for exactly them

> **Object type foreign keys:** Supports "one-to-one" and "many-to-one" cardinality link types. This option allows you to select properties that represent the foreign key and corresponding primary key for the desired objects.
> … **Join table dataset:** For "many-to-many" cardinality link types. This option allows you to use a join table dataset to back the link.
> … **Backing object type:** Object-backed link types expand on many-to-one cardinality link types, providing first class support for object types as a link type storage solution.

— `object-link-types/create-link-type.md`

The screenshot draws them as three selectable cards under a **Configuration**
heading, labelled `Foreign key`, `Dataset` and `Object type`, the selected one
carrying a blue border and a pale fill. The prose confirms the same control is
editable after creation:

> In the **Configuration** section, update the join method and select **Object type**.

— `object-link-types/create-link-type.md`

The course saw two of the three and said so plainly, which is a useful check on
the screenshot rather than a contradiction of it:

> Link definition page: Join method tabs **Foreign key | Dataset**
> — docs/foundry-deep-dives/01-ontology.md

**Ours already models this.** `link_types.backing_kind` exists, with
`dataset_id`/`branch_id` for the join table, `source_key_column`/
`target_key_column` for the key pairing, and `backing_object_type_id` for the
object-backed case. All of it, and nothing on a screen.

## 2. What the screenshot adds

**Header.** Source tile and name, a link glyph, target tile and name — and
underneath, the cardinality **as a sentence**: `Many-to-one link type`. Right,
an `Actions ▾` button.

**Metadata card**, the same two-column shape as an object type's: `Ontology` on
the left; `Status` with its dropdown top-right, then a rule, then `ID` and `RID`.
**The RID reads `ri.ontology.main.relation.651e59…`** — a link type is a
`relation` in the RID grammar, not a `link-type`.

**Configuration card.** The three join-method cards, then the prose "Choose the
object types you wish to link and the property to use as a foreign key", then a
**cardinality diagram** — three source tiles fanning into two target tiles, which
is what many-to-one looks like — then the pairing: a source object type dropdown
(greyed), a target object type dropdown, and under them the source property
(`Carrier Code`), a **swap button**, and the target property (`Code`) carrying a
`Primary key` tag.

**Properties 0** below it, a link type's own properties.

**Left rail:** `Overview`, `Security`, `Datasources`, `Usage`. The prose says:

> Selecting a link type from the link type graph of an object type's **Overview** tab (see image below) opens the link type view (with **Overview** and **Datasources** pages).

— `ontology-manager/overview.md`

**Two of four.** The prose undercounts what its own screenshot shows, and it is
the sentence that names the image. Recorded because taking the prose alone would
have built half the rail — and because it is the second time on this page that
prose and screenshot disagree in the screenshot's favour.

## 3. The eight columns are two directions of one link

The course records what the object type view's screenshot does not:

> Both directions get sentence renderings and **API names**
> — docs/foundry-deep-dives/01-ontology.md

and

> Per-direction Visibility. Status Experimental
> — docs/foundry-deep-dives/01-ontology.md

**Weakened by `readings/api-link-type.md`, and worth knowing before citing it.**
That sentence is in the hand-written SUMMARY. The lesson's own extracted text
says nothing about visibility, and #728 established that no extraction reaches
text inside a PDF's screenshots — so the chain ends at someone's transcription of
a picture. The api does not carry per-side visibility either. The columns stand;
the evidence for them is transcription-grade, not a quotation.

That is the whole cluster:

| column | what it holds |
|---|---|
| `source_label`, `target_label` | the two direction sentences the course renders — each Flight Alert has *one* Flight, each Flight has *many* Flight Alerts |
| `source_api_name`, `target_api_name` | the two generated API names — `FlightAlert.oftFlight`, `oftFlight.FlightAlerts2` |
| `source_visibility`, `target_visibility` | per-direction Visibility |
| `backing_kind` | the Join method |
| `backing_object_type_id` | the Object-type method's backing type |
| `source_key_column`, `target_key_column` | the foreign-key pairing |

**A link type is directional twice over**, and every one of those columns exists
because an earlier migration read that correctly. None of them has ever been
displayed. Our whole link types surface is a 57-line flat list: label, API name,
source → target.

## Decisions

1. **Build the link type view as a detail page**, reached from the list and from
   the object type Overview's link graph — a metadata card, a Configuration
   card, and the per-direction pairing. This gives all ten columns a reader.
2. **The metadata card is the one built in #721**, not a second implementation.
   Same two-column shape, same `Set on save` behaviour for an unsaved RID.
3. **The join method renders as three cards, and is read-only in this pass.**
   The prose says it is editable after creation, but changing it rewrites the
   link's backing — dataset, key columns and object type all move together —
   and a control that can leave a link half-rebound is worse than none.
   Question 1.
4. **Both directions are shown, each with its sentence, API name and
   visibility.** Showing one direction would misrepresent the model.
5. **The cardinality is rendered as prose**, `Many-to-one link type`, from the
   existing cardinality column — not as the fan diagram, which is illustration.
6. **The rail is Overview only, for now.** The screenshot shows four entries; we
   have no link-type Security, Datasources or Usage surface, and stubbing three
   empty tabs is the empty-state-forever problem. Declared, not hidden.
7. **`relation` is recorded, not adopted.** Foundry's link type RID says
   `ri.ontology.main.relation`. Ours is settled elsewhere and changing a RID
   grammar is not a UI change; see Question 2.

## Questions

1. **What does changing a join method do to an existing link's data?** The page
   says the Configuration section can update it; nothing says what happens to
   the rows already linked.
2. **Should our link type RID use `relation`?** Foundry's does. `project_dataset_layer`
   settled our RID grammar and this was not part of it.
3. **What generates the second API name's suffix?** The course shows
   `oftFlight.…FlightAlerts2` — a trailing `2` that nothing explains.
4. **Does a link type have properties of its own in our model?** The screenshot
   shows a `Properties 0` card; we have no link-type property table.
