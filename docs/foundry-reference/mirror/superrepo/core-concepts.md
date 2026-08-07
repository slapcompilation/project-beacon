<!-- source: https://www.palantir.com/docs/foundry/superrepo/core-concepts/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Core concepts

:::callout{theme="neutral" title="Beta"}
SuperRepo is in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.
:::

The lifecycle of a SuperRepo is broken down into three steps: development, build, and deployment. SuperRepo allows you to develop locally with preview, use a build system of your choice to produce a reproducible artifact, and deploy that artifact programmatically. You can upload that artifact to [Marketplace](/docs/foundry/marketplace/overview/), where it can then be installed on one or more enrollments.

A SuperRepo can be made up of many components of the Foundry ecosystem, and each component has its own intricacies, which are covered in its own documentation section. The following sections provide high-level descriptions of a number of concepts present in a SuperRepo.

## Development

During development, the Foundry CLI runs your SuperRepo locally so that you can iterate on the Ontology, your functions, and your application together.

### Preview

SuperRepo preview works by running a series of local servers on your computer to mock a subset of interactions with a real Foundry instance. In preview, SuperRepo uses the embedded Ontology to serve an approximation of the Ontology's behaviors locally. Functions run in language-specific preview runtimes, with queries and function-backed actions routed through the embedded Ontology. Your [Ontology SDK](/docs/foundry/ontology-sdk/overview/) application is hosted locally and run against these servers.

### Ontology-as-code

Ontology-as-code provides a pro-code way for you to define your Ontology entities in a SuperRepo. TypeScript definitions of your object types, interfaces, actions, and other entities are compiled and materialized into real entities on your enrollment after your product is deployed. Ontology-as-code acts as the source of truth for your entities, so you should manage all changes from your code definitions.

For the Ontology-as-code API reference, review [its open source repository ↗](https://github.com/palantir/osdk-ts/blob/main/packages/maker/README.md). For the UI-first equivalent of this workflow, review [Create an object type](/docs/foundry/object-link-types/create-object-type/).

### OSDK

SuperRepo automatically generates SDK bindings for your Ontology-as-code definitions that can natively be used in your functions and your Ontology SDK application. The local development servers watch for changes to the Ontology and automatically regenerate the bindings when needed.

Documentation on the Ontology SDK can be found in the [Ontology SDK section](/docs/foundry/ontology-sdk/overview/).

### Importing

Ontology entities that already exist on your enrollment, including those created in the [Ontology Manager](/docs/foundry/ontology-manager/overview/), can be imported into your SuperRepo with the `foundry import ontology` command instead of being redefined in code. Importing generates the OSDK and Ontology-as-code types for those entities, so you can use them across your SuperRepo components. The command writes the import metadata to a lock file that you should commit to your repository, because code generation is based on it. For a walkthrough of the import workflow, review [Tutorial: Develop with a SuperRepo](/docs/foundry/superrepo/tutorial-develop-with-a-superrepo/).

## Build

The build step turns the components declared in your SuperRepo into a single reproducible artifact, either through the build tooling provided by the default templates or through a build system of your choice.

### Foundry CLI

SuperRepo manages builds and preview through per-component commands in the [Foundry CLI](/docs/foundry/superrepo/foundry-cli/). Out of the box, SuperRepo provides templates with pre-selected build tooling that orchestrates and manages build steps and their dependencies. However, because of the modular nature of the per-component builds, you have expressive control over your SuperRepo build workflow. The Foundry CLI is designed such that you can bring your own build system and still be able to produce SuperRepo artifacts.

To enable the modularity of a SuperRepo, the `foundry.yml` file provides a central location for component discovery that the Foundry CLI references. The following example shows the default `foundry.yml`:

```yaml
minCliVersion: "0.196.0"
functionsTypescriptRuntimeVersion: "0.123.0"
components:
  - type: ONTOLOGY
    path: ./ontology
  - type: TYPESCRIPT_FUNCTIONS
    path: ./functions/typescript-functions
  - type: APP
    path: ./app
imports:
  - ontology: ontology/external-imports/ontology-full-metadata.json
bundle:
  name: "product"
  description: ""
  mavenCoordinate: "com.palantir.example:product"
  installMode: SINGLETON
osdkOutput: ontology/osdk-output
apiNamespace: com.palantir.example
```

Review [Advanced workflows](/docs/foundry/superrepo/advanced-workflows/) for details on declaring multiple products, restructuring components, and other `foundry.yml` configuration.

### Continuous integration

One of the guiding principles for SuperRepo is that it can be hosted, built, and deployed outside of the platform. An important part of this is being able to run SuperRepo workflows from a continuous integration provider. Two workflows are worth calling out:

* **Testing:** Because a SuperRepo is code, it is straightforward to test. The CLI ships with the embedded Ontology, so you can write integration tests that span the breadth of your workflow. Ontology linting is a second established pattern: Ontology owners who need to enforce style and design-pattern guidelines write linters that check the entity definitions in code before they are deployed.
* **Release management:** Once each component is built, run the `foundry bundle --project-version <VERSION>` command to produce the final build artifact. The `--project-version` option expects a semantic version that becomes the Marketplace product version. In the in-platform SuperRepo experience, every commit tagged with a semantic version is released as a product version, and the Git tag is passed into the `--project-version` option. The goal is to enable you to leverage whatever release flow works for you. If your `foundry.yml` declares more than one product, use the `foundry bundle product` and `foundry bundle store` commands instead. Review [Bundle a multi-product SuperRepo](/docs/foundry/superrepo/advanced-workflows/#bundle-a-multi-product-superrepo) for details.

## Deploy

Deployment installs the artifact produced by the build step onto one or more Foundry enrollments, either from the Palantir platform itself or from an external CI system.

### Marketplace

SuperRepo natively compiles down to a [Marketplace product](/docs/foundry/marketplace/foundry-products/) installable on Foundry enrollments. Installation parameters such as Marketplace inputs and target enrollments and stores can be statically configured inside the SuperRepo itself, making the installation an automated, zero-click process.

The CLI executes Marketplace deployments with the `foundry deploy` command. You supply configuration items through an environment YAML file. By default, `foundry deploy` looks for a file named `env.yml`; pass `--env-file-path` to point it at a different file. To create the file interactively, run `foundry deploy configure`.

The following example shows an `env.yml` file:

```yaml
input_mappings:
  organizationInput:
    type: markings
    markings:
      markingIds:
        - 12345678-1234-5678-1234-567812345678
      stableId: null
  websiteSubdomain:
    type: parameter
    parameter:
      value:
        type: stringValue
        stringValue: my-site.example.palantirfoundry.com

# Optional target location config
store_rid: ri.marketplace.main.local.12345678-1234-5678-1234-567812345678
```

Once configured, the `foundry deploy` command uploads your product version and installs it with the configured inputs supplied by the environment file. For a step-by-step walkthrough, review [Prepare for your first deployment](/docs/foundry/superrepo/prepare-first-deploy/).

### Internal deployment

If your SuperRepo source is hosted inside the Palantir platform, tag a version of your repository and Foundry CI builds and deploys the resulting product for you. Review [Deploy from the Palantir platform](/docs/foundry/superrepo/prepare-first-deploy/#deploy-from-the-palantir-platform) for the full workflow.

### External deployment

If your SuperRepo source is hosted outside the Palantir platform, build and deploy it from your terminal or from any CI system with the Foundry CLI. Review [Deploy from outside the Palantir platform](/docs/foundry/superrepo/prepare-first-deploy/#deploy-from-outside-the-palantir-platform) for the full workflow.
