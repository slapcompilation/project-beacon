<!-- source: https://palantir.com/docs/foundry/pipeline-builder/schedules-overview/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Schedules

**Schedules** in Pipeline Builder are used to run [builds](/docs/foundry/data-integration/builds/) on a recurring basis. Configuring schedules is a vital part of ensuring pipeline data remain up-to-date for end users and downstream workflows.

Scheduled builds can be configured to run:

* At certain times
* When data has been updated
* When logic has been updated
* *Any combination of the above conditions*

Scheduled builds can be configured to build:

* A single dataset
* A single dataset and all its dependencies
* All datasets that depend on a dataset
* All datasets that connect two datasets
* *Any combination of the above configurations*

By default, a schedule does not start a run while another run of the same schedule is in progress. Enable **Allow overlapping runs** to process new input data before an earlier run finishes. You can also use this setting to keep multiple datasets up to date with one schedule.

You can set up basic build schedules directly within Pipeline Builder and navigate to advanced settings and status reports in dataset views. Edit or remove schedules at any time, and review our [best practices](/docs/foundry/building-pipelines/scheduling-best-practices/) to optimize pipeline management.

Learn how to [create a schedule](/docs/foundry/pipeline-builder/schedules-create-schedule/) in Pipeline Builder, or learn more about [viewing and modifying schedules](/docs/foundry/building-pipelines/view-modify-schedules/) in the dataset view.
