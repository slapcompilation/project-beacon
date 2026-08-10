<!-- source: https://palantir.com/docs/foundry/object-views/generate-urls/ · mirrored 2026-08-08 from Palantir Foundry docs -->

# Generate Object View URLs

In the course of developing Object Views, you may need to generate URLs that link to a specific object or search for objects.

If you are embedding these views within an iframe rather than providing them as links, append a URL query parameter `embedded=true`, which will load the view without the Workspace sidebar.

:::callout{theme="neutral"}
To learn how to create a URL linking to a search or Exploration, see [Generating Object Explorer URLs](/docs/foundry/object-explorer/generate-urls/).
:::

## Generate object links

There are two ways to link into the URL.

**Option 1**

`/workspace/hubble/external/object/v0/<object-type-id>?<primary-key-property-id>=<primary-key-property-value>`

For example:

`/workspace/hubble/external/object/v0/aircraft?aircraftId=1234`

**Option 2**

`/workspace/hubble/external/search/v2/?objectId=<objectRid>`

This way is recommended when the primary key property value could possibly have special characters.

This URL loads the Object View within the context of Object Explorer. To load the Object View with no additional wrapping (for instance, to use within an iframe), create a URL like `/workspace/hubble/objects/<objectRid>`.
