<!-- source: https://palantir.com/docs/foundry/object-monitors/limits/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Limits

:::callout{theme="warning"}
Object Monitors are superseded by [Automate](/docs/foundry/automate/overview/). Automate is a fully backward-compatible product that offers a single entry point for all business automation in the platform.
:::

Object monitoring implements several limits to ensure good performance for execution and triggering effects. These limits and the expected behavior are listed in the table below.

### Scale limits

| Description                                    | Limit       | Behavior when limit is reached |
| ---------------------------------------------- | ----------- | ------------------------------ |
| Number of times a monitor may trigger per hour | 12          | Monitor will be auto-disabled  |
| Number of times a monitor may trigger per day  | 96          | Monitor will be auto-disabled  |
| Max size of input for object added/removed condition | 100K     | Error message when saving the monitor OR runtime error when evaluating the monitor if the input set grows beyond 100K objects |
| Max number of subscribers to a single monitor  | 30           | Error message when saving the monitor |
| Max size of object type for realtime execution | 10M    | Error message when saving the monitor OR runtime error when evaluating the monitor if the total objects in the object type grows beyond the limit |
