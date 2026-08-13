<!-- source: https://supabase.com/docs/guides/database/extensions/pg_graphql · mirrored 2026-08-13 from Supabase docs -->

# pg_graphql: GraphQL for Postgres

A GraphQL Interface for Postgres

[pg\_graphql](https://supabase.github.io/pg_graphql/) is Postgres extension for interacting with the database using [GraphQL](https://graphql.org) instead of SQL.

The extension reflects a GraphQL schema from the existing SQL schema and exposes it through a SQL function, `graphql.resolve(...)`. This enables any programming language that can connect to Postgres to query the database via GraphQL with no additional servers, processes, or libraries.

The `pg_graphql` resolve method is designed to interop with [PostgREST](https://postgrest.org/en/stable/index.html), the tool that underpins the Supabase API, such that the `graphql.resolve` function can be called via RPC to safely and performantly expose the GraphQL API over HTTP/S.

For more information about how the SQL schema is reflected into a GraphQL schema, see the [pg\_graphql API docs](https://supabase.github.io/pg_graphql/api/).

## Enable the extension

**Dashboard**

1. Go to the [Database](https://supabase.com/dashboard/project/_/database/tables) page in the Dashboard.
2. Click on **Extensions** in the sidebar.
3. Search for "pg\_graphql" and enable the extension.

**SQL**

```sql
-- Enable the "pg_graphql" extension
create extension pg_graphql;

-- Disable the "pg_graphql" extension
drop extension if exists pg_graphql;
```

Even though the SQL code is `create extension`, this is the equivalent of "enabling the extension".
To disable an extension you can call `drop extension`.

## Usage

Given a table

```sql
create table "Blog"(
  id serial primary key,
  name text not null,
  description text
);

insert into "Blog"(name)
values ('My Blog');
```

The reflected GraphQL schema can be queried immediately as

```sql
select
  graphql.resolve($$
    {
      blogCollection(first: 1) {
        edges {
          node {
            id,
            name
          }
        }
      }
    }
  $$);
```

returning the JSON

```json
{
  "data": {
    "blogCollection": {
      "edges": [
        {
          "node": {
            "id": 1,
            "name": "My Blog"
          }
        }
      ]
    }
  }
}
```

Note that `pg_graphql` supports schema introspection, so you can connect any GraphQL IDE or schema inspection tool to see the full set of fields and arguments available in the API. Starting from `pg_graphql` 1.6.0, introspection is **disabled by default** and must be enabled per schema:

```sql
comment on schema public is e'@graphql({"introspection": true})';
```

See the [upgrade notes](https://supabase.com/guides/platform/upgrading#upgrading-to-pg_graphql-160) for details.

## API

- [`graphql.resolve`](https://supabase.github.io/pg_graphql/sql_interface/): A SQL function for executing GraphQL queries.

## Resources

- Official [`pg_graphql` documentation](https://github.com/supabase/pg_graphql)
