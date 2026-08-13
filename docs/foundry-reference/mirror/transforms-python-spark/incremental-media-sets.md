<!-- source: https://palantir.com/docs/foundry/transforms-python-spark/incremental-media-sets/ · mirrored 2026-08-13 from Palantir Foundry docs -->

# Write incremental transforms with media sets

Media sets can be read from and written to incrementally. For an overview of incremental transforms and when to use them, see the [incremental overview](/docs/foundry/transforms-python/incremental-overview/) and [incremental reference](/docs/foundry/transforms-python/incremental-usage/).

To make your media transforms incremental, use the incremental decorator and set `v2_semantics=True`. If `v2_semantics` is not set, then media sets cannot be used incrementally.

```python
from transforms.api import transform, incremental
from transforms.mediasets import MediaSetInput, MediaSetOutput

@incremental(v2_semantics=True)
@transform(
    input_PNGs=MediaSetInput('/examples/input_PNGs'),
    output_PNGs=MediaSetOutput('/examples/output_PNGs'),
)
def upload_pngs(input_PNGs, output_PNGs):

    # Returns a dataframe that only includes the media items added since the last build
    listed_pngs = input_PNGs.dataframe()

    def fast_copy_media_item(row):
        output_PNGs.fast_copy_media_item(input_PNGs, row.media_item_rid, row.path)

    # Fast copies all of the items in `listed_pngs` into the output media set
    # These items will be appended to the output if this transform is running incrementally, or they will replace the
    # output if the transform is not running incrementally
    listed_pngs.foreach(fast_copy_media_item)
```

In the example above, the transform will write to `output_PNGs` using the `modify` [write mode](/docs/foundry/transforms-python/media-sets/#media-set-write-modes). Only the media items that have been added to the input media set since the last build will be processed. If the transform cannot run incrementally, the output will be written with the `replace` write mode and the entire input will be read. See below for requirements.

When `v2_semantics` is set to `True`, incremental media sets can be used in combination with any number of other incremental inputs and outputs. This includes datasets and virtual tables.

## Requirements for incremental computation

Every incremental input and output contributes to determining whether a transform can run incrementally. Refer to the [incremental transforms reference](/docs/foundry/transforms-python/incremental-usage/#requirements-for-incremental-computation) for more information on when a dataset will prevent a transform from running incrementally.

A **media set output** can prevent a transform from running incrementally when:

* It was most recently built in a different transform than the other outputs in a multi-output build.
* It is a transactional media set and was modified since the most recent build. This includes user uploads and deletions.

A **media set input** can prevent a transform from running incrementally when:

* The contents of the media set were replaced. For example, if it was written to using the `replace` write mode.

If the media set input is included as a `snapshot_input`, then it will not prevent the build from running incrementally, even if its contents are replaced. See the [documentation on snapshot inputs](/docs/foundry/transforms-python/incremental-usage/#snapshot-inputs).

Unlike datasets, path overwrites and media item deletions will *not* prevent a transform from running incrementally.

## Incremental read modes

In an incremental transform, media set inputs can be listed using one of three modes:

* **`added`:** Only the items added to the branch since the last build will be included.
* **`previous`:** Only the items in the branch that existed when the last build ran will be included.
* **`current`:** All items in the media set branch will be included.

The union of `added` and `previous` is always equal to `current`.

:::callout{theme="warning"}
If the transform is not running incrementally, for example, if the contents of the input were replaced since the last build, then a listing using the `previous` mode will be empty. The listing will not include the items that were present in the previous build.
:::

The default read mode is `added` when running incrementally, and `current` when not. However, the read mode can be specified using the `mode` parameter in any listing method:

```python
from transforms.api import transform, incremental
from transforms.mediasets import MediaSetInput, MediaSetOutput

@incremental(v2_semantics=True)
@transform(
    input_PNGs=MediaSetInput('/examples/input_PNGs'),
    output_PNGs=MediaSetOutput('/examples/output_PNGs'),
)
def upload_pngs(input_PNGs, output_PNGs):
    # Will use `added` if running incrementally, or `current` if not
    listed_pngs = input_PNGs.dataframe(deduplicate_by_path=False)

    # Will always read in `previous` mode
    previous_listed_pngs = input_PNGs.dataframe(deduplicate_by_path=False, mode="previous")
```

If a path is overwritten and the listing deduplicates by path, only the most recent item will be included. If you want to process all input items at a given path, then you must always specify `deduplicate_by_path=False`.

## Incremental write modes

When writing to an incremental media set output, the write mode can be set at runtime. This is useful if the transform contains custom logic that determines whether to run the build incrementally. In the example below, the build will not run incrementally if any paths were overwritten since the previous build:

```python
from transforms.api import transform, incremental
from transforms.mediasets import MediaSetInput, MediaSetOutput

@incremental(v2_semantics=True)
@transform(
    input_PNGs=MediaSetInput('/examples/input_PNGs'),
    output_PNGs=MediaSetOutput('/examples/output_PNGs'),
)
def upload_pngs(input_PNGs, output_PNGs):
    previous_dataframe = input_PNGs.dataframe(deduplicate_by_path=False, mode="previous")
    added_dataframe = input_PNGs.dataframe(deduplicate_by_path=False, mode="added")

    # Calculates if any paths have been overwritten in the `input_PNGs` media set since
    # the most recent run of this transform
    paths_overwritten = previous_dataframe.join(added_dataframe, mode="inner", on="path").count() > 0

    if paths_overwritten:
        # The full input media set will be read and the output media set will be replaced
        # with the items written in this transform
        read_mode = "current"
        output_PNGs.set_write_mode("replace")
    else:
        # Only the newly added items in the input media set will be read and the items written in this transform will
        # be appended to the output media set
        read_mode = "added"
        output_PNGs.set_write_mode("modify")
```

## Incremental transforms and branches

Media sets do not support incremental fallback branches. When running an incremental transform on a new branch, the incremental decorator will recommend a snapshot, as the output is currently empty. Therefore, running the same build on the main branch will not necessarily result in a snapshot.

## Incremental transforms and transactionless media sets

[Transactionless media sets](/docs/foundry/media-sets-advanced-formats/media-set-settings/#transaction-policies) use the `modify` write mode and cannot use the `replace` write mode. This means that a transactionless media set cannot be a snapshot. If a transactionless media set is an output of an incremental transform, but the transform can't run incrementally, the build will fail. In this case, you should investigate why the build cannot run incrementally.

## Abort incremental transforms

:::callout{theme="warning"}
It can be risky to abort outputs during an incremental build. For more information, see the [documentation on aborted transactions](/docs/foundry/transforms-python/abort-transactions/#how-do-aborted-transactions-relate-to-incremental-transactions).
:::

Individual media set outputs cannot be aborted during a build. Instead, we recommend using the [`.abort_job()`](/docs/foundry/api-reference/transforms-python-library/api-transformcontext/#transforms.api.TransformContext) method on the `TransformContext` to abort the entire job rather than aborting individual outputs. This will allow subsequent runs to be incremental.

## Limit batch size of incremental inputs

:::callout{theme="warning"}
Batch limits on incremental media set inputs are only supported for [Spark](/docs/foundry/transforms-python-spark/overview/) transforms.
:::

Typically for incremental transforms, all unprocessed media items of each input media set are processed in the same [job](/docs/foundry/data-integration/builds/#jobs-and-jobspecs). However, in some situations, the number of media items processed by a job can vary significantly:

* An incremental transform is built in `SNAPSHOT` mode and the entire input is read from the beginning. For example, the [semantic version](/docs/foundry/transforms-python/incremental-usage/#incremental-decorator) of the transform was increased.
* An input media set has accumulated many media items, so a downstream incremental transform now has to process many media items in a single job.

You can configure a **batch limit** on each incremental input media set of a transform to constrain the quantity of media items read in each job. This concept is analogous to a [transaction limit](/docs/foundry/transforms-python-spark/incremental-transaction-limits/) of an input dataset.

A batch limit is an upper bound on the number of media items processed per job. This limit is imposed before any media item [path deduplication](#incremental-read-modes). For example, if the batch limit is 100 and the transform deduplicates by media item path, it may appear that fewer than 100 media items have been processed.

The example below configures an incremental transform to use the following:

* Two incremental media set inputs, each with a different batch limit.
* An incremental media set input that does not use a batch limit.

```python
from transforms.api import incremental, transform
from transforms.mediasets import MediaSetInput, MediaSetOutput

@incremental(
    v2_semantics=True,
    strict_append=True,
)
@transform(
    input_media_set_1=MediaSetInput("/examples/media-set-input_1", batch_limit=100),
    input_media_set_2=MediaSetInput("/examples/media-set-input_2", batch_limit=500),
    input_media_set_3=MediaSetInput("/examples/media-set-input_3"),
    output_media_set=MediaSetOutput("/examples/media-set-output"),
)
def compute(ctx, input_media_set_1, input_media_set_2, input_media_set_3, output_media_set):
    ...
```

The expected usage is to [create a build schedule](/docs/foundry/transforms-python-spark/incremental-transaction-limits/#create-a-build-schedule-to-keep-outputs-up-to-date) to keep the output up-to-date.
