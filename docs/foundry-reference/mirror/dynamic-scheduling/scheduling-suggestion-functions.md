<!-- source: https://palantir.com/docs/foundry/dynamic-scheduling/scheduling-suggestion-functions/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Suggestion Function

A key challenge in scheduling and resource allocation workflows is knowing where and when specific events can occur or where they can be moved. Most schedules have limitations and not all schedule options are equally appropriate; by building these limitations and criteria into logic, tools can help users quickly evaluate choices. The Suggestion Functions feature helps guide user behavior by visually indicating the suitability of potential schedule object puck placement based on logic defined by your organization.

Each Suggestion Function is backed by a TypeScript function. The output of the rule logic can be used to highlight areas where an assignment can be made or, by contrast, areas where assignments cannot be made. Application builders have the option to enforce these suggestions through a setting in the Workshop widget configuration. When turned on, this feature will force placement of the puck to the closest highlighted region.

:::callout{theme="neutral"}
The results of the Suggestion Functions in the Scheduling Gantt Chart are static. The function is run during initial application load and any actions made afterwards are **not** accounted for. This has implications for whether this feature is suitable for your workflow.
:::

Below are two examples of how Suggestion Functions can be used effectively.

In the following image, the Suggestion Function has been written to suggest the preferred location of the individual who is being assigned (in this case, “Susan”). The green area indicates that Garden City is Susan’s preferred location, while Sandbar, indicated in grey, is not preferred.

<img src="./images/suggestion-function-1.png" alt="Example: Suggestion function interface." width="700" >

In the below example, an application is used to assign flights to pilots. The vertical slice of time (in green), indicates to the scheduler that they should not adjust the start/end time of the flight, but only the individual who is the pilot.

<img src="./images/suggestion-function-2.png" alt="Example: Suggestion function interface." width="700" >

## Functions interface

The types below represent the necessary information to write a Search Function when triggered from either a row or a puck, which includes details about the search group.

```
/*
   Suggestion functions take in a list of puck primary keys as well as
   the Gantt's start/end time and returns a mapping of puck primary keys
   to a mapping of row primary keys to an array of time slots. 
*/


type ISuggestion = (
    scheduleObjectPrimaryKeys: string[],
    domainStart: Timestamp,
    domainEnd: Timestamp,
) => FunctionsMap<string, FunctionsMap<string, Array<ISuggestionSlot>>>

/* Suggestion types */

export interface IDomain {
    start: Long;
    end: Long;
}

/* rating is used to determine the highlight color in widget UI. Based on
   scale of -1 to 1. Closer to 1 and the highlight will be darker shade of
   green. Closer to -1 and the highlight will be red. 
*/

export interface ISuggestionSlot {
    domain: IDomain;
    rating: Float;
}

export type IValidSlots = Array<ISuggestionSlot>;
export type ISlotMappings = FunctionsMap<string, IValidSlots>;
export type ISuggestionResult = FunctionsMap<string, ISlotMappings>;


/*
  In workflows where schedule objects have a set start/end time and may only change
  assigned resources (vertical slice highlighted), the ALL_ROWS_ID can be used 
  as a shortcut. 
*/

export const ALL_ROWS_ID = "__ALL_ROWS";


```
