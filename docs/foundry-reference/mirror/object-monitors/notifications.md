<!-- source: https://palantir.com/docs/foundry/object-monitors/notifications/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Notifications

Subscribers to an object monitor may choose to receive notifications when there is new activity for a monitor.

Notifications are enabled by default for all subscribers but may be disabled for individual subscribers. To disable notifications, click the bell icon in the **Subscribers** tab when configuring or editing a monitor in the Object Monitors application.

![Disable notifications in Subscribers tab](/docs/resources/foundry/object-monitors/monitor_subscriber_notifications_configuration.png)

Individual users may also configure how they wish to receive notifications from Object Monitors. You can configure notifications in the **Notification** tab of the monitor configuration modal, and preferences apply globally for any monitors to which that user is subscribed.

![Configure notification settings](/docs/resources/foundry/object-monitors/monitor_notifications_settings.png)

| Category      | Activity types          |
| ------------- | ----------------------- |
| `Triggered`   | [Monitor triggered](/docs/foundry/object-monitors/activity/#monitor-triggered) |
| `Recovered`   | [Monitor recovered](/docs/foundry/object-monitors/activity/#monitor-recovered) |
| `Errors`      | [Evaluation failed](/docs/foundry/object-monitors/activity/#evaluation-failed) |
| `Other info`  | [Condition edited](/docs/foundry/object-monitors/activity/#condition-edited), [Subscribed](/docs/foundry/object-monitors/activity/#subscribed), [Unsubscribed](/docs/foundry/object-monitors/activity/#unsubscribed), [Muted](/docs/foundry/object-monitors/activity/#muted), [Unmuted](/docs/foundry/object-monitors/activity/#unmuted), [Disabled](/docs/foundry/object-monitors/activity/#disabled), or [Enabled](/docs/foundry/object-monitors/activity/#enabled) |

## Custom notification content

The notifications emitted for [monitor triggered](/docs/foundry/object-monitors/activity/#monitor-triggered) and [monitor recovered](/docs/foundry/object-monitors/activity/#monitor-recovered) activity may be customized. You can provide a custom notification configuration in the **Notifications** tab when configuring or editing a monitor in the Object Monitors application.

### Templated rendering

When using templated rendering, the custom content (including subject, body, link label, and link destination) is shown directly in the provided form. HTML can also be used in the advanced email configuration if desired. A preview of the in-platform and email notifications can be seen on the right side of the form.

![monitor\_custom\_notifications\_templated](/docs/resources/foundry/object-monitors/monitor_custom_notifications_templated.png)

### Function-backed rendering

When using Function-backed rendering, the custom content is returned from a Function using the provided notification return type. For monitors with event conditions, the Function may accept an `ObjectSet<>` of the object type being monitored, making it possible to extract and render data about the objects that were detected by the monitor directly into the notification content.
