<!-- source: https://palantir.com/docs/foundry/upgrade-assistant/resource-assignment/ · mirrored 2026-08-16 from Palantir Foundry docs -->

# Resource assignment

Resources can be assigned to groups or individual users. Notifications are sent to users as individuals or as members of groups (using group membership to determine if any resources are assigned to a given user).

In most cases, resources are assigned directly by Upgrade Assistant relying on *heuristics* based on the [**type of the resource**](/docs/foundry/upgrade-assistant/resource-type/) to figure out the right person or group to assign. The remainder of this page describes the various assignment heuristics used by Upgrade Assistant.

Alternatively, the responsible parties for implementing changes in the platform can directly assign resources to groups or users. In this case, Upgrade Assistant simply records the assignment.

In all cases, resources can only be assigned to a maximum of 100 groups or users at a time.

## Assignment heuristics for Compass resources

:::callout{theme="neutral"}
Learn more about how to identify [Compass resources](/docs/foundry/upgrade-assistant/resource-type/#compass-resources).
:::

Compass resources are assigned based on the [Project](/docs/foundry/compass/move-and-share-resources/) to which they belong.
If possible, the resource is assigned to the Project's [**point of contact**](/docs/foundry/platform-security-management/manage-groups/#set-contact-details). If no specified contact can be found, the resource will be assigned to users and groups with `Owner` role on the Project.

### Best practices for Compass resource assignment

* Ensure that the Project’s point of contact is set and reflects the actual ownership of the Project.
  * The point of contact can act as a dispatcher to reassign resources based on their knowledge of the business.
  * If a point of contact is unavailable, consider reviewing the groups or users with the `Owner` role on the Project. If possible, reduce the `Owner` to a focused set of users.

## Assignment heuristics for enrollments

:::callout{theme="neutral"}
Learn more about how to identify [enrollment resources](/docs/foundry/upgrade-assistant/resource-type/#enrollment-resources).
:::

Resources are assigned to users who are [Maintenance Operators](/docs/foundry/upgrade-assistant/technical-maintenance-operators/). These users have the `OPERATOR-VIEW-PROGRESS` operation on the relevant organization. This operation is displayed in Control Panel as **View progress in Upgrade Assistant**, and is granted by default to certain roles such as [**Technical Compliance Officer**](/docs/foundry/administration/enrollments-and-organizations-permissions/#technical-compliance-officer-role). If no such user can be found, the resource will be assigned to the **Organization Administrator**.

### Best practices for enrollment resource assignment

* Ensure that the **Technical Compliance Officer** role has a reasonable number of users who are familiar with Upgrade Assistant.

## Assignment heuristics for other resources

:::callout{theme="neutral"}
Learn how to identify [other resources](/docs/foundry/upgrade-assistant/resource-type/#other-resources).
:::

Object type resources are assigned to users who have the editor or owner role on the given object type. Restricted object types are assigned to the users who additionally are editors or owners of the backing dataset(s).

Other types of resources, such as Compass [spaces](/docs/foundry/security/orgs-and-spaces/#spaces), link types, action types, or schedules, have no default heuristics. For these resources, Upgrade Assistant relies on the service reporting affected resources to provide assignment information.

## "Needs triage" assignment heuristic

In some cases, resources may be assigned to [Maintenance Operators](/docs/foundry/upgrade-assistant/technical-maintenance-operators/) with the assignment reason listed as "Needs triage." This assignment heuristic is applied in cases where standard heuristics are not sufficient.

In particular, "needs triage" is used when:

* Standard heuristics have **not identified any assignees**. For example, if there are no users identified as project point of contact or project owners.
* Standard heuristics have identified **too many assignees**. For example, if the resource's project is owned by a group containing 1000 users and there is no point of contact listed.

In these cases, the resource is assigned to maintenance operators for triage and appropriate reassignment to the relevant users.
