<!-- source: https://palantir.com/docs/foundry/ontology-sdk/how-to-add-to-existing-typescript/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Add an OSDK package to an existing application

This page will walk you through the process of adding an OSDK package to an existing application. If you do not have an existing application, view the documentation on [bootstrapping a new OSDK application](/docs/foundry/developer-console/how-to-bootstrapping-typescript/).

## 1: Prerequisites

### Create a Developer Console application

Follow the steps listed in the [create a new Developer Console application](/docs/foundry/developer-console/create-application/) page.

### Set up your token

Export your token in your local environment. Below is an example using a sample personal access token, but you can generate a longer-lived one in the Developer Console. This token should not be checked into source control because it is your personal access token.

```bash
export FOUNDRY_TOKEN=<YOUR-TOKEN-FROM-GETTING-STARTED-PAGE>
```

### Check Node version

The Typescript SDK requires Node 18 or higher to work. To check what version of Node you are on, use the command below.

```bash
node --version
```

## 2: Add the OSDK to an existing Project

### Set up the NPM registry

Add the following code to your repository or user .npmrc file, replacing any `< > `with an application-specific value:

```
//<REGISTRY-URL-FROM-OVERVIEW-PAGE>:_authToken=${FOUNDRY_TOKEN}
<PACKAGE-NAME>:registry=https://<REGISTRY-URL-FROM-OVERVIEW-PAGE>
```

### Optional: Set up certificate

If your organization requires certificates for network traffic, you may need to tell Node where that certificate lives.

```bash
export NODE_EXTRA_CA_CERTS="/path/to/my.crt"
```

### Install the latest version of the SDK

Run the following command to install your SDK package:

```bash
npm install <PACKAGE-NAME>@latest
npm install @osdk/client@latest
npm install @osdk/oauth@latest
```

### Initialize the Foundry client to start developing

Add the following code to your application, replacing any `< >` with the specifics of your package:

```typescript
import { createPublicOauthClient } from "@osdk/oauth";
import { createClient } from "@osdk/client";
import { <ANY-OBJECT-NAME> } from "<PACKAGE-NAME>";
import React, { useEffect } from "react";

const auth = createPublicOauthClient("<YOUR-CLIENT-ID>", "<YOUR-FOUNDRY-URL>", "<YOUR-REDIRECT-URL>");
const client: Client = createClient("<YOUR-FOUNDRY-URL>", "<YOUR-ONTOLOGY-RID>", auth);

export default function SimpleReactComponent() {
    useEffect(() => {
        if (auth.getTokenOrUndefined()) {
            auth.refresh().catch(() =>
            /**
               If we cannot refresh the token (for example, if the user is not logged in) we initiate the login flow in Foundry
               Once login is complete, the user will be redirected back to http://localhost:8080/auth/callback
            **/
            auth.signIn())
        } else {
            client(<ANY-OBJECT-NAME>).fetchPage({ $pageSize: 10 }).then((object) => {
                console.log(object.data);
            });
        }
    }, []);
};
```
