<!-- source: https://palantir.com/docs/foundry/quiver/dashboards-in-analysis/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Use a dashboard within an analysis

In some cases, it can be useful to add a dashboard as a card inside your Quiver analysis. For example, consider a visualization that you repeatedly use with the same configuration but different input values. To save time, you can create a dashboard with only this chart and define its inputs. Note that a dashboard needs to be **published** before you can add it to an analysis. There are two ways to add a published dashboard to your analysis:

1. From the dashboard side panel, use the **+** button next to the dashboard to add it to the analysis.

<img alt="Add to analysis" src="./media/add-dashboard-to-analysis.png" width="300px">

2. From the analysis mode, select **Display** in the top menu and then **Import published Quiver dashboard**.

<img alt="Import dashboard" src="./media/import-dashboard.png" width="300px">

When imported into the analysis, the dashboard will be displayed in a card. In the card editor, you can choose which dashboard to display, select the dashboard version (if **Auto-update** is enabled, the editor will always show the latest version), and configure any dashboard inputs.

![Dashboard card on Canvas](/docs/resources/foundry/quiver/dashboard-card.png)
