<!-- source: https://palantir.com/docs/foundry/object-explorer/filter-results/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Filter results

Once you have started a [search](/docs/foundry/object-explorer/search-objects/), you are taken to an exploration view where you can conduct further filtering.

## Search bar

The search bar is the central hub for filtering the current set of objects. Click into the search bar to expose the search menu. From there, a few filtering options are available:

![Search](/docs/resources/foundry/object-explorer/explore_search.png)

### Filtering by properties (of the main object type)

→ You know what property you want to filter on?

> Example: “I want to filter on the language of my employees”

In the search menu, you can find a list of all properties **(B)** (and optionally their descriptions) sorted alphabetically.

![Search](/docs/resources/foundry/object-explorer/explore_search_filtered.png)

Type in the search bar **(A)** to search for specific property types. When the desired property is selected, a pop-over will you allow to chose values to filter on for that property. The input experience varies based on the type of the property (numeric, text, date, etc.). For text properties (e.g. language), options can be filtered by typing in the pill.

→ You know the value but not which property it belongs to?

> Example: “I want to filter for flights to Los Angeles“

Type the value (e.g. “Los Angeles”) in the search bar. If the value exists in the current object set, the option to filter “where Destination City Name is Los Angeles” will be available in the right hand side of the search menu.

### Filtering by keywords

Keyword searches are supported across all of an object type's properties or a specific property. To perform a keyword search across **any** properties that contain your search term, type in the search bar and use the Enter key. Modify the resulting filter by clicking on the filter pill "Has keywords".

To perform a keyword search on a property, select a text property, type your query, and use the Enter key or switch to the "Keyword" tab in the filter chart.

![Keyword](/docs/resources/foundry/object-explorer/explore_keyword_property.png)

By default, keyword searches match on the exact word or phrase and do not match on prefixes or suffixes. To perform a prefix search, see the **"Starts with"** modifier below.

#### Adding Term Modifiers

For a given search term, three options are available to modify the query. For consistency, use the toggles to control these modifiers rather than editing the terms in this dropdown.

* **"Is not":** Negates the current search term, looking only for objects whose properties do not contain it. Equivalent to typing `NOT term`.
* **"Starts with":** Performs a wildcard search, looking for objects with properties that start with the current search term. Equivalent to typing `term*`, and will match on both "term" and words like "terminal". For suffix matching (leading wildcard search), the **Enable leading wildcards** render hint must be enabled on the property. For details and limitations of wildcard search (including why multi-word wildcard queries do not match), see [Understanding text search](/docs/foundry/object-explorer/understanding-text-search/#common-pitfalls).
* **"Exact":** Performs a search for the entire search term, including spaces in their exact position. Performing an Exact search for "my search term" will look only for the phrase "my search term", not phrases like "my search for a term".

#### Adding Logical Operators (AND/OR)

Selecting “And” or “Or” will add a new search term to your existing query connected by the corresponding logical operator. After adding a new term, click on a term to edit it.

![Adding a new term](/docs/resources/foundry/object-explorer/new_search_term.png)

Search terms and logical operators can be nested to perform more complicated queries. See below for an example of a nested AND within an OR. Also note that modifiers for a given search term display in a compact view when not being edited.

![Nested Keywords](/docs/resources/foundry/object-explorer/nested_search_terms.png)

Click on an “And”/“Or" tag to flip the operator. Note that if operators on two adjacent levels become the same, the filter will simplify to a single level of nesting.

### Filtering on links

In the same way that filters can be applied directly on current object properties, one can filter objects based on their relations. To choose a relation for filtering, select in the left panel of the search menu.

To search for objects that have a particular link, select the "Has Link" option, highlighted below as "Has Flight Delay Event". This filter can be used to show either objects that have the associated link, or objects that do not have the associated link.

> Example: “Flights with an associated delay event.”

![Flights with a delay](/docs/resources/foundry/object-explorer/has_link.png)

To search for objects whose linked objects have a specific property, select the relation in the left side of the search menu panel. From there, choose a property type to filter.

> Example: “Flights on an Aircraft that were manufactured in 2018.”

![Flights property search](/docs/resources/foundry/object-explorer/linked_to_property.png)

It is also possible to search for objects that have links to other specific objects. For example, after selecting a link choose the option "Filter by Airline". This opens a filter for links to specific objects. Linked objects are displayed by their title in the resulting listogram.

> Example: "Flights operated by a particular airline."

![Flights linked to airline](/docs/resources/foundry/object-explorer/linked_to_object.png)
