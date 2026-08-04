<!-- source: https://palantir.com/docs/foundry/functions/language-models-python-tsv2/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Language models in TypeScript v2 and Python functions

:::callout{title="Prerequisites" theme="neutral"}
To use Palantir-provided language models, [AIP must be enabled on your enrollment](/docs/foundry/aip/enable-aip-features/). You must also have permissions to use [AIP builder capabilities](/docs/foundry/aip/aip-features/#aip-applications-and-builder-capabilities).
:::

Palantir provides a set of language models that can be used within functions. [Learn more about Palantir-provided LLMs](/docs/foundry/aip/supported-llms/).

## Import a language model

To begin using a language model, you must import the specific model into your functions code repository by following the steps below:

1. Open the **Platform SDK** tab in the **Resource imports** panel.

![The tab to access Platform SDK resources in a TypeScript v2 repository.](/docs/resources/foundry/functions/platform-sdk-tab.png)

2. To import a new language model, select **Add > Models** in the upper right corner. A window will open in which you can view available Palantir-provided and registered models.

![The model import dialog in a TypeScript v2 repository.](/docs/resources/foundry/functions/models-v3-import-dialog.png)

3. Select the models to import, then choose **Confirm selection**. A configuration dialog will open in which you can configure aliases for each selected model. Select the pen icon near the alias to make edits, or choose to keep the defaults.

:::callout{theme="warning"}
Each model must have an alias, and the alias must be unique within the repository.
:::

![Configure model aliases after choosing models to import.](/docs/resources/foundry/functions/configure-models-aliases.png)

4. The imported models will appear in the **Platform SDK** tab in the **Resource imports** side panel. You can edit any alias inline by selecting the pen icon next to the alias.

![Configure model aliases inline.](/docs/resources/foundry/functions/inline-models-aliases-edit.png)

## Write a function that uses a language model

Language models in TypeScript v2 and Python functions use proxy endpoints to interact with models. The following example uses the [OpenAI chat completion proxy endpoint](/docs/foundry/api/v2/llm-apis/models/openai-chat-completions-proxy/). You can select other providers from the documentation side panel.

:::callout{theme="neutral"}
Third-party libraries, such as `openai` in the example below, are not pre-installed. Install them from the **Libraries** section of the left side panel.
:::

To use an imported language model in your function, begin by importing the necessary utilities:

```typescript tab="TypeScript v2"
import { PlatformClient } from "@osdk/client";
import OpenAI from "openai";
import { Aliases } from "@osdk/functions";
import { getFoundryToken, getOpenAiBaseUrl, createFetch } from "@osdk/language-models";
```

```python tab="Python"
from openai import OpenAI
from functions.api import function
from functions.aliases import model
from foundry_sdk.v2.language_models import (
    get_openai_base_url,
    get_foundry_token,
    get_http_client,
)
```

Directly call the model using the model aliases you configured along with the imported utilities. This approach is simpler than the TypeScript v1 workflow and reduces the need to hardcode resource identifiers.

```typescript tab="TypeScript v2"
export default async function callOpenAi(client: PlatformClient, prompt: string): Promise<string> {
    const oaiClient = new OpenAI({
        apiKey: await getFoundryToken(client),
        baseURL: getOpenAiBaseUrl(client),
        fetch: createFetch(client),
    });

    const completion = await oaiClient.chat.completions.create({
        model: Aliases.model("{MY_ALIAS}").rid,
        messages: [
            { role: 'user', content: prompt },
        ],
        reasoning_effort: "minimal",
        max_completion_tokens: 200,
    });

    return completion.choices[0]?.message.content ?? "";
}
```

```python tab="Python"
@function
def get_chat_completion(prompt: str) -> str:
    client = OpenAI(
        api_key=get_foundry_token(preview=True),
        base_url=get_openai_base_url(preview=True),
        http_client=get_http_client(preview=True),
    )

    completion = client.chat.completions.create(
        model=model("{MY_ALIAS}").rid,
        messages=[
            {
                "role": "user",
                "content": prompt,
            },
        ],
    )

    return str(completion.choices[0].message.content)
```
