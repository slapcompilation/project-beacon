<!-- source: https://palantir.com/docs/foundry/automate/overview/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Automate

:::callout{theme="info"}
Automate is a fully backwards-compatible product that replaces [Object Monitoring](/docs/foundry/object-monitors/overview/) as the single entry point for all business automation in the platform.
:::

**Automate** is an application for business automation. With Automate, you can define conditions that are checked continuously or on a schedule, along with effects that execute automatically when the specified conditions are met.

Conditions can be *time-based conditions* ("trigger every Monday at 9 AM"), *object data conditions* built on top of the Foundry Ontology ("trigger when a new `Alert` object with priority `high` is added"), or a combination of time-based and object data conditions.

**Available effects:**

* Submit [Foundry actions](/docs/foundry/action-types/overview/)
* Trigger [AIP Logic functions](/docs/foundry/logic/overview/)
* Execute [Foundry functions](/docs/foundry/functions/overview/)
* Send platform and email notifications with attachments

Learn more about configuring effects, including fallback effects and execution settings, in the [Effects](/docs/foundry/automate/effects/) documentation.

## Use cases

Automate can be used for a variety of different automation workflows, including:

* [**Scheduled report sending and digests:**](/docs/foundry/automate/example-weekly-report/) Specify a time and send out weekly reports to a predefined list of recipients. PDFs generated from [Notepad](/docs/foundry/notepad/overview/), [Notepad templates](/docs/foundry/notepad/templates-overview/), or [Contour dashboards](/docs/foundry/contour/dashboards-overview/) can be attached to emails automatically.
* **Data alerting:** Define and watch object sets and alert users when specific data conditions are met; for example, when the total count of open issue objects crosses a threshold.
* **Workflow automation:** Automate can be used to automatically perform Actions on object data meeting specified criteria. Some tasks that can be automated include:
  * Checking for data anomalies and automatically passing those objects into an Action with logic to remediate the issue.
  * Watching for suggestions or potential Actions and automatically applying them when preconfigured event and time conditions are met. Such Actions could include making an API call to an external system via Webhooks to apply a change directly in the external system.
* **Watched searches:** Configure automations to notify when saved object explorations have new results or when an aggregate criterion is met across all results from a search; for example, the maximum temperature across all sensor objects crosses a threshold.

## Best practices

Follow [performance best practices](/docs/foundry/automate/performance-best-practices/) to minimize compute consumption and run automations efficiently at scale.

## Branching support

Automate integrates with [Global Branching](/docs/foundry/global-branching/overview/). You can create, test, and modify automations on a branch before merging changes to `main`. For details, see [branching automations](/docs/foundry/automate/branching-automations/).

## Access Automate

To access Automate, select the Automate application icon in your Foundry navigation sidebar. Follow the steps in our documentation on [getting started with Automate](/docs/foundry/automate/getting-started/) to begin.

:::callout{theme="neutral"}
Automate is designed for business automation. If you are looking for health monitoring for data connections and pipeline builds, see the [Health checks](/docs/foundry/health-checks/overview/) documentation.
:::
