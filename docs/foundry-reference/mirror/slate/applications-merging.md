<!-- source: https://palantir.com/docs/foundry/slate/applications-merging/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Merge application changes

When multiple collaborators work on a single Slate application, they may need to merge their changes together to maintain version control. Version control is necessary when two or more users begin editing the same version of an application at the same time and then both attempt to save changes. Since the second attempt to save is based on a version that has been rendered out-of-date by the first save, the application cannot be saved normally without a user's changes being lost. To resolve this situation, the second user must choose from the following options:

* Discard their changes.
* Overwrite the first user’s changes.
* Save the application with a different name.
* Merge their changes with the first user’s changes.

The following section describes the merge process.

## Merge conflicts

Merge conflicts arise when the same element is modified or deleted by multiple users. For example, if a widget is deleted by one user and modified by another user, there will be a conflict. Another example of a conflict is when both users modify the same query.

Conflicts can also occur when otherwise mergeable widget IDs collide, forcing users to choose one version over the other. This conflict can occur more commonly if application developers fail to follow best practices of applying semantic widget names and instead rely on default widget names.

## No conflicts

If no conflict is detected upon a save, Slate automatically merges the application JSON and shows a preview of the merged application. If you are satisfied with the changes, select **Accept and save**. If corrections are needed, choose **Make changes** to view and edit the JSON.

## Merging with conflicts

When a merge conflict is detected upon a save, you are presented with the JSON view of the changes. Within the merge view, three separate panes show the changes made from another user, the merge result, and your changes. When a merge conflict is identified, Slate will not attempt merge changes within an element and will contain the other user's changes by default.

For each of the conflicts:

1. Navigate to a conflict by selecting an element with a `Conflict` tag.
2. Modify the resulting JSON so that it contains the changes you want to retain from both your changes and the other user's changes.
3. When you are satisfied with the merged result, select **Mark as resolved**.

When all of the conflicts are resolved and you are satisfied with the JSON changes, select **Preview the final result**. You are then presented with a visual preview of the merged application and have the option to save the application.

## Example of merging with conflicts

In this example, User A modifies a Y value in a chart:

![merge-chart-edit1](/docs/resources/foundry/slate/merge-chart-edit1.png)

Then, User B modifies the color of a series in the same widget:

![merge-chart-edit2](/docs/resources/foundry/slate/merge-chart-edit2.png)

After user A saves and user B saves, user B will see the following prompt:

![merge-prompt](/docs/resources/foundry/slate/merge-prompt.png)

If user B selects the **Merge...** button, they will see the merge interface. In this initial view, a comparison (also known as a "diff") of the entire Slate application is displayed. User B can select a specific element using the menu on the left.

![merge-json-initial](/docs/resources/foundry/slate/merge-json-initial.png)

Navigating to the element with the conflict focuses on just those changes. Note that none of the changes from user B are merged yet; user B must copy the changes that they want to retain to the merge result pane.

![merge-json-conflict](/docs/resources/foundry/slate/merge-json-conflict.png)

After user B copies the changes that they want to retain to the merge result pane, it might look like this:

![merge-json-pick](/docs/resources/foundry/slate/merge-json-pick.png)

When satisfied with the content of the merge result pane, user B selects **Mark as resolved**.

When user B resolves all conflicts and selects **Preview the final result**, user B will see a visual preview of the merged application:

![merge-preview](/docs/resources/foundry/slate/merge-preview.png)

Note that the merged Slate application has attributes from both changes.
