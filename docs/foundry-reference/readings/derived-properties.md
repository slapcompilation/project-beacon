---
verify: strict
---

# Reading — Derived properties, the third property source

545 corrected the second source type and deliberately left the third unbuilt,
on the grounds that it is an expression language rather than a column reference
and so needed its own reading. This is it.

**Read in full:** `object-link-types/derived-properties` (the how-to) and
`ontology/derived-properties` (the concept page, found on a second pass), with
the derived-property paragraph of `object-permissioning/object-security-policies`.

**Images parsed:** `object-link-types/images/configure-derived-property-aggregation.png`
(the one that gives the data shape), and the three others the page carries —
`configure-derived-property-source-tab.png`, `configure-derived-property-link-selection.png`,
`configure-multi-hop-link.png`.

**Status:** the page is marked **Beta** — "may not be available on your
enrollment. Functionality may change during active development."

## What it is

> Derived properties are properties that are calculated at runtime based on
> values from linked objects. Instead of storing data directly, a derived
> property pulls information from objects connected through link types,
> optionally applying aggregations like averaging, counting, or collecting
> values into lists.

Two consequences the page states outright:

> Derived properties are **read-only** and cannot be edited by functions or
> actions. These properties use the security context of all objects involved in
> the calculation, ensuring users only see information for which they have
> access authorization.

The security sentence matters here more than it looks. A derived property is
computed across objects the caller may or may not be able to see, and the page
resolves that by using **the security context of every object involved**, not
the context of the object being read. Our restricted views and per-caller gate
already work that way, so this is a shape we have rather than a new one.

## The shape, which the image gives more exactly than the prose

The configuration is an **ordered chain of link hops ending in one property**,
with an aggregation and a limit beside it:

> Linked objects · Read only
> Properties derived from a linked object or traversed across multiple linked
> objects, are read only and cannot be edited by functions or actions.
> Movie Roles [Role]
> Movie [Movie]
> Add linked object
> Aggregation · Collect set
> Property · Title
> Limit · 10
> — object-link-types/images/configure-derived-property-aggregation.png

Each row names a **link type** and shows the object type it lands on in
brackets — so the chain resolves a type at every hop, and the final hop's type
is what the property dropdown is drawn from:

> The dropdown menu shows all available properties from the final object type in
> your link chain.

**Depth is capped, and the page says so twice:**

> After selecting a link type, you can optionally add additional link types to
> traverse multiple levels of connections (up to 3 levels).

> Derived properties support traversing up to **3 levels** of linked objects.

## When an aggregation is required, and the nine of them

> If any link in your chain has a "many" cardinality (one object linking to
> multiple objects), you must select an **Aggregation** to combine the values:

So the aggregation is **not always required** — a chain of only "one" links
yields a single value and needs none. That is a conditional constraint on the
cardinality of every hop, which we can compute, because `link_types` already
holds cardinality.

The nine, quoted rather than summarised because they are a closed vocabulary:

> * **Count:** Count the number of linked objects.
> * **Average:** Calculate the average of numeric values.
> * **Sum:** Calculate the sum of numeric values.
> * **Minimum:** Select the minimum value.
> * **Maximum:** Select the maximum value.
> * **Approximate cardinality:** Estimate the number of unique values.
> * **Exact cardinality:** Count the exact number of unique values.
> * **Collect list:** Collect all values into an ordered list (preserves duplicates).
> * **Collect set:** Collect all unique values into an unordered set.

Two of them carry their own rules:

> For **Count** aggregation, you do not need to select a property as objects are
> automatically counted.

> If you selected **Collect list** or **Collect set** as your aggregation, you
> can optionally set a limit on the number of items collected. The default limit
> is 10 items.

So `Count` is the one aggregation with **no target property**, and the limit
applies to exactly the two collect aggregations. The image confirms the default
by showing `10` in the Limit field beside `Collect set`.

## The limitations, which are the CHECK constraints

The page ends with ten, quoted here in its own order:

> * **Inline actions:** Properties with inline actions configured cannot be converted to derived properties.
> * **Value types:** Properties with value types cannot be converted to derived properties.
> * **Required properties:** Derived properties cannot be marked as required (non-nullable).
> * **Property type constraints:** Derived properties cannot have property type constraints.
> * **Display formatting:** Derived properties cannot have rule set bindings or base formatters.
> * **Primary keys:** Primary key properties cannot be derived properties.
> * **Ontology condition:** Derived properties are not supported for the Default ontology.

Those seven are refusals a constraint can carry. The other three are
environmental rather than structural — OSv1 indexing, text search and keyword
filters, and structs in the TypeScript OSDK.

**`required` and `is_primary_key` are columns we already have**, so two of these
are enforceable the day this is built. The value-type and inline-action refusals
name things we also have.

## Decisions

1. **A derived property is a third `source`, not a new table of properties.** It
   sits beside `column` and `user_input` on `object_type_properties`, because
   the page reaches it through the same **Source type** control.
2. **Its configuration is an ordered chain, so it needs its own rows** — one per
   hop, each naming a link type, with a position. A jsonb blob would be the
   universal-table mistake in miniature; the hops are real entities with a real
   order, and `link_types` is a real table to point at.
3. **The chain terminates in (aggregation, property, limit)**, where the
   property is absent exactly for `Count` and the limit applies exactly to the
   two collect aggregations.
4. **Depth is capped at 3** and an aggregation is required exactly when some hop
   is a "many" — both computable from `link_types` cardinality rather than
   stored.
5. **Seven of the ten limitations are constraints**, and two of those
   (`required`, `is_primary_key`) can be enforced against columns that exist.
7. **A derived property names neither a column nor a datasource** — see below.
   Its security comes from the source objects, so the third CHECK arm asserts
   both are absent and the hops carry the meaning.
6. **Not built from this reading yet.** The Decisions above want reciting first,
   and this is Beta — worth saying out loud, since we have shipped Beta features
   before (branch overlay) but only deliberately.

## Answered — the datasource question, and a second page I had missed

**There are two derived-properties pages, in different sections.** I read
`object-link-types/derived-properties`, the how-to. `ontology/derived-properties`
is the concept page, and it was not in my reading at all. It broadens the
definition:

> Derived properties are properties that are calculated at runtime based on the
> values of other properties or links on objects. This includes aggregating on
> or selecting properties of linked objects.

**"other properties or links"** — so a derived property is not necessarily a
traversal. Deriving from another property of the *same* object is in scope, and
the how-to page never says this because every one of its worked examples is a
link chain. My Decisions below describe only the traversal case.

It also names where they can be used — the TypeScript OSDK's `withProperties`
operation — and adds a limitation the other page omits:

> * **Marketplace:** Functions using derived properties are not currently supported in Marketplace.

**And it answers the datasource question outright:**

> Derived properties use the security of all objects involved in the
> calculation, so they do not expose information a user would otherwise be
> unable to see.

`object-permissioning/object-security-policies` says the same from the other
side, and adds a consequence:

> * You cannot test derived property visibility, as this also relies on the
>   user's visibility on the derived property's source object.

**So a derived property does NOT occupy a datasource.** Its security comes from
the *source objects* involved in the calculation, not from permissioning to a
dataset — which is exactly the opposite of the edit-only property 545 built,
where the page demanded a dataset precisely "to ensure data consistency and
security". Two source types, two different answers to where security comes
from, each stated on its own page.

The Source-tab screenshot corroborates it. The Properties table's **Column**
cell reads `primary-key` for the key, `Edit-only` for five properties, and is
**blank** for the derived property being configured — three states, and the
derived one claims no column and shows no datasource:

> Actor username · primary-key
> New property 1
> Birth Date · Edit-only
> Avg movie rating · Edit-only
> — object-link-types/images/configure-derived-property-source-tab.png

That screenshot also shows the object type editor's full left nav, which is
wider than the four seen in `developer-console`: `Overview`, `Properties`,
`Security`, `Datasources`, `Observability`, `Capabilities`, `Object views`,
`Interfaces`, `Materializations`, `Automations`, `Usage`, `History`.

**Consequence for the CHECK.** 545's constraint admits two arms, both requiring
something: a column, or a datasource. A derived property requires **neither**,
so the third arm asserts both are absent — and the hops carry the meaning.

## Questions
2. **What happens to a derived property on a branch?** The chain crosses object
   types that may be edited on a branch, and `read-media-content` showed the API
   is branch-aware. Nothing here mentions branches.
3. **Does `up to 3 levels` mean 3 links or 3 object types?** The worked example
   traverses Department to Employee to Project — two links, three object types —
   and is introduced as multi-hop. The image shows two rows for that shape. So
   the cap most likely counts **object types**, giving at most two or three
   links; the page is not explicit and a constraint would have to pick.
   *(Inference, flagged.)*
