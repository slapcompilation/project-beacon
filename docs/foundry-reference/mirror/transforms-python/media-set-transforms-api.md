<!-- source: https://palantir.com/docs/foundry/transforms-python/media-set-transforms-api/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Media set transforms API

The media set transforms API provides methods for transforming media sets in Python transforms. This API enables various operations on media sets, such as extracting text using optical character recognition (OCR), resizing images, converting documents to images, and more.

## Methods by schema type

| Schema type | Available methods |
| --- | --- |
| Image | [`resize`](#resize) • [`crop`](#crop) • [`binarize`](#binarize) • [`rotate`](#rotate) • [`grayscale`](#grayscale) • [`equalize`](#equalize) • [`rayleigh`](#rayleigh) • [`convert_image_to_document`](#convert_image_to_document) • [`generate_image_embeddings`](#generate_image_embeddings) • [`tile`](#tile) • [`ocr`](#ocr) • [`encrypt`](#encrypt) • [`decrypt`](#decrypt) |
| Document | [`ocr`](#ocr) • [`extract_raw_text`](#extract_raw_text) • [`convert_document_to_images`](#convert_document_to_images) • [`slice_document`](#slice_document) • [`extract_form_fields`](#extract_form_fields) • [`extract_table_of_contents`](#extract_table_of_contents) • [`get_pdf_page_dimensions`](#get_pdf_page_dimensions) |
| Video | [`extract_audio`](#extract_audio) • [`extract_scene_frames`](#extract_scene_frames) • [`chunk`](#chunk) • [`extract_first_frame`](#extract_first_frame) • [`extract_frames_at_timestamp`](#extract_frames_at_timestamp) • [`transcode`](#transcode) • [`get_scene_frame_timestamps`](#get_scene_frame_timestamps) |
| Audio | [`transcribe`](#transcribe) • [`chunk`](#chunk) • [`transcode`](#transcode) • [`get_waveform`](#get_waveform) |
| DICOM | [`render_dicom_layer`](#render_dicom_layer) |
| Spreadsheet | [`extract_content_from_spreadsheets`](#extract_content_from_spreadsheets) |
| Email | [`extract_email_body`](#extract_email_body) • [`extract_email_attachments`](#extract_email_attachments) |
| Multimodal | [`filter_to`](#filter_to) |

## Getting started

To use the media set transforms API, access the transform functionality from a media set input as shown in the example below.

```python
from transforms.mediasets.inputs import MediaSetInputParam
from transforms.api import transform, Output, TransformOutput
from transforms.mediasets import MediaSetInput

@transform(
    media_input=MediaSetInput("/path/to/media_set"),
    dataset_output=Output("/path/to/output")
)
def compute(ctx, media_input: MediaSetInputParam, dataset_output: TransformOutput):
    # Create a MediaSetInputTransform instance
    transform = media_input.transform()

    # Apply transformations
    result = transform.ocr()

    # Write the result to output
    dataset_output.write_dataframe(result)
```

### transform()

```python
def transform(self, deduplicate_by_path=True):
```

Returns a `MediaSetInputTransform` instance. This class enables fluent method chaining for media transformations on a media set input.

**Parameters:**

* **deduplicate\_by\_path** (*bool, optional*): If `True`, only the most recent item at each path will be included. Defaults to `True`.

**Returns:**

* `MediaSetInputTransform`: A user-facing class that provides methods for media set transformations.

**Example:**

```python
df = media_set.transform().ocr()
```

### Writing a `MediaSetInputTransform` to a media set output

For media set to media set transformations, write the transformed media to a media set as shown in the example below.

```python
from transforms.mediasets.inputs import MediaSetInputParam
from transforms.mediasets.outputs import MediaSetOutputParam
from transforms.api import transform
from transforms.mediasets import MediaSetInput, MediaSetOutput


@transform(
    video_input=MediaSetInput(
        "/path/to/input_media_set"
    ),
    multimodal_output=MediaSetOutput(
        "/path/to/output_media_set"
    ),
)
def compute(
    ctx,
    video_input: MediaSetInputParam,
    multimodal_output: MediaSetOutputParam,
):
    def output_path_tar(input_path, page=None):
        return input_path.replace("mp4", "tar")

    multimodal_output.write(
        video_input.transform().extract_scene_frames(
            scene_sensitivity="LESS_SENSITIVE"
        ),
        output_path_tar,
    )
```

### write()

```python
def write(
    self,
    media_transform: MediaSetInputTransform,
    output_path: Callable[[str, Optional[int]], str] = prefix_path,
    suppress_errors: bool = False,
    return_dataframe: bool = False,
) -> Union[str, DataFrame, None]:
```

Write a MediaSetInputTransform to an output media set.

**Parameters:**

* **media\_transform** (*MediaSetInputTransform*): A media set transform that has been applied to a media set input. For example: `media_transform = img_input.transform().resize()`
* **output\_path** (*Callable\[\[str, Optional\[int]], str], optional*): A function that determines the output path for each media item. It takes the original path and an optional page number as input and returns the new path. Defaults to prepend "transformed" to the original path. For media transformations that output multiple items per an input media item, the item's path will automatically be appended with an identifying value. For example, [`crop`](#crop) transformations that apply multiple crops to an image will automatically include the crop parameters (x\_offset, y\_offset, width, height) in the path.
* **suppress\_errors** (*bool*): Specifies error handling behavior. If `True`, errors are caught and the error message will be returned in the dataframe's media\_reference column if return\_dataframe is `True`. If `False`, any errors will not be caught and the build will fail. Defaults to `False`. Only applicable to transformations on the entire media set.
* **return\_dataframe** (*bool, optional*): Only applicable for media set level transformation. If True, returns a dataframe which contains media\_item\_rid, path and media\_reference columns. The dataframe represents the media items written to the output media set. Defaults to False. If True, the media set transformations will be lazily evaluated.

**Returns:**

* None, a DataFrame or a string.
  * `str`: Applicable to transformations on an individual media item. Returns the resulting media reference string.
  * `None`: Applicable to transformations on an entire media set. Returns None if return\_dataframe is set to False.
  * `DataFrame`: Applicable to transformations on an entire media set and when return\_dataframe is set to True. Columns are `media_item_rid`, `path`, `media_reference`.

**Example:**

```python
# Media transformation on the whole media set
media_transform = img_input.transform().resize()
img_out.write(media_transform)

# Media transformation on an individual media item
media_transform = img_input.transform().resize(media_item_rid = "rid1")
med_ref_str = img_out.write(media_transform)
```

## API reference

### ocr()

Extracts text from PDFs or images using OCR and returns the extracted text as a string. Recommended for images and scanned documents.

**Parameters:**

* **languages** (*list\[str]*): List of languages to be used for OCR. Defaults to English. All valid codes can be found in the [Tesseract documentation ↗](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html) under languages.
* **scripts** (*Optional\[list\[str]]*): List of scripts to be used for OCR. Defaults to `None`. All valid codes can be found in the [Tesseract documentation ↗](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html) under scripts.
* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **start\_page** (*Optional\[int]*): The zero-indexed start page for OCR. Only applicable for PDF media sets. Defaults to `0` (the first page).
* **end\_page** (*Optional\[int]*): The zero-indexed end page for OCR (exclusive). Only applicable for PDF media sets. Defaults to `None` (the final page).
* **return\_structure** (*str*): `item_per_row` or `page_per_row`. Only applicable to transformations on an entire PDF media set. Defaults to `item_per_row`.
* **suppress\_errors** (*bool*): Specifies error handling behavior. If `True`, errors are caught and the error message will be returned in the output. If `False`, any errors will not be caught and the build will fail. Defaults to `True`. Only applicable to transformations on the entire media set.

**Returns:**

* A DataFrame, list of strings, or a single string.
  * `str`: Transformations on a single image.
  * `list[str]`: Transformations on a single PDF.
  * `DataFrame`: Transformations on the entire media set.
    * For PDF (`item_per_row`): Columns are `media_item_rid`, `path`, `media_reference`, `extracted_text` (list\[str]).
    * For PDF (`page_per_row`) or image sets: Columns are `media_item_rid`, `path`, `media_reference`, `page_number`, `extracted_text` (str).

**Example:**

```python
df = media_set.transform().ocr()
dataset_output.write_dataframe(df)
```

### extract\_raw\_text()

Extracts raw text from PDFs. Recommended for documents that have been electronically generated.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **start\_page** (*Optional\[int]*): The zero-indexed start page for text extraction. Defaults to 0 (the first page).
* **end\_page** (*Optional\[int]*): The zero-indexed end page for text extraction (exclusive). Defaults to `None` (the final page).
* **return\_structure** (*str*): `item_per_row` or `page_per_row`. Only applicable to transformations on an entire PDF media set. Defaults to `item_per_row`.
* **suppress\_errors** (*bool*): Specifies error handling behavior. If `True`, errors are caught and the error message will be returned in the output. If `False`, any errors will not be caught and the build will fail. Defaults to `True`. Only applicable to transformations on the entire media set.

**Returns:**

* A DataFrame or list of strings.
  * `str`: Applicable to transformations on a single image.
  * `list[str]`: Applicable to transformations on a single PDF.
  * `DataFrame`: Applicable to transformations on the entire media set.
    * PDF (`item_per_row`): Columns are `media_item_rid`, `path`, `media_reference`, `extracted_text` (list\[str]).
    * PDF (`page_per_row`) or image sets: Columns are `media_item_rid`, `path`, `media_reference`, `page_number`, `extracted_text` (str).

**Example:**

```python
df = media_set.transform().extract_raw_text()
dataset_output.write_dataframe(df)
```

### resize()

Resizes images to the specified dimensions.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **width** (*Optional\[int]*): The target width for the resized images. Defaults to `1024`. Must be provided if height is not provided.
* **height** (*Optional\[int]*): The target height for the resized images. Defaults to `1024`. Must be provided if width is not provided.
* **maintain\_aspect\_ratio** (*bool*): Specifies whether to maintain the original aspect ratio of the images. If `True`, images will be resized to fit within the specified dimensions while preserving the aspect ratio. Defaults to `True`.
* **output\_format** (*str*): The format of the output images, for example PNG or JPEG. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the resize transformation, allowing for further transformations.

**Example:**

```python
transform = image_input.transform().resize()
image_output.write(transform)
```

### convert\_document\_to\_images()

Converts document pages to images with the specified dimensions.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **start\_page** (*Optional\[int]*): The zero-indexed start page for conversion. Defaults to 0 (the first page).
* **end\_page** (*Optional\[int]*): The zero-indexed end page for conversion (exclusive). Defaults to `None` (the last page).
* **width** (*Optional\[int]*): The width of the output images. Defaults to 1024.
* **height** (*Optional\[int]*): The height of the output images. Defaults to 1024.
* **output\_format** (*str*): The format of the output images, for example PNG or JPEG. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the document to image transformation, allowing for further transformations.

**Example:**

```python
transform = pdf_input.transform().convert_document_to_images()
image_output.write(transform)
```

### slice\_document()

Slices documents to a specified range of pages.

**Parameters:**

* **start\_page** (*int*): The zero-indexed start page for the slice operation.
* **end\_page** (*int*): The zero-indexed end page for the slice operation (exclusive).
* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **strictly\_enforce\_end\_page** (*bool*): Specifies behavior if the `end_page` exceeds the number of pages in the document. If `True`, an error will be raised. If `False`, the last page of the document is used instead. Defaults to `True`.

**Returns:**

* An instance of `MediaSetInputTransform` containing the slice transformation, allowing for further transformations.

**Example:**

```python
transform = pdf_input.transform().slice_document(0, 5)
pdf_output.write(transform)
```

### tile()

Generates Slippy map tiles (EPSG 3857) from images. Only supports geo-embedded images in TIFF or NITF format, with a maximum size of 100 million square pixels.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **zoom** (*Union\[int, Column]*): Zoom level of the tile. Must be a non-negative integer. At zoom level `0`, the entire world fits into a single tile. Each increment doubles the spatial resolution and quadruples the number of tiles. Defaults to `0`.
* **x** (*Union\[int, Column]*): Tile column index at the specified zoom level. Increases from west to east. Valid range: `0 <= x < 2**zoom`. Defaults to `0`.
* **y** (*Union\[int, Column]*): Tile row index at the specified zoom level. Increases from north to south. Valid range: `0 <= y < 2**zoom`. Defaults to `0`.
* **df** (*Optional\[DataFrame]*): Specifies the DataFrame to join on when passing column inputs. Tiling will only be applied to media items present in both the input media set and provided DataFrame. Must be provided together with the `on` parameter.
* **on** (*Optional\[Literal\["media\_item\_rid", "media\_reference"]]*): The column name to join on when `df` is specified. This aligns the tiling operation with the correct media item.
* **output\_format** (*str*): The format of the output images, for example PNG or JPEG. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the tile transformation, allowing for further transformations.

**Example:**

```python
# Dynamically select tiling parameters from the input_df columns.
# Only tiles media items in both the media set and provided DataFrame.
transform1 = image_input.transform().tile(input_df.zoom, input_df.x, input_df.y, df=input_df, on="media_item_rid")

# All tiles will be generated with the same parameters.
# Generates a tile for all media items in the media set.
transform2 = image_input.transform().tile(zoom=2, x=1, y=1)

# Write the transformation to output media set
image_output.write(transform)
```

### encrypt()

Encrypts specified regions of images using the provided cipher image key.

**Parameters:**

* **polygons** (*Union\[list\[api.Polygon], Column]*): The regions to encrypt, specified as polygons.
* **cipher\_license\_rid** (*Union\[str, Column]*): The cipher license RID to use for encryption.
* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **df** (*Optional\[DataFrame]*): Specifies the DataFrame to join on when passing column inputs. Encryption will only be applied to media items present in both the input media set and provided DataFrame. Must be provided together with the `on` parameter.
* **on** (*Optional\[Literal\["media\_item\_rid", "media\_reference"]]*): The column name to join on when `df` is specified. This aligns the encryption operation with the correct media item.
* **output\_format** (*str*): The format of the output images, for example PNG or JPEG. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the encrypt transformation, allowing for further transformations.

**Example:**

```python
polygon = [api.Coordinate(x=10, y=10), api.Coordinate(x=100, y=10),
           api.Coordinate(x=100, y=100), api.Coordinate(x=10, y=100)]
transform = image_input.transform().encrypt([polygon], "cipher_license_rid_123", media_item_rid="rid1")
image_output.write(transform)
```

### decrypt()

Decrypts specified regions of images using the provided cipher image key.

**Parameters:**

* **polygons** (*Union\[list\[api.Polygon], Column]*): The regions to decrypt, specified as a list of polygons.
* **cipher\_license\_rid** (*Union\[str, Column]*): The resource identifier for the cipher license to use for decryption.
* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **df** (*Optional\[DataFrame]*): Specifies the DataFrame to join on when passing column inputs. Decryption will only be applied to media items present in both the input media set and provided DataFrame. Must be provided together with the `on` parameter.
* **on** (*Optional\[Literal\["media\_item\_rid", "media\_reference"]]*): The column name to join on when `df` is specified. This aligns the decryption operation with the correct media item.
* **output\_format** (*str*): The format of the output images, for example PNG or JPEG. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the decrypt transformation, allowing for further transformations.

**Example:**

```python
polygon = [api.Coordinate(x=10, y=10), api.Coordinate(x=100, y=10),
           api.Coordinate(x=100, y=100), api.Coordinate(x=10, y=100)]
transform = image_input.transform().decrypt([polygon], "cipher_license_rid_123", media_item_rid="rid1")
image_output.write(transform)
```

### crop()

Crops images using specified dimensions and offsets.

**Parameters:**

* **width** (*Union\[int, Column]*): The width of the cropped image.
* **height** (*Union\[int, Column]*): The height of the cropped image.
* **x\_offset** (*Union\[int, Column]*): The x-coordinate of the top-left corner of the crop area. Defaults to `0`.
* **y\_offset** (*Union\[int, Column]*): The y-coordinate of the top-left corner of the crop area. Defaults to `0`.
* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **df** (*Optional\[DataFrame]*): Specifies the DataFrame to join on when passing column inputs. Cropping will only be applied to media items present in both the input media set and provided DataFrame. Must be provided together with the `on` parameter.
* **on** (*Optional\[Literal\["media\_item\_rid", "media\_reference"]]*): The column name to join on when `df` is specified. This aligns the cropping operation with the correct media item.
* **output\_format** (*str*): The format of the output images, for example PNG or JPEG. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the crop transformation, allowing for further transformations.

**Examples:**

```python
# All media items will be cropped with the same parameters.
# Crops all media items in the media set.
transform = image_input.transform().crop(100, 100, 10, 10)
image_output.write(transform)

# Dynamically select cropping parameters from the input_df columns.
# Only crops media items in both the media set and provided DataFrame.
transform1 = image_input.transform().crop(input_df.x2 - input_df.x1, input_df.y2 - input_df.y1,
    input_df.x1, input_df.y1, df=input_df, on="media_item_rid")

# Width and height are dynamically selected from the input_df columns, while the offsets are static.
# Only crops media items in both the media set and provided DataFrame.
transform2 = image_input.transform().crop(30, 50,
    input_df.x1, input_df.y1, df=input_df, on="media_item_rid")

# All media items will be cropped with the same parameters.
# Only crops media items in both the media set and provided DataFrame.
transform3 = image_input.transform().crop(30, 50,
    20, 60, df=input_df, on="media_item_rid")

# All media items will be cropped with the same parameters.
# Crops all media items in the media set.
transform4 = image_input.transform().crop(30, 50, 20, 60)

# Write the transformation to output media set
image_output.write(transform1)
```

### binarize()

Converts images to binary using the specified threshold.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **threshold** (*Optional\[int]*): Values above or equal to the threshold will be assigned a value of `255` and values below will be assigned a value of `0`. Defaults to computing the threshold based on the input image.
* **output\_format** (*str*): The format of the output images, for example PNG or JPEG. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the binarize transformation, allowing for further transformations.

**Example:**

```python
transform = image_input.transform().binarize(threshold=150)
image_output.write(transform)
```

### rotate()

Rotates images by the specified angle.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **angle** (*Literal\["DEGREE\_90", "DEGREE\_180", "DEGREE\_270"]*): The angle to rotate the images. Defaults to `DEGREE_90`.
* **output\_format** (*str*): The format of the output images, for example PNG or JPEG. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the rotate transformation, allowing for further transformations.

**Example:**

```python
transform = image_input.transform().rotate(angle="DEGREE_180")
image_output.write(transform)
```

### grayscale()

Converts images to grayscale.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **output\_format** (*str*): The format of the output images, for example PNG or JPEG. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the grayscale transformation, allowing for further transformations.

**Example:**

```python
transform = image_input.transform().grayscale()
image_output.write(transform)
```

### equalize()

Improves the clarity of low-contrast images by performing histogram equalization on grayscale images.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **output\_format** (*str*): The format of the output images, for example PNG or JPEG. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the equalize transformation, allowing for further transformations.

**Example:**

```python
transform = image_input.transform().equalize()
image_output.write(transform)
```

### rayleigh()

Adjusts the grayscale intensity values so the image's histogram (the distribution of pixel brightness) matches the Rayleigh distribution (roughly a bell curve that is always negative). This can improve clarity in low-contrast images.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **sigma** (*float*): The scaling parameter for the Rayleigh distribution. Must be a floating point numeral between 0 and 1. Defaults to 0.5.
* **output\_format** (*str*): The format of the output images, for example PNG or JPEG. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the rayleigh transformation, allowing for further transformations.

**Example:**

```python
transform = image_input.transform().rayleigh(sigma=0.7)
image_output.write(transform)
```

### convert\_image\_to\_document()

Converts images to PDFs.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.

**Returns:**

* An instance of `MediaSetInputTransform` containing the convert image to document transformation, allowing for further transformations.

**Example:**

```python
transform = image_input.transform().convert_image_to_document()
pdf_output.write(transform)
```

### transcode()

Transcodes audio or video to the specified format.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **encode\_format** (*Optional\[str]*): Specifies the format in which the output media will be encoded. Defaults to MP4 for video and MP3 for audio.

**Returns:**

* An instance of `MediaSetInputTransform` containing the transcode transformation, allowing for further transformations.

**Example:**

```python
transform = video_input.transform().transcode(encode_format="mov")
video_output.write(transform)
```

### extract\_audio()

Extracts audio from video files.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **output\_format** (*str*): The format of the output audio (e.g., `mp3`, `wav`). Defaults to `mp3`.

**Returns:**

* An instance of `MediaSetInputTransform` containing the audio extraction transformation, allowing for further transformations.

**Example:**

```python
transform = video_input.transform().extract_audio(output_format="wav")
audio_output.write(transform)
```

### extract\_scene\_frames()

Extracts all scene frames from videos as images. A scene frame is a video frame that marks the beginning of a new scene or a significant visual transition in the video content.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **scene\_sensitivity** (*Literal\["MORE\_SENSITIVE", "STANDARD", "LESS\_SENSITIVE"]*): The sensitivity level for scene detection. Defaults to `STANDARD`.
* **output\_format** (*str*): Specifies the encoding format for extracted frames. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the scene frame extraction transformation. The output images for each video will be stored in a TAR archive file.

**Example:**

```python
transform = video_input.transform().extract_scene_frames(scene_sensitivity="MORE_SENSITIVE")
multimodal_output.write(transform)
```

### chunk()

Chunks audio or video files into smaller segments of the specified duration.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **chunk\_duration\_milliseconds** (*int*): The duration of each chunk in milliseconds. Defaults to `10000` (10 seconds). Must be a positive integer.
* **output\_format** (*Optional\[str]*): The format of the output audio chunks. Defaults to MP4 for video and TS for audio. Note that audio only supports TS as output format.

**Returns:**

* An instance of `MediaSetInputTransform` containing the chunking transformation, allowing for further transformations.

**Example:**

```python
transform = video_input.transform().chunk(chunk_duration_milliseconds=5000)
video_output.write(transform)
```

### extract\_first\_frame()

Extracts the first full scene frame from videos as an image with the specified dimensions, or the original dimensions if not provided.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **width** (*Optional\[int]*): The target width for the extracted frames. If `None`, width will be scaled based on the provided height. Defaults to `None`.
* **height** (*Optional\[int]*): The target height for the extracted frames. If `None`, height will be scaled based on the provided width. Defaults to `None`.
* **output\_format** (*str*): The format of the output images. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the first frame extraction transformation, allowing for further transformations.

**Example:**

```python
transform = video_input.transform().extract_first_frame(width=800, height=600)
image_output.write(transform)
```

### extract\_frames\_at\_timestamp()

Extracts frames from videos at a specified timestamp, using the specified dimensions, or the original dimensions if not provided.

**Parameters:**

* **timestamps** (*Union\[float, Column]*): The timestamp in seconds at which to extract frames.
* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **df** (*Optional\[DataFrame]*): Specifies the DataFrame to join on when passing column inputs. Frame extraction will only be applied to media items present in both the input media set and provided DataFrame. Must be provided together with the `on` parameter.
* **on** (*Optional\[Literal\["media\_item\_rid", "media\_reference"]]*): The column name to join on when `df` is specified. This aligns the frame extraction operation with the correct media item.
* **width** (*Optional\[int]*): The target width for the extracted frames. If `None`, scales width based on the provided height. Defaults to `None`.
* **height** (*Optional\[int]*): The target height for the extracted frames. If `None`, scales height based on provided width. Defaults to `None`.
* **output\_format** (*str*): The format of the output images. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the frame extraction transformation, allowing for further transformations.

**Example:**

```python
# Dynamically select timestamp parameters from the input_df columns.
# Only extracts frames from media items in both the media set and provided DataFrame.
transform1 = video_input.transform().extract_frames_at_timestamp(input_df.timestamp, df=input_df, on="media_item_rid")

# All frames will be extracted at the same timestamp for all items in the media set.
transform2 = video_input.transform().extract_frames_at_timestamp(30)

# Write the transformation to output media set
image_output.write(transform1)
```

### render\_dicom\_layer()

Renders a frame of a DICOM file as an image, using the specified dimensions, or the original dimensions if not provided.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **layer\_number** (*Optional\[int]*): The layer number to render from the DICOM image. Defaults to the middle layer.
* **width** (*Optional\[int]*): The target width for the rendered image. If `None`, and height is provided, the aspect ratio will be preserved. Must be provided if height is not provided.
* **height** (*Optional\[int]*): The target height for the rendered image. If `None`, and width is provided, the aspect ratio will be preserved. Must be provided if width is not provided.
* **output\_format** (*str*): The format of the output images, for example PNG or JPEG. Defaults to PNG.

**Returns:**

* An instance of `MediaSetInputTransform` containing the render DICOM layer transformation, allowing for further transformations.

**Example:**

```python
transform = dicom_input.transform().render_dicom_layer(layer_number=2)
image_output.write(transform)
```

### extract\_form\_fields()

Extracts form fields from documents.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **suppress\_errors** (*bool*): Specifies error handling behavior. If `True`, errors are caught and the error message will be returned in the output. If `False`, any errors will not be caught and the build will fail. Defaults to `True`. Only applicable to transformations on the entire media set.

**Returns:**

* A DataFrame or a single string.
  * `str`: JSON object containing form fields. Applicable for transformations on a single item.
  * `DataFrame`: Columns are `media_item_rid`, `path`, `media_reference`, `form_fields` (str). Applicable for transformations on the entire media set.

**Example:**

```python
df = media_set.transform().extract_form_fields()
dataset_output.write_dataframe(df)
```

### extract\_table\_of\_contents()

Extracts the table of contents from documents.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **suppress\_errors** (*bool*): Specifies error handling behavior. If `True`, errors are caught and the error message will be returned in the output. If `False`, any errors will not be caught and the build will fail. Defaults to `True`. Only applicable to transformations on the entire media set.

**Returns:**

* A DataFrame or a single string.
  * `str`: JSON object containing table of contents. Applicable for transformations on a single item.
  * `DataFrame`: Columns are `media_item_rid`, `path`, `media_reference`, `table_of_contents` (str). Applicable for transformations on the entire media set.

**Example:**

```python
df = media_set.transform().extract_table_of_contents()
dataset_output.write_dataframe(df)
```

### get\_pdf\_page\_dimensions()

Returns PDF page dimensions.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **suppress\_errors** (*bool*): Specifies error handling behavior. If `True`, errors are caught and the error message will be returned in the output. If `False`, any errors will not be caught and the build will fail. Defaults to `True`. Only applicable to transformations on the entire media set.

**Returns:**

* A DataFrame or a single string.
  * `str`: JSON object containing a list of dictionaries with keys `width` and `height`. Applicable for transformations on a single item.
  * `DataFrame`: Columns are `media_item_rid`, `path`, `media_reference`, `page_dimensions` (str). Applicable for transformations on the entire media set.

**Example:**

```python
df = media_set.transform().get_pdf_page_dimensions()
dataset_output.write_dataframe(df)
```

### generate\_image\_embeddings()

Generates embeddings for images.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **model\_id** (*Optional\[str]*): The model to use to generate image embeddings. Defaults to `GOOGLE_SIGLIP_2`.
* **suppress\_errors** (*bool*): Specifies error handling behavior. If `True`, errors are caught and the error message will be returned in the output. If `False`, any errors will not be caught and the build will fail. Defaults to `True`. Only applicable to transformations on the entire media set.

**Returns:**

* A DataFrame or a single string.
  * `str`: JSON object containing vector embeddings. Applicable for transformations on a single item.
  * `DataFrame`: Columns are `media_item_rid`, `path`, `media_reference`, `embeddings` (str). Applicable for transformations on the entire media set.

**Example:**

```python
df = media_set.transform().generate_image_embeddings()
dataset_output.write_dataframe(df)
```

### get\_waveform()

Returns waveform amplitudes for audio files.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **peaks\_per\_second** (*Optional\[int]*): Number of peaks per second to return. Defaults to `100`. Must be a positive non-zero integer up to `1000`.
* **suppress\_errors** (*bool*): Specifies error handling behavior. If `True`, errors are caught and the error message will be returned in the output. If `False`, any errors will not be caught and the build will fail. Defaults to `True`. Only applicable to transformations on the entire media set.

**Returns:**

* A DataFrame or a single string.
  * `str`: JSON object containing a list of doubles representing audio amplitudes and normalized between 0 and 1. Applicable for transformations on a single item.
  * `DataFrame`: Columns are `media_item_rid`, `path`, `media_reference`, `waveform` (str). Applicable for transformations on the entire media set.

**Example:**

```python
df = media_set.transform().get_waveform()
dataset_output.write_dataframe(df)
```

### transcribe()

Transcribes audio.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **language** (*Optional\[str]*): The language to use for transcription. Defaults to `None`, in which case it will be auto-detected. Valid languages can be found in the [Whisper GitHub repo ↗](https://github.com/openai/whisper/blob/main/whisper/tokenizer.py) under `LANGUAGES`.
* **performance\_mode** (*Literal\["more\_economical", "more\_performant"]*): The performance mode to use for transcription. Defaults to `more_economical`.
* **output\_format** (*Literal\["text", "segments"]*): The format of the output. Defaults to `text`.
* **add\_timestamps** (*Optional\[bool]*): Control whether timestamps are added to the transcription. Defaults to `False`. Only applicable when output\_format is `text`.
* **suppress\_errors** (*bool*): Specifies error handling behavior. If `True`, errors are caught and the error message will be returned in the output. If `False`, any errors will not be caught and the build will fail. Defaults to `True`. Only applicable to transformations on the entire media set.

**Returns:**

* A DataFrame or a single string.
  * `str`: Applicable for transformations on a single item.
    * `text`: The transcribed text.
    * `segments`: JSON object containing the transcribed segments including timestamps, segment confidence and more details.
  * `DataFrame`: Columns are `media_item_rid`, `path`, `media_reference`, `transcription` (str). Applicable for transformations on the entire media set.

**Example:**

```python
df = media_set.transform().transcribe(output_format="segments")
dataset_output.write_dataframe(df)
```

### get\_scene\_frame\_timestamps()

Returns timestamps for scene frames from video files.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **scene\_sensitivity** (*Literal\["MORE\_SENSITIVE", "STANDARD", "LESS\_SENSITIVE"]*): The sensitivity level for scene detection. Defaults to `STANDARD`.
* **suppress\_errors** (*bool*): Specifies error handling behavior. If `True`, errors are caught and the error message will be returned in the output. If `False`, any errors will not be caught and the build will fail. Defaults to `True`. Only applicable to transformations on the entire media set.

**Returns:**

* A DataFrame or a single string.
  * `str`: JSON object containing a list of scene frames with keys `timestamp` and `sceneScore` in the `frames` field. Applicable for transformations on a single item.
  * `DataFrame`: Columns are `media_item_rid`, `path`, `media_reference`, `scene_frames` (str). Applicable for transformations on the entire media set.

**Example:**

```python
df = media_set.transform().get_scene_frame_timestamps()
dataset_output.write_dataframe(df)
```

### extract\_email\_body()

Extracts the body of emails.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **output\_format** (*Literal\["TEXT", "HTML"]*): Specifies the output format for the extracted content. Defaults to `TEXT`.
* **suppress\_errors** (*bool*): Specifies error handling behavior. If `True`, errors are caught and the error message will be returned in the output. If `False`, any errors will not be caught and the build will fail. Defaults to `True`. Only applicable to transformations on the entire media set.

**Returns:**

* A DataFrame or a single string.
  * `str`: Email body in the specified format. Applicable for transformations on a single item.
  * `DataFrame`: Columns are `media_item_rid`, `path`, `media_reference`, `email_body` (str). Applicable for transformations on the entire media set.

**Example:**

```python
df = media_set.transform().extract_email_body()
dataset_output.write_dataframe(df)
```

### extract\_email\_attachments()

Extracts attachments from emails.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **schema\_type** (*Optional\[Literal\["audio", "image", "video", "document", "spreadsheet", "dicom", "email"]]*): Only extract attachments of the specified schema type. Defaults to `None`, which extracts all attachments.

**Returns:**

* An instance of `MediaSetInputTransform` containing the extract email attachments transformation, allowing for further transformations.

**Example:**

```python
transform = email_input.transform().extract_email_attachments()
multimodal_output.write(transform)
```

### filter\_to()

Filters the media set to only include items of the specified schema type and (optional) formats.

**Parameters:**

* **schema\_type** (*Literal\["audio", "image", "video", "document", "spreadsheet", "dicom", "email"]*): The schema type on which to filter.
* **formats** (*Optional\[list\[str]]*): Optional list of specific formats on which to filter. If not provided, all formats within the schema type are included. Available formats by schema type:
  * document: `pdf`, `docx`, `pptx`, `txt`
  * image: `png`, `jpeg`, `jpg`, `tiff`, `bmp`, `webp`, `jp2`, `jp2k`, `nitf`
  * audio: `mp3`, `wav`, `flac`, `ogg`, `opus`, `m4a`, `webm_audio`
  * video: `mp4`, `ts`, `mov`, `mkv`
  * spreadsheet: `xlsx`
  * email: `eml`
  * dicom: Does not support format narrowing

**Returns:**

* An instance of `MediaSetInputTransform` containing the filter transformation, allowing for further transformations.

**Example:**

```python
# Filter to all documents
transform = media_set.transform().filter_to("document").slice_document(0, 5)

# Filter to only PDFs and perform OCR
transform = media_set.transform().filter_to("document", formats=["pdf"]).ocr()

# Filter to PDFs and DOCX files
transform = media_set.transform().filter_to("document", formats=["pdf", "docx"])
pdf_output.write(transform)
```

### extract\_content\_from\_spreadsheets()

Extracts content from spreadsheet files.

**Parameters:**

* **media\_item\_rid** (*Optional\[str]*): If specified, will run the transformation on the specified item instead of the entire media set. Defaults to `None`.
* **suppress\_errors** (*bool*): Specifies error handling behavior. If `True`, errors are caught and the error message will be returned in the output. If `False`, any errors will not be caught and the build will fail. Defaults to `True`. Only applicable to transformations on the entire media set.

**Returns:**

* A DataFrame or a single string.
  * `str`: JSON object containing a key for each sheet name, and its value having fields `table` and `merged_cells`. Applicable for transformations on a single item.
  * `DataFrame`: Columns are `media_item_rid`, `path`, `media_reference`, `extracted_content` (str). Applicable for transformations on the entire media set.

**Example:**

```python
df = media_set.transform().extract_content_from_spreadsheets()
dataset_output.write_dataframe(df)
```
