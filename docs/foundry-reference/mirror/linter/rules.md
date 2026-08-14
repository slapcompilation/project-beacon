<!-- source: https://palantir.com/docs/foundry/linter/rules/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Available rules

Foundry collects resource metadata that is stored internally within Foundry. Linter fetches and combines the metadata from various metadata stores. A Linter rule is logic that runs against resource metadata to determine whether a resource passes or fails the logical test. If a resource fails the test, Linter produces a recommendation as to how the resource can be modified in order to change the result of the logic.

Each Linter rule belongs to a [mode](/docs/foundry/linter/modes/).

:::callout{theme="warning"}
In Resource Savings mode, each rule follows a methodology for estimating the savings if the recommendation is followed. This methodology supports prioritization; assumptions are often valid for many situations but may not be right for your use case. To validate any reduction in resource usage, use the [Resource Management application](/docs/foundry/resource-management/overview/).
:::

## Code workbook pipeline crosses schedules

**Logic:** Downstream datasets are built in [Code Workbook](/docs/foundry/code-workbook/overview/) but are not on the same schedule.

**Why:** Code workbooks have the ability to use a ready-to-use warm Spark modules When workbook transform jobs are within the same schedule, they can re-use this module while it is active and skip loading the materialized data from disk. This leads to a faster pipeline and reduced costs.

**Recommendation:** Move Code Workbook transforms directly downstream from this dataset into the same schedule.

**Savings estimate methodology:** Linter generates a rough estimate of the time taken to read in the dataset. This estimate is a heuristic based on observational tests and may not be fully accurate for your specific compute environment.

## Dataset build time exceeds threshold

**Logic:** The percentage of time spent with jobs actively running for this resource over the last seven days has exceeded 70%. This could include many jobs with a short duration that are triggered often, or fewer jobs with longer durations.

**Why:** Datasets constantly building can be a large source of usage. Any frequency decrease or performance improvement on these resources can lead to large savings.

**Recommendation:** Consider reducing build frequency.

**Savings estimate methodology:** The total resource usage of the last calendar month (for example, if calculating from June 21st, the value provided is the consumption of this resource between May 1st and May 31st).

## Dataset code out of date

**Logic:** Dataset’s JobSpec commit is different from the latest commit of the `master` branch in the repository.

**Why:** If not fixed, the build of the dataset does not reflect the latest logic in the repository.

**Recommendation:** Remove the dataset from the schedule, or re-commit its transforms logic on the `master` branch.

## Dataset has a filtered projection

**Logic:** A Contour dashboard does not have a dataset projection on one of its starting incremental datasets.

**Why:** Use a projection to make the dashboard quicker to populate, saving repetitive filter computations in case of steady usage.

**Recommendation:** Review the Contour dashboard to confirm its usage, importance, and ordering of filtered columns. Enable [dataset projections](/docs/foundry/optimizing-pipelines/projections-overview/) in your Foundry enrollment, then add a projection on the underlying Foundry dataset that is optimized for filtering on the ordered list of flagged columns. Be sure to schedule your projection so it is regularly refreshed. Your Contour dashboard should now populate faster by leveraging the dataset projection.

## Dataset should be view

**Logic:** The statistics of the input and output datasets of a transform indicate that there is no logic being applied.

**Why:** Resources are used when reading a dataset into Spark and then writing it back out. This can be avoided by skipping any computation and using a Foundry view.

**Recommendation:** Turn this dataset into a Foundry view to decrease pipeline runtime, data duplication, and cost.

**Savings estimate methodology:** The total resource usage of the last calendar month (for example, if calculating from June 21st, the value provided is the consumption of this resource between May 1st and May 31st).

## Dataset should use native acceleration

**Logic:** Transforms associated with the datasets contain an executor memory based profile in their `@configure` block, and are not already associated with [Velox](/docs/foundry/transforms-python-spark/velox-overview/).

**Recommendation:** It is possible that there are potential savings to be made by switching to Velox backends for these jobs. When making this change, it is important to check the resources consumed to validate any potential savings recommended by Linter.

## Default branch unprotected

**Logic:** The default branch of the code repository is not protected.

**Why:** Protecting default branches is important for tracking changes, version controls, and protecting against accidental changes.

**Recommendation:** Add the default branch to the list of protected branches in the repository settings.

## Executor high memory ratio

**Logic:** The transform uses a memory-to-core ratio that is higher than the default of 7.5 GB per core.

**Why:** There is a default memory-to-core ratio that, when exceeded, leads to increased costs. Many users increase the executor memory in response to problems that are unrelated to memory or could be solved using cheaper means. Resource savings can often be found by performing the transform using the default memory-to-core ratio. In some cases, however, (such as the explosion of rows) it is necessary to increase the memory per executor to avoid out-of-memory errors and/or excessive shuffle between executors. In such cases, increasing the number of executor cores to match the executor memory profile can lead to faster build times and significantly lower costs by increasing parallelism and reducing partition sizes.

**Recommendation:** We recommend reducing the memory-to-core ratio by aligning the `EXECUTOR_MEMORY_X` Spark profile with the `EXECUTOR_CORES_X` Spark profile. If this leads to memory issues, examine your Spark graph to identify the problematic stage. In the case of a dataset read stage issue, consider increasing the number of partitions of the input dataset to feed smaller partition sizes to each executor. In the case of a shuffle stage issue, consider disabling adaptive Spark allocation (ADAPTATIVE\_DISABLED Spark profile) if there are less tasks than the shuffle partitions setting or increasing shuffle size (SHUFFLE\_PARTITIONS\_LARGE Spark profile) to feed smaller tasks to executors. Learn more about Spark Profiles [here](/docs/foundry/optimizing-pipelines/apply-spark-profiles/).

**Savings estimate methodology:** An estimate is made of what the resource usage of the last calendar month would have been using the default core to memory ratio instead of the detected one. That value is subtracted from the observed resource usage to estimate the saving.

## Incremental append dataset too many files

**Logic:** The dataset is incrementally updating and has a suboptimal partition size, meaning that the average partition size is too large or too small.

**Why:** The optimal partition size varies. If your partition sizes are too small, the overhead that comes with each partition can dominate the processing time. If your partitions are too large, memory management operations can increase the run time and/or lead to out-of-memory problems that increases job duration and excessive resource usage in downstream datasets or analyses that read in data from a dataset.

**Recommendation:** We recommend including logic to check partition sizes and storing the data in the dataset in better partition sizes. In the case of an `APPEND` dataset, [check the number of files already in the output dataset](/docs/foundry/transforms-python/create-historical-dataset/#increased-resource-consumption). If the dataset is not backed by a Python or Java transform logic file, creating a [projection](/docs/foundry/optimizing-pipelines/projections-overview/) can also remediate this issue. Optimizing the projection for filtering is sufficient to achieve desired compaction, but additional benefits can occur by optimizing for joins, depending on downstream query plans.

**Savings estimate methodology:** A ratio of the time spent reading in files in recent jobs is compared to an estimate of how long a dataset of such size should usually take. This is multiplied by the number of times this happens over the last week for each downstream transformation that reads in this dataset.

## Incremental over-provisioned cores

**Logic:** The dataset is using static allocation, a Spark setting that uses a fixed number of executors. The parallelism of the task running with the recent jobs is lower than the threshold (default: 70%).

**Why:** Provisioning resources statically can lead to poor parallelism; resources sit idle and await other tasks to finish before they can be used. Using the dynamic allocation Spark setting can ensure that idle executors are no longer reserved exclusively for this job, leading to better task parallelism.

**Recommendation:** We recommend using dynamic allocation by applying a `DYNAMIC_ALLOCATION_MAX_N` [Spark profile](/docs/foundry/optimizing-pipelines/spark-profiles-reference/) to the transform.

**Savings estimate methodology:** The calculated parallelism is multiplied by the resource consumption in the last calendar month (for example, if calculating from June 21st, the value provided is the consumption of this resource between May 1st and May 31st) to estimate the savings if perfect parallelism were achieved. If a dataset has a recent parallelism of 70%, for example, then an estimated 30% of last month’s resource usage can be saved.

## Incremental replace dataset too many files

Similar to `Incremental append dataset too many files` but for datasets that use the `replace` incremental transform output write mode. We do not recommend using data projections as a fix in this case if `UPDATE` transactions are not purely adding files; modifying or deleting existing files will cause a full recompute of the dataset projection. To lean more about incremental Python Transforms modes, go [here](/docs/foundry/transforms-python/incremental-usage/).

## Overlapping schedules

**Logic:** The schedule builds a dataset that is also built by another schedule.

**Why:** The same dataset is built by two different schedules, potentially causing compute waste, queueing, and unreliable latency.

**Recommendation:** Change the build action of the schedule(s) to eliminate overlap.

## Repository should only allow squash and merge

**Logic:** In this repository, the `Squash and merge` git behavior is not enabled.

**Recommendation:** Enable `Squash and merge` in the repository settings.

## Repository upgrade blocked

**Logic:** The code repository has an open repository upgrade PR that cannot be merged.

**Why:** Repository upgrades are essential for the pipeline to keep using the latest functionalities available. Repositories that are not current can cause pipeline failures over time, affecting workflow stability and causing compute waste.

**Recommendation:** Investigate why the PR is not merging, and fix the upgrade.

## Repository upgrades disabled

**Logic:** A code repository's settings have disabled the automatic merging of upgrade pull requests.

**Why:** Repository upgrades are essential for pipelines to keep using the latest available functionalities. Repositories that are not current can cause pipeline failures over time, affecting workflow stability and causing compute waste.

**Recommendation:** Use the fix assistant to allow upgrade PRs to automatically merge. Otherwise, manually navigate to the repository's settings by selecting **Settings > Repository > Upgrades** and tick the **Automatically merge upgrade pull requests** option.

## Schedule always fails

**Logic:** The schedule has not succeeded in the past 30 days. The datasets that failed to build in that time are listed.

**Why:** In each run, the schedule tries to rebuild a dataset that never succeeded in the last 30 days, indicating a waste of resources.

**Recommendation:** Pause the schedule, apply fixes to the failing dataset(s), or remove the failing dataset(s) from the schedule.

**Savings estimate methodology:** Sum of computation cost the failing datasets on the branch over the last 30 days.

## Schedule builds Code Workbook

**Logic:** The dataset has a Code Workbook JobSpec.

**Why:** Datasets in production and scheduled datasets should not be built in Code Workbook where possible; instead, they should be migrated to an application designed for in-production pipeline building such as Pipeline Builder or Code Repositories.

**Recommendation:** If a dataset needs to be scheduled, migrate the logic to Pipeline Builder or Code Repositories.

## Schedule builds Contour analysis

**Logic:** The dataset has a Contour JobSpec.

**Why:** Datasets in production and scheduled datasets should not be built in Contour and should be migrated to an application designed for pipeline building, such as Pipeline Builder or Code Repositories.

**Recommendation:** If a dataset needs to be scheduled, migrate the logic to Pipeline Builder or Code Repositories.

**Savings estimate methodology:** The sum of computation cost the failing datasets on the branch over the last 30 days.

## Schedule builds trashed dataset

**Logic:** The dataset is in the trash.

**Why:** Even though a dataset is placed into the trash, the schedule is attempting to build it.

**Recommendation:** Investigate why the dataset is still in the schedule and either remove it from the trash or update the schedule.

## Schedule does not abort on failure

**Logic:** The schedule does not have `abort on failure` enabled.

**Why:** If `abort on failure` is not enabled, monitoring waits until the schedule to finish even when there is a failed dataset within a schedule.

**Recommendation:** Enable `abort on failure` mode. This feature allows monitoring to be notified about the failure sooner and enables faster remediation.

## Schedule exceeded duration mode disabled

**Logic:** The schedule does not have `exceeded duration` mode enabled.

**Why:** When a duration is set, this mode prevents Data Connection builds from indefinitely running during a network flake and prevents downstream outages.

**Recommendation:** Enable `exceeded duration mode` on the schedule.

## Schedule has no built datasets

**Logic:** The schedule does not build any datasets.

**Why:** The schedule is potentially a waste of resources and generating noise for monitoring.

**Recommendation:** Investigate whether the schedule is useful, and decide whether to delete or remove it from the monitoring scope.

## Schedule ignores irrelevant datasets

**Logic:** The schedule declares ignored datasets, which do not modify the build action.

**Recommendation:** Remove offending datasets from the schedule’s ignore list.

## Schedule inputs disconnected

**Logic:** The schedule specifies input datasets that are not actually inputs for any datasets built by the schedule.

**Why:** This issue usually occurs due to excluded datasets.

**Recommendation:** Either modify excluded datasets, or remove the input from the connection build action.

## Schedule inputs unscheduled

**Logic:** The schedule has buildable, unscheduled, not Fusion-backed input datasets.

**Recommendation:** Schedule the flagged dataset, or remove its code and JobSpec to make it raw. If the dataset needs to have a JobSpec but should not be scheduled (such as discretionary snapshots), add an exception.

## Schedule missing description

**Logic:** The schedule does not have a description.

**Recommendation:** Enter a description based on the purpose and functionality of the schedule.

## Schedule missing name

**Logic:** The schedule does not have a name.

**Recommendation:** Generate a name based on the dataset names and paths in the build. This can be automatically generated.

## Schedule on branch

**Logic:** A schedule is running on a branch that is not `master`.

**Why:**  The `master` branch is used throughout Foundry as the canonical version of data. Often, schedules should run consistently on branches to provide alternate versions of the data or to experiment with alternative logic. This behavior can result in many schedules that were set up on branches that continue to run longer than needed.

**Recommendation:** Understand if the schedule on the branch is needed, and consider pausing or deleting the schedule if it is not required. You can also consider reducing the trigger frequency of a schedule not on the `master` branch to reduce cost. For example, if the schedule runs once a day on `master` could the non-master branch deliver the same result if run once a week?

**Savings estimate methodology:** The ratio of the number of jobs that ran on this branch over the past month divided by the number of jobs that ran on `master` over the past month is used to renormalize the resource usage of datasets built by this schedule. Summing this usage renormalized by branch yields the savings estimate.

## Schedule outputs not targets

**Logic:** Some resolved outputs of the schedule are not marked as targets, or vice versa.

**Recommendation:** Update the schedule for targets to match actual schedule outputs.

## Schedule potentially unused

**Logic:** The lineage of all resources in the schedule are checked to determine if any recent downstream usage occurred, either in scheduled pipelines, interactive analyses such as [Contour](/docs/foundry/contour/overview/), object storage destinations, or via external API calls.

**Why:**  Foundry changes over time, and it is not beneficial to spend resources calculating results that will never be used to make decisions. Turning off unused pipelines is a way to ensure your Foundry instance is only spending resources computing results that are being actively used to drive your goals.

**Recommendation:** The unused schedule is paused. The recommendation will sometimes reveal unused subsets of the schedule that will likely reduce compute if removed.

**Savings estimate methodology:** The sum of resource usage across the unused resources in the schedule over the last calendar month.

## Schedule retries disabled

**Logic:** The schedule does not have retries enabled.

**Why:** Certain failures, such as ones caused by environment setup issues, usually do not appear in the second run. Not having retries in a schedule may cause datasets to not build when they could have been built.

**Recommendation:** Enable retries. We recommend setting three retry attempts.

## Schedule scope invalid

**Logic:** The schedule has an invalid scope with respect to its build action. Its scope excludes datasets that should be built by this schedule.

**Recommendation:** Edit the schedule and modify its project scope to include all projects containing datasets to be built by this schedule. If this is not possible, remove the schedule’s project scope.

## Schedule trigger is not input

**Logic:** The schedule declares a dataset as a trigger but not as an input.

**Recommendation:** Modify the connecting build action to either remove the dataset from triggers or add it to inputs.

## Schedule triggers itself

**Logic:** The schedule declares a dataset as a trigger, which is also being built.

**Recommendation:** Modify the build action to remove the problematic dataset from triggers or output datasets.

## Schedule triggers too often

**Logic:** Schedule has multiple trigger conditions.

**Why:**  Schedules are often created to run whenever new data is available. For example, if your schedule has two input datasets that each update once an hour, it can lead to a schedule running twice an hour. A significant cost reduction can occur if the schedule runs as multiple datasets update.

**Recommendation:** Consider changing the schedule to use AND triggers rather than OR, or switching to a time-based trigger to run once an hour.

## Schedule unnecessary force builds

**Logic:** The schedule is using the force build setting even though it is not a Data Connection ingest schedule.

**Why:** Foundry tracks transactional changes throughout the input lineage with a system that allows skipping computation if inputs are unchanged. The force build setting ensures that a transform runs regardless of the result of the input transaction analysis, leading to potentially unnecessary jobs that repeatedly produce the same result.

**Recommendation:** Check to see if there are any untracked external dependencies in the transform (API calls, for example) that would require using this setting. If no dependencies are found, remove the setting from the schedule.

**Savings estimate methodology:** The total resource usage of the last calendar month of the datasets in the schedule (for example, if calculating from June 21st, the value provided is the consumption of this resource between May 1st and May 31st) are multiplied by their job input change percentage. A dataset’s job input change percentage is the number of jobs with updated inputs divided by number of total jobs in the last week (not the previous month over which the consumption data was taken).

## Snapshot dataset too many files

Similar to `Incremental append dataset too many files` but for dataset that are added using `SNAPSHOT` transactions. We do not recommend using data projections in this case.

## Snapshot over-provisioned cores

Similar to `Incremental over-provisioned cores` but for dataset that are run with `SNAPSHOT` transactions.

## Spark plan potentially non-deterministic

**Logic:** A query plan with potentially non-deterministic logic was detected for a dataset built by Spark.

**Why:** There are several edge cases in Spark query plans that may lead to inconsistent, non-deterministic, or otherwise unstable data.

**Recommendation:** Each recommendation should provide more information on the nature of the potential non-determinism. Investigate and fix the logic backing the dataset that has a potentially non-deterministic Spark plan.

## Transform should be lightweight

**Logic:** Transforms associated with these datasets do not use Spark context or Spark dataframes, or are already associated with Pandas based transforms.

**Recommendation:** Switching these transforms to use [lightweight transforms](/docs/foundry/transforms-python/compute-engines/) will result in potential savings. When making this change, it is important to check the resources consumed to validate any potential savings recommended by Linter.

## Transform should build incrementally

**Logic:** Dataset builds as a `SNAPSHOT` but is directly downstream of at least one incremental dataset that purely appends new data.

**Why:** A `SNAPSHOT` transaction processes all historic data. An incremental transaction processes only the new data and adds the results onto the previous values. Switching to incremental transactions can lead to a dramatic reduction in the resources required to deliver an outcome.

**Recommendation:**  Consider converting this dataset to an incremental transform to save compute cost. If the dataset is configured to run incrementally, understand and address why the dataset frequently builds as a `SNAPSHOT`.

**Savings estimate methodology:** The total resource usage of the last calendar month (for example, if calculating from June 21st, the value provided is the consumption of this resource between May 1st and May 31st) is multiplied by the ratio of the sum of input sizes (incremental sizes if inputs are incremental) to the sum of total input sizes (regardless of input incrementality). This returns the estimated resource usage of this dataset if it were to run incrementally. Therefore, estimated savings of this recommendation are the difference between past month resource usage and this resource usage estimate.

## Transform should build locally

**Logic:** The transform uses dataset(s) that are small in size (300Mb or less).

**Why:** By default, Foundry uses distributed computation for ease of scaling and speed. This uses more resources than local computation. In cases where the dataset sizes are small and will remain so, local execution should be used (not distributed) so that fewer resources are needed to perform the transform.

**Recommendation:** Enable local execution for this transform or all transforms in the repository that have input and output datasets smaller than the threshold size. This can be enabled by using a specific setting, such as the `KUBERNETES_NO_EXECUTORS` [Spark profile](/docs/foundry/optimizing-pipelines/spark-profiles-reference/).

**Savings estimate methodology:** The total resource usage of the last calendar month (for example, if calculating from June 21st, the value provided is the consumption of this resource between May 1st and May 31st) is divided by the ratio of core changes. For example, if a transform was previously using five cores (two executors with two cores per executor, and one driver with one drive core) and running locally can use one core, then the estimated savings is the total resource usage multiplied by 0.8 ((5-1)/5).

## User-scoped schedule

**Logic:** The schedule is not project-scoped.

**Recommendation:** Modify the schedule to run on scoped token mode; by default, the scope is the project RIDs of the built datasets.
