<!-- source: https://palantir.com/docs/foundry/monitoring-views/rules-reference/ · mirrored 2026-08-14 from Palantir Foundry docs -->

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

All monitoring rules contain a configurable field called **Alert severity** which is the severity granted to an alert when its condition is triggered. Monitoring views can be configured to only send out alerts that meet or exceed a certain severity.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Alert severity**   | [**Severity**](/docs/foundry/monitoring-views/overview/#configure-monitors) of monitoring report condition             | Low, Medium, High  |

## Agent rules

### Agent last heartbeat time

Alerts when the agent bootstrapper's last heartbeat is older than a set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Amount of time elapsed since the last heartbeat received from the agent bootstrapper            | 10 minutes         |

**We recommend setting this monitor value to 10 minutes.**

### Agent manager version stale time

Alerts when the agent bootstrapper version has not been upgraded since a set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Amount of time elapsed since the agent manager has been on an old version                       | 10 minutes         |

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

Alerts when the ["sync" job](/docs/foundry/object-indexing/funnel-batch-pipelines/#indexing) for the object or link is failing on either the [active pipeline](/docs/foundry/object-indexing/funnel-batch-pipelines/#live-pipelines) or the [replacement pipeline](/docs/foundry/object-indexing/funnel-batch-pipelines/#replacement-pipelines).

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than or equal to**   | Threshold of consecutive sync job failures                                          | 3                  |

The default behavior for this monitor is to alert with low severity at one failure, medium severity at three failures, and high severity at seven failures.

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

### Invalid stream records detected

Alerts when records in an input stream contain format violations. The scroll job ignores these records. This rule is non-configurable, alerting with critical severity when the number of ignored rows is greater than or equal to one.

## Streaming dataset rules

### Derived stream monitors

#### Last checkpoint duration

Alerts if the last checkpoint took more time than the configured threshold to complete.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of time taken to checkpoint                                                           | 10 minutes         |

#### Liveness: time since last successful checkpoint

Alerts if the stream has not completed a checkpoint since the configured threshold. The default threshold configuration is 2 minutes. This monitor encompasses streams that are not running as well as streams failing a checkpoint.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than or equal to**   | Threshold of time elapsed since last checkpoint                                     | 2 minutes          |

#### Total lag

Alerts if a stream's lag (total unprocessed upstream records) exceeds the set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of unprocessed upstream records                                                       | 1000               |

This monitor indicates that streaming transforms are taking too long to run, or there is a problem with the streaming transforms infrastructure.

#### Total throughput

Alerts if a stream's throughput (records processed per checkpoints) falls below the set threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is less than**   | Threshold of records processed per checkpoint                                                      | 100                |

This monitor indicates that streaming transforms are taking too long to run, or there is a problem with the streaming transforms infrastructure.

### Ingest stream monitors

#### Records ingested over last 5 minutes / 30 minutes / 1 hour / 4 hours / 1 day

Alerts if the number of records ingested into the raw stream's live view over the selected time window was less than or equal to the configured threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is less than or equal to**   | Threshold of ingested records per unit time                                            | 100                |

## Live deployment rules

### Live deployment heartbeat

Alerts when deployment has not emitted a heartbeat for more than one minute.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than or equal to**   | Threshold of time elapsed since last heartbeat                                      | 1 minute           |

## Time series sync rules

### Points written by the time series sync over last 5 or 30 minutes

Alerts if the number of points written by the time series sync over the last 5 or 30 minute window was less than or equal to the configured threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is less than or equal to**   | Threshold of points written per unit time                                              | 100                |

## Dataset rules

### Time since job last succeeded

Alerts when a job on a dataset has not succeeded within a specified time threshold. Unlike the "Time since last updated" health check, the following conditions will always count as a passing status for the monitor:

* The job succeeded, but the transaction was aborted
* The job succeeded, but no new data was added

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Amount of time elapsed since the dataset was last updated                                           | 1 day              |

**We recommend setting this monitor value based on your dataset's expected update frequency. For daily updates, set it to 1 day.**

## Geotemporal observation rules

### Geotemporal observations sent over last 5 or 30 minutes

Alerts if the number of geotemporal observations sent over the last 5 or 30 minute window was less than or equal to the configured threshold.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is less than or equal to**   | Threshold of geotemporal observations sent per unit time                               | 100                |

## Automation rules

The following rules apply to both automations and time series streaming automations.

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

### The single latest event exceeded the automation's failure threshold

Alerts if the single most recent execution had at least the configured number of failures. This does not take into account multiple events.

| Rule component | Description                                                                                                     | Example options    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **If value is greater than**   | Threshold of number of failures in most recent automation execution                             | 10                 |

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

The [**Number of function failures in window**](#number-of-function-failures-in-window) rule tracks *all* failure types. The [**Number of user-facing function failures in window**](#number-of-user-facing-function-failures-in-window) rule tracks only user-facing errors. The [**Number of non-user-facing function failures in window**](#number-of-non-user-facing-function-failures-in-window) rule tracks all failure types *except* user-facing errors.

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

## Action rules

Action executions can fail for a variety of reasons. For a full list of failure types, see [action failure types](/docs/foundry/action-types/action-metrics/#action-failure-types).

The [**Number of action failures in window**](#number-of-action-failures-in-window) rule tracks *all* failure types. The [**Number of non-user-facing action failures in window**](#number-of-non-user-facing-action-failures-in-window) rule tracks all failure types *except* user-facing function failures.

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
