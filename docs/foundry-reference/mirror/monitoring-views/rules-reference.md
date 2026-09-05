<!-- source: https://palantir.com/docs/foundry/monitoring-views/rules-reference/ · mirrored 2026-09-04 from Palantir Foundry docs -->

# Monitoring rules reference

Monitoring rules are configured on a per-resource basis, with rules for the following resources:

* [Agents](#agent-rules)
* [Schedules](#schedule-rules)
* [Objects and links](#object-and-link-rules)
* [Streaming datasets](#streaming-dataset-rules)
* [Live deployments](#live-deployment-rules)
* [Time series syncs](#time-series-sync-rules)
* [Geotemporal observations](#geotemporal-observation-rules)
* [Automations](#automation-rules)
* [Datasets](#dataset-rules)
* [Functions](#function-rules)
* [Actions](#action-rules)

Most monitoring rules contain a configurable field called **Alert severity**, which is the severity granted to an alert when its condition is triggered. Some rules have a fixed severity, as noted in the tables below. Monitoring views can be configured to only send alerts that meet or exceed a certain severity.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Alert severity**   | [**Severity**](/docs/foundry/monitoring-views/overview/#configure-monitors) of monitoring report condition             | Low, Medium, High  |

## Agent rules

| Rule | Configuration | Conditions |
| ---- | ------------- | ---------- |
| [**Agent last heartbeat time**](#agent-last-heartbeat-time) | Configurable | Single condition |
| [**Agent manager last heartbeat time**](#agent-manager-last-heartbeat-time) | Configurable | Single condition |
| [**Agent manager version stale time**](#agent-manager-version-stale-time) | Configurable | Single condition |
| [**Agent version stale time**](#agent-version-stale-time) | Configurable | Single condition |
| [**High CPU utilization**](#high-cpu-utilization) | Configurable | Single condition |
| [**JVM heap usage is close to the limit**](#jvm-heap-usage-is-close-to-the-limit) | Configurable | Single condition |
| [**Low disk space**](#low-disk-space) | Configurable | Single condition |
| [**Time until earliest keystore certificate expires**](#time-until-earliest-keystore-certificate-expires) | Configurable | Single condition |
| [**Time until earliest truststore certificate expires**](#time-until-earliest-truststore-certificate-expires) | Configurable | Single condition |
| [**Queue size**](#queue-size) | Configurable | Single condition |

### Agent last heartbeat time

Alerts when the agent bootstrapper's last heartbeat is older than a set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Amount of time elapsed since the last heartbeat received from the agent bootstrapper            | 10 minutes         |

**We recommend setting this monitor value to 10 minutes.**

### Agent manager last heartbeat time

Alerts when the agent manager's last heartbeat is older than a set threshold.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than** | Amount of time elapsed since the last heartbeat received from the agent manager | 10 minutes |

### Agent manager version stale time

Alerts when the agent bootstrapper version has not been upgraded since a set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Amount of time elapsed since the agent manager has been on an old version                       | 10 days         |

**We recommend setting this monitor value to 10 days.**

### Agent version stale time

Alerts when the agent version has not been upgraded since a set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Amount of time elapsed since the agent has been on an older version                               | 10 days            |

**We recommend setting this monitor value to 10 days.**

### High CPU utilization

Alerts when the agent CPU utilization exceeds a set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Percentage of CPU utilization                                                                    | 80                |

**We recommend setting this monitor value to 80 (%).**

### JVM heap usage is close to the limit

Alerts when the JVM heap usage exceeds a set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Percentage of JVM heap used / JVM heap available                                                | 70                 |

**We recommend setting this monitor value to 70 (%).**

### Low disk space

Alerts when the available disk space drops below a set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is less than**   | Available disk space                                                                               | 10GB               |

**We recommend setting this monitor value to 10GB.**

### Time until earliest keystore certificate expires

Alerts when a certificate in the agent's keystore will expire within a set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is less than**   | Amount of time until a certificate expires                                                         | 10 days            |

\*\* We recommend setting this monitor value to medium severity at less than 30 days and high severity at less than 10 days.\*\*

### Time until earliest truststore certificate expires

Alerts when a certificate in the agent's truststore will expire within a set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is less than**   | Amount of time until a certificate expires                                                         | 10 days            |

**We recommend setting this monitor value to medium severity at less than 30 days and high severity at less than 10 days.**

### Queue size

Alerts when the number of jobs queued on an agent exceeds a set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | The number of jobs in the agent's job queue                                                     | 70                 |

**We recommend setting this monitor value to 70 (jobs).**

## Schedule rules

| Rule | Configuration | Conditions |
| ---- | ------------- | ---------- |
| [**Consecutive schedule failures**](#consecutive-schedule-failures) | Configurable | Single condition |
| [**Schedule duration**](#schedule-duration) | Configurable | Single condition |

### Consecutive schedule failures

Alerts when the number of consecutive schedule failures meets or exceeds a set threshold. This does not count schedule runs that result in a cancelled build.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than or equal to**   | Threshold of consecutive schedule failures                                          | 1                  |

The default behavior for this monitor is to alert with medium severity at one failure and high severity at three failures, though these thresholds are highly dependent on the frequency and stability of the schedules that are included in the monitoring rule's scope.

### Schedule duration

Alerts when a schedule is running longer than a set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than or equal to**   | The duration of the schedule                                                        | 2 hours            |
This monitor is typically used on highly critical schedules to quickly inform whether or not the schedule will complete in the expected time. Due to the variable nature of schedules, this monitor is often schedule-scoped.

## Object and link rules

:::callout{theme="neutral"}
A *user-caused failure* is a job failure that results from a problem with the configuration or input data, such as an invalid schema, a malformed row, or insufficient permissions. These failures are distinguished from transient or infrastructure-related failures, which are not surfaced by these alerts because they are typically resolved automatically by retries.
:::

| Rule | Configuration | Conditions |
| ---- | ------------- | ---------- |
| [**Changelog jobs failing**](#changelog-jobs-failing) | Configurable | Single condition |
| [**Merge changes job failing**](#merge-changes-job-failing) | Configurable | Single condition |
| [**Sync jobs failing**](#sync-jobs-failing) | Fixed high severity | Single condition |
| [**Scroll job failing on pipeline**](#scroll-job-failing-on-pipeline) | Configurable | Single condition |
| [**Sync propagation delay**](#sync-propagation-delay) | Configurable | Single condition |
| [**Liveness: Time since last successful checkpoint**](#liveness-time-since-last-successful-checkpoint-objects-and-links) | Configurable | Single condition |
| [**Invalid stream records detected**](#invalid-stream-records-detected) | Fixed high severity | Single condition |
| [**Invalid direct write records detected**](#invalid-direct-write-records-detected) | Fixed high severity | Single condition |

### Changelog jobs failing

Alerts when the ["changelog" job](/docs/foundry/object-indexing/funnel-batch-pipelines/#changelog) for the object or link is failing on either the [active pipeline](/docs/foundry/object-indexing/funnel-batch-pipelines/#live-pipelines) or the [replacement pipeline](/docs/foundry/object-indexing/funnel-batch-pipelines/#replacement-pipelines). Only alerts on user-caused failures.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than or equal to**   | Threshold of consecutive user-caused changelog job failures                         | 1                  |

The default behavior for this monitor is to alert with medium severity at one failure and high severity at three failures.

### Merge changes job failing

Alerts when the ["merge changes" job](/docs/foundry/object-indexing/funnel-batch-pipelines/#merge-changes) for the object or link is failing on either the [active pipeline](/docs/foundry/object-indexing/funnel-batch-pipelines/#live-pipelines) or the [replacement pipeline](/docs/foundry/object-indexing/funnel-batch-pipelines/#replacement-pipelines). Only alerts on user-caused failures.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than or equal to**   | Threshold of consecutive user-caused merge job failures                             | 1                  |

The default behavior for this monitor is to alert with medium severity at one failure and high severity at three failures.

### Sync jobs failing

Alerts with high severity when a foreground [sync job](/docs/foundry/object-indexing/funnel-batch-pipelines/#indexing) for the object or link fails terminally on either the [active pipeline](/docs/foundry/object-indexing/funnel-batch-pipelines/#live-pipelines) or the [replacement pipeline](/docs/foundry/object-indexing/funnel-batch-pipelines/#replacement-pipelines). A terminal failure means that the job will not be retried, either because the failure is not retryable or because the job encountered too many unrecoverable errors. This rule is non-configurable.

### Scroll job failing on pipeline

Alerts when the ["scroll" job](/docs/foundry/object-indexing/funnel-streaming-pipelines/#configuring-streaming-object-types) for the object or link's active or replacement pipeline is failing. Scroll jobs are responsible for streaming data from the backing datasource to the object databases.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than or equal to**   | Threshold of consecutive scroll job failures                                        | 3                  |

The default behavior for this monitor is to alert with low severity at one failure, medium severity at three failures, and high severity at seven failures, and these values are configurable.

### Sync propagation delay

Alerts when a dataset backing the object has a transaction with a sync time that exceeds a set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than or equal to**   | Threshold of time taken to sync a transaction                                       | 1 day              |

### Liveness: Time since last successful checkpoint (objects and links)

Alerts if a stream backing the object or link has not completed a checkpoint within the configured threshold. This rule detects streams that are not running and streams that are failing to checkpoint. The default threshold is 2 minutes at high severity.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than or equal to** | Threshold of time elapsed since the last successful checkpoint | 2 minutes |

### Invalid stream records detected

Alerts when records in an input stream contain format violations. The scroll job ignores these records. This rule is non-configurable, alerting with high severity when the number of ignored rows is greater than or equal to one.

### Invalid direct write records detected

Alerts when direct-write records are rejected because of validation failures. This rule is non-configurable, alerting with high severity when the number of rejected records is greater than or equal to one.

## Streaming dataset rules

### Derived stream monitors

| Rule | Configuration | Conditions |
| ---- | ------------- | ---------- |
| [**Last checkpoint duration**](#last-checkpoint-duration) | Configurable | Single condition |
| [**Liveness: Time since last successful checkpoint**](#liveness-time-since-last-successful-checkpoint) | Configurable | Single condition |
| [**Consecutive checkpoint failures**](#consecutive-checkpoint-failures) | Configurable | Single condition |
| [**Checkpoint trigger failure rate**](#checkpoint-trigger-failure-rate) | Configurable | Single condition |
| [**Total lag**](#total-lag) | Configurable | Single condition |
| [**Total lag V2**](#total-lag-v2) | Configurable | Single condition |
| [**Sustained lag**](#sustained-lag) | Configurable | Single condition |
| [**Checkpoint size**](#checkpoint-size) | Configurable | Single condition |
| [**Total throughput**](#total-throughput) | Configurable | Single condition |
| [**Total throughput V2 (less than)**](#total-throughput-v2-less-than) | Configurable | Single condition |
| [**Total throughput V2 (greater than)**](#total-throughput-v2-greater-than) | Configurable | Single condition |
| [**Job Manager CPU usage**](#job-manager-cpu-usage) | Configurable | Single condition |
| [**Job Manager memory usage**](#job-manager-memory-usage) | Configurable | Single condition |
| [**Task Manager CPU usage**](#task-manager-cpu-usage) | Configurable | Single condition |
| [**Task Manager memory usage**](#task-manager-memory-usage) | Configurable | Single condition |

#### Last checkpoint duration

Alerts if the last checkpoint took more time than the configured threshold to complete.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of time taken to checkpoint                                                           | 7 minutes         |

#### Liveness: Time since last successful checkpoint

Alerts if the stream has not completed a checkpoint since the configured threshold. The default threshold configuration is 5 minutes. This monitor encompasses streams that are not running as well as streams failing a checkpoint.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than or equal to**   | Threshold of time elapsed since last checkpoint                                     | 5 minutes          |

#### Consecutive checkpoint failures

Alerts when the number of consecutive checkpoint failures meets or exceeds the configured threshold. The default high-severity threshold is five failures.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than or equal to** | Threshold of consecutive checkpoint failures | 5 |

#### Checkpoint trigger failure rate

Alerts when the number of checkpoint trigger failures over a configured window exceeds the specified threshold.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than** | Threshold of checkpoint trigger failures | 0 |
| **Time window** | The time period to count checkpoint trigger failures in | 5 minutes |

#### Total lag

Alerts if a stream's lag (total unprocessed upstream records) exceeds the set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of unprocessed upstream records                                                       | 1000               |

This monitor indicates that streaming transforms are taking too long to run, or there is a problem with the streaming transforms infrastructure.

#### Total lag V2

Alerts when the total number of unprocessed records from streaming inputs meets or exceeds the configured threshold throughout a 5-minute window. The default high-severity threshold is 1,000 records.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than or equal to** | Threshold of unprocessed records | 1,000 |

#### Sustained lag

Alerts when the total number of unprocessed records stays at or above the configured threshold for the entire configured window. You can configure a window from 2 minutes through 1 hour; the default is 5 minutes.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than or equal to** | Threshold of unprocessed records | 1,000 |
| **Time window** | Time during which lag must remain above the threshold | 5 minutes |

#### Checkpoint size

Alerts when the latest checkpoint size exceeds the configured threshold.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than** | Threshold of checkpoint size, in bytes | 100 bytes |

#### Total throughput

Alerts if a stream's throughput (records processed per checkpoints) falls below the set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is less than**   | Threshold of records processed per checkpoint                                                      | 100                |

This monitor indicates that streaming transforms are taking too long to run, or there is a problem with the streaming transforms infrastructure.

#### Total throughput V2 (less than)

Alerts when the number of records processed per checkpoint from streaming inputs stays below the configured threshold throughout a 5-minute window.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is less than** | Threshold of records processed per checkpoint | 100 |

#### Total throughput V2 (greater than)

Alerts when the number of records processed per checkpoint from streaming inputs stays above the configured threshold throughout a 5-minute window.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than** | Threshold of records processed per checkpoint | 100 |

#### Job Manager CPU usage

Alerts when Job Manager CPU utilization exceeds the configured threshold.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than** | Threshold of Job Manager CPU utilization | 80% |

#### Job Manager memory usage

Alerts when Job Manager memory utilization exceeds the configured threshold.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than** | Threshold of Job Manager memory utilization | 80% |

#### Task Manager CPU usage

Alerts when CPU utilization for a Task Manager meets or exceeds the configured threshold throughout a 10-minute window.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than or equal to** | Threshold of Task Manager CPU utilization | 80% |

#### Task Manager memory usage

Alerts when memory utilization for a Task Manager meets or exceeds the configured threshold throughout a 10-minute window.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than or equal to** | Threshold of Task Manager memory utilization | 80% |

### Ingest stream monitors

| Rule | Configuration | Conditions |
| ---- | ------------- | ---------- |
| [**Records ingested over selected window**](#records-ingested-over-selected-window) | Configurable | Single condition |
| [**Total throughput (less than or equal to)**](#total-throughput-less-than-or-equal-to) | Configurable | Single condition |
| [**Total throughput (greater than or equal to)**](#total-throughput-greater-than-or-equal-to) | Configurable | Single condition |
| [**High source staleness**](#high-source-staleness) | Configurable | Single condition |

#### Records ingested over selected window

Alerts if the number of records ingested into the raw stream's live view over the selected time window was less than or equal to the configured threshold. Available windows are 5 minutes, 30 minutes, 1 hour, 4 hours, and 1 day.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is less than or equal to**   | Threshold of ingested records per unit time                                            | 100                |

#### Total throughput (less than or equal to)

Alerts when the number of records processed per second stays at or below the configured threshold throughout a 5-minute window.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is less than or equal to** | Threshold of records processed per second | 100 |

#### Total throughput (greater than or equal to)

Alerts when the number of records processed per second stays at or above the configured threshold throughout a 5-minute window.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than or equal to** | Threshold of records processed per second | 100 |

#### High source staleness

Alerts when source data staleness exceeds the configured threshold. This rule is available only when latency sampling is enabled and the data connection task supplies a source timestamp.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than** | Threshold of source data staleness | 20 seconds |

## Live deployment rules

| Rule | Configuration | Conditions |
| ---- | ------------- | ---------- |
| [**Live deployment heartbeat**](#live-deployment-heartbeat) | Configurable | Single condition |

### Live deployment heartbeat

Alerts when deployment has not emitted a heartbeat for more than one minute.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than or equal to**   | Threshold of time elapsed since last heartbeat                                      | 1 minute           |

## Time series sync rules

| Rule | Configuration | Conditions |
| ---- | ------------- | ---------- |
| [**Points written by the time series sync over last 5 or 30 minutes**](#points-written-by-the-time-series-sync-over-last-5-or-30-minutes) | Configurable | Single condition |
| [**Time series stream liveness: Time since last successful checkpoint**](#time-series-stream-liveness-time-since-last-successful-checkpoint) | Configurable | Single condition |

### Points written by the time series sync over last 5 or 30 minutes

Alerts if the number of points written by the time series sync over the last 5 or 30 minute window was less than or equal to the configured threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is less than or equal to**   | Threshold of points written per unit time                                              | 100                |

### Time series stream liveness: Time since last successful checkpoint

Alerts if the streaming time series sync has not completed a checkpoint since the configured threshold. The default high-severity threshold is 2 minutes.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **If value is greater than or equal to** | Threshold of time elapsed since the last successful checkpoint | 2 minutes |

## Dataset rules

| Rule | Configuration | Conditions |
| ---- | ------------- | ---------- |
| [**Time since job last succeeded**](#time-since-job-last-succeeded) | Configurable | Single condition |

### Time since job last succeeded

Alerts when a job on a dataset has not succeeded within a specified time threshold. Unlike the "Time since last updated" health check, the following conditions count as a passing status for the monitor:

* The job succeeded, but the transaction was aborted
* The job succeeded, but no new data was added

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than or equal to**   | Amount of time elapsed since a job last succeeded                                           | 1 day              |

**We recommend setting this monitor value based on your dataset's expected update frequency. For daily updates, set it to 1 day.**

## Geotemporal observation rules

| Rule | Configuration | Conditions |
| ---- | ------------- | ---------- |
| [**Geotemporal observations sent over last 5 or 30 minutes**](#geotemporal-observations-sent-over-last-5-or-30-minutes) | Configurable | Single condition |

### Geotemporal observations sent over last 5 or 30 minutes

Alerts if the number of geotemporal observations sent over the last 5 or 30 minute window was less than or equal to the configured threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is less than or equal to**   | Threshold of geotemporal observations sent per unit time                               | 100                |

## Automation rules

The following rules apply to both automations and time series streaming automations.

| Rule | Configuration | Conditions |
| ---- | ------------- | ---------- |
| [**Automation has no new evaluations**](#automation-has-no-new-evaluations) | Configurable | Single condition |
| [**Automation has no new triggers**](#automation-has-no-new-triggers) | Configurable | Single condition |
| [**Automation has been disabled by the system**](#automation-has-been-disabled-by-the-system) | Fixed high severity | Single condition |
| [**Automation had repeated execution failures in a window**](#automation-had-repeated-execution-failures-in-a-window) | Configurable | Single condition |
| [**Automation had repeated evaluation failures in a window**](#automation-had-repeated-evaluation-failures-in-a-window) | Configurable | Single condition |
| [**Automation had a high number of effect execution failures in a window**](#automation-had-a-high-number-of-effect-execution-failures-in-a-window) | Configurable | Single condition |

### Automation has no new evaluations

Alerts if there has been no new evaluation since the configured threshold. Use this rule to detect performance degradation in an automation that should have been evaluated but did not. This rule does not alert when the automation has not been triggered.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than or equal to**   | Threshold of time elapsed since last automation evaluation                          | 1 hour             |

### Automation has no new triggers

Alerts if there have been no new monitor triggers within the configured threshold. Use this rule to detect when an automation is not being triggered as expected.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than or equal to**   | Threshold of time elapsed since last automation trigger                              | 1 day              |

### Automation has been disabled by the system

Alerts if an automation was disabled by the system due to reaching limits or triggering cycles. This rule is non-configurable, alerting with high severity when the automation is disabled.

### Automation had repeated execution failures in a window

Alerts when the number of failed automation executions in the window exceeds the configured threshold. Use this rule to surface automations that keep running and failing rather than ones the system has already disabled.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of number of failed executions  | 0 |
| **Time window**   | The time period to count failed executions in  | 1 hour |

### Automation had repeated evaluation failures in a window

Alerts when the number of failed automation evaluations in the window exceeds the configured threshold. Use this rule to catch automations whose trigger conditions fail to evaluate, separately from failures that occur during execution.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of number of failed evaluations  | 0 |
| **Time window**   | The time period to count failed evaluations in  | 1 hour |

### Automation had a high number of effect execution failures in a window

Alerts when the number of failed effect executions in the window exceeds the configured threshold. Effects are the downstream actions or notifications the automation runs. Use this rule to catch automations whose effects fail even when their triggers and evaluations succeed.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of number of failed effect executions  | 0 |
| **Time window**   | The time period to count failed effect executions in  | 1 hour |

## Function rules

Function executions can fail for a variety of reasons. For a full list of failure types, see [function failure types](/docs/foundry/functions/function-metrics/#function-failure-types).

| Rule | Configuration | Conditions | Failure types included |
| ---- | ------------- | ---------- | ---------------------- |
| [**Function duration p95**](#function-duration-p95) | Configurable | Single condition | Not applicable |
| [**Number of function failures in window**](#number-of-function-failures-in-window) | Configurable | Single condition | All |
| [**Number of user-facing function failures in window**](#number-of-user-facing-function-failures-in-window) | Configurable | Single condition | User-facing only |
| [**Number of non-user-facing function failures in window**](#number-of-non-user-facing-function-failures-in-window) | Configurable | Single condition | All except user-facing |
| [**Function failure rate in window**](#function-failure-rate-in-window) | Configurable | Composite (`AND`) | All |
| [**Non-user-facing function failure rate in window**](#non-user-facing-function-failure-rate-in-window) | Configurable | Composite (`AND`) | All except user-facing |

Composite rules combine a failure-percentage threshold with a minimum run-count threshold. The rule triggers only when both conditions reach a configured severity, which prevents alerts based on too little data.

### Function duration p95

Alerts when the p95 function duration exceeds the specified thresholds. The p95 is measured over a sliding window of recent data.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of duration  | 10s |

### Number of function failures in window

Alerts when the total number of failed executions of a function in the given window exceeds a given threshold. This rule tracks [all failure types](#function-rules), including both user-facing and non-user-facing errors.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of number of failures  | 0 |
| **Time window**   | The time period to count failures in  | 1 hour |

### Number of user-facing function failures in window

Alerts when the number of user-facing function failures over a given window exceeds the specified thresholds. This rule tracks only [user-facing errors](#function-rules) thrown by function code.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of number of failures  | 0 |
| **Time window**   | The time period to count failures in  | 1 hour |

### Number of non-user-facing function failures in window

Alerts when the number of function failures over a given window exceeds the specified thresholds, excluding user-facing errors thrown by function code. This rule is useful for monitoring infrastructure and system-level failures without noise from expected user input errors.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of number of failures  | 0 |
| **Time window**   | The time period to count failures in  | 1 hour |

### Function failure rate in window

Alerts when both the percentage of function runs that fail and the total number of runs exceed the specified thresholds over a given window. The total run count condition prevents the rule from triggering on low-traffic functions.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **Failure percentage (%) is greater than** | Threshold for the percentage of runs that fail, from 0 through 100 | 10 |
| **Total run count is greater than** | Minimum number of runs required before the rule triggers | 10 |
| **Time window** | The time period used to calculate both conditions | 5 minutes |

### Non-user-facing function failure rate in window

Alerts when both the percentage of function runs that fail with non-user-facing errors and the total number of runs exceed the specified thresholds over a given window. This rule excludes user-facing errors thrown by function code. The total run count condition prevents the rule from triggering on low-traffic functions.

| Rule component | Description | Example options |
| -------------- | ----------- | --------------- |
| **Failure percentage (%) is greater than** | Threshold for the percentage of runs that fail with non-user-facing errors, from 0 through 100 | 10 |
| **Total run count is greater than** | Minimum number of runs required before the rule triggers | 10 |
| **Time window** | The time period used to calculate both conditions | 5 minutes |

## Action rules

Action executions can fail for a variety of reasons. For a full list of failure types, see [action failure types](/docs/foundry/action-types/action-metrics/#action-failure-types).

| Rule | Configuration | Conditions | Failure types included |
| ---- | ------------- | ---------- | ---------------------- |
| [**Action duration p95**](#action-duration-p95) | Configurable | Single condition | Not applicable |
| [**Number of action failures in window**](#number-of-action-failures-in-window) | Configurable | Single condition | All |
| [**Number of non-user-facing action failures in window**](#number-of-non-user-facing-action-failures-in-window) | Configurable | Single condition | All except user-facing function failures |

### Action duration p95

Alerts when the p95 action duration exceeds the specified thresholds. The p95 is measured over a sliding window of recent data.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of duration  | 10s |

### Number of action failures in window

Alerts when the total number of failed executions of an action in the given window exceeds a given threshold. This rule tracks [all failure types](#action-rules), including both user-facing and non-user-facing errors.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of number of failures  | 0 |
| **Time window**   | The time period to count failures in  | 1 hour |

### Number of non-user-facing action failures in window

Alerts when the number of action failures over a given window exceeds the specified thresholds, excluding failures caused by user-facing errors thrown by function-backed action code. This rule is useful for monitoring infrastructure and system-level failures without noise from expected user input errors.

This rule tracks [all failure types](#action-rules) *except* user-facing function failures thrown by function code and displayed to users.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of number of failures  | 0 |
| **Time window**   | The time period to count failures in  | 1 hour |
