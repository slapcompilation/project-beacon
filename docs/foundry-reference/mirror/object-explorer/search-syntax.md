<!-- source: https://palantir.com/docs/foundry/object-explorer/search-syntax/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Search syntax

Object Explorer supports search across all objects and their properties. To help you find what you need, this page describes search syntax for the [global search bar](/docs/foundry/object-explorer/getting-started/#global-search-bar-a).

### Quotation marks

By default, individual words entered into the search bar will be searched for independently of each other. For example, searching `yellow cab` will return all objects with property values that match either `yellow` or `cab`.

This behavior can be altered using quotation marks. Searching Object Explorer for `"yellow cab"` will return all objects that have the exact phrase `yellow cab` in one or more property values. Searching for phrases like this will typically yield fewer results than searching for individual words.

### Logical operators (not/and/or)

The operators **NOT**, **AND**, and **OR** can be used to enhance text search in Object Explorer.

#### Join operators

Use **AND** and **OR** as join operators to compound two different search criteria. Specifically, you can use **AND** to search for an item that satisfies both criteria, while **OR** searches for those that satisfy at least one criterion. For example, to search for taxi rides that involve both Manhattan and Brooklyn, you can search for `Manhattan AND Brooklyn`. Similarly, to search for taxi rides that involve either Manhattan or Brooklyn, search for `Manhattan OR Brooklyn`.

#### Negation operators

Unlike the join operators applied to multiple criteria at once (such as `dogs AND cats` or `vanilla OR chocolate`), the **NOT** operator applies to a single criteria to search for elements that do *not* satisfy the criteria.

For example, if you search for `NOT Brooklyn`, then Object Explorer returns results for all searches *except* those that mention Brooklyn. The **NOT** operator can also be applied to compounded criteria. Alternatively, searching for `NOT (Manhattan OR Brooklyn)` returns all search results *except* those that mention Brooklyn or Manhattan.

#### Combining operators

Phrases created using quotation marks can also be incorporated into a search. For example, `"yellow cab" AND Manhattan` is a valid expression.

Logical operators can also be structured into more complex expressions using parentheses. For example, this search returns objects which do not reference Manhattan but do reference either yellow or green cabs: `("yellow cab" OR "green cab") AND (NOT Manhattan)`.

### Wildcards

* `?`:  A question mark can be used to replace a single character
  * Searching for `qu?ck` would return results for `quick`, `quack`, `qu4ck`, and so on
* `*`: An asterisk can be used to replace zero or more characters
  * Searching for `bro*` would return results for `bro`, `brother`, `broadcasting`, and so on
  * Leading wildcards are also supported: searching for `*smith` would return results for `smith`, `Goldsmith`, `Blacksmith`, and so on. Leading wildcards require the **Enable leading wildcards** render hint to be enabled on the string property in the **Ontology Manager**. For more information, see [Render hints](/docs/foundry/object-link-types/metadata-render-hints/).

:::callout{theme="neutral"}
Combined leading-and-trailing wildcards (`*term*`) are not supported. You can use either a leading wildcard (`*term`) or a trailing wildcard (`term*`), but not both at the same time. If you need to perform queries of this kind, consider using an alternative tool such as [Contour](/docs/foundry/contour/overview/).
:::

For a detailed explanation of how text search works across the platform, including analyzer behavior and search capabilities in Workshop and the Functions API, see [Understanding text search](/docs/foundry/object-explorer/understanding-text-search/).

### Fuzzy searching

Use the `~` operator at the end of a search term to perform a "fuzzy" match for similar terms and also exact matches. For example, `quikc~` would return results for `quick` and `quack`.
