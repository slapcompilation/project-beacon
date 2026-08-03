<!-- source: https://palantir.com/docs/foundry/workshop/widgets-comments/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Comments

The Comments widget enables collaboration in a Workshop module.

## References

You can use references to mention objects in comments. References are interactive, selecting one can either display the mentioned object’s properties in a tooltip or trigger an event in the module such as opening a modal or showing the [Object View](/docs/foundry/workshop/widgets-object-view/).

See below for an example of configuring and using references in the Comments widget:

| Configuration | Usage |
|--------|---------------|
| <img alt="References can be configured in the Comments widget configuration. A reference configuration allows for an easy way to reference objects from a given object set." src="./media/comments-references-config.png" width="300" /> | <img alt="Use the at symbol to include a reference in a comment. Possible references will be displayed in a pop-up as you begin typing." src="./media/comments-references-popup.png" width="300" /> |

## Permissions

Comments are not separate objects, they are attached directly to the parent object. They do not show up in [Object Explorer](/docs/foundry/object-explorer/overview/) and can only be displayed using the comments widget. To make the comments searchable in Ontology, [review this section below](#advanced-making-comments-searchable-in-ontology).

Comments follow the permissions of the parent object, so if you can access the object then you can view and post new comments under it. This means that [Restricted Views](/docs/foundry/object-permissioning/managing-object-security/#restricted-views) are automatically supported. You can also delete your own comments if you unintentionally posted something.

### Note on granular permissions

Let us explore more granular permissions using an example of a medical practice. A medical practice can configure a `patient` object with column level permissions, so that only the basic fields are visible to the admins and the doctors can view both the basic fields and any sensitive fields. To prevent admins from viewing comments left by doctors on sensitive fields, the practice creates a separate proxy object called `PatientSensitiveComments`. This way they can have two comment threads in their module, one comment thread directly on the `patient` object that is visible both to admins and doctors, and another comment thread on the proxy object `PatientSensitiveComments` that is only visible to doctors.

### (Advanced) Making comments searchable in Ontology

You can preserve the history of comments in Ontology by enabling an [Action Log](/docs/foundry/action-types/action-log/). To do this, toggle on **Action to perform after commenting** and navigate to the Ontology to configure fields like **Comment text**, **Parent Object**, and **Current user**. Because the Action Log is append-only, comments stored this way cannot be edited or deleted after they are written.

Alternatively, you can create a dedicated object type (for example, `Ticket Comment`) to mirror comments in the Ontology, making them searchable and available for Ontology workflows. With this approach, you configure the **Action to perform after commenting** to create a new object with the comment text.

However, note that the comment service remains the source of truth: editing or deleting the mirrored object will not affect the comment as displayed in the widget, nor will it preserve comment history. If you require an immutable record of all comment activity, use the Action Log approach instead.

There are several things to consider before adding `Comment text` to the [Action Log](/docs/foundry/action-types/action-log/):

* You should be careful if the parent object is configured as a [Restricted View](/docs/foundry/object-permissioning/managing-object-security/#restricted-views) and the row-level permissions reference a field that can be changed, since the Action Log is append-only. For example, if a ticket has a field called `Sensitivity level` whose value changes from `Public` to `Legal only`, then the comments already stored in the Action Log will still contain the previous value `Public`. To make sure the comments you copy to Ontology layer follow the permissions of the parent object, you should create a dedicated `Ticket Comment` object and configure an action that changes the `Sensitivity level` of the ticket to also update the `Sensitivity level` of the comments stored in the `Ticket Comment` object.
* The Action Log will not show the rich text display of comments like in the Comments widget.

## Notifications

After commenting on an object, you will be automatically subscribed to get notifications when other users comment on the object. Mentioning a user in a comment will also send a notification to them and subscribe them to receive notifications for future comments on the object. Notifications are delivered as an email to the user and appear in their notification inbox in Foundry.

Notifications should be seen as an enhancement to the workflow and should not be the only way of notifying a user know that there is an outstanding action. Users should be able to see tasks assigned to them in your Workshop application in an [inbox view](/docs/foundry/workshop/getting-started/#part-vi-polish-your-inbox-and-add-headers).

### Default notifications

The Comments widget comes with notifications enabled by default. The default notifications include a link to the [Object View](/docs/foundry/object-views/overview/) for the object on which the comment was left. To make sure the user can see the comment when they click the link, you should configure the [object view to be backed by a Workshop module](/docs/foundry/object-views/config-object-views/) with a Comments widget. To customize the notification text or to include a link to the Workshop application instead, follow the instructions for [custom notifications](#custom-notifications).

### Custom notifications

To send a custom notification, you can disable “Send default notifications” and configure an “Action to perform after commenting” which has a notification side-effect, refer to [the action notification documentation](/docs/foundry/action-types/notifications/) for more information. The Comments widget provides special values that can be passed to an action: `Users to notify` (a list of Multipass user IDs) and `Comment text`. These allow you to easily construct a custom notification. To include a link to a specific location in your Workshop application you can configure a [`module interface variable`](/docs/foundry/workshop/module-interface/). The examples below show how you can configure a custom notification:

1. Set up an Action in Ontology with following fields
   <img alt="Fields like comment text or users to notify can be added." src="./media/comments-custom-notification-form.png">

2. Then add the notification side effect to the action rules
   <img alt="In Ontology app, you can add a notification side-effect to your action." src="./media/comments-custom-notification-rule.png" />

3. Configure the notification that should be sent
   ![Notification configuration lets you use the special values provided by the Comments widget like "users to notify" and comment text](/docs/resources/foundry/workshop/comments-custom-notification-oma.png)

4. Configure the action in the Comments widget to pass `Users to notify` and `Comment text`
   <img alt="Comments widget configuration lets you pass comment text and users to notify to an action you configure in Ontology app" src="./media/comments-custom-notification-widget.png" width="300" />

## Attachments

You can upload attachments, such as files and images, either under the parent object or directly under a comment.  Attachments uploaded under a comment will be visible only in the Comments widget and are best suited for draft documents and iteration. We recommend only uploading small attachments, for larger attachments you will notice a long upload time and there is a 200 MB limit. We recommend uploading larger attachments directly on the parent object.

## Action Log

The Comment widget can display comments and actions taken on the relevant objects in one unified feed. Learn more about Action Log [here](/docs/foundry/action-types/action-log/).

<img alt="Comment widget showing comments and actions in one unified feed." src="./media/comments-action-log.png" width="500" />

## Frequently asked questions

#### Can I create comments automatically when an action happens?

The Comments widget lets you display Action Log entries in a common feed with comments, so automated "comments" should be represented as Action Log entries.

#### Can I display comments from the Comments Helper in Object Explorer through the Comments widget in Workshop?

Comments from the Comments Helper in Object Explorer cannot be displayed or reused in Workshop's Comments widget.
