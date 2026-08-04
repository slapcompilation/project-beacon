<!-- source: https://palantir.com/docs/foundry/object-explorer/understanding-text-search/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Understanding text search

Text search across the Foundry platform, including in Object Explorer, Workshop, and the Functions API, relies on an underlying search engine that processes text through a mechanism called an **analyzer**. Understanding how analyzers work helps you write more effective search queries and build better search experiences in your applications.

## How text analysis works

When a string property is indexed for search, the platform processes its value through an analyzer. The default analyzer, called the **standard analyzer** (see [Lucene StandardAnalyzer ↗](https://lucene.apache.org/core/10_2_0/core/org/apache/lucene/analysis/standard/StandardAnalyzer.html)), performs the following steps:

1. Splits the text into individual words, called **tokens**, at whitespace and punctuation boundaries.
2. Converts all tokens to lowercase.

For example, a property value of `The Quick Brown Fox` is stored as the tokens `the`, `quick`, `brown`, and `fox`. When you search for `quick`, the search engine matches this token against the stored tokens and finds a match.

This token-based approach has important implications:

* Searches are **case-insensitive** by default because all tokens are converted to lowercase during indexing.
* Non-phrase queries match tokens independently. For example, a search for `brown fox` evaluates the `brown` and `fox` tokens separately, so it matches any property containing both tokens regardless of order or proximity. To require the tokens to appear together in order, use a phrase search (`"brown fox"`).
* A search for `rown` does **not** match `brown` because `rown` is not a complete token.

### Analyzer types

The analyzer used for a string property is configured in the Ontology. The following analyzer types are available:

| Analyzer | Behavior | Example value | Resulting tokens |
| ----- | ----- | ----- | ----- |
| Standard (default) | Splits on whitespace and punctuation, converts to lowercase | `The Quick-Brown Fox` | `the`, `quick`, `brown`, `fox` |
| Simple | Splits on any non-letter character, converts to lowercase (digits and punctuation are dropped) | `The Quick-Brown Fox 42` | `the`, `quick`, `brown`, `fox` |
| Not analyzed | Stores the entire value as a single token | `The Quick-Brown Fox` | `The Quick-Brown Fox` |
| Whitespace | Splits on whitespace only, preserves case | `The Quick-Brown Fox` | `The`, `Quick-Brown`, `Fox` |
| Language | Applies language-specific tokenization, stemming, and stopword removal | `Running quickly` (English) | `run`, `quick` |

The Language analyzer supports the following languages: `english`, `french`, `german`, `japanese`, `korean`, `arabic`, and `combined_arabic_english`.

:::callout{theme="neutral"}
You can check or change the analyzer for a property in the **Ontology Manager** under the property's search configuration. Properties must have the **Searchable** render hint enabled to be searchable.
:::

### Special character handling in tokens

The standard analyzer treats underscores and periods as part of a token rather than as separators. This means:

* `banana_pudding` is stored as a single token `banana_pudding`, not as `banana` and `pudding`.
* `user.name` is stored as a single token `user.name`, not as `user` and `name`.

A search for `banana` will **not** match the value `banana_pudding` when using token-based search methods. If you need to match such values, use a wildcard search like `banana*` or consider using the whitespace analyzer.

## Search in Object Explorer

:::callout{theme="neutral"}
Object Explorer remains the primary interface for Ontology discovery, global search, and viewing individual objects. [Insight](/docs/foundry/insight/overview/) builds on Object Explorer to provide expanded analysis features and is available alongside it.
:::

Object Explorer provides two search interfaces, each with different matching behavior.

### Global search bar

The global search bar on the Object Explorer home page and results page performs a token-based search across all searchable properties of all object types. By default, each word in your query is searched independently using OR logic. For example, searching for `yellow cab` returns objects matching either `yellow` or `cab`.

You can modify this behavior using the search syntax features described in [Search syntax](/docs/foundry/object-explorer/search-syntax/):

* **Phrase search:** Wrap terms in quotation marks (`"yellow cab"`) to require an exact phrase match.
* **Logical operators:** Use **AND**, **OR**, and **NOT** to combine search criteria.
* **Wildcards:** Use `*` to match zero or more characters, or `?` to match a single character. Both trailing wildcards (`term*`) and leading wildcards (`*term`) are supported. Note that combined leading-and-trailing wildcards (such as `*row*`) are not supported.
* **Fuzzy search:** Append `~` to a term to find approximate matches.

:::callout{theme="warning"}
Leading wildcard search (`*term`) is only available for string properties that have the **Enable leading wildcards** render hint enabled in the **Ontology Manager**. The **Searchable** render hint must also be selected. For more information on configuring render hints, see [Render hints](/docs/foundry/object-link-types/metadata-render-hints/).
:::

:::callout{theme="neutral"}
Leading wildcard search is **not** supported in the global search bar. It is available only when filtering on individual string properties in an exploration.
:::

### Property filters in explorations

When exploring a specific object type, you can add keyword filters on individual string properties. These filters offer the following match modes:

| Mode | Behavior |
| ----- | ----- |
| Contains (default) | Matches objects where the property contains all search tokens |
| Starts with | Matches objects where the property contains a token starting with the search term (equivalent to `term*`) |
| Exact | Matches objects where the property value exactly matches the search term |
| Is not | Excludes objects where the property contains the search tokens |

:::callout{theme="neutral"}
Property keyword filters match against individual tokens produced by the property's analyzer. If a property uses the **not analyzed** analyzer, the entire value is treated as a single token and must be matched accordingly.
:::

## Leading wildcard search

Leading wildcard search allows you to find objects where a property value ends with a specific term. For example, searching for `*smith` matches values such as `Goldsmith`, `Blacksmith`, and `smith`.

### Enabling leading wildcard search

To use leading wildcard search, you must enable the **Enable leading wildcards** render hint on the relevant string properties:

1. In the **Ontology Manager**, navigate to the object type and select the string property you want to configure.
2. In the property editor, select the **Enable leading wildcards** render hint.
3. Ensure the **Searchable** render hint is also selected, as it is required for leading wildcards to function.
4. Save your changes and reindex the object type's backing data sources into Object Storage v1 (Phonograph). You can wait for the next triggered reindex or manually start one from the **Data sources** tab.

For the full list of available render hints, see [Render hints](/docs/foundry/object-link-types/metadata-render-hints/).

### Using leading wildcard search

Once the render hint is enabled, you can use leading wildcards in Object Explorer property filters by prefixing your search term with `*`. For example:

* `*smith` matches `Goldsmith`, `Blacksmith`, and `smith`.
* `*ing` matches `running`, `swimming`, and `ing`.

:::callout{theme="warning"}
Combined leading-and-trailing wildcards (`*term*`) are **not** supported. You can use either a leading wildcard (`*term`) or a trailing wildcard (`term*`), but not both at the same time. If you need partial string matching, consider using [Contour](/docs/foundry/contour/overview/) or the Regex mode in a Workshop Filter List.
:::

## Search in Workshop

Workshop provides several ways to search and filter objects, each with different capabilities.

### Filter list keyword search

The [Filter List](/docs/foundry/workshop/widgets-filter-list/) keyword search component supports five search modes, selectable by the user at query time:

| Mode | Behavior |
| ----- | ----- |
| All | Broadest search. Combines token matching, wildcard matching, and prefix matching to return any results that partially or fully match the query. Wildcard sub-matches compare the query directly against indexed tokens without applying the analyzer to the query, so wildcard queries work most predictably on properties using the **Not analyzed** or **Whitespace** analyzer. |
| Any | Matches objects where the property contains any search tokens |
| Exact | Matches objects where the property contains all search tokens as an exact phrase, in order |
| Advanced | Supports Boolean syntax with **AND**, **OR**, **NOT**, quotation marks, and parentheses for complex queries |
| Regex | Matches objects using a regular expression pattern against the property tokens |

For more details on advanced filtering, see the [Filter List advanced filtering](/docs/foundry/workshop/widgets-filter-list/#advanced-filtering) documentation.

### Exploration search bar widget

The **Exploration Search Bar** widget in Workshop uses the same search infrastructure as the Object Explorer global search bar. It supports the same syntax including quotation marks for phrase search, logical operators, wildcards, and fuzzy search.

### Object set filter variables

[Object set filter variables](/docs/foundry/workshop/object-set-filter-variables/) support a `CONTAIN` filter that performs prefix-only matching. For example, if a property value is `id000123` and the filter query is `id0001`, this is considered a match. However, the query `d0001` would **not** match because it does not start at the beginning of the value.

## Search in the Functions API

The [Functions API](/docs/foundry/functions/api-object-sets/#filtering) provides the most granular control over text search behavior through its string filter methods:

| Method | Behavior |
| ----- | ----- |
| `.exactMatch()` | Matches objects where the property value exactly matches the query string |
| `.phrase()` | Splits the query into tokens and matches values containing all tokens in order with no other tokens between them |
| `.phrasePrefix()` | Same as `.phrase()`, but the last token also matches tokens that start with it |
| `.prefixOnLastToken()` | Splits the query into tokens and matches values containing all tokens in any order, where the last token also matches tokens starting with it |
| `.matchAnyToken()` | Splits the query into tokens and matches values containing any of the tokens |
| `.matchAllTokens()` | Splits the query into tokens and matches values containing all tokens in any order |
| `.fuzzyMatchAnyToken()` | Same as `.matchAnyToken()` but allows approximate matches within an edit distance |
| `.fuzzyMatchAllTokens()` | Same as `.matchAllTokens()` but allows approximate matches within an edit distance |

:::callout{theme="neutral"}
The `.phrase()` and `.phrasePrefix()` methods do not match across token boundaries created by underscores or periods. For example, `.phrase("banana")` does not match the value `banana_pudding` because `banana_pudding` is a single token.
:::

## Comparison of search capabilities

The table below summarizes which search capabilities are available in each context:

| Capability | Object Explorer (global) | Object Explorer (property filter) | Workshop Filter List | Functions API |
| ----- | ----- | ----- | ----- | ----- |
| Token search | Yes | Yes | Yes | Yes |
| Phrase search | Yes (quotation marks) | No | Yes (Exact mode) | Yes (`.phrase()`) |
| Prefix search | Yes (`term*`) | Yes (Starts with) | Yes (All mode) | Yes (`.phrasePrefix()`, `.prefixOnLastToken()`) |
| Leading wildcard search | No | Yes (requires render hint) | No | No |
| Wildcard search | Yes (`*`, `?`) | No | Yes (All mode) | No |
| Fuzzy search | Yes (`~`) | No | No | Yes (`.fuzzyMatchAnyToken()`, `.fuzzyMatchAllTokens()`) |
| Boolean operators | Yes (AND, OR, NOT) | No | Yes (Advanced mode) | Yes (`Filters.and()`, `Filters.or()`, `Filters.not()`) |
| Regular expressions | No | No | Yes (Regex mode) | No |

## Common pitfalls

* **Partial word searches do not match tokens:** Searching for `app` does not match `application` unless you use a wildcard (`app*`) or a prefix search method. This is because the standard analyzer produces the token `application`, and `app` is not an exact token match.
* **Underscores and periods prevent token splitting:** The standard analyzer treats `first_name` and `user.name` as single tokens. If you need to search for `first` within `first_name`, use a wildcard or consider changing the property's analyzer.
* **Multi-word queries without quotation marks use OR logic in Object Explorer:** Searching for `New York` in the Object Explorer global search bar returns objects matching `new` OR `york`, which may include results you did not expect. Use `"New York"` for an exact phrase match.
* **Wildcard filters do not analyze the query:** When using wildcard search (such as `Quick*`), the query string is not run through the analyzer — it is compared character-for-character against indexed tokens. This has two consequences:
  * **Case must match the indexed form.** On a property using the standard analyzer (which lowercases all tokens), a wildcard query containing uppercase letters will not match, even though the original text contained those letters before analysis lowercased them.
  * **Multi-word wildcard queries do not match.** Because each indexed token is a single word, a wildcard query containing whitespace (such as `a search term*`) is compared against individual tokens and cannot match. Wildcard searches are therefore effectively limited to single-word queries. For partial matching across words, consider [Contour](/docs/foundry/contour/overview/) or the Regex mode in a Workshop Filter List.
* **Leading wildcards require a render hint:** Leading wildcard search (`*term`) is only available on string properties that have the **Enable leading wildcards** render hint enabled in the **Ontology Manager**. Without this render hint, leading wildcard queries do not return results.
* **Combined leading-and-trailing wildcards are not supported:** You cannot search for `*term*` in Object Explorer or Workshop. If you need partial string matching, consider using [Contour](/docs/foundry/contour/overview/) or the Regex mode in a Workshop Filter List.
