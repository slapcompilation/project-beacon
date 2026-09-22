---
verify: strict
---

# Reading — classification-based access controls

Item 157 of the parity queue, and the one item of the first chunk I will not
build unattended. Its own queue entry says *a reading first*, and CLAUDE.md makes
building from a reading non-autonomous by construction — that gate exists so an
invented mechanism has to declare itself. This reading is the declaration.

Pages read in full:
- `mirror/security/classification-based-access-controls.md` (82 lines)
- the CBAC section of `mirror/object-permissioning/ontology-permissions.md`

The CBAC page references five images. I opened **none** of them, deliberately:
image-reading agents have exhausted this session's limit twice, and every claim
below rests on prose. Their captions are descriptive enough to say what they
would add, and the one that matters is named in Question 3 rather than assumed.

## What the pages say

**It is off by default and configured outside the platform.**

> "Classification-based Access Controls are not enabled by default on Foundry. Classification markings can differ between institutions and can therefore be configured differently between Palantir environments. Configuration of classification markings requires Palantir involvement."

That single sentence is the most important one for us, and it is discussed under
Decision 1.

**Three characteristics distinguish classification markings from ordinary ones.**
Hierarchy ("a group of users who are only eligible to access sensitive data
marked as Secret or below"); disjunctive components; and ubiquity — CBAC
environments "require all Projects to have a Project classification set" and "all
datasets are required to have a data classification".

**The combinator lives on the category, and we already model that.**

> "When a category is conjunctive (`AND`), a user must have access to all classification markings used from that category to access the classified data. When a category is disjunctive, a user can be authorized to access marked classified data by having any one marking of that category."

> "The components of an entire classification are combined conjunctively. This means that if a classification contains classification markings from multiple categories, a user must satisfy all components from each of the classification markings category to access the data."

**Three classifications, and they answer different questions.**

> "File classification is the classification that users must satisfy to discover the file."

> "Data classification refers to the classification that users must satisfy to view the data in the file. Users must satisfy the data classification in order to view the data within the file, but it does not affect their ability to discover the existence of the dataset and view its metadata (such as name, description and schema)."

> "The data classification cannot be edited directly"

— the file classification, and the data classifications of all upstream data
dependencies, so that "the data classification is always at least as strict as
the file classification and the data classifications of all of the upstream data
dependencies."

> "Project classifications control who is able to discover a project and access the resources inside of it. In order to access a resource, a user must satisfy the resource's project classification and the resource's file and data classification."

And a contrast that is easy to get backwards:

> "Project classifications do not affect the data classification of datasets in a project, so project classifications are not inherited along data dependencies. If there are derived downstream datasets in other projects, only the *data* classification is inherited. This is different from the behavior of project markings, which are inherited by downstream datasets."

**Project maximum classification is a separate dial.**

> "Project maximum classifications specify the maximum classification for all resources inside of a project."

It is also called the allowed marking limit, in the page's own quotation marks, and:

> "Resources with a higher data or file classification cannot be created or moved into a project with a lower maximum classification."

> "Project maximum classifications are equal to the project classification by default at project creation, but they can be edited or removed independently of the project classification."

**And it touches the ontology directly**, which is why this item is in the queue
at all:

> "Removing a project's max classification may be required to add object or link types to a project. Note though that if an object or link type is in a project, it will fail to materialize if it lacks a file classification."

`ontology-permissions.md` states the same three rules for ontology resources: a
file classification must be specified when creating the resource, it "must be
equal to or lower than the [project maximum classification]", and "Object type
materializations fail if no classification is specified".

**The violation behaviour is published in full**, and it is a warning plus a
build stop rather than a refusal: an inherited data marking that exceeds the
project maximum leaves the data "protected by the higher classification", shows a
warning, and makes it "not possible to build the dataset or any downstream
resources in the project until the violation is resolved", with two named
resolutions.

## What we have, measured

- **The combinator is built.** `marking_categories.category_type` is
  `conjunctive | disjunctive` and `satisfies_markings` already combines BY
  CATEGORY — all-of within a conjunctive category, at-least-one within a
  disjunctive one, and conjunctively across categories. That is exactly the
  paragraph quoted above, and 828 fixed the one place it was wrong.
- **Four CBAC tables exist and all hold ZERO rows:** `marking_implied`,
  `marking_disallowed`, `marking_requirements`, `cbac_marking_colors`.
  `marking_implied` is wired into `satisfies_markings` itself;
  `marking_disallowed` and `marking_requirements` are read only by
  `cbac_marking_restrictions` and `marking_value_allowed`.
- **`marking_implied` is a flat `(marking_id, implied_marking_id)` pair**, read
  one level deep. It is the closest thing we have to the page's HIERARCHY, and
  one level is not a hierarchy.
- **File, data and project classification have NO representation.** No column on
  any resource table, no function. Zero.

## Decisions

**None of this is built. This block is the thing to read before any of it is.**

1. **The first decision is whether to build it at all, and it is not mine.** The
   page opens by saying CBAC is "not enabled by default", varies per institution,
   and that configuring it "requires Palantir involvement". So there is no single
   published configuration to copy — the mechanism is published, the content is
   per-enrollment. That makes this the one item in the first chunk where "build
   what Foundry builds" does not settle the question, and where building the
   mechanism with nothing to put in it risks the half-built foundation the top of
   CLAUDE.md warns about. **My recommendation: build the three classifications
   and the maximum, skip the hierarchy for now** — see 5.
2. **Classification is a MARKING, not a new kind of thing.** The page calls them
   "classification markings" throughout and files them in categories exactly like
   other markings. So this reuses `markings` + `marking_categories` with a
   category flagged as a classification category, rather than a parallel table.
   The alternative — a `classifications` table — would split one concept in two
   and is refused.
3. **File classification is a column; data classification is DERIVED and must not
   be writable.** "The data classification cannot be edited directly" — the page continues with how it is formed instead. So data
   classification is a function over (file classification, upstream data
   dependencies), the same shape `effective_data_markings` already has for
   markings — which is a strong hint that this rides on the existing lineage
   rather than inventing a second traversal.
4. **Project classification and project maximum are two separate columns**, not
   one with a default. The page says the maximum starts equal to the
   classification "but they can be edited or removed independently", and the
   maximum is REMOVABLE while the classification is "not removable".
5. **Hierarchy is the part I would leave out of a first build, and say so
   loudly.** "Secret or below" is a total order within a category, and the page
   describes it without ever defining how the order is expressed —
   `marking_implied` is our nearest mechanism and is one level deep. Building a
   hierarchy from that would be inventing the ordering. Either it is read out of
   another page I have not found, or it is per-enrollment configuration, and I
   would rather ship the non-hierarchical arms than guess the ordering.
6. **The violation is a WARNING plus a BUILD STOP, not a refusal**, and those are
   different rungs here: `ontology_warnings()` for the notice, and a refusal
   inside the build path for "not possible to build... until the violation is
   resolved". Putting it in `ontology_violations()` would block a save, which the
   page does not say happens.
7. **The materialization rule lands with it or not at all.** "if an object or
   link type is in a project, it will fail to materialize if it lacks a file
   classification" is the one sentence that connects CBAC to what we have already
   built, and a classification column with no materialization check would be the
   engine-nothing-reaches defect again.

## Questions I could not answer from the pages

1. **How the hierarchy is expressed.** See Decision 5. Nothing on either page
   says whether "Secret or below" is an ordering on markings within a category, a
   chain of implications, or enrollment configuration. This is the single
   unanswered question that most changes the schema.
2. **Whether an object type's file classification is its own column or the
   project's.** The ontology page says a file classification must be specified
   "when creating the resource", and object types are resources — but every
   classification example in the CBAC page is a dataset or a project.
3. **What the resource sidebar actually shows.** `file-data-class-screenshot.png`
   is captioned as showing "where Project, file and data classifications are
   displayed on the resource sidebar", so the anatomy is published and I did not
   open it. Whoever builds the surface should, and should check its dimensions
   first.
4. **Whether `marking_disallowed` and `marking_requirements` are CBAC's
   "valid combinations".** The page says "Rules on what constitutes valid
   combinations of classification markings can be configured by Palantir and
   enforced in platform", which is suggestive but does not name a mechanism, and
   our two tables predate this reading.
5. **What happens to an existing resource when a project's maximum is lowered.**
   The page covers creating and moving, and covers an inherited marking that
   arrives later, but not a maximum that moves under resources already there.
