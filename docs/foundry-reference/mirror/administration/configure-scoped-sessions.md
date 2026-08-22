<!-- source: https://palantir.com/docs/foundry/administration/configure-scoped-sessions/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Configure scoped sessions

Scoped sessions enable a user to pick a subset of pre-defined [Markings](/docs/foundry/security/markings/) to access during their Foundry session to create a visual separation between different types of work. Scoped sessions function across both the Foundry file system and ontology workspaces.

Scoped sessions improve platform security by reducing the chances of accidental cross-pollination of work across different purposes in Foundry. For example, a user working on a particular healthcare research project may be prohibited from using information in another healthcare research project (even though they may have access), since the intermingling of data could compromise the validity of their research. By siloing a user’s session to the purpose they are currently working on, the risk of cross-pollination is reduced and the user can work with greater confidence.

![scoped session example](./images/change_scoped_session_example.png)

An administrator can configure scoped sessions for your Organization from within [Control Panel](/docs/foundry/administration/control-panel/). Scoped sessions should be configured carefully since they can affect all users who log into Foundry and may potentially lead to the display of a Foundry workspace banner. For this reason, scoped sessions are disabled by default.

To enable scoped sessions for your Organization, we recommend following these high-level steps:

1. [Review your Marking setup](#review-your-marking-setup)
2. [Create scoped sessions](#create-scoped-sessions)
3. [Review scoped sessions settings](#review-scoped-sessions-settings)
4. [Enable scoped sessions](#enable-scoped-sessions)

## Review your Marking setup

Scoped sessions restrict access based on a user's Marking membership. Therefore, to restrict a user's scope throughout the platform, you must both:

* Have the correct users as members of the correct Markings, **and**
* Have [Markings applied](/docs/foundry/platform-security-management/manage-markings/#apply-markings) to projects, folder, or files in the way you want to focus a user's access in Foundry.

For example, assume Anya Kimball is a user who should only work on a specific research project at a given time and not see any other research projects. This is a good use case for using scoped sessions. To begin setting up scoped sessions, first ensure that Anya is a member of the correct set of research Markings.

![marking management interface](./images/marking_management.png)

Then you would confirm that the research Markings are applied correctly throughout the Foundry platform. Users will be able to see anything that has one or more of the Markings included in the scoped session. Also, users will be able to see anything that does not have a Marking.

![markings applied on necessary projects](./images/applied_markings.png)

## Create scoped sessions

You can create a scoped session by selecting **New scoped session** under the **Session presets** tab. Complete the form that pops up to create the new scoped session. After creation, you can edit the same set of details available during the creation process.

![new scoped session dialog](./images/new_scoped_session_dialog.png)

Only users who are members of all the Markings selected in the scoped session will be able to choose this scoped session. In this example, Anya is a member of all required research-related Markings, so she will be able to select from all available scoped sessions when she logs into Foundry.

![scoped session dialog forced to pick](./images/scoped_session_forced_to_pick.png)

You can change the Markings for a given scoped session by selecting **Manage** in the right-side panel. You can also delete a scoped session with the **Delete scoped session** button.

## Review scoped sessions settings

Before enabling scoped sessions, you need to consider if 1) you want to allow users to work without scoped sessions, which is the ["Allow no scoped session"](#allow-no-scoped-session) setting and/or 2) you want users to always see the scoped session selector, which is the ["Always show selector"](#always-show-selector) setting.

![scoped sessions settings tab with scoped sessions disabled](./images/disabled_scoped_sessions.png)

### Allow no scoped session

When **no scoped session** is enabled, people from your Organization will be able to use Foundry without a scoped session. Users with no scoped session enabled will have access to all of their Markings. This is the same access that a user would have if scoped sessions are disabled for your Organization.

![no scoped session](./images/no_scoped_session.png)

You can enable **no scoped session** for all users in your Organization, for members of select groups only, or for all users except members of selected groups. This provides more control over who can bypass scoped sessions. Typically, administrators or support users should be allowed to pick the **no scoped session** option.

### Always show selector

When **always show selector** is enabled, people from your Organization will always see the scoped session selector when logging in, even if only one session is available to them.

![always show selector](./images/always_show_selector.png)

When **always show selector** is disabled, a user with access to only one scoped session will not see the scoped session dialog (seen in the example above) when logging in; instead, they will automatically log into the only available scoped session.

## Enable scoped sessions

Toggle on **enable scoped sessions** to complete the setup of scoped sessions. When scoped sessions are enabled, some users from your Organization may need to select a scoped session when working in Foundry, which will limit their access to a subset of their full user access. If a user has access to more than one scoped session, they will see the scoped session dialog.

![enabling scoped sessions](./images/enabling_scoped_sessions.png)

Enabling scoped sessions does not mean all users will necessarily see the scoped session dialog or the scoped session banner; this depends on the [scoped session settings](#review-scoped-sessions-settings) and the user's Marking membership.

In the following scenario, for example, the user would not see the scoped session dialog or the scoped session banner:

* The user is not a member of any of the Markings used in the scoped sessions.
* **No scoped session** is enabled for this user.
* **Always show selector** is disabled.

To continue with our example of Anya from above, after scoped sessions are enabled, Anya would see the dialog below when she logs into Foundry.

![scoped session login example](./images/scoped_session_login_example.png)

After selecting the `SARS-CoV-2 B.1.1.529 Genome mapping` scoped session, Anya would only have access to projects, folders, and files that have no Markings on them or have either the `B.1.1.529` and/or `SARS-CoV-2` Markings on them.

![scoped session workspace example](./images/scoped_session_workspace_example.png)

More details about scoped sessions from a user's perspective can be found in the [Markings documentation](/docs/foundry/security/markings/#use-scoped-sessions).
