<!-- source: https://palantir.com/docs/foundry/object-monitors/errors/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Error reference

:::callout{theme="warning"}
Object Monitors are superseded by [Automate](/docs/foundry/automate/overview/). Automate is a fully backward-compatible product that offers a single entry point for all business automation in the platform.
:::

This page describes some of the common error categories that may be encountered when using the Object Monitors application or the **Monitors** view in Object Explorer.

## Evaluation errors

A monitor may fail to evaluate due to problems with the underlying data. Monitors are automatically retried, but some errors may require manual intervention. For example, if the object type being monitored is deleted, monitors using inputs containing objects of that type will fail to evaluate.

### Monitor out of sync

Object monitors use a reference to a [saved exploration](/docs/foundry/object-explorer/save-explorations/) to define the input. This reference is not dynamic, but instead is stored according to the exploration as it exists when the monitor is saved. If the exploration changes, the monitor will continue to evaluate using the exploration's old state unless the monitor is updated. In this case, a warning banner is displayed on the monitor:

![Warning banner for out of sync monitor](./images/monitor_out_of_sync_banner.png)

## Notification effect errors

After a successful monitor evaluation, notifications may fail to send. If this occurs, the history event will show a tag indicating that notifications for that event were not sent to subscribers, along with additional details such as an error identifier and error message.

## Action effect errors

After a successful monitor evaluation, Action effects may fail to execute. This failure could happen for a variety of reasons, including changes to the Action logic that make it incompatible with the saved input configuration on the monitor, or because the [submission criteria](/docs/foundry/action-types/submission-criteria/) for the Action is not met. If this failure occurs, the history event timeline will show a tag indicating that one or more Actions failed to execute for that event, along with relevant error details.

## Permissions

Monitor evaluation uses the permissions of the individual subscribers. This is to ensure that monitor evaluation and any subsequent Action or notification effects will always reflect data that the user may access at the time the monitor is evaluated. If a user is missing permission to view the input object type(s), saved exploration(s), and/or the object monitor, they may see a permission-related error message instead of successful evaluation. We strongly recommend storing monitors and their inputs in shared [Projects](/docs/foundry/security/projects-and-roles/).
