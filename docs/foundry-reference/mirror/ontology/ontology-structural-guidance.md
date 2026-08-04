<!-- source: https://palantir.com/docs/foundry/ontology/ontology-structural-guidance/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Ontology design: Structural guidance

The following sections provide guidance on how to structure properties, relationships, and access control within the Ontology.

## Normalization and derived properties

**Store each fact once. Use derived properties for convenience.**

Denormalized data (copying values from linked objects onto a parent object) can be risky. When the data source changes, every copy must be updated. Normalization keeps data consistent, and derived properties give you the convenience of denormalized access without the upkeep.

Not all computed values are the same. The right approach depends on whether a value can be safely pre-computed from stable inputs or whether it needs to stay in sync with dynamic Ontology changes.

### Pre-computed vs. dynamically derived values

|Type	|Characteristics	|Recommended tool	|Example|
|-|-|-|-|
|Pre-computed	|Computed from properties on the same object; inputs rarely change or only change due to pipeline ingestion.	|Pipeline transform	|`fullName` = `firstName` + " " + `lastName` <br><br> Inputs are stable and updated in the same pipeline, so pre-computing is safe and adds zero runtime overhead.|
|Dynamically derived	|Depends on linked objects or values that change via actions, automations, or other Ontology-level operations.	|Derived property	|`directReportCount` <br><br> Employees are reassigned, onboarded, and offboarded through actions. A derived property that counts linked `Employee` objects stays correct automatically.|

:::callout{theme="warning"}
When a value depends on changes made through actions, every action that could affect the value must also update the value. If any action fails to do so, the value will remain incorrect until the discrepancy is identified.
:::

### Anti-patterns

* The same value is stored as a property on multiple object types
* Properties go stale because they are copies of values maintained elsewhere
* Updating a single real-world fact requires writes to multiple objects
* Integer or count properties are manually maintained rather than computed from links

### Example

A `Manager` object type needs to display a count of direct reports:

```
✗ Avoid                                    ✓ Prefer
────────────────────────────────────────   ────────────────────────────────────────
Manager                                    Manager
  - directReportCount: 5                     - directReportCount (derived):
  (manually maintained integer;                counts linked Employee objects
   must be updated every time          →       at query time
   an employee joins or leaves)
                                           Employee
Employee                                     - manager (link to Manager)
  - managerName: "Alice"
  (copied from the linked Manager;
   breaks if the manager's name
   changes)
```

### Performance considerations

Derived properties are evaluated at runtime. The performance characteristics vary by scale:

|Scale	|Recommendation|
|-|-|
|Low to moderate (<~10k objects per query)	|Use derived properties freely. Runtime evaluation is sufficiently performant for most workflows.|
|High (>~10k objects per query)	|Derived properties may introduce latency due to higher-overhead query paths. Denormalization may be an appropriate tradeoff, but it should be a conscious, documented decision and not the default.|

### Best practices

1. **Store each fact in one place**, on the object where it semantically belongs.
2. **Use derived properties** to compute or aggregate values from linked objects at query time.
3. **Monitor performance** as scale grows. If derived properties introduce unacceptable latency at high scale, consider selective denormalization.
4. **Document any denormalization** with the rationale, the source of truth, and the update strategy for keeping copies in sync.

## Structs

**Group semantically related fields into structs.**

When a property is naturally multi-field (for example, an address with street, city, state, and postal code), use a struct rather than flattening into separate properties. Structs preserve semantic grouping and enable richer metadata capture.

### When to use structs

|Scenario	|Example|
|-|-|
|Multi-field values	|Address (street, city, state, postal code), coordinates (geopoint, altitude)|
|Values with metadata	|AI-generated outputs with confidence scores, source references, and reasoning|
|Multi-valued properties with selection logic	|Multiple phone numbers where a reducer surfaces the primary one|

### Example

Modeling an address on a `Facility` object type:

```
✗ Avoid                                    ✓ Prefer
────────────────────────────────────────   ────────────────────────────────────────
Facility                                   Facility
  - addressStreet                            - address (struct array)
  - addressCity                                  - street (Main field)
  - addressState                     →           - city (Main field)
  - addressPostalCode                            - state (Main field)
  - addressCountry                               - postalCode (Main field)
  - addressGeopoint                              - country (Main field)
  - addressLastOccupied                          - geopoint
  - addressDatasource                            - lastOccupied (used for reducer sorting)
  - addressLlmConfidence                         - datasource
  - addressLlmReasoning                          - llmConfidence
                                                 - llmReasoning

(Ten unrelated properties with a
 naming convention as the only link         (One semantic concept with main
 between them)                               fields and structured sub-fields)
```

### Key benefits

|Benefit	|Details|
|-|-|
|Semantic grouping	|An address is one concept, not ten unrelated properties. The Ontology reflects this.|
|Metadata capture	|Structs can carry source, confidence, and timestamp information alongside the primary value.|
|Reducer support	|In multi-valued scenarios, reducers can surface the most relevant value (for example, the address with the most recent `lastOccupied` field).|
|Main field behavior	|A struct can designate one or more main fields so it behaves like a simple property or as a struct with a subset of the fields in interfaces and queries.|

Structs are especially valuable in AI-first workflows where large language model (LLM) outputs have both a primary result and associated metadata (reasoning, source references, confidence scores). Capture these together rather than scattering them across unrelated properties.

### Best practices

1. **Identify multi-field properties** where the fields are semantically related and always used together.
2. **Define the struct** with clear field names and types.
3. **Designate a main field** so the struct behaves like a simple property in most contexts.
4. **Use reducers** for multi-valued struct properties to surface the most relevant value.
5. **Capture metadata** (source, confidence, timestamps) in the struct alongside the primary value, especially for AI-generated outputs.

## Interfaces

**Use interfaces to build reusable, future-proof abstractions.**

Interfaces are the primary tool for achieving the ["Don't repeat yourself" design principle](/docs/foundry/ontology/ontology-best-practices/#2-dont-repeat-yourself-rule-of-three) and [open/closed extensibility](/docs/foundry/ontology/ontology-best-practices/#3-open-for-extension-closed-for-modification). They define a shared shape (properties, links, actions) that multiple object types can implement, enabling workflows to target the interface rather than individual types.

### When to use interfaces

|Scenario	|Example|
|-|-|
|Common properties across types	|`Inspectable` interface with `lastInspectionDate` and `inspectionStatus`, implemented by `Vehicle`, `Equipment`, `Facility`|
|Shared workflows	|A scheduling workflow targeting `SchedulableResource` works for arenas, conference rooms, and vehicles without modification|
|Taxonomic grouping	|A `MilitaryAsset` interface implemented by `Aircraft`, `Vessel`, `GroundVehicle` for drilldown aggregation workflows|
|Multi-level abstraction	|`SchedulableResource` extends `Trackable`, adding scheduling-specific properties to a broader tracking abstraction|

### Example

Multiple object types need inspection tracking:

```
✗ Avoid                                    ✓ Prefer
────────────────────────────────────────   ────────────────────────────────────────
Vehicle                                    Interface: Inspectable
  - lastInspectionDate                       - lastInspectionDate
  - inspectionStatus                         - inspectionStatus
  - (duplicate action: Schedule              - (shared action: Schedule Inspection)
     Vehicle Inspection)
                                     →     Vehicle implements Inspectable
Equipment                                    - make, model, mileage, ...
  - lastInspectionDate
  - inspectionStatus                       Equipment implements Inspectable
  - (duplicate action: Schedule              - serialNumber, warrantyExpiry, ...
     Equipment Inspection)
                                           Facility implements Inspectable
Facility                                     - address, capacity, ...
  - lastInspectionDate
  - inspectionStatus                       (One interface, one shared action,
  - (duplicate action: Schedule             three implementing types)
     Facility Inspection)

(Three copies of the same properties
 and logic, maintained independently)
```

### Platform considerations

Even where current platform tooling does not fully support interface-backed workflows, designing with interfaces establishes a foundation that pays off as support expands.

|Situation	|Guidance|
|-|-|
|The interface is fully supported in your workflow	|Target the interface directly. A single workflow covers all implementing types.|
|The interface is not yet supported in a specific context	|Define the interface now and duplicate the workflow per type as a temporary measure. This approach is no less efficient than working without an interface, and it establishes a clear path to consolidation once support is available.|

Review our [interface documentation](/docs/foundry/interfaces/interface-overview/) for current support details.

### Best practices

1. **Identify common shapes:** If multiple object types share properties, links, or actions, define an interface that captures the shared shape.
2. **Design interfaces around capabilities or taxonomy:** Capability interfaces may include `Inspectable`, `Schedulable`, or `Billable`. Taxonomic interfaces may include `MilitaryAsset` or `MedicalDevice`.
3. **Target interfaces in workflows:** Build actions, functions, and applications against interfaces where possible.
4. **Extend interfaces for multi-level abstraction:** Interfaces can extend other interfaces to build layered abstractions.
5. **Scaffold now, consolidate later:** Define interfaces even if some workflows must temporarily be duplicated per-type due to current platform support gaps.

## Links and object-backed link types

**Links should represent semantically meaningful relationships.**

Every link type should answer a clear domain question, such as:

* Which facility did this patient visit?
* Which team does this employee belong to?
* Which equipment was used in this work order?

### When to use link types

|Link type	|Use when	|Example|
|-|-|-|
|Direct link	|The relationship is meaningful but carries no metadata of its own.	|`Employee` → `Department`|
|Object-backed link	|The relationship carries its own metadata (dates, roles, status, allocation).	|`Employee` → `VentureStaffing` → `Venture` (with `role`, `startDate`, `allocation`)|

Not every linking object needs to be visible in every context. Some workflows care about the join metadata, others just want the direct connection. Object-backed links let you expose either view depending on the workflow.

### Example

Modeling the relationship between employees and ventures, where each assignment has a role and start date:

```
✗ Avoid                                    ✓ Prefer
────────────────────────────────────────   ────────────────────────────────────────
Employee → Venture (direct link)           Employee → Venture Staffing → Venture
  (no way to capture role,
   start date, or allocation         →     Venture Staffing
   per assignment)                           - role
                                             - startDate
— OR —                                       - allocationPercentage
                                             - status
Employee
  - ventureRole                            Workflows can expose either:
  - ventureStartDate                         - Direct: Employee → Venture
  (ambiguous if employee has                 - Detailed: Employee → Staffing → Venture
   multiple venture assignments)
```

### Impact of incorrect link design

|Problem	|Impact|
|-|-|
|Lost metadata	|Direct links cannot capture when, why, or in what capacity a relationship exists.|
|Ambiguous multi-links	|Properties like `ventureRole` on the source object become ambiguous when an entity participates in multiple relationships.|
|Meaningless links	|Links that exist only because two datasets share a foreign key add noise to the Ontology and confuse navigation.|

### Best practices

1. **Validate semantic meaning:** Avoid links that exist only because two datasets share a foreign key. Ask if the relationship is meaningful in the domain.
2. **Evaluate whether the relationship carries metadata:** If it does (dates, roles, status), use an object-backed link type to capture that metadata.
3. **Expose the right level of detail:** Design workflows to use either the direct relationship or the detailed relationship through the linking object, depending on the context.
4. **Name links for clarity:** Link names should describe the relationship from each direction. Review the section on [naming conventions](#naming-conventions) for more information.

## Naming conventions

**Optimize for human readability and agent navigability.**

Consistent, descriptive naming is one of the most impactful investments you can make in Ontology quality. Clear names make the Ontology easier for both humans and AI agents to navigate, and they are far harder to correct once the Ontology is in use.

### Naming rules

|Element	|Convention	|Good examples	|Bad examples|
|-|-|-|-|
|Object types	|Singular, concrete nouns a domain expert would recognize	|`Patient`, `WorkOrder`, `FlightSegment`	|`Data`, `Item`, `Record`|
|Properties	|Concise, self-evident; no encoded type info or implementation details	|`age`, `status`, `lastInspectionDate`	|`dtLastInspMod`, `nVAL01`, `fieldX`|
|Links	|Read naturally from each direction	|`department` (Employee → Dept), `employees` (Dept → Employee)	|`relatedItems`, `link1`|
|Dates	|Follow a single convention consistently across the Ontology	|`createdDate`, `updatedDate`, `effectiveDate`	|Mixing `createdDate` and `dateOfCreation`|
|Ambiguous terms	|Qualify with specific meaning	|`monetaryValue`, `quantityOnHand`, `riskScore`	|`value`, `quantity`, `score`|

### Example

```
✗ Avoid                                    ✓ Prefer
────────────────────────────────────────   ────────────────────────────────────────
Object type: Item                    →     Object type: Product

Property: dtLastInspMod              →     Property: lastInspectionDate

Property: value                      →     Property: monetaryValue
                                           Property: quantityOnHand

Link: Item → Related Item            →     Link: Product → Supplier
                                           Link: Employee → Supervisor
```

### Best practices

1. **Establish naming conventions before building:** Agree on patterns for dates, statuses, identifiers, and links up front.
2. **Follow the Ontology's established conventions:** If the Ontology already uses `createdDate`, do not introduce `dateOfCreation`.
3. **Qualify ambiguous properties:** Use `monetaryValue`, `quantityOnHand`, and `riskScore`. Do not use `value`, `quantity`, and `score`.
4. **Name links by relationship:** A link from `Employee` to `Department` should be `department` (from the employee's perspective) and `employees` (from the department's perspective).
5. **Review names with end users:** Names that seem clear to the builder may be ambiguous to consumers. Validate with the people who will use the Ontology every day.

## Security design

**Design security semantically, following the principle of least privilege.**

Security in the Ontology should be expressed in terms that make sense in the domain, not in terms of data infrastructure. Users should be able to look at a security configuration and understand what is protected and why.

### Security model

Combine row-level and column-level security for fine-grained cell-level access control:

|Security layer |Controls	|Example |
|-|-|-|
|Row-level	|The objects a user can view	|VIP patients are restricted to senior staff|
|Column-level	|The properties a user can view on visible objects	|Clinical notes are restricted to the care team|
|Cell-level (combined)	|The intersection of row and column restrictions	|VIP patients' clinical notes are visible only to the senior care team|

### Example

Controlling access to sensitive patient data:

```
✗ Avoid                                    ✓ Prefer
────────────────────────────────────────   ────────────────────────────────────────
PublicPatient (object type)                Patient (single object type)
  - name                                     - name
  - dob                                      - dob
  - diagnosis                                - diagnosis (column-restricted:
                                                 care team only)
RestrictedPatient (object type)      →       - clinicalNotes (column-restricted:
  - name                                         care team only)
  - dob                                      - mentalHealthRecords (column-
  - diagnosis                                    restricted: psychiatry team only)
  - clinicalNotes
  - mentalHealthRecords                    Row-level security:
                                             - VIP patients: senior staff only
(Duplicated schemas; security
 achieved by splitting types.              Column-level security:
 Properties added to one type are            - clinicalNotes: care team only
 easily forgotten on the other.)             - mentalHealthRecords: psychiatry only

                                           (One type; security achieved by policy.
                                            Domain boundaries drive access rules.)
```

### Impact of incorrect security design

|Problem	|Impact|
|-|-|
|Duplicated types for security	|Schemas drift out of sync; properties added to one type are easily forgotten on the other. Violates the ["Don't repeat yourself" design principle](/docs/foundry/ontology/ontology-best-practices/#2-dont-repeat-yourself-rule-of-three).|
|Over-permissive defaults	|Starting with broad access and restricting later risks exposing sensitive data before lockdown is complete.|
|Ad-hoc filtering instead of policy	|Security logic scattered through application code rather than enforced at the Ontology layer is fragile and difficult to audit.|
|Misaligned boundaries	|Security boundaries that do not follow domain boundaries are harder to reason about and more likely to have gaps.|

### Best practices

1. **Start restrictive, open up deliberately:** Default to minimal access and widen as needed, rather than starting open and restricting later.
2. **Use row-level and column-level security together** for fine-grained cell-level access control.
3. **Align security with domain boundaries:** If your domain has natural access boundaries (a regional manager sees their region's data; a care team sees their patients), model those boundaries using Ontology relationships and security policies rather than ad-hoc data filtering.
4. **Avoid duplicating object types for security:** A single type with well-designed security policies is better than multiple types with duplicated schemas.
5. **Review new ontology paths for access-control consistency:** Ensure added links, types, or properties preserve the intended protections around restricted data.

Use the guidance on this page to ensure security boundaries align with domain boundaries, then refer to our [security and governance documentation](/docs/foundry/security/overview/) for configuration details.
