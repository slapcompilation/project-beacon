<!-- source: https://supabase.com/docs/guides/database/extensions/pg_hashids · mirrored 2026-08-13 from Supabase docs -->

# pg_hashids: Short UIDs

Generate Short UIDs from Numbers

[pg\_hashids](https://github.com/iCyberon/pg_hashids) provides a secure way to generate short, unique, non-sequential ids from numbers. The hashes are intended to be small, easy-to-remember identifiers that can be used to obfuscate data (optionally) with a password, alphabet, and salt. For example, you may wish to hide data like user IDs, order numbers, or tracking codes in favor of `pg_hashid`'s unique identifiers.

## Enable the extension

**Dashboard**

1. Go to the [Database](https://supabase.com/dashboard/project/_/database/tables) page in the Dashboard.
2. Click on **Extensions** in the sidebar.
3. Search for "pg\_hashids" and enable the extension.

**SQL**

```sql
-- Enable the "pg_hashids" extension
create extension pg_hashids with schema extensions;

-- Disable the "pg_hashids" extension
drop extension if exists pg_hashids;
```

Even though the SQL code is `create extension`, this is the equivalent of "enabling the extension".
To disable an extension you can call `drop extension`.

It's good practice to create the extension within a separate schema (like `extensions`) to keep your `public` schema clean.

## Usage

Suppose we have a table that stores order information, and we want to give customers a unique identifier without exposing the sequential `id` column. To do this, we can use `pg_hashid`'s `id_encode` function.

```sql
create table orders (
  id serial primary key,
  description text,
  price_cents bigint
);

insert into orders (description, price_cents)
values ('a book', 9095);

select
  id,
  id_encode(id) as short_id,
  description,
  price_cents
from
  orders;

  id | short_id | description | price_cents
----+----------+-------------+-------------
  1 | jR       | a book      |        9095
(1 row)
```

To reverse the `short_id` back into an `id`, there is an equivalent function named `id_decode`.

## Resources

- Official [pg\_hashids documentation](https://github.com/iCyberon/pg_hashids)
