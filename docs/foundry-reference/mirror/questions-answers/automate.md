<!-- source: https://palantir.com/docs/foundry/questions-answers/automate/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Automate

### Why would automated Notepad PDFs fail to render for certain users in Foundry Automate?

Automated Notepad PDFs will fail to render for users that do not have access to the triggering object required for the Notepad template. To resolve this issue, the users must be granted access to the triggering object.

*Timestamp:* April 13, 2024

### How can I configure an automation to trigger after all subsidiary jobs in a workflow have been executed instead of triggering on each individual subsidiary job?

You can use a function-generated condition that returns completed parent jobs and have an effect which is an action that updates the parent status. However, please note that the maximum frequency of this function-generated condition is one hour.

*Timestamp:* April 9, 2024

### How are expiry dates for automations handled when distributed via Marketplace?

Automations with an expiry date cannot be packaged in Marketplace. You must remove the expiry date before packaging the automation.

*Timestamp:* June 2, 2026

### Is it possible to use object properties in an email subject and content within Automate without using Functions?

Currently, the feature to use object properties in email subject and content without using Function is not supported in Automate, and there are no immediate plans to implement such a feature.

*Timestamp:* February 26, 2024

### How can I resolve the issue of an automation being triggered too frequently and on existing objects that have been recently edited, instead of only applying the action to new objects?

To ensure that the automation applies only to new objects, you should ensure that no filters in the object set definition could be met by editing existing objects. If you want to trigger the automation exclusively for new objects, do not specify any filters on the object set. Additionally, ensure that the batch size is configured correctly in your automation settings.

*Timestamp:* March 13, 2024

### Is per-object execution with Webhook-based Actions supported in Foundry Automate?

Yes, per-object execution with Webhook-based Actions is supported in Foundry Automate. You can configure parallel, per-object webhooks to execute actions for each individual object.

*Timestamp:* April 17, 2024
