<!-- source: https://palantir.com/docs/foundry/ontology/ontology-anti-patterns/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Ontology design: Anti-patterns

Even experienced Ontology designers can fall into common design traps that seem reasonable initially but create significant problems as the Ontology grows. This section identifies recurring anti-patterns, explains why they occur, and provides concrete guidance for avoiding or resolving them.

Avoiding these anti-patterns will help you build an Ontology that accurately represents your business domain, reduces maintenance overhead, and enables powerful cross-functional workflows.

| Anti-pattern | Description | Solution |
|-------------|-------------|----------|
| [System Silos](#anti-pattern-system-silos) | Creating separate object types for each source system. | Merge data in pipelines; create unified object types. |
| [The Kitchen Sink](#anti-pattern-the-kitchen-sink) | Including unnecessary technical columns as properties. | Curate properties intentionally; exclude ETL metadata. |
| [Department Silos](#anti-pattern-department-silos) | Each department creates their own version of shared entities. | Create shared object types; use properties and links for department-specific data. |
| [The God Object](#anti-pattern-the-god-object) | One object type represents multiple distinct entities. | Create distinct object types; use interfaces for shared characteristics. |
| [The Golden Hammer](#anti-pattern-the-golden-hammer) | Relying too heavily on a single tool (action types, pipelines, or functions, for example) for every problem instead of choosing the right capability. | Match the tool to the job: batch or streaming pipelines for data processing, actions for human decisions, automations for event-driven reactions, functions for complex real-time logic. |
| [Action Sprawl](#anti-pattern-action-sprawl) | Creating many single-property actions instead of cohesive business operations. | Design actions around business operations that bundle related changes into meaningful workflows. |
| [The Time Machine](#anti-pattern-the-time-machine) | Modeling historical versions as separate objects or object types. | Use a single object per entity with linked history/amendment objects and time series properties. |
| [The Misnomer](#anti-pattern-the-misnomer) | Using vague, generic, or misleading names for Ontology elements.	| Use specific, descriptive names; qualify ambiguous properties; name links by relationship. |

## Anti-pattern: System Silos

System Silos occur when you create separate object types for the same real-world entity based on the source system the data originates from, rather than modeling the entity itself.

### Common causes

* Different teams own different source systems and build independently
* Uncertainty about how to merge data from multiple sources
* Desire to preserve system-specific fields without deciding what's essential

### Example

Your organization has employee data in three systems: an HR system, a badge access system, and a project management tool. Instead of creating a single `Employee` object type, you create:

* `HR System Employee`
* `Badge System Employee`
* `Project Management Employee`

### Problems

| Problem | Impact |
|---------|--------|
| Fragmented view of reality | End users cannot see a unified view of an employee; they must navigate multiple object types to understand the full picture. |
| Duplicated effort | Action types, link types, and applications must be built multiple times for what is conceptually the same entity. |
| Inconsistent data | The same employee may have conflicting information across object types with no clear source of truth. |
| Complex maintenance | Changes to business logic must be replicated across all system-specific object types. |

### Solution

Create a single object type representing the real-world entity and use data pipelines to merge information from multiple source systems into a unified backing dataset.

```
✗ Avoid                          ✓ Prefer
─────────────────────────────    ─────────────────────────────
HR System Employee               Employee
Badge System Employee         →  (backed by merged dataset
Project Management Employee      from all three systems)
```

To implement this:

1. Identify the primary key that uniquely identifies the entity across systems (for example, employee ID).
2. Build a transform that joins data from all source systems.
3. Define clear precedence rules for conflicting values (for example, HR system is authoritative for job title).
4. Create a single object type backed by the merged dataset.

***

## Anti-pattern: The Kitchen Sink

This anti-pattern (also known as "everything but the kitchen sink") occurs when object types include unnecessary columns from external systems that have no business relevance in the Ontology context, cluttering the data model with technical artifacts.

### Common causes

* "Just in case" mentality (keeping fields that might be useful later)
* Lack of clarity on what fields are meaningful
* Direct mapping from source systems without curation
* Fear of losing data by excluding columns

### Example

When creating a `Customer` object type from a CRM system integration, you include all available columns:

* customer\_id ✓
* customer\_name ✓
* email ✓
* \_crm\_extracted\_at ✗
* \_crm\_received\_at ✗
* \_crm\_batched\_at ✗
* \_crm\_sequence ✗
* \_crm\_table\_version ✗
* \_crm\_internal\_record\_id ✗
* last\_etl\_update\_timestamp ✗

### Problems

| Problem  | Impact |
|----------|--------|
| Confusion  | End users see irrelevant technical fields alongside business data.  |
| Performance degradation  | Unnecessary properties increase data scale, compute, index size, and slow down searches.  |
| Obscured insights | Important business properties are buried among system metadata.  |

### Solution

Curate properties intentionally. Only include columns that have clear business meaning and will be useful for workflows.

Use these guidelines when deciding which properties to include:

| Include  | Exclude  |
|----------|----------|
| Business identifiers (customer ID, order number) | Pipeline metadata |
| Human-readable attributes (name, description) | Internal system IDs with no business meaning |
| Dates relevant to business processes | Timestamps only relevant to data engineering |
| Status fields needed for filtering or actions | Audit columns for pipeline debugging |

To implement this:

1. Review each column and ask: "Would someone ever need to see, search, or filter by this?"
2. Keep technical metadata in the backing dataset for debugging, but do not expose it as properties.
3. Use property visibility settings to hide any borderline properties that must exist but are rarely needed.
4. Document why each property exists and who uses it.

***

## Anti-pattern: Department Silos

Department Silos occur when different departments create their own versions of the same object type, leading to a fragmented Ontology that mirrors organizational structure rather than business reality.

### Common causes

* Departments work in isolation without cross-functional coordination
* Each team believes their view of the customer is unique
* Lack of governance or central Ontology design authority
* Teams want autonomy and control over "their" data

### Example

Multiple departments need to work with customer data, and each creates their own object type:

* Sales team creates `Sales Customer`
* Support team creates `Support Customer`
* Finance team creates `Billing Customer`
* Marketing team creates `Marketing Contact`

All four object types represent the same real-world entity: a customer.

### Problems

| Problem | Impact |
|---------|--------|
| No single source of truth | Different departments have conflicting information about the same customer. |
| Impossible cross-functional workflows | Cannot easily answer questions like "Show me all interactions with this customer across sales, support, and billing". |
| Duplicated development | Each department builds redundant actions, links, and applications. |
| Governance nightmare | Data quality issues multiply; fixes in one object type do not propagate to others. |

### Solution

Create shared object types that serve multiple departments, using properties and links to capture department-specific information where needed.

```
✗ Avoid                          ✓ Prefer
─────────────────────────────    ─────────────────────────────
Sales Customer                   Customer
Support Customer           →       ├── salesStatus (property)
Billing Customer                   ├── supportTier (property)
Marketing Contact                  ├── billingAccountId (property)
                                   └── Links to:
                                       ├── Sales Opportunities
                                       ├── Support Tickets
                                       └── Invoices
```

To implement this:

1. Identify entities that exist across departmental boundaries.
2. Establish a cross-functional working group to define shared object types.
3. Use properties to capture department-specific attributes on shared objects.
4. Use link types to connect shared objects to department-specific objects (such as `Customer` → `Support Ticket`).
5. Leverage object views or curated Workshop and OSDK applications if departments need different "views" of the same underlying entity.
6. Use restricted views if specific properties can only be accessible by a specific team.

***

## Anti-pattern: The God Object

The God Object anti-pattern occurs when a single object type is overloaded to represent multiple distinct real-world entities, resulting in a bloated, confusing, and unmaintainable object type.

### Common causes

* Over-abstraction driven by superficial similarities ("they are all assets")
* Desire to minimize the number of object types
* Lack of clear entity definitions before building
* Scope creep as more use cases are added to an existing object type

### Indicators

* An object type has many properties that are frequently null
* Property meanings change based on another property's value (such as type or category)
* You find yourself asking "What kind of `[Object]` is this?" when viewing an object
* Business rules and validations require extensive conditional logic based on object "type"

### Example

You create an `Asset` object type intended to represent "anything valuable," which ends up including:

* Physical equipment (trucks, machinery)
* Software licenses
* Real estate properties
* Financial instruments
* Employees (as "human assets")

The object type has 150+ properties, most of which are null for any given object, and the meaning of properties like value, location, and status varies completely depending on what kind of "asset" the object represents.

### Problems

| Problem | Impact |
|---------|--------|
| Semantic confusion | End users cannot understand what an `Asset` actually represents. |
| Sparse data | Most properties are null for most objects, making the data hard to interpret. |
| Impossible validation | Cannot enforce business rules because rules differ by entity type. |
| Poor search experience | Searching for `Assets` returns a mix of unrelated things. |
| Action type complexity | Actions must handle wildly different entity types with complex conditional logic. |

### Solution

Create distinct object types for distinct real-world entities. Use interfaces to model shared characteristics when entities genuinely share common properties or behaviors.

```
✗ Avoid                          ✓ Prefer
─────────────────────────────    ─────────────────────────────
Asset                            Equipment
  - assetType                    Vehicle
  - assetSubtype                 Software License
  - value                  →     Property (Real Estate)
  - location                     Financial Instrument
  - status
  - 145 more properties...       Interface: Depreciable Asset
                                   - purchaseDate
                                   - purchaseValue
                                   - depreciationSchedule
```

To implement this:

1. List the distinct real-world entities currently represented by the object type.
2. Create separate object types for each distinct entity.
3. Identify genuinely shared properties and behaviors.
4. Use interfaces to model shared characteristics across object types.
5. Migrate existing objects to appropriate new object types.

***

## Anti-pattern: The Golden Hammer

The Golden Hammer anti-pattern occurs when you rely too heavily on a single tool to solve every problem, even when other approaches are more appropriate. The name comes from the saying: ["If all you have is a hammer, everything looks like a nail" ↗](https://en.wikipedia.org/wiki/Law_of_the_instrument).

This anti-pattern manifests in the overuse of action types in work better suited for pipelines, building pipelines for logic that should be event-driven automations, or writing functions for calculations that are better pre-computed in a transform.

### Common causes

* Overreliance on a tool due to familiarity and visibility within the team
* Desire to give end users "control" over when computations happen
* Lack of familiarity with the full platform (including pipelines, automations, functions, and scheduled builds)
* Thinking exclusively in one layer (Ontology-first, pipeline-first, or code-first) without considering the full toolkit

### Examples

**Overreliance on action types:**

You need to calculate aggregate metrics for a dashboard showing total sales by region. Instead of using a data pipeline to pre-compute these metrics, you create an action type called `Calculate Regional Sales Totals` that end users must manually trigger. Results are written back to objects via the action.

**Overreliance on pipelines:**

An alert object is created by a pipeline when sensor readings exceed a threshold. You want to automatically assign that alert to the on-call engineer and send a notification. Instead of using an automation that reacts to the new object, you build additional pipeline logic that tries to resolve the assignee and write the assignment into the backing dataset, mixing operational workflow logic into data integration.

**Overreliance on functions:**

You implement a simple property derivation like `fullName` = `firstName` + `lastName` as a function-backed column, adding runtime overhead and a code repository to maintain, when a single pipeline `concat` expression would suffice.

### Problems

| Problem | Impact |
|---------|--------|
| Scalability limits | Each tool has different execution limits; using the wrong one hits ceilings early. |
| Unnecessary complexity | Maintaining logic in the wrong layer increases the number of moving parts. |
| User burden | End users must perform steps that the platform could handle automatically. |
| Performance issues | Real-time calculations via actions or functions are slower than pre-computed pipeline results. Conversely, scheduled pipelines are too slow for event-driven reactions. |
| Difficult debugging | When logic lives in the wrong layer, failures are harder to diagnose and resolve. |

### Solution

Choose the right tool for the job based on your use case:

| Tool | Best for | Not ideal for |
|------|----------|---------------|
| Action types | Human decisions, user-initiated edits to one or a few objects, input-driven changes that should apply immediately. | Batch calculations, scheduled updates, event-driven reactions with no human involvement. |
| Pipelines (batch) | Batch data processing, aggregations, cleansing, enrichment, pre-computing derived values on a schedule or on data arrival. | Real-time reactions to individual object changes, logic that requires human input. |
| Pipelines (streaming) | Continuous, low-latency data processing where results must stay current as source data arrives (real-time dashboards, live status tracking, continuous enrichment). | Infrequent updates where batch is sufficient, logic that requires human input, reacting to Ontology-level events (use automations). |
| Automations | Event-driven reactions to Ontology changes (object created, property updated, schedule triggered), orchestrating actions or notifications without user involvement. | Heavy data processing, complex multi-dataset joins, logic that requires human judgment. |
| Functions | Complex real-time computations across multiple objects, validation logic, derived values that depend on live Ontology state and cannot be pre-computed. | Simple derivations computable in a pipeline, batch processing of large datasets. |
| Schedules | Recurring pipeline builds, time-based or event-based orchestration of data refresh. | Reacting to individual object-level changes in real time. |

Examples of applying this guidance:

```
✗ Avoid                                          ✓ Prefer
──────────────────────────────────────────────   ──────────────────────────────────────────────
Action: "Calculate Regional Sales"          →    Pipeline that aggregates sales data daily
                                                 into a "Regional Sales Summary" object type.

Action: "Standardize Address Format"        →    Pipeline that cleanses addresses on ingestion.

Action: "Update Inventory Status"           →    Pipeline that sets status based on quantity
(based on quantity thresholds)                   thresholds during each sync.

Action: "Assign Risk Score"                 →    Pipeline or model that calculates risk scores
(using a formula)                                and writes to the backing dataset.

Pipeline that assigns alerts to on-call     →    Automation that triggers an "Assign Alert"
engineers by writing to the backing dataset      action when a new "Alert" object is created.

Pipeline that sends a notification when     →    Automation that monitors for the condition
an object meets a condition                      and sends a notification or triggers an action.

Batch pipeline polling every minute for     →    Streaming pipeline that continuously processes
new IoT sensor readings                          sensor data as it arrives.

Function-backed column for                  →    Pipeline that computes fullName = firstName
fullName = firstName + " " + lastName         + " " + lastName in the backing dataset.

Scheduled pipeline running every minute     →    Automation that reacts to the specific object
to check for objects needing follow-up           change and triggers the follow-up immediately.
```

To implement this:

1. **Before creating an action type**, ask: "Does this require human judgment or user input?" If not, it likely belongs in a pipeline or automation.
2. **Before adding logic to a pipeline**, ask: "Is this a data transformation, or is it an operational workflow?" Data cleansing, aggregation, and enrichment belong in pipelines. Assigning work, sending notifications, and reacting to individual changes belong in automations.
3. **Before writing a function**, ask: "Can this be pre-computed in the backing pipeline?" If the result only depends on source data columns and does not need live Ontology traversal, compute it upstream.
4. **Before building a polling pipeline** (running every N minutes to detect changes), ask: "Can an automation react to this event directly?" Automations respond to Ontology changes in near-real-time without the overhead of scheduled builds. If the need is for continuous data processing from a source system, consider a streaming pipeline instead.
5. **Before defaulting to a batch pipeline**, ask: "Does this data need to be continuously current?" If consumers depend on low-latency freshness, a streaming pipeline avoids the compromise of a batch schedule.
6. **Use automations** to bridge the gap between "something changed" and "something should happen", without requiring a user to click a button or poll a pipeline.

***

## Anti-pattern: Action Sprawl

Action Sprawl occurs when you create many narrowly-scoped action types that each modify a single property, rather than designing cohesive actions that represent meaningful business operations.

### Common causes

* Thinking of actions as database column updates rather than business operations
* Building actions incrementally without considering the overall user experience
* Lack of understanding of how actions can bundle multiple property changes
* Mimicking CRUD operations from traditional application development

### Indicators

* More than 10 action types for a single object type
* Multiple actions that are always performed in sequence
* Action names that read like `Set [Property]` or `Update [Property]`
* End users complaining about too many steps to complete a task

### Example

For an `Employee` object type, instead of creating meaningful business actions, you create:

* `Update Employee First Name`
* `Update Employee Last Name`
* `Update Employee Email`
* `Update Employee Phone`
* `Update Employee Department`
* `Update Employee Manager`
* ...and 20 more single-property actions

### Problems

| Problem | Impact |
|---------|--------|
| Overwhelming experience | End users face a long, cluttered list of actions and struggle to find the right one. |
| Fragmented workflows | Simple updates require multiple action submissions to complete a single business task. |
| No cohesive business representation | Actions do not map to real-world processes, making the Ontology unintuitive. |
| Fragmented audit trails | History of changes is scattered across many small actions, making it difficult to understand what happened and why. |

### Solution

Design action types around business operations, not database updates. Create actions that bundle related changes into meaningful workflows.

```
✗ Avoid                                    ✓ Prefer
────────────────────────────────────────   ────────────────────────────────────────
Update Employee First Name                 Update Employee Contact Information
Update Employee Last Name            →       - firstName
Update Employee Email                        - lastName
Update Employee Phone                        - email
                                             - phone

Update Employee Department                 Transfer Employee to New Department
Update Employee Manager              →       - newDepartment
Update Employee Location                     - newManager
                                             - newLocation
                                             - effectiveDate

Create Employee Record                     Onboard New Employee
Set Employee Start Date              →       - All required fields for a new hire
Assign Employee Badge                        - Triggers downstream workflows
Assign Employee Equipment                    (badge assignment, equipment request)
```

To implement this:

1. Map out the real business processes that involve changing object data.
2. Group related property changes into single actions that represent those processes.
3. Use action parameters to allow optional fields within a cohesive action.
4. Name actions after the business operation: `Transfer Employee`, `Approve Purchase Order`, `Escalate Support Ticket`.
5. Use action rules and validation logic to enforce business constraints within the action.

***

## Anti-pattern: The Time Machine

The Time Machine anti-pattern occurs when you model historical versions of an entity as separate objects or object types rather than using time series data, snapshots, or proper versioning strategies.

### Common causes

* Desire to preserve a complete history of every change
* Misunderstanding of how to model temporal data in the Ontology
* Applying file-versioning mental models (v1, v2, v3) to object design
* Lack of awareness of time series properties or linked history patterns

### Indicators

* Object type contains multiple objects representing the same real-world entity at different points in time
* Properties like `version`, `revision`, or `isCurrent` exist to distinguish copies
* Object counts grow proportionally with the number of changes rather than the number of entities
* End users are confused about which object to reference or link to

### Example

To track changes to a `Contract`, you create:

* `Contract v1`, `Contract v2`, `Contract v3` as separate objects within the same object type
* Or worse: `Contract 2023`, `Contract 2024`, `Contract 2025` as separate object types for each year

Each "version" is a full copy of the contract with slightly different property values, and links to other objects (such as `Vendor` or `Department`) are duplicated across all versions.

### Problems

| Problem | Impact |
|---------|--------|
| Object count explosion | Every change creates a new object, rapidly inflating the Ontology with redundant data. |
| Ambiguous current state | It is difficult to identify which version is the "current" or authoritative version. |
| Ambiguous links | Links to contracts become unclear; which version should a `Vendor` or `Department` link to? |
| Complex reporting | Reporting across time periods requires filtering and deduplication logic that is error-prone. |

### Solution

Use a single object per entity with properties for current state. Store historical changes in a separate linked object type, enable edits history, or leverage time series properties.

```
✗ Avoid                                    ✓ Prefer
────────────────────────────────────────   ────────────────────────────────────────
Contract v1 (object)                       Contract (single object per contract)
Contract v2 (object)                 →       - currentValue
Contract v3 (object)                         - currentStatus
                                             - effectiveDate
— OR —                                       - Links to:
                                               └── Contract Amendments
Contract 2023 (object type)                        - amendmentDate
Contract 2024 (object type)                        - previousValue
Contract 2025 (object type)                        - newValue
                                                   - changeReason
```

To implement this:

1. Use a single object per real-world entity with properties reflecting the current state.
2. Create a separate linked object type (such as `Contract Amendment` or `Contract History`) to capture historical changes.
3. Leverage time series properties for values that change frequently and need temporal tracking.
4. Use the backing dataset or edits history to maintain full historical records for audit trails if needed.

***

## Anti-pattern: The Misnomer

The Misnomer anti-pattern occurs when you use vague, generic, or misleading names for object types, properties, and link types that do not clearly communicate their meaning, leading to confusion and misinterpretation across the Ontology.

### Common causes

* Using shorthand names that make sense to you but not to others
* Names are carried over directly from source system column names without translation
* Desire for brevity over clarity
* Lack of naming conventions or governance standards
* Assumption that context will make meaning obvious

### Indicators

* End users frequently ask "What does this property mean?" or "What kind of `[Object]` is this?"
* The same name could reasonably refer to multiple different concepts
* Property names are single generic words like `value`, `type`, `status`, `date`, or `name` without qualification
* Link types use generic labels like "related to" without specifying the nature of the relationship

### Example

You create the following Ontology elements with ambiguous names:

* Object type: `Item` (What kind of item? Product? Line item? Inventory item?)
* Property: `value` (Monetary value? Quantity? Score? Rating?)
* Property: `type` (Type of what? What are valid values?)
* Property: `date` (Created date? Modified date? Due date? Effective date?)
* Link type: `Item` → `Related Item` (How are they related? Parent-child? Substitute? Accessory?)

End users encountering these names must guess at their meaning or dig into documentation to understand what the data actually represents.

### Problems

| Problem | Impact |
|---------|--------|
| Misinterpretation | End users cannot understand the Ontology without additional context, leading to incorrect analysis and decisions. |
| Steep learning curve | New team members must spend significant time learning what vague names actually mean. |
| Documentation dependency | Documentation becomes essential rather than supplementary, and falls out of date quickly. |
| Cross-team confusion | Different teams interpret the same vague names differently, leading to inconsistent usage. |

### Solution

Use specific, descriptive names for all Ontology elements. Names should be self-documenting so that anyone can understand meaning without additional context.

```
✗ Avoid                                    ✓ Prefer
────────────────────────────────────────   ────────────────────────────────────────
Object type: Item                    →     Object type: Product
                                           Object type: Sales Order Line Item
                                           Object type: Warehouse Inventory Record

Property: value                      →     Property: monetaryValue
                                           Property: quantityOnHand
                                           Property: riskScore

Property: type                       →     Property: productCategory
                                           Property: serviceTier

Property: date                       →     Property: orderPlacedDate
                                           Property: contractEffectiveDate

Link: Item → Related Item            →     Link: Product → Purchasing Customer
                                           Link: Employee → Supervisor
                                           Link: Equipment → Manufacturing Facility
```

To implement this:

1. Establish naming conventions before building and enforce them through governance reviews.
2. Use specific, descriptive names: `Product`, `Sales Order Line Item`, `Warehouse Inventory Record`.
3. Qualify ambiguous properties: `monetaryValue`, `quantityOnHand`, `riskScore`.
4. Name links explaining the relationship: `Purchasing Customers`, `Manufacturing Facility`, `Supervisor`.
5. Add descriptions to all Ontology elements explaining their meaning and valid values.
6. Review names with end users to ensure they are intuitive and unambiguous.

## Building a successful Ontology

The anti-patterns described in this guide are common but avoidable. By focusing on the fundamental best practices (modeling reality rather than systems, curating properties intentionally, collaborating across teams, and choosing the right tools for each task), you can build an Ontology that scales with your organization's needs.

Remember that effective Ontology design is iterative. Start with clear entity definitions, involve stakeholders early, and refine your model as you learn what works. When you encounter challenges, revisit the principles in this guide to identify whether an anti-pattern may be emerging and course-correct before it becomes difficult to change.
