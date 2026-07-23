<!-- source: https://palantir.com/docs/foundry/data-integration/health-checks/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Health checks

Once data is synced into Foundry, has been transformed in a pipeline, and is running regularly using [schedules](/docs/foundry/data-integration/schedules/), **health checks** can be used to validate data quality throughout the pipeline. This is necessary to ensure that the data flowing through the pipeline remains reliable and maintains expected structure over time. Health checks are commonly used in [pipeline maintenance](/docs/foundry/maintaining-pipelines/overview/).

Several types of health checks are available in Foundry:

* *Job-level checks* validate that the job corresponding to an output dataset is completing successfully.
* *Build-level checks* validate that builds are completing successfully, and are completing within an expected duration.
* *Freshness checks* validate that data is being kept up-to-date.

To learn more, refer to these resources:

* Explore the [Health checks](/docs/foundry/health-checks/overview/) service to learn how to define health checks.
* Read the [checks reference](/docs/foundry/health-checks/checks-reference/) to learn about the range of available checks.
* Learn about which [health checks are recommended](/docs/foundry/maintaining-pipelines/recommended-health-checks/).
