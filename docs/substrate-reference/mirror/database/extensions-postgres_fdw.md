<!-- source: https://supabase.com/docs/guides/database/extensions/postgres_fdw · mirrored 2026-08-13 from Supabase docs -->

# postgres_fdw

Query Postgres server from another

The extension enables Postgres to query tables and views on a remote Postgres server.

## Enable the extension

**Dashboard**

1. Go to the [Database](https://supabase.com/dashboard/project/_/database/tables) page in the Dashboard.
2. Click on **Extensions** in the sidebar.
3. Search for "postgres\_fdw" and enable the extension.

**SQL**

```sql
-- Example: enable the "postgres_fdw" extension
create extension if not exists postgres_fdw;

-- Example: disable the "postgres_fdw" extension
drop extension if exists postgres_fdw;
```

Procedural languages are automatically installed within `pg_catalog`, so you don't need to specify a schema.

## Create a connection to another database

1. **Create a foreign server**

Define the remote database address

```sql
    create server "<foreign_server_name>"
    foreign data wrapper postgres_fdw
    options (
        host '<host>',
        port '<port>',
        dbname '<dbname>'
    );
```

2. **Create a server mapping**

Set the user credentials for the remote server

```sql
create user mapping for "<dbname>"
server "<foreign_server_name>"
options (
    user '<db_user>',
    password '<password>'
);
```

3. **Import tables**

Import tables from the foreign database

Example: Import all tables from a schema

```sql
import foreign schema "<foreign_schema>"
from server "<foreign_server>"
into "<host_schema>";
```

Example: Import specific tables

```sql
import foreign schema "<foreign_schema>"
limit to (
    "<table_name1>",
    "<table_name2>"
)
from server "<foreign_server>"
into "<host_schema>";
```

4. **Query foreign table**



```sql
select * from "<foreign_table>"
```

### Configuring execution options

#### Fetch\_size

Maximum rows fetched per operation. For example, fetching 200 rows with `fetch_size` set to 100 requires 2 requests.

```sql
alter server "<foreign_server_name>"
options (fetch_size '10000');
```

#### Batch\_size

Maximum rows inserted per cycle. For example, inserting 200 rows with `batch_size` set to 100 requires 2 requests.

```sql
alter server "<foreign_server_name>"
options (batch_size '1000');
```

#### Extensions

Lists shared extensions. Without them, queries involving unlisted extension functions or operators may fail or omit references.

```sql
alter server "<foreign_server_name>"
options (extensions 'vector, postgis');
```

For more server options, check the extension's [official documentation](https://www.postgresql.org/docs/current/postgres-fdw.html#POSTGRES-FDW)

## Resources

- Official [`postgres_fdw` documentation](https://www.postgresql.org/docs/current/postgres-fdw.html#POSTGRES-FDW)
