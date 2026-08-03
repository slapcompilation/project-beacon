<!-- source: https://palantir.com/docs/foundry/workshop/widgets-exploration-filter-pills/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Exploration Filter Pills

Use the **Exploration Filter Pills** widget to visualize and apply filters to an object set.

![Exploration Filter Pills widget example](/docs/resources/foundry/workshop/widgets-exploration-filter-pills.png)

## Configuration options

* **Mode**
  * **Read only:** Display a non-editable view of any filters applied to a specified object set containing a single object type.
  * **Remove only:** Display an editable view of any filters applied to a specified object set containing a single object type, allowing users to remove any applied filters. An object set filter variable containing the applied filters may optionally be specified as output.
  * **Update existing filters only:** Display an editable view of any filters applied to a specified object set containing a single object type, allowing users to remove or edit any applied filters. An object set filter variable containing the applied filters may optionally be specified as output.
  * **Add, update, remove:** Display an editable view of any filters applied to a specified object set containing a single object type, allowing users to remove or edit any applied filters as well as add new property filters to be applied on the object set. An object set filter variable containing the applied filters may optionally be specified as output.
    * **Prevent users from changing operators (or, and):** Toggle to enable/disable users from changing operator values used between applied filters.
* **Display object type pill:** Toggle to enable/disable a pill describing the object type of the current object set.
