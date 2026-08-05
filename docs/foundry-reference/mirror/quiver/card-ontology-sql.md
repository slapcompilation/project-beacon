<!-- source: https://palantir.com/docs/foundry/quiver/card-ontology-sql/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Ontology SQL

:::callout{theme="neutral" title="Beta"}
Ontology SQL is in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and some features may not be available on your enrollment. Refer to the [Ontology SQL](/docs/foundry/sql-warehousing/ontology-sql/) documentation for more information.
:::

The Ontology SQL card allows you to write SQL queries against [object sets](/docs/foundry/quiver/objects-overview/) in your analysis. Using standard SQL syntax, you can select, filter, join, and aggregate object data to produce tabular results directly in Quiver.

The Ontology SQL card accepts object sets and other Ontology SQL cards as inputs. Object set inputs are referenced in your SQL query as tables, while other Ontology SQL cards can be chained together to compose more complex queries. You can also pass scalar values such as dates, numbers, strings, and booleans as inputs to parameterize your queries.

For a complete reference of available SQL operations, refer to the [Ontology SQL](/docs/foundry/sql-warehousing/ontology-sql/) documentation.

The Ontology SQL card also supports AIP-powered SQL generation. You can describe the analysis you want to perform in natural language, and the card will generate a SQL query for you.

Ontology SQL results can be converted to a [transform table](/docs/foundry/quiver/cards-transform-table/) for further manipulation and charting.

## Input type

Object set, Ontology SQL, date, number, string, boolean

## Output type

Ontology SQL

## Usage information

| Functionality                                           | Availability |
| ------------------------------------------------------- | ------------ |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards)        | Supported    |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported  |

## See also

* [Ontology SQL reference](/docs/foundry/sql-warehousing/ontology-sql/)
* [Transform table](/docs/foundry/quiver/card-transform-table/)
