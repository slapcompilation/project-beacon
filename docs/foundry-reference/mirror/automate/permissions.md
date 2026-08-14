<!-- source: https://palantir.com/docs/foundry/automate/permissions/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Permissions

Automate is governed by the same security and permissions model as the rest of the platform. Users can only see and interact with the automations to which they have access. This ensures condition evaluations and effects always reflect the appropriate data access at the time when the automation is evaluated.

## Permissions for executions

* **Condition evaluation:** Uses automation owner's permissions
* **Action and Logic effects:** Execute as the automation owner. This means:
  * **Action submission criteria** are evaluated against the owner (for example, if an action requires the user to be in group Y, the owner must be in group Y)
  * **Function executions** in compute modules receive authentication tokens from the owner
  * **Ontology edit history** shows the owner in the **Edited by** field
  * **Audit logs** record Ontology edits as performed by the automation owner
* **Notification effects:** Use each recipient's individual permissions. Because notification effects use recipient permissions, an automation may:
  * Trigger for some recipients but not others (based on their access)
  * Send different notification content to different recipients (for function-backed notifications)
  * Render different attachments for each recipient

:::callout{theme="warning"}
When you edit and save an automation, you may have the option to become the automation owner (taking ownership from the previous owner) or to keep the original owner. You must take ownership of the automation to make edits to the condition or effects. <br><br>
Future actions effects will execute on behalf of the new owner.

![Change of ownership](./images/permissions-change-owner.png)
:::

### Example use case permissions

A `Sales Opportunity` object type uses a [restricted view](/docs/foundry/object-permissioning/configuring-rv-access-controls/). Users have different permissions: some can access sales opportunities from `Europe`, others from the `US`.

You can configure an automation to notify users when new `Sales Opportunity` objects are added by using an `Objects added to set` condition. When a new opportunity from `Europe` arrives, the condition will be evaluated per recipient.

* Users without access to sales opportunities from `Europe` will not see any activity on the automation; no condition event appears, no notification sent.
* Users with access to opportunities from `Europe` will be notified as expected.

## Third-party application ownership

Automations can be owned by third-party applications instead of individual users. When an automation is owned by a third-party application, it uses a service user for all executions, providing team continuity when individual users leave or are out of office.

The following applies for third-party application ownership:

* The service user's permissions are used for condition evaluation and action/Logic effects.
* Automation execution history and permissions are tied to an organizational service account.
* Multiple automations can share the same third-party application ownership.

Learn more about setting up and transferring automation ownership in [Third-party application ownership](/docs/foundry/automate/third-party-app-ownership/).
