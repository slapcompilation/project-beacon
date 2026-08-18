<!-- source: https://palantir.com/docs/foundry/media-sets-advanced-formats/media-usage-limits/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Media set compute usage

Media sets bring a number of advanced, out-of-the-box transformations to the platform. In addition to being triggered via transforms and pipelines, media transformations are also triggered by interacting with media items in the platform, for example, by previewing a media item. Additionally, there is a cost to download or stream the full contents of a media item.

Usage is tracked in units of Foundry compute-seconds.  The table below describes each transformation available, with usage rate in terms of compute-seconds per gigabyte processed.

If you have an enterprise contract with Palantir, contact your Palantir representative before proceeding with usage calculations.

## Transformations

Usage rate is measured in compute-seconds per GB.

### All

| Transformation    | Usage Rate |
|-------------------|------------|
| Download / stream | 2          |

### Images

| Transformation             | Usage Rate |
|----------------------------|------------|
| Generate PDF               | 40         |
| Resize                     | 40         |
| Resize within bounding box | 40         |
| Rotate                     | 40         |
| Adjust contrast            | 75         |
| Annotate                   | 75         |
| Crop / chip                | 75         |
| Encryption / decryption    | 75         |
| Geo tile                   | 75         |
| Grayscale                  | 75         |
| Render DICOM image layer   | 75         |
| Extract text (OCR)         | 275        |
| Generate embedding         | 275        |
| Extract text v2 (OCR)      | 275        |
| Extract layout aware v2    | 275        |

### Audio

| Transformation      | Usage Rate |
|---------------------|------------|
| Chunk               | 75         |
| Select channel      | 75         |
| Stream with HLS     | 75         |
| Transcode           | 75         |
| Waveform generation | 75         |
| Transcription       | 275        |

### Video

| Transformation                   | Usage Rate |
|----------------------------------|------------|
| Get timestamps for scene frames  | 40         |
| Extract audio                    | 75         |
| Extract frames at timestamp      | 75         |
| Chunk                            | 275        |
| Extract all scene frames         | 275        |
| Stream with HLS                  | 275        |
| Transcode                        | 275        |

### Documents

| Transformation                            | Usage Rate |
|-------------------------------------------|------------|
| Get PDF page count                        | 40         |
| Get PDF page dimensions                   | 40         |
| Render page as image                      | 40         |
| Render page as image within bounding box  | 40         |
| Extract all text (raw)                    | 75         |
| Extract form fields                       | 75         |
| Extract table of contents                 | 75         |
| Extract text from pages to array (raw)    | 75         |
| Extract text on page (raw)                | 75         |
| Slice PDF range                           | 75         |
| Extract text (OCR)                        | 275        |
| Extract text from pages to array (OCR)    | 275        |
| Extract layout aware text (raw / OCR)     | 275        |
| Extract text using VLM \*                  | 275        |

\* This usage is accounted for in addition to VLM usage, which is automatically calculated.

#### Extract text transformation

| Format        | Raw text mode | OCR mode | Auto\* mode |
|---------------|---------------|----------|------------|
| Text          | 75            | 275      | 275        |
| Markdown/HTML | 275           | 275      | 275        |

\* Auto mode determines, for each page, whether text can be extracted directly or whether OCR is required.

### Spreadsheets

| Transformation        | Usage Rate |
|-----------------------|------------|
| Convert sheet to JSON | 275        |

## Using media at scale

### Media set limits

* There is no limit to how many media items can be uploaded to a media set.
* Transactional media sets have an upload limit of 10,000 items per transaction.
* Transactionless media sets do not have an item upload limit (since there are no transactions).
* Paths of items in media sets cannot exceed 256 characters. Attempting to add an item with a path longer than 256 characters to a media set will result in a `MediaSet:MediaItemPathInvalid` error.
* Each media item can have a maximum file size of 50 GB.
* For incremental transforms, [limiting the batch size](/docs/foundry/transforms-python-spark/incremental-media-sets/#limit-batch-size-of-incremental-inputs) of media set inputs is supported.

### Throttling

While it is possible to interact with media sets at scale, such as uploading or transforming millions of media items, error handling should be implemented to ensure pipeline stability. When interacting with media sets at scale, the media set service may throttle by responding with Quality of Service (QoS) errors which have status codes of either 429 or 503. This indicates that the media set service cannot handle the storage or compute load at the moment.

Instead of failing on a QoS error when the service throttles, the client should build an adequate retrying mechanism.

For example, if a client is uploading millions of media items by submitting PUT requests at `/{mediaSetRid}/items`, the client should retry any media item upload requests that receive a QoS error.

When using the transforms-media library in Python transforms, a retrying mechanism is generally already in place. For example, when uploading media files from a catalog dataset to a media set, the library method provided already has retrying logic to handle QoS errors.

```python
from transforms.api import transform, Input, Output
from transforms.mediasets import MediaSetOutput


@transform(
    input_files=Input('/examples/image_files'),
    output_media_set=MediaSetOutput('/examples/image_media_set'),
    uploaded_media_record=Output('/examples/uploaded_media_record'),
)
def compute(input_files, input_files, output_media_set, uploaded_media_record):
    uploaded_media_items = output_files.put_dataset_files_and_get_dataframe_of_uploads(
        input_files,
        ignore_items_not_matching_schema=False,
        ignore_items_failing_to_convert=False,
    )

    uploaded_media_record.write_dataframe(uploaded_media_items)
```
