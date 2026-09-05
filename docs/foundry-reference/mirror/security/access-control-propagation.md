<!-- source: https://palantir.com/docs/foundry/security/access-control-propagation/ · mirrored 2026-09-05 from Palantir Foundry docs -->

# Access control propagation

Foundry combines [mandatory](#mandatory-controls) and [discretionary](#discretionary-controls) access controls to govern who can interact with what data. These two families differ in a property that is critical to designing a secure pipeline or application: **propagation**. Mandatory controls travel with data through derivation and downstream consumption. Row and column access controls (including [restricted views](/docs/foundry/security/restricted-views/), [object security policies](/docs/foundry/object-permissioning/object-security-policies/), and [property security policies](/docs/foundry/security/property-security-markings/)) filter what a user can read. These controls do not extend beyond that read.

This page describes the propagation behavior of each control family, identifies where the distinction matters, and provides guidance for choosing the right control for a given goal.

:::callout{theme="neutral"}
This page is a reference for how access controls propagate. For an overview of the security model as a whole, see [Security and governance](/docs/foundry/security/overview/). For a list of terms used here, see the [Security glossary](/docs/foundry/security/security-glossary/).
:::

## Mandatory controls

Mandatory controls are enforced by the platform regardless of any user's role or any application's logic. The mandatory controls are:

* **[Markings](/docs/foundry/security/markings/):** Apply to datasets, transactions, files, and columns. A user without the required marking cannot access any resource that carries it.
* **[Classification-based Access Controls (CBAC)](/docs/foundry/security/classification-based-access-controls/):** Column-level mandatory controls keyed to user clearance levels.
* **[Organizations](/docs/foundry/security/orgs-and-spaces/):** Mandatory boundaries between groups of users and groups of resources.

Mandatory controls **propagate** through derivation. For example:

* A dataset built from a marked input inherits the marking on its transactions.
* A column tagged with a CBAC classification keeps that classification when copied into a downstream dataset.
* A resource produced inside an organization-scoped project inherits the organization constraint.

Propagation means that no derived artifact can expose data to a user who lacks the required marking, classification, or organization membership. The control evaluates against the running user's identity at every point of access.

## Discretionary controls

Discretionary controls grant access to specific users or groups on specific resources. The discretionary controls relevant to row and column protection are:

* **[Project roles](/docs/foundry/security/projects-and-roles/):** Roles granted on a project (Owner, Editor, Viewer, Discoverer) determine which users can read or modify resources in that project.
* **[Restricted views](/docs/foundry/security/restricted-views/):** A read-layer resource that filters rows of a backing dataset using a [granular policy](/docs/foundry/platform-security-management/manage-granular-policies/).
* **[Object security policies](/docs/foundry/object-permissioning/object-security-policies/):** Row-level filtering for ontology object instances, evaluated at the object set layer.
* **[Property security policies](/docs/foundry/security/property-security-markings/):** Column-level filtering for object properties.

These controls filter what a user can read. The platform compares the user's attributes and group memberships against the policy and returns only the rows or fields the user is authorized to see.

After the read, the rows that the user did receive are ordinary data. They carry no metadata, classification, or tag that subsequent code can use to re-apply the policy.

### Where discretionary controls stop

Row and column access controls filter what users can read. The following operations do **not** carry the source policy:

* **Function return values:** A function that reads an object set filtered by an object security policy returns a result computed under the running user's permissions. The returned value is not policy-bound; any consumer that receives it sees the data as-is.
* **Action edits:** An action reads from an object set under one policy and writes to an object type with different (or no) row-level policy. The write target's access controls apply, but the source policy does not propagate.
* **AIP Logic tool calls:** A tool call returns Ontology data into the model's context. Once in context, the data can be summarized, transformed, and returned through any of the model's output paths with no remaining association to the source policy.
* **OSDK responses:** OSDK clients receive Ontology payloads in the running user's context. The application can render, log, transform, or forward the data; no policy travels with the payload.
* **Pipeline Builder Ontology outputs:** Rows written from a Pipeline Builder pipeline into an object type are governed by the destination's access controls, not by any restricted view policy on the source.
* **Writeback operations:** Edits applied to an object backed by a restricted view are governed by the writeback target's controls.
* **Exports and downloads:** Exports from Quiver, Contour, Workshop, and other applications produce artifacts outside Foundry. Nothing in those artifacts carries the source policy.

In each case, the running user could not have read what they were not authorized to read; the access guarantee holds. What does not hold is propagation: the constraint that protected the source data does not constrain what happens with that data after the read.

## Choosing a control

Use the following guidance when choosing access controls for a data product:

* **Does the protection requirement extend to derived artifacts, writeback operations, exports, or model outputs?** Use a mandatory control (a marking, CBAC classification, or organization); mandatory controls propagate.
* **Is the requirement to filter what a user sees at the read layer (without restricting subsequent derivation)?** A restricted view, object security policy, or property security policy is appropriate.
* **Is the requirement to both filter what users see and protect data as it flows downstream?** Use both. A restricted view backed by a marked dataset provides row-level filtering for users while preserving the marking on the source and its derivatives.

For stronger protection, apply a marking to a restricted view's backing dataset. This ensures that any consumer building further derivations is still governed by the marking, including consumers who read from a sibling restricted view or bypass the view entirely.

## Frequently asked questions

The following questions address common points of confusion about how mandatory and discretionary controls differ in practice.

### Do read-only restricted views protect data after it has been read?

The read-only property of a restricted view prevents its schema and columns from being altered. This is an **integrity** property of the restricted view as a resource, not a confidentiality guarantee on the rows a user can read.

### Can I remove a marking if a granular policy is already in place?

A marking on the resource provides a propagating mandatory control. A granular policy on a restricted view provides a non-propagating discretionary filter. Removing the marking trades a control that travels through derivation for one that does not. To keep data protected through downstream outputs and exports, keep the marking.

### Does respecting Foundry's security model guarantee policy enforcement downstream?

Applications that "respect the security model" read data under the user's permissions. This guarantees that a user cannot read what they are not authorized to read. It does not guarantee that what the user reads remains under the source policy after the read. User-permission inheritance provides the access guarantee; it does not provide the propagation guarantee.

### Are projects a security boundary?

[Projects](/docs/foundry/security/projects-and-roles/) are the primary container for discretionary role grants. Mandatory controls (markings, CBAC, organizations) remain in force across projects and through derivation. When the protection goal requires a hard boundary that derived artifacts cannot escape, mandatory controls provide that boundary; projects provide role-grant convenience.

## See also

* [Markings](/docs/foundry/security/markings/)
* [Classification-based Access Controls](/docs/foundry/security/classification-based-access-controls/)
* [Organizations and spaces](/docs/foundry/security/orgs-and-spaces/)
* [Restricted views](/docs/foundry/security/restricted-views/)
* [Object security policies](/docs/foundry/object-permissioning/object-security-policies/)
* [Property security markings](/docs/foundry/security/property-security-markings/)
* [Manage granular policies](/docs/foundry/platform-security-management/manage-granular-policies/)
* [Manage restricted views](/docs/foundry/platform-security-management/manage-restricted-views/)
