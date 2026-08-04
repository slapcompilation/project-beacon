<!-- source: https://palantir.com/docs/foundry/media-sets-advanced-formats/use-media-in-osdk/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Use media in OSDK applications

:::callout{theme="warning"}
Media support in the TypeScript OSDK is in beta and subject to change during development. To enable media support, navigate to **SDK versions** from the left side panel of Developer Console, then select **Settings** to open the **Package settings** page. From here, toggle on **TypeScript** beta features.
:::

This page describes how to read, upload, and use media in your [Ontology SDK](/docs/foundry/ontology-sdk/overview/) applications. Object types and Actions with media references can be included in your Ontology SDK application for reading and writing media items.

You can also use Developer Console to [generate documentation](/docs/foundry/developer-console/create-application/) specific to your Ontology, including media reference properties on your object types.

## Read media reference properties

Fetch metadata and contents of your media reference property by calling `fetchMetadata()` and `fetchContents()` on the media reference property.

```typescript
import { OsdkMediaObject } from "@my-media-osdk/sdk";
import { MediaMetadata, MediaReference } from "@osdk/api";
import { Osdk, Result } from "@osdk/client";

const result = await client(OsdkMediaObject).fetchOne("<primaryKey>");

// Fetch metadata of a media property
const mediaMetadata = await result.mediaReference?.fetchMetadata();

// Fetch contents of a media property
const response = await result.mediaReference?.fetchContents();

if (response.ok) {
    const data = await response.blob();
    // ...
}
```

## Upload media to the Ontology

Use `uploadMedia` to upload media to the Ontology within an Ontology edit function. This returns a `MediaReference` that you can use to set a media property on an object.

For more details on using media in functions, including TypeScript v1 support, see [media in functions](/docs/foundry/functions/media/).

```typescript tab="TypeScript v2"
// Ensure you are using TypeScript OSDK 2.6 or greater to use media uploads
// in Ontology Edit Functions.

import type { Client } from "@osdk/client";
import { Aircraft } from "@ontology-sdk/sdk";
import type { Edits } from "@osdk/functions";
import { createEditBatch, uploadMedia } from "@osdk/functions";

async function uploadTextToNewPlane(client: Client): Promise<Edits.Object<Aircraft>[]> {
    const batch = createEditBatch<Edits.Object<Aircraft>>(client);
    const blob = new Blob(["Hello, world"], { type: "text/plain" });
    const mediaReference = await uploadMedia(
        client,
        { data: blob, fileName: "/planes/aircraft.txt" }
    );
    batch.create(Aircraft, { myMediaProperty: mediaReference, /* ... */ });
    return batch.getEdits();
}

export default uploadTextToNewPlane;
```

```python tab="Python"
# Ensure you are using Python OSDK 2.145 or greater to use media uploads
# in Ontology Edit Functions.

from ontology_sdk import FoundryClient
from ontology_sdk.ontology.objects import Aircraft
from functions.api import function, OntologyEdit

@function(beta=True, edits=[Aircraft])
def upload_text_to_new_plane() -> list[OntologyEdit]:
    client = FoundryClient()
    edits = client.ontology.edits()
    media_reference = client.ontology.media.upload_media(
        body="Hello, world".encode("utf8"),
        filename="/planes/aircraft.txt",
    )
    edits.objects.Aircraft.create(
        pk = "primary_key",
        my_media_property=media_reference,
        # ...
    )
    return edits.get_edits()
```

## Use uploaded media in Actions

Once you have uploaded media to the Ontology, you can pass the returned `MediaReference` to an Action that accepts media as a parameter.

```typescript
import { createMediaObject } from "@my-media-osdk/sdk";
import { MediaReference } from "@osdk/api";

const mediaReference: MediaReference = await uploadMedia();
const result = await client(createMediaObject).applyAction(
    {
      "media_reference": mediaReference,
      "path": "value"
    },
    {
      $returnEdits: true,
    }
);
```

## Considerations

* Backing an object property with multiple media sets is not supported in OSDK applications. You will receive an error if you attempt to read or write to an object property that is backed by multiple media sets.
* Media reference lists are not supported as a property type in OSDK applications.
