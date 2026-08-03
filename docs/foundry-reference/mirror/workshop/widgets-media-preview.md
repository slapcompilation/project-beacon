<!-- source: https://palantir.com/docs/foundry/workshop/widgets-media-preview/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Media Preview

The Media Preview widget can be used to display image, audio, video, and document media, given a supported media source. Currently supported media sources include media URLs, attachment properties, and media reference properties.

## Configuration Options

* Media string
  * Media string options support images referenced in the following three formats to render a preview of the media:
    * Blobster RID, for example, `ri.blobster.main.image.ab1c23d4-56ef-789g-h012-3456ij78k90l`.
    * Media URL
      * If referencing a media URL from a media set, the URL should be of the format: `https://{my-foundry-url}/mio/api/media-set/{media set rid}/items/{media item rid}`.
      * If referencing a media URL from a dataset, the URL should be of the format: `https://{my-foundry-url}/foundry-data-proxy/api/web/dataproxy/datasets/{dataset rid}/transactions/{transaction rid}/{filename}` or `https://{my-foundry-url}/foundry-data-proxy/api/web/dataproxy/datasets/{dataset rid}/views/{branch name}/{filename}`.
      * If referencing an external media URL, ensure access has been configured in your enrollment’s [Content Security Policy](/docs/foundry/administration/embed-foundry-externally/) settings.
    * Data URL with a Base64-encoded media, for example, `data:image/png;base64,{base64-encoded image}`.
* Attachment property
  * Define an object set with a single object and select the attachment typed property to render a preview of the media for that object.
* Media reference property
  * Define an object set with a single object and select the [media reference](/docs/foundry/media-sets-advanced-formats/media-overview/#media-references) typed property to render a preview of the media for that object.

## Specialized media preview widgets

The media preview widget displays all types of media, whereas the specialized media preview widgets listed below can only display a specific type of media, but provide additional functionality for their specific media type.

* [PDF Viewer Widget](/docs/foundry/workshop/widgets-pdf-viewer/)
  * Supports display of annotations and provides other additional configuration options.
* [Video Display Widget](/docs/foundry/workshop/widgets-video-preview/)
  * Supports additional video specific configuration, such as jumping to specific frames, as well as scrubbing/seeking to move to a specific timestamp.
* [Audio and Transcription Display widget](/docs/foundry/workshop/widgets-audio-preview/)
  * Supports additional audio specific configuration, such as scrubbing/seeking to move to a specific timestamp, as well as transcription display and interaction.
