<!-- source: https://palantir.com/docs/foundry/api/v2/media-sets-v2-resources/media-sets/get-media-item-metadata/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Media Item Metadata

`GET /api/v2/mediasets/{mediaSetRid}/items/{mediaItemRid}/metadata`

Gets detailed metadata about the media item, including type-specific information
such as dimensions for images, duration for audio/video, page count for documents, etc.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:mediasets-read`.

Scopes: `api:mediasets-read`

## Path parameters

- `mediaSetRid` · string · required
  "The RID of the media set."
- `mediaItemRid` · string · required
  "The RID of the media item."

## Response

- `MediaItemMetadata` · union · required
  "Detailed metadata about a media item, including type-specific information such as dimensions for images, duration for audio/video, page count for documents, etc."
  - `cad` · object
    "Metadata for CAD media items."
    - `format` · enum · required
      one of `STEP`
      "The format of a CAD media item."
    - `sizeBytes` · integer · required
      "The size of the media item in bytes."
    - `units` · object
      "Units declared in a CAD file."
      - `lengthUnit` · string
        "Raw declared length unit name, for example MILLIMETRE, METRE, INCH, or FOOT. Consumers should match case-insensitively and tolerate unknown values."
  - `document` · object
    "Metadata for document media items."
    - `format` · enum · required
      one of `PDF`, `DOC`, `DOCX`, `TXT`, `PPTX`, `RTF`
      "The format of a document media item."
    - `pages` · integer
      "The number of pages in the document."
    - `sizeBytes` · integer · required
      "The size of the media item in bytes."
    - `title` · string
      "The title of the document, if available."
    - `author` · string
      "The author of the document, if available."
  - `imagery` · object
    "Metadata for imagery (image) media items."
    - `format` · enum · required
      one of `BMP`, `TIFF`, `NITF`, `JP2K`, `JPG`, `PNG`, `WEBP`
      "The format of an imagery media item."
    - `dimensions` · object
      "The dimensions of an image."
      - `width` · integer · required
        "The width of the image in pixels."
      - `height` · integer · required
        "The height of the image in pixels."
    - `bands` · list
      "Information about the bands of the image, if available."
      - `BandInfo` · object · required
        "Information about a band in an image."
        - `dataType` · enum
          one of `UNDEFINED`, `BYTE`, `UINT16`, `INT16`, `UINT32`, `INT32`, `FLOAT32`, `FLOAT64`, `COMPLEX_INT16`, `COMPLEX_INT32`, `COMPLEX_FLOAT32`, `COMPLEX_FLOAT64`, `UINT64`, `INT64`, `INT8`
          "The data type of a band."
        - `colorInterpretation` · enum
          one of `UNDEFINED`, `GRAY`, `PALETTE_INDEX`, `RED`, `GREEN`, `BLUE`, `ALPHA`, `HUE`, `SATURATION`, `LIGHTNESS`, `CYAN`, `MAGENTA`, `YELLOW`, `BLACK`, `Y_CB_CR_SPACE_Y`, `Y_CB_CR_SPACE_CB`, `Y_CB_CR_SPACE_CR`
          "The color interpretation of a band."
        - `paletteInterpretation` · enum
          one of `GRAY`, `RGB`, `RGBA`, `CMYK`, `HLS`
          "The palette interpretation of a band."
        - `unitInterpretation` · object
          "The unit interpretation for a band."
          - `unit` · string
          - `scale` · number
          - `offset` · number
    - `attributes` · map
      "The metadata attributes described in the image header in the form of a map <domain, <key, value>>. For the default domain, or when the domain is not specified, the domain key will be the empty string ("")."
      - `ImageAttributeDomain` · string · required
        "The domain of an image attribute."
      - `map` · map · required
        - `ImageAttributeKey` · string · required
          "The key of an image attribute within a domain."
    - `iccProfile` · string
      "The base64-encoded ICC profile for the image, if available."
    - `geo` · object
      "Embedded geo-referencing data for an image."
      - `crs` · object
        "The coordinate reference system for geo-referenced imagery."
        - `wkt` · string
          "The Well-Known Text representation of the CRS."
      - `geotransform` · object
        "An affine transformation for geo-referencing."
        - `xTranslate` · number
        - `xScale` · number
        - `xShear` · number
        - `yTranslate` · number
        - `yShear` · number
        - `yScale` · number
      - `gcpInfo` · object
        "A list of ground control points for geo-referencing."
        - `gcps` · list
          - `GroundControlPoint` · object · required
            "A ground control point for geo-referencing."
            - `pixX` · number
              "The pixel X coordinate."
            - `pixY` · number
              "The pixel Y coordinate."
            - `projX` · number
              "The projected X coordinate."
            - `projY` · number
              "The projected Y coordinate."
            - `projZ` · number
              "The projected Z coordinate."
      - `gpsData` · object
        "GPS location metadata extracted from EXIF data embedded in the image."
        - `latitude` · number
        - `longitude` · number
        - `altitude` · number
    - `pages` · integer
      "The number of pages associated with this image. Usually 1, but may be more for some formats (multi-page TIFFs, for example)."
    - `orientation` · object
      "The orientation information as encoded in EXIF metadata."
      - `rotationAngle` · enum
        one of `DEGREE_90`, `DEGREE_180`, `DEGREE_270`, `UNKNOWN`
        "The rotation angle from EXIF orientation."
      - `flipAxis` · enum
        one of `HORIZONTAL`, `VERTICAL`, `UNKNOWN`
        "The flip axis from EXIF orientation."
    - `sizeBytes` · integer · required
      "The size of the media item in bytes."
  - `spreadsheet` · object
    "Metadata for spreadsheet media items."
    - `format` · enum · required
      one of `CSV`, `XLSX`
      "The format of a spreadsheet media item."
    - `sheetNames` · list
      "The names of the sheets in the spreadsheet."
    - `sizeBytes` · integer · required
      "The size of the media item in bytes."
    - `title` · string
      "The title of the spreadsheet, if available."
    - `author` · string
      "The author of the spreadsheet, if available."
  - `untyped` · object
    "Metadata for untyped media items (media items without a recognized type)."
    - `sizeBytes` · integer · required
      "The size of the media item in bytes."
  - `audio` · object
    "Metadata for audio media items."
    - `format` · enum · required
      one of `FLAC`, `MP2`, `MP3`, `MP4`, `NIST_SPHERE`, `OGG`, `WAV`, `WEBM`
      "The format of an audio media item."
    - `specification` · object · required
      "Technical specifications for audio media items."
      - `bitRate` · integer · required
        "Approximate (average) bits per second of the audio, rounded up in case of a fractional average bits per second."
      - `durationSeconds` · number · required
        "Approximate duration of the audio, in seconds with up to two decimal digits (rounded up)."
      - `numberOfChannels` · integer
        "Number of audio channels in the audio stream."
    - `sizeBytes` · integer · required
      "The size of the media item in bytes."
  - `model3d` · object
    "Metadata for 3D model media items."
    - `format` · enum · required
      one of `LAS`, `PLY`, `OBJ`
      "The format of a 3D model media item."
    - `modelType` · enum · required
      one of `POINT_CLOUD`, `MESH`
      "The type of 3D model representation."
    - `sizeBytes` · integer · required
      "The size of the media item in bytes."
  - `video` · object
    "Metadata for video media items."
    - `format` · enum · required
      one of `MP4`, `MKV`, `MOV`, `TS`, `WEBM`
      "The format of a video media item."
    - `specification` · object · required
      "Technical specifications for video media items."
      - `bitRate` · integer · required
        "Approximate (average) bits per second of the video, rounded up in case of a fractional average bits per second."
      - `durationSeconds` · number · required
        "Approximate duration of the video, in seconds with up to two decimal digits (rounded up)."
    - `sizeBytes` · integer · required
      "The size of the media item in bytes."
  - `dicom` · object
    "Metadata for DICOM (Digital Imaging and Communications in Medicine) media items."
    - `metaInformation` · union · required
      "DICOM meta information."
      - `v1` · object
        "DICOM meta information version 1."
        - `mediaStorageSop` · string · required
          "The Media Storage SOP (Service-Object Pair) Class UID, which identifies the type of DICOM object stored (e.g., CT Image, MR Image)."
        - `mediaStorageSopInstance` · string · required
          "The Media Storage SOP Instance UID."
        - `transferSyntax` · string · required
          "The Transfer Syntax UID, which specifies how the DICOM data is encoded (e.g., compression method, byte ordering)."
    - `mediaType` · enum · required
      one of `IMAGE`, `MULTI_FRAME_IMAGE`, `VIDEO`, `STRUCTURED_REPORT`
      "The type of DICOM media."
    - `commonDataElements` · object · required
      "Common DICOM data elements."
      - `numberFrames` · integer
        "The number of frames in the DICOM file."
      - `modality` · enum
        one of `AR`, `ASMT`, `AU`, `BDUS`, `BI`, `BMD`, `CR`, `CT`, `CTPROTOCOL`, `DG`, `DOC`, `DX`, `ECG`, `EPS`, `ES`, `FID`, `GM`, `HC`, `HD`, `IO`, `IOL`, `IVOCT`, `IVUS`, `KER`, `KO`, `LEN`, `LS`, `MG`, `MR`, `M3D`, `NM`, `OAM`, `OCT`, `OP`, `OPM`, `OPT`, `OPTBSV`, `OPTENF`, `OPV`, `OSS`, `OT`, `PLAN`, `PR`, `PT`, `PX`, `REG`, `RESP`, `RF`, `RG`, `RTDOSE`, `RTIMAGE`, `RTINTENT`, `RTPLAN`, `RTRAD`, `RTRECORD`, `RTSEGANN`, `RTSTRUCT`, `RWV`, `SEG`, `SM`, `SMR`, `SR`, `SRF`, `STAIN`, `TEXTUREMAP`, `TG`, `US`, `VA`, `XA`, `XC`, `AS`, `CD`, `CF`, `CP`, `CS`, `DD`, `DF`, `DM`, `DS`, `EC`, `FA`, `FS`, `LP`, `MA`, `MS`, `OPR`, `ST`, `VF`
        "DICOM modality code. A list of modalities and their meanings can be found in the DICOM specification. https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.7.3.html#sect_C.7.3.1.1.1"
      - `patientId` · string
        "The patient ID."
      - `studyId` · string
        "The study ID."
      - `studyUid` · string
        "The study UID."
      - `seriesUid` · string
        "The series UID."
      - `studyTime` · string
        "The study time."
      - `seriesTime` · string
        "The series time."
    - `otherDataElements` · map
      "The data elements for a particular DICOM file outside of the media contained within it and the data elements within the commonDataElements field."
      - `DicomDataElementKey` · string · required
        "The key of a DICOM data element."
    - `sizeBytes` · integer · required
      "The size of the media item in bytes."
  - `email` · object
    "Metadata for email media items."
    - `format` · enum · required
      one of `EML`
      "The format of an email media item."
    - `sizeBytes` · integer · required
      "The size of the media item in bytes."
    - `sender` · list
      "The sender(s) of the email."
      - `Mailbox` · object · required
        "An email mailbox with an optional display name and email address."
        - `displayName` · string
          "The display name of the mailbox."
        - `emailAddress` · string · required
          "The email address of the mailbox."
    - `date` · string · required
      "The date the email was sent."
    - `attachmentCount` · integer · required
      "The number of attachments in the email."
    - `to` · list
      "The recipient(s) of the email."
      - `MailboxOrGroup` · union · required
        "Either a mailbox or a group of mailboxes."
        - `mailbox` · object
          "A wrapper for a mailbox in the MailboxOrGroup union."
          - `mailbox` · object · required
            "An email mailbox with an optional display name and email address."
            - `displayName` · string
              "The display name of the mailbox."
            - `emailAddress` · string · required
              "The email address of the mailbox."
        - `group` · object
          "A wrapper for a group in the MailboxOrGroup union."
          - `group` · object · required
            "A named group of mailboxes."
            - `groupName` · string · required
              "The name of the group."
            - `mailboxes` · list
              "The mailboxes in the group."
              - `Mailbox` · object · required
                "An email mailbox with an optional display name and email address."
                - `displayName` · string
                  "The display name of the mailbox."
                - `emailAddress` · string · required
                  "The email address of the mailbox."
    - `cc` · list
      "The CC recipient(s) of the email."
      - `MailboxOrGroup` · union · required
        "Either a mailbox or a group of mailboxes."
        - `mailbox` · object
          "A wrapper for a mailbox in the MailboxOrGroup union."
          - `mailbox` · object · required
            "An email mailbox with an optional display name and email address."
            - `displayName` · string
              "The display name of the mailbox."
            - `emailAddress` · string · required
              "The email address of the mailbox."
        - `group` · object
          "A wrapper for a group in the MailboxOrGroup union."
          - `group` · object · required
            "A named group of mailboxes."
            - `groupName` · string · required
              "The name of the group."
            - `mailboxes` · list
              "The mailboxes in the group."
              - `Mailbox` · object · required
                "An email mailbox with an optional display name and email address."
                - `displayName` · string
                  "The display name of the mailbox."
                - `emailAddress` · string · required
                  "The email address of the mailbox."
    - `subject` · string
      "The subject of the email."
    - `attachments` · list
      "The attachments of the email."
      - `EmailAttachment` · object · required
        "Metadata about an email attachment."
        - `attachmentIndex` · integer · required
          "The index of the attachment in the email."
        - `fileName` · string
          "The file name of the attachment, if available."
        - `mimeType` · string · required
          "The verified MIME type of the attachment."
