---
verify: strict
---

# InterfaceType, and the inheritance I said we did not have

**CORRECTED 2026-08-21.** §2 of this reading was wrong. Interface extension is
**built** — `interface_extensions`, `interface_ancestors()`, a cycle guard, a
collision rule, resolution inside both conformance assertions, a save path and a
picker in `InterfaceDetail`. It shipped in 450, before this reading was written.
What follows is the original §2 struck through, the mechanism as it actually
stands, and the probe that produced the false claim — because the probe is the
transferable part.

**Why this reading exists.** The fourth reading of a resource shape from `api/`.
It claimed to be the first to find a whole documented mechanism missing rather
than a field; the mechanism was there.
(`api-authentication.md` read the corpus before any of these; the "first from
`api/`" claim in `api-object-type.md` was wrong and propagated through three
readings before anyone counted the files.)

**Pages read:** `api/ontologies-v2-resources-ontology-interfaces-get-interface-type`
— the `InterfaceType` response, 1,666 lines, read for its thirteen top-level
fields rather than every nested property shape — and `interfaces/extend-interface`
in full.

**Also quoted:** `interfaces/_index`.

**No images.** `api/` pages carry none.

---

## 1. Thirteen fields, and four of them are one idea

`rid`, `apiName`, `displayName`, `description`, `properties`, `allProperties`,
`propertiesV2`, `allPropertiesV2`, `extendsInterfaces`, `allExtendsInterfaces`,
`implementedByObjectTypes`, `links`, `allLinks`.

The pairs are not duplicates. Every `all*` is the transitive closure:

> A list of interface API names that this interface extends, both directly and indirectly.

— `api/ontologies-v2-resources-ontology-interfaces-get-interface-type.md`

So the api returns both what an interface *declares* and what it *has* once
inheritance is resolved — which is only meaningful if inheritance exists.

## 2. It does, on its own page — and 450 built it

> An interface inherits the shared properties, link type constraints, and action type constraints of the interface it extends. An interface can extend any number of other interfaces.

— `interfaces/extend-interface.md`

and the section page puts the depth beyond doubt:

> Interfaces can also extend multiple other interfaces, including interfaces that themselves extend other interfaces, resulting in properties that are inherited through layers of interfaces.

— `interfaces/_index.md`

### What I wrote, and why it was false

```
STRUCK — the original sentence, kept so the mistake is legible:
  "ontology_interfaces has no extends column and no join table carries one —
   information_schema has no table whose name contains extend."
```

**The sentence is literally true and completely misleading.** The table is
`public.interface_extensions`, and `interface_extensions` does not contain the
substring `extend` — *extensio**n***, no `d`. A substring probe answered *no*
for a table sitting in `public` with three functions and a trigger on it.

**The transferable lesson:** a negative from a substring grep is not a negative.
Ask the catalogue for the shape, not for a spelling — join `pg_class` on
`pg_trigger`/`pg_proc`, or list the tables of the schema and read them, or grep
the migrations for the concept rather than the identifier. The same class of
error as `check:readings` proving a quote is in *some* page: a probe whose
"no" means less than it looks like.

### What is actually there

| inheritable | ours | inherited? |
|---|---|---|
| shared properties | `interface_properties` | **yes**, via `interface_ancestors()` |
| link type constraints | `interface_link_constraints` | **yes**, in `assert_implementation_conforms` |
| action type constraints | `action_type_rules.interface_id` (592) | **yes**, in `assert_action_constraints_conform` |

- **`interface_extensions(interface_id, parent_interface_id)`** — edges, so
  "An interface can extend any number of other interfaces" is a row count, not
  a column.
- **`interface_ancestors(uuid)`** — a recursive CTE up the edges, which is the
  transitive closure the api publishes as its `all*` maps, and which answers
  `interfaces/_index`'s "interfaces that themselves extend other interfaces".
- **`guard_interface_extension`** on the table refuses a cycle
  (`Ontology:InterfaceExtensionCycle`), refuses an inherited api-name collision
  (`Ontology:InheritedPropertyCollision`), and refuses extending across
  ontologies (`Ontology:ExtensionCrossesOntologies`). 450 marks the cycle rule
  a declared invention, since no page mentions cycles.
- **`apply_interface(..., p_extends)`** saves the set, and
  `InterfaceDetail.tsx` has the picker.

**The documented cascade needs no code, and that is the interesting part.**
The api says removing an extension "will remove all inherited shared properties
from the interface, remove all inherited link type constraints, remove all
inherited action type constraints". Ours resolves inheritance **at read time**
through `interface_ancestors()` rather than materialising it, so deleting the
edge removes the inherited clauses by construction. Foundry's sentence describes
the observable effect; a resolving implementation gets it for free.

**Zero rows today.** The mechanism is built and unused, which is a different
condition from missing — and the one this repository keeps confusing.

## 3. What the api confirms we got right

**`propertiesV2` is the model we already have.** The V1 map is narrower than it
looks:

> This field only includes properties on the interface that are backed by shared property types.

— `api/ontologies-v2-resources-ontology-interfaces-get-interface-type.md`

while V2's admits both — an interface property can be backed by a shared property
or defined directly on the interface. `interface_properties.source` is
`local | shared`, with a CHECK tying `shared` to a non-null
`shared_property_id`. That is V2 exactly, and it was arrived at without this
page.

`implementedByObjectTypes` is `interface_implementation_mappings`, and `links` is
`interface_link_constraints`.

## 4. Two of ours the api does not carry

`ontology_interfaces.icon` and `.searchable` appear nowhere in `InterfaceType`.
On the evidence of `readings/api-object-type.md` and `api-link-type.md` — where
`pointOfContact`, `contributors` and per-side visibility were all Ontology
Manager metadata a program never sees — that is the expected position rather than
a defect. Recorded, not chased.

## Decisions

1. **Nothing is built from this reading** — and the original reason was wrong.
   The original reason — extension being a phase we had not started — was false;
   it shipped in 450, and this reading failed to find it. ~~It needs its own reading of
   `interfaces/extend-interface` before anything is designed.~~ 450 was built
   from `readings/interfaces-phase.md`, which read that page.
2. ~~**Do not add an `extends` column as a placeholder.**~~ Moot: the edges
   table exists and resolves. The advice was sound and aimed at nothing.
3. **`interface_properties` stays as it is.** The api's own V2 shape is what we
   have. *(Unaffected by the correction.)*
4. **A negative from a substring grep does not settle "we do not have X".**
   This is the fourth time this month a stale or false absence claim of mine
   reached a reading or a comment. The rule already exists in CLAUDE.md; what
   this adds is the failure mode — the probe was wrong, not just old.

## Questions

1. ~~Does anything of ours want interface inheritance yet?~~ **The mechanism is
   there and carries zero rows.** The demand is still unmeasured, which was the
   only half of this question that was right.
2. **Are `icon` and `searchable` on an interface documented anywhere in prose?**
   Neither is in the api. Their migrations should say; this reading did not check.
3. **What is `allLinks` when a link constraint is overridden by a child?** The
   page says constraints are inherited, not what happens when both declare one.
