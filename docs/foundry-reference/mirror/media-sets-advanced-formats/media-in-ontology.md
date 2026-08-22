<!-- source: https://palantir.com/docs/foundry/media-sets-advanced-formats/media-in-ontology/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Using media in the Ontology

## Ontologize media using media references

Use [media reference object properties](/docs/foundry/object-link-types/base-types/#media-references) to efficiently display your media in applications that build on the ontology. Optimizations include faster and interactive previews in Workshop or Object Explorer, as well as tiling for geospatial imagery in Map.

## Custom logic using media reference properties

Use objects with media reference object properties in [functions on objects](/docs/foundry/functions/media/).

You can read the raw media item directly. Additionally, you can perform common type-specific operations on the media item, such as:

* OCR on documents
* text extraction from documents
* audio transcription
* read media item metadata

## Leveraging media with OSDK

If you are building applications with Foundry as the backend, you can leverage the [media capabilities in OSDK](/docs/foundry/media-sets-advanced-formats/use-media-in-osdk/).

## Considerations for use

* Media files uploaded in action forms are only uploaded to the backing media set upon successful form submission, to ensure that canceled or failed submissions do not result in orphaned media files in media sets.
* Media reference lists are not supported as a property type on an object.
