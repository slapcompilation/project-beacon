<!-- source: https://palantir.com/docs/foundry/ontologies/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Ontologies

An ontology is an artifact which stores ontological resources or entities, including the following:

* [Object types](/docs/foundry/object-link-types/object-types-overview/)
* [Link types](/docs/foundry/object-link-types/link-types-overview/)
* [Action types](/docs/foundry/action-types/overview/)
* [Interfaces](/docs/foundry/interfaces/interface-overview/)
* [Shared properties](/docs/foundry/object-link-types/shared-property-overview/)
* [Object type groups](/docs/foundry/object-link-types/type-groups/)

We call these resources **Ontology resources**. An ontology can either be private and assigned to a single [organization](/docs/foundry/security/orgs-and-spaces/) or shared among multiple organizations. Shared ontologies allow users of different organizations to share data and workflows safely. Grouping entities in ontologies ensures that only users of the specified organizations can access ontological entities.

## Relation with spaces

An ontology is mapped 1:1 with a [space](/docs/foundry/security/orgs-and-spaces/#spaces). When a new space is created, a corresponding ontology with the same name is simultaneously created with the same organization [markings](/docs/foundry/security/markings/) as the space. A private space will map to a private ontology, while a shared space will map to a shared ontology.

## Private vs. shared ontologies

Which kind of ontology you need depends on how many [organizations](/docs/foundry/security/orgs-and-spaces/#organizations) must work with the same object types, link types, and action types. Organizations enforce strict separation between groups of users and resources, and in most cases a company has a single organization. Only members and guest members of an organization applied to an ontology can be granted access to the resources it holds.

| | Private ontology | Shared ontology |
|---|---|---|
| **Choose it when** | Everyone who needs the objects is in one organization | People in two or more organizations need the same objects |
| **Organizations applied** | One | Two or more |
| **Who can be granted access** | Members and guest members of that one organization | Members and guest members of any applied organization |
| **Created alongside** | A private space | A shared space |

### When to use a private ontology

Choose a private ontology when everyone who needs the objects belongs to one organization. This covers most workflows.

For example, Sky Industries builds a Flight Alert Inbox application for its own support team. The application uses the `Flight`, `Flight Alert`, `Delay`, and `Aircraft` object types, the link types that connect them, and the action types its users apply. All of these describe Sky Industries operations, and only Sky Industries employees should see them. Sky Industries builds the workflow in its private space, so the ontology mapped to that space restricts every one of those resources to the Sky Industries organization.

Several teams share this single ontology: the operational consumers who use the application, the application developers who build it, and the pipeline developers who maintain its backing data. Working with other teams is not a reason to create a second ontology. To control which teams can reach which resources, grant [roles](/docs/foundry/security/projects-and-roles/#roles) to [groups](/docs/foundry/security/users-and-groups/#groups) on the projects that hold those resources.

### When to use a shared ontology

Choose a shared ontology when people in two or more organizations must work with the same objects.

Continuing the example, Sunrise Airline wants to reduce the aircraft delays caused by maintenance issues, and agrees to combine its maintenance data with Sky Industries flight delay data. The two companies need one set of object types that spans both: maintenance issues from Sunrise Airline data, linked to `Aircraft` and `Delay` objects built from Sky Industries data. Analysts at both companies must be able to open those objects and apply the same action types. A private ontology cannot support this: it is restricted to a single organization, so users at the other company cannot be granted access to its resources.

Instead, an administrator creates a shared space with both the Sky Industries and Sunrise Airline organizations applied. The shared ontology created alongside that space carries both organization markings, so analysts at both companies can be granted access to the joint object types, link types, and action types. Each company keeps its own private space and private ontology for the data and workflows it does not want to share.

:::callout{theme="neutral"}
Creating a shared ontology does not by itself make the underlying data visible to every applied organization. A dataset referenced from a private project into a shared project keeps the access requirement of the organization it came from. Users in the other organization stay blocked from viewing that data until a developer removes the inherited requirement. Review [removing inherited markings and organizations](/docs/foundry/building-pipelines/remove-inherited-markings/) for details.
:::

For a step-by-step walkthrough of this scenario, including how to create the organization, the spaces, and the shared project, review [Workflow: Cross-organization collaboration](/docs/foundry/security/cross-organization-collaboration/). For more details on shared ontologies, review [Shared ontologies](/docs/foundry/ontologies/shared-ontologies/).
