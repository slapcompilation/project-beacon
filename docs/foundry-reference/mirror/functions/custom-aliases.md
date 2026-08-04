<!-- source: https://palantir.com/docs/foundry/functions/custom-aliases/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Custom aliases

Custom aliases are named references that store string values such as configuration parameters, feature flags, or environment-specific settings. By using custom aliases instead of hard-coding values, you can decouple your function logic from specific configurations and make your functions portable across environments.

## Define a custom alias

To define a custom alias, open a TypeScript v2 or Python code repository and follow the steps below:

1. Open the **Resource imports** side panel and select the **Platform SDK** tab. You will see a section for custom aliases.

![The Resource imports side panel showing the Platform SDK tab with the custom aliases option.](/docs/resources/foundry/functions/custom-aliases-sidebar.png)

2. Select **New alias** to open the alias creation dialog. Provide a **Key** for the alias name and a **Value** to associate with it, then select **Create**.

![The new alias dialog with a key set to myAlias and a value set to someValue.](/docs/resources/foundry/functions/custom-aliases-create.png)

:::callout{theme="neutral"}
Alias keys must be unique within the repository.
:::

3. The custom alias will appear in the **Custom aliases** section.

## Edit a custom alias

To edit an existing custom alias, navigate to the **Custom aliases** section in the **Platform SDK** tab. Select the pen icon next to the alias to edit its value inline. You can also click on the 3 dots to edit the alias key or delete the alias altogether.

![The custom aliases list showing a created alias with an option to edit the value.](/docs/resources/foundry/functions/custom-aliases-edit.png)

## Use a custom alias in code

To use a custom alias in your function, import the alias utility and reference the alias by its key:

```typescript tab="TypeScript v2"
import { Aliases } from "@osdk/functions";

export default function getCustomValue(): string {
    return Aliases.custom("myAlias");
}
```

```python tab="Python"
from functions.aliases import custom
from functions.api import function

@function
def get_custom_value() -> str:
    return custom("myAlias")
```

## Use custom aliases with Marketplace

When you add a function that uses custom aliases to a [Marketplace product](/docs/foundry/functions/marketplace-functions/), the aliases automatically appear as configurable parameters under **Inputs**. Installers can set the alias values appropriate for their environment without modifying the function source code.

![A Marketplace product showing the custom alias as a configurable parameter input alongside the function output.](/docs/resources/foundry/functions/custom-aliases-marketplace-product.png)

### Set a description

To help installers understand how to configure the alias, you can add a description to the alias parameter. Select the alias under **Inputs** to open the **Details** panel, then enter a description on the **General** tab.

![The Details panel for a custom alias parameter showing a description field.](/docs/resources/foundry/functions/custom-aliases-set-description.png)

### Add presets

You can define preset values for the alias that installers can choose from during installation. In the **Details** panel, select the **Presets** tab and choose **Manual overrides** to define a set of allowed values.

![The Presets tab showing manual override configuration with preset values for the alias.](/docs/resources/foundry/functions/custom-aliases-add-presets.png)

### Installation experience

During installation, the installer will see the alias description and can choose from the preset values or configure the alias manually. After installation, the function resolves the alias to the value configured by the installer.

![The installation view showing the custom alias parameter with its description and preset value options.](/docs/resources/foundry/functions/custom-aliases-install.png)
