<!-- source: https://palantir.com/docs/foundry/functions/media/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Media

Functions enable you to access and modify media in [TypeScript v2](/docs/foundry/functions/typescript-v2-getting-started/), [Python](/docs/foundry/functions/python-getting-started/), and [TypeScript v1](/docs/foundry/functions/typescript-v1-getting-started/). TypeScript v2 and Python use the `Media` type to read, upload, and transform media, and support media uploads through [Ontology edits](/docs/foundry/functions/edits-overview/) and the OSDK. TypeScript v1 functions provide a `MediaItem` type with built-in operations for working with different kinds of media without external libraries.

If you need any operations that don't currently exist out-of-the-box, you will likely need to use external libraries or write your own custom code. [Learn more about adding dependencies to functions repositories.](/docs/foundry/functions/add-dependencies/)

## TypeScript v2 and Python

Use Ontology edit functions to upload media and create objects in the Ontology. Once uploaded, you can read and download media files from objects for use in your application. [Learn more about media sets in Foundry.](/docs/foundry/media-sets-advanced-formats/media-overview/)

You can construct Ontology edits in TypeScript v2 and Python functions by uploading media to the Ontology to obtain a `Media` instance. The `Media` type wraps a `MediaReference` and exposes [higher-level operations](#media-ontology-sdk-operations) for fetching contents, fetching metadata, and attaching media to objects. You can use the `Media` to construct an Ontology edit, or pass existing media into the function as a parameter.

### Use as a function input or output type

Functions can take in a `Media` as an input, create temporary media by uploading data with `uploadMedia`, or retrieve `Media` from a media reference property on an object. Functions can return a `Media` type as well, whether it has been temporarily uploaded, or if it came from an object's media reference property. In a function, you can fetch the byte contents of the `Media`, fetch its metadata, or attach it to an Ontology object via Ontology edits. In Python, you can also fetch the full per-variant metadata; in TypeScript v2, `fetchMetadata` currently exposes only the high-level fields (`mediaType`, `sizeBytes`, `path`).

```typescript tab="TypeScript v2"
import type { Media } from "@osdk/client";

export default async function echoMedia(media: Media): Promise<Media> {
    return media;
}
```

```python tab="Python"
from functions.api import function, Media
# The Media type may also be imported from foundry_sdk_runtime
# from foundry_sdk_runtime.media import Media

@function
def echo_media(media: Media) -> Media:
    return media
```

### Upload media

Use the Ontology SDK `uploadMedia` (TypeScript v2) and `client.ontology.media.upload_media` (Python) helpers to upload raw bytes within a function. Both return a `Media`, which you can then edit an Ontology object media property with an Ontology edit or return from the function.

```typescript tab="TypeScript v2"
import type { Client, Media } from "@osdk/client";
import { uploadMedia } from "@osdk/functions";

export default async function uploadMediaItem(
    client: Client,
    body: string,
    fileName: string,
): Promise<Media> {
    const blob = new Blob([body], { type: "text/plain" });
    const media: Media = await uploadMedia(
        client,
        { data: blob, fileName }
    );
    return media;
}
```

```python tab="Python"
from ontology_sdk import FoundryClient
from foundry_sdk_runtime.media import Media
from functions.api import function

@function(beta=True)
def upload_media(body: str, media_set_filename: str) -> Media:
    client = FoundryClient()
    media: Media = client.ontology.media.upload_media(
        body=body.encode("utf8"),
        filename=media_set_filename,
    )
    return media
```

```python tab="Python (async)"
from ontology_sdk import FoundryClient
from foundry_sdk_runtime.media import Media
from functions.api import function

@function(beta=True)
async def upload_media(body: str, media_set_filename: str) -> Media:
    client = FoundryClient()
    media_coroutine = client.ontology.media.async_upload_media(
        body=body.encode("utf8"),
        filename=media_set_filename,
    )
    # media_coroutine is awaitable.
    return await media_coroutine
```

:::callout{theme="info"}
Uploading media is temporary, unless set to an Ontology object's media reference property. When the Ontology edits are applied, the media is then persisted on the Ontology object property.
:::

### Upload media in Ontology edit functions

Whether you uploaded media within a function or received a `Media` as an input to the function, you can update media properties on existing Ontology objects or create new Ontology objects with `Media` parameters.

```typescript tab="TypeScript v2"
// Ensure you are using TypeScript OSDK 2.16 or greater

import type { Client, Media } from "@osdk/client";
import { Aircraft } from "@ontology-sdk/sdk";
import type { Edits } from "@osdk/functions";
import { createEditBatch, uploadMedia } from "@osdk/functions";

async function uploadTextToNewPlane(client: Client): Promise<Edits.Object<Aircraft>[]> {
    const batch = createEditBatch<Edits.Object<Aircraft>>(client);
    const blob = new Blob(["Hello, world"], { type: "text/plain" });
    const media: Media = await uploadMedia(
        client,
        { data: blob, fileName: "/planes/aircraft.txt" }
    );
    batch.create(Aircraft, { myMediaProperty: media, /* ... */ });
    return batch.getEdits();
}

export default uploadTextToNewPlane;
```

```python tab="Python"
# Ensure you are using Python OSDK 2.198 or greater

from ontology_sdk import FoundryClient
from ontology_sdk.ontology.objects import Aircraft
from functions.api import function, OntologyEdit
from foundry_sdk_runtime.media import Media

@function(beta=True, edits=[Aircraft])
def upload_text_to_new_plane() -> list[OntologyEdit]:
    client = FoundryClient()
    edits = client.ontology.edits()
    media: Media = client.ontology.media.upload_media(
        body="Hello, world".encode("utf8"),
        filename="/planes/aircraft.txt",
    )
    edits.objects.Aircraft.create(
        pk = "primary_key",
        my_media_property=media,
        # ...
    )
    return edits.get_edits()
```

:::callout{theme="info"}
In TypeScript OSDK generator versions before 2.20, `uploadMedia` returned a `MediaReference`. Starting in version 2.20, `uploadMedia` returns a `Media`, which wraps the underlying `MediaReference` and exposes higher-level operations such as `fetchContents`, `fetchMetadata`, and `getMediaReference()`. You can pass a `Media` directly into `createEditBatch` operations.
:::

### Passing a media reference parameter on action type

Action parameters of type media reference can be passed to the function as a parameter.

The screenshot below shows an action passing a media parameter to its backing function.

<img src="./media/media-tutorial-media-action-parameter.png" alt = "action" width="600"/>

### Media Ontology SDK operations

:::callout{theme="info"}
The methods below work on any `Media` instance, including those returned from `upload_media` and those exposed as `Media` properties on object types.
:::

#### Retrieve media bytes data

You can access the raw data stored on the `Media`. The signature for the method is as follows:

```typescript tab="TypeScript v2"
fetchContents(): Promise<Response>;

// "Response" is a standard interface on the JavaScript Fetch API
// https://developer.mozilla.org/en-US/docs/Web/API/Response
const mediaContents: Response = await myAircraft.myMediaProperty.fetchContents();

if (mediaContents.ok) {
    const mediaMimeType = mediaContents.headers.get("Content-Type");

    // Blob is a standard JavaScript type, representing a file-like object of immutable, raw data.
    // https://developer.mozilla.org/en-US/docs/Web/API/Blob
    // https://developer.mozilla.org/en-US/docs/Web/API/Response/blob
    const mediaBlob: Blob = await mediaContents.blob();
}
```

```python tab="Python"
get_media_content(self) -> BytesIO: ...

from io import BytesIO

# https://docs.python.org/3/library/io.html#io.BytesIO
raw_data: BytesIO = my_aircraft.my_media_property.get_media_content()
```

### Get media metadata

You can retrieve the metadata of the `Media`:

```typescript tab="TypeScript v2"
fetchMetadata(): Promise<MediaMetadata>;

// Example usage:
const mediaMetadata = await myAircraft.myMediaProperty.fetchMetadata();
const sizeBytes = mediaMetadata.sizeBytes;
const mediaType = mediaMetadata.mediaType;
```

```python tab="Python"
from foundry_sdk_runtime.media import MediaMetadata

# Example usage:
media_metadata: MediaMetadata = my_aircraft.my_media_property.get_media_metadata()
path = media_metadata.path
size_bytes = media_metadata.size_bytes
media_type = media_metadata.media_type
```

In Python, `get_media_full_metadata()` returns a `MediaFullMetadata` whose `item_metadata` is a discriminated union over the media type. Narrow on the variant class (or check `item_metadata.type`) to access type-specific fields:

```python tab="Python"
get_media_full_metadata(self) -> MediaFullMetadata: ...

# Narrow on the variant class (or check item_metadata.type) to access type-specific fields.
# Other variants include AudioMediaItemMetadata, VideoMediaItemMetadata,
# SpreadsheetMediaItemMetadata, Model3dMediaItemMetadata, DicomMediaItemMetadata,
# EmailMediaItemMetadata, and UntypedMediaItemMetadata. See the full schema:
# https://github.com/palantir/foundry-platform-python/blob/develop/docs/v2/MediaSets/models/MediaItemMetadata.md

from foundry_sdk.v2.media_sets.models import (
    DocumentMediaItemMetadata,
    ImageryMediaItemMetadata,
)
from foundry_sdk_runtime.media import MediaFullMetadata

full_metadata: MediaFullMetadata = my_aircraft.my_media_property.get_media_full_metadata()
item = full_metadata.item_metadata

if isinstance(item, DocumentMediaItemMetadata):
    page_count = item.pages
    title = item.title
elif isinstance(item, ImageryMediaItemMetadata):
    dimensions = item.dimensions
    bands = item.bands
```

### Transform media

:::callout{theme="warning"}
Media transformations are in the beta stage of development. Functionality may change during active development.
:::

You can transform media items (such as rotating, resizing, or re-encoding images, slicing or rendering PDF pages, or running OCR) and wait for the result. The transformation job is submitted, it is polled to completion, and the transformed content is returned.

In TypeScript v2, transformations are exposed through `@osdk/api/unstable` as an experimental helper. In Python, call `client.ontology.media.transform_and_wait` on a generated `FoundryClient`. The async variant `async_transform_and_wait` takes the same arguments and can be awaited.

```typescript tab="TypeScript v2"
// Ensure you are using @osdk/api 2.8.0 or greater for transformAndWait.
// "MediaTransformation" is a discriminated union:
// each variant (`$image`, `$video`, `$audio`, `$documentToText`, `$documentToImage`, `$documentToDocument`, `$audioToText`, etc.)
// selects a transformation kind, with its own encoding and operation fields.
// See the "MediaTransformation" type definition for a full set of variants and operations:
// https://github.com/palantir/osdk-ts/blob/main/packages/api/src/experimental/MediaTransformation.ts

import {
    __EXPERIMENTAL__NOT_SUPPORTED_YET__transformAndWait,
    type MediaTransformation,
} from "@osdk/api/unstable";
import type { Client, Media } from "@osdk/client";
import { uploadMedia } from "@osdk/functions";

export default async function rotateImage(
    client: Client,
    media: Media,
): Promise<Media> {
    const transformation: MediaTransformation = {
        $image: {
            $encoding: "jpg",
            $operations: [{ $rotate: { $angle: "DEGREE_180" } }],
        },
    };

    const result: Response = await client(
        __EXPERIMENTAL__NOT_SUPPORTED_YET__transformAndWait,
    ).transformAndWait({
        mediaReference: media.getMediaReference(),
        transformation,
        options: { pollIntervalMs: 3000, pollTimeoutMs: 30000 },
    });

    if (!result.ok) {
        // The transformation failed; inspect result.status / result.text() for details.
        throw new Error(`Transformation failed with status ${result.status}`);
    }

    // Re-upload the transformed bytes so the function returns a Media.
    return uploadMedia(client, { data: await result.blob(), fileName: "rotated.jpg" });
}
```

```python tab="Python"
from foundry_sdk.v2.media_sets.models import (
    ImageTransformation,
    JpgFormat,
    RotateImageOperation,
)
from foundry_sdk_runtime.errors import (
    MediaTransformationFailedError,
    MediaTransformationTimeoutError,
)
from foundry_sdk_runtime.media import Media
from functions.api import function
from ontology_sdk import FoundryClient

@function(beta=True)
def image_transform(document: Media) -> Media:
    client = FoundryClient()
    transformation = ImageTransformation(
        encoding=JpgFormat(),
        operations=[RotateImageOperation(angle="DEGREE_180")],
    )
    try:
        transformed_bytes: bytes = client.ontology.media.transform_and_wait(
            media_reference=document.get_media_reference(),
            transformation=transformation,
            poll_interval_seconds=3.0,
            poll_timeout_seconds=30.0,
        )
    except MediaTransformationFailedError:
        # The transformation job reported FAILED status.
        raise
    except MediaTransformationTimeoutError:
        # poll_timeout_seconds elapsed before the job completed.
        raise
    # Re-upload the transformed bytes so the function returns a Media.
    return client.ontology.media.upload_media(body=transformed_bytes, filename="rotated.jpg")
```

#### Example: Run page-by-page OCR on a PDF with bounding box output

This workflow takes a PDF (uploaded to a media set or attached to an object) and runs OCR on every page, requesting hOCR output. hOCR is HTML with `bbox` attributes on every detected word and line, so you can extract both the recognized text and its bounding box coordinates from the same response. Each `transform_and_wait` call returns the bytes for one page; iterate to cover the whole document.

```typescript tab="TypeScript v2"
import {
    __EXPERIMENTAL__NOT_SUPPORTED_YET__transformAndWait,
    type MediaTransformation,
} from "@osdk/api/unstable";
import type { Client, Media } from "@osdk/client";
import type { Integer } from "@osdk/functions";

export default async function ocrPdfPages(
    client: Client,
    media: Media,
    pageCount: Integer,
): Promise<string[]> {
    const transformAndWait = client(
        __EXPERIMENTAL__NOT_SUPPORTED_YET__transformAndWait,
    ).transformAndWait;
    const mediaReference = media.getMediaReference();

    const pageResults: string[] = [];
    for (let pageNumber = 0; pageNumber < pageCount; pageNumber++) {
        const transformation: MediaTransformation = {
            $documentToText: {
                $operation: {
                    $ocrOnPage: {
                        $pageNumber: pageNumber,
                        $parameters: {
                            $outputFormat: { $hocr: {} },
                            $languages: [{ $language: "ENG" }],
                        },
                    },
                },
            },
        };

        const result = await transformAndWait({
            mediaReference,
            transformation,
            options: { pollTimeoutMs: 120_000 },
        });
        if (!result.ok) {
            throw new Error(`OCR failed on page ${pageNumber}: ${result.status}`);
        }
        pageResults.push(await result.text());
    }
    return pageResults;
}
```

```python tab="Python"
from foundry_sdk.v2.media_sets.models import (
    DocumentMediaItemMetadata,
    DocumentToTextTransformation,
    OcrHocrOutputFormat,
    OcrLanguageWrapper,
    OcrOnPageOperation,
    OcrParameters,
)
from foundry_sdk_runtime.media import Media
from functions.api import function
from ontology_sdk import FoundryClient

@function(beta=True)
def ocr_pdf_pages(document: Media) -> list[bytes]:
    """Run OCR on every page of a PDF and return the hOCR bytes per page.

    Each hOCR document includes `bbox` attributes on detected words, lines, and
    paragraphs; parse with any HTML parser to recover both text and bounding
    boxes in a single pass.
    """
    client = FoundryClient()
    metadata = document.get_media_full_metadata().item_metadata
    if not isinstance(metadata, DocumentMediaItemMetadata) or metadata.pages is None:
        raise ValueError("Expected a PDF document with a known page count")

    media_reference = document.get_media_reference()
    page_results: list[bytes] = []

    for page_number in range(metadata.pages):
        transformation = DocumentToTextTransformation(
            operation=OcrOnPageOperation(
                page_number=page_number,
                parameters=OcrParameters(
                    output_format=OcrHocrOutputFormat(),
                    languages=[OcrLanguageWrapper(language="ENG")],
                ),
            ),
        )
        hocr_bytes: bytes = client.ontology.media.transform_and_wait(
            media_reference=media_reference,
            transformation=transformation,
            poll_timeout_seconds=120.0,
        )
        page_results.append(hocr_bytes)

    return page_results
```

Dense pages can push OCR runtime well past the default function timeout. See [Manage published functions](/docs/foundry/functions/manage-functions/) to configure function execution timeouts.

#### Example: Render PDF pages as images and slice ranges

For workflows that need the visual rendering of each page (for downstream image annotation, embedding, or display), use `$documentToImage` with `$renderPage` to get a PNG/JPG image of a specific page. To extract a sub-range of the PDF as its own PDF document, use `$documentToDocument` with `$slicePdfRange`. Each function below re-uploads the transformed bytes so it can return a `Media`. Each function is its own module; a registered function is the module's `export default`.

Render a single page as a PNG image:

```typescript tab="TypeScript v2"
import {
    __EXPERIMENTAL__NOT_SUPPORTED_YET__transformAndWait,
    type MediaTransformation,
} from "@osdk/api/unstable";
import type { Client, Media } from "@osdk/client";
import { uploadMedia } from "@osdk/functions";

export default async function renderFirstPageAsPng(
    client: Client,
    media: Media,
): Promise<Media> {
    const transformation: MediaTransformation = {
        $documentToImage: {
            $encoding: "png",
            $operation: { $renderPage: { $pageNumber: 0, $width: 1200 } },
        },
    };
    const result = await client(
        __EXPERIMENTAL__NOT_SUPPORTED_YET__transformAndWait,
    ).transformAndWait({ mediaReference: media.getMediaReference(), transformation });
    if (!result.ok) {
        throw new Error(`Render failed: ${result.status}`);
    }
    // Re-upload the rendered page so the function returns a Media.
    return uploadMedia(client, { data: await result.blob(), fileName: "page.png" });
}
```

```python tab="Python"
from foundry_sdk.v2.media_sets.models import (
    DocumentToImageTransformation,
    PngFormat,
    RenderPageOperation,
)
from foundry_sdk_runtime.media import Media
from functions.api import function
from ontology_sdk import FoundryClient

@function(beta=True)
def render_first_page_as_png(document: Media) -> Media:
    """Render page 0 of a PDF at 1200px wide as a PNG and return it as a Media."""
    client = FoundryClient()
    transformation = DocumentToImageTransformation(
        encoding=PngFormat(),
        operation=RenderPageOperation(page_number=0, width=1200),
    )
    rendered_png: bytes = client.ontology.media.transform_and_wait(
        media_reference=document.get_media_reference(),
        transformation=transformation,
    )
    # Re-upload the rendered page so the function returns a Media.
    return client.ontology.media.upload_media(body=rendered_png, filename="page.png")
```

Slice a page range into a new PDF document:

```typescript tab="TypeScript v2"
import {
    __EXPERIMENTAL__NOT_SUPPORTED_YET__transformAndWait,
    type MediaTransformation,
} from "@osdk/api/unstable";
import type { Client, Media } from "@osdk/client";
import { uploadMedia } from "@osdk/functions";

export default async function sliceFirstTenPages(
    client: Client,
    media: Media,
): Promise<Media> {
    const transformation: MediaTransformation = {
        $documentToDocument: {
            $encoding: "pdf",
            $operation: {
                $slicePdfRange: {
                    $startPageInclusive: 0,
                    $endPageExclusive: 10,
                    $strictlyEnforceEndPage: false,
                },
            },
        },
    };
    const result = await client(
        __EXPERIMENTAL__NOT_SUPPORTED_YET__transformAndWait,
    ).transformAndWait({ mediaReference: media.getMediaReference(), transformation });
    if (!result.ok) {
        throw new Error(`Slice failed: ${result.status}`);
    }
    // Re-upload the sliced PDF so the function returns a Media.
    return uploadMedia(client, { data: await result.blob(), fileName: "slice.pdf" });
}
```

```python tab="Python"
from foundry_sdk.v2.media_sets.models import (
    DocumentToDocumentTransformation,
    PdfFormat,
    SlicePdfRangeOperation,
)
from foundry_sdk_runtime.media import Media
from functions.api import function
from ontology_sdk import FoundryClient

@function(beta=True)
def slice_first_ten_pages(document: Media) -> Media:
    """Return a new PDF containing pages 0-9 of the input PDF as a Media."""
    client = FoundryClient()
    transformation = DocumentToDocumentTransformation(
        encoding=PdfFormat(),
        operation=SlicePdfRangeOperation(
            start_page_inclusive=0,
            end_page_exclusive=10,
            strictly_enforce_end_page=False,  # tolerate documents shorter than 10 pages
        ),
    )
    sliced_pdf: bytes = client.ontology.media.transform_and_wait(
        media_reference=document.get_media_reference(),
        transformation=transformation,
    )
    # Re-upload the sliced PDF so the function returns a Media.
    return client.ontology.media.upload_media(body=sliced_pdf, filename="slice.pdf")
```

#### Example: Annotate every page with detected bounding boxes

To produce a visual debugging output (each PDF page rendered with its OCR-detected bounding boxes drawn on top) chain three transformations for every page. For each page, render the page as an image, OCR the same page to recover word/line bounding boxes, then re-upload the rendered image and annotate it with `$image.$annotate`. The page count comes from `get_media_full_metadata()`, which is currently available in Python only. Each step calls `transform_and_wait` and feeds the bytes of the previous step into the next as a fresh upload, and each annotated page is re-uploaded so the function returns one `Media` per page.

```python tab="Python"
from foundry_sdk.v2.media_sets.models import (
    AnnotateImageOperation,
    Annotation,
    BoundingBox,
    BoundingBoxGeometry,
    DocumentMediaItemMetadata,
    DocumentToImageTransformation,
    DocumentToTextTransformation,
    ImageTransformation,
    OcrHocrOutputFormat,
    OcrLanguageWrapper,
    OcrOnPageOperation,
    OcrParameters,
    PngFormat,
    RenderPageOperation,
)
from foundry_sdk_runtime.media import Media
from functions.api import function
from ontology_sdk import FoundryClient

@function(beta=True)
def annotate_pdf_with_ocr_boxes(document: Media) -> list[Media]:
    """Render every page of a PDF, OCR each page to find text bounding boxes,
    draw them on the rendered image, and return one annotated Media per page."""
    client = FoundryClient()
    media_reference = document.get_media_reference()

    # Use the full metadata (Python only) to discover the page count.
    metadata = document.get_media_full_metadata().item_metadata
    if not isinstance(metadata, DocumentMediaItemMetadata) or metadata.pages is None:
        raise ValueError("Expected a PDF document with a known page count")

    annotated_pages: list[Media] = []
    for page_number in range(metadata.pages):
        # 1. Render the page as a PNG.
        rendered_png: bytes = client.ontology.media.transform_and_wait(
            media_reference=media_reference,
            transformation=DocumentToImageTransformation(
                encoding=PngFormat(),
                operation=RenderPageOperation(page_number=page_number, width=1200),
            ),
        )

        # 2. OCR the same page in hOCR mode to get word-level bounding boxes.
        hocr_bytes: bytes = client.ontology.media.transform_and_wait(
            media_reference=media_reference,
            transformation=DocumentToTextTransformation(
                operation=OcrOnPageOperation(
                    page_number=page_number,
                    parameters=OcrParameters(
                        output_format=OcrHocrOutputFormat(),
                        languages=[OcrLanguageWrapper(language="ENG")],
                    ),
                ),
            ),
            poll_timeout_seconds=120.0,
        )

        # 3. Parse hOCR for bounding boxes in image pixels.
        # The parse_hocr_bounding_boxes helper is omitted here; see the note below the example.
        boxes: list[tuple[str, BoundingBox]] = parse_hocr_bounding_boxes(hocr_bytes)

        # 4. Re-upload the rendered PNG as a temporary media item.
        rendered_media = client.ontology.media.upload_media(
            body=rendered_png, filename=f"page-{page_number}.png"
        )

        # 5. Annotate the rendered page with a Media transformation.
        annotated_bytes: bytes = client.ontology.media.transform_and_wait(
            media_reference=rendered_media.get_media_reference(),
            transformation=ImageTransformation(
                encoding=PngFormat(),
                operations=[
                    AnnotateImageOperation(
                        annotations=[
                            Annotation(
                                geometry=BoundingBoxGeometry(bounding_box=box),
                                label=label,
                            )
                            for label, box in boxes
                        ],
                    ),
                ],
            ),
        )

        # 6. Re-upload the annotated page so the function returns a Media.
        annotated_pages.append(
            client.ontology.media.upload_media(
                body=annotated_bytes, filename=f"page-{page_number}-annotated.png"
            )
        )

    return annotated_pages
```

```python tab="Python (async)"
import asyncio

from foundry_sdk.v2.media_sets.models import (
    AnnotateImageOperation,
    Annotation,
    BoundingBox,
    BoundingBoxGeometry,
    DocumentMediaItemMetadata,
    DocumentToImageTransformation,
    DocumentToTextTransformation,
    ImageTransformation,
    OcrHocrOutputFormat,
    OcrLanguageWrapper,
    OcrOnPageOperation,
    OcrParameters,
    PngFormat,
    RenderPageOperation,
)
from foundry_sdk_runtime.media import Media
from functions.api import function
from ontology_sdk import FoundryClient

@function(beta=True)
async def annotate_pdf_with_ocr_boxes(document: Media) -> list[Media]:
    """Render every page of a PDF, OCR each page, annotate it, and return one Media per page."""
    client = FoundryClient()
    media_reference = document.get_media_reference()

    metadata = document.get_media_full_metadata().item_metadata
    if not isinstance(metadata, DocumentMediaItemMetadata) or metadata.pages is None:
        raise ValueError("Expected a PDF document with a known page count")

    async def annotate_page(page_number: int) -> Media:
        # Render the page as a PNG and OCR the same page concurrently.
        # Both transformations read from the same source document and are independent,
        # so asyncio.gather lets them poll in parallel instead of one after the other.
        rendered_png, hocr_bytes = await asyncio.gather(
            client.ontology.media.async_transform_and_wait(
                media_reference=media_reference,
                transformation=DocumentToImageTransformation(
                    encoding=PngFormat(),
                    operation=RenderPageOperation(page_number=page_number, width=1200),
                ),
            ),
            client.ontology.media.async_transform_and_wait(
                media_reference=media_reference,
                transformation=DocumentToTextTransformation(
                    operation=OcrOnPageOperation(
                        page_number=page_number,
                        parameters=OcrParameters(
                            output_format=OcrHocrOutputFormat(),
                            languages=[OcrLanguageWrapper(language="ENG")],
                        ),
                    ),
                ),
                poll_timeout_seconds=120.0,
            ),
        )

        # Parse hOCR for bounding boxes (see the sync example) and re-upload the
        # rendered PNG as a temporary media item, both concurrently.
        boxes, rendered_media = await asyncio.gather(
            async_parse_hocr_bounding_boxes(hocr_bytes),
            client.ontology.media.async_upload_media(
                body=rendered_png,
                filename=f"page-{page_number}.png",
            ),
        )

        # Annotate the rendered page with a Media transformation.
        annotated_bytes: bytes = await client.ontology.media.async_transform_and_wait(
            media_reference=rendered_media.get_media_reference(),
            transformation=ImageTransformation(
                encoding=PngFormat(),
                operations=[
                    AnnotateImageOperation(
                        annotations=[
                            Annotation(
                                geometry=BoundingBoxGeometry(bounding_box=box),
                                label=label,
                            )
                            for label, box in boxes
                        ],
                    ),
                ],
            ),
        )

        # Re-upload the annotated page so the function returns a Media.
        return await client.ontology.media.async_upload_media(
            body=annotated_bytes,
            filename=f"page-{page_number}-annotated.png",
        )

    # Process every page concurrently.
    return list(await asyncio.gather(*(annotate_page(p) for p in range(metadata.pages))))
```

The `parse_hocr_bounding_boxes` helper is omitted here. Any HTML parser (such as `lxml` or `BeautifulSoup`) can extract `class="ocrx_word"` elements and their `title="bbox X1 Y1 X2 Y2 ..."` attributes, which you convert into `BoundingBox(left=X1, top=Y1, width=X2-X1, height=Y2-Y1)`.

## TypeScript v1

:::callout{theme="warning"}
Foundry enacts strict memory limits when executing TypeScript v1 functions. To ensure you do not exceed those memory limits, you should only interact with media files under 20MB.
:::

:::callout{theme="warning"}
Uploading media within a function is not supported in TypeScript v1. The examples below cover passing existing media into Ontology edits and operating on media properties of object types.
:::

### Setting existing media on an object

Use Ontology edit functions to attach existing media items to objects:

```typescript tab="TypeScript v1"
import { OntologyEditFunction, MediaItem } from "@foundry/functions-api";
import { Aircraft } from "@foundry/ontology-api";

export class MyFunctions {
    @OntologyEditFunction()
    public async setExistingMediaToObject(
        aircraft: Aircraft,
        mediaItem: MediaItem
    ): Promise<void> {
        // Ontology Edits with passed in MediaItems are supported
        aircraft.myMediaProperty = mediaItem;
    }
}
```

### Media item parameter on object types

The following example shows the `isAudio` media operations on a media reference property of an object type:

```typescript tab="TypeScript v1"
MediaItem.isAudio(objectType.mediaReferenceProperty)
```

### Read raw media data

You can access a media item by selecting the media reference property on the object. The signature for the method is as follows:

```typescript tab="TypeScript v1"
// Blob is a standard JavaScript type, representing a file-like object of immutable, raw data.
// https://developer.mozilla.org/en-US/docs/Web/API/Blob
readAsync(): Promise<Blob>;
```

### Get media metadata

You can access a media item's metadata. The signature for the method is as follows:

```typescript tab="TypeScript v1"
getMetadataAsync(): Promise<IMediaMetadata>;
```

### Type guards

Type guards in TypeScript v1 allow you to access functionality that is specific to certain media types. The following type guards can be used on media item metadata:

* `isAudioMetadata()`
* `isDicomMetadata()`
* `isDocumentMetadata()`
* `isImageryMetadata()`
* `isSpreadsheetMetadata()`
* `isUntypedMetadata()`
* `isVideoMetadata()`

As an example, you could use the imagery type guard to pull out image specific metadata fields:

```typescript tab="TypeScript v1"
const metadata = await myObject.mediaReference?.getMetadataAsync();
if (isImageryMetadata(metadata)) {
    const imageWidth = metadata.dimensions?.width;
    ...
}
```

You can also use type guards on the media item namespace, which then gives you access to more methods on the type-specific media item. The type guards you can use here are:

* `MediaItem.isAudio()`
* `MediaItem.isDicom()`
* `MediaItem.isDocument()`
* `MediaItem.isImagery()`
* `MediaItem.isSpreadsheet()`
* `MediaItem.isVideo()`

### Document-specific operations

#### Text extraction

To extract text from a document, you can either use optical character recognition (OCR) or extract embedded text on the media item.

For machine-generated PDFs, it may be faster and/or more accurate to extract text embedded digitally in the PDF rather than using optical character recognition (OCR). Below is an example of text extraction usage:

```typescript tab="TypeScript v1"
extractTextAsync(options: IDocumentExtractTextOptions): Promise<string[]>;
```

When using TypeScript v1, the following can optionally be provided as an object:

* `startPage`: The zero-indexed start page (inclusive, can be empty)
* `endPage`: The zero-indexed end page (exclusive, can be empty).

If both the `startPage` and `endPage` are left empty, the text for all pages in the document will be returned.

For non-machine-generated PDFs, it would be best to use the OCR method for extracting text.

```typescript tab="TypeScript v1"
ocrAsync(options: IDocumentOcrOptions): Promise<string[]>;
```

The following can optionally be provided as a TypeScript object:

* `startPage`: The zero-indexed start page (inclusive).
* `endPage`: The zero-indexed end page (exclusive).
* `languages`: A list of languages to recognize (can be empty).
* `scripts`: A list of scripts to recognize (can be empty).
* `outputType`: Specifies the output type as `text` or `hocr`.

Remember that you need to use type guards in order to access media-type specific operations. Here's an example of using the `isDocument()` type guard to then perform OCR text extraction:

```typescript tab="TypeScript v1"
import { MediaItem } from "@foundry/functions-api";
import { ArxivPaper } from "@foundry/ontology-api";

@Function()
public async firstPageText(paper: ArxivPaper): Promise<string | undefined> {
    if (MediaItem.isDocument(paper.mediaReference)) {
        const text = (await paper.mediaReference.ocrAsync({ endPage: 1, languages: [], scripts: [], outputType: 'text' }))[0];
        return text;
    }

    return undefined;
}
```

### Audio-specific operations

#### Transcription

Audio media items support transcription using the transcribe method. The signature is as follows:

```typescript tab="TypeScript v1"
transcribeAsync(options: IAudioTranscriptionOptions): Promise<string>;
```

The following can optionally be passed in to specify how the transcription should run:

* `language`: The language to transcribe, passed using the `TranscriptionLanguage` enum.
* `performanceMode`: Runs transcriptions in `More Economical` or `More Performant` mode, passed using the `TranscriptionPerformanceMode` enum.
* `outputFormat`: Specifies the output format by passing an object of `type` `plainTextNoSegmentData` (plain text) or `pttml`. `pttml` is a [TTML-like ↗](https://en.wikipedia.org/wiki/Timed_Text_Markup_Language) format where the object also takes a Boolean `addTimestamps` parameter if the type is `plainTextNoSegmentData`.

An example of providing options for transcription:

```typescript tab="TypeScript v1"
import { Function, MediaItem, TranscriptionLanguage, TranscriptionPerformanceMode } from "@foundry/functions-api";
import { AudioFile } from "@foundry/ontology-api";

@Function()
public async transcribeAudioFile(file: AudioFile): Promise<string|undefined> {
    if (MediaItem.isAudio(file.mediaReference)) {
        return await file.mediaReference.transcribeAsync({
            language: TranscriptionLanguage.ENGLISH,
            performanceMode: TranscriptionPerformanceMode.MORE_ECONOMICAL,
            outputFormat: {type: "plainTextNoSegmentData", addTimestamps: true}
        });
    }

    return undefined;
}
```
