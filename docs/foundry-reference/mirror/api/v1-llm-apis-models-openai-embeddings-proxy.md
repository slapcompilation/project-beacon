<!-- source: https://palantir.com/docs/foundry/api/v1/llm-apis/models/openai-embeddings-proxy/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# OpenAI Embeddings (Proxy)

```
POST /api/v2/llm/proxy/openai/v1/embeddings
```

Foundry provides a proxy endpoint that forwards requests to the [OpenAI Embeddings API ↗](https://developers.openai.com/api/reference/resources/embeddings/methods/create). This enables the use of open-source SDKs and tooling while benefiting from Foundry capabilities such as rate limiting, data governance, and usage tracking.

Third-party applications that use this endpoint via OAuth2 must request the `api:use-language-models-execute`operation scope.

## Headers

| Name | Type | Description |
| --- | --- | --- |
| `Authorization` | `string` | Bearer token for authentication. |
| `Content-Type` | `string` | Must be `application/json`. |
| `attribution` | `optional<string>`  | Comma-separated RIDs for usage attribution to a project. When omitted, all usage will be attributed directly to the calling user. |
| `traceParent` | `optional<string>`  | W3C Trace Context `traceparent` header for tracing and observability features. When omitted, in-platform observability features will not function. |
| `traceState` | `optional<string>`  | W3C Trace Context `tracestate` header for tracing and observability features. When omitted, in-platform observability features will not function. |

Note that Foundry clients such as the Python SDK and OSDK in the examples below will automatically set `attribution`, `traceParent`, and `traceState` headers.

## Request format

This endpoint has the same shape as the OpenAI Embeddings API. Refer to the [OpenAI Embeddings API documentation ↗](https://developers.openai.com/api/reference/resources/embeddings/methods/create) for the full schema.

The `model` field should be set to the language model's resource identifier, for example `ri.language-model-service..language-model.text-embedding-ada-002_azure`, which can be found in Model Catalog.

## AIP integration and data governance

This endpoint enforces the same data governance as other AIP usage, such as zero data retention (ZDR) and georestriction requirements. We selectively enable provider API features that are compatible with these requirements. Usage is visible in Resource Management and is subject to rate limiting.

## Examples

### Bash

```bash
curl -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    "https://$HOSTNAME/api/v2/llm/proxy/openai/v1/embeddings" \
    -d '{
      "model": "ri.language-model-service..language-model.text-embedding-ada-002_azure",
      "input": "Hello, world"
    }'
```

### Python

```python
from openai import OpenAI
from foundry_sdk.v2.language_models.utils import (
    get_foundry_token,
    get_openai_base_url,
    get_http_client,
)


def openai_embeddings(prompt: str) -> str:
    # The client returned by get_http_client will automatically propagate
    # attribution and tracing headers
    client = OpenAI(
        api_key=get_foundry_token(preview=True),
        base_url=get_openai_base_url(preview=True),
        http_client=get_http_client(preview=True),
    )

    embeddings = client.embeddings.create(
        model="ri.language-model-service..language-model.text-embedding-ada-002_azure", input=prompt
    )
    return str(embeddings.data)
```

### TypeScript

```typescript
import OpenAi from "openai";
import { PlatformClient } from "@osdk/client";

export default async function openAiEmbeddings(
  platformClient: PlatformClient,
  prompt: string
): Promise<string> {
  // The PlatformClient fetch function will automatically propagate attribution
  // and tracing headers
  const client = new OpenAi({
    apiKey: await platformClient.tokenProvider(),
    baseURL: platformClient.baseUrl + "api/v2/llm/proxy/openai/v1",
    fetch: platformClient.fetch,
  });
  const embeddings = await client.embeddings.create({
    model:
      "ri.language-model-service..language-model.text-embedding-ada-002_azure",
    input: prompt,
  });
  return JSON.stringify(embeddings.data);
}
```
