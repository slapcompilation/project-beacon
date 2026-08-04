<!-- source: https://palantir.com/docs/foundry/functions/model-aliases/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Model aliases

Model aliases are named references to language models that provide a convenient way to reference language models in code.

For a full walkthrough of using language models in functions, see [Language models in TypeScript v2 and Python functions](/docs/foundry/functions/language-models-python-tsv2/).

## Define a model alias

To define a model alias, open a TypeScript v2 or Python code repository and follow the steps below:

1. Open the **Platform SDK** tab in the **Resource imports** panel.

![The tab to access Platform SDK resources in a TypeScript v2 repository.](/docs/resources/foundry/functions/platform-sdk-tab.png)

2. To import a new language model, select **Add > Models** in the upper right corner. A window will open in which you can view available Palantir-provided and registered models.

![The model import dialog in a TypeScript v2 repository.](/docs/resources/foundry/functions/models-v3-import-dialog.png)

3. Select the models to import, then choose **Confirm selection**. A configuration dialog will open in which you can configure aliases for each selected model. Select the pen icon near the alias to make edits, or choose to keep the defaults.

:::callout{theme="neutral"}
Alias keys must be unique within the repository.
:::

![Configure model aliases after choosing models to import.](/docs/resources/foundry/functions/configure-models-aliases.png)

4. The imported models will appear in the **Platform SDK** tab in the **Resource imports** side panel. You can edit any alias inline by selecting the pen icon next to the alias.

![Configure model aliases inline.](/docs/resources/foundry/functions/inline-models-aliases-edit.png)

## Use a model alias in code

To use a model alias in your function, import the alias utility and reference the alias by name. The alias resolves to a model RID that you can pass to a model client:

```typescript tab="TypeScript v2"
import { Aliases } from "@osdk/functions";

const modelRid = Aliases.model("gpt5Nano").rid;
```

```python tab="Python"
from functions.aliases import model

model_rid = model("gpt5Nano").rid
```

For a complete example of calling a language model using an alias, see [Write a function that uses a language model](/docs/foundry/functions/language-models-python-tsv2/#write-a-function-that-uses-a-language-model).

:::callout{theme="warning"}
Model aliases work in functions added to [Marketplace products](/docs/foundry/functions/marketplace-functions/), but cannot be remapped during installation. If the model referenced by an alias is not available in the target environment, the function will fail to resolve the alias at runtime.
:::
