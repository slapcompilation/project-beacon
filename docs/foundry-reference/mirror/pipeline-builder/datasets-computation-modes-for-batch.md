<!-- source: https://palantir.com/docs/foundry/pipeline-builder/datasets-computation-modes-for-batch/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Computation modes for batch input datasets

You can choose to read your input dataset as snapshot or incremental, depending on your use case.

## Snapshot computation

Snapshot computation performs transforms over the entire input, not just newly-added data. The output dataset is fully replaced by the latest pipeline output every build.

![Example of snapshot computation](/docs/resources/foundry/pipeline-builder/datasets-snapshot-computation.png)

Best used when:

* The input dataset is not updating via `APPEND` transactions.
  * When the input is written using `SNAPSHOT` transactions, incrementally reading the input is not possible.
* The output dataset cannot update via `APPEND` transactions.
  * Example: The entire output dataset is subject to change with each run, requiring snapshot outputs.
* The input dataset is small.
  * Snapshot computation is similarly efficient to incremental computation in this case.

## Incremental computation

Incremental computation performs transforms only on new data that has been appended to the selected input since the last build. This can reduce compute resources, but comes with important [restrictions](#incremental-computation-restrictions).

:::callout{theme="warning"}
A pipeline will only run with incremental computation if the selected input dataset changes through `APPEND` or `UPDATE` transactions that do not modify existing files. Marking a snapshot input as incremental will have no effect.
:::

![Example of incremental computation](/docs/resources/foundry/pipeline-builder/datasets-incremental-computation.png)

Best used when:

* The input dataset changes via `APPEND` transactions or additive `UPDATE` transactions.
  * This indicates the previous output stays the same as new data is added. Incremental computation cuts down the amount of data processed with each build.
* You do not need to reference the previous output.
  * Pipeline Builder currently disallows [read mode: previous](/docs/foundry/transforms-python/incremental-usage/#incrementaltransforminput). However, some output write modes support common use cases of this read mode. [Learn more about output write modes in Pipeline Builder.](/docs/foundry/pipeline-builder/outputs-add-dataset-output/#configure-write-mode)
* The input dataset is large and new data is often added.
  * Incremental builds can save compute resources and time and lead to performance benefits.

### Incremental computation restrictions

:::callout{theme="warning"}
This section outlines restrictions that might be applicable to your workflow. Review prior to incremental computation setup to ensure proper implementation.
:::

* **Joins:** With joins involving an incremental dataset, the incremental dataset must be on the left side of the join and the snapshot dataset on the right side. Joins between two incremental datasets are also supported.
  * **Snapshot inputs in joins:** If a snapshot input receives a new transaction, any downstream joins that also involve an incremental dataset will continue to run incrementally. Pipeline Builder does not support using a change in the snapshot input on the right side of a join to force a replay of the pipeline.
* **Unions:** All inputs to a union must use the same computation mode (either all snapshot or all incremental).
* **Transforms:** Transforms that may change the previous output are limited to the current transaction. Window functions, aggregations, and pivots apply only on the current transaction of data, not the previous output.
* **Replays:** If your pipeline logic has changed and you would like to apply the new logic to previously processed input transactions, you may choose to replay on deploy. Only replays over the entire input are supported.

For more information, see an [example of incremental computation in Pipeline Builder](/docs/foundry/building-pipelines/create-incremental-pipeline-pb/).
