<!-- source: https://palantir.com/docs/foundry/object-monitors/actions/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Actions

:::callout{theme="warning"}
Object Monitors are superseded by [Automate](/docs/foundry/automate/overview/). Automate is a fully backward-compatible product that offers a single entry point for all business automation in the platform.
:::

[Actions](/docs/foundry/action-types/overview/) may be automatically run when an object monitor triggers or recovers.

## Configuring Actions

Subscribers may configure Actions to run when there is a new [monitor triggered](/docs/foundry/object-monitors/activity/#monitor-triggered) activity event. The Action will be submitted automatically by the monitor as soon as the evaluation completes. If multiple users have configured Actions, Actions will be run separately for each user.

![action\_visibility\_settings\_monitoring](/docs/resources/foundry/object-monitors/action_visibility_settings_monitoring.png)

## Affected objects

For event conditions, the set of objects detected by the monitor can be passed into the Action as an object set parameter. In the **Actions** tab of the [monitor configuration](/docs/foundry/object-monitors/create_new_object_monitor/#create-from-object-monitors-application) page, the parameter should be configured to accept an `ObjectSet<>` of the same object type that is being monitored. An option to provide the set of objects will become available for selection.

![Configure Actions in Object Monitors app](/docs/resources/foundry/object-monitors/management_app_configure_actions.png)

:::callout{theme="warning"}
This object set cannot be used as an input to Action notifications; only the user who configured the Action effect will have access to the set of affected objects for that monitor execution.
:::

## Action visibility settings

Not all Actions may be appropriate to use with object monitors. You can disable an Action from appearing in object monitoring once you configure the Action type in the Ontology Manager. After creating an Action type, view its details by clicking on the Action type from the **Action type** list, then click on the **Security & Submission Criteria** tab in the left side panel. Then, find the **Frontend consumers** section and toggle off the switch to "Allow An Object Monitor To Submit This Action".

![Disable Action visibility in Ontology Manager](/docs/resources/foundry/object-monitors/disable_action_visability@2x.png)

## Permissions

Actions are associated with a specific user subscribed to the monitor. This means that a subscriber configuring an Action must pass the [submission criteria](/docs/foundry/action-types/submission-criteria/) for that Action.

Actions may not be configured on behalf of other subscribers.

:::callout{theme="warning"}
As Actions run on behalf of a specific user, the Action will no longer run if that user unsubscribes or if that user account is disabled or deleted.
:::
