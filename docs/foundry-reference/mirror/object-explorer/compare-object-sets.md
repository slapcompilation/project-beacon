<!-- source: https://palantir.com/docs/foundry/object-explorer/compare-object-sets/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Compare object sets

Comparison Views provide users with the option to compare two filtered object sets. The objects may be derived from dynamic filtering of objects or from explorations saved previously.

## Entering Comparison Mode

To use Comparison Mode:

* Go to Object Explorer, open an object type, and filter down to the set of objects of that type you want to compare. In the example below, we’ve filtered to flights leaving New York City.
* Select the **Compare** button below the search bar. After selecting **Compare**, you can choose a comparison set of objects, for instance:
  * An existing saved exploration,
  * All objects of the given type (such as **All Flights**), or
  * You can define a new set of objects for comparison.

Below, we are comparing flights from New York City to an existing exploration for all flights departing California.

![Enter Comparison View](/docs/resources/foundry/object-explorer/comparison_enter.png)

To define a new object set on-the-fly for comparison (a process known as "dynamic filtering"), select **Create new set of Flights** as seen in the comparison dropdown in the image above.

This brings up a view that allows us to define and edit the object set, or change the color used for the comparison set:

![Comparison Dynamic Filtering](/docs/resources/foundry/object-explorer/comparison_dynamic.png)

Once you enter the comparison mode, all of the charts in the layout will change to show the results from each of the compared sets side-by-side. This allows us to see how things compare, such as the most common arrival airports for flights from NYC versus CA, or aircraft registrations. All the functionality of OE is retained in this comparison view, for instance the ability to filter using the charts, the ability to see the results in the table view, actions, export, and so on.

![Comparison Generic](/docs/resources/foundry/object-explorer/comparison_generic.png)

## Filtering

As mentioned above, you can jointly apply filters on these compared sets to narrow down the comparison view. For example, you may only want to see flights on an A321 airplane in the comparison in order to see how New York’s cancelled flights compare to those from California. This can be done in the same way as you normally would in OE by applying the filter from the search bar (as shown below) or directly from the chart.

![Comparison Filtering](/docs/resources/foundry/object-explorer/comparison_filter.png)

## Collaboration

### Saving Comparison Views

These Comparison Views can be saved and shared just like Explorations by clicking the **Save** button in the top-right. When saving the view, you will be prompted for a name, and you can also provide an optional description and/or a custom save location.

<img src="./media/comparison_save.png" alt="Save Comparison" width="300"/>

### Sharing Comparison Views

To share your comparison, simply select the **Share** button to the left of the **Save** button. You will be prompted to decide which users or groups you want to share this comparison with, what access level you want to grant them, and whether you want the comparison to have a default role for all users. Sharing your comparison will not share access to the linked explorations and/or underlying objects, so any given viewer will need to have the appropriate role for the data in addition to having access to the saved comparison itself.

### Searching for Comparison Views

These saved Comparisons can be searched for using the main OE search bar on the home page.

![Comparison Search Results](/docs/resources/foundry/object-explorer/comparison_search_result.png)
