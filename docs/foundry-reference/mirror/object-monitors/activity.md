<!-- source: https://palantir.com/docs/foundry/object-monitors/activity/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Activity

:::callout{theme="warning"}
Object Monitors are superseded by [Automate](/docs/foundry/automate/overview/). Automate is a fully backward-compatible product that offers a single entry point for all business automation in the platform.
:::

Object monitor activity is recorded based on the condition and when certain metadata properties are changed or updated.

The activity timeline for all monitors subscribed to by a user is displayed on the **Overview** page of the Object Monitors application.

![Object Monitors app Overview page](/docs/resources/foundry/object-monitors/object_monitors_app_overview.png)

The activity timeline for a single monitor is displayed under the **History** tab in the individual monitor overview panel.

![Objects Monitors app activity timeline](/docs/resources/foundry/object-monitors/object_monitors_app_activity_timeline.png)

## Activity event types

### `Monitor triggered`

`Monitor triggered` is recorded when a threshold condition changes status from `false` to `true` and when there are events detected for an event condition.

### `Monitor recovered`

`Monitor recovered` is recorded when a threshold condition changes status from `true` to `false`. Event conditions never result in `monitor recovered` activity.

### `Condition edited`

`Condition edited` is recorded when the monitor condition is updated by any user.

### `Subscribed`

`Subscribed` is recorded when you subscribe to a monitor. Activity from periods where you are not subscribed will not be recorded or displayed.

### `Unsubscribed`

`Unsubscribed` is recorded when you unsubscribe from a monitor. Activity from periods where you are not subscribed will not be recorded or displayed.

### `Evaluation failed`

`Evaluation failed` is recorded when a monitor fails to evaluate for any reason. Details about the failure can be viewed from the activity **History** view for that monitor. `Evaluation failed` may also be shown in cases where the monitor condition was successfully evaluated, but the notifications or Actions failed.

### `Muted`

`Muted` is recorded when a monitor is muted by any user. Muting applies to all subscribers. Muted monitors will still be evaluated, but no side effects (e.g. notifications or Actions) will be triggered.

### `Unmuted`

`Unmuted` is recorded when a monitor stops being muted. Muting applies to all subscribers, and monitors will be automatically unmuted after the mute time period expires.

### `Disabled`

`Disabled` is recorded when a monitor is disabled by any user or when a monitor is automatically disabled due to excessive activity. Disabling applies to all subscribers. Disabled monitors are not evaluated.

### `Enabled`

`Enabled` is recorded when a monitor stops being disabled. Enabling applies to all subscribers, and monitors are re-enabled after the disabled time period expires.
