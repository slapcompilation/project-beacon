<!-- source: https://palantir.com/docs/foundry/object-explorer/search-objects/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Search for objects

The results of a search with the global search bar from the Object Explorer [home page](/docs/foundry/object-explorer/getting-started/) will be shown on the search result page:

Your query is visible and editable in the search bar (shown as A below).

The page is divided into tabs **(B)**:

* The **All** tab is displayed by default and contains all results.
* Matching results can be filtered down into separate tabs:
  * Objects **(C)**,
  * Object types **(D)**, and
  * Artifacts **(E)**.

This search results page also contains a [sidebar](#navigate-using-the-sidebar) (**F** below).

![Searching](/docs/resources/foundry/object-explorer/OE_search_results_general_annotated.png)

## Navigate using the sidebar

These results are all categorized by their type. The navigation menu to the left (shown as **F** in the image above) can help you navigate the different categories.

Selecting the title of any section will also filter you to results of that type. This will also show you all of the results of that type in the event that there are more than the default number shown when in the **All results** view (indicated by **1** in the image below).

<img src="./media/OE_search_results_sidebar_annotated.png" alt="Sidebar" width="200"/>

* The first item, **All results** (shown as **1** in the image above), displays a sample of matches for each category. This is active by default when landing on the page.
* Next are **“Object type filters” (2)**. Clicking on any of them will show a longer list of matches for the specific object type. Clicking on **“View X other filters >”** at the bottom of the section will switch the tab from “All” to “Objects”, where you can explore the full list of object results and filters.
* **“Object type groups” (3)** filters the results by the associated group. Click on **“View all filters >”** at the bottom of the section to switch the tab from “All” to “Object types”, where you can explore the full list of object types results.
* Lastly are matches on **“Artifacts” (4)**, divided into "Explorations & Lists", "Comparison Views", and "Modules". Click on **“View all filters >”** at the bottom of the section to switch the tab from “All” to “Artifacts”, where you can explore the full list of results.

## Types of results

The Object Explorer search bar searches across all Objects in the platform (**(C)** in the top image), as well as object-related resources such as Object types **(D)**, saved Explorations, Lists, Comparisons, and Modules **(E)**.

### Sorting results

Within the individual object results section, the results are sorted as follows:

* All prominent object types are shown before non-prominent object types.
* Within the prominent and non-prominent results, object types are sorted (in ascending order) by the number of individual object results for that type. In other words, the prominent object type with the least results will display first, then prominent object types with more results, then the non-prominent object type with the least results (compared to other non-prominent types), and so on.

:::callout{theme="neutral"}
No hidden object or property types will be displayed as search results here or elsewhere in Object Explorer.
:::

### Exploring objects linked to a particular result

For matches on individual objects (**2** in the image above), hovering over the result gives you options for starting an exploration of objects across a particular link to that individual result.

Example: If you search for the airport “SFO”, you can hover over the result and start an exploration on flights arriving at the airport.

![Search Around](/docs/resources/foundry/object-explorer/OE_search_results_search_around.png)
