<!-- source: https://palantir.com/docs/foundry/object-monitors/overview/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Object Monitors \[Sunset]

:::callout{theme="warning" title="Sunset"}
Object Monitors are in the [sunset](/docs/foundry/platform-overview/development-life-cycle/) phase of development and will be deprecated at a future date. Full support remains available. We recommend migrating your workflows to [Automate](/docs/foundry/automate/overview/). Automate is a fully backwards-compatible product that offers a single entry point for all business automation in the platform.
:::

The **Object Monitors** application allows end users and application builders to see when data in the Foundry Ontology changes. When a change occurs, object monitors can automatically send notifications or submit Actions when specified conditions are met. Object monitors run on top of your data and are designed to help users track individual searches and objects. Object monitors also serve as a tool for application builders to include monitoring and alerting functionality as part of applications built in Foundry.

Object monitoring is a feature of the objects layer in Foundry and can be used for a variety of workflows, including:

* **Watched searches:** Users may configure object monitors to notify when saved object explorations have new results or when an aggregate criteria is met across all results from a search.
* **Automated notifications:** Workflow builders and self-service data consumers may configure object monitors to send notifications in response to data changes. Notifications may be sent via:
  * In-platform pop-up in the Foundry notifications center
  * Email
  * SMS (using [webhooks](/docs/foundry/data-connection/webhooks-overview/) to a third-party service such as [Twilio ↗](https://www.twilio.com/))
  * Instant message (using webhooks to a third-party service such as [Slack ↗](https://slack.com/) or [Microsoft Teams ↗](https://www.microsoft.com/microsoft-teams/group-chat-software))
  * Bespoke or proprietary messaging systems
* **Workflow automation:** Object monitors may be used to automatically perform Actions on object data that meet a specific criteria. Some tasks that can be automated with object monitors include:
  * Checking for data anomalies and automatically passing those objects into an Action with logic to remediate the issue.
  * Watching for suggestions or potential Actions and automatically applying them when pre-configured event and time conditions are met. Such Actions could include making an API call to an external system via webhooks to apply a change directly in the external system.

## Access Object Monitors

To access the Object Monitors application, click on the name or icon in your Foundry navigation sidebar to the left of your browser. The **Overview** page will show a list of your recent monitor activity along with counts of total monitors, subscribed or muted monitors, and monitors that have errors or will be expiring soon.

The **Monitors** page shows a full list of the monitors available to you. Filter this list by activity status, notification and Action settings, creator, expiration date, monitor type, or condition status. Click on a monitor to open the monitor overview panel and view historical activity, subscribers, and other details.

Learn more about object monitoring by [creating a new object monitor](/docs/foundry/object-monitors/create_new_object_monitor/).

:::callout{theme="neutral"}
Object monitoring is designed to monitor the content of your data. If you are looking for health monitoring for data connections and pipeline builds, review the [Health checks](/docs/foundry/health-checks/overview/) documentation.
:::
