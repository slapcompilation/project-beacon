<!-- source: https://palantir.com/docs/foundry/building-pipelines/common-schedules/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Common scheduling configurations

Get started with some examples of common schedules:

* [Build datasets regularly](#build-datasets-regularly)
* [Build datasets when new data is available](#build-datasets-when-new-data-is-available)
* [Advanced (multiple) trigger configurations](#advanced-multiple-trigger-configurations)
* [Update a dataset at a specific time *only* if its parent has been updated](#update-a-dataset-at-a-specific-time-only-if-its-parent-has-been-updated)

## Build datasets regularly

For this example, we want **raw\_taxi (cleaned)** to update every weekday at 9 AM, and we want to build not just **raw\_taxi (cleaned)** but also all of its upstream dependencies. We should configure our schedule as follows:

![image-time-based-full-page]

## Build datasets when new data is available

For this example, we want the schedule to run whenever another dataset has been updated. We can use the same configuration as in the previous section, with one small modification. An [event trigger](/docs/foundry/building-pipelines/triggers-reference/#event-trigger) should be chosen, selecting which dataset(s) on the graph you wish to trigger the update.

![when-datasets-update]

For more details on event-based schedules, see the [event triggers](/docs/foundry/building-pipelines/triggers-reference/#event-trigger) documentation.

## Advanced (multiple) trigger configurations

![image-of-any-trigger-config]
![image-of-or-trigger-config]

For this example, we want **Dataset D** to update at 9 AM daily, but also whenever the dataset it depends on, **Parent A**, sees a change. According to [the table of combinations for compound triggers](/docs/foundry/building-pipelines/triggers-reference/#compound-trigger), if we combine a time-based trigger with an event-based trigger through an OR, the dataset will build at time T, as well as when event E occurs. Therefore, we will set the dataset we want to schedule the build for to **Dataset D**, and add a time-based trigger for 9 AM with an event-based trigger that watches for any update on **Parent A**. Choosing "Any of these triggers", or an advanced configuration and adding an OR between the conditions, are equivalent in this case.

## Update a dataset at a specific time *only* if its parent has been updated

![image-of-all-trigger-config]
![image-of-and-trigger-config]

For this example, we want **Dataset D** to update at 9 AM daily, but only if the dataset it depends on, **Parent A**, has seen a change. According to [the table of combinations for compound triggers](/docs/foundry/building-pipelines/triggers-reference/#compound-trigger), if we combine a time-based trigger with an event-based trigger through an AND, the dataset will build at time T *if* event E has previously occurred. Therefore, we will set the dataset we want to schedule the build for to **Dataset D**, and add a time-based trigger for 9 AM with an event-based trigger that watches for any update on **Parent A**. Choosing "All of these triggers" or an advanced configuration and adding an AND between the conditions, are equivalent in this case.

:::callout{theme="neutral"}
This configuration does not limit the time window in which **Parent A** has been updated. Whether it was updated at 8:55 AM on the same day or at 9:10 AM the day before, the event-based trigger will evaluate to TRUE at 9 AM, causing all criteria to be met and the schedule to run. This means that if **Parent A** is consistently updating *after* 9 AM, e.g. at 9:10 AM every day, then **Dataset D** will be built daily at 9 AM, with data from **Parent A** that is 23 hours and 50 minutes old.
:::

[image-time-based-full-page]: ./media/time-based-full-page.png

[when-datasets-update]: ./media/when-datasets-update.png

[image-of-all-trigger-config]: ./media/T1_AND_E1.png

[image-of-and-trigger-config]: ./media/T1_AND_E1_advanced.png

[image-of-or-trigger-config]: ./media/T1_OR_E1_advanced.png

[image-of-any-trigger-config]: ./media/T1_OR_E1.png
