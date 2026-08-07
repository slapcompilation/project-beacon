<!-- source: https://www.palantir.com/docs/foundry/superrepo/advanced-workflows/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Advanced workflows

:::callout{theme="neutral" title="Beta"}
SuperRepo is in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.
:::

For a repository to be a SuperRepo, it must have a `foundry.yml` file at its root declaring the project structure: each component's type and path. This file also allows you to declare the output artifacts (a [Marketplace product](/docs/foundry/marketplace/foundry-products/)) or even multiple outputs.

## Add multiple products

The `foundry.yml` configuration file can either hold a top-level `components` list or a top-level `products` list with a `components` key within each product. In a multi-product configuration, declare a `bundle` key within each product to define its output artifact. Review the following example:

```yaml
products:
  - components:
      - type: ONTOLOGY
        path: ./ontology
      - type: APP
        path: ./app
    osdkOutput: ontology/osdk-output
    apiNamespace: com.palantir.ontology
    bundle:
      name: "operations-console"
      description: "example description"
      mavenCoordinate: "com.example:operations-console:1.0.0"
      installMode: SINGLETON

  - components:
      - type: ONTOLOGY
        path: ./analytics/ontology
      - type: APP
        path: ./analytics/app
    osdkOutput: analytics/ontology/osdk-output
    apiNamespace: com.palantir.analytics
    bundle:
      name: "analytics-console"
      description: "example description"
      mavenCoordinate: "com.example:analytics-console:1.0.0"
      installMode: SINGLETON
```

When using a multi-product configuration, pass the `--product <bundle name>` option to every [Foundry CLI](/docs/foundry/superrepo/foundry-cli/) command to indicate which product to run against.

To exclude a product from the packaged output without removing it from the file, set `includeInBundle: false` on that product. The option defaults to `true` when omitted.

### Bundle a multi-product SuperRepo

A single-product SuperRepo is packaged with one command, `foundry bundle --project-version <VERSION>`. That command does not accept a multi-product configuration: if `foundry.yml` declares more than one product, it fails and directs you to the two subcommands below instead.

Bundle a multi-product SuperRepo in two stages:

1. Run `foundry bundle product --product <bundle name> --project-version <VERSION>` once for each product. Each invocation writes that product's packaged output to `build/<bundle name>/blockset.zip`. Because `--project-version` is supplied per invocation, products in the same repository can be versioned independently.
2. Run `foundry bundle store` to assemble those outputs into `build/store.zip`. This command takes no version argument; pass `--output` to write the store elsewhere. If a product has not been bundled yet, the command fails with the expected path and the `foundry bundle product` invocation needed to produce it.

Neither stage is implied by `foundry deploy`, which expects the store to exist already and fails if it does not. Bundle before you deploy.

## Restructure a SuperRepo

The components within a product can be freely moved around. For instance, moving `./ontology` to `./platform/ontology` touches three manifest keys:

```diff
 components:
   - type: ONTOLOGY
-    path: ./ontology
+    path: ./platform/ontology

 imports:
-  - ontology: ontology/external-imports/ontology-full-metadata.json
+  - ontology: platform/ontology/external-imports/ontology-full-metadata.json

-osdkOutput: ontology/osdk-output
+osdkOutput: platform/ontology/osdk-output
```

## Define seed data

During preview, `foundry` spawns a local [embedded Ontology](/docs/foundry/superrepo/core-concepts/#preview) server. This server is aware of the types defined or imported inside your SuperRepo's ontology component. However, it is not connected to your enrollment's Ontology. The instances of your object types therefore do not come from your enrollment; they exist and are valid only locally. You can either create objects manually by invoking a create action associated with an object, or leverage the automated seeding infrastructure of SuperRepos.

Seed data is a directory of TypeScript files inside the `ONTOLOGY` component. It is discovered by the local preview server through command-line arguments specified by the project's orchestration framework of choice, such as Nx.

Only top-level `.mts` files are compiled, in sorted filename order, which is why the demo template numbers them `001-`, `002-`, and `003-`. Each file default-exports a `createSeed` call. The first argument to `seed.add` is the generated SDK constant for the object type, and every non-nullable property is required, including the primary key. Primary keys must be unique within an object type across the whole directory. The `seed.link` function takes the references returned by `seed.add`, and both ends must be registered in the same call.

```typescript
import { seller, superproduct } from "@ontology/sdk";
import { createSeed } from "@osdk/seed-helpers";

export default createSeed((seed) => {
  const charger = seed.add(superproduct, {
    pk: "prod-004",
    title: "USB-C 100W GaN Charger",
    price: 5900,
    newPrice: 4720,
    description: "Compact 100W USB-C GaN wall charger",
  });
  const halcyon = seed.add(seller, {
    pk: "seller-003",
    name: "Halcyon Desk Co.",
  });
  seed.link("charger-seller-link", charger, "sellers", halcyon, "superproducts");
});
```

Each run uses a fresh local database, so seed files are re-applied on every start, and objects edited through the local server are discarded when you restart.

## Change the orchestration framework

The `foundry create` command wires up Nx, but the CLI reads neither the `nx.json` nor the `project.json` file. SuperRepo and the Foundry CLI are therefore independent of the orchestration framework you choose. The default template uses Nx because it is widely used; to migrate away from Nx, port the Foundry CLI invocations from the `project.json` files into another system.

:::callout{theme="neutral"}
During migration, you must wrap every Node install with `foundry run-with-auth`. It injects `FOUNDRY_HOSTNAME` and `FOUNDRY_TOKEN` so that the `.npmrc` files can rely on these environment variables.
:::

## Content security policy

When your application consumes resources from other origins, you must allow those origins in the Content Security Policy (CSP) of the website that Foundry manages for your product. Otherwise, the browser blocks the request. Declare the additions with the `contentSecurityPolicyAdditions` key:

```yaml
contentSecurityPolicyAdditions:
  img-src:
    - tile.openstreetmap.org
```

Each key is a standard CSP directive name and each value is a list of allowed sources, such as `https://api.example.com` or `'self'`. The following directive names are valid: `connect-src`, `frame-src`, `img-src`, `media-src`, `script-src`, `style-src`, `font-src`, and `frame-ancestors`.

`contentSecurityPolicyAdditions` is a per-product key, declared alongside `components` and `bundle`, and it only applies when the product has an `APP` component. In a single-product `foundry.yml` the key therefore appears at the top level of the file, as shown above. In a multi-product configuration, declare it within each product that needs it, as described in the [Add multiple products](#add-multiple-products) section.

## Platform API proxy

Applications commonly reach out to [Foundry platform APIs through the Ontology SDK](/docs/foundry/functions/platform-sdk/). The SuperRepo local preview server implements some of these platform APIs, but not all. For instance, to use the [LLM provider proxies](/docs/foundry/api/v2/llm-apis/models/openai-chat-completions-proxy/) of the platform API, you must reach out to your Foundry enrollment.

SuperRepo preview supports proxying API calls to a remote Foundry instance by defining the top-level `platformApiProxy` key inside the `foundry.yml` file, as shown in the following example:

```yaml
platformApiProxy:
  passthrough:
    - path: /api/v2/admin/users/getCurrent
      methods: [GET]
    - path: /api/v2/llm/proxy/openai/v1/responses
      methods: [POST]
```

After you declare these paths, the preview server answers requests from the Ontology SDK client for the paths and methods listed above. These requests are proxied to your Foundry enrollment using the credentials stored by `foundry login`, not the token you exported when you installed the [Foundry CLI](/docs/foundry/superrepo/foundry-cli/). If proxied requests start failing with an authorization error, your stored token has likely expired; run `foundry login refresh` to re-authorize.

The `platformApiProxy` configuration does not affect the deployed products and is only effective during preview.
