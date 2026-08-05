<!-- source: https://palantir.com/docs/foundry/quiver/objects-overview/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Add objects

[Object types](/docs/foundry/object-link-types/object-types-overview/) are a core element of the [Ontology](/docs/foundry/ontology/core-concepts/). Object types are the schema definition of a real-world entity or event. In the Ontology, an **object** is a single instance of an object type; an object corresponds to a single real-world entity or event. An **object set** - as contrasted to a single object - refers to a collection of multiple object instances; that is, an object set represents a group of real-world entities or events.

Quiver natively supports many different cards for filtering, transforming, and visualizing object data.  The first step in analyzing object data is to add objects to an analysis.

This documentation describes several different ways of adding objects data to a Quiver analysis. Once you are comfortable adding objects, you can learn more about [filtering](/docs/foundry/quiver/objects-filter/) and [searching around to linked objects](/docs/foundry/quiver/objects-import-linked/).

## Add an object type

The simplest and most common way of adding objects data to a Quiver analysis is by adding all objects of a given object type.  You can do this by selecting **Add objects** in the center of the screen. You can add additional object data at any time by selecting the **Objects** button in the **Add data** section of the [analysis top bar](/docs/foundry/quiver/analysis-toolbars/#analysis-top-bar).

![Add data to Quiver analysis from analysis top bar.](/docs/resources/foundry/quiver/getting-started-add-data.png)

Selecting **Add objects** will open Quiver's [search bar](/docs/foundry/quiver/analysis-toolbars/#search-bar) to explore the Ontology for object types. The object types search menu allows keyword searching over object types. On the left side, the search menu shows tabs for any [object type groups](/docs/foundry/ontology-manager/overview/#discover), as well as a tab for prominent object types and time series object types.

Select an object type to add it to your analysis. After adding your object type, select **X** in the top right corner to close the search bar. You should now have an object set card in your analysis, containing all objects of the selected type. The card added shows a table preview of the objects inside of the set and a count of all objects in the top right.

For example, the animation below shows a search for objects related to `nyc` before adding the `NYC Buildings` object type.

![Add object data to your analysis.](/docs/resources/foundry/quiver/getting-started-adding-objects.gif)

## Add a single object

You can also add a single object to your analysis. To do this, after opening the object types search menu, at the top of the menu, switch to the **Objects** tab. On the **Objects** tab, you can search within specific object types for individual objects, either through property filters or a keyword. Selecting an object in the table of results will add the object to your analysis as a single object card.

The animation below provides an example of selecting the `Weather stations` object type, filtering to all objects where the country is equal to `US`, then filtering to `newark` and the `Newark Liberty International` object.

![Add a single object to your analysis.](/docs/resources/foundry/quiver/howto-object-single-add.gif)

## Open objects from Object Explorer

Object analysis often starts with an exploration in Object Explorer. If you have started your workflow in Object Explorer, you can seamlessly transition to Quiver by selecting the **Analyze in Quiver** button in the top right of the exploration.  This will create a new Quiver analysis containing the objects from your exploration.

![Create a new analysis from an object set in Object Explorer.](/docs/resources/foundry/quiver/howto-object-set-from-oe.gif)

## Import a saved object set

Another way of adding an object set to a Quiver analysis is by importing a saved object set. To do this, select the **Import object set** button in the top-right of the object types or objects search menu. This will open the file selector and allow you to select a saved object set to add to your analysis.

![Import a saved object set.](/docs/resources/foundry/quiver/howto-object-set-import.png)

## Preload objects using the URL

New analyses can also be preloaded with a defined object or object set using the URL. This can be done using the following endpoints:

* Object: `/quiver/views/load/object/<object_rid>`
* Object Set: `/quiver/views/load/object-set/<object_set_rid>`
* Object Type: `/quiver/view/load/object-type/<object_type_id>`
