<!-- source: https://palantir.com/docs/foundry/functions/streaming-functions/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Streaming functions

Python and TypeScript v2 functions can stream the result of an execution in chunks. This is useful when data becomes available over time and lets consuming applications begin processing the result before it is complete.

## Write a function with a streamed response

To stream a response, Python functions must be annotated with an `Iterable[T]` return type and use the `yield` keyword to produce values as they become available. In TypeScript, you must declare an async generator function by adding a `*` character after the `function` keyword, specify a return type of `AsyncIterable<T>`, and use the `yield` keyword to produce values as they become available.

The following example demonstrates how a function can return a stream of integers where one second elapses between each integer:

```python tab="Python"
from functions.api import function
from typing import Iterable
import time

@function
def my_lazy_number_generator(n: int) -> Iterable[int]:
    for i in range(n):
        time.sleep(1)
        yield i
```

```typescript tab="TypeScript v2"
import { Integer } from "@osdk/functions";

export default async function* myLazyNumberGenerator(n: Integer): AsyncIterable<Integer> {
    for (let i = 0; i < n; i++) {
        await new Promise(resolve => setTimeout(resolve, 1_000));
        yield i;
    }
}
```

Functions with streamed responses are useful when working with language models that may take time to generate the entire output. By yielding each chunk of the response as it is produced by the model, you can provide a real-time experience that does not block on the full completion of the response. Refer to [Language models in TypeScript v2 and Python functions](/docs/foundry/functions/language-models-python-tsv2/) for more information on calling language models in functions.

The following example uses the `openai` SDK to call a language model and stream the response back by enabling the `stream` flag in the request:

```python tab="Python"
from openai import OpenAI
from functions.api import function
from functions.aliases import model
from foundry_sdk.v2.language_models import (
    get_openai_base_url,
    get_foundry_token,
    get_http_client,
)
from typing import Iterable

@function
def create_chat_completion(prompt: str) -> Iterable[str]:
    client = OpenAI(
        api_key=get_foundry_token(preview=True),
        base_url=get_openai_base_url(preview=True),
        http_client=get_http_client(preview=True),
    )

    stream = client.chat.completions.create(
        model=model("gpt55").rid,
        messages=[
            {
                "role": "user",
                "content": prompt,
            },
        ],
        stream=True
    )

    for event in stream:
        if event.choices:
            content = event.choices[0].delta.content
            if content:
                yield content
```

```typescript tab="TypeScript v2"
import { PlatformClient } from "@osdk/client";
import OpenAI from "openai";
import { Aliases } from "@osdk/functions";
import { getFoundryToken, getOpenAiBaseUrl, createFetch } from "@osdk/language-models";

export default async function* createChatCompletion(client: PlatformClient, prompt: string): AsyncIterable<string> {
    const oaiClient = new OpenAI({
        apiKey: await getFoundryToken(client),
        baseURL: getOpenAiBaseUrl(client),
        fetch: createFetch(client),
    });

    const stream = await oaiClient.chat.completions.create({
        model: Aliases.model("gpt55").rid,
        messages: [
            { role: 'user', content: prompt },
        ],
        stream: true
    });

    for await (const event of stream) {
        const content = event.choices[0]?.delta?.content;
        if (content) {
            yield content;
        }
    }
}
```

## Call streaming functions through the Ontology SDK

Once you have tagged and published your streaming function, you can execute it through the [Ontology SDK](/docs/foundry/ontology-sdk/overview/) in a React application, a custom widget in Workshop, or another function.

:::callout{theme="neutral" title="Beta"}
Executing functions with streamed responses through the Ontology SDK is in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development. Functionality may change during active development.
:::

```python tab="Python"
from foundry_sdk_runtime import AllowBetaFeatures

with AllowBetaFeatures():
    with client.ontology.queries.create_chat_completion_streaming(prompt="Where is Mount Everest?") as stream:
        for text in stream:
            # ...
```

```typescript tab="TypeScript"
import { __EXPERIMENTAL__NOT_SUPPORTED_YET__executeStreamingFunction } from "@osdk/api/unstable";

const stream = client(__EXPERIMENTAL__NOT_SUPPORTED_YET__executeStreamingFunction).executeStreamingFunction(
    createChatCompletion,
    {
        prompt: "Where is Mount Everest?",
    }
);

for await (const text of stream) {
    // ...
}
```
