<!-- source: https://palantir.com/docs/foundry/data-integration/schedules/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Schedules

**Schedules** are used to run [builds](/docs/foundry/data-integration/builds/) on a recurring basis to keep data flowing through Foundry consistently. In a schedule, the **trigger** defines the condition that must be satisfied for the associated build to be run.

When a trigger is satisfied and a build is performed, we say that the schedule is **run**. If a schedule is triggered while the previous run is still in action, then it will remain triggered and run only after the previous schedule is finished.

The run history provides a record of when a schedule was run and information about the task that was performed on each run. A schedule run can be one of a few types:

* **Succeeded**. The run successfully initiated a build. Note that a successful run only indicates that the build was successfully started. The build itself may still be running, or may have failed.
* **Ignored**. The run was attempted, but a build was not created. An ignored run likely indicates that everything is up-to-date and there was no work to do. See [staleness](/docs/foundry/data-integration/builds/#staleness) for more details.
* **Failed**. The schedule failed to run.

To learn more about schedules, refer to the following resources:

* Learn to [create a schedule](/docs/foundry/building-pipelines/create-schedule/).
* Learn about [scheduling best practices](/docs/foundry/building-pipelines/scheduling-best-practices/).
* Explore the [available trigger types](/docs/foundry/building-pipelines/triggers-reference/).

### Find and manage schedules

Schedules can be edited, managed, and updated in the schedule sidebar of the [Data lineage](/docs/foundry/data-lineage/manage-schedules/) application. Workflows around finding schedules can be conducted in the **Build schedules** application available from your Apps sidebar. Queries that you can run include but are not limited to the following:

* “Find paused schedules by a given user”
* “Find schedules scoped to a certain project, filter by name, and sort by latest run”
* “Find schedules with 'TESTING\_PROJECT\_1' in their name”
* “Find paused schedules"

You can use the following search criteria:

* **Files:** Find schedules by the datasets or other assets in Foundry that they build. If no branch is specified, the default branch will be used.
* **User:** Find schedules last updated by the user(s) selected.
* **Projects:** Find project-scoped schedules scoped to a specific project. User-scoped schedules are currently not supported in this parameter.

When arriving at the page you will initially see your own schedules. You can then filter schedules by name, pause or sort them. Search parameters are stored in the page link, allowing you to bookmark a page or share the link with other users.

The list of schedules can be further refined by **Schedule name** (if one is present on the schedule) and **Pause status**. It can also be sorted by **Name**, **Creation date**, **Last run date**, or **Last update date** of the schedule.

### Pause a schedule

A schedule can be [paused](/docs/foundry/building-pipelines/view-modify-schedules/#pause-a-schedule) to temporarily prevent it from running.

When a schedule is paused, its trigger state is reset and all observed events are forgotten. While a schedule is paused, it cannot be triggered and will ignore all observed events.

A paused schedule can be [resumed](/docs/foundry/building-pipelines/view-modify-schedules/#resume-a-schedule) to allow it to begin running again.

### Project scope

The datasets a schedule has permission to build is determined by whether a schedule is saved using the user's permissions to datasets or whether it is saved using the set of Projects containing the datasets being built. The former (user mode) is prone to unexpected changes if the permissions of the user change, since the schedule runs as if the user were running the build. The latter (Project-scoped mode) is more consistent, since the schedule is run independently of the user's permissions and only changes if the set of Projects the schedule is scoped to changes.
