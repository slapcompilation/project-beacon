<!-- source: https://palantir.com/docs/foundry/workshop/usage-metrics/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Usage metrics

Workshop's usage metrics give module builders visibility into how their applications are being used. From the **Metrics** tab in the Workshop editor's left sidebar, you can view action submission counts and layout view counts to understand which parts of your module are most active and how usage trends change over time. All metrics are aggregate counts and are not attributable to any specific user.

## Action metrics

Action metrics show how many times each action in the module has been successfully submitted. The overview card displays the total number of action submissions across the module for a selected time period along with the percentage change compared to the prior equivalent period.

Below the overview are individual actions with their submission counts and a proportional bar indicating relative usage. Select an action to view which widgets in the module use that action.

![An example of action metrics.](/docs/resources/foundry/workshop/metrics-action-metrics.png)

Action metrics are available by default for all modules and do not require any additional configuration.

## Layout view metrics

Layout view metrics track how many times each page, tab, and overlay in the module has been viewed by users. The overview card displays total views across all layouts, and the list view breaks down views by individual layout item.

![An example of layout metrics.](/docs/resources/foundry/workshop/metrics-layout-metrics.png)

Selecting a page or overlay in the list navigates to that layout in the editor.

### Enable layout view tracking

Layout view metrics require builders to opt in. To enable tracking:

1. Open the module in Edit mode.
2. Open **Module settings**.
3. Navigate to the **Metrics** tab.
4. Toggle on **Usage Metrics Tracking**.

After enabling, it may take up to 24 hours before view metrics begin to appear in the metrics panel. Layout view data is processed in a daily aggregation, so new views are reflected once per day rather than in real time.

![Enabling granular metrics for pages, tabs, and overlays.](/docs/resources/foundry/workshop/metrics-enable-granular-view-metrics.png)

Layout views are only recorded when the module is viewed on the main branch in View mode. Views in Edit mode or on draft branches are not tracked.

## Time period

Both action metrics and layout view metrics support configurable time periods. Use the period picker at the top of the Metrics panel to select **7 days**, **30 days**, or **90 days**. The default is 30 days.

Each overview card shows the percentage change compared to the previous equivalent period. For example, when viewing the last 30 days, the percentage change compares against the 30 days before that.

## Embedded modules

For modules that use [embedded modules](/docs/foundry/workshop/embedding-workshop-modules-overview/), overlay views originating from an embedded module are attributed to the embedded module rather than to the parent module.
