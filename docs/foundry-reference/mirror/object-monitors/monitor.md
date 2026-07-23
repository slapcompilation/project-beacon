<!-- source: https://palantir.com/docs/foundry/object-monitors/monitor/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Monitor

:::callout{theme="warning"}
Object Monitors are superseded by [Automate](/docs/foundry/automate/overview/). Automate is a fully backward-compatible product that offers a single entry point for all business automation in the platform.
:::

A monitor is a resource that defines a condition on one or more inputs and any resulting Actions or notifications that should be triggered when the input condition is met.

## Storage

Object monitors are saved in the Foundry Project hierarchy and are supported by standard resource operations such as save, share, move, delete, and role-based access.

Learn about the [Foundry filesystem](/docs/foundry/compass/move-and-share-resources/).

Object monitors are identified by a unique resource identifier in the format:

```
ri.object-sentinel.main.monitor.0cabb748-cf89-4404-be3c-c8f198cb2a0b
```

## Retention

Historical activity for object monitors is retained for six months and permanently deleted after that time. If historical activity must be stored beyond this date, you can use Actions to store data in a long-lived object that is managed and controlled like any other user-created object in the [Foundry Ontology](/docs/foundry/ontology/overview/).

When data is deleted, it is also removed from the monitor activity **History** tab in the Object Monitor application. You can find the **History** tab by first clicking on a monitor to expand the overview panel, then clicking **History**.

## Expiration

Object monitors always have an expiration date. The longest permitted expiration date is three months in the future and can be updated at any time by a user with an `Editor` role on the monitor.

The expiration date can be viewed and extended in the Object Monitors application interface. Click on a monitor to view the monitor overview panel to the right side of your screen. Then, click on the **Details** tab.

![Monitor expiration date in details tab](/docs/resources/foundry/object-monitors/view_and_extend_monitor_expiration.png)

Learn how to create a new object monitor in [Object Explorer](/docs/foundry/object-monitors/create_new_object_monitor/#create-from-object-explorer) or the [Object Monitors](/docs/foundry/object-monitors/create_new_object_monitor/#create-from-object-monitors-application) application.
