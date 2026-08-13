<!-- source: https://supabase.com/docs/guides/api/quickstart · mirrored 2026-08-13 from Supabase docs -->

# Build an API route in less than 2 minutes.

Create your first API route by creating a public `leaderboard` table.

This guide covers creating a REST route you can query using `cURL` or the browser by creating a database table called `leaderboard` to hold player scores. This creates a corresponding API route `/rest/v1/leaderboard` which can accept `GET`, `POST`, `PATCH`, and `DELETE` requests.

1. **Set up a Supabase project with a 'leaderboard' table**

[Create a new project](https://supabase.com/dashboard/_) in the Supabase Dashboard.

After your project is ready, create a table in your Supabase database. You can do this with either the [Table Editor](https://supabase.com/dashboard/project/_/editor) or the [SQL Editor](https://supabase.com/dashboard/project/_/sql).

**SQL**

```sql
-- Create a "leaderboard" table to store
-- player names and their scores.
create table leaderboard (
  id serial primary key,
  player text not null,
  score integer not null default 0,
  created_at timestamptz default now()
);
```

**Dashboard**

1. Go to the [**Table editor**](https://supabase.com/dashboard/project/_/editor) section in the Dashboard.
2. Click **New Table** and create a table with the name `leaderboard`.
3. Add a `player` column of type `text` and a `score` column of type `int4`.
4. Click **Save**.

2. **Enable Data API access to Anon Role**

Expose the `leaderboard` table through the Data API so it can be queried over HTTP. A leaderboard is meant to be public, so anonymous clients only need read access.

For more control over which tables and functions are exposed, read the [Grant access explicitly guide](https://supabase.com/docs/guides/api/securing-your-api#grant-access-explicitly).

**SQL**

```sql
-- Allow read-only access for anonymous clients
grant select on public.leaderboard to anon;
```

**Dashboard**

In the [**Integrations > Data API > Settings**](https://supabase.com/dashboard/project/_/integrations/data_api/settings) section of the Dashboard. Under **Exposed schemas**, make sure `public` is included, then under **Exposed tables**, toggle on access for the `leaderboard` table.

3. **Configure RLS**

Enable Row Level Security (RLS) for this table and create the policies that control who can read and write rows. For a leaderboard, anyone should be able to read scores. Only authenticated users should be able to submit or update them.

```sql
-- Turn on RLS
alter table "leaderboard"
enable row level security;

-- Anyone can read the leaderboard
create policy "Leaderboard is public"
  on leaderboard
  for select
  to anon, authenticated
  using (true);

-- Authenticated users can submit and update scores
create policy "Authenticated users can submit scores"
  on leaderboard
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update scores"
  on leaderboard
  for update
  to authenticated
  using (true)
  with check (true);
```

4. **Enable Data API access for authenticated and service roles**

With RLS setup, grant write access to the `authenticated` and `service_role` roles.

```sql
-- Grant write access only after RLS and policies are in place
grant select, insert, update, delete on public.leaderboard to authenticated;
grant select, insert, update, delete on public.leaderboard to service_role;
```

5. **Insert some dummy data**

Now add some scores to the table so the API has something to query.

```sql
insert into leaderboard (player, score)
values
  ('alice', 4200),
  ('bob', 3700),
  ('carol', 5100),
  ('dave', 2900);
```

6. **Fetch the data**

You can find your API URL and Keys in the [**Settings > API Settings**](https://supabase.com/dashboard/project/_/settings/api) section of the Dashboard. Query the `leaderboard` table by appending `/rest/v1/leaderboard` to the API URL.

Copy this block of code, substitute `<PROJECT_REF>` and `<PUBLISHABLE_KEY>`, then run it from a terminal.

```bash Terminal
curl 'https://<PROJECT_REF>.supabase.co/rest/v1/leaderboard?select=*&order=score.desc' \
-H "apikey: <PUBLISHABLE_KEY>"
```

## Bonus

There are several options for accessing your data:

### Browser

You can query the route in your browser, by appending the `publishable` key as a query parameter:

`https://<PROJECT_REF>.supabase.co/rest/v1/leaderboard?apikey=<PUBLISHABLE_KEY>`

### Curl

```sh
curl 'https://<PROJECT_REF>.supabase.co/rest/v1/leaderboard?select=*&order=score.desc' \
  -H "apikey: <PUBLISHABLE_KEY>" \
```

### Client libraries

We provide a number of [Client Libraries](https://github.com/supabase/supabase#client-libraries).

**JavaScript**

```js
const { data, error } = await supabase
  .from('leaderboard')
  .select()
  .order('score', { ascending: false })
```

**Dart**

```dart
final data = await supabase
  .from('leaderboard')
  .select('*')
  .order('score', ascending: false);
```

**Python**

```python
response = (
    supabase.table('leaderboard')
    .select("*")
    .order('score', desc=True)
    .execute()
)
```

**Swift**

```swift
let response = try await supabase
  .from("leaderboard")
  .select()
  .order("score", ascending: false)
```

**C#**

```c#
[Table("leaderboard")]
class Leaderboard : BaseModel
{
    [PrimaryKey("id", false)]
    public int Id { get; set; }

    [Column("player")]
    public string Player { get; set; }

    [Column("score")]
    public int Score { get; set; }
}

var result = await supabase
  .From<Leaderboard>()
  .Order(x => x.Score, Ordering.Descending)
  .Get();
```
