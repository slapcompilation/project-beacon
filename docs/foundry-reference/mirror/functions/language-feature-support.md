<!-- source: https://palantir.com/docs/foundry/functions/language-feature-support/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Feature support by language

Not all features are supported by all languages. Refer to the chart below for feature support by language.

| Functions capability by language | AIP Logic | TypeScript v1 | TypeScript v2 | Python | Description                                                                                                                                       |
|----------------------------------|-----------|---------------|---------------|--------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| Ontology object support          | Yes       | Yes           | Yes           | Yes    | The ability to [access Ontology objects](/docs/foundry/functions/foo-getting-started/) in your function.                                                              |
| Ontology interfaces support      | No        | No            | Yes           | No     | The ability to access and edit Ontology interfaces in your function.                                                   |
| Ontology edits support           | Yes       | Yes           | Yes           | Yes    | The ability to [edit Ontology objects](/docs/foundry/functions/edits-overview/) in your function.                                                                     |
| Queryable in Workshop            | Yes       | Yes           | Yes           | Yes    | Invoking a function from a [Workshop application](/docs/foundry/workshop/functions-use/).                                                                  |
| Usable in Pipeline Builder       | No        | No            | No            | Yes    | Calling a function from [Pipeline Builder pipelines](/docs/foundry/functions/python-functions-builder/).                                                              |
| Functions on models support      | Yes       | Yes           | No            | No     | Executing live deployment models [from a function](/docs/foundry/functions/functions-on-models/).                                                                     |
| Semantic search support          | Yes       | Yes           | Yes            | Yes     | Use functions to create vectors for [semantic search](/docs/foundry/ontology/overview-semantic-search/).                                                   |
| Webhook support                  | No        | Yes           | No            | No     | The ability to call [webhooks from functions](/docs/foundry/functions/webhooks/).                                                                                     |
| External API call support        | No        | Yes           | Yes           | Yes    | Querying external services from [within functions](/docs/foundry/functions/api-calls/).                                                                               |
| Serverless execution support     | Yes       | Yes           | Yes           | Yes    | A serverless function will be spun up on demand when invoked.  Refer to [serverless functions](#serverless-functions) below for more information. |
| Deployed execution support       | No        | No            | Yes            | Yes    | A deployed function will have dedicated resources allocated to it, ready to serve requests.                                                       |
| Call function from API gateway   | Yes       | Yes           | Yes           | Yes    | The ability to hit a [query function](/docs/foundry/functions/query-functions/) from the API gateway.                                                                 |
| Marketplace support              | Yes       | Yes           | Yes           | Yes    | The ability to package and ship functions in [Marketplace](/docs/foundry/marketplace/overview/).                                                           |
| Bring-your-own-model             | Yes       | Yes           | No            | No     | The ability to register a function [as a model](/docs/foundry/aip/bring-your-own-model/). The [function interface method](/docs/foundry/aip/chat-completion-function-interface-quickstart/) is a legacy approach that applies to TypeScript v1 only.                                                                  |

## Ontology SDK support

Python and TypeScript v2 functions support the [Ontology SDK](/docs/foundry/ontology-sdk/overview/) (OSDK). The OSDK allows you to leverage the Ontology directly from your development environment and provides [benefits](/docs/foundry/ontology-sdk/overview/#osdk-benefits) such as compatibility with Developer Console and OSDK versioning. We recommend using Python or TypeScript v2 to access these benefits in your functions repository.

## TypeScript v1 vs. TypeScript v2

Both TypeScript v1 and TypeScript v2 allow users to leverage TypeScript's core language features, but there are differences in supported platform features, as shown in the feature support table above. We recommend building workflows using TypeScript v2 functions to take advantage of several key improvements over TypeScript v1:

* **Serverless execution in a full Node.js runtime:** TypeScript v2 functions run in a Node.js environment, supporting core modules like `fs`, `child_process`, and `crypto`. This enables greater compatibility with NPM libraries that interact with the file system, perform CPU-intensive tasks in parallel, or require other system-level operations.
* **First-class OSDK support:** The OSDK can now be used seamlessly in TypeScript v2 functions, making it easy to reuse code, both in and out of the platform. It also provides more efficient APIs for working with large-scale Ontology data.
* **Configurable resource requests:** TypeScript v2 functions allow you to request up to 8 vCPUs and 5GB of memory, offering greater control over performance and scalability.

## Serverless functions

If serverless functions are enabled for your enrollment, new repositories will use serverless functions by default. We recommend using serverless functions instead of deployed functions for most use cases. With serverless functions, you can have multiple versions of a single function available on demand, making upgrades safer.

When using Python or TypeScript v2 functions, there are also [some cases where deployed functions are preferred](/docs/foundry/functions/functions-deployed/#choose-between-deployed-and-serverless-execution-modes) or must be used instead of serverless, but these are not common. If available, serverless functions are preferred for several reasons:

* Serverless functions enable different versions of a single function to be executed on demand, making upgrades safer. With deployed functions, you can only run a single function version at a time.
* Serverless functions only incur costs when executed, while deployed functions incur costs as long as the deployment is running.
* Serverless functions require less upfront setup and long-term maintenance, as the infrastructure is managed automatically.
