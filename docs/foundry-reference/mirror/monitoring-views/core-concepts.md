<!-- source: https://palantir.com/docs/foundry/monitoring-views/core-concepts/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Core concepts

This page provides an introduction to the core concepts underlying monitoring views.

* **Metric:** Resources emit metrics, or logs. Monitors are created on top of these metrics to set a user’s standards of performance on a given resource.
* **Resource:** A “thing” in Foundry that can be monitored, including datasets, agents, schedules, objects, and link types.
* **Scope:** A scope is the boundary around the set of resources on which your thresholds are set. Scopes can be static or dynamic:
  * **Static scopes** monitor a fixed resource that you explicitly select:
    * **Single:** The monitor is only applied to that specific resource.
  * **Dynamic scopes** automatically update as resources are added or removed, without requiring manual changes to the monitor:
    * **Folder:** The monitor is applied to resources of the specified type in the scoped folder, not including subfolders.
    * **Project:** The monitor is applied to any resources of the specified type in the project or multiple projects.
    * **Workflow Lineage:** For function and action type monitors, the monitor is applied to all functions or actions used by a Workflow Lineage.
    * **Workshop:** For function and action type monitors, the monitor is applied to all functions or actions used by a Workshop application.
    * **OSDK application:** For function and action type monitors, the monitor is applied to all functions or actions used by an OSDK application.
* **Monitoring rule:** A threshold or set of thresholds put on the metrics of a resource within a given scope and contain:
  * Resource type
  * Metric threshold tolerances
  * Severity level assignment
* **Monitoring view:** A collection of monitoring rules that a group of subscribers care about.
* **Subscriber:** A user subscribed to a monitoring view.
* **Alerts:** Notifications that can have low, medium, or high assignments and are sent to subscribers.
* **Severity:** A label assigned to a monitoring rule that classifies the urgency of alerts it produces. Monitoring views support three severity levels: `LOW`, `MEDIUM`, and `HIGH`. Severity acts as a routing mechanism: in-Foundry notifications and each [external integration](/docs/foundry/monitoring-views/external-systems/) are configured against a specific severity level, and only alerts matching that severity trigger the integration. You can map severity levels to notification channels in whatever way fits your team's workflow — for example, a team running a critical pipeline might route `HIGH` to an on-call paging tool while sending `MEDIUM` and `LOW` to the same review queue, whereas a team monitoring a low-stakes resource might direct all three severities to a single chat channel.
