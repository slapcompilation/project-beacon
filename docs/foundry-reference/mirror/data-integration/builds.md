<!-- source: https://palantir.com/docs/foundry/data-integration/builds/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Builds

A **Build** is the mechanism used to compute new versions of [datasets](/docs/foundry/data-integration/datasets/) in Foundry. Builds provide orchestration and coordination of computation, ensure the appropriate input data is read, and write output data to the appropriate location.

A build is composed of **jobs**, each of which is a unit of work that is defined by shared logic and computes one or more output datasets. Note that if a job defines multiple output datasets, they will always update together and it is not possible to build only some of the datasets without running the full job. A job specification, or **JobSpec**, is a definition of how a job should be constructed. JobSpecs are published when changes are made to data transformation logic in Foundry, such as when a data engineer commits new transforms code in a [Code Repository](/docs/foundry/code-repositories/overview/).

Running a build results in a one-time computation of a set of output datasets. To keep data flowing through the system, [schedules](/docs/foundry/data-integration/schedules/) are used to run builds over time.

You can explore builds in Foundry using the [Builds application](/docs/foundry/data-integration/application-reference/#builds).

## Jobs and JobSpecs

A *job* encapsulates the computation of a new version of one or more *output datasets* from the data of a set of input datasets. A *JobSpec* defines how to construct a job by detailing input dataset dependencies and the logic that should be executed as part of the job.

Input dataset dependencies are declared as a set of *InputSpecs*, each of which specifies a particular input dataset. InputSpecs specify a subset of data to read from a dataset in terms of its views.

There are many types of logic that can be represented as a job in Foundry, including but not limited to:

* A Data Connection [Sync](/docs/foundry/data-connection/core-concepts/#syncs) defines how data should be read from an external data source.
* A transform written in a [Code Repository](/docs/foundry/code-repositories/overview/) allows you to write code that transforms datasets.
* [Health checks](/docs/foundry/data-integration/health-checks/) are defined as jobs generated on a dataset to validate characteristics of the dataset.
* [Analytical applications](/docs/foundry/analytics/datasets-object-sets/) support defining logic that transforms datasets.
* An [export](/docs/foundry/data-connection/export-overview/) defines how input data should be sent outside of Foundry.

### Job states

At any given time, a job is always in one of the following states:

* `WAITING`: The initial state of a job; the job is waiting for its dependent jobs to complete and has not been invoked.
* `RUN_PENDING`: The job is waiting to run, but its execution environment has not yet confirmed the status.
* `RUNNING`: The job has been invoked and is currently being computed.
* `ABORT_PENDING`: The job has been aborted, but its execution environment has yet to confirm the aborted status.
* `ABORTED`: The job was aborted either upon user request, or as a result of a dependent job failing.
* `FAILED`: The job was invoked, but the computation failed.
* `COMPLETED`: The job was invoked, and the computation finished successfully.

## Build lifecycle

When a build is run, several steps are performed to validate the submitted build, ensure data consistency, and only run the jobs necessary to produce new outputs.

### Build resolution

As a first step, a build:

* Detects cycles in the specified input datasets and fails the build if there are cycles present.
* Validates all input datasets exist and identifies the appropriate schema for each input dataset.
* Opens new [transactions](/docs/foundry/data-integration/datasets/#transactions) on each output dataset to ensure that only the active build can write to the output dataset. This is known as *build locking*.
* Detects if other builds are in progress that would change the inputs into the build. If so, the build may be *queued* and wait for the other build to complete.

### Job execution

Once the above steps have completed, the jobs within a build are executed. Jobs that do not depend on each other are run in parallel. As jobs proceed through the [job states](#job-states), the state of the overall build is updated accordingly:

* If a job in a build fails, all directly-dependent jobs and transactions on output datasets within that build will be terminated. Optionally, a build can be configured to abort all non-dependent jobs at the same time.
* If all jobs in the build are completed, then the build is considered completed.

Note that if a job in a build fails, previously completed jobs may still have written data to their output datasets.

### Staleness

An output dataset is considered *fresh* if the [build resolution](#build-resolution) step determines that input datasets and the logic specified within the JobSpec have not changed since the last time the output dataset was built. If an output dataset is fresh, it will not be recomputed in subsequent builds.

To override the build system's default staleness behavior, you can run a **force build**, which recomputes all datasets as part of the build, regardless of whether they are already up-to-date.

## Branching

Builds in Foundry implement **branching** to support collaboration workflows on data pipelines. To learn more about branching:

* Refer to the [branching overview](/docs/foundry/data-integration/branching/) for a high-level explanation.
* Refer to the [branching in builds](/docs/foundry/data-integration/branching/#branches-in-builds) section for details about how branching works in builds.

## Live logs

Live logs provide real-time visibility into running jobs, allowing you to monitor how jobs are progressing and inspect long-running tasks such as streams or compute modules.

![The live logs view in the Builds application.](/docs/resources/foundry/data-integration/live-logs-overview.png)

You can access live logs through the Builds application. Select the **View live** button in the top right corner of the log viewer when viewing a job to start generating.

![The "View live" option from the log viewer page of a job in the Builds application.](/docs/resources/foundry/data-integration/live-logs-build-page.png)

A key feature of live logs is built-in color coding by log level, making it easier to identify and prioritize warnings and errors:

![Examples of various color coding indicators in a live logs feed.](/docs/resources/foundry/data-integration/live-logs-color-coding.png)

* **Info:** Blue
* **Fatal/Error:** Red
* **Warn:** Orange
* **Debug/Trace:** Gray

Additionally, safe parameters and parameters are visible as a JSON block, providing a structured and readable format for your data.

![The "Format as JSON" option from the live logs feed.](/docs/resources/foundry/data-integration/live-logs-json.png)

You can stop the live log feed at any point by selecting **Pause** from the top right of the interface, and resume from the same location.

![The "Pause" option from the live logs feed.](/docs/resources/foundry/data-integration/live-logs-pause.png)

Note that the time range selection does not apply to live logs, since they are streamed in real-time from the job.

:::callout{theme="neutral"}
Once enabled, a ten-second delay may occur before the live logs are visible in the interface.
:::
