<!-- source: https://palantir.com/docs/foundry/foundry-branching/best-practices-and-technical-details/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Integrations

Global Branching integrates with applications across the platform, enabling isolated development workflows for a wide range of resources. While the Global Branching application provides a unified experience across the Palantir platform for common operations like adding resources, rebasing, and merging, the details vary depending on which Foundry application you are working in.

The documentation below covers application-specific details for working with branches, including how to add and modify resources, cross-application compatibility, rebase behavior, and any known limitations.

## Application-specific documentation

| Application | Documentation |
| --- | --- |
| Workshop | [Branching Workshop modules](/docs/foundry/workshop/branching-integration/) |
| AIP Logic | [Branching AIP Logic](/docs/foundry/logic/branching-logic/) |
| Automate | [Branching automations](/docs/foundry/automate/branching-automations/) |
| TypeScript v1 functions | [Branching functions](/docs/foundry/functions/branching-functions/) |
| Ontology | [Branching the ontology](/docs/foundry/ontologies/branching-ontology/) |
| Ontology Actions | [Branching action types](/docs/foundry/action-types/branching-action-types/) |
| Ontology Materializations | [Materializations](/docs/foundry/object-edits/materializations/#branching) |
| Object Views | [Branching object views](/docs/foundry/object-views/branching-object-views/) |
| Code Repositories | [Branching code repositories](/docs/foundry/code-repositories/navigation/#branch-options) |
| VS Code workspaces | [Global Branching in VS Code workspaces](/docs/foundry/vs-code/global-branching/) |
| Pipeline Builder | [Global and Pipeline Builder branches](/docs/foundry/pipeline-builder/branches-overview/) |
| Restricted Views | [Branching restricted views](/docs/foundry/security/branching-restricted-views/) |
| Data Lineage | [Branching data lineage](/docs/foundry/data-lineage/branching-data-lineage/) |
| Workflow Lineage | [Branching Workflow Lineage](/docs/foundry/workflow-lineage/branching-workflow-lineage/) |
| Insight | [Branching in Insight](/docs/foundry/insight/branching-insight/) |

## Notable limitations

Not all resource types are yet supported in Global Branching; support for more resource types is in development. To note in particular:

* **TypeScript v2 and Python functions:** Currently, you cannot modify TypeScript v2 or Python functions on a branch. You may reference a specific version of a function on a branch and test that version before merging it back to the `main` branch. However, the function code will only be able to leverage the schemas that exist on the `main` branch.
* **Ontology SDK:** The Ontology SDK is not currently branchable.
