<!-- source: https://palantir.com/docs/foundry/questions-answers/media-sets/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Media Sets

### How can I manage large datasets in Foundry without duplicating data when Foundry does not support views for media sets?

In Foundry, to manage large datasets efficiently without duplicating data, you can use the `fast_copy_media_item()` method on the output when copying items from one media set to another. Copying a reference to the same media blob rather than duplicating the blob itself is faster and more efficient option than downloading and re-uploading the media item.

*Timestamp:* April 13, 2024

### What could be causing the `MediaSet: TooManyItemsUploadedInTransaction` error while trying to upload large number of files to a media set? And how can it be fixed?

The `MediaSet: TooManyItemsUploadedInTransaction` occurs because there is a limit of 10,000 files that can be written to a media set in a single transaction. The solutions are:

* Use a transaction-less media set where the restriction does not apply (note that this has side effects such as inability to fail a transaction or snapshot the media set); or
* Break up the items into sets of 10,000 or fewer and write one set per build.

*Timestamp:* March 6, 2024

### How can I read from or write to transactionless mediasets via transforms without encountering the 'MediaSet:CannotSnapshotNonTransactionalMediaSet' error?

You can read from or write to transactionless mediasets by altering the argument of the media output to `media_output=MediaSetOutput(should_snapshot=False)`. This prevents the system from attempting to snapshot the output, which is not supported for non-transactional media sets. Additionally, incremental pipelines should work the same as transaction media sets for inputs.

*Timestamp:* March 18, 2024

### How can I extract the raw image from a dataset with a mediaReference column?

Add the media set as an input to the build so that the build-token has permission to read from it, then use the method `media_input.get_media_item_by_path()` to read values from it.

*Timestamp:* March 6, 2024

### Is it possible to use the `Extract Text from PDF` pipeline expression with a dataset of files that is not a media set?

This is not possible because the pipeline board only works on items in a media set. This also applies to media references produced by the **Get media references (datasets)** transform, since these reference files in a dataset rather than items in a media set. Learn more about the [two types of media references](/docs/foundry/media-sets-advanced-formats/media-overview/#media-reference-types).

*Timestamp:* March 6, 2024

### How do I create a media set from a source, such as SMB, that does not support a native media set sync?

Sync your files into a regular dataset, then write a [Python transform](/docs/foundry/transforms-python/media-sets/) that reads the dataset and writes the files to a `MediaSetOutput`. See the [SMB connector documentation](/docs/foundry/available-connectors/smb/#read-files-from-smb-and-upload-as-media-sets) for a complete example. Media references produced directly from the dataset (without creating a media set) cannot be used with media transforms and expressions in Pipeline Builder.

*Timestamp:* July 14, 2026

### How do I connect media items from a media reference dataset to the actual object?

The media items in a media reference dataset can be linked to the respective objects from the Capabilities section of the object type in Ontology Manager.

*Timestamp:* March 6, 2024

### Is it possible to write to a media reference property on an object using an action?

Yes, it is possible to write to a media reference property in a function, in the same way that other object properties can be written to in functions. An action can be configured to run this function.

*Timestamp:* November 1, 2024

### When media sets are packaged in Marketplace, which branch is selected?

When packaging media sets in the marketplace, the 'default' branch is selected. Currently, it is not possible to select a different branch to be packaged. The branch name is preserved during packaging and installing.

*Timestamp:* April 16, 2024

### Is there support for the bulk upload of media items via widgets from Workshop?

There is no bulk upload workflow for media items in Workshop at this moment.

*Timestamp:* April 18, 2024
