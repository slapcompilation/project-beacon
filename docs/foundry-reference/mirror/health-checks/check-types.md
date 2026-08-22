<!-- source: https://palantir.com/docs/foundry/health-checks/check-types/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Types of checks

This page outlines various types of checks available in Data Health, including job-level checks, build-level checks, schedule-level checks, and freshness checks.

### Job-level checks vs. schedule-level checks

This section describes the **job status**, **schedule status**, and **schedule duration** checks.

The definitions below clarify what a job and a schedule are in Foundry:

* **[Job](/docs/foundry/data-integration/builds/#jobs-and-jobspecs):** a Spark computation defined by the logic in a single transform. In other words, a job is a single transform that produces a single dataset (or several if a multi-output transform is used). Jobs are broken down into a set of stages.
* **[Schedule](/docs/foundry/data-integration/schedules/):** a collection of jobs with defined target datasets that are configured to run on a reoccurring basis. Schedules can be used to represent a subset of a pipeline that builds together.

We use the following Data Health checks to ensure jobs and schedules are running successfully:

* **Job status:** This is triggered whenever the dataset on which it is installed is refreshed or is created as a part of any build. A job status check will succeed if the target dataset successfully builds, even if the build it is a part of fails downstream. However, note that if the build fails upstream of the target dataset, your target dataset will register as having a cancelled build and the job status will not be evaluated for the target dataset.
* **Schedule duration & schedule status:** These allow you to monitor the status of a schedule build, including all intermediates. Note that this is only triggered when the check's configured schedule runs.
  * In general it is recommended that all schedules have schedule status checks. If you already have a schedule status check, installing job status checks on other datasets built by the same schedule is not recommended, as any job failing on the schedule will trigger a schedule status check.

When trying to determine when and where to place job or schedule status checks, see our guide on [which health checks to apply](/docs/foundry/maintaining-pipelines/recommended-health-checks/).

For more details and further clarification on the checks themselves, see the checks reference for [schedule status](/docs/foundry/health-checks/checks-reference/#schedule-status) and [job status](/docs/foundry/health-checks/checks-reference/#job-status).

### Freshness checks

This section describes the **sync freshness**, **data freshness**, and **time since last updated** checks.

All three of these checks are concerned with “freshness” (how up-to-date some aspect of your data is), but they all use different methods to evaluate freshness:

* **Time since last updated:** Evaluates **freshness of the dataset**. This check calculates how much time has elapsed between the current time and the last transaction committed, even if the transaction was empty; an empty transaction does not change the data in the dataset.
* **Data freshness:** Evaluates **freshness of the data in the dataset** by calculating how much time has elapsed between the last transaction committed and the maximum value of a timestamp column. This check is only run when a transaction is committed.
* **Sync freshness:** Evaluates **freshness of the data in the synced dataset** by calculating how much time has elapsed between the time of the latest sync of a dataset and the maximum value of a datetime column.

For both data and sync freshness, it is ideal if the timestamp in the column represents the time when the row was added in the source system.

When trying to determine when and where to place freshness checks, see our guide on [what health checks to apply](/docs/foundry/maintaining-pipelines/recommended-health-checks/).

For more details on the checks themselves, see the checks reference for [time since last updated](/docs/foundry/health-checks/checks-reference/#time-since-last-updated), [data freshness](/docs/foundry/health-checks/checks-reference/#data-freshness), and [sync freshness](/docs/foundry/health-checks/checks-reference/#sync-freshness).

### Can I abort builds when health checks fail?

Most standard health checks depend on jobs to finish in order to compute. If your dataset is created in a Code Repository, you can use [data expectations](/docs/foundry/maintaining-pipelines/define-data-expectations/) to define checks that run during build time. This will allow you to abort the build on error and monitor the checks using Data Health.
