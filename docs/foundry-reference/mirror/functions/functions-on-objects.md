<!-- source: https://palantir.com/docs/foundry/functions/functions-on-objects/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Functions on objects (FOO)

Functions in Foundry natively support accessing and modifying data from objects and links in the Ontology. After defining object and link types in the Ontology, you can import these types into a functions repository to have code bindings automatically generated. These code bindings include support for:

* Passing object and object set types into a function as [parameters](/docs/foundry/functions/types-reference/#ontology-types)
* Searching for object sets on demand using the [Object set APIs](/docs/foundry/functions/api-object-sets/)
* Modifying objects using [OntologyEditFunctions](/docs/foundry/functions/edits-overview/)

Because of this native support for the Ontology, functions in Foundry go far beyond commonly used Functions-as-a-Service (FaaS) platforms by providing native support for data storage, retrieval, and modification—all subject to Foundry's guarantees for data security, lineage, and transparency.

[Learn how to get started with functions on objects.](/docs/foundry/functions/foo-getting-started/)

:::callout{theme="neutral"}
The term "functions on objects" (sometimes referred to as "FOO") is used loosely to refer to functions that read object data, either as a parameter or using an object search, but there is no formal notion of a "function on objects" in Foundry as being distinct from any other function.
:::
