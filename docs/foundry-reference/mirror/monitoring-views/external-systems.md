<!-- source: https://palantir.com/docs/foundry/monitoring-views/external-systems/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Sending alerts to external systems

When monitors fire or resolve, alerts can be sent to subscribed users within Foundry as well as to services external to Foundry. Monitoring views currently support sending alerts to [PagerDuty](#pagerduty), [Slack](#slack), and [webhooks](#webhooks).

:::callout{theme="neutral"}
All integrations are configured against a given severity level. Only alerts matching that severity will trigger integration. For example, a PagerDuty integration configured for the `MEDIUM` severity level will not be triggered when monitors fire at `LOW` or `HIGH` severities.
:::

## PagerDuty

This integration uses the [PagerDuty V2 Events API ↗](https://developer.pagerduty.com/api-reference/YXBpOjI3NDgyNjU-pager-duty-v2-events-api) and usually does not require a service user, emails, or custom allowlisting or egress configuration. A single integration maps all alerts of a given severity within a monitoring view to an Events V2 API integration defined within a PagerDuty service. Note that multiple integrations defined within a monitoring view can map to the same PagerDuty integration key.

### Create an Events V2 API integration for your PagerDuty service

Configure a PagerDuty service with your desired escalation policy, urgency settings, and support hours. On the **Integrations** tab for the service, add a new integration. Select **Events API V2** as the integration type and add the integration; **Events API V2** can usually be found in the **Most popular integrations** section. Once the integration is added, selecting the gear symbol will show its details, including the **Integration Key** needed to [create a new PagerDuty integration for your monitoring view](#create-a-new-pagerduty-integration-for-your-monitoring-view).

### Create a new PagerDuty integration for your monitoring view

Navigate to the **Manage subscriptions** tab for your monitoring view. From the **PagerDuty Notifications** section, select the plus sign (**+**) to create a new PagerDuty integration. You will need to specify a name for the integration, the integration key from when you created the Events V2 API integration, and the severity level. Repeat as needed for each desired severity level.

### Enable PagerDuty for health checks

By default, the monitoring view will produce PagerDuty notifications for monitoring rule alerts and legacy health checks that belong to the check group that was upgraded/linked to the monitoring view. However, monitoring views created before the v1.860.0 release (February 2024) will not produce PagerDuty alerts by default and must be manually enabled.

To enable this feature, select the **Enable PagerDuty for health checks** checkbox. The following severity mappings will be used:

* Info/low severity health checks will use the `LOW` severity integrations.
* Moderate/medium severity health checks will use the `MEDIUM` severity integrations.
* Critical/high severity health checks will use the `HIGH` severity integrations.

## Slack

This integration can trigger Slack messages in a set of configured channels.

### Create a Slack source

This integration requires a Slack source to be created in Data Connection. This source requires a bearer token to be configured. This bearer token should have the following scopes:

* `channels:join`: Foundry will have the app join the requested channels automatically.
* `channels:read`: This is used to list the available channels.
* `chat:write`: This is used to send messages to the configured channels.
* (optional) `groups:read`: Required for sending messages to private channels.

An example way to generate such a token in Slack is:

1. Create a new Slack App in your workspace.
2. Go to **OAuth & Permissions**.
3. Add the above scopes as **Bot Token Scopes**.
4. Install the Slack App in your workspace.
5. Copy the **Bot User OAuth Token**.

See [Slack API documentation ↗](https://api.slack.com/apps) for more details.

### Create a Slack integration for your monitoring view

Navigate to the **Manage subscriptions** tab for your monitoring view; in the **Slack** section, use the plus sign (**+**) to create a new Slack integration. Select a configured Slack source. The **Slack Channels** field will then populate a list of available channels to which you can send alerts.

:::callout{theme="neutral"}
To configure the integration with private channels, invite the Slack App to the private channel and ensure the `groups:read` scope has been granted.
:::

Configure the severity level, and repeat as necessary for each additional desired severity level.

### Configure exportable markings for resource name visibility

Slack notifications from monitoring views can display human-readable resource names (for example, "Production Sales Dataset") instead of resource identifiers (RIDs like `ri.main.dataset.xyz789`). This makes alerts easier to understand and helps you quickly assess urgency. Resource names are only shown when security controls permit; specifically, when all [Markings](/docs/foundry/security/markings/) on a resource are included in the Slack source's exportable markings configuration.

:::callout{theme="warning" title="Updated notification format"}
Slack notification formats have changed to include resource names when security controls allow. If you have bots or automated parsers processing monitoring view notifications from Slack, you may need to update them to handle the new message format.
:::

#### How resource name visibility works

When a monitor fires and sends an alert to Slack, Foundry checks whether the resource's name can be safely shared:

* **Resource name shown:** All markings and organizations on the resource are included in the Slack source's exportable markings list.
* **RID shown instead:** One or more markings or organizations on the resource are not in the exportable markings list.

For example, if a dataset named "Customer Revenue Data" has the `Confidential` marking in the `Sales` organization:

* If both `Confidential` and `Sales` are configured as exportable, Slack shows "Customer Revenue Data".
* If either is missing from exportable markings, Slack shows `ri.foundry.main.dataset.abc123`.

#### Configure exportable markings for your Slack source

To enable resource names in Slack notifications, a user with the `Information Security Officer` role must configure exportable markings:

1. Navigate to the **Data Connection** application.
2. Select the Slack source used for monitoring view notifications.
3. Select **Connection settings** and navigate to the **Export configuration** tab.
4. Toggle on **Enable exports to this source**.
5. Add the [Markings](/docs/foundry/security/markings/) and organizations that may appear in Slack messages.
   * You must add both security markings **and** organization markings.
   * You must have unmarking permission on each marking or organization you add.
6. Select **Save** to apply the configuration.

#### Which markings to add

Consider adding exportable markings for:

* Markings on datasets and streams monitored by your monitoring views
* Organization markings associated with the projects you are monitoring
* Any markings that appear on resources you want to see friendly names for in Slack

You can start with less restrictive markings and add more restrictive ones as needed. Remember that if any marking on a resource is not in the exportable list, the RID will be shown instead of the name.

:::callout{theme="neutral"}
The `Information Security Officer` is a default role in Foundry. Users can be granted this role in [Control Panel](/docs/foundry/administration/enrollments-and-organizations-permissions/) under **Enrollment permissions**. For more details on how exportable markings work with Data Connection, review the [exports documentation](/docs/foundry/data-connection/export-overview/#enable-exports-for-source).
:::

## Webhooks

This integration can trigger [Webhooks](/docs/foundry/data-connection/webhooks-reference/) configured in Data Connection. Refer to the [webhooks](/docs/foundry/data-connection/webhooks-reference/) documentation for how to setup a webhook. To use a webhook integration, the webhook must have a string input parameter known as the `Message` parameter. This will be filled in with the contents of the notification. The contents are not currently customizable.

### Create a new Webhook integration for your monitoring view

Navigate to the **Manage subscriptions** tab for your monitoring view; in the **Webhooks** section, use the plus sign (**+**) to create a new webhook integration. You will need to first select a webhook before selecting the Message parameter on that webhook and the severity level. Repeat as needed for each desired severity level.
