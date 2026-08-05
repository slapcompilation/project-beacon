<!-- source: https://palantir.com/docs/foundry/slate/applications-versioning/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Manage application versions

Editors are able to control the version of a Slate application that is `Published` and viewable to the end user. This control allows for continued development on a live Slate application without the need to expose changes to end users when the application is saved.

To view the versions of your Slate application, select the blue number next to the blue checkmark icon in the upper right corner of your screen, beneath the name of your application.

![A Demo Slate application is on version 15. The version number is highlighted with a red border. ](/docs/resources/foundry/slate/application-version-number.png)

A **Versions** pop-up will appear, listing all historical versions of the application including the currently published version.

![Version dialog](/docs/resources/foundry/slate/version-publish.png)

Editors can select from these versions and choose to do the following:

* Enable automatic publishing.
* Open the versions in View mode.
* Revert to a given version.
* Compare a version with the latest version.
* Manage tags applied to given versions.

## Enable automatic publishing

Toggle on the **Always publish when saving** option to allow new versions to publish automatically when saved. This option ensures that your end user view is always on the latest version. This mirrors the default behavior where navigating to a Slate permalink will always redirect to the implicit tag. When the toggle is disabled, the permalink will redirect users to the published version.

![Version dialog publish latest](/docs/resources/foundry/slate/version-publish-latest.png)

## View versions

To open a version for viewing, select the three dots `...` to the right of the version name and select **View this version**.

![A pop-up appears that allows you to choose to view the given version.](/docs/resources/foundry/slate/view-this-version.png)

When you view an unpublished or untagged version, you will see a warning banner at very top of the page. The banner will also appear when viewing the latest version of the application if it is not published or manually tagged.

![Unpublished warning](/docs/resources/foundry/slate/version-warning-banner.png)

## Revert to a version

Along with viewing a given version, you can choose to revert to a given version. Reverting to a version will save the historic version you are viewing as the newest version of the application.

![A pop-up appears that allows you to choose to revert to the given version.](/docs/resources/foundry/slate/revert-to-version.png)

For example, if you are currently on version `55` of your application but need to revert to version `51`, you can open version `51` from the **Versions** pop-up and select **Revert to this version**. Reverting saves the version you are viewing (`51`) as the newest version (`56`). Now, version `56` is an exact match of version `51`, maintaining a linear version history and allowing you to always return to a specific saved version.

## Compare versions

You may find it useful to compare a given version of your application with another version. You can compare a version by selecting the three dots `...` to the right of the version name and choosing **Compare with latest**.

![A pop-up appears that allows you to choose to compare a given version to the latest version.](/docs/resources/foundry/slate/compare-version.png)

You will then see a side by side comparison (a "diff") of the application at two points in its version history. Any changes made to widgets are highlighted, and you can choose to view the changes to the underlying JSON definitions to review new or modified functions, queries, events, and variables.

![The version comparison screen, comparing V1 and V4 of the Slate Test Docs application. Changes are highlighted in red in the V1 view and in green in the V4 view. ](/docs/resources/foundry/slate/compare-versions-diff.png)

From this comparison view, you can also compare across other versions by adjusting the version numbers at the top of the page.

## Manage tags

To further manage version access, you can apply tags to a given version that allows end users to view the version by appending the application URL with `?$tag={<<tag-name>>}`.

All tagged versions are available to users who have `Viewer` permissions on the Slate application. Viewers cannot open non-tagged versions.

![Version dialog tagging](/docs/resources/foundry/slate/version-publish-tags.png)

:::callout{theme="neutral"}
By default, the platform uses the `published` tag to identify the currently published version. For this reason, you cannot apply a `published` tag to any versions. Additionally, you cannot apply the same tag on multiple versions of the application at the same time.
:::
