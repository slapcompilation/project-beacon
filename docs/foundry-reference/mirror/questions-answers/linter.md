<!-- source: https://palantir.com/docs/foundry/questions-answers/linter/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Linter

### How often does Linter run sweeps?

Linter runs sweeps weekly by default, but this is configurable.

*Timestamp:* April 11, 2024

### Is there an auto-fix feature available in Linter?

Linter does not currently support auto-fix, but there is work in progress to enable this in the future.

*Timestamp:* April 11, 2024

### How should I interpret the batch compute savings number for a collection of datasets built on different schedules?

The batch compute savings number represents the sum of resource usage across all unused resources in the schedule over the last calendar month, aggregated and not distinguishing between different schedules. To make better estimates, you can look at past builds of the dataset and see the allocation that came from each schedule.

*Timestamp:* April 11, 2024

### How can I avoid double-counting in impact tracking if the dataset is removed from both schedules?

To avoid double-counting in impact tracking when removing the dataset from both schedules, you need to pass an "invalidate" flag to the second schedule as soon as you action the first.

*Timestamp:* April 11, 2024

### How can a user enable Linter on their Foundry enrollment?

An enrollment admin needs to first enable the application in the **Application access** section of Control Panel.

*Timestamp:* April 9, 2024

### Why are "Schedule potentially unused" recommendations being flagged for datasets involved in external transformations, and how can this issue be addressed?

The alerts are flagged due to the Linter's inability to identify external transformations, treating them as false positives. The development team is actively working on enhancing Linter so that it can identify such cases better in the future.

*Timestamp:* April 11, 2024

### What permissions does Linter use when scanning, and are there any limitations that might prevent it from scanning a repository or folder?

Linter uses a service token with no restrictions on permissions for scanning, but user visibility on recommendations is limited by their permissions on the underlying resources. Note that Linter only considers scheduled resources for generating recommendations.

*Timestamp:* April 11, 2024

### Can Linter make recommendations inside code repositories, and how long does it take for Linter to start making recommendations for new projects?

Integration of Linter recommendations into code repositories is not currently available. For new projects, Linter can immediately start looking for recommendations if the project's [space](/docs/foundry/security/orgs-and-spaces/#spaces) is already in a linting scope. Some recommendations will appear immediately, while others may require a minimum duration to report a recommendation. There is no requirement for a project to exist for a specific amount of time before enabling Linter on it.

*Timestamp:* April 11, 2024

### Do users need to manually determine the amount of CPU and memory when actioning a "Transform should use lightweight" recommendation?

Yes, while there is a default lightweight profile suggested, manual tuning may be required to achieve the most optimal profile for a lightweight transform.

*Timestamp:* April 9, 2024

### How should the `DYNAMIC_ALLOCATION_MAX_N` value be determined when updating the transform profiles for optimizing over-provisioned cores?

The `DYNAMIC_ALLOCATION_MAX_N` value should be determined by either switching from `NUM_EXECUTORS_N` to enable dynamic allocation, thereby releasing idle executors, or by examining the job's Spark details to understand the actual average parallelism and selecting a maximum number of executors based on that. Additionally, enabling the `DYNAMIC_ALLOCATION_ENABLED` profile without changing the `NUM_EXECUTORS_N` profile achieves a similar optimization. Further guidance can be found in the provided documentation on dynamic allocation.

*Timestamp:* April 9, 2024

### What should be done when a schedule flagged in Linter is deleted and a new one created, but the deleted schedule's recommendation does not resolve?

This is a bug currently present in the product. The immediate workaround is to manually snooze the recommendation.

*Timestamp:* April 17, 2024

### How can we enable autofix for sweep schedules?

Autofix for sweep schedules does not currently exist as a feature.

*Timestamp:* June 24, 2024

### What should be done when builds fail due to Velox being turned on for transforms using an `EXECUTOR_MEMORY_SMALL` profile?

Try increasing the memory profile to `EXECUTOR_MEMORY_MEDIUM`, or to `EXECUTOR_MEMORY_OVERHEAD_MEDIUM`.

*Timestamp:* June 24, 2024

### How can I make a Data Connection ingest process more efficient when it is flagged with the "Incremental append dataset too many files" rule?

Use a Projection to compact the transactions, and schedule the Projection to build on a regular cadence, such as every 100 transactions or weekly, depending on the update frequency of the dataset.

*Timestamp:* June 12, 2024

### In the alert description stating "Some but not all can be built locally", does it refer to the datasets that can be built locally or all datasets in the workbook?

The alert refers to the datasets that can be built locally and not all datasets in the workbook.

*Timestamp:* July 30, 2024

### Where can we control what rules our Linter service is using, specifically for implementing user-scoped schedules?

You can create custom sweep schedules in the space settings. By default, the Linter only runs cost rules on all spaces, but the project-scoped schedule rule is categorized under 'best practice' rules.

*Timestamp:* May 23, 2024

### What are the permission requirements for accessing the Impact Tracking page?

The Impact Tracking page is accessible to everyone, but only the metrics of resources that the user can view are displayed. Viewer access on the resource is required to view the associated impact summary on that resource. Additionally, to view **Estimated saving** and **Verified saving**, the user must also have the `Resource management viewer/administrator` role at the enrollment level.

*Timestamp:* August 20, 2024

### Why can I only see "Force builds" recommendations for pipeline resilience rules?

Resource saving rules do not need to be set up manually, as the sweep for that category is on by default. However, other categories, such as pipeline resilience rules, do not have a respective sweep schedule turned on by default.
Some rules, such as "Force builds", can be in multiple categories (such as resource saving and pipeline resilience rules). As this rule is included in the cost savings, it is turned on by default.
You can turn on more sweep schedules, such as "Best practices rules" (which feed the pipeline resilience mode), in the sweep schedule configuration in Control Panel or by individually including pipeline resilience rules.

*Timestamp:* August 22, 2024

### How can I enabled other rules for "Pipeline resilience" in Linter?

By default, only cost rules are enabled in the Linter app. To enable other Pipeline Resilience rules, you need to manually configure your sweep schedule to include the appropriate rules/presets. More information on this can be found [here](/docs/foundry/linter/sweep-schedules/).

*Timestamp:* September 17, 2024

### How can I view which Linter alert resulted in the various savings spikes on the "Estimated savings" tab?

You need to switch to the tabular view on the impact tracking page to see this information.

*Timestamp:* December 10, 2024
