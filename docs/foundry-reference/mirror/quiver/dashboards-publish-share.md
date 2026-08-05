<!-- source: https://palantir.com/docs/foundry/quiver/dashboards-publish-share/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Publish and share a dashboard

## Preview your dashboard

To preview a read-only version of your dashboard, select the **Preview** button in the top toolbar.

<img alt="Preview button" src="./media/preview-button.png" width="300px">

Once in preview mode, you can interact with your dashboard as an end user would. You can also change the inputs you defined to see those changes would impact the view. Use the **Exit preview** button to go back to dashboard editing mode.

<img alt="Preview mode buttons" src="./media/preview-mode-buttons.png" width="300px">

## Publish your dashboard

Once you finish editing your dashboard, you need to publish it to share it with other users. This will create a separate Foundry resource backed by your Quiver analysis. Publishing your dashboard will both create the resource and save the analysis.

<img alt="Publish button" src="./media/publish-button.png" width="300px">

To publish, use the **Publish** button in the top toolbar. You will be prompted to select a location in Foundry in which to save your dashboard.

:::callout{theme="neutral"}
Note that **the dashboard will inherit the permissions of the folder in which you save it**. For example, if you save it in your private folder it will not be accessible by any user unless you manually grant them access. The next section provides more details on how permissions work.
:::

Each time you re-publish a dashboard, a new version will be saved.

## Share your dashboard

To view a dashboard, a user needs to have, at minimum, Viewer permissions. These permissions can be granted manually or inherited from permissions on the parent folder in which the resource is published.

To edit a dashboard, a user needs to have Editor or Owner permissions on **both** the dashboard and the underlying analysis.

| Dashboard permission | Analysis permission | What can be done |
| --- | --- | --- |
| Editor or Owner | Editor or Owner | Can edit and share the dashboard and the analysis. |
| Editor or Owner | Viewer | Can share the dashboard but cannot share the analysis. Cannot republish the dashboard as this requires saving the analysis. |
| Viewer | Editor or Owner | Can save the analysis but cannot save the updated dashboard. |
| Viewer | No access | Can view the dashboard but cannot update it. |
| Editor or Owner | No access | Can view the dashboard but cannot update it. |

## Open a published dashboard

You can open a published dashboard outside of the analysis by clicking the link inside the analysis or clicking on the resource in Foundry. This will open the dashboard in a new, read-only tab. Users who have the appropriate permissions (see above) will be able to open the backing analysis from this view and edit the dashboard by selecting the **Edit** button in the top right corner.
