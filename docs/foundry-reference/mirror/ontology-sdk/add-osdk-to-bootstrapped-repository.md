<!-- source: https://palantir.com/docs/foundry/ontology-sdk/add-osdk-to-bootstrapped-repository/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Add an OSDK to a bootstrapped repository

This guide explains how to add an OSDK to a repository that was originally bootstrapped without one. It assumes that you bootstrapped your repository from Developer Console in Foundry or locally using the `@osdk/create-app` CLI. If you have a custom setup, some steps may need to be adjusted.

## Required changes

Follow the steps below to add an OSDK to your application.

### 1. Update `index.html`

Add the following meta tag inside the `<head>` section of your `index.html` file:

```html
<!DOCTYPE html>
<html>
  <head>
    <!-- Other head content -->
    <meta name="osdk-ontologyRid" content="%VITE_FOUNDRY_ONTOLOGY_RID%" />
    <!-- Other head content -->
  </head>
  <body>
    <!-- Body content -->
  </body>
</html>
```

### 2. Update environment files

Add the following environment variable to all environment variable files present in your project. For example: `.env.development`, `.env.production`, and `.env.code-workspaces`:

```
VITE_FOUNDRY_ONTOLOGY_RID=<ri.ontology.main.ontology.your-ontology-rid>
```

Replace `<ri.ontology.main.ontology.your-ontology-rid>` with your OSDK's Ontology RID.

You can find the Ontology RID in Ontology Manager.

### 3. Update `client.ts`

Read the Ontology RID and initialize the client object:

```typescript
- import { createPlatformClient, type PlatformClient } from "@osdk/client";
+ import { type Client, createClient } from "@osdk/client";

+ const ontologyRid = getMetaTagContent("osdk-ontologyRid");

- export const client: PlatformClient = createPlatformClient(foundryUrl, auth);
+ export const client: Client = createClient(foundryUrl, ontologyRid, auth);
```

### 4. Update `package.json`

Add your OSDK package as a dependency:

```json
{
  "dependencies": {
    + "<osdk-package-name>/sdk": "latest"
    // Other dependencies
  }
}
```

Replace `<osdk-package-name>` with your OSDK package name.

You can find the OSDK package name under **Developer Console > Overview > Generated SDKs**.

### 5. Update `.npmrc`

:::callout{theme="warning"}
You only need to perform this step if you bootstrapped the repository in a local development environment. <br><br>
If you bootstrapped the repository in Foundry, skip this step.
:::

Add the registry URL of your OSDK package.

```
+ <osdk-package-name>:registry=<registry-url>
```

Replace `<osdk-package-name>` and `<registry-url>` with your OSDK package name and registry URL.

* You can find the package name and registry URL under **Developer Console > Overview > Generated SDKs**.
* Do not include `/sdk` in the OSDK package name.

The following is an example `.npmrc` file:

```
//hostname.palantirfoundry.com/artifacts/api/:\_authToken=${FOUNDRY_TOKEN}
@osdk-package:registry=https://hostname.palantirfoundry.com/artifacts/api/repositories/ri.artifacts.main.repository.45660bd6-de33-442e-9f48-a0c02372b906/contents/release/npm
```
