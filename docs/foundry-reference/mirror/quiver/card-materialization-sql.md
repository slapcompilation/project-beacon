<!-- source: https://palantir.com/docs/foundry/quiver/card-materialization-sql/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Materialization SQL

The Materialization SQL card allows you to write SQL queries against materialization datasets in your analysis. The card uses SparkSQL syntax, functions, and operators.

:::callout{theme="neutral"}
The [Ontology SQL](/docs/foundry/quiver/card-ontology-sql/) card is the recommended approach for writing SQL against object sets. Use the Materialization SQL card as a fallback for cases when Ontology SQL is not suitable, such as for certain operations that are not supported by Ontology SQL.
:::

The Materialization SQL card accepts any materialization card as input. You can also pass scalar values such as dates, numbers, strings, and booleans as inputs to parameterize your queries.

The Materialization SQL card also supports AIP-powered SQL generation. You can describe the analysis you want to perform in natural language, and the card will generate a SQL query for you.

## Input type

Materialization, date, number, string, boolean

## Output type

Materialization

## Usage information

| Functionality                                           | Availability |
| ------------------------------------------------------- | ------------ |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards)        | Supported    |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported  |
