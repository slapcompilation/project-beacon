<!-- source: https://palantir.com/docs/foundry/functions/python-functions-api-calls/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Make API calls from functions

It is possible to make API calls to external sources from TypeScript v1, TypeScript v2 and Python functions, but doing so requires additional configuration. This configuration and external source usage are detailed below.

:::callout{theme="neutral" title="Source aliases"}
For TypeScript v2 and Python functions, we recommend referencing sources through [source aliases](/docs/foundry/functions/source-aliases/). A source alias is a portable, named reference that you can use as the source identifier in place of a specific source. When your function is distributed through a [Marketplace product](/docs/foundry/functions/marketplace-functions/), the alias can be remapped to a different source per environment, keeping your function code portable. TypeScript v1 functions use generated source symbols and do not support aliases.
:::

## Configure access to external APIs

By default, functions are not allowed to call external APIs. To enable calling external systems from your function, you must [configure a source](/docs/foundry/data-connection/set-up-source/) in [Data Connection](/docs/foundry/data-connection/overview/) to allow Foundry to connect with an external system.

For functions to connect to your source's external system securely, your source must be configured to [enable exports](/docs/foundry/data-connection/export-overview/#enable-exports-for-source) and allow the [import of your source into Code Repositories](/docs/foundry/data-connection/external-transforms/#prerequisite-import-a-source-into-code). Both of these can be configured by navigating to the source in Data Connection and opening the **Connection settings** section.

For TypeScript v1 functions, the source's API name (configured on the **Code import configuration** tab under **Connection settings**) is the identifier you reference in code.

:::callout{theme="neutral"}
Make sure to fully configure the certificate chain in your source. <br><br>
Webhook and function runtime environments are not identical. <br><br>
Sometimes, a webhook will work correctly while the API call from a function might encounter an `UNABLE_TO_GET_ISSUER_CERT` error. <br><br>
Refer to our documentation on the [`openssl` command in the source terminal](/docs/foundry/data-connection/troubleshooting/#openssl) to verify certificates.
:::

## Use an external source in a function

To make API calls from a function, you must first import your source into a functions repository using the [resource imports sidebar](/docs/foundry/functions/resource-imports-sidebar/). For TypeScript v2 and Python functions, we recommend then [creating a source alias](/docs/foundry/functions/source-aliases/) and using its alias key as the source identifier. TypeScript v1 functions reference the imported source directly. You must then declare that your function uses the source, as shown in the examples below.

Examples of this are shown below:

```typescript tab="TypeScript v1"
import { ExternalSystems } from "@foundry/functions-api";
import { MySource } from "@foundry/external-systems/sources";

export class MyExternalFunctions {
    @ExternalSystems({ sources: [MySource] })
    @Function()
    public async myExternalFunction(): Promise<string> {
        const { url } = MySource.getHttpsConnection();
        const response = await MySource.fetch(url);

        return response.text();
    }
}
```

```typescript tab="TypeScript v2"
import { getSource, getHttpsConnection, getFetch } from "@palantir/functions-sources";

export const config = {
    sources: ["mySourceAlias"]
}

async function MyExternalFunction(): Promise<string> {
    const source = await getSource("mySourceAlias");
    const { url } = getHttpsConnection(source);
    const fetch = await getFetch(source);

    const response = await fetch(url);

    return response.text();
}
```

```python tab="Python"
from functions.api import function
from functions.sources import get_source


@function(sources=["mySourceAlias"])
def my_external_function() -> str:
    source = get_source("mySourceAlias")
    url = source.get_https_connection().url
    client = source.get_https_connection().get_client()
    response = client.get(url)
    return response.text
```

You can test your function in live preview and use it to make external calls once published.

:::callout{theme="warning"}
**Third-party clients are not yet supported for serverless execution or live preview without overriding the fetch function or HTTP agent.** To ensure your API calls function properly across all environments, you must use the relevant library methods to make requests with the correct configuration. Direct API calls to external sources or internal Foundry URLs are not guaranteed to work in all environments.
:::

## Access source attributes and credentials

You can access source attributes provided by each function type's corresponding library.

The example below shows how to obtain the base URL of the source in the example above.

```typescript tab="TypeScript v1"
const { url } = MySource.getHttpsConnection();
```

```typescript tab="TypeScript v2"
const { url } = getHttpsConnection(source);
```

```python tab="Python"
url = get_source("mySourceAlias").get_https_connection().url
```

You can also access additional secrets or credentials stored on the source by using the following syntax to access secrets:

```typescript tab="TypeScript v1"
const secret = MySource.getSecret("MySecret");
```

```typescript tab="TypeScript v2"
const secret = source.secrets["MySecret"];
```

```python tab="Python"
secret = get_source("mySourceAlias").get_secret("MySecret")
```

## Use the pre-configured clients

For sources that provide a REST API, the source object allows you to retrieve a client. This client will be pre-configured with the server and client certificates specified on the source. It will also include additional proxy configurations which allow egress from the environment functions are executed in. You should always use this client, if possible, to guarantee your function can egress to the source from all environments.

```typescript tab="TypeScript v1"
const fetch = MySource.fetch;
```

```typescript tab="TypeScript v2"
const fetch = await getFetch(source);
```

```python tab="Python"
client = source.get_https_connection().get_client()
```

Alternatively, you can use your own client or third-party libraries which make external requests, and use the source object to [retrieve attributes and credentials](#access-source-attributes-and-credentials).

TypeScript v2 functions provide a pre-configured HTTP agent as an additional integration point for usage with third party libraries which accept a custom HTTP agent.

The following example demonstrates retrieving this agent and using it with [axios ↗](https://github.com/axios/axios).

```typescript tab="TypeScript v2"
import { getHttpAgent, getHttpsConnection } from "@palantir/functions-sources";
import axios from 'axios';

const agent = await getHttpAgent(source);
const { url } = getHttpsConnection(source);

const response = await axios.get(url, {
    httpsAgent: agent,
});

```

:::callout{theme="neutral"}
Currently, it is impossible to access source attributes that are not credentials unless the source provides an HTTPS client. For example, you will not be able to access the `hostname` or other non-secret attributes on a [PostgreSQL source](/docs/foundry/available-connectors/postgresql/).
:::

## Use OAuth 2.0 with outbound applications

If your external API requires OAuth 2.0 authorization, you can configure an [outbound application](/docs/foundry/administration/configure-outbound-applications/) in Control Panel and use it as the authentication method for a REST API source. When your function runs, the source exposes the calling user's OAuth access token as session credentials. Your function can then use the token to call the external API on the user's behalf.

This pattern is supported in Python and TypeScript v2 functions. See [Use the source's pre-configured client](#use-the-sources-pre-configured-client) below for code examples.

### Limitations

* **TypeScript v1:** TypeScript v1 functions cannot retrieve OAuth tokens directly from a source. To authenticate with an OAuth 2.0 API from a TypeScript v1 function, wrap the call in a [webhook](/docs/foundry/functions/webhooks/) on a REST API source configured with the outbound application. Consider [migrating to TypeScript v2](/docs/foundry/functions/typescript-v2-migration/) for direct token access.
* **Deployed mode:** OAuth token refreshing is not available when the function is running in [deployed mode](/docs/foundry/functions/functions-deployed/). If the calling user's access token expires during execution, the function cannot refresh it automatically. Run your function in [serverless mode](/docs/foundry/functions/functions-deployed/#choose-between-deployed-and-serverless-execution-modes) to use OAuth-backed outbound applications.
* **Direct function usage in Workshop:** Functions used directly in a [Workshop](/docs/foundry/workshop/overview/) module, such as [function-backed variables](/docs/foundry/workshop/functions-use/#function-backed-variables-in-workshop) or functions that populate widget content, cannot trigger the OAuth 2.0 interactive authorization prompt. If a user has not already authorized the outbound application, the function will fail rather than display the prompt. To use an OAuth-backed function from Workshop, wrap it in a [function-backed action](/docs/foundry/action-types/function-actions-overview/). Alternatively, ensure the user completes the authorization flow from another interactive interface (such as a function-backed action against the same outbound application) before the function is invoked directly in Workshop.

### Use the source's pre-configured client

The simplest approach is to use the HTTP client provided by the source. The `Authorization` header is injected automatically.

```python tab="Python"
from functions.api import function
from functions.sources import get_source

@function(sources=["myOAuthSourceAlias"])
def call_external_api() -> str:
    source = get_source("myOAuthSourceAlias")
    url = source.get_https_connection().url
    client = source.get_https_connection().get_client()

    response = client.get(url + "/api/v1/resource", timeout=10)
    return response.text
```

```typescript tab="TypeScript v2"
import { getSource, getHttpsConnection, getFetch } from "@palantir/functions-sources";

export const config = {
    sources: ["myOAuthSourceAlias"]
};

export default async function callExternalApi(): Promise<string> {
    const source = await getSource("myOAuthSourceAlias");
    const { url } = getHttpsConnection(source);
    const fetch = await getFetch(source);

    const response = await fetch(url + "/api/v1/resource");

    return response.text();
}
```

### Use a native HTTP client with manual token injection

If you need to use your own HTTP client instead of the source-provided one, retrieve the OAuth token from session credentials and set the `Authorization` header manually.

```python tab="Python"
import requests
from functions.api import function
from functions.sources import get_source
from external_systems.sources import OauthCredentials, Refreshable, SourceCredentials

@function(sources=["myOAuthSourceAlias"])
def call_external_api() -> str:
    source = get_source("myOAuthSourceAlias")
    url = source.get_https_connection().url

    refreshable_credentials: Refreshable[SourceCredentials] = source.get_session_credentials()
    session_credentials: SourceCredentials = refreshable_credentials.get()

    if not isinstance(session_credentials, OauthCredentials):
        raise ValueError("Expected OAuth credentials")

    access_token: str = session_credentials.access_token

    response = requests.get(
        url + "/api/v1/resource",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    return response.text
```

```typescript tab="TypeScript v2"
import { getSource, getHttpsConnection } from "@palantir/functions-sources";

export const config = {
    sources: ["myOAuthSourceAlias"]
};

export default async function callExternalApi(): Promise<string> {
    const source = await getSource("myOAuthSourceAlias");
    const credentials = await source.sessionCredentials?.get();

    if (!credentials || credentials.type !== "oauth") {
        throw new Error("Expected OAuth credentials");
    }

    const accessToken: string = credentials.accessToken;
    const { url } = getHttpsConnection(source);

    const response = await fetch(url + "/api/v1/resource", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    return response.text();
}
```

### Use OAuth-backed functions in actions

A common pattern is to call an OAuth-backed external API and feed the result into an [Ontology edit](/docs/foundry/functions/edits-overview/). You can then expose that function through a [function-backed action](/docs/foundry/action-types/function-actions-overview/). When a user runs the action from Workshop or AIP Studio, their OAuth token is used to make the API call, and the resulting object edits are attributed to them.

For example, the function below uses an OAuth token to fetch the calling user's profile from a third-party identity service. It then creates a new ontology object with that information:

```python tab="Python"
from functions.api import function, OntologyEdit
from functions.sources import get_source
from ontology_sdk import FoundryClient
from ontology_sdk.ontology.objects import UserProfile


@function(sources=["myOAuthSourceAlias"], edits=[UserProfile])
def link_user_profile() -> list[OntologyEdit]:
    source = get_source("myOAuthSourceAlias")
    url = source.get_https_connection().url
    client = source.get_https_connection().get_client()

    response = client.get(url + "/v1/me", timeout=10)
    response.raise_for_status()
    profile = response.json()

    ontology_edits = FoundryClient().ontology.edits()
    ontology_edits.objects.UserProfile.create(
        profile["id"],
        display_name=profile["display_name"],
    )
    return ontology_edits.get_edits()
```

```typescript tab="TypeScript v2"
import { getSource, getHttpsConnection, getFetch } from "@palantir/functions-sources";
import { UserProfile } from "@ontology/sdk";
import { Client } from "@osdk/client";
import { createEditBatch, Edits } from "@osdk/functions";

type OntologyEdit = Edits.Object<UserProfile>;

export const config = {
    sources: ["myOAuthSourceAlias"],
    edits: [UserProfile],
};

export default async function linkUserProfile(client: Client): Promise<OntologyEdit[]> {
    const source = await getSource("myOAuthSourceAlias");
    const { url } = getHttpsConnection(source);
    const fetch = await getFetch(source);

    const response = await fetch(url + "/v1/me");
    if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`);
    }
    const profile = await response.json();

    const batch = createEditBatch<OntologyEdit>(client);
    batch.create(UserProfile, {
        userProfileId: profile.id,
        displayName: profile.display_name,
    });
    return batch.getEdits();
}
```

## Troubleshoot common errors

For OAuth authorization errors, such as `HTTP 401: Unauthorized`, `Credentials expired and no refresh handler provided`, or `Resolved source credentials are not present on the Source`, see [OAuth and outbound applications](/docs/foundry/data-connection/troubleshooting/#oauth-and-outbound-applications) in the Data Connection troubleshooting reference.

### HTTP 407: Proxy authentication required

Function network requests must be covered by your source's [egress policies](/docs/foundry/administration/configure-egress/). If the destination hostname does not match an allowed policy, the request may return `HTTP 407: Proxy Authentication Required`.

If your egress policies look correct, check how the request URL is built. The URL from `getHttpsConnection()` has no trailing slash, so an appended path that omits the leading `/` is fused to the hostname:

```text
"https://example.com" + "api/v1"
→ "https://example.comapi/v1"
```

The resulting hostname (`example.comapi`) is not covered by any egress policy, so the request is rejected. Prefix the path with `/` (for example, `url + "/api/v1"`).
