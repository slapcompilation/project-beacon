<!-- source: https://palantir.com/docs/foundry/data-connection/listeners-https/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# HTTPS listeners

HTTPS listeners receive inbound webhook requests from external systems through HTTPS endpoints. Events are written to a [stream](/docs/foundry/data-integration/streams/), enabling processing through [Automate](/docs/foundry/automate/streaming/), [streaming pipelines](/docs/foundry/building-pipelines/streaming-overview/), or batch processing using the stream's backing dataset.

## When to use HTTPS listeners

You can use HTTPS listeners in the following situations:

* The external system supports outbound webhooks.
* You need to receive event notifications when something changes in the external system.
* The external system cannot authenticate with standard OAuth 2.0 or Foundry APIs.

## Configure a listener

Navigate to **Data Connection > Listeners** to connect the Palantir platform to external systems and workflows. For information on securely configuring listeners and incoming data, refer to the [HTTPS listener security](/docs/foundry/data-connection/listeners-https-security/) documentation.

You can explore a listener's streaming dataset in Data Lineage to better understand data transformations and flows.

## Throughput and limitations

Only low-throughput event streams should be pushed to HTTPS listeners. HTTPS listeners are rate-limited at approximately 100 requests per second, so integrations requiring substantially higher throughput should use [streaming syncs](/docs/foundry/data-connection/set-up-streaming-sync/) or the [public streaming API endpoints](/docs/foundry/api/v2/streams-v2-resources/streams/publish-record-to-stream) when possible.

If your use case requires a higher rate limit than what is currently provided, and listeners are the only appropriate integration option, contact Palantir Support to discuss increasing this limit.

Individual event and request payloads are limited to 1 MB in size, as this is the maximum row size in the output streaming dataset. Foundry rejects events that exceed this limit.

## Supported HTTPS listeners

You can either configure a custom, basic authentication listener, or one of the following listeners:

| Listener, linked to external documentation                                                                               | Platform setup guide |
|-------------------------|-----------------------------------------------------------------------------------------------------|
| [Airtable ↗](https://airtable.com/developers/web/guides/webhooks-api) | |
| [Apollo ↗](../../apollo/managing-notifications/overview.md)              | |
| [AWS SNS ↗](https://docs.aws.amazon.com/sns/latest/dg/sns-http-https-endpoint-as-subscriber.html)              | |
| [Azure Event Grid ↗](https://learn.microsoft.com/en-us/azure/event-grid/handler-webhooks) | |
| [Bitbucket ↗](https://support.atlassian.com/bitbucket-cloud/docs/manage-webhooks/) |                                     |
| [Cisco Meraki ↗](https://documentation.meraki.com/General_Administration/Other_Topics/Webhooks) |
| [Dialpad ↗](https://developers.dialpad.com/docs/event-subscriptions) | |
| [FedEx ↗](https://developer.fedex.com/api/en-us/webhookmarketing.html) |
| [GitLab ↗](https://docs.gitlab.com/user/project/integrations/webhooks/)                                                      |    |
| [GitHub ↗](https://docs.github.com/en/webhooks/about-webhooks)                 |            |
| [Google Cloud Pub/Sub ↗](https://cloud.google.com/pubsub/docs/push)   | [Guide](/docs/foundry/data-connection/listeners-google-pub-sub/)                                |
| [ION Factory OS ↗](https://manual.firstresonance.io/api/webhooks) |
| [Jira ↗](https://developer.atlassian.com/server/jira/platform/webhooks/) and [Jira Cloud Automation ↗](https://support.atlassian.com/cloud-automation/docs/jira-cloud-automation/)            | [Guide](/docs/foundry/data-connection/listeners-jira/)                           |
| [Jotform ↗](https://www.jotform.com/integrations/webhooks) |
| [Meta ↗](https://developers.facebook.com/docs/graph-api/webhooks/getting-started) | |
| [Microsoft Bot Framework ↗](https://learn.microsoft.com/azure/bot-service/bot-service-overview?view=azure-bot-service-4.0)  | |
| [PagerDuty ↗](https://support.pagerduty.com/main/docs/webhooks)                                                    |
| [PandaDoc ↗](https://developers.pandadoc.com/)                                                                    |
| [project44 ↗](https://developers.project44.com/api-reference/webhook-guide) |
| RevelocPlus | |
| [ShipStation ↗](https://www.shipengine.com/docs/webhooks/) |
| [Shopify ↗](https://shopify.dev/docs/apps/build/webhooks)                                                        |
| [Skydio ↗](https://support.skydio.com/hc/en-us/articles/19299707787035-How-to-configure-alerts-in-Skydio-Cloud) |
| [Slack ↗](https://api.slack.com/apis/events-api)              | [Guide](/docs/foundry/data-connection/listeners-slack/)                                                 |
| [Stripe ↗](https://docs.stripe.com/webhooks)                                                                    |
| [Twilio ↗](https://www.twilio.com/docs/usage/webhooks)|
| [Twilio SendGrid ↗](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/getting-started-event-webhook) | |
| [Zendesk ↗](https://developer.zendesk.com/documentation/webhooks/) |

***

*All product names, logos, and brands mentioned are trademarks of their respective owners. All company, product, and service names used in this document are for identification purposes only.*
