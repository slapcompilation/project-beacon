<!-- source: https://palantir.com/docs/foundry/optimizing-pipelines/troubleshoot-schedules/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Troubleshooting schedules

### Scheduler metrics page

One of the best ways to begin troubleshooting a schedule issue is by looking at the [scheduler metrics page](/docs/foundry/building-pipelines/view-modify-schedules/#view-metrics). The metrics page can tell you the source of your failure, including common failure modes such as:

* The [scheduled builds are failing](#scheduled-builds-are-failing). You will see evidence of failed builds in the `Run History` tab, clicking on these builds will navigate to the Build Report in the Builds application for full logs.
* The [scheduled builds were ignored](#scheduled-builds-were-ignored). The `Run History` tab will show `Ignored` in the Status column for any builds that were triggered, but not built.
* The [schedule was not triggered](#schedule-was-not-triggered) at the expected time or cadence. For this case, the `Run History` tab may not show a build was triggered when you expected it to have.

The `Versions` tab shows past schedule versions and edits, and may be useful if your schedule suddenly begins behaving differently than expected. Check for any changes to the schedule version that align with this change, and consider reverting your schedule to a previously working state.

### Scheduled builds are failing

You can verify if a schedule was triggered at the expected time by checking the `Run History` tab on the [scheduler metrics page](/docs/foundry/building-pipelines/view-modify-schedules/#view-metrics).

If the schedule was triggered, but the build subsequently failed, you can debug this build following the [debugging guidance](/docs/foundry/optimizing-pipelines/debug-job/).

A schedule will also fail to build if the appropriate permissions are not set. The permissions of a schedule depends on the token mode the schedule is in. See [Project Scoped Schedules](/docs/foundry/data-integration/schedules/#project-scope) for more information.

### Scheduled builds were ignored

You can verify if a schedule was triggered at the expected time by checking the `Run History` tab on the [scheduler metrics page](/docs/foundry/building-pipelines/view-modify-schedules/#view-metrics). This will also usually give the reason that the schedule was ignored.

#### All datasets are up-to-date

A schedule run will be ignored if all the target datasets are up-to-date, i.e., if their inputs have not updated since the last build on that dataset. If this is the case, you will see this reason in the `Run History` tab. In the [schedule editor](/docs/foundry/building-pipelines/create-schedule/#navigate-to-the-schedule-editor), navigate to the schedules list. You will then have the option to color the Data Lineage graph by `Out-of-date`, which will give you an overview of which job specs are considered stale.

This behavior can be overridden in special circumstances using the `Force Build` option in [Advanced Settings](/docs/foundry/building-pipelines/create-schedule/#advanced-settings), though this is computationally wasteful outside these circumstances. If any of the target datasets any of the datasets build by Phonograph syncs, transforms with API calls or data connection syncs, they may not show up as stale and may require the `Force Build` option to be enabled for the schedule to run.

### Schedule builds a subset of datasets

If the schedule only triggers a subset of datasets, you will see evidence of this in the `Run History` tab on the [scheduler metrics page](/docs/foundry/building-pipelines/view-modify-schedules/#view-metrics).

One cause of this is that only a subset of the datasets were stale. Scheduler will only build the stale datasets and those that are up-to-date will be ignored during the build. See [all datasets are up-to-date](#all-datasets-are-up-to-date) for more troubleshooting details. The case where the build is `Ignored` happens if all these datasets are up-to-date.

Another cause could be that the dataset was not included in the dataset graph of the build. In the [schedule editor](/docs/foundry/building-pipelines/create-schedule/#navigate-to-the-schedule-editor), when a given schedule is selected, the datasets to be built are highlighted in the Data Lineage graph. The dataset selection depends upon the [build type](/docs/foundry/building-pipelines/create-schedule/#build-type). If using a `Connecting build`, you should especially take care to verify if a connecting dataset is present for schedules using the same datasets on multiple branches.

### Schedule was not triggered

You can verify if a schedule was triggered at the expected time by checking the `Run History` tab on the [scheduler metrics page](/docs/foundry/building-pipelines/view-modify-schedules/#view-metrics). Some common debugging steps here are:

* Check that the [schedule is not paused](/docs/foundry/building-pipelines/view-modify-schedules/#pause-a-schedule). Paused schedules will not trigger until unpaused.
* Check the [schedule trigger configuration](/docs/foundry/building-pipelines/triggers-reference/). If this previously was successful, check the schedule history to see if there was a change to the trigger recently.
* If the schedule is using an Event trigger, verify that the expected event actually happened. For example, if the build should be triggered when the input updates, check that the last build on the input ran successfully and transactions on this build were successfully committed in the [Dataset Preview History view](/docs/foundry/dataset-preview/overview/).

### Schedule retries differ from configured

Be aware that not all types of failure are retryable. The number of retries when the schedule runs will be capped to a maximum configured by your administrator. See [Advanced settings](/docs/foundry/building-pipelines/create-schedule/#advanced-settings) for more information.

### Schedule is failing with JobSpecInputsTrashed or JobSpecOutputsTrashed, or Data Lineage warns that some datasets are trashed

This means that the schedule contains or reads from a trashed resource. You can do one of the following to resolve:

* Restore the deleted dataset from trash.
* Exclude the deleted dataset from the schedule. If this dataset is used as an input to another downstream dataset in the schedule, you will also need to do one of the following:
  * Exclude the downstream dataset along with the trashed one.
  * Modify the logic of the downstream dataset so that it no longer takes the trashed dataset as input.

### Scheduler permissions

If you run into an issue in which you are unable to edit a schedule, project scope permissions may be the root cause.

To edit a schedule in [project scoped mode](/docs/foundry/data-integration/schedules/#project-scope), the user must have `Edit` permissions on the target datasets, `View` permissions on the trigger datasets and `Edit` permissions on the project that the schedule is scoped to. If there is one dataset for which you have lost permissions for, remove this dataset from the schedule before you save your changes.

To edit, delete or pause a schedule, the user needs to have `Edit` permissions on the target datasets and `Edit` permissions on the project that the schedule is scoped to. To view a schedule, the user needs to have `View` permissions on the target datasets.
