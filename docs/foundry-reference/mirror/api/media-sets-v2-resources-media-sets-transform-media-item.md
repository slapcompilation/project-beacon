<!-- source: https://palantir.com/docs/foundry/api/media-sets-v2-resources/media-sets/transform-media-item/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Transform Media Item

`POST /api/v2/mediasets/{mediaSetRid}/items/{mediaItemRid}/transform`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Initiates a transformation on a media item. Returns a job ID that can be used to check the status and retrieve 
the result of the transformation.

Transforming a media item requires that you are able to read the media item, either via `api:mediasets-read` or
via a `MediaItemReadToken`


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:mediasets-transform`.

Scopes: `api:mediasets-transform`

## Path parameters

- `mediaSetRid` · string · required
  "The RID of the media set."
- `mediaItemRid` · string · required
  "The RID of the media item."

## Query parameters

- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."

## Request

- `TransformMediaItemRequest` · object · required
  "Request to transform a media item."
  - `transformation` · union · required
    "A transformation to apply to a media item. Each variant specifies the type of transformation and any parameters required for the operation."
    - `emailToText` · object
      "Extracts text content from email."
      - `operation` · union · required
        "The operation to perform for email to text extraction."
        - `getEmailBody` · object
          "Gets the email body in the specified format."
          - `outputFormat` · enum · required
            one of `TEXT`, `HTML`
            "The output format for email body extraction."
    - `image` · object
      "Transforms images with multiple operations applied in sequence. Operations are applied in the order they appear in the list."
      - `encoding` · union · required
        "The output format for encoding imagery."
        - `jpg` · object
          "JPEG image format."
        - `tiff` · object
          "TIFF image format."
        - `png` · object
          "PNG image format."
        - `webp` · object
          "WebP image format."
      - `operations` · list
        "The list of operations to apply to the image, in order."
        - `ImageOperation` · union · required
          "An operation to perform on an image."
          - `rotate` · object
            "Rotates an image clockwise by the specified angle."
            - `angle` · enum · required
              one of `DEGREE_90`, `DEGREE_180`, `DEGREE_270`, `UNKNOWN`
              "The rotation angle from EXIF orientation."
          - `resizeToFitBoundingBox` · object
            "Resizes an image to maximally fit within a bounding box while preserving aspect ratio."
            - `width` · integer · required
              "The width of the bounding box in pixels."
            - `height` · integer · required
              "The height of the bounding box in pixels."
          - `encrypt` · object
            "Encrypts bounding boxes in an image using a commutative encryption algorithm."
            - `polygons` · list
              "The polygons defining the regions to encrypt."
              - `ImageRegionPolygon` · list · required
                "Polygon drawn by connecting adjacent coordinates in the list with straight lines. A line is drawn between the last and first coordinates in the list to create a closed shape. Used to define regions in an image for operations like encryption/decryption."
                - `ImagePixelCoordinate` · object · required
                  "Coordinate of a pixel in an image (x, y). Top left corner of the image is (0, 0)."
                  - `x` · integer · required
                    "Coordinate on the x-axis (width)."
                  - `y` · integer · required
                    "Coordinate on the y-axis (height)."
            - `cipherLicenseRid` · string · required
              "The resource identifier for the cipher license."
          - `contrast` · object
            "Applies contrast adjustments to an image."
            - `contrastType` · union · required
              "The type of contrast adjustment to apply."
              - `equalize` · object
                "Equalizes the histogram of an image to improve contrast."
              - `rayleigh` · object
                "Applies Rayleigh distribution-based contrast adjustment."
                - `sigma` · number · required
                  "The scaling parameter for the Rayleigh distribution (0-1)."
              - `binarize` · object
                "Binarize contrast operation."
                - `threshold` · integer
                  "The threshold value (0-255). Pixels with intensity below this value become black, others become white. If not specified, the threshold is computed automatically."
          - `tile` · object
            "Generates Slippy map tiles (EPSG 3857) from a geo-embedded image. Only supported for geo-embedded TIFF and NITF images with at most 100M square pixels."
            - `zoom` · integer · required
              "The zoom level of the tile."
            - `x` · integer · required
              "The x coordinate of the tile."
            - `y` · integer · required
              "The y coordinate of the tile."
          - `resize` · object
            "Resizes an image to the specified dimensions. If only one dimension is specified, the other is calculated to preserve aspect ratio."
            - `height` · integer
              "The desired height in pixels."
            - `width` · integer
              "The desired width in pixels."
            - `autoOrient` · boolean
              "Whether to automatically orient the image based on EXIF metadata."
          - `annotate` · object
            "Annotates an image with bounding boxes, labels, and colors."
            - `annotations` · list
              "The list of annotations to draw on the image."
              - `Annotation` · object · required
                "An annotation to draw on an image."
                - `geometry` · union · required
                  "The geometry for an annotation."
                  - `boundingBox` · object
                    "A rectangular bounding box geometry for annotations."
                    - `boundingBox` · object · required
                      "A rectangular bounding box for annotations."
                      - `left` · number · required
                        "The left coordinate of the bounding box."
                      - `top` · number · required
                        "The top coordinate of the bounding box."
                      - `width` · number · required
                        "The width of the bounding box."
                      - `height` · number · required
                        "The height of the bounding box."
                - `label` · string
                  "An optional text label to display with the annotation."
                - `color` · object
                  "An RGBA color value."
                  - `r` · integer · required
                    "Red component (0-255)."
                  - `g` · integer · required
                    "Green component (0-255)."
                  - `b` · integer · required
                    "Blue component (0-255)."
                  - `a` · number
                    "Alpha component (0-1, where 0 is transparent and 1 is opaque)."
                - `thickness` · number
                  "The thickness of the annotation lines."
                - `fontSize` · integer
                  "The font size for the label text."
          - `decrypt` · object
            "Decrypts bounding boxes in an image using a commutative encryption algorithm."
            - `polygons` · list
              "The polygons defining the regions to decrypt."
              - `ImageRegionPolygon` · list · required
                "Polygon drawn by connecting adjacent coordinates in the list with straight lines. A line is drawn between the last and first coordinates in the list to create a closed shape. Used to define regions in an image for operations like encryption/decryption."
                - `ImagePixelCoordinate` · object · required
                  "Coordinate of a pixel in an image (x, y). Top left corner of the image is (0, 0)."
                  - `x` · integer · required
                    "Coordinate on the x-axis (width)."
                  - `y` · integer · required
                    "Coordinate on the y-axis (height)."
            - `cipherLicenseRid` · string · required
              "The resource identifier for the cipher license."
          - `crop` · object
            "Crops an image to a rectangular sub-window."
            - `xOffset` · integer · required
              "The x offset in pixels from the left hand side of the image."
            - `yOffset` · integer · required
              "The y offset in pixels from the top of the image."
            - `width` · integer · required
              "The width of the cropping box in pixels."
            - `height` · integer · required
              "The height of the cropping box in pixels."
          - `grayscale` · object
            "Converts an image to grayscale."
    - `spreadsheetToText` · object
      "Converts spreadsheet data to text/JSON."
      - `operation` · union · required
        "The operation to perform for spreadsheet to text conversion."
        - `convertSheetToJson` · object
          "Converts a specified sheet to JSON format."
          - `sheetName` · string · required
            "The sheet name."
    - `videoToAudio` · object
      "Extracts audio from video."
      - `encoding` · union · required
        "The output format for encoding audio."
        - `mp3` · object
          "MP3 audio format."
        - `wav` · object
          "WAV audio format with optional sample rate and channel layout."
          - `sampleRate` · integer
            "The sample rate in Hz. Defaults to 44100 Hz if not specified."
          - `audioChannelLayout` · union
            "The audio channel layout configuration."
            - `numberOfChannels` · object
              "Specifies the number of audio channels. Defaults to 2 (stereo)."
              - `numberOfChannels` · integer · required
                "The number of audio channels."
        - `ts` · object
          "MPEG Transport Stream audio container format."
      - `operation` · union · required
        "The operation to perform for video to audio conversion."
        - `extractAudio` · object
          "Extracts the first audio stream from the video unchanged."
    - `audioToText` · object
      "Converts audio to text."
      - `operation` · union · required
        "The operation to perform for audio to text conversion."
        - `transcribe` · object
          "Transcribes speech in audio to text."
          - `language` · enum
            one of `AF`, `AM`, `AR`, `AS`, `AZ`, `BA`, `BE`, `BG`, `BN`, `BO`, `BR`, `BS`, `CA`, `CS`, `CY`, `DA`, `DE`, `EL`, `EN`, `ES`, `ET`, `EU`, `FA`, `FI`, `FO`, `FR`, `GL`, `GU`, `HA`, `HAW`, `HE`, `HI`, `HR`, `HT`, `HU`, `HY`, `ID`, `IS`, `IT`, `JA`, `JW`, `KA`, `KK`, `KM`, `KN`, `KO`, `LA`, `LB`, `LN`, `LO`, `LT`, `LV`, `MG`, `MI`, `MK`, `ML`, `MN`, `MR`, `MS`, `MT`, `MY`, `NE`, `NL`, `NN`, `NO`, `OC`, `PA`, `PL`, `PS`, `PT`, `RO`, `RU`, `SA`, `SD`, `SI`, `SK`, `SL`, `SN`, `SO`, `SQ`, `SR`, `SU`, `SV`, `SW`, `TA`, `TE`, `TG`, `TH`, `TK`, `TL`, `TR`, `TT`, `UK`, `UR`, `UZ`, `VI`, `YI`, `YO`, `YUE`, `ZH`, `AFRIKAANS`, `ALBANIAN`, `AMHARIC`, `ARABIC`, `ARMENIAN`, `ASSAMESE`, `AZERBAIJANI`, `BASHKIR`, `BASQUE`, `BELARUSIAN`, `BENGALI`, `BOSNIAN`, `BRETON`, `BULGARIAN`, `BURMESE`, `CANTONESE`, `CASTILIAN`, `CATALAN`, `CHINESE`, `CROATIAN`, `CZECH`, `DANISH`, `DUTCH`, `ENGLISH`, `ESTONIAN`, `FAROESE`, `FINNISH`, `FLEMISH`, `FRENCH`, `GALICIAN`, `GEORGIAN`, `GERMAN`, `GREEK`, `GUJARATI`, `HAITIAN`, `HAITIAN_CREOLE`, `HAUSA`, `HAWAIIAN`, `HEBREW`, `HINDI`, `HUNGARIAN`, `ICELANDIC`, `INDONESIAN`, `ITALIAN`, `JAPANESE`, `JAVANESE`, `KANNADA`, `KAZAKH`, `KHMER`, `KOREAN`, `LAO`, `LATIN`, `LATVIAN`, `LETZEBURGESCH`, `LINGALA`, `LITHUANIAN`, `LUXEMBOURGISH`, `MACEDONIAN`, `MALAGASY`, `MALAY`, `MALAYALAM`, `MALTESE`, `MANDARIN`, `MAORI`, `MARATHI`, `MOLDAVIAN`, `MOLDOVAN`, `MONGOLIAN`, `MYANMAR`, `NEPALI`, `NORWEGIAN`, `NYNORSK`, `OCCITAN`, `PANJABI`, `PASHTO`, `PERSIAN`, `POLISH`, `PORTUGUESE`, `PUNJABI`, `PUSHTO`, `ROMANIAN`, `RUSSIAN`, `SANSKRIT`, `SERBIAN`, `SHONA`, `SINDHI`, `SINHALA`, `SINHALESE`, `SLOVAK`, `SLOVENIAN`, `SOMALI`, `SPANISH`, `SUNDANESE`, `SWAHILI`, `SWEDISH`, `TAGALOG`, `TAJIK`, `TAMIL`, `TATAR`, `TELUGU`, `THAI`, `TIBETAN`, `TURKISH`, `TURKMEN`, `UKRAINIAN`, `URDU`, `UZBEK`, `VALENCIAN`, `VIETNAMESE`, `WELSH`, `YIDDISH`, `YORUBA`
            "Language codes for audio transcription. If not specified, the language will be auto-detected from the first 30 seconds of audio."
          - `diarize` · boolean
            "Whether to perform speaker diarization. Defaults to false. Not supported in economical performance mode."
          - `outputFormat` · union
            "The output format for transcription results."
            - `plainTextNoSegmentData` · object
              "Plain text transcription output format."
              - `addTimestamps` · boolean · required
                "Whether to include timestamps in the output."
            - `json` · object
              "JSON transcription output format."
            - `pttml` · object
              "PTTML (Palantir Timed Text Markup Language) transcription output format."
          - `performanceMode` · enum
            one of `MORE_ECONOMICAL`, `MORE_PERFORMANT`
            "The performance mode for transcription."
        - `waveform` · object
          "Generates waveform visualization data from audio. Returns JSON with normalized doubles (0-1) representing amplitude."
          - `peaksPerSecond` · integer · required
            "The number of peaks per second (1-1000)."
    - `emailToAttachment` · object
      "Extracts attachments from email."
      - `operation` · union · required
        "The operation to perform for email to attachment extraction."
        - `getEmailAttachment` · object
          "Retrieves the bytes of an email attachment by index."
          - `mimeType` · string · required
            "The MIME type of the attachment. Must match the metadata attachment MIME type."
          - `attachmentIndex` · integer · required
            "The attachment index."
    - `videoToArchive` · object
      "Extracts video frames to an archive format."
      - `encoding` · union · required
        "The output format for encoding archives."
        - `tar` · object
          "TAR archive format."
      - `operation` · union · required
        "The operation to perform for video to archive conversion."
        - `extractSceneFrames` · object
          "Extracts all scene frames from a video as images in an archive."
          - `encoding` · union · required
            "The output format for encoding imagery."
            - `jpg` · object
              "JPEG image format."
            - `tiff` · object
              "TIFF image format."
            - `png` · object
              "PNG image format."
            - `webp` · object
              "WebP image format."
          - `sceneScore` · enum
            one of `MORE_SENSITIVE`, `STANDARD`, `LESS_SENSITIVE`
            "The sensitivity threshold for scene detection."
    - `videoToText` · object
      "Extracts metadata from video as text/JSON."
      - `operation` · union · required
        "The operation to perform for video to text conversion."
        - `getTimestampsForSceneFrames` · object
          "Returns a list of timestamps for scene frames in the video as JSON."
          - `sceneScore` · enum
            one of `MORE_SENSITIVE`, `STANDARD`, `LESS_SENSITIVE`
            "The sensitivity threshold for scene detection."
    - `imageToText` · object
      "Extracts text from images."
      - `operation` · union · required
        "The operation to perform for image to text conversion."
        - `extractLayoutAwareContent` · object
          "Extracts text from an image with layout information preserved."
          - `parameters` · object · required
            "Parameters for layout-aware content extraction."
            - `languages` · list
              "The languages to use for extraction."
              - `OcrLanguage` · enum · required
                one of `AFR`, `AMH`, `ARA`, `ASM`, `AZE`, `AZE_CYRL`, `BEL`, `BEN`, `BOD`, `BOS`, `BRE`, `BUL`, `CAT`, `CEB`, `CES`, `CHI_SIM`, `CHI_SIM_VERT`, `CHI_TRA`, `CHI_TRA_VERT`, `CHR`, `COS`, `CYM`, `DAN`, `DEU`, `DIV`, `DZO`, `ELL`, `ENG`, `ENM`, `EPO`, `EST`, `EUS`, `FAO`, `FAS`, `FIL`, `FIN`, `FRA`, `FRM`, `FRY`, `GLA`, `GLE`, `GLG`, `GRC`, `GUJ`, `HAT`, `HEB`, `HIN`, `HRV`, `HUN`, `HYE`, `IKU`, `IND`, `ISL`, `ITA`, `ITA_OLD`, `JAV`, `JPN`, `JPN_VERT`, `KAN`, `KAT`, `KAT_OLD`, `KAZ`, `KHM`, `KIR`, `KMR`, `KOR`, `KOR_VERT`, `LAO`, `LAT`, `LAV`, `LIT`, `LTZ`, `MAL`, `MAR`, `MKD`, `MLT`, `MON`, `MRI`, `MSA`, `MYA`, `NEP`, `NLD`, `NOR`, `OCI`, `ORI`, `OSD`, `PAN`, `POL`, `POR`, `PUS`, `QUE`, `RON`, `RUS`, `SAN`, `SIN`, `SLK`, `SLV`, `SND`, `SPA`, `SPA_OLD`, `SQI`, `SRP`, `SRP_LATN`, `SUN`, `SWA`, `SWE`, `SYR`, `TAM`, `TAT`, `TEL`, `TGK`, `THA`, `TIR`, `TON`, `TUR`, `UIG`, `UKR`, `URD`, `UZB`, `UZB_CYRL`, `VIE`, `YID`, `YOR`
                "Language codes for OCR."
        - `ocr` · object
          "Performs OCR (Optical Character Recognition) on an image."
          - `parameters` · object · required
            "Parameters for OCR (Optical Character Recognition) operations."
            - `outputFormat` · union · required
              "The output format for OCR results."
              - `hocr` · object
                "hOCR (HTML-based OCR) output format."
              - `text` · object
                "Plain text output format for OCR."
            - `languages` · list
              "The languages or scripts to use for OCR."
              - `OcrLanguageOrScript` · union · required
                "Either a specific language or a script for OCR."
                - `language` · object
                  "Wrapper for an OCR language."
                  - `language` · enum · required
                    one of `AFR`, `AMH`, `ARA`, `ASM`, `AZE`, `AZE_CYRL`, `BEL`, `BEN`, `BOD`, `BOS`, `BRE`, `BUL`, `CAT`, `CEB`, `CES`, `CHI_SIM`, `CHI_SIM_VERT`, `CHI_TRA`, `CHI_TRA_VERT`, `CHR`, `COS`, `CYM`, `DAN`, `DEU`, `DIV`, `DZO`, `ELL`, `ENG`, `ENM`, `EPO`, `EST`, `EUS`, `FAO`, `FAS`, `FIL`, `FIN`, `FRA`, `FRM`, `FRY`, `GLA`, `GLE`, `GLG`, `GRC`, `GUJ`, `HAT`, `HEB`, `HIN`, `HRV`, `HUN`, `HYE`, `IKU`, `IND`, `ISL`, `ITA`, `ITA_OLD`, `JAV`, `JPN`, `JPN_VERT`, `KAN`, `KAT`, `KAT_OLD`, `KAZ`, `KHM`, `KIR`, `KMR`, `KOR`, `KOR_VERT`, `LAO`, `LAT`, `LAV`, `LIT`, `LTZ`, `MAL`, `MAR`, `MKD`, `MLT`, `MON`, `MRI`, `MSA`, `MYA`, `NEP`, `NLD`, `NOR`, `OCI`, `ORI`, `OSD`, `PAN`, `POL`, `POR`, `PUS`, `QUE`, `RON`, `RUS`, `SAN`, `SIN`, `SLK`, `SLV`, `SND`, `SPA`, `SPA_OLD`, `SQI`, `SRP`, `SRP_LATN`, `SUN`, `SWA`, `SWE`, `SYR`, `TAM`, `TAT`, `TEL`, `TGK`, `THA`, `TIR`, `TON`, `TUR`, `UIG`, `UKR`, `URD`, `UZB`, `UZB_CYRL`, `VIE`, `YID`, `YOR`
                    "Language codes for OCR."
                - `script` · object
                  "Wrapper for an OCR script."
                  - `script` · enum · required
                    one of `ARABIC`, `ARMENIAN`, `BENGALI`, `CANADIAN_ABORIGINAL`, `CHEROKEE`, `CYRILLIC`, `DEVANAGARI`, `ETHIOPIC`, `FRAKTUR`, `GEORGIAN`, `GREEK`, `GUJARATI`, `GURMUKHI`, `HAN_SIMPLIFIED`, `HAN_SIMPLIFIED_VERT`, `HAN_TRADITIONAL`, `HAN_TRADITIONAL_VERT`, `HANGUL`, `HANGUL_VERT`, `HEBREW`, `JAPANESE`, `JAPANESE_VERT`, `KANNADA`, `KHMER`, `LAO`, `LATIN`, `MALAYALAM`, `MYANMAR`, `ORIYA`, `SINHALA`, `SYRIAC`, `TAMIL`, `TELUGU`, `THAANA`, `THAI`, `TIBETAN`, `VIETNAMESE`
                    "Script codes for OCR."
    - `videoToImage` · object
      "Extracts video frames as images."
      - `encoding` · union · required
        "The output format for encoding imagery."
        - `jpg` · object
          "JPEG image format."
        - `tiff` · object
          "TIFF image format."
        - `png` · object
          "PNG image format."
        - `webp` · object
          "WebP image format."
      - `operation` · union · required
        "The operation to perform for video to image conversion."
        - `extractFirstFrame` · object
          "Extracts the first full scene frame from the video. If both width and height are not specified, preserves the original size. If only one dimension is specified, the other is calculated to preserve aspect ratio."
          - `height` · integer
            "The desired height in pixels."
          - `width` · integer
            "The desired width in pixels."
        - `extractFramesAtTimestamps` · object
          "Extracts frames from the video at specified timestamps. If only one dimension is specified, the other is calculated to preserve aspect ratio."
          - `height` · integer
            "The desired height in pixels."
          - `width` · integer
            "The desired width in pixels."
          - `timestamp` · number · required
            "The timestamp in seconds."
    - `video` · object
      "Transforms video media items."
      - `encoding` · union · required
        "The output format for encoding video."
        - `mp4` · object
          "MP4 video container format."
        - `mov` · object
          "MOV (QuickTime) video container format."
        - `mkv` · object
          "MKV (Matroska) video container format."
        - `ts` · object
          "MPEG Transport Stream video container format."
      - `operation` · union · required
        "The operation to perform on the video."
        - `transcode` · object
          "Encodes video to the specified format."
        - `chunk` · object
          "Chunks video into smaller segments of the specified duration. The final chunk may be smaller than the specified duration."
          - `chunkDurationMilliseconds` · integer · required
            "Duration of each chunk in milliseconds."
          - `chunkIndex` · integer · required
            "The chunk index to retain."
    - `imageToDocument` · object
      "Converts images to documents."
      - `operation` · union · required
        "The operation to perform for image to document conversion."
        - `createPdf` · object
          "Converts an image to a PDF document."
    - `dicomToImage` · object
      "Renders DICOM (Digital Imaging and Communications in Medicine) files as images."
      - `encoding` · union · required
        "The output format for encoding imagery."
        - `jpg` · object
          "JPEG image format."
        - `tiff` · object
          "TIFF image format."
        - `png` · object
          "PNG image format."
        - `webp` · object
          "WebP image format."
      - `operation` · union · required
        "The operation to perform for DICOM to image conversion."
        - `renderImageLayer` · object
          "Renders a frame of a DICOM file as an image. If only one dimension is specified, the other is calculated to preserve aspect ratio."
          - `layerNumber` · integer
            "The layer number to render. If not specified, renders the middle layer."
          - `height` · integer
            "The desired height in pixels."
          - `width` · integer
            "The desired width in pixels."
    - `documentToDocument` · object
      "Transforms documents to documents."
      - `encoding` · union · required
        "The output format for encoding documents."
        - `pdf` · object
          "PDF document format."
      - `operation` · union · required
        "The operation to perform for document to document conversion."
        - `slicePdfRange` · object
          "Slices a PDF to a specified page range."
          - `startPageInclusive` · integer · required
            "The zero-indexed start page (inclusive)."
          - `endPageExclusive` · integer · required
            "The zero-indexed end page (exclusive)."
          - `strictlyEnforceEndPage` · boolean
            "If true (default), the operation fails if endPage exceeds the document's page count. If false, ends at min(endPage, lastPage)."
        - `convertDocument` · object
          "Converts a document to PDF format."
    - `documentToImage` · object
      "Renders document pages as images."
      - `encoding` · union · required
        "The output format for encoding imagery."
        - `jpg` · object
          "JPEG image format."
        - `tiff` · object
          "TIFF image format."
        - `png` · object
          "PNG image format."
        - `webp` · object
          "WebP image format."
      - `operation` · union · required
        "The operation to perform for document to image conversion."
        - `renderPageToFitBoundingBox` · object
          "Renders a PDF page to maximally fit within a bounding box while preserving aspect ratio."
          - `pageNumber` · integer
            "The zero-indexed page number to render. Defaults to the first page if not specified."
          - `width` · integer · required
            "The width of the bounding box in pixels."
          - `height` · integer · required
            "The height of the bounding box in pixels."
        - `renderPage` · object
          "Renders a PDF page as an image. If only one dimension is specified, the other is calculated to preserve aspect ratio."
          - `pageNumber` · integer
            "The zero-indexed page number to render. Defaults to the first page if not specified."
          - `height` · integer
            "The desired height in pixels."
          - `width` · integer
            "The desired width in pixels."
    - `imageToEmbedding` · object
      "Generates embeddings from images."
      - `operation` · union · required
        "The operation to perform for image to embedding conversion."
        - `generateEmbedding` · object
          "Generates a vector embedding for an image using the specified model."
          - `modelId` · enum · required
            one of `GOOGLE_SIGLIP_2`
            "Available embedding models that can be used with the service."
    - `audio` · object
      "Transforms audio media items."
      - `operation` · union · required
        "The operation to perform on audio."
        - `channel` · object
          "Selects a specific channel from multi-channel audio."
          - `encodeFormat` · union · required
            "The output format for encoding audio."
            - `mp3` · object
              "MP3 audio format."
            - `wav` · object
              "WAV audio format with optional sample rate and channel layout."
              - `sampleRate` · integer
                "The sample rate in Hz. Defaults to 44100 Hz if not specified."
              - `audioChannelLayout` · union
                "The audio channel layout configuration."
                - `numberOfChannels` · object
                  "Specifies the number of audio channels. Defaults to 2 (stereo)."
                  - `numberOfChannels` · integer · required
                    "The number of audio channels."
            - `ts` · object
              "MPEG Transport Stream audio container format."
          - `channel` · integer · required
            "The channel number to select."
        - `chunk` · object
          "Chunks audio into smaller segments of the specified duration."
          - `chunkDurationMilliseconds` · integer · required
            "Duration of each chunk in milliseconds."
          - `encodeFormat` · union · required
            "The output format for encoding audio."
            - `mp3` · object
              "MP3 audio format."
            - `wav` · object
              "WAV audio format with optional sample rate and channel layout."
              - `sampleRate` · integer
                "The sample rate in Hz. Defaults to 44100 Hz if not specified."
              - `audioChannelLayout` · union
                "The audio channel layout configuration."
                - `numberOfChannels` · object
                  "Specifies the number of audio channels. Defaults to 2 (stereo)."
                  - `numberOfChannels` · integer · required
                    "The number of audio channels."
            - `ts` · object
              "MPEG Transport Stream audio container format."
          - `chunkIndex` · integer · required
            "The chunk index to retain."
        - `convert` · object
          "Converts audio to the specified format."
          - `encodeFormat` · union · required
            "The output format for encoding audio."
            - `mp3` · object
              "MP3 audio format."
            - `wav` · object
              "WAV audio format with optional sample rate and channel layout."
              - `sampleRate` · integer
                "The sample rate in Hz. Defaults to 44100 Hz if not specified."
              - `audioChannelLayout` · union
                "The audio channel layout configuration."
                - `numberOfChannels` · object
                  "Specifies the number of audio channels. Defaults to 2 (stereo)."
                  - `numberOfChannels` · integer · required
                    "The number of audio channels."
            - `ts` · object
              "MPEG Transport Stream audio container format."
    - `documentToText` · object
      "Extracts text from documents."
      - `operation` · union · required
        "The operation to perform for document to text conversion."
        - `extractTableOfContents` · object
          "Extracts the table of contents from a document."
        - `getPdfPageDimensions` · object
          "Returns the dimensions of each page in a PDF document as JSON (in points)."
        - `extractAllText` · object
          "Extracts text across all pages of the document. For PDF documents, includes all text. For DocX documents, includes only regular paragraphs."
        - `extractVlmText` · object
          "Extract text from a document using vision language models (VLMs). VLMs can understand document layout and structure more intelligently than traditional OCR."
          - `llmSpec` · union · required
            "Specification for language model requests."
            - `chat` · object
              "Wrapper for chat-based LLM specification."
              - `chat` · object · required
                "Standard chat-based LLM specification with system and user prompts."
                - `modelLocator` · union · required
                  "Locator for identifying a language model."
                  - `apiName` · object
                    "Wrapper for API name-based model locator."
                    - `apiName` · string · required
                      "The API name of the language model."
                - `systemPrompt` · string · required
                  "System prompt for the LLM."
                - `userPrompt` · string · required
                  "User prompt for the LLM."
                - `maxTokens` · integer
                  "Maximum number of tokens per request to generate."
          - `preprocessingConfiguration` · union
            "Preprocessing configuration for VLM extraction."
            - `layoutAware` · object
              "Wrapper for layout-aware preprocessing."
              - `layoutAware` · object · required
                "Configuration for layout-aware extraction preprocessing."
                - `transformationConfig` · object · required
                  "Configuration for v2 layout-aware document text extraction."
                  - `format` · enum
                    one of `TEXT`, `MARKDOWN`, `HTML`
                    "Format in which to return extracted text."
                  - `mode` · enum
                    one of `AUTO`, `ELECTRONIC`, `SCAN`
                    "OCR mode for document extraction."
                  - `languages` · list
                    "List of OCR languages or scripts to use."
                    - `OcrLanguageOrScript` · union · required
                      "Either a specific language or a script for OCR."
                      - `language` · object
                        "Wrapper for an OCR language."
                        - `language` · enum · required
                          one of `AFR`, `AMH`, `ARA`, `ASM`, `AZE`, `AZE_CYRL`, `BEL`, `BEN`, `BOD`, `BOS`, `BRE`, `BUL`, `CAT`, `CEB`, `CES`, `CHI_SIM`, `CHI_SIM_VERT`, `CHI_TRA`, `CHI_TRA_VERT`, `CHR`, `COS`, `CYM`, `DAN`, `DEU`, `DIV`, `DZO`, `ELL`, `ENG`, `ENM`, `EPO`, `EST`, `EUS`, `FAO`, `FAS`, `FIL`, `FIN`, `FRA`, `FRM`, `FRY`, `GLA`, `GLE`, `GLG`, `GRC`, `GUJ`, `HAT`, `HEB`, `HIN`, `HRV`, `HUN`, `HYE`, `IKU`, `IND`, `ISL`, `ITA`, `ITA_OLD`, `JAV`, `JPN`, `JPN_VERT`, `KAN`, `KAT`, `KAT_OLD`, `KAZ`, `KHM`, `KIR`, `KMR`, `KOR`, `KOR_VERT`, `LAO`, `LAT`, `LAV`, `LIT`, `LTZ`, `MAL`, `MAR`, `MKD`, `MLT`, `MON`, `MRI`, `MSA`, `MYA`, `NEP`, `NLD`, `NOR`, `OCI`, `ORI`, `OSD`, `PAN`, `POL`, `POR`, `PUS`, `QUE`, `RON`, `RUS`, `SAN`, `SIN`, `SLK`, `SLV`, `SND`, `SPA`, `SPA_OLD`, `SQI`, `SRP`, `SRP_LATN`, `SUN`, `SWA`, `SWE`, `SYR`, `TAM`, `TAT`, `TEL`, `TGK`, `THA`, `TIR`, `TON`, `TUR`, `UIG`, `UKR`, `URD`, `UZB`, `UZB_CYRL`, `VIE`, `YID`, `YOR`
                          "Language codes for OCR."
                      - `script` · object
                        "Wrapper for an OCR script."
                        - `script` · enum · required
                          one of `ARABIC`, `ARMENIAN`, `BENGALI`, `CANADIAN_ABORIGINAL`, `CHEROKEE`, `CYRILLIC`, `DEVANAGARI`, `ETHIOPIC`, `FRAKTUR`, `GEORGIAN`, `GREEK`, `GUJARATI`, `GURMUKHI`, `HAN_SIMPLIFIED`, `HAN_SIMPLIFIED_VERT`, `HAN_TRADITIONAL`, `HAN_TRADITIONAL_VERT`, `HANGUL`, `HANGUL_VERT`, `HEBREW`, `JAPANESE`, `JAPANESE_VERT`, `KANNADA`, `KHMER`, `LAO`, `LATIN`, `MALAYALAM`, `MYANMAR`, `ORIYA`, `SINHALA`, `SYRIAC`, `TAMIL`, `TELUGU`, `THAANA`, `THAI`, `TIBETAN`, `VIETNAMESE`
                          "Script codes for OCR."
                - `cropConfig` · object
                  "Configuration for table cropping."
                  - `tablePrompt` · string · required
                    "Prompt for table extraction."
            - `extractText` · object
              "Wrapper for text extraction preprocessing."
              - `extractText` · object · required
                "Configuration for v2 document text extraction."
                - `format` · enum
                  one of `TEXT`, `MARKDOWN`, `HTML`
                  "Format in which to return extracted text."
                - `mode` · enum
                  one of `AUTO`, `ELECTRONIC`, `SCAN`
                  "OCR mode for document extraction."
                - `languages` · list
                  "List of OCR languages or scripts to use."
                  - `OcrLanguageOrScript` · union · required
                    "Either a specific language or a script for OCR."
                    - `language` · object
                      "Wrapper for an OCR language."
                      - `language` · enum · required
                        one of `AFR`, `AMH`, `ARA`, `ASM`, `AZE`, `AZE_CYRL`, `BEL`, `BEN`, `BOD`, `BOS`, `BRE`, `BUL`, `CAT`, `CEB`, `CES`, `CHI_SIM`, `CHI_SIM_VERT`, `CHI_TRA`, `CHI_TRA_VERT`, `CHR`, `COS`, `CYM`, `DAN`, `DEU`, `DIV`, `DZO`, `ELL`, `ENG`, `ENM`, `EPO`, `EST`, `EUS`, `FAO`, `FAS`, `FIL`, `FIN`, `FRA`, `FRM`, `FRY`, `GLA`, `GLE`, `GLG`, `GRC`, `GUJ`, `HAT`, `HEB`, `HIN`, `HRV`, `HUN`, `HYE`, `IKU`, `IND`, `ISL`, `ITA`, `ITA_OLD`, `JAV`, `JPN`, `JPN_VERT`, `KAN`, `KAT`, `KAT_OLD`, `KAZ`, `KHM`, `KIR`, `KMR`, `KOR`, `KOR_VERT`, `LAO`, `LAT`, `LAV`, `LIT`, `LTZ`, `MAL`, `MAR`, `MKD`, `MLT`, `MON`, `MRI`, `MSA`, `MYA`, `NEP`, `NLD`, `NOR`, `OCI`, `ORI`, `OSD`, `PAN`, `POL`, `POR`, `PUS`, `QUE`, `RON`, `RUS`, `SAN`, `SIN`, `SLK`, `SLV`, `SND`, `SPA`, `SPA_OLD`, `SQI`, `SRP`, `SRP_LATN`, `SUN`, `SWA`, `SWE`, `SYR`, `TAM`, `TAT`, `TEL`, `TGK`, `THA`, `TIR`, `TON`, `TUR`, `UIG`, `UKR`, `URD`, `UZB`, `UZB_CYRL`, `VIE`, `YID`, `YOR`
                        "Language codes for OCR."
                    - `script` · object
                      "Wrapper for an OCR script."
                      - `script` · enum · required
                        one of `ARABIC`, `ARMENIAN`, `BENGALI`, `CANADIAN_ABORIGINAL`, `CHEROKEE`, `CYRILLIC`, `DEVANAGARI`, `ETHIOPIC`, `FRAKTUR`, `GEORGIAN`, `GREEK`, `GUJARATI`, `GURMUKHI`, `HAN_SIMPLIFIED`, `HAN_SIMPLIFIED_VERT`, `HAN_TRADITIONAL`, `HAN_TRADITIONAL_VERT`, `HANGUL`, `HANGUL_VERT`, `HEBREW`, `JAPANESE`, `JAPANESE_VERT`, `KANNADA`, `KHMER`, `LAO`, `LATIN`, `MALAYALAM`, `MYANMAR`, `ORIYA`, `SINHALA`, `SYRIAC`, `TAMIL`, `TELUGU`, `THAANA`, `THAI`, `TIBETAN`, `VIETNAMESE`
                        "Script codes for OCR."
          - `imageSpec` · object
            "Specification for image processing parameters used in vision-based extraction. Controls how document pages are converted to images before being sent to vision models."
            - `resizingMode` · enum · required
              one of `RESIZING`, `FIT_INTO_BOUNDING_BOX`
              "Image resizing strategy."
            - `height` · integer
              "Target height in pixels."
            - `width` · integer
              "Target width in pixels."
            - `mimeType` · enum · required
              one of `BMP`, `TIFF`, `NITF`, `JP2K`, `JPG`, `PNG`, `WEBP`
              "The format of an imagery media item."
          - `outputFormat` · enum · required
            one of `MARKDOWN`
            "Format in which to return text extracted by vision language models."
          - `pageRange` · object
            "Page range for document extraction."
            - `startPageInclusive` · integer
              "Start page index (0-based, inclusive). If not provided, defaults to start of document."
            - `endPageExclusive` · integer
              "End page index (0-based, exclusive). If not provided, defaults to end of document."
        - `extractTextFromPagesToArray` · object
          "Extracts text from multiple pages into a list of strings."
          - `startPage` · integer
            "The zero-indexed start page. Defaults to the first page if not specified."
          - `endPage` · integer
            "The zero-indexed end page (inclusive). Defaults to the last page if not specified."
        - `ocrOnPage` · object
          "Performs OCR (Optical Character Recognition) on a specific page of a document."
          - `pageNumber` · integer · required
            "The page number to perform OCR on."
          - `parameters` · object · required
            "Parameters for OCR (Optical Character Recognition) operations."
            - `outputFormat` · union · required
              "The output format for OCR results."
              - `hocr` · object
                "hOCR (HTML-based OCR) output format."
              - `text` · object
                "Plain text output format for OCR."
            - `languages` · list
              "The languages or scripts to use for OCR."
              - `OcrLanguageOrScript` · union · required
                "Either a specific language or a script for OCR."
                - `language` · object
                  "Wrapper for an OCR language."
                  - `language` · enum · required
                    one of `AFR`, `AMH`, `ARA`, `ASM`, `AZE`, `AZE_CYRL`, `BEL`, `BEN`, `BOD`, `BOS`, `BRE`, `BUL`, `CAT`, `CEB`, `CES`, `CHI_SIM`, `CHI_SIM_VERT`, `CHI_TRA`, `CHI_TRA_VERT`, `CHR`, `COS`, `CYM`, `DAN`, `DEU`, `DIV`, `DZO`, `ELL`, `ENG`, `ENM`, `EPO`, `EST`, `EUS`, `FAO`, `FAS`, `FIL`, `FIN`, `FRA`, `FRM`, `FRY`, `GLA`, `GLE`, `GLG`, `GRC`, `GUJ`, `HAT`, `HEB`, `HIN`, `HRV`, `HUN`, `HYE`, `IKU`, `IND`, `ISL`, `ITA`, `ITA_OLD`, `JAV`, `JPN`, `JPN_VERT`, `KAN`, `KAT`, `KAT_OLD`, `KAZ`, `KHM`, `KIR`, `KMR`, `KOR`, `KOR_VERT`, `LAO`, `LAT`, `LAV`, `LIT`, `LTZ`, `MAL`, `MAR`, `MKD`, `MLT`, `MON`, `MRI`, `MSA`, `MYA`, `NEP`, `NLD`, `NOR`, `OCI`, `ORI`, `OSD`, `PAN`, `POL`, `POR`, `PUS`, `QUE`, `RON`, `RUS`, `SAN`, `SIN`, `SLK`, `SLV`, `SND`, `SPA`, `SPA_OLD`, `SQI`, `SRP`, `SRP_LATN`, `SUN`, `SWA`, `SWE`, `SYR`, `TAM`, `TAT`, `TEL`, `TGK`, `THA`, `TIR`, `TON`, `TUR`, `UIG`, `UKR`, `URD`, `UZB`, `UZB_CYRL`, `VIE`, `YID`, `YOR`
                    "Language codes for OCR."
                - `script` · object
                  "Wrapper for an OCR script."
                  - `script` · enum · required
                    one of `ARABIC`, `ARMENIAN`, `BENGALI`, `CANADIAN_ABORIGINAL`, `CHEROKEE`, `CYRILLIC`, `DEVANAGARI`, `ETHIOPIC`, `FRAKTUR`, `GEORGIAN`, `GREEK`, `GUJARATI`, `GURMUKHI`, `HAN_SIMPLIFIED`, `HAN_SIMPLIFIED_VERT`, `HAN_TRADITIONAL`, `HAN_TRADITIONAL_VERT`, `HANGUL`, `HANGUL_VERT`, `HEBREW`, `JAPANESE`, `JAPANESE_VERT`, `KANNADA`, `KHMER`, `LAO`, `LATIN`, `MALAYALAM`, `MYANMAR`, `ORIYA`, `SINHALA`, `SYRIAC`, `TAMIL`, `TELUGU`, `THAANA`, `THAI`, `TIBETAN`, `VIETNAMESE`
                    "Script codes for OCR."
        - `extractFormFields` · object
          "Extracts form field data from a PDF document."
        - `extractLayoutAwareTextV2` · object
          "Extract layout aware text with bounding boxes across all pages using the v2 text extraction endpoint. This only supports PDFs."
          - `pageRange` · object
            "Page range for document extraction."
            - `startPageInclusive` · integer
              "Start page index (0-based, inclusive). If not provided, defaults to start of document."
            - `endPageExclusive` · integer
              "End page index (0-based, exclusive). If not provided, defaults to end of document."
          - `config` · object · required
            "Configuration for v2 layout-aware document text extraction."
            - `format` · enum
              one of `TEXT`, `MARKDOWN`, `HTML`
              "Format in which to return extracted text."
            - `mode` · enum
              one of `AUTO`, `ELECTRONIC`, `SCAN`
              "OCR mode for document extraction."
            - `languages` · list
              "List of OCR languages or scripts to use."
              - `OcrLanguageOrScript` · union · required
                "Either a specific language or a script for OCR."
                - `language` · object
                  "Wrapper for an OCR language."
                  - `language` · enum · required
                    one of `AFR`, `AMH`, `ARA`, `ASM`, `AZE`, `AZE_CYRL`, `BEL`, `BEN`, `BOD`, `BOS`, `BRE`, `BUL`, `CAT`, `CEB`, `CES`, `CHI_SIM`, `CHI_SIM_VERT`, `CHI_TRA`, `CHI_TRA_VERT`, `CHR`, `COS`, `CYM`, `DAN`, `DEU`, `DIV`, `DZO`, `ELL`, `ENG`, `ENM`, `EPO`, `EST`, `EUS`, `FAO`, `FAS`, `FIL`, `FIN`, `FRA`, `FRM`, `FRY`, `GLA`, `GLE`, `GLG`, `GRC`, `GUJ`, `HAT`, `HEB`, `HIN`, `HRV`, `HUN`, `HYE`, `IKU`, `IND`, `ISL`, `ITA`, `ITA_OLD`, `JAV`, `JPN`, `JPN_VERT`, `KAN`, `KAT`, `KAT_OLD`, `KAZ`, `KHM`, `KIR`, `KMR`, `KOR`, `KOR_VERT`, `LAO`, `LAT`, `LAV`, `LIT`, `LTZ`, `MAL`, `MAR`, `MKD`, `MLT`, `MON`, `MRI`, `MSA`, `MYA`, `NEP`, `NLD`, `NOR`, `OCI`, `ORI`, `OSD`, `PAN`, `POL`, `POR`, `PUS`, `QUE`, `RON`, `RUS`, `SAN`, `SIN`, `SLK`, `SLV`, `SND`, `SPA`, `SPA_OLD`, `SQI`, `SRP`, `SRP_LATN`, `SUN`, `SWA`, `SWE`, `SYR`, `TAM`, `TAT`, `TEL`, `TGK`, `THA`, `TIR`, `TON`, `TUR`, `UIG`, `UKR`, `URD`, `UZB`, `UZB_CYRL`, `VIE`, `YID`, `YOR`
                    "Language codes for OCR."
                - `script` · object
                  "Wrapper for an OCR script."
                  - `script` · enum · required
                    one of `ARABIC`, `ARMENIAN`, `BENGALI`, `CANADIAN_ABORIGINAL`, `CHEROKEE`, `CYRILLIC`, `DEVANAGARI`, `ETHIOPIC`, `FRAKTUR`, `GEORGIAN`, `GREEK`, `GUJARATI`, `GURMUKHI`, `HAN_SIMPLIFIED`, `HAN_SIMPLIFIED_VERT`, `HAN_TRADITIONAL`, `HAN_TRADITIONAL_VERT`, `HANGUL`, `HANGUL_VERT`, `HEBREW`, `JAPANESE`, `JAPANESE_VERT`, `KANNADA`, `KHMER`, `LAO`, `LATIN`, `MALAYALAM`, `MYANMAR`, `ORIYA`, `SINHALA`, `SYRIAC`, `TAMIL`, `TELUGU`, `THAANA`, `THAI`, `TIBETAN`, `VIETNAMESE`
                    "Script codes for OCR."
        - `extractTextV2` · object
          "Extract text across all pages using the v2 text extraction endpoint with per page text. This only supports PDFs."
          - `pageRange` · object
            "Page range for document extraction."
            - `startPageInclusive` · integer
              "Start page index (0-based, inclusive). If not provided, defaults to start of document."
            - `endPageExclusive` · integer
              "End page index (0-based, exclusive). If not provided, defaults to end of document."
          - `config` · object · required
            "Configuration for v2 document text extraction."
            - `format` · enum
              one of `TEXT`, `MARKDOWN`, `HTML`
              "Format in which to return extracted text."
            - `mode` · enum
              one of `AUTO`, `ELECTRONIC`, `SCAN`
              "OCR mode for document extraction."
            - `languages` · list
              "List of OCR languages or scripts to use."
              - `OcrLanguageOrScript` · union · required
                "Either a specific language or a script for OCR."
                - `language` · object
                  "Wrapper for an OCR language."
                  - `language` · enum · required
                    one of `AFR`, `AMH`, `ARA`, `ASM`, `AZE`, `AZE_CYRL`, `BEL`, `BEN`, `BOD`, `BOS`, `BRE`, `BUL`, `CAT`, `CEB`, `CES`, `CHI_SIM`, `CHI_SIM_VERT`, `CHI_TRA`, `CHI_TRA_VERT`, `CHR`, `COS`, `CYM`, `DAN`, `DEU`, `DIV`, `DZO`, `ELL`, `ENG`, `ENM`, `EPO`, `EST`, `EUS`, `FAO`, `FAS`, `FIL`, `FIN`, `FRA`, `FRM`, `FRY`, `GLA`, `GLE`, `GLG`, `GRC`, `GUJ`, `HAT`, `HEB`, `HIN`, `HRV`, `HUN`, `HYE`, `IKU`, `IND`, `ISL`, `ITA`, `ITA_OLD`, `JAV`, `JPN`, `JPN_VERT`, `KAN`, `KAT`, `KAT_OLD`, `KAZ`, `KHM`, `KIR`, `KMR`, `KOR`, `KOR_VERT`, `LAO`, `LAT`, `LAV`, `LIT`, `LTZ`, `MAL`, `MAR`, `MKD`, `MLT`, `MON`, `MRI`, `MSA`, `MYA`, `NEP`, `NLD`, `NOR`, `OCI`, `ORI`, `OSD`, `PAN`, `POL`, `POR`, `PUS`, `QUE`, `RON`, `RUS`, `SAN`, `SIN`, `SLK`, `SLV`, `SND`, `SPA`, `SPA_OLD`, `SQI`, `SRP`, `SRP_LATN`, `SUN`, `SWA`, `SWE`, `SYR`, `TAM`, `TAT`, `TEL`, `TGK`, `THA`, `TIR`, `TON`, `TUR`, `UIG`, `UKR`, `URD`, `UZB`, `UZB_CYRL`, `VIE`, `YID`, `YOR`
                    "Language codes for OCR."
                - `script` · object
                  "Wrapper for an OCR script."
                  - `script` · enum · required
                    one of `ARABIC`, `ARMENIAN`, `BENGALI`, `CANADIAN_ABORIGINAL`, `CHEROKEE`, `CYRILLIC`, `DEVANAGARI`, `ETHIOPIC`, `FRAKTUR`, `GEORGIAN`, `GREEK`, `GUJARATI`, `GURMUKHI`, `HAN_SIMPLIFIED`, `HAN_SIMPLIFIED_VERT`, `HAN_TRADITIONAL`, `HAN_TRADITIONAL_VERT`, `HANGUL`, `HANGUL_VERT`, `HEBREW`, `JAPANESE`, `JAPANESE_VERT`, `KANNADA`, `KHMER`, `LAO`, `LATIN`, `MALAYALAM`, `MYANMAR`, `ORIYA`, `SINHALA`, `SYRIAC`, `TAMIL`, `TELUGU`, `THAANA`, `THAI`, `TIBETAN`, `VIETNAMESE`
                    "Script codes for OCR."
        - `extractUnstructuredTextFromPage` · object
          "Extracts unstructured text from a specified page."
          - `pageNumber` · integer · required
            "The page number."
        - `extractLayoutAwareContent` · object
          "Extracts content from a document with layout information preserved."
          - `parameters` · object · required
            "Parameters for layout-aware content extraction."
            - `languages` · list
              "The languages to use for extraction."
              - `OcrLanguage` · enum · required
                one of `AFR`, `AMH`, `ARA`, `ASM`, `AZE`, `AZE_CYRL`, `BEL`, `BEN`, `BOD`, `BOS`, `BRE`, `BUL`, `CAT`, `CEB`, `CES`, `CHI_SIM`, `CHI_SIM_VERT`, `CHI_TRA`, `CHI_TRA_VERT`, `CHR`, `COS`, `CYM`, `DAN`, `DEU`, `DIV`, `DZO`, `ELL`, `ENG`, `ENM`, `EPO`, `EST`, `EUS`, `FAO`, `FAS`, `FIL`, `FIN`, `FRA`, `FRM`, `FRY`, `GLA`, `GLE`, `GLG`, `GRC`, `GUJ`, `HAT`, `HEB`, `HIN`, `HRV`, `HUN`, `HYE`, `IKU`, `IND`, `ISL`, `ITA`, `ITA_OLD`, `JAV`, `JPN`, `JPN_VERT`, `KAN`, `KAT`, `KAT_OLD`, `KAZ`, `KHM`, `KIR`, `KMR`, `KOR`, `KOR_VERT`, `LAO`, `LAT`, `LAV`, `LIT`, `LTZ`, `MAL`, `MAR`, `MKD`, `MLT`, `MON`, `MRI`, `MSA`, `MYA`, `NEP`, `NLD`, `NOR`, `OCI`, `ORI`, `OSD`, `PAN`, `POL`, `POR`, `PUS`, `QUE`, `RON`, `RUS`, `SAN`, `SIN`, `SLK`, `SLV`, `SND`, `SPA`, `SPA_OLD`, `SQI`, `SRP`, `SRP_LATN`, `SUN`, `SWA`, `SWE`, `SYR`, `TAM`, `TAT`, `TEL`, `TGK`, `THA`, `TIR`, `TON`, `TUR`, `UIG`, `UKR`, `URD`, `UZB`, `UZB_CYRL`, `VIE`, `YID`, `YOR`
                "Language codes for OCR."
        - `ocrOnPages` · object
          "Creates access patterns for OCR across pages of a document."
          - `parameters` · object · required
            "Parameters for OCR (Optical Character Recognition) operations."
            - `outputFormat` · union · required
              "The output format for OCR results."
              - `hocr` · object
                "hOCR (HTML-based OCR) output format."
              - `text` · object
                "Plain text output format for OCR."
            - `languages` · list
              "The languages or scripts to use for OCR."
              - `OcrLanguageOrScript` · union · required
                "Either a specific language or a script for OCR."
                - `language` · object
                  "Wrapper for an OCR language."
                  - `language` · enum · required
                    one of `AFR`, `AMH`, `ARA`, `ASM`, `AZE`, `AZE_CYRL`, `BEL`, `BEN`, `BOD`, `BOS`, `BRE`, `BUL`, `CAT`, `CEB`, `CES`, `CHI_SIM`, `CHI_SIM_VERT`, `CHI_TRA`, `CHI_TRA_VERT`, `CHR`, `COS`, `CYM`, `DAN`, `DEU`, `DIV`, `DZO`, `ELL`, `ENG`, `ENM`, `EPO`, `EST`, `EUS`, `FAO`, `FAS`, `FIL`, `FIN`, `FRA`, `FRM`, `FRY`, `GLA`, `GLE`, `GLG`, `GRC`, `GUJ`, `HAT`, `HEB`, `HIN`, `HRV`, `HUN`, `HYE`, `IKU`, `IND`, `ISL`, `ITA`, `ITA_OLD`, `JAV`, `JPN`, `JPN_VERT`, `KAN`, `KAT`, `KAT_OLD`, `KAZ`, `KHM`, `KIR`, `KMR`, `KOR`, `KOR_VERT`, `LAO`, `LAT`, `LAV`, `LIT`, `LTZ`, `MAL`, `MAR`, `MKD`, `MLT`, `MON`, `MRI`, `MSA`, `MYA`, `NEP`, `NLD`, `NOR`, `OCI`, `ORI`, `OSD`, `PAN`, `POL`, `POR`, `PUS`, `QUE`, `RON`, `RUS`, `SAN`, `SIN`, `SLK`, `SLV`, `SND`, `SPA`, `SPA_OLD`, `SQI`, `SRP`, `SRP_LATN`, `SUN`, `SWA`, `SWE`, `SYR`, `TAM`, `TAT`, `TEL`, `TGK`, `THA`, `TIR`, `TON`, `TUR`, `UIG`, `UKR`, `URD`, `UZB`, `UZB_CYRL`, `VIE`, `YID`, `YOR`
                    "Language codes for OCR."
                - `script` · object
                  "Wrapper for an OCR script."
                  - `script` · enum · required
                    one of `ARABIC`, `ARMENIAN`, `BENGALI`, `CANADIAN_ABORIGINAL`, `CHEROKEE`, `CYRILLIC`, `DEVANAGARI`, `ETHIOPIC`, `FRAKTUR`, `GEORGIAN`, `GREEK`, `GUJARATI`, `GURMUKHI`, `HAN_SIMPLIFIED`, `HAN_SIMPLIFIED_VERT`, `HAN_TRADITIONAL`, `HAN_TRADITIONAL_VERT`, `HANGUL`, `HANGUL_VERT`, `HEBREW`, `JAPANESE`, `JAPANESE_VERT`, `KANNADA`, `KHMER`, `LAO`, `LATIN`, `MALAYALAM`, `MYANMAR`, `ORIYA`, `SINHALA`, `SYRIAC`, `TAMIL`, `TELUGU`, `THAANA`, `THAI`, `TIBETAN`, `VIETNAMESE`
                    "Script codes for OCR."
          - `pageNumber` · integer · required
            "The page number."

## Response

- `TransformMediaItemResponse` · object · required
  "The transformation was initiated successfully."
  - `status` · enum · required
    one of `PENDING`, `FAILED`, `SUCCESSFUL`
    "The status of a transformation job."
  - `jobId` · string · required
    "An identifier for a media item transformation job."
