<!-- source: https://supabase.com/docs/guides/database/database-advisors · mirrored 2026-08-13 from Supabase docs -->

# Performance and Security Advisors

Check your database for performance and security issues

You can use the Database Performance and Security Advisors to check your database for issues such as missing indexes and improperly set-up RLS policies.

## Using the advisors

In the dashboard, navigate to [Security Advisor](https://supabase.com/dashboard/project/_/database/security-advisor) and [Performance Advisor](dashboard/project/_/database/performance-advisor) under Database. The advisors run automatically. You can also manually rerun them after you've resolved issues.

## Available checks

### 0001_unindexed_foreign_keys
  
**Level:** INFO

**Summary:** Unindexed foreign keys

**Ramification:** Database queries that filter or join on these columns will be slower because there is no index to speed them up.

***

### Rationale

In relational databases, indexing foreign key columns is a standard practice for improving query performance. Indexing these columns is recommended in most cases because it improves query join performance along a declared relationship.

### What is a Foreign Key?

A foreign key is a constraint on a column (or set of columns) that enforces a relationship between two tables. For example, a foreign key from `book.author_id` to `author.id` enforces that every value in `book.author_id` exists in `author.id`. Once the foriegn key is declared, it is not possible to insert a value into `book.author_id` that does not exist in `author.id`. Similarly, Postgres will not allow us to delete a value from `author.id` that is referenced by `book.author_id`. This concept is known as referential integrity.

### Why Index Foreign Key Columns?

Given that foreign keys define relationships among tables, it is common to use foreign key columns in join conditions when querying the database. Adding an index to the columns making up the foreign key improves the performance of those joins and reduces database resource consumption.

```sql
select
    book.id,
    book.title,
    author.name
from
    book
    join author
        -- Both sides of the following condition should be indexed
        -- for best performance
        on book.author_id = author.id
```

### How to Resolve

Given a table:

```sql
create table book (
    id serial primary key,
    title text not null,
    author_id int references author(id) -- this defines the foreign key
);
```

To apply the best practice of indexing foreign keys, an index is needed on the `book.author_id` column. We can create that index using:

```sql
create index ix_book_author_id on book(author_id);
```

In this case we used the default B-tree index type. Be sure to choose an index type that is appropriate for the data types and use case when working with your own tables.

### Example

Let's look at a practical example involving two tables: `order_item` and `customer`, where `order_item` references `customer`.

Given the schema:

```sql
create table customer (
    id serial primary key,
    name text not null
);

create table order_item (
    id serial primary key,
    order_date date not null,
    customer_id integer not null references customer (id)
);
```

We expect the tables to be joined on the condition

```sql
customer.id = order_item.customer_id
```

As in:

```sql
select
    customer.name,
    order_item.order_date
from
    customer
    join order_item
        on customer.id = order_item.customer_id
```

Using Postgres' "explain plan" functionality, we can see how its query planner expects to execute the query.

```
Hash Join  (cost=38.58..74.35 rows=2040 width=36)
  Hash Cond: (order_item.customer_id = customer.id)
  ->  Seq Scan on order_item  (cost=0.00..30.40 rows=2040 width=8)
  ->  Hash  (cost=22.70..22.70 rows=1270 width=36)
        ->  Seq Scan on customer  (cost=0.00..22.70 rows=1270 width=36)
```

Notice that the condition `order_item.customer_id = customer.id` is being serviced by a `Seq Scan`, a sequential scan across the `order_items` table. That means Postgres intends to sequentially iterate over each row in the table to identify the value of `customer_id`.

Next, if we index `order_item.customer_id` and recompute the query plan:

```sql
create index ix_order_item_customer_id on order_item(customer_id);

explain
select
    customer.name,
    order_item.order_date
from
    customer
    join order_item
        on customer.id = order_item.customer_id
```

We get the query plan:

```
Hash Join  (cost=38.58..74.35 rows=2040 width=36)
  Hash Cond: (order_item.customer_id = customer.id)
  ->  Seq Scan on order_item  (cost=0.00..30.40 rows=2040 width=8)
  ->  Hash  (cost=22.70..22.70 rows=1270 width=36)
        ->  Seq Scan on customer  (cost=0.00..22.70 rows=1270 width=36)
```

Note that nothing changed.

We get an identical result because Postgres' query planner is clever enough to know that a `Seq Scan` over an empty table is extremely fast, so theres no reason for it to reach out to an index. As more rows are inserted into the `order_item` table the tradeoff between sequentially scanning and retriving the index steadily tip in favor of the index. Rather than manually finding this inflection point, we can hint to the query planner that we'd like to use indexes by disabling sequentials scans except where they are the only available option. To provides that hint we can use:

```sql
set local enable_seqscan = off;
```

With that change:

```sql
set local enable_seqscan = off;

explain
select
    customer.name,
    order_item.order_date
from
    customer
    join order_item
        on customer.id = order_item.customer_id
```

We get the query plan:

```
Hash Join  (cost=79.23..159.21 rows=2040 width=36)
  Hash Cond: (order_item.customer_id = customer.id)
  ->  Index Scan using ix_order_item_customer_id on order_item  (cost=0.15..74.75 rows=2040 width=8)
  ->  Hash  (cost=63.20..63.20 rows=1270 width=36)
        ->  Index Scan using customer_pkey on customer  (cost=0.15..63.20 rows=1270 width=36)
```

The new plan services the `order_item.customer_id = customer.id` join condition using an `Index Scan` on `ix_order_item_customer_id` which is far more efficient at scale.

### 0002_auth_users_exposed
  
**Level:** ERROR

**Summary:** User data exposed through a view

**Ramification:** A view is exposing your users' personal information to anyone who can access your API.

***

### Rationale

Referencing the `auth.users` table in a view can inadvertently expose more data than intended.

### Why shouldn't you expose auth.users with a view?

`auth.users` is the primary table that backs Supabase Auth. It contains detailed information about each of your projects users, their login methods, and other personally identifiable information.

In Postgres, the built in mechanism for controlling access to rows within a table is row level security (RLS). By default, views in Postgres are "security definer" which means they do not respect RLS rules associated with the tables in the view's query. Materialized views similarly don't support RLS.

As a result, a `public` security definer view referencing `auth.users` exposes all user records to all API users, which is likely not what application developers intended.

### How to Resolve

There are 2 recommended solutions for exposing user data to your application.

#### Trigger on auth.users

This option involves creating a table in the public schema, e.g. `public.profiles`, containing a subset of columns from `auth.users` that are appropriate for your application's use case. You can then set a trigger on `auth.users` to automatically insert the relevant data into `public.profiles` any time a new user is inserted into `auth.users`.

Note that triggers execute in the same transaction as the insert into `auth.users` so you must check the trigger logic carefully as any errors could block user signups to your project.

An additional benefit of this approach is that the `public.profiles` table provides a logical place to store any additional user metadata that is needed for the application.

To start we need a location to store public user data in the `public` schema:

```sql
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  first_name text,
  last_name text,

  primary key (id)
);
```

Next, we create a trigger function to copy the data from `auth.users` into `public.profiles` when new rows are inserted

```sql
-- inserts a row into public.profiles
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, age)
  values (new.id, new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data['age']::integer);
  return new;
end;
$$;

-- trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

Finally, we can create row level security policies on the `public.profiles` schema to restrict access to certain operations:

```sql
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );
```

For more information on this approach see the [auth docs](https://supabase.com/docs/guides/auth/managing-user-data).

#### Security Invoker View with RLS on auth.users

The second recommended approach to securely exposing `auth.users` data is to create a view with the configuration option `security_invoker=on`. That setting, introduced in Postgres 15, tells the view to respect the RLS policies associated with the underlying tables from the query. Next, we can enable RLS on `auth.users` and create any policy we need to restrict access to the data.

To enable security invoker mode on the view we can use the `with (security_invoker=on)` clause:

```sql
create view public.members
    with (security_invoker=on)
    as
select
    id,
    raw_user_meta_data ->> 'first_name' as first_name,
    created_at
from
    auth.users;
```

Next, grant permissions and enable RLS on `auth.users`:

```sql
grant select on auth.users to authenticated;
alter table auth.users enable row level security;
```

and finally, create a policy defining which users should be able to see each record:

```sql
create policy select_self on auth.users
  for select
  using ((select auth.uid()) = id);
```

### 0003_auth_rls_initplan
  
**Level:** WARN

**Summary:** Slow security policy detected

**Ramification:** A security policy is running its check on every single row instead of once per query, which slows down your database as your tables grow.

***

### Rationale

Row-Level Security (RLS) policies are the mechanism for controlling access to data based on user roles or attributes. These policies frequently use the built-in `current_setting` function and provided helper functions in the `auth` schema including `auth.uid()`, `auth.role()`, `auth.email()`, and `auth.jwt()` to retrieve information about the current querying user. Improperly written RLS policies can cause these functions to execute once-per-row, rather than once-per-query. While the `current_setting()` and `auth.<function_name>()` functions are efficient, if executed once-per-row they can lead to significant performance bottlenecks at scale.

### The Performance Issue

When an RLS policy is applied to a query, the conditions specified in the policy are evaluated for each row that the query touches. This means that if a policy condition calls a helper function like `auth.uid()`, this function is executed repeatedly for every row. In queries affecting thousands of rows, this behavior can drastically reduce query performance, as the overhead of executing these functions adds up quickly.

### How to Resolve

To optimize the performance of RLS policies using `auth` helper functions we aim to reduce the number of times the helper functions are called. This can be achieved by caching the result of the function call for the duration of the query. Instead of calling the function directly in the policy condition, you can wrap the function call in a subquery. This approach executes the function once, caches the result, and compares this cached value against the column values for all subsequent rows.

For example, consider the policy:

```sql
create policy "inefficient_document_access" on documents
to authenticated
using ( auth.uid() = creator_id );
```

In this policy, `auth.uid()` is called for every row in the `documents` table to check if the `creator_id` matches the current user's ID. If the number of rows in `documents` is 150,000 the `auth.uid()` function will be executed 150,000, potentially incurring over 3 seconds of overhead per query.

If we wrap the `auth.uid()` call in a subquery:

```sql
create policy "efficient_document_access" on user_data
to authenticated
using ( (select auth.uid()) = user_id );
```

Then auth.uid() is called only once at the beginning of the query execution, and its result is reused for each row comparison. That change reduces the overhead from a few seconds to a few microseconds with no impact on the result set.

Since the output values for the `auth` helper functions are set on a per-query basis there is no downside to aggressively applying this performance optimization.

### 0004_no_primary_key
  
**Level:** INFO

**Summary:** Table has no primary key

**Ramification:** Without a primary key, rows can't be uniquely identified, which can cause data issues and slower queries.

***

### Rationale

Tables in a relational database should ideally have a key that uniquely identifies a row within that table. Tables lacking a primary key is often considered poor design, as it can lead to data anomalies, complicate data relationships, and degrade query performance.

### What is a Primary Key?

A primary key is a single column or a set of columns that uniquely identifies each row in a table.

Primary keys are important because they enable:

1. **Uniqueness and Integrity**: Ensures that each row in the table is unique and identifiable.
2. **Performance**: The database automatically creates an index for the primary key, improving query performance when retrieving or manipulating data based on the primary key.
3. **Relationships**: Unique keys, like primary keys, are a prerequisite for defining foreign keys in other tables, which are critical for relational database design and efficient joins.

### How to Resolve

For a table that lacks a primary key, the resolution involves identifying a column (or a set of columns) that can uniquely identify each row and altering the table to designate those columns as the primary key.

Given a table:

```sql
create table customer (
    id integer not null,
    name text not null,
    email text not null
    -- Notice the lack of a PRIMARY KEY constraint
);
```

If we assume `id` is unique for each customer, we can add a primary key constraint to the table using:

```sql
alter table customer add primary key (id);
```

If no single column can serve as a unique identifier, consider using a composite key. A composite key combines multiple columns to form a unique identifier for each row.

Example:

Consider a table event\_log that logs user activities without a primary key:

```sql
create table event_log (
    user_id integer not null,
    event_time timestamp not null,
    action text not null
    -- A combination of user_id and event_time can uniquely identify rows
);
```

To resolve the lack of a primary key and ensure that each log entry is uniquely identifiable, we can add a composite primary key on user\_id and event\_time:

```sql
alter table event_log add primary key (user_id, event_time);
```

Ensure every table has a primary key, even if it's a synthetic key that doesn't have a natural counterpart in the data model.
When possible, use a simple fixed size types like `int`, `bigint`, and `uuid` as the primary key for maximum efficiency.

### 0005_unused_index
  
**Level:** INFO

**Summary:** Unused index found

**Ramification:** This index is never used by any query but still slows down every insert, update, and delete on the table.

***

### Rationale

Unused indexes in a database are a silent performance issue. While indexes are important for speeding up search queries, every index also adds overhead to the database. This overhead occurs because the database must update each index whenever data in the indexed table are inserted, updated, or deleted. If an index is never used by your queries, it burdens the database with unnecessary work, which can slow down write operations and consume additional storage space.

### What is an Index?

An index in a database is similar to an index in a book. It allows the database to find data without scanning the entire table. An index is created on a column or a set of columns in a table. Queries that search or sort data based on these columns can find data more quickly and efficiently by referring the index instead of each row in the table.

### What are Unused Indexes

Unused indexes are indexes that have not been accessed by any query execution plans. This might occur if indexes were created proactively to support potential future query patterns or if application usage patterns change after a schema migration.

### How to Resolve

Before deleting an index, it's important to confirm that the index is genuinely unused and was unintentionally created:

- Consider future usage patterns. An index might be unused now but could be critical for upcoming features or during specific times of the year.
- Test the impact of removing the index in a development or staging environment to ensure that performance or query plans are not adversely affected.

To remove an unused index, use the `drop index` statement:

```sql
drop index <schema_name>.<index_name>;
```

Replacing `schema_name` and `index_name` with the actual names from your database.

### 0006_multiple_permissive_policies
  
**Level:** WARN

**Summary:** Multiple permissive policies on a table

**Ramification:** When several permissive policies exist on one table, access can become broader than intended and queries slower.

***

### Rationale

In Postgres, Row Level Security (RLS) policies control access to rows in a table based on the executing user. When multiple permissive policies are applied to the same table the user may have access to a selected row through any of those policies. This means that, in the worst case, all of the relevant RLS policies must be applied/tested before Postgres can determine if a row should be visible. At scale, these checks add significant overhead to SQL queries and can be a performance bottleneck.

### Row Level Security Policies

RLS policies in Postgres are rules applied to tables that determine whether rows can be selected, inserted, updated, or deleted. These policies can be set to `PERMISSIVE` or `RESTRICTIVE`. Permissive policies allow actions unless explicitly restricted by a restrictive policy. When multiple permissive policies are defined for a table, they act in a cumulative manner — if any policy allows access, the access is granted. In other words, the policies compose with `OR` semantics.

### Risks with Multiple Permissive Policies

#### Access Control

Multiple permissive policies on a table can make it challenging to accurately predict and control which rows are accessible to different users. This complexity can inadvertently lead to overly permissive access configurations, undermining data security and integrity.

#### Performance

Since any one of N permissive policies can provide a user access to a given table's row, in the worst case Postgres must execute all N policies to determine if a row should be visible. These multiple checks raise the probability of a query falling off an index and broadly increase the resource consumption of every query on the impacted table.

### How to Resolve

Consider a table `employee_data` with two permissive policies:

Policy A allows access to employees in the same department.
Policy B allows access to employees at or above a certain grade level.

Our intention is for users to be able to see employee data for employees within their own department who are below the querying user's grade level.

```sql
-- Policy A
create policy department_access on employee_data
    for select
    using (department = current_user_department());

-- Policy B
create policy grade_level_access on employee_data
    for select
    using (grade_level <= current_user_grade_level());
```

The implementation contains a logic error. As written, every employee can see `employee_data` for every other employee within their departemnt. Similarly, every employee can see every other employee's data at or below their own grade level.

To address this issue, we can combine the two policies.

```sql
drop policy department_access on employee_data;
drop policy grade_level_access on employee_data;

create policy consolidated_access on employee_data
    for select
    using (
        department = current_user_department()
        or grade_level >= current_user_grade_level()
    );
```

In addition to addressing the logic bug, we have also improved the Postgres query planner's ability to inline the policy to check access to rows, which reduces the chance of the query falling off index.

While consolidating RLS policies for a given role/action combination is a best practices, it is not a hard rule. If consolidating policies leads to unreadable SQL then you may opt to have multiple policies for maintainability.

### 0007_policy_exists_rls_disabled
  
**Level:** INFO

**Summary:** Security policy not enforced

**Ramification:** A security policy exists but has no effect because Row-Level Security hasn't been turned on for the table.

***

### Rationale

In Postgres, Row Level Security (RLS) policies control access to rows in a table based on the executing user. Policies can be created, but will not be enforced until the table is updated to enable row level security. Failing to enable row level security is a common misconfiguration that can lead to data leaks.

### How to Resolve

To enable existing policies on a table execute:

```sql
alter table <schema>.<table> enable row level security;
```

### Example

Given the schema:

```sql
create table public.blog(
    id int primary key,
    user_id uuid not null,
    title text not null
);

create policy select_own_posts on public.blog
    for select
    using ((select auth.uid()) = user_id);
```

A user may incorrectly believe that their policies are being applied. Before the policies will take effect, we first must enable row level security on the underlying table.

```sql
alter table public.blog enable row level security;
```

### 0008_rls_enabled_no_policy
  
**Level:** INFO

**Summary:** No access rules defined

**Ramification:** Row-Level Security is enabled but no policies exist, so no data can be read or written through the API.

***

### Rationale

In Postgres, Row Level Security (RLS) policies control access to rows in a table based on the executing user. If a table has RLS enabled, but no policies exist, no data will be selectable via Supabase APIs.

### How to Resolve

If a table has RLS enabled with no policies, you can resolve the issue by creating a policy on the table

For example:

```sql
create policy select_own_posts on public.blog
    for select
    using ((select auth.uid()) = user_id);
```

### Example

Given the schema:

```sql
create table public.blog(
    id int primary key,
    user_id uuid not null,
    title text not null
);

alter table public.blog enable row level security;
```

No data will be selectable from the public.blog table over Supabase APIs.

To resolve the issue, create a policy on `public.blog` to grant some level of access

```sql
create policy select_own_posts on public.blog
    for select
    using ((select auth.uid()) = user_id);
```

Note that some users may enable RLS with no policies intentionally to restrict access over APIs. In those cases we recommend making that intent explicit with a rejection policy.

```sql
create policy none_shall_pass on public.blog
    for select
    using (false);
```

### 0009_duplicate_index
  
**Level:** WARN

**Summary:** Duplicate index found

**Ramification:** Identical indexes on the same table waste storage and slow down writes with no performance benefit.

***

### Rationale

Each index in a Postgres database adds overhead. This overhead occurs because the database must update each index whenever data in the indexed table are inserted, updated, or deleted. If two or more indexes are exact duplicates in their composition, the database incurs additional write overhead for no performance benefit.

### What is an Index?

An index in a database is similar to an index in a book. It allows the database to find data without scanning the entire table. An index is created on a column or a set of columns in a table. Queries that search or sort data based on these columns can find data more quickly and efficiently by referring the index instead of each row in the table.

### How to Resolve

When a table contains a duplicate index, drop instances of the index until only one remains.

For example, if the table `public.blog` has duplicate indexes `public.ix_id_1` and `public.ix_id_2` drop one using:

```sql
drop index public.ix_id_2;
```

### 0010_security_definer_view
  
**Level:** ERROR

**Summary:** View bypasses row-level security

**Ramification:** A view in the public schema runs with elevated privileges and ignores Row-Level Security, which could expose more data through the API than intended.

***

### Rationale

Postgres' default setting for views is SECURITY DEFINER which means they use the permissions of the view's creator, rather than the permissions of the querying user when executing the view's underlying query. That is an unintuitive default, chosen for backwards compatibility with older Postgres versions, which makes it easy to accidentally expose more data in views than was intended.

### Understanding SECURITY DEFINER and SECURITY INVOKER

In PostgreSQL, a view can be defined with either the SECURITY DEFINER or SECURITY INVOKER option.

- **SECURITY DEFINER**: This setting causes the view or function to run with the privileges of the user who created it, regardless of the user who invokes it. This can be useful for allowing a less-privileged user to perform specific tasks that require higher privileges but poses a significant security risk if not handled carefully. It is common for views to be created by highly privileged users with the ability to bypass row level security which further exacerbates the risk.

- **SECURITY INVOKER**: Conversely, with SECURITY INVOKER, the view or function executes with the privileges of the user calling it, respecting the principle of least privilege and significantly reducing the risk of unintentional privilege escalation.

### The Risk of SECURITY DEFINER Views in Public Schema

Creating a view in the public schema makes that view accessible via your project's APIs. If the view is created through Supabase Studio or using the Supabase CLI in SECURITY DEFINER mode, the view will bypass row level security rules and could expose more data publically over the project's APIs than the developer intended.

### How to Resolve

To mitigate the risk, always set `with (security_invoker=on)` when a view should respect RLS policies.

Given the view:

```sql
create view public.order_items
    as
select
    id,
    ...
from
    app.order_items;
```

Enable SECURITY INVOKER mode using:

```sql
create view public.order_items
    with (security_invoker=on)
    as
select
    id,
    ...
from
    app.order_items;
```

### 0011_function_search_path_mutable
  
**Level:** WARN

**Summary:** Unsecured function search path

**Ramification:** Without a fixed search path, this function could behave unpredictably or be exploited to reference unintended database objects.

***

### Rationale

In PostgreSQL, the `search_path` determines the order in which schemas are searched to find unqualified objects (like tables, functions, etc.). Setting `search_path` explicitly for a function is a best practice that ensures its behavior is consistent and secure, regardless of the executing user's default `search_path` settings. We recommend pinning functions' `search_path` to an empty string, `search_path = ''`, which forces all references within the function's body to be fully qualified. This helps prevent unexpected behavior due to changes in the `search_path` and mitigates potential security vulnerabilities.

### What is the Search Path?

The search path in PostgreSQL is a list of schema names that PostgreSQL checks when trying to resolve unqualified object names like `profiles`. In contrast, a fully qualified name includes the schema like `public.profiles`, and always resolves the same way, regardless of the user's `search_path`. By default, `search_path` includes the user's schema and the `public` schema. However, this can lead to unexpected behavior if different users have different `search_path` settings. Specifically, unqualified references will be resolved differently depending on who is executing the function.

### The Issue with Not Setting the Search Path in Functions

When a function does not have its `search_path` explicitly set, it inherits the `search_path` of the current session when it is invoked. This behavior can lead to several problems:

- **Inconsistency**: The function may behave differently depending on the user's `search_path` settings.
- **Security Risks**: Malicious users could potentially exploit the `search_path` to direct the function to use unexpected objects, such as tables or other functions, that the malicious user controls.

### How to Resolve

To ensure that your functions are secure and behave consistently, set the search path explicitly to an empty string within the function's definition.

Given a function like:

```sql
create function example_function()
  returns void
  language sql
as $$
  -- Your SQL code here
$$;
```

You can `create or replace` the function and add the `search_path` setting.

```sql
create or replace function example_function()
  returns void
  language sql
  set search_path = '' -- LOOK HERE
as $$
  -- Your SQL code here.
$$;
```

Remember that once you set the `search_path = ''` all references to tables/functions/views/etc in your function's body must be qualified with a schema name.

### 0012_auth_allow_anonymous_sign_ins
  
**Level:** INFO

**Summary:** Anonymous sign-ins enabled

**Ramification:** Anonymous users share the same database role as permanent users, so existing security policies may unintentionally grant them access.

***

### Rationale

Anonymous users use the same `authenticated` Postgres role as permanent users when accessing the database. If you have enabled anonymous sign-in for your project, existing RLS policies may allow unintended access to an anonymous user's JWT.

### Difference between an anonymous user and a permanent user

An anonymous user is a user created through Supabase Auth. It is just like a permanent user, except the user can't access their account if they sign out, clear browsing data or use another device. An anonymous user can be differentiated from a permanent user by checking if the `is_anonymous` claim is true. These claims are returned by the `auth.jwt()` function.

### How to Resolve

Determine if existing row level security (RLS) policies are meant to allow access to anonymous users. Affected policies include those that are associated to the `authenticated` or `public` roles, and members of those roles that inherit privileges.

For example, consider the policy:

```sql
create policy "allow_access_to_authenticated" on documents
as restrictive
to authenticated
using (true);
```

In this policy, any JWT that contains the authenticated role will be allowed to access the documents table. If we want to restrict access to permanent users only, we can modify the policy to:

```sql
create policy "allow_access_to_permanent_users" on documents
as restrictive
to authenticated
using ( (select (auth.jwt()->>'is_anonymous')::boolean) is false );
```

### 0013_rls_disabled_in_public
  
**Level:** ERROR

**Summary:** Table publicly accessible

**Ramification:** Anyone with your project URL can read, edit, and delete all data in this table because Row-Level Security is not enabled.

***

### Rationale

Tables in the `public` schema are accessible over Supabase APIs. If row level security (RLS) is not enabled on a `public` table, anyone with the project's URL can CREATE/READ/UPDATE/DELETE (CRUD) rows in the impacted table. Publicly exposing full CRUD to the internet is a critically unsafe configuration.

### How to Resolve

To enable RLS on a table execute:

```sql
alter table <schema>.<table> enable row level security;
```

Note that after enabling RLS you will not be able to use the `anon` role to read or write data to the table via Supabase APIs until you create [row level security policies](https://supabase.com/docs/guides/auth/row-level-security) to control access.

### Example

Given the schema:

```sql
create table public.blog(
    id int primary key,
    user_id uuid not null,
    title text not null
);
```

Any user with access to the project's URL will be able to perform CRUD operations on the `public.blog` table. To restrict access to users specified in row level security policies, enable RLS with:

```sql
alter table public.blog enable row level security;
```

If data APIs are not being used, another option is to remove the relevant schema, e.g. `public`, from the [Exposed schemas in API settings](https://supabase.com/dashboard/project/_/settings/api). That change secures your project by making all entities in the removed schema inaccessible over APIs.

### 0014_extension_in_public
  
**Level:** WARN

**Summary:** Extension installed in public schema

**Ramification:** The extension's internal functions and tables are visible in your API, cluttering it and potentially exposing unintended functionality.

***

### Rationale

Entities like tables and functions in the `public` schema are exposed through Supabase APIs by default. When extensions are installed in the `public` schema, the functions, tables, views, etc that they contain appear to be part of your project's API.

### How to Resolve

To relocate an extension from the `public` schema to another schema, execute:

```sql
alter extension <some_extension> set schema <some_schema>;
```

### Example

If the `ltree` extension was initially created in the `public` schema with

```sql
create extension ltree;
```

or

```sql
create extension ltree schema public;
```

You can relocate its components to the `extensions` schema by running

```sql
alter extension ltree set schema extensions;
```

### 0015_rls_references_user_metadata
  
**Level:** ERROR

**Summary:** Security policy relies on user-editable data

**Ramification:** A security policy references user\_metadata, which end users can freely modify, allowing them to bypass access controls.

***

### Rationale

Supabase Auth [user\_metadata](https://supabase.com/docs/guides/auth/managing-user-data#accessing-user-metadata) is used to set metadata about the user on sign up. It is designed to be manipulated by the user themselves. Because the user can change it (either directly or indirectly by sending a user update API call) to any value (there is no validation) this should not be used to base security policies.

### The Risk

Row-Level Security (RLS) policies are the mechanism for controlling access to data based on user roles or attributes. Supabase Auth [user\_metadata](https://supabase.com/docs/guides/auth/managing-user-data#accessing-user-metadata) allows metadata to be assigned to users, but that metadata can also be manipulated by the end user using client libraries. For example, in supabase-js:

```js
updateUser({ data: { is_admin: true } })
```

For that reason, it is not safe to rely on the contents of `user_metadata` in row level security policies.

An example insecure policy could be:

```sql
create policy bad_policy on public.foo
for select
  to authenticated
  using ( (( select auth.jwt() ) -> 'user_metadata' ->> 'is_admin' )::bool );
```

The policy is insecure because end users could execute `updateUser({ data: { is_admin: true } })` to bypass the security check.

### How to Resolve

There is no one-size-fits-all solution to replacing a RLS policy that references `user_metadata`.

If you're unsure how to refactor your policy to remove its dependance on `user_metadata` [open a ticket with support](https://supabase.com/dashboard/support/new) for assistance.

### 0016_materialized_view_in_api
  
**Level:** WARN

**Summary:** Materialized view exposed in API

**Ramification:** Materialized views can't be protected by Row-Level Security, so all their data is visible to every API user.

***

### Rationale

Materialized views in Postgres can present a security risk if they are accessible to API roles `anon` and `authenticated`. Unlike regular views, materialized views can not be configured to respect Row Level Security (RLS) policies of the underlying tables they are built upon, nor can they cannot be secured with RLS directly. Therefore, if materialized views are accessible over APIs, all rows are always visible, which may not be intended.

### The Risk of Materialized Views Accessible by Anon or Authenticated Roles

If materialized views are exposed in APIs and accessible by the `anon` or `authenticated` roles, API users bypass any Row-Level Security (RLS) policies implemented on the underlying tables. This can lead to unintended exposure of sensitive data as all users will be able to select all rows of data from the materialized views.

### How to Resolve

To mitigate the risk it is recommended to revoke `select` access from API roles `anon` and `authenticated`.

```sql
revoke select on public.some_mat_view from public, anon, authenticated;
```

Note that the `public` role is a role that sets default permissions for all other roles. If the `public` role allows access by default (as it does in the `public` schema) you must also revoke `select` accesss from it.

You can test if your permissions update worked sucessfully by running

```sql
select pg_catalog.has_table_privilege('anon', 'public.some_mat_view'::regclass::oid, 'select')
-- Should return: 'false'
```

Substituting in the appropriate role and view name.

### 0017_foreign_table_in_api
  
**Level:** WARN

**Summary:** Foreign table exposed in API

**Ramification:** Foreign tables can't be protected by Row-Level Security, so all their data is visible to every API user.

***

### Rationale

Foreign Tables in Postgres can present a security risk if they are accessible to API roles `anon` and `authenticated`. Unlike regular tables, foreign tables can not be configured to respect Row Level Security (RLS) policies. Therefore, if foreign tables are accessible over APIs, all rows are always visible, which may not be intended.

### How to Resolve

If the foreign table does not need to be accessible over the API you can resolve the issue by revoking `select` access from API roles `anon` and `authenticated`.

```sql
revoke select on public.some_foreign_table from public, anon, authenticated;
```

Note that the `public` role is a role that sets default permissions for all other roles. If the `public` role allows access by default (as it does in the `public` schema) you must also revoke `select` accesss from it.

You can test if your permissions update worked sucessfully by running

```sql
select pg_catalog.has_table_privilege('anon', 'public.some_foreign_table'::regclass::oid, 'select')
-- Should return: 'false'
```

Substituting in the appropriate role and view name.

If you do need to access data from the foreign table over APIs we recommend moving the foreign table out of the API's exposed schemas and then creating a function, accessible [over RPC](https://supabase.com/docs/reference/javascript/rpc), that implements security rules on top of the foreign table. For example, if we wanted to confirm that the Supabase Auth user matches the `author_id` column of the foreign table the function might look like:xt

```sql
-- Create a new schema
create schema private;

-- Move the foreign table out of the API's exposed schemas
alter foreign table public.some_foreign_table set schema private;

-- Make sure the API roles still have access to the FDW
grant select on public.some_foreign_table to anon, authenticated;

-- Create a function/RPC target with security rules
create or replace function fdw_wrapping_function()
  returns table (id integer, data text, author_id uuid)
  language sql
  set search_path = ''
as $$
  select
    id,
    data,
    author_id
  from
    private.some_foreign_table
  where
    author_id = (select auth.uid()); -- SECURITY RULE
$$;
```

### 0018_unsupported_reg_types
  
**Level:** WARN

**Summary:** Column type blocks Postgres upgrades

**Ramification:** A table uses a Postgres internal type that is not supported by pg\_upgrade, which will prevent you from upgrading to future Postgres versions.

***

### Rationale

Referencing `reg*` types that describe Postgres internals like types, namespaces, procedures, etc is a risk as these types are not supported by [pg\_upgrade](https://www.postgresql.org/docs/current/pgupgrade.html), the standard tool for upgrading between Postgres versions.

### How to Resolve

If a reference to an disallowed `reg*` type is needed:

```sql
create table public.bad_table(
  id int primary key,
  -- Not Allowed
  my_collation regcollation
);
```

Store the test representation of the object instead so that it will be compatible with upgrade.

```sql
create table public.good_table(
  id int primary key,
  -- Not Allowed
  my_collation_name text
);
```

### 0019_insecure_queue_exposed_in_api
  
**Level:** ERROR

**Summary:** Queue exposed without protection

**Ramification:** Anyone with your project URL can read, modify, and delete messages in this queue because it lacks access controls.

***

### Rationale

Queues exposed over Data APIs must be secured by Postgres permissions or row level security (RLS). Without this protection, anyone with a project's URL can manipulate queue data. That is a critically unsafe configuration.

### How to Resolve

To secure a queue, enable RLS on the queue's underlying table `pgmq.q_<queue_name>`:

```sql
alter table pgmq.q_<queue_name> enable row level security;
```

Note that after enabling RLS you will not be able to access data in the queue over APIs until you create [row level security policies](https://supabase.com/docs/guides/auth/row-level-security) to control access.

### Example

Given a queue named `foo` and underlying table `pgmq.q_foo`:

```sql
create table pgmq.q_foo(
    msg_id bigint generated always as identity,
    read_ct int default 0 not null,
    enqueued_at timestamp with timezone default now() not null,
    vt timestamp with time zone not null,
    message jsonb
);
```

If Data APIs are enabled, and `anon` or `authenticated` have permissions on the table, any user with access to the project's URL and public API key will be able to manipulate messages in that Queue. To restrict access to users specified in row level security policies, enable RLS with:

```sql
alter table pgmq.q_foo enable row level security;
```

If queues are not being accessed through data APIs, an alternative is to remove the `pgmq_public` schema from the [Exposed schemas in API settings](https://supabase.com/dashboard/project/_/settings/api). That change secures your project by making all queues inaccessible over APIs.

### 0020_table_bloat
  
**Level:** WARN

**Summary:** Excess table bloat detected

**Ramification:** The table has accumulated significant unused space from old row versions, which increases storage costs and slows down queries.

***

### Rationale

In PostgreSQL, bloat occurs when tables contain extra, unused space due to deleted or updated rows. PostgreSQL doesn’t immediately reclaim the space used by these rows but instead marks it as reusable for future operations. Over time, if this space isn’t efficiently reused, the table becomes bloated, meaning it takes up more storage than necessary, slowing down database performance and increasing I/O overhead.

### What Causes Bloat?

Updates: When a row is updated, PostgreSQL creates a new version of the row, leaving the old version in the table as "dead space."
Deletes: Deleting rows leaves behind empty space that’s not automatically removed.
Table Design: Frequent changes to large tables with many columns or high variability in row size can lead to fragmentation.

PostgreSQL’s autovacuum process is designed to clean up these "dead tuples" and prevent excessive bloat. It works in the background to reclaim space and make it available for future use. However, autovacuum may not always keep up with bloat in certain situations, such as:

- Large or high-traffic tables with frequent updates/deletes.
- Inefficient vacuum settings in your database configuration.
- Tables requiring a more aggressive maintenance operation (e.g., vacuum full or cluster).

Excessive table bloat increases the size of your database on disk and slows down operations like reads, writes, and sequential scans. Left unresolved, it can cause noticeable degradation in application performance and higher costs for storage and computing resources.

If this lint repeatedly flags the same table for high bloat, it indicates an issue with your database's maintenance processes. Possible causes include:

- Autovacuum not running frequently enough.
- Maintenance operations being blocked or ineffective.
- Application-level behavior (e.g., frequent updates or deletes) creating excessive dead tuples.

In such cases, you should reach out to Supabase Support for assistance in diagnosing and resolving the underlying problem. They can help you tune autovacuum settings, optimize table design, or recommend appropriate maintenance strategies.

### How to Resolve

Vacuuming a table repacks it to remove fragmentation. However, be cautious when running `vacuum full` on large tables (>300k rows) in a production environment because vacuum full locks the table, blocking all other accesses until it finishes.
For large and heavily used tables, this can lead to significant downtime or performance stalls.

For very large tables a less intrusive alternative might be using [pg\_repack](https://supabase.com/docs/guides/database/extensions/pg_repack).

Example of running vacuum full:

```sql
vacuum full public.some_table;
```

Important Note:

If vacuum full is not an option (due to locking concerns), consider plain vacuum (with or without analyze) or tools like [pg\_repack](https://supabase.com/docs/guides/database/extensions/pg_repack).
Always test in a staging environment if you are unsure about the impact on live traffic.
You can verify your maintenance steps by checking the size of the table before and after vacuuming:

```sql
-- size before
select pg_size_pretty(pg_table_size('public.some_table'));

-- run vacuum or other maintenance

-- size after
select pg_size_pretty(pg_table_size('public.some_table'));
```

If your maintenance was successful, you should see a noticeable decrease in table size and improved query performance.

### 0021_fkey_to_auth_unique
  
**Level:** ERROR

**Summary:** Foreign key blocks Auth upgrades

**Ramification:** A foreign key references a constraint in the auth schema that is scheduled for removal, which will prevent future Auth updates and security patches.

***

### Rationale

Supabase Auth does not support user-defined foreign keys that reference non-primary key unique constraints in the `auth` schema. These unique constraints are scheduled for removal, and any foreign keys referencing them will block Supabase Auth's database migrations from completing successfully. If Supabase Auth is unable to upgrade, it prevents the rollout of new features and critical security updates.

### How to Resolve

To ensure successful migrations and continued updates:

1. Drop Foreign Keys: Remove any foreign key constraints that reference unique constraints in the `auth` schema.

```sql
alter table public.some_tablee
drop constraint some_foreign_key;
```

2. Reference Primary Keys Instead: If applicable, replace references to unique constraints with references to the corresponding table's primary key.

### 0022_extension_versions_outdated
  
**Level:** WARN

**Summary:** Extension out of date

**Ramification:** An installed extension is running an older version that may be missing security patches and is not covered by the Supabase SLA.

***

### Rationale

Keeping PostgreSQL extensions up to date is important for maintaining database security and stability. Extension developers regularly release updates that include:

- **Security patches** that fix known vulnerabilities
- **Bug fixes** that resolve functional issues
- **Performance improvements** that optimize database operations

Using outdated extension versions can expose your database to security risks and prevent you from benefiting from the latest improvements. Additionally, Supabase's Service Level Agreement (SLA) for issues resulting from extensions only applies to the default (recommended) version of each extension.

### Why Keep Extensions Updated?

**Security**: Outdated extensions may contain known security vulnerabilities that have been patched in newer versions. These vulnerabilities could potentially be exploited by malicious actors.

**Support**: Supabase provides support and SLA coverage only for the default (recommended) versions of extensions. Running outdated versions may result in limited support options if issues arise.

**Consistency**: Maintaining consistent extension versions across all projects helps ensure predictable behavior and reduces compatibility issues.

**Performance**: Newer versions frequently include performance optimizations and improvements that can benefit your database operations.

### Warning

- Always test extension updates in a development environment before applying them to production
- Some extension updates may include breaking changes, so review the extension's changelog before updating
- Back up your database before performing extension updates

### How to Resolve

To update an extension to its default (recommended) version, use the `ALTER EXTENSION` command:

```sql
ALTER EXTENSION extension_name UPDATE;
```

For example, to update the `uuid-ossp` extension:

First, check the version of the extension that is installed:

```sql
-- Check current extension version
SELECT name, installed_version, default_version
FROM pg_catalog.pg_available_extensions
WHERE name = 'uuid-ossp';
```

This could return:

```
    name     | installed_version | default_version
-------------+-------------------+-----------------
 uuid-ossp   | 1.0               | 1.1
```

To update to the installed version:

```sql
ALTER EXTENSION "uuid-ossp" UPDATE;
```

After updating, verify the installed version matches default:

```sql
SELECT name, installed_version, default_version
FROM pg_catalog.pg_available_extensions
WHERE name = 'uuid-ossp';
```

Should now return:

```
    name     | installed_version | default_version
-------------+-------------------+-----------------
 uuid-ossp   | 1.1               | 1.1
```

### 0023_sensitive_columns_exposed
  
**Level:** ERROR

**Summary:** Sensitive data publicly accessible

**Ramification:** A table with columns that likely contain sensitive data (like passwords or personal identifiers) is accessible through the API without any access restrictions.

***

### Rationale

Tables exposed via the Supabase Data APIs that contain columns with potentially sensitive data (such as passwords, SSNs, credit card numbers, API keys, or other PII) pose a significant security risk when Row Level Security (RLS) is not enabled. Without RLS, anyone with access to the project's URL and an anonymous or authenticated role can read all data in these tables, potentially exposing sensitive user information.

This lint identifies tables that:

1. Are accessible via the Data API (in exposed schemas like `public`)
2. Have RLS disabled
3. Contain columns with names matching common sensitive data patterns

### Sensitive Column Patterns Detected

The following categories of sensitive data are detected:

**Authentication & Credentials:**

- `password`, `passwd`, `pwd`, `secret`, `api_key`, `token`, `jwt`, `access_token`, `refresh_token`, `session_token`, `auth_code`, `otp`, `2fa_secret`

**Personal Identifiers:**

- `ssn`, `social_security`, `driver_license`, `passport_number`, `national_id`, `tax_id`

**Financial Information:**

- `credit_card`, `card_number`, `cvv`, `bank_account`, `account_number`, `routing_number`, `iban`, `swift_code`

**Health & Medical:**

- `health_record`, `medical_record`, `patient_id`, `insurance_number`, `diagnosis`

**Device & Digital Identifiers:**

- `mac_address`, `imei`, `device_uuid`, `ssh_key`, `pgp_key`, `certificate`

**Biometric Data:**

- `fingerprint`, `biometric`, `facial_recognition`

### How to Resolve

**Option 1: Enable Row Level Security (Recommended)**

Enable RLS on the table and create appropriate policies:

```sql
-- Enable RLS
alter table <schema>.<table> enable row level security;

-- Create a policy that restricts access
create policy "Users can only view their own data"
on <schema>.<table>
for select
using (auth.uid() = user_id);
```

**Option 2: Remove sensitive columns from the table**

If the data doesn't need to be stored, remove the sensitive columns:

```sql
alter table <schema>.<table> drop column <sensitive_column>;
```

**Option 3: Move sensitive data to a separate, protected table**

Store sensitive data in a separate table with proper RLS:

```sql
-- Create a protected table for sensitive data
create table <schema>.<table>_secure (
    id uuid primary key references <schema>.<table>(id),
    <sensitive_column> text
);

-- Enable RLS on the secure table
alter table <schema>.<table>_secure enable row level security;

-- Remove from the exposed table
alter table <schema>.<table> drop column <sensitive_column>;
```

**Option 4: Remove the schema from API exposure**

If the table should not be accessible via APIs at all, remove the schema from the [Exposed schemas in API settings](https://supabase.com/dashboard/project/_/settings/api).

### Example

Given the schema:

```sql
create table public.users(
    id uuid primary key,
    email text not null,
    password_hash text not null,
    ssn text,
    created_at timestamptz default now()
);

grant select on public.users to anon, authenticated;
```

This table is flagged because it contains sensitive columns (`password_hash`, `ssn`) and is accessible via the API without RLS protection. Any user with the project URL can query this table and retrieve all user passwords and social security numbers.

To fix, enable RLS and create appropriate policies:

```sql
alter table public.users enable row level security;

-- Allow users to only read their own data
create policy "Users can view own profile"
on public.users
for select
using (auth.uid() = id);
```

### 0024_permissive_rls_policy
  
**Level:** WARN

**Summary:** Security policy allows unrestricted access

**Ramification:** An RLS policy uses an always-true condition like `USING (true)`, which defeats the purpose of having Row-Level Security enabled.

***

### Rationale

Row Level Security (RLS) policies that use always-true expressions like `USING (true)` or `WITH CHECK (true)` effectively bypass the security that RLS is meant to provide. While RLS appears to be enabled on the table, these permissive policies allow unrestricted access to all rows for the specified roles.

This is a common misconfiguration that occurs when:

- Developers create placeholder policies during development and forget to update them
- Policies are incorrectly configured with the assumption that other policies will restrict access
- Copy-paste errors from documentation examples

### Patterns Detected

The lint identifies policies with these always-true patterns:

**USING Clause (controls which rows can be read):**

- `USING (true)` - explicitly allows reading all rows
- `USING (1=1)` - tautology that always evaluates to true
- `USING ('a'='a')` - string comparison tautology
- Missing USING clause on permissive SELECT policies

**WITH CHECK Clause (controls which rows can be written):**

- `WITH CHECK (true)` - allows writing any row
- `WITH CHECK (1=1)` - tautology that always evaluates to true
- Missing WITH CHECK clause on permissive INSERT/UPDATE policies

### Security Impact

When a permissive policy with `USING (true)` exists:

- **For SELECT**: Any user with the specified role can read ALL rows in the table
- **For INSERT**: Any user can insert ANY data into the table
- **For UPDATE**: Any user can modify ANY row in the table
- **For DELETE**: Any user can delete ANY row from the table

This is particularly dangerous when the policy applies to `anon` or `authenticated` roles, as it exposes data to all API users.

### How to Resolve

**Option 1: Add proper row-level conditions**

Replace the permissive policy with one that properly restricts access:

```sql
-- Instead of: USING (true)
-- Use a proper condition:
drop policy "allow_all" on public.posts;

create policy "users_own_posts"
on public.posts
for select
using (auth.uid() = user_id);
```

**Option 2: Use restrictive policies in combination**

If you need a base permissive policy, combine it with restrictive policies:

```sql
-- Base permissive policy
create policy "authenticated_access"
on public.posts
for select
to authenticated
using (true);

-- Restrictive policy to limit access
create policy "only_published"
on public.posts
as restrictive
for select
to authenticated
using (status = 'published' or auth.uid() = user_id);
```

**Option 3: Remove the policy if RLS is not needed**

If you don't need row-level restrictions, consider whether RLS should be disabled:

```sql
drop policy "allow_all" on public.posts;
alter table public.posts disable row level security;
```

Note: Only disable RLS if you're certain the table should be fully accessible.

### Example

Given this problematic configuration:

```sql
create table public.user_data(
    id uuid primary key,
    user_id uuid references auth.users(id),
    sensitive_info text
);

alter table public.user_data enable row level security;

-- This policy defeats the purpose of RLS!
create policy "allow_all_select"
on public.user_data
for select
to authenticated
using (true);
```

The `allow_all_select` policy allows ANY authenticated user to read ALL rows, including other users' sensitive information.

Fix by adding a proper condition:

```sql
drop policy "allow_all_select" on public.user_data;

create policy "users_own_data"
on public.user_data
for select
to authenticated
using (auth.uid() = user_id);
```

### False Positives

In some cases, `USING (true)` may be intentional:

- Public read-only tables (e.g., blog posts, product catalogs)
- Tables where access is controlled by other means (e.g., API layer)

If the policy is intentional, you can document why in a comment or consider suppressing this lint for specific tables.

### 0025_public_bucket_allows_listing
  
**Level:** WARN

**Summary:** Detects public storage buckets whose broad `SELECT` policies on `storage.objects` make their contents listable.

**Ramification:** Clients can enumerate the files in a public bucket, which often exposes more information than intended even though public object URLs would still work without the policy.

***

### Rationale

Supabase public buckets are already readable by URL. They do not need a `SELECT` policy on `storage.objects` for clients to fetch known object paths.

The footgun appears when a public bucket also has one or more broad permissive `SELECT` or `ALL` policies on `storage.objects`, for example `bucket_id = 'avatars'` or `true`. That combination allows API clients to list objects in the bucket through Storage APIs, which is often broader access than the project intended.

This lint is intentionally narrow. It does not warn on all public buckets. It only warns when a public bucket also has a matching `SELECT` policy that makes its contents enumerable.

### How to Resolve

**Option 1: Remove the unnecessary `SELECT` policy**

```sql
drop policy if exists "Public bucket listing" on storage.objects;
```

Object URLs for the public bucket will continue to work after removing the `SELECT` policy.

**Option 2: Make the bucket private if listing is actually required**

```sql
update storage.buckets
set public = false
where id = 'avatars';
```

Use private bucket access patterns if the project truly needs authenticated listing behavior.

### Example

Given this problematic configuration:

```sql
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

create policy "Public bucket listing"
on storage.objects
for select
to authenticated
using (bucket_id = 'avatars');
```

Fix:

```sql
drop policy if exists "Public bucket listing" on storage.objects;
```

### False Positives

This lint may fire when broad bucket listing is intentional for a public bucket. In that case, keep the policy and handle the warning as an accepted risk.

The lint is also intentionally conservative. It detects broad permissive policies for the `public`, `anon`, or `authenticated` roles with direct bucket-only `bucket_id = '<bucket id>'` matches or always-true policy expressions such as `true` or `1 = 1`. It does not warn on restrictive-only policies or policies that add additional object, path, or user constraints such as `bucket_id = 'avatars' and owner = auth.uid()`.

### 0026_pg_graphql_anon_table_exposed
  
**Level:** WARN

**Summary:** This object is visible in your GraphQL schema to anyone using the public anon key.

**Ramification:** If `anon` can `SELECT` any column on a table, view, materialized view, or foreign table, `pg_graphql` exposes that object's name, columns, relationships, and generated mutations through `/graphql/v1` introspection. RLS does not change that because it protects rows, not schema visibility. If this object should not be discoverable before sign-in, revoke `SELECT` from `anon` or disable `pg_graphql` if you do not use GraphQL.

> **See also: lint [0027\_pg\_graphql\_authenticated\_table\_exposed](?lint=0027_pg_graphql_authenticated_table_exposed).** In default Supabase projects `anon` and `authenticated` start with identical default-privilege grants, so revoking from `anon` alone often leaves the same introspection response served to any signed-up user. Address findings from both lints together.

***

### If you are not using `pg_graphql`, disable it

The simplest mitigation — and the right one if your app does not use the GraphQL endpoint — is to drop the extension. With `pg_graphql` not installed, this lint and 0027 stop firing entirely and the `/graphql/v1` endpoint returns nothing exposing your schema.

In the Supabase SQL Editor:

```sql
drop extension pg_graphql;
```

Or in the dashboard: **Database → Extensions**, search for `pg_graphql`, and toggle it off.

If your project does use `pg_graphql`, leave it installed and follow the remediation below.

***

### Rationale

`pg_graphql` introspection is by design: the GraphQL schema reflects the Postgres privileges of the calling role. The Supabase anon key maps to the `anon` Postgres role, so any relation `anon` can `SELECT` is visible in the GraphQL introspection response from `/graphql/v1`, regardless of RLS. Visibility through introspection is governed entirely by `GRANT` / `REVOKE`. This lint flags the objects currently discoverable through the public anon key so you can confirm each one is intentionally public.

The relkinds covered match `pg_graphql`'s own filter (`load_sql_context.sql:395-400`): regular tables (`r`), views (`v`), materialized views (`m`), and foreign tables (`f`). Partitioned table roots (`relkind='p'`) are not covered because `pg_graphql` does not expose them via introspection; their leaf partitions (`relkind='r'`) are still picked up individually.

You can confirm what is visible using only the public anon key:

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/graphql/v1 \
  -H 'apiKey: <ANON_KEY>' \
  -H 'Authorization: Bearer <ANON_KEY>' \
  -H 'Content-Type: application/json' \
  --data-raw '{"query": "{ __schema { types { name fields { name } } } }"}'
```

The response includes one entry per exposed table (e.g. `internal_api_keysCollection`, `ordersCollection`), the full column list for each table, and `Mutation` entries like `insertIntointernal_api_keysCollection`, `updateinternal_api_keysCollection`, `deleteFrominternal_api_keysCollection`.

### How to Resolve

The fix is always a standard Postgres `GRANT` / `REVOKE` run in the SQL Editor. No support ticket, no config file, no extension toggle.

**Important:** revoking from `anon` does not, on its own, hide the relation from `pg_graphql` introspection — `authenticated` is checked separately by lint 0027 and typically has the same default grants. Address both lints' findings together (see "Hide all tables from both roles" in 0027).

**Option 1: Hide every table from `anon` (most thorough)**

```sql
revoke all on all tables in schema public from anon;
```

Then prevent future tables from auto-exposing:

```sql
alter default privileges in schema public
  revoke select on tables from anon;
```

Re-grant access to `authenticated` for tables your app needs after login:

```sql
grant select on public.profiles to authenticated;
grant select on public.products to authenticated;
grant select, insert on public.orders to authenticated;
-- Sensitive tables receive no grant from anon and remain invisible to
-- the public introspection endpoint. Make sure to also handle 0027 for
-- the authenticated-side exposure.
```

**Option 2: Hide a specific sensitive table or view only**

```sql
revoke all on public.internal_api_keys from anon;
```

`anon` continues to see other objects, but `internal_api_keys` is no longer visible in the unauthenticated introspection response. Use the same `revoke all on <object>` pattern for views, materialized views, and foreign tables.

**Option 3: Block the entire GraphQL endpoint for `anon`**

```sql
revoke all on function graphql.resolve from anon;
```

This rejects every unauthenticated GraphQL request, not just introspection. Use only if you do not need GraphQL for unauthenticated users at all. The table-level revokes above are usually preferable because they keep the endpoint alive while returning an empty schema.

### Example

Given a table that anyone can read via the anon key:

```sql
create table public.internal_api_keys(
    id uuid primary key,
    service text,
    key_hash text,
    permissions jsonb,
    last_used timestamptz,
    created_by uuid
);

alter table public.internal_api_keys enable row level security;
-- No policies, but anon still inherits the default SELECT grant.
```

Even though RLS is enabled and no rows are returned, every column name above is now visible through `/graphql/v1` introspection.

Fix:

```sql
revoke all on public.internal_api_keys from anon;
```

Re-running the introspection query with the anon key no longer returns this table. (The same call repeated with a signed-up user's JWT still returns it until you also revoke from `authenticated` — see 0027.)

### Verifying the Fix

After applying the revoke, the introspection query's `Query` type should contain only `{"name": "node"}` (when every table has been hidden) or omit the specific table you revoked. Authenticated users with a valid JWT continue to see only the tables explicitly granted to the `authenticated` role:

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/graphql/v1 \
  -H 'apiKey: <ANON_KEY>' \
  -H 'Authorization: Bearer <USER_JWT>' \
  -H 'Content-Type: application/json' \
  --data-raw '{"query": "{ __schema { types { name fields { name } } } }"}'
```

### Quick Reference

| Goal                             | SQL                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Hide one table from `anon`       | `revoke all on public.secret_table from anon;`                                 |
| Hide all tables from `anon`      | `revoke all on all tables in schema public from anon;`                         |
| Prevent future auto-grants       | `alter default privileges in schema public revoke select on tables from anon;` |
| Kill GraphQL endpoint for `anon` | `revoke all on function graphql.resolve from anon;`                            |
| Grant a table to `authenticated` | `grant select on public.my_table to authenticated;`                            |

### False Positives

This lint flags every `anon`-readable relation when `pg_graphql` is installed. Some of these are intentional — public catalog tables (blog posts, product listings, public FAQs) are meant to be readable without authentication, and exposing their column names is acceptable.

If introspection visibility is intentional for a relation, the lint can be safely ignored for that object. The lint is informational rather than a hard misconfiguration: it surfaces what your project makes visible so you can decide which relations are actually meant to be public.

### 0027_pg_graphql_authenticated_table_exposed
  
**Level:** WARN

**Summary:** This object is visible in your GraphQL schema to signed-in users.

**Ramification:** If `authenticated` can `SELECT` any column on a table, view, materialized view, or foreign table, `pg_graphql` exposes that object's name, columns, relationships, and generated mutations through `/graphql/v1` introspection to signed-in users. RLS does not change that because it protects rows, not schema visibility. In projects with open signup, that can mean any throwaway account, so revoke `SELECT` from `authenticated` for objects that every account holder should not discover.

> **See also: lint [0026\_pg\_graphql\_anon\_table\_exposed](?lint=0026_pg_graphql_anon_table_exposed).** The two checks are paired — revoking from one role alone usually leaves the other side of the introspection response unchanged. Address findings from both lints together.

***

### If you are not using `pg_graphql`, disable it

The simplest mitigation — and the right one if your app does not use the GraphQL endpoint — is to drop the extension. With `pg_graphql` not installed, this lint and 0026 stop firing entirely and the `/graphql/v1` endpoint returns nothing exposing your schema.

In the Supabase SQL Editor:

```sql
drop extension pg_graphql;
```

Or in the dashboard: **Database → Extensions**, search for `pg_graphql`, and toggle it off.

If your project does use `pg_graphql`, leave it installed and follow the remediation below.

***

### Rationale

`pg_graphql` introspection runs under whichever role the caller's JWT claims, not specifically `anon`. A request with the public anon key runs as `anon`; a request with a real user JWT runs as `authenticated`. The introspection response reflects the privileges of that role.

That makes the documented remediation for 0026 — "revoke from `anon`, grant to `authenticated`" — incomplete on its own. Because the two roles share identical default-privilege grants, an operator who follows the 0026 doc verbatim can clear that lint and still see the `/graphql/v1` introspection response served to any signed-up user remain byte-for-byte unchanged. Lint 0027 catches that case: it fires whenever `authenticated` has `SELECT` on a relation that `pg_graphql` would expose.

The relkinds covered match `pg_graphql`'s own filter (`load_sql_context.sql:395-400`): regular tables (`r`), views (`v`), materialized views (`m`), and foreign tables (`f`). Partitioned table roots (`relkind='p'`) are not covered because `pg_graphql` does not expose them via introspection; their leaf partitions (`relkind='r'`) are still picked up individually.

You can confirm what is visible to authenticated users by repeating the introspection request with a real user JWT in the `Authorization` header:

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/graphql/v1 \
  -H 'apiKey: <ANON_KEY>' \
  -H 'Authorization: Bearer <USER_JWT>' \
  -H 'Content-Type: application/json' \
  --data-raw '{"query": "{ __schema { types { name fields { name } } } }"}'
```

### How to Resolve

The fix is a standard Postgres `GRANT` / `REVOKE`. Unlike 0026, you cannot simply revoke from `authenticated` — your app probably needs `authenticated` to read most tables. The right move is per-relation: keep grants on the tables signed-up users genuinely need, and revoke from the rest.

**Option 1: Audit and revoke per-relation (recommended)**

```sql
-- A relation that should never be visible to signed-up users:
revoke all on public.internal_api_keys from authenticated, anon, public;

-- A relation that signed-up users do need; introspection visibility is
-- intentional and the lint can be ignored for this object:
grant select on public.profiles to authenticated;
```

Walk the 0027 findings list; for each relation, decide whether `authenticated` visibility is intentional. If it is, suppress the finding for that object. If it is not, revoke.

**Option 2: Hide every table from both roles, re-grant only what is needed**

```sql
revoke all on all tables in schema public from anon, authenticated;

alter default privileges in schema public
  revoke select on tables from anon, authenticated;

-- Re-grant per-relation only where genuinely required:
grant select on public.profiles to authenticated;
grant select on public.products to authenticated;
grant select, insert on public.orders to authenticated;
```

This pairs cleanly with 0026's Option 1 and is the cleanest end state for projects that want introspection to expose only an explicit allowlist.

**Option 3: Block the entire GraphQL endpoint for both roles**

```sql
revoke all on function graphql.resolve from anon, authenticated;
```

This rejects every GraphQL request, not just introspection. Use only if you do not use the `/graphql/v1` endpoint at all. The table-level revokes above are usually preferable because they keep the endpoint alive while returning an empty schema.

### Example

Given a table that signed-up users should not be able to see in introspection:

```sql
create table public.internal_api_keys(
    id uuid primary key,
    service text,
    key_hash text,
    permissions jsonb
);

alter table public.internal_api_keys enable row level security;
-- No policies, but `authenticated` still inherits the default SELECT
-- grant — every signed-up user sees the column list via introspection.
```

Lint 0027 fires for `public.internal_api_keys`. Fix:

```sql
revoke all on public.internal_api_keys from authenticated, anon, public;
```

The introspection query no longer returns this table for any role. (If 0026 was also firing for this table, the same revoke clears it.)

### Verifying the Fix

After applying the revoke, repeat the introspection query with a real user JWT and confirm the relation is no longer in the response:

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/graphql/v1 \
  -H 'apiKey: <ANON_KEY>' \
  -H 'Authorization: Bearer <USER_JWT>' \
  -H 'Content-Type: application/json' \
  --data-raw '{"query": "{ __schema { types { name fields { name } } } }"}'
```

### Quick Reference

| Goal                                 | SQL                                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| Hide one table from `authenticated`  | `revoke all on public.secret_table from authenticated, public;`                         |
| Hide all tables from `authenticated` | `revoke all on all tables in schema public from authenticated;`                         |
| Prevent future auto-grants           | `alter default privileges in schema public revoke select on tables from authenticated;` |
| Hide one table from both roles       | `revoke all on public.secret_table from anon, authenticated, public;`                   |
| Kill GraphQL endpoint for both roles | `revoke all on function graphql.resolve from anon, authenticated;`                      |

### False Positives

This lint flags every `authenticated`-readable relation when `pg_graphql` is installed. The majority of findings are usually intentional — most app-facing tables genuinely need to be readable by signed-up users, and exposing their column names through introspection is acceptable.

If introspection visibility is intentional for a relation, the lint can be safely ignored for that object. The lint is informational: it surfaces what your project makes visible to authenticated users so you can decide which relations are actually meant to be discoverable by every account holder, including throwaway accounts created via open signup.

### 0028_anon_security_definer_function_executable
  
**Level:** WARN

**Summary:** This `SECURITY DEFINER` function is callable without signing in.

**Ramification:** Because this function is `SECURITY DEFINER`, it runs with the privileges of its owner rather than the caller. If `anon` has `EXECUTE`, anyone with the public anon key can call it through `POST /rest/v1/rpc/<name>` and potentially read or modify data that RLS would normally block. If that is not intentional, revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema.

> **See also: lint [0029\_authenticated\_security\_definer\_function\_executable](?lint=0029_authenticated_security_definer_function_executable).** In default Supabase projects `anon` and `authenticated` start with identical default-privilege grants (and the Postgres default for new functions is `EXECUTE` to `PUBLIC`), so revoking from `anon` alone usually leaves the same function callable by every signed-up user. Address findings from both lints together. The `pg_graphql_*` lints (0026/0027) cover the parallel risk for tables/views.

***

### If you are not using `pg_graphql`, disable it

Disabling `pg_graphql` closes the `/graphql/v1` Query/Mutation surface, which is one of two ways this function is reachable. **The function is still callable via PostgREST `/rest/v1/rpc/<name>`** — so this lint will continue to fire after the drop, and the remediation below is still required. Disable `pg_graphql` only if your app does not use the GraphQL endpoint; do not treat it as a fix for this lint.

In the Supabase SQL Editor:

```sql
drop extension pg_graphql;
```

Or in the dashboard: **Database → Extensions**, search for `pg_graphql`, and toggle it off.

***

### Rationale

Two facts combine to make this a high-impact misconfiguration:

1. **`SECURITY DEFINER` bypasses RLS.** When a function is declared `SECURITY DEFINER`, it executes with the role of its owner, not the caller. The owner is usually a privileged role created by Supabase (for example `postgres` or `supabase_admin`) which can read every row in every RLS-protected table. So calling the function returns rows that the caller — `anon` — could never read with a direct `SELECT`.

2. **Postgres' default function ACL is `EXECUTE` to `PUBLIC`**, and Supabase additionally grants default privileges for new functions to `anon, authenticated, service_role`. So a function created in `public` is, by default, executable by `anon`. The author has to actively revoke to remove that grant.

The result: a developer writes a helper function intending it to be called from an admin script, doesn't think about the API surface, and the function becomes a public exfiltration endpoint. PostgREST exposes it at `/rest/v1/rpc/<name>` automatically; pg\_graphql exposes it as a query or mutation field if the return type is supported. The function does not need to appear anywhere in the documented API for the call to work — `/rest/v1/rpc` accepts any function name the role has `EXECUTE` on.

This lint deliberately ignores `SECURITY INVOKER` functions: those run as the caller, so RLS still applies to any tables they touch. They can still be problematic if the *underlying* tables are unprotected, but that risk is covered by lints `0008_rls_enabled_no_policy` and `0013_rls_disabled_in_public` on the data, not by this lint on the function.

### How to Resolve

The fix is per-function. For each finding, decide whether `anon` should genuinely be able to invoke the operation, then take one of three paths:

**Option 1: Revoke `EXECUTE` (most common)**

```sql
revoke execute on function public.my_priv_op(int, text) from anon, public;
```

You almost always want to revoke from `PUBLIC` as well, because Postgres' default-grant lives there. Repeat for `authenticated` if that lint also fires (or do both at once: see lint 0029).

**Option 2: Keep the function exposed but switch to `SECURITY INVOKER`**

```sql
alter function public.my_priv_op(int, text) security invoker;
```

The function still runs, but it now executes as the caller. RLS on the underlying tables takes effect, and the operator can model access through policies instead of through an unrestricted `EXECUTE`. Suitable when the function does not actually need to bypass RLS — it was just declared `SECURITY DEFINER` by habit or default.

**Option 3: Keep both `SECURITY DEFINER` and the `EXECUTE` grant — intentional**

Some functions are deliberately exposed: a "submit contact form" function that `INSERT`s into a table the caller cannot otherwise write to, a public RPC that returns the count of public posts, etc. If the lint flags one of these, the finding is intentional and can be suppressed for that object. The function should validate inputs and limit what it does — a `SECURITY DEFINER` exposed to `anon` is effectively a public API endpoint.

### Identifying the Owner

To see who the function actually runs as (this is what determines what RLS it bypasses):

```sql
select
    p.proname,
    pg_get_function_identity_arguments(p.oid) as args,
    pg_catalog.pg_get_userbyid(p.proowner) as owner,
    p.prosecdef as security_definer
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
order by p.proname;
```

If the owner is a high-privilege role, the function can read and write everything that role can.

### Quick Reference

| Goal                                       | SQL                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Hide one function from `anon`              | `revoke execute on function public.f(int) from anon, public;`                              |
| Hide all functions in a schema from `anon` | `revoke execute on all functions in schema public from anon;`                              |
| Prevent future auto-grants of EXECUTE      | `alter default privileges in schema public revoke execute on functions from anon, public;` |
| Switch a function to caller's privileges   | `alter function public.f(int) security invoker;`                                           |

### False Positives

This lint flags every `SECURITY DEFINER` function in a user schema with `EXECUTE` granted to `anon`. There are two situations where the finding is not a real risk:

- **The function is intentionally a public API endpoint.** A "rate-limited contact form" or "anonymous vote" function is meant to be `SECURITY DEFINER` (so it can write to a table `anon` cannot otherwise write to) and meant to be executable by `anon`. Confirm the function validates input and limits what it does, then suppress.
- **The owner is a low-privilege role.** If the function's owner has no more privileges than the caller, `SECURITY DEFINER` does not actually escalate. This is rare because Supabase functions are typically owned by a privileged role, but worth checking the owner column shown above.

In every other case the lint is reporting a real privilege escalation: a caller with the public anon key can run code that reads or writes data they otherwise could not.

### 0029_authenticated_security_definer_function_executable
  
**Level:** WARN

**Summary:** This `SECURITY DEFINER` function is callable by signed-in users.

**Ramification:** Because this function is `SECURITY DEFINER`, it runs with the privileges of its owner rather than the caller. If `authenticated` has `EXECUTE`, any signed-in user can call it through `POST /rest/v1/rpc/<name>` and potentially read or modify data that RLS would normally block. In projects with open signup, that can mean any throwaway account, so revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if every account holder should not be able to call it.

> **See also: lint [0028\_anon\_security\_definer\_function\_executable](?lint=0028_anon_security_definer_function_executable).** The two checks are paired — revoking from one role alone usually leaves the other side callable. Address findings from both lints together. The `pg_graphql_*` lints (0026/0027) cover the parallel risk for tables/views.

***

### If you are not using `pg_graphql`, disable it

Disabling `pg_graphql` closes the `/graphql/v1` Query/Mutation surface, which is one of two ways this function is reachable. **The function is still callable via PostgREST `/rest/v1/rpc/<name>`** — so this lint will continue to fire after the drop, and the remediation below is still required. Disable `pg_graphql` only if your app does not use the GraphQL endpoint; do not treat it as a fix for this lint.

In the Supabase SQL Editor:

```sql
drop extension pg_graphql;
```

Or in the dashboard: **Database → Extensions**, search for `pg_graphql`, and toggle it off.

***

### Rationale

Two facts combine to make this a high-impact misconfiguration:

1. **`SECURITY DEFINER` bypasses RLS.** When a function is declared `SECURITY DEFINER`, it executes with the role of its owner, not the caller. The owner is usually a privileged role created by Supabase (for example `postgres` or `supabase_admin`) which can read every row in every RLS-protected table. So calling the function returns rows that the caller — `authenticated` — could never read with a direct `SELECT`.

2. **Postgres' default function ACL is `EXECUTE` to `PUBLIC`**, and Supabase additionally grants default privileges for new functions to `anon, authenticated, service_role`. So a function created in `public` is, by default, executable by `authenticated`. The author has to actively revoke to remove that grant.

The result: a developer writes a helper function intending it to be called from an admin script, doesn't think about the API surface, and the function becomes an exfiltration endpoint for any signed-up user. PostgREST exposes it at `/rest/v1/rpc/<name>` automatically; pg\_graphql exposes it as a query or mutation field if the return type is supported. The function does not need to appear anywhere in the documented API for the call to work — `/rest/v1/rpc` accepts any function name the role has `EXECUTE` on. Because Supabase signup is often open or email-auto-confirm, the audience for `authenticated` is effectively the public internet.

This lint deliberately ignores `SECURITY INVOKER` functions: those run as the caller, so RLS still applies to any tables they touch. They can still be problematic if the *underlying* tables are unprotected, but that risk is covered by lints `0008_rls_enabled_no_policy` and `0013_rls_disabled_in_public` on the data, not by this lint on the function.

### How to Resolve

The fix is per-function. For each finding, decide whether `authenticated` should genuinely be able to invoke the operation, then take one of three paths:

**Option 1: Revoke `EXECUTE` (most common)**

```sql
revoke execute on function public.my_priv_op(int, text) from authenticated, anon, public;
```

Revoke from `PUBLIC` as well, because Postgres' default-grant lives there. Revoking from `anon` at the same time also clears the matching 0028 finding.

**Option 2: Keep the function exposed but switch to `SECURITY INVOKER`**

```sql
alter function public.my_priv_op(int, text) security invoker;
```

The function still runs, but it now executes as the caller. RLS on the underlying tables takes effect, and the operator can model access through policies instead of through an unrestricted `EXECUTE`. Suitable when the function does not actually need to bypass RLS — it was just declared `SECURITY DEFINER` by habit or default.

**Option 3: Keep both `SECURITY DEFINER` and the `EXECUTE` grant — intentional**

Some functions are deliberately exposed to signed-up users: a "create my profile" function that initialises rows the user cannot otherwise insert, a "submit feedback" function that writes to a table they cannot otherwise write to, etc. If the lint flags one of these, the finding is intentional and can be suppressed for that object. The function should validate inputs and limit what it does — a `SECURITY DEFINER` exposed to `authenticated` is effectively a public API endpoint to anyone who can sign up.

### Identifying the Owner

To see who the function actually runs as (this is what determines what RLS it bypasses):

```sql
select
    p.proname,
    pg_get_function_identity_arguments(p.oid) as args,
    pg_catalog.pg_get_userbyid(p.proowner) as owner,
    p.prosecdef as security_definer
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
order by p.proname;
```

If the owner is a high-privilege role, the function can read and write everything that role can.

### Quick Reference

| Goal                                                | SQL                                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Hide one function from `authenticated`              | `revoke execute on function public.f(int) from authenticated, public;`                                    |
| Hide one function from both roles                   | `revoke execute on function public.f(int) from anon, authenticated, public;`                              |
| Hide all functions in a schema from `authenticated` | `revoke execute on all functions in schema public from authenticated;`                                    |
| Prevent future auto-grants of EXECUTE               | `alter default privileges in schema public revoke execute on functions from anon, authenticated, public;` |
| Switch a function to caller's privileges            | `alter function public.f(int) security invoker;`                                                          |

### False Positives

This lint flags every `SECURITY DEFINER` function in a user schema with `EXECUTE` granted to `authenticated`. There are two situations where the finding is not a real risk:

- **The function is intentionally a per-user privileged operation.** A "register my account profile" or "submit feedback as me" function may be `SECURITY DEFINER` (so it can write to a table `authenticated` cannot otherwise write to) and meant to be executable by every signed-up user. Confirm the function validates input and limits what it does, then suppress.
- **The owner is a low-privilege role.** If the function's owner has no more privileges than the caller, `SECURITY DEFINER` does not actually escalate. This is rare because Supabase functions are typically owned by a privileged role, but worth checking the owner column shown above.

In every other case the lint is reporting a real privilege escalation: any signed-up user — including throwaway accounts created via open signup — can run code that reads or writes data they otherwise could not.
