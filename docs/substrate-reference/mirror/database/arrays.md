<!-- source: https://supabase.com/docs/guides/database/arrays · mirrored 2026-08-13 from Supabase docs -->

# Working With Arrays

How to use arrays in Postgres and the Supabase API.

Postgres supports flexible [array types](https://www.postgresql.org/docs/12/arrays.html). These arrays are also supported in the Supabase Dashboard and in the JavaScript API.

## Create a table with an array column

Create a test table with a text array (an array of strings):

**Dashboard**

1. Go to the [Table editor](https://supabase.com/dashboard/project/_/editor) page in the Dashboard.
2. Click **New Table** and create a table with the name `arraytest`.
3. Click **Save**.
4. Click **New Column** and create a column with the name `textarray`, type `text`, and select **Define as array**.
5. Click **Save**.

**SQL**

```sql
create table arraytest (
  id integer not null,
  textarray text array
);
```

## Insert a record with an array value

**Dashboard**

1. Go to the [Table editor](https://supabase.com/dashboard/project/_/editor) page in the Dashboard.
2. Select the `arraytest` table.
3. Click **Insert row** and add `["Harry", "Larry", "Moe"]`.
4. Click **Save.**

**SQL**

```sql
INSERT INTO arraytest (id, textarray) VALUES (1, ARRAY['Harry', 'Larry', 'Moe']);
```

**JavaScript**

Insert a record from the JavaScript client:

```js
const { data, error } = await supabase
  .from('arraytest')
  .insert([{ id: 2, textarray: ['one', 'two', 'three', 'four'] }])
```

**Swift**

Insert a record from the Swift client:

```swift
struct ArrayTest: Encodable {
  let id: Int
  let textarray: [String]
}

try await supabase
  .from("arraytest")
  .insert(
    [
      ArrayTest(
        id: 2,
        textarray: ["one", "two", "three", "four"]
      )
    ]
  )
  .execute()
```

**Python**

Insert a record from the Python client:

```python
supabase.from_('arraytest').insert(
  [
    {
      id: 2,
      textarray: ["one", "two", "three", "four"]
    }
  ]
)
.execute()
```

**C#**

Insert a record from the C# client:

```c#
[Table("arraytest")]
class ArrayTest : BaseModel
{
    [PrimaryKey("id", false)]
    public int Id { get; set; }

    [Column("textarray")]
    public List<string> Textarray { get; set; }
}

await supabase
  .From<ArrayTest>()
  .Insert(new ArrayTest { Id = 2, Textarray = new List<string> { "one", "two", "three", "four" } });
```

## View the results

**Dashboard**

1. Go to the [Table editor](https://supabase.com/dashboard/project/_/editor) page in the Dashboard.
2. Select the `arraytest` table.

You should see:

```
| id  | textarray               |
| --- | ----------------------- |
| 1   | ["Harry","Larry","Moe"] |
```

**SQL**

```sql
select * from arraytest;
```

You should see:

```
| id  | textarray               |
| --- | ----------------------- |
| 1   | ["Harry","Larry","Moe"] |
```

## Query array data

Postgres uses 1-based indexing (e.g., `textarray[1]` is the first item in the array).

**SQL**

To select the first item from the array and get the total length of the array:

```js
SELECT textarray[1], array_length(textarray, 1) FROM arraytest;
```

returns:

```
| textarray | array_length |
| --------- | ------------ |
| Harry     | 3            |
```

**JavaScript**

This returns the entire array field:

```js
const { data, error } = await supabase.from('arraytest').select('textarray')
console.log(JSON.stringify(data, null, 2))
```

returns:

```json
[
  {
    "textarray": ["Harry", "Larry", "Moe"]
  }
]
```

**Swift**

This returns the entire array field:

```swift
struct Response: Decodable {
  let textarray: [String]
}

let response: [Response] = try await supabase.from("arraytest").select("textarray").execute().value
dump(response)
```

returns:

```
[
  Response(
    textarray: ["Harry", "Larry", "Moe"],
  )
]
```

**C#**

This returns the entire array field:

```c#
var result = await supabase
  .From<ArrayTest>()
  .Select(x => new object[] { x.Textarray })
  .Get();
```

## Resources

- [Supabase JS Client](https://github.com/supabase/supabase-js)
- [Supabase - Get started for free](https://supabase.com)
- [Postgres Arrays](https://www.postgresql.org/docs/15/arrays.html)
