<!-- source: https://palantir.com/docs/foundry/administration/configure-support-teams/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Configure support teams

Support teams enable administrators to define groups that provide support in Foundry Issues. When a **support team** group is assigned to an issue, [status automation](#status-automation) can be enabled in Control Panel. See below for how to enable [status automation](#status-automation) for a support team.

To register a group as a support team, open Control Panel and navigate to **Enrollment settings > Support > Support teams** and select **Add**.

## Status automation

Enabling status automation for a support team will apply the following rules to issues assigned to them and automatically set the resulting status. Select **Actions > Edit** in the list of support teams in Control Panel to enable or disable status automation per team.

* *If* the reporter comments on the issue, *then* set the issue status to `Waiting on support`
* *If* the status is `Waiting on reporter` and issue has not been updated for over 5 days, *then* set the issue status to `Pending closure`
* *If* the status is `Pending closure` and issue has not been updated for over 5 days, *then* set the issue status to `Closed`
