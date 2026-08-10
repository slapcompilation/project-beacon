<!-- source: https://palantir.com/docs/foundry/functions/source-aliases/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Source aliases

Source aliases are named, portable references to [Data Connection sources](/docs/foundry/data-connection/set-up-source/). By referring to a source by its alias key instead of a specific source identifier, you decouple your function logic from any one source. This keeps your functions portable across environments.

## Import a source

To import a source:

1. Open a TypeScript v2 or Python code repository and navigate to the **Resource imports** panel.

2. Select the **Ontology SDK** tab.

3. Select **Add > Sources**.

   ![The Add dropdown in the Resource imports panel showing the Sources option.](/docs/resources/foundry/functions/source-aliases-import.png)

4. Search for and select the source to import, then choose **Confirm selection**.

## Add a source alias

After importing a source, you can add an alias to it:

1. In the **Resource imports** panel, locate the source under **Sources**.
2. Select **Add alias** below the source name.

   ![The Resource imports panel showing an imported source with an option to add an alias.](/docs/resources/foundry/functions/source-aliases-add.png)

:::callout{theme="neutral"}
Alias keys must be unique within the repository.
:::

## Edit a source alias

To edit an existing source alias, navigate to the **Sources** section in the **Resource imports** panel. Select the pen icon next to the alias to edit it inline.

![The Resource imports panel showing a source alias with an option to edit it.](/docs/resources/foundry/functions/source-aliases-edit.png)

## Use a source alias in code

To use a source alias in your function, reference the alias by its key wherever you declare and retrieve the source. Pass the alias key to the `sources` configuration and to `getSource` (TypeScript v2) or `get_source` (Python):

```typescript tab="TypeScript v2"
import { getSource, getHttpsConnection, getFetch } from "@palantir/functions-sources";

export const config = {
    sources: ["demoSource"]
}

async function myExternalFunction(): Promise<string> {
    const source = await getSource("demoSource");
    const { url } = getHttpsConnection(source);
    const fetch = await getFetch(source);

    const response = await fetch(url);

    return response.text();
}
```

```python tab="Python"
from functions.api import function
from functions.sources import get_source


@function(sources=["demoSource"])
def my_external_function() -> str:
    source = get_source("demoSource")
    url = source.get_https_connection().url
    client = source.get_https_connection().get_client()
    response = client.get(url)
    return response.text
```

If you need the resource identifier (RID) of the source that an alias resolves to, use the `Aliases.source` utility in TypeScript v2 or the `source` utility in Python. Read the resolved RID from the `.rid` property:

```typescript tab="TypeScript v2"
import { Aliases } from "@osdk/functions";

const sourceRid = Aliases.source("demoSource").rid;
```

```python tab="Python"
from functions.aliases import source

source_rid = source("demoSource").rid
```

For more information about using sources in functions, including accessing credentials and using pre-configured clients, see [Make API calls from functions](/docs/foundry/functions/api-calls/).

## Use source aliases with Marketplace

When you add a function that uses source aliases to a [Marketplace product](/docs/foundry/functions/marketplace-functions/), each aliased source appears as a configurable input under **Data connection sources**. Installers can map each input source to an available source in their environment during installation, without needing to modify the function source code.

![A Marketplace product showing a Data Connection source as a configurable input.](/docs/resources/foundry/functions/source-aliases-marketplace-product.png)

### Set a description

To help installers understand which source to provide, you can add a description to the source input. Select the source under **Inputs** to open the **Details** panel, then enter a description on the **General** tab.

![The Details panel for a source input showing a description field.](/docs/resources/foundry/functions/source-aliases-description.png)

### Installation experience

During installation, installers see the source description and can select a source appropriate for their environment. Marketplace remaps the selected source to the defined alias automatically, so the function code remains untouched.

![The installation view showing a source alias with a description and options to change the source or scope it to a namespace.](/docs/resources/foundry/functions/source-aliases-install.png)
