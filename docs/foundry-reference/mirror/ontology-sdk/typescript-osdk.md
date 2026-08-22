<!-- source: https://palantir.com/docs/foundry/ontology-sdk/typescript-osdk/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# TypeScript OSDK

This page provides generic documentation for the TypeScript OSDK based on an example `Restaurant` object and its associated actions and queries. You can use Developer Console in the platform to [generate documentation based on your specific Ontology](/docs/foundry/developer-console/create-application/).

| Property                      | API name          | Type      |
| ----------------------------- | ----------------- | --------- |
| `Restaurant Id` (primary key) | `restaurantId`    | String    |
| `Restaurant Name` (title)     | `restaurantName`  | String    |
| `Address`                     | `address`         | String    |
| `Email`                       | `eMail`           | String    |
| `Number Of Reviews`           | `numberOfReviews` | Integer   |
| `Phone Number`                | `phoneNumber`     | String    |
| `Review Summary`              | `reviewSummary`   | String    |
| `Date Of Opening`             | `dateOfOpening`   | LocalDate |

## Load single `Restaurant`

Parameters:

* **primaryKey `string`:** The primary key of the `Restaurant` you want to fetch

Example query:

```typescript
const result: Osdk.Instance<Restaurant> = await client(Restaurant).fetchOne(
  "primaryKey",
);
```

Example API response:

```json
{
  "$primaryKey": "Restaurant Id",
  "$apiName": "Restaurant",
  "eMail": "Email",
  "restaurantId": "Restaurant Id",
  "address": "Address",
  "reviewSummary": "Review Summary",
  "phoneNumber": "Phone Number",
  "numberOfReviews": 123,
  "restaurantName": "Restaurant Name"
}
```

## Load a page of `Restaurants`

Load a page of objects. This automatically loads a single page of objects based on the specified page size.

Note that this endpoint leverages the underlying object syncing technology used for the object type. If `Restaurant` is backed by Object Storage v2, there is no request limit. If `Restaurant` is backed by Object Storage v1 (Phonograph), there is a limit of 10,000 results; if more than 10,000 `Restaurants` have been requested, an `ObjectsExceededLimit` error will be thrown.

Example query:

```typescript
const page: PageResult<Osdk.Instance<Restaurant>> = await client(Restaurant)
  .fetchPage({ $pageSize: 30 });
```

Example API response:

```json
{
  "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
  "data": [
    {
      "$primaryKey": "Restaurant Id",
      "$apiName": "Restaurant",
      "eMail": "Email",
      "restaurantId": "Restaurant Id",
      "address": "Address",
      "reviewSummary": "Review Summary",
      "phoneNumber": "Phone Number",
      "numberOfReviews": 123,
      "restaurantName": "Restaurant Name"
    }
    // ... Rest of page
  ]
}
```

## Load all `Restaurants`

Loads all `Restaurant` objects into an array. This uses an async iterator to fetch all objects across multiple pages.

Note that this endpoint leverages the underlying object syncing technology used for the object type. If `Restaurant` is backed by Object Storage v2, there is no request limit. If `Restaurant` is backed by Object Storage v1 (Phonograph), there is a limit of 10,000 results; if more than 10,000 `Restaurants` have been requested, an `ObjectsExceededLimit` error will be thrown.

Example query:

```typescript
async function getAll(): Promise<Array<Osdk.Instance<Restaurant>>> {
  const objects: Osdk.Instance<Restaurant>[] = [];
  for await (const obj of client(Restaurant).asyncIter()) {
    objects.push(obj);
  }
  return objects;
}

// If Array.fromAsync() is available in your target environment
function getAllFromAsync(): Promise<Array<Osdk.Instance<Restaurant>>> {
  return Array.fromAsync(client(Restaurant).asyncIter());
}
```

Example API response:

```json
{
  "data": [
    {
      "$primaryKey": "Restaurant Id",
      "$apiName": "Restaurant",
      "eMail": "Email",
      "restaurantId": "Restaurant Id",
      "address": "Address",
      "reviewSummary": "Review Summary",
      "phoneNumber": "Phone Number",
      "numberOfReviews": 123,
      "restaurantName": "Restaurant Name"
    }
    // ... Rest of data
  ]
}
```

## Load ordered results

Load an ordered page of `Restaurants` by specifying a sort direction for specific properties. When calling via APIs, sorting criteria are specified via the `fields` array. When calling via SDKs, you can specify ordering via the `$orderBy` parameter in the fetch options. The sort order for strings is case-sensitive, meaning numbers will come before uppercase letters, which will come before lowercase letters. For example, `Cat` will come before `bat`.

Parameters:

* **$orderBy `Record<string, "asc" | "desc">`:** An object specifying the property you want to order by and the direction ("asc" for ascending or "desc" for descending).

Example query:

```typescript
const page: PageResult<Osdk.Instance<Restaurant>> = await client(Restaurant)
  .fetchPage({
    $orderBy: { restaurantName: "asc" },
    $pageSize: 30,
  });
```

Example API response:

```json
{
  "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
  "data": [
    {
      "$primaryKey": "Object A",
      "$apiName": "Restaurant",
      "restaurantName": "A"
      // ...Rest of properties
    },
    {
      "$primaryKey": "Object B",
      "$apiName": "Restaurant",
      "restaurantName": "B"
      // ...Rest of properties
    }
    // ... Rest of page
  ]
}
```

## Filtering

The types of filtering you can perform depend on the types of the properties on a given object type. These filters can also be combined together via Boolean expressions to construct more complex filters.

Note that this endpoint leverages the underlying object syncing technology used for the object type. If `Restaurant` is backed by Object Storage v2, there is no request limit. If `Restaurant` is backed by Object Storage v1 (Phonograph), there is a limit of 10,000 results; if more than 10,000 `Restaurants` have been requested, an `ObjectsExceededLimit` error will be thrown.

Parameters:

* **where `WhereClause` (optional):** Filter on a particular property. The possible operations depend on the type of the property. Filters are specified as an object with property names as keys and filter operators as values.
* **$orderBy `OrderBy` (optional):** Order the results based on a particular property. You can chain the `.where()` call with `fetchPage()` and pass `$orderBy` in the options to achieve the same result.

Example query:

```typescript
const page: PageResult<Osdk.Instance<Restaurant>> = await client(Restaurant)
  .where({ restaurantName: { $isNull: true } })
  .fetchPage({ $pageSize: 30 });
```

Example API response:

```json
{
  "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
  "data": [
    {
      "$primaryKey": "Restaurant Id",
      "$apiName": "Restaurant",
      "restaurantName": null
      // ... Rest of properties
    }
    // ... Rest of page
  ]
}
```

### Types of search filters

#### Starts with

Only applies to String properties. Searches for `Restaurants` where `restaurantName` starts with the given string (case insensitive).

Parameters:

* **field:** Name of the property to use (for example, restaurantName).
* **$startsWith `string`:** Value to use for prefix matching against `Restaurant Name`. For example, "foo" will match "foobar" but not "barfoo".

Example query:

```typescript
const restaurantObjectSet = client(Restaurant)
  .where({ restaurantName: { $startsWith: "foo" } });
```

Example API response:

```json
{
  "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
  "data": [
    {
      "$primaryKey": "Restaurant Id",
      "$apiName": "Restaurant",
      "restaurantName": "foobar"
      // ... Rest of properties
    }
  ]
}
```

#### Contains any terms

Only applies to String properties. Returns `Restaurants` where `restaurantName` contains any of the white-space separated words (case insensitive) in any order in the provided value.

Parameters:

* **field:** Name of the property to use (for example, restaurantName).
* **$containsAnyTerm `string`:** White-space separated set of words to match on. For example, "foo bar" will match "bar baz" but not "baz qux".

Example query:

```typescript
const restaurantObjectSet = client(Restaurant)
  .where({ restaurantName: { $containsAnyTerm: "foo bar" } });
```

Example API response:

```json
{
  "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
  "data": [
    {
      "__rid": "ri.phonograph2-objects.main.object.00000000-0000-0000-0000-000000000000",
      "$primaryKey": "Restaurant Id",
      "$apiName": "Restaurant",
      "restaurantName": "foo bar baz"
      // ... Rest of properties
    },
    {
      "$primaryKey": "Restaurant Id 2",
      "$apiName": "Restaurant",
      "restaurantName": "bar baz"
      // ... Rest of properties
    }
  ]
}
```

#### Contains all terms

Only applies to String properties. Returns `Restaurants` where `restaurantName` contains all the white-space separated words (case insensitive) in any order in the provided value.

Parameters:

* **field:** Name of the property to use (for example, `restaurantName`).
* **$containsAllTerms `string`:** White-space separated set of words to match on. For example, "foo bar" will match "hello foo baz bar" but not "foo qux".

Example query:

```typescript
const restaurantObjectSet = client(Restaurant)
  .where({ restaurantName: { $containsAllTerms: "foo bar" } });
```

Example API response:

```json
{
  "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
  "data": [
    {
      "$primaryKey": "Restaurant Id",
      "$apiName": "Restaurant",
      "restaurantName": "hello foo baz bar"
      // ... Rest of properties
    }
  ]
}
```

#### Contains all terms in order

Only applies to String properties. Returns `Restaurants` where `restaurantName` contains all the terms (case insensitive) in the order provided and are adjacent to each other.

Parameters:

* **field:** Name of the property to use (for example, `restaurantName`).
* **$containsAllTermsInOrder `string`:** White-space separated set of words to match on. For example, "foo bar" will match "hello foo bar baz" but not "bar foo qux".

Example query:

```typescript
const restaurantObjectSet = client(Restaurant)
  .where({ restaurantName: { $containsAllTermsInOrder: "foo bar" } });
```

Example API response:

```json
{
  "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
  "data": [
    {
      "$primaryKey": "Restaurant Id",
      "$apiName": "Restaurant",
      "restaurantName": "foo bar baz"
      // ... Rest of properties
    }
  ]
}
```

#### Range comparison

Only applies to Numeric, String and DateTime properties. Returns `Restaurants` where `Restaurant.restaurantName` is less than a value.

Parameters:

* **field:** Name of the property to use (for example, `restaurantName`).
* **value `string | number | date`:** Value to compare `Restaurant Name` to

Comparison types:

* Less than `$lt`
* Greater than `$gt`
* Less than or equal to `$lte`
* Greater than or equal to `$gte`

Example query:

```typescript
const restaurantObjectSet = client(Restaurant)
  .where({ restaurantName: { $lt: "Restaurant Name" } });
```

#### Equal to

Only applies to Boolean, DateTime, Numeric, and String properties. Searches for `Restaurants` where `restaurantName` equals the given value.

Parameters:

* **field:** Name of the property to use (for example, `restaurantName`).
* **$eq `string | number | boolean | date`:** Value to do an equality check with `Restaurant Name`.

Example query:

```typescript
const restaurantObjectSet = client(Restaurant)
  .where({ restaurantName: { $eq: "Restaurant Name" } });
```

Example API response:

```json
{
  "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
  "data": [
    {
      "$primaryKey": "Restaurant Id",
      "$apiName": "Restaurant",
      "restaurantName": "Restaurant Name"
      // ... Rest of properties
    }
  ]
}
```

#### Null check

Only applies to Array, Boolean, DateTime, Numeric, and String properties. Searches for `Restaurants` based on whether a value for `restaurantName` exists or not.

Parameters:

* field: Name of the property to use (for example, `restaurantName`).
* $isNull `boolean`: Whether `Restaurant Name` exists. For checking that fields are non-null, use `$not` filter with `$isNull: true`.

Example query:

```typescript
const restaurantObjectSet = client(Restaurant)
  .where({ restaurantName: { $isNull: true } });
```

#### `Not` filter

Returns `Restaurants` where the query is not satisfied. This can be further combined with other boolean filter operations.

Parameters:

* $not: The search query to invert.

Example query:

```typescript
const restaurantObjectSet = client(Restaurant)
  .where({
    $not: { restaurantName: { $isNull: true } },
  });
```

#### `And` filter

Returns `Restaurants` where all queries are satisfied. This can be further combined with other boolean filter operations.

Parameters:

* $and `Filter[]`: The set of search queries to `and` together.

Example query:

```typescript
const restaurantObjectSet = client(Restaurant)
  .where({
    $and: [
      { $not: { restaurantName: { $isNull: true } } },
      { restaurantName: { $eq: "<primarykey>" } },
    ],
  });
```

#### `Or` filter

Returns `Restaurants` where any of the specified queries are satisfied. This can be further combined with other Boolean filter operations.

Parameters:

* $or `Filter[]`: The set of search queries to `or` together.

Example query:

```typescript
const restaurantObjectSet = client(Restaurant)
  .where({
    $or: [
      { $not: { restaurantName: { $isNull: true } } },
      { restaurantName: { $eq: "<primarykey>" } },
    ],
  });
```

## Aggregations

Aggregations allow you to compute summary statistics over a set of data. They are useful for understanding patterns and insights from large datasets without having to manually analyze each individual data point. You can combine multiple aggregation operations to create more complex queries that provide deeper insights into the data.

This endpoint uses the same object syncing technology as the object type. `Restaurant` can be backed by either Object Storage v2 or Object Storage v1 (Phonograph); in both cases, the endpoint returns a maximum of 10,000 results. If you request more than 10,000 `Restaurants`, the endpoint returns an `ObjectsExceededLimit` error.

Perform aggregations on `Restaurants`.

Parameters:

* **$select:** Set of aggregation functions to perform.
* **$groupBy (optional):** A set of groupings to create for aggregation results
* **where (optional):** Filter on a particular property. The possible operations depend on the type of the property.

Example query:

```typescript
const numRestaurants = await client(Restaurant)
  .where({ restaurantName: { $isNull: false } })
  .aggregate({
    $select: { $count: "unordered" },
    $groupBy: { restaurantName: "exact" },
  });
```

Example API response:

```
{
    excludedItems: 0,
    data: [{
        group: {
            "restaurantName": "Restaurant Name"
        },
        metrics: [
            {
                name: "count",
                value: 100
            }
        ]
    }]
}
```

### Types of aggregations

#### Approximate distinct

Computes an approximate number of distinct values for `restaurantName`.

Parameters:

* **field:** Name of the property to use (for example, `restaurantName`).
* **name `string` (optional):** Alias for the computed count. By default, this is `distinctCount`.

Example query:

```typescript
const distinctRestaurants = await client(Restaurant)
  .aggregate({
    $select: { restaurantName: { $approximateDistinct: "unordered" } },
  });

// This is equivalent to the above, but uses a custom metric name
const distinctRestaurants = await client(Restaurant)
  .aggregate({
    $select: {
      metricName: { restaurantName: { $approximateDistinct: "unordered" } },
    },
  });
```

Example API response:

```
{
    excludedItems: 0,
    data: [{
        group: {},
        metrics: [
            {
                name: "distinctCount",
                value: 100
            }
        ]
    }]
}
```

#### Count

Computes the total count of `Restaurants`.

Parameters:

* **name `string` (optional):** Alias for the computed count. By default, this is `count`.

Example query:

```typescript
const distinctRestaurants = await client(Restaurant)
  .aggregate({
    $select: { $count: "unordered" },
  });
```

Example API response:

```
{
    excludedItems: 0,
    data: [{
        group: {},
        metrics: [
            {
                name: "count",
                value: 100
            }
        ]
    }]
}
```

#### Numeric aggregations

Only applies to numeric properties. Calculate the maximum, minimum, sum, or average of a numeric property for `Restaurants`.

Parameters:

* **field:** Name of the property to use (for example, `numberOfReviews`).
* **name `string` (optional):** An alias for the computed value.

Aggregation types:

* Average: `$avg`
* Maximum: `$max`
* Minimum: `$min`
* Sum: `$sum`

Example query:

```typescript
const avgReviewScore = await client(Restaurant)
  .aggregate({
    $select: { numberOfReviews: { $avg: "unordered" } },
  });

// This is equivalent to the above, but uses a custom metric name
const avgReviewScore = await client(Restaurant)
  .aggregate({
    $select: {
      avgReview: { numberOfReviews: { $avg: "unordered" } },
    },
  });
```

Example API response:

```
{
    excludedItems: 0,
    data: [{
        group: {},
        metrics: [
            {
                name: "avg",
                value: 100
            }
        ]
    }]
}
```

### Types of group bys

#### Exact grouping

Groups `Restaurants` by exact values of `restaurantName`.

Parameters:

* **field:** Name of the property to use (for example, `restaurantName`).
* **"exact":** Specifies exact grouping.

Example query:

```typescript
const groupedRestaurants = await client(Restaurant)
  .aggregate({
    $select: { $count: "unordered" },
    $groupBy: { restaurantName: "exact" },
  });
```

Example API response:

```
{
    excludedItems: 0,
    data: [{
        group: {
            "restaurantName": "Restaurant Name"
        },
        metrics: [
            {
                name: "count",
                value: 100
            }
        ]
    }]
}
```

#### Numeric bucketing

Groups `Restaurants` by dividing `numberOfReviews` into buckets with the specified width.

Parameters:

* **field:** Name of the property to use (for example, `numberOfReviews`).
* **$fixedWidth `number`:** Width of each bucket to divide the selected property into.

Example query:

```typescript
const groupedRestaurants = await client(Restaurant)
  .aggregate({
    $select: { $count: "unordered" },
    $groupBy: { numberOfReviews: { $fixedWidth: 10 } },
  });
```

Example API response:

```
{
    excludedItems: 0,
    data: [{
        group: {
            "restaurantName": "Restaurant Name"
        },
        metrics: [
            {
                name: "count",
                value: 100
            }
        ]
    }]
}
```

#### Range grouping

Groups `Restaurants` by specified ranges of `numberOfReviews`.

Parameters:

* **field:** Name of the property to use (for example, `numberOfReviews`).
* **$ranges `Array<{$gte: number, $lt: number}>`:** Set of ranges which have an inclusive start value and exclusive end value.

Example query:

```typescript
const groupedRestaurants = await client(Restaurant)
  .aggregate({
    $select: { $count: "unordered" },
    $groupBy: {
      numberOfReviews: {
        $ranges: [
          { $gte: 0, $lt: 3 },
          { $gte: 3, $lt: 5 },
        ],
      },
    },
  });
```

Example API response:

```json
{
  "excludedItems": 0,
  "data": [
    {
      "group": {
        "numberOfReviews": {
          "startValue": 0,
          "endValue": 3
        }
      },
      "metrics": [
        {
          "name": "count",
          "value": 50
        }
      ]
    },
    {
      "group": {
        "numberOfReviews": {
          "startValue": 3,
          "endValue": 5
        }
      },
      "metrics": [
        {
          "name": "count",
          "value": 30
        }
      ]
    }
  ]
}
```

#### Datetime grouping

Groups `Restaurants` by `dateOfOpening` via buckets of a specific date/time duration.

Parameters:

* **field:** Name of the property to use (for example, `dateOfOpening`).
* **duration value and unit:** The duration unit and value to group by.

Duration types:

* Seconds `$duration: "seconds"`
* Minutes `$duration: "minutes"`
* Hours `$duration: "hours"`
* Days `$duration: "days"`
* Weeks `$duration: "weeks"`
* Months `$duration: "months"`
* Quarters `$duration: "quarters"`
* Years `$duration: "years"`

Example query:

```typescript
const groupedRestaurants = await client(Restaurant)
  .aggregate({
    $select: { $count: "unordered" },
    $groupBy: {
      dateOfOpening: {
        $duration: "days",
        $value: 10,
      },
    },
  });
```

Example API response:

```
{
    excludedItems: 0,
    data: [{
        group: {
            "dateOfOpening": {
                startValue: "2024-09-25"
            }
        },
        metrics: [
            {
                name: "count",
                value: 100
            }
        ]
    }]
}
```

## Actions on the Ontology

Action types in the Ontology refer to predefined operations that you can perform on objects within your data model. These actions can create, modify, and delete objects in the Ontology. Action types are generated based on the Ontology and can be used within the TypeScript OSDK to perform specific tasks on objects in the code.

### Parameters for adding a review to a `Restaurant` (`addRestaurantReview`)

| Property         | API name        | Type    |
| ---------------- | --------------- | ------- |
| `Restaurant Id`  | `restaurantId`  | String  |
| `Review Rating`  | `reviewRating`  | Integer |
| `Review Summary` | `reviewSummary` | String  |

#### Apply action

To apply an action, fill in the input parameter values. This will execute an action and return if the response was valid or invalid.

Parameters:

* **parameters `Object`:** Object of parameter ID to values to use for those input parameters.
  * `restaurantId` `string`
  * `reviewRating` `number`
  * `reviewSummary` `string`
* **options (optional):** Options for the action execution.
  * **`$returnEdits` `boolean`:** Whether the edits are returned in the response after the action is applied.

Example query:

```typescript
const result = await client(addReview).applyAction(
  {
    restaurantId: "restaurantId",
    reviewRating: 5,
    reviewSummary: "It was great!",
  },
  {
    $returnEdits: true,
  },
);

if (result.type === "edits") {
  console.log("Review added successfully", result);
} else {
  console.log("Review validation failed!", result);
}
```

Example API response:

```json
{
  "validation": {
    "result": "VALID",
    "submissionCriteria": [],
    "parameters": {
      "restaurantId": {
        "result": "VALID",
        "evaluatedConstraints": [],
        "required": true
      },
      "reviewRating": {
        "result": "VALID",
        "evaluatedConstraints": [],
        "required": true
      },
      "reviewSummary": {
        "result": "VALID",
        "evaluatedConstraints": [],
        "required": true
      }
    }
  },
  "edits": {
    "type": "edits",
    "edits": [
      {
        "type": "modifyObject",
        "primaryKey": "restaurantId1",
        "objectType": "Restaurant"
      }
    ],
    "addedObjectCount": 0,
    "modifiedObjectsCount": 1,
    "deletedObjectsCount": 0,
    "addedLinksCount": 0,
    "deletedLinksCount": 0
  }
}
```

#### Apply batch action

To apply a batch of actions, fill in the input parameter values. This will execute a series of action and return if the response was valid or invalid. Note that this does not return validations, only edits.

Parameters:

* **parameters `Array<Object>`:** Array of parameter objects with values to use for those input parameters.
  * `restaurantId` `string`
  * `reviewRating` `number`
  * `reviewSummary` `string`
* **options (optional):** Options for the action execution.
  * **`$returnEdits` `boolean`:** Whether the edits are returned in the response after the action is applied.

Example query:

```typescript
const result = await client(addReview).batchApplyAction(
  [
    {
      restaurantId: "restaurantId1",
      reviewRating: 5,
      reviewSummary: "It was great!",
    },
    {
      restaurantId: "restaurantId2",
      reviewRating: 4,
      reviewSummary: "Good food but service can improve.",
    },
  ],
  {
    $returnEdits: true,
  },
);

if (result.type === "edits") {
  const updatedObject = result.editedObjectTypes[0];
  console.log("Edited Objects", updatedObject);
}
```

Example Response:

```json
{
  "edits": {
    "type": "edits",
    "edits": [
      {
        "type": "modifyObject",
        "primaryKey": "restaurantId1",
        "objectType": "Restaurant"
      },
      {
        "type": "modifyObject",
        "primaryKey": "restaurantId2",
        "objectType": "Restaurant"
      }
    ],
    "addedObjectCount": 0,
    "modifiedObjectsCount": 2,
    "deletedObjectsCount": 0,
    "addedLinksCount": 0,
    "deletedLinksCount": 0
  }
}
```

## Functions

[Functions](/docs/foundry/functions/overview/) (sometimes referred to as "functions on objects" or "FOO") in the Palantir platform are a powerful feature designed to enhance data modeling and manipulation. Functions provide a way to define and execute custom logic on the data stored in the Ontology, allowing users to create more sophisticated data transformations, validations, and analytics.

Within the TypeScript SDK, a user can execute Foundry Functions through generated function definitions.

By adding your functions to your application, you can generate code that calls functions on objects to execute logic and get the result.

In this example, we have a function `findSimilarRestaurants` that takes in an ID and returns an object set containing all the similar `Restaurants`.

### Parameters for executing a function to find similar `Restaurants` (`findSimilarRestaurants`)

| Property        | API name       | Type   |
| --------------- | -------------- | ------ |
| `Restaurant Id` | `restaurantId` | String |

Returns: `RestaurantObjectSet`

#### Apply function

To apply a function, you must execute it via the client. This is done by passing the function to the client and calling `executeFunction` with the parameters.

Example query:

```typescript
const result = await client(findSimilarRestaurants).executeFunction({
  restaurantId: "restaurantId",
});
```
