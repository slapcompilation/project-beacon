<!-- source: https://palantir.com/docs/foundry/slate/read-write-overview/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Read and write data

Slate can send and receive data from both Foundry and external systems. [Object sets](/docs/foundry/slate/concepts-object-sets/), [object context](/docs/foundry/slate/concepts-object-context/), and [Foundry Functions](/docs/foundry/slate/concepts-foundry-functions/) provide easy read access to the Ontology, while the [Actions widget](/docs/foundry/slate/applications-writeback/) specifically allows users to write back to the Ontology.

**Queries** provide generic access to various pre-configured end points. Every data source in queries must be configured via the admin panel. Once configured, users can [leverage queries](/docs/foundry/slate/concepts-queries/) to pull data from other services directly into their application, or trigger post-requests to write data directly into external databases. Query usability is the most flexible and open feature for importing and exporting data in Slate.

All data imported is represented in Slate in a JSON format, thereby unifying data from all datasources into a single structure. Once data lands in Slate, it loses this context and can be freely manipulated to produce the desired workflows.

Import and export components can be configured to use variables, functions, widgets, or outputs of other queries and read and write data dynamically. Queries compared to object sets or Actions can be constructed to be agnostic and are not limited to pre-configured interactions. The same query might create a new data point first, but a second run of the query would then update the previously created data point.

Object sets, object context, Foundry Functions, and Actions are easier to set up and provide clear rails, but are less flexible in return.
