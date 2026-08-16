---
verify: strict
---

# Reading — Ontology: core concepts

Pages read in full:
- `mirror/ontology/core-concepts.md` — "Core concepts"

Read, and nothing below quotes it: `mirror/ontology/_index.md` — the section
front door ("Ontology building"), which lists what the pages beneath it define.

Images read: `images/airline-ontology.png` (the diagram the whole page is built
around), `images/ontology-overview-header.png` (decorative).

---

## What the pages say

### The Ontology is an operational layer, not a schema

`_index`: "The Palantir **Ontology** is an operational layer for the
organization." It "sits on top of the digital assets integrated into the Palantir
platform (**datasets, virtual tables, and models**) and connects them to their
real-world counterparts, ranging from physical assets like plants, equipment, and
products to concepts like customer orders or financial transactions."

**Three input kinds, not one.** Datasets, virtual tables and models. We have only
ever built against tables.

`core-concepts`: "An Ontology is a categorization of the world. In Foundry, the
Ontology is the digital twin of an organization… mapping datasets and models to
object types, properties, link types, and action types."

And the boundary they draw against what it is not: "Far beyond data cataloging or
schema design solutions."

### Semantic and kinetic elements

`_index` splits the Ontology in two, and this framing is not in `core-concepts`:

- **semantic elements** — objects, properties, links
- **kinetic elements** — actions, functions, **dynamic security**

"containing both the semantic elements (objects, properties, links) and kinetic
elements (actions, functions, dynamic security) needed to enable use cases of all
types."

So security is not a wrapper around the Ontology; it is listed as a *constituent*,
alongside actions and functions.

### The dataset analogy — the load-bearing paragraph

"You can think of each object type as analogous to a dataset; an object is an
instance of an object type, just as a row is one entry in a dataset."

| Datasets | Ontology |
|---|---|
| Dataset | Object type |
| Row | Object |
| Column | Property |
| Field | Property value |
| Join | Link type |

**This is the whole argument for the datasource model in one table.** An object
type is a dataset — a real table with real columns. A property is a column. A link
type is a join. It is why a universal `object_records` table with a jsonb blob was
wrong: it makes every property a field of one column, so nothing in the analogy
survives.

### The definitions, verbatim where they matter

- **Object type** — "the schema definition of a real-world entity **or event**".
  **Object** — "a single instance". **Object set** — "a collection of multiple
  object instances".
- **Property** — "the schema definition of a characteristic". **Property value** —
  "the value of a property on an object".
- **Shared property** — "a property that can be used on multiple object types…
  allow for consistent data modeling across object types and **centralized
  management of property metadata**".
- **Link type** — "the schema definition of a relationship between two object
  types". **Link** — "a single instance of that relationship".
- **Action type** — "the schema definition of a set of changes or edits to
  objects, property values, and links that a user can take **at once**. It also
  includes the **side effect behaviors** that occur with action submission."
- **Roles** — "the central permissioning model in the Ontology… Roles can be
  granted on the **Ontology level or the individual resource level**."
- **Functions** — "a piece of code-based logic that takes in input parameters and
  returns an output… they can take objects and object sets as input, read property
  values of objects, and be used across action types and applications".
- **Interfaces** — "describes the shape of an object type and its capabilities…
  provide object type **polymorphism**".
- **Object Views** — "a central hub for all information and workflows related to a
  particular object… key information, any linked objects, and related metrics, as
  well as analyses, dashboards, and applications related to the object."

---

## What the image adds, that the prose does not

`airline-ontology.png` — five object types (Airport, Flight, Delay, Airline,
Aircraft), each box showing **Object Type / Object / Properties** on one instance.

1. **Two link types can join the same pair of object types.** Airport and Flight
   are connected by **two separate directed arrows**: "Departed From" and
   "Arrived To". The prose never says this. It means a link type is identified by
   its *role*, not by the pair it connects — and any model keyed on
   (source_type, target_type) alone is wrong.
2. **Link names are natural-language phrases**, title-cased and directional:
   "Hub For", "Delayed By", "Operated By", "Flown By", "Owned By". Not snake_case
   verbs.
3. **An event gets a first-class object type.** "Delay" is an object type with
   properties (Duration, Arrival/Departure, Cause) and an instance ("38 Minute
   Delay"). The prose says "entity or event"; the diagram shows the event modelled
   exactly like the entity, not as an attribute of Flight.
4. **Properties shown are concrete and typed by implication** — Airport has
   **Lat./Long.**, which is the geopoint base type; Flight has "Passenger Count".
5. **The instance line is the title key doing its job**: **Object: JFK**, and for
   Flight, **Object: JFK -> SFO 24-02-2020 15:22** — a composed human label, not an id.
6. The caption states the scale of a *useful* example: "A simple ontology of 5
   object types displays some of the properties and relationships within airline
   industry datasets."

---

## Connects to

- **`object-link-types/create-object-type.md`** — "select a location to generate a
  dataset". The dataset analogy above is why that is the shape.
- **`interfaces/interface-overview`** — polymorphism, 9 mirrored pages unread.
- **`object-views/overview`** — Object Views as the hub; we deleted ours, and the
  definition here is broader than what we had (analyses and applications, not just
  fields and links).
- **`data-integration/virtual-tables`** — the input kind we have never considered.
- **Our `link_types`** — has `source_object_type_id` + `target_object_type_id` +
  `api_name`. Two link types over the same pair is therefore already expressible.
  Worth an explicit test when link types get built.
- **Our deleted `object_records`** — the dataset analogy is the clean statement of
  why it had to go.
- **Our `projects` + `project_role_grants`** — resource-level roles exist;
  **Ontology-level roles do not**.

## Decisions taken from this reading

None yet — this is the frame. The build suggestions below are proposals, not
decisions, pending the operator's agreement (2026-08-06).

## Open questions

- **Primary key** is not mentioned on either page, though `create-object-type`
  lists it as a required step. Read that page before designing the object type.
- **Dynamic security** is named as a kinetic element and never defined here.
  Which page defines it?
- **Virtual tables** as an Ontology input — what does mapping one look like versus
  a dataset?
- Does an Ontology-level role differ in kind from a resource-level one, or only in
  scope?
