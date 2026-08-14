<!-- source: https://palantir.com/docs/foundry/code-repositories/repository-settings/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Repository settings

Repository settings allow you to configure the behavior of your code repository. Changes to these settings will apply to all repository users.

* [Repository settings](#repository-settings)
  * [Commit message settings](#commit-message-settings)
  * [Repository upgrades](#repository-upgrades)
  * [Dataset aliases](#dataset-aliases)
  * [External systems](#external-systems)

## Commit message settings

By default commit messages will be auto-generated when clicking the commit button or when building a dataset. You can encourage more meaningful messages by disabling this option. The commit message dialog will open before each commit and require a message to be submitted.

## Repository upgrades

See [repository upgrades](/docs/foundry/code-repositories/repository-upgrades/) to learn more.

## Dataset aliases

Datasets can be referenced in code by using their exact location in Foundry (path) or by using their unique resource identifier (RID). While both options are valid, it is recommended to use RIDs where possible, as this allows resources to be moved from one location to another without needing any updates to the code in the repository.

The repository editor type-ahead functionality will allow you to search for data as you type, whether you type in paths, RIDs or free text. When you pick a dataset from the list of results, the editor will insert its path or RID depending on the setting:

* **Automatically change to RIDs when possible** - This option will insert the **RID** of the dataset as well as offer to convert any path in the transform to an RID. The editor will present the dataset name over the RID and allow editing it as needed.
* **Do not automatically change locations to RIDs** - This option will insert the **path** of the dataset and allow converting RIDs to paths when possible.

## External systems

Information security officers can enable a repository for interaction with external systems. This is an advanced feature that allows developers to write [external transforms](/docs/foundry/data-connection/external-transforms/), python code that interacts with web services and APIs on the open Internet or on-prem system via [agent-proxy](/docs/foundry/data-connection/agent-proxy-runtime/). This feature should only be enabled on repositories for highly trusted developers, since interactions with external systems cannot be guaranteed to follow Foundry's strict data provenance and access control practices. Security officers can limit the scope of data that is allowed to interact with external systems by configuring which mandatory control markings are allowed for export.
