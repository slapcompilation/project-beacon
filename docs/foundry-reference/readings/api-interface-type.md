---
verify: strict
---

# InterfaceType, and the inheritance we do not have

**Why this reading exists.** The fourth written from `api/`, and the first to
find a whole documented mechanism missing rather than a field.

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

## 2. It does, on its own page, and we have none of it

> An interface inherits the shared properties, link type constraints, and action type constraints of the interface it extends. An interface can extend any number of other interfaces.

— `interfaces/extend-interface.md`

and the section page puts the depth beyond doubt:

> Interfaces can also extend multiple other interfaces, including interfaces that themselves extend other interfaces, resulting in properties that are inherited through layers of interfaces.

— `interfaces/_index.md`

**`ontology_interfaces` has no `extends` column and no join table carries one** —
`information_schema` has no table whose name contains `extend`. We model all
three inheritable things and none of the inheritance:

| inheritable | ours | inherited? |
|---|---|---|
| shared properties | `interface_properties` | no |
| link type constraints | `interface_link_constraints` | no |
| action type constraints | `action_type_rules.interface_id` (592) | no |

This is the same shape as `applyScenario` in `readings/api-action-type.md`: not a
missing column, a missing mechanism, made visible by reading the api.

**It is also bigger than it looks.** Removing an extension is documented as
cascading — it "will remove all inherited shared properties from the interface,
remove all inherited link type constraints, remove all inherited action type
constraints" — so extension is not a pointer between two rows. Whatever builds it
owns a resolution step, which is what the `all*` maps are.

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

1. **Nothing is built from this reading.** Interface extension is a mechanism
   with a resolution step and a documented cascade on removal; it is a phase, not
   a column, and it needs its own reading of `interfaces/extend-interface` before
   anything is designed.
2. **Do not add an `extends` column as a placeholder.** A pointer with no
   resolution is the half-built version CLAUDE.md opens by forbidding — it would
   look like a foundation.
3. **`interface_properties` stays as it is.** The api's own V2 shape is what we
   have.

## Questions

1. **Does anything of ours want interface inheritance yet?** Nothing in the
   schema or the surface refers to it. The gap is real; the demand is unmeasured.
2. **Are `icon` and `searchable` on an interface documented anywhere in prose?**
   Neither is in the api. Their migrations should say; this reading did not check.
3. **What is `allLinks` when a link constraint is overridden by a child?** The
   page says constraints are inherited, not what happens when both declare one.
