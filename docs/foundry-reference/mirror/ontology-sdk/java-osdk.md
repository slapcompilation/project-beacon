<!-- source: https://palantir.com/docs/foundry/ontology-sdk/java-osdk/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Java OSDK

This page provides generic documentation for the Java OSDK based on an example Restaurant object and its associated Actions and Queries. You can use Developer Console in the platform to [generate documentation based on your specific Ontology](/docs/foundry/developer-console/create-application/).

| Property                      | API Name          | Type      |
| ----------------------------- | ----------------- | --------- |
| `Restaurant Id` (primary key) | `restaurantId`    | String    |
| `Restaurant Name` (title)     | `restaurantName`  | String    |
| `Address`                     | `address`         | String    |
| `E Mail`                      | `eMail`           | String    |
| `Number Of Reviews`           | `numberOfReviews` | Integer   |
| `Phone Number`                | `phoneNumber`     | String    |
| `Review Summary`              | `reviewSummary`   | String    |
| `Date Of Opening`             | `dateOfOpening`   | LocalDate |

## Load single `Restaurant`

Parameters:

* primaryKey `string`: The primary key of the `Restaurant` you want to fetch
  Example query:

```java
Restaurant result = client.ontology().objects().Restaurant().fetch("primaryKey").orElseThrow();
```

Example API response:

```json
{
    "__rid": "ri.phonograph2-objects.main.object.00000000-0000-0000-0000-000000000000",
    "__primaryKey": "Restaurant Id",
    "eMail": "E Mail",
    "restaurantId": "Restaurant Id",
    "address": "Address",
    "reviewSummary": "Review Summary",
    "phoneNumber": "Phone Number",
    "numberOfReviews": 123,
    "restaurantName": "Restaurant Name"
}
```

## Load a stream of `Restaurants`

Load a stream of objects that can be collected. This automatically loads pages of objects depending on how many objects are streamed by the user.

Note that this endpoint leverages the underlying object syncing technology used for the object type. If `Restaurant` is backed by Object Storage v2, there is no request limit. If `Restaurant` is backed by Object Storage v1 (Phonograph), there is a limit of 10,000 results; if more than 10,000 `Restaurants` have been requested, an `ObjectsExceededLimit` error will be thrown.

Example query:

```java
Stream<Restaurant> result = client.ontology().objects().Restaurant().fetchStream()
```

Example API response:

```json
{
    "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
    "data": [
        {
            "__rid": "ri.phonograph2-objects.main.object.00000000-0000-0000-0000-000000000000",
            "__primaryKey": "Restaurant Id",
            "eMail": "E Mail",
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

Loads all `Restaurant` Objects into a list.

Note that this endpoint leverages the underlying object syncing technology used for the object type. If `Restaurant` is backed by Object Storage v2, there is no request limit. If `Restaurant` is backed by Object Storage v1 (Phonograph), there is a limit of 10,000 results; if more than 10,000 `Restaurants` have been requested, an `ObjectsExceededLimit` error will be thrown.

Example query:

```java
List<Restaurant> result = client.ontology().objects().Restaurant().fetchStream().toList()
```

Example API response:

```json
{
    "data": [
        {
            "__rid": "ri.phonograph2-objects.main.object.00000000-0000-0000-0000-000000000000",
            "__primaryKey": "Restaurant Id",
            "eMail": "E Mail",
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

Load an ordered list of `Restaurants` by specifying a sort direction for specific properties. When calling via APIs, sorting criteria are specified via the `fields` array. When calling via SDKs, you can chain multiple `orderBy` calls together. The sort order for strings is case-sensitive, meaning numbers will come before uppercase letters, which will come before lowercase letters. For example, Cat will come before bat.

Parameters:

* ordering `{ObjectType}Ordering`: The property you want to order by. With the Java SDK, this is provided for you via a `{ObjectType}Ordering` interface.
* property name and direction `ASC`| `DESC` : The direction you want to sort in, either ascending or descending. With the Java SDK, this is provided via the `{PROPERTY_NAME}_ASC` and `{PROPERTY_NAME}_DESC` qualifiers on the `{ObjectType}Ordering` interface.

Example query:

```java
Stream<Restaurant> result = client.ontology()
    .objects()
    .Restaurant()
    .orderBy(RestaurantOrdering.RESTAURANT_NAME_ASC)
    .fetchStream();
```

Example API response:

```json
{
    "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
    "data": [
        {
            "__rid": "ri.phonograph2-objects.main.object.00000000-0000-0000-0000-000000000000",
            "__primaryKey": "Object A",
            "restaurantName": "A"
            // ...Rest of properties
        },
        {
            "__rid": "ri.phonograph2-objects.main.object.00000000-0000-0000-0000-000000000000",
            "__primaryKey": "Object B",
            "restaurantName": "B"
            // ...Rest of properties
        }
        // ...Rest of page
    ]
}
```

## Filtering

The types of filtering you can perform depend on the types of the properties on a given object type. These filters can also be combined together via Boolean expressions to construct more complex filters.

Note that this endpoint leverages the underlying object syncing technology used for the object type. If `Restaurant` is backed by Object Storage v2, there is no request limit. If `Restaurant` is backed by Object Storage v1 (Phonograph), there is a limit of 10,000 results; if more than 10,000 `Restaurants` have been requested, an `ObjectsExceededLimit` error will be thrown.

Parameters:

* where `Filter` (optional): Filter on a particular property. The possible operations depend on the type of the property. This is represented through `{ObjectType}Filter` with methods to call for each property.
* orderBy `OrderBy` (optional): Order the results based on a particular property. If using the SDK, you can chain the `.where` call with an `orderBy` call to achieve the same result. This is represented through `{ObjectType}OrderBy` with methods to call for each property.

Example query:

```java
List<Restaurant> result = client.ontology()
    .objects()
    .Restaurant()
    .where(RestaurantFilter.restaurantName().isNull(false))
    .fetchStream()
    .toList();
```

Example API response:

```json
{
    "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
    "data": [
        {
            "__rid": "ri.phonograph2-objects.main.object.00000000-0000-0000-0000-000000000000",
            "__primaryKey": "Restaurant Id",
            "restaurantName": null
            // ... Rest of properties
        }
        // ... Rest of page
    ]
}
```

### Types of search filters (`RestaurantFilter`)

#### Starts with

Only applies to String properties. Searches for `Restaurants` where `restaurantName` starts with the given string (case insensitive).

Parameters:

* field `method`: Name of the property to use (for example, restaurantName).
* value `string`: Value to use for prefix matching against `Restaurant Name`. For example, "foo" will match "foobar" but not "barfoo".

Example query:

```java
RestaurantObjectSet result = client.ontology()
    .objects()
    .Restaurant()
    .where(RestaurantFilter.restaurantName().startsWith("foo"));
```

Example API response:

```json
{
    "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
    "data": [
        {
            "__rid": "ri.phonograph2-objects.main.object.00000000-0000-0000-0000-000000000000",
            "__primaryKey": "Restaurant Id",
            "restaurantName": "foobar"
            // ... Rest of properties
        }
    ]
}
```

#### Contains any terms

Only applies to String properties. Returns `Restaurants` where `restaurantName` contains any of the whitespace separated words (case insensitive) in any order in the provided value.

Parameters:

* field `method`: Name of the property to use (for example, restaurantName).
* value `string`: White-space separated set of words to match on. For example, "foo bar" will match "bar baz" but not "baz qux".

Example query:

```java
RestaurantObjectSet result = client.ontology()
    .objects()
    .Aircraft()
    .where(RestaurantFilter.restaurantName().containsAnyTerm("foo bar"));
```

Example API response:

```json
{
    "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
    "data": [
        {
            "__rid": "ri.phonograph2-objects.main.object.00000000-0000-0000-0000-000000000000",
            "__primaryKey": "Restaurant Id",
            "restaurantName": "foo bar baz"
            // ... Rest of properties
        },
        {
            "__rid": "ri.phonograph2-objects.main.object.00000000-0000-0000-0000-000000000001",
            "restaurantName": "bar baz"
            // ... Rest of properties
        }
    ]
}
```

#### Contains all terms

Only applies to String properties. Returns `Restaurants` where `restaurantName` contains all the whitespace separated words (case insensitive) in any order in the provided value.

Parameters:

* field `method`: Name of the property to use (for example, `restaurantName`).
* value `string`: White-space separated set of words to match on. For example, "foo bar" will match "hello foo baz bar" but not "foo qux".

Example query:

```java
RestaurantObjectSet result = client.ontology()
    .objects()
    .Aircraft()
    .where(RestaurantFilter.restaurantName().containsAllTerms("foo bar"));
```

Example API response:

```json
{
    "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
    "data": [
        {
            "__rid": "ri.phonograph2-objects.main.object.00000000-0000-0000-0000-000000000000",
            "__primaryKey": "Restaurant Id",
            "restaurantName": "hello foo baz bar"
            // ... Rest of properties
        }
    ]
}
```

#### Contains all terms in order

Only applies to String properties. Returns `Restaurants` where `restaurantName` contains all the terms in the order provided (case insensitive), but they do have to be adjacent to each other.

Parameters:

* field `method`: Name of the property to use (for example, `restaurantName`).
* value `string`: White-space separated set of words to match on. For example, "foo bar" will match "hello foo bar baz" but not "bar foo qux".

Example query:

```java
RestaurantObjectSet result = client.ontology()
    .objects()
    .Aircraft()
    .where(RestaurantFilter.restaurantName().containsAllTermsInOrder("foo bar"));
```

Example API response:

```json
{
    "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
    "data": [
        {
            "__rid": "ri.phonograph2-objects.main.object.00000000-0000-0000-0000-000000000000",
            "__primaryKey": "Restaurant Id",
            "restaurantName": "foo bar baz"
            // ... Rest of properties
        }
    ]
}
```

#### Range comparison

Only applies to Numeric, String and DateTime properties. Returns `Restaurants` where `Restaurant.restaurantName` is less than a value.

Parameters:

* field `method`: Name of the property to use (for example, `restaurantName`).
* value `string`: Value to compare `Restaurant Name` to

Comparison types:

* Less than `lt`
* Greater than `gt`
* Less than or equal to `lte`
* Greater than or equal to `gte`

Example query:

```java
RestaurantObjectSet result = client.ontology()
    .objects()
    .Aircraft()
    .where(RestaurantFilter.restaurantName().lt("Restaurant Name"));
```

#### Equal to

Only applies to Boolean, DateTime, Numeric, and String properties. Searches for `Restaurants` where `restaurantName` equals the given value.

Parameters:

* field `method`: Name of the property to use (for example, `restaurantName`).
* value `string`: Value to do an equality check with `Restaurant Name`.

Example query:

```java
RestaurantObjectSet result = client.ontology()
    .objects()
    .Aircraft()
    .where(RestaurantFilter.restaurantName().eq("Restaurant Name"));
```

Example API response:

```json
{
    "nextPageToken": "v1.000000000000000000000000000000000000000000000000000000000000000000000000",
    "data": [
        {
            "__rid": "ri.phonograph2-objects.main.object.00000000-0000-0000-0000-000000000000",
            "__primaryKey": "Restaurant Id",
            "restaurantName": "Restaurant Name"
            // ... Rest of properties
        }
    ]
}
```

#### Null check

Only applies to Array, Boolean, DateTime, Numeric, and String properties. Searches for `Restaurants` based on whether a value for `restaurantName` exists or not.

Parameters:

* field `method`: Name of the property to use (for example, `restaurantName`).
* value `boolean`: Whether `Restaurant Name` exists. Note for the TypeScript SDK, you will need to use a not filter for checking that fields are non-null.

Example query:

```java
RestaurantObjectSet result = client.ontology()
    .objects()
    .Aircraft()
    .where(RestaurantFilter.restaurantName().isNull(true));
```

#### `Not` filter

Returns `Restaurants` where the query is not satisfied. This can be further combined with other boolean filter operations.

Parameters:

* value `Filter`: The search query to invert.

Example query:

```java
RestaurantObjectSet result = client.ontology()
    .objects()
    .Aircraft()
    .where(
        RestaurantFilter.$not(
            RestaurantFilter.restaurantName().isNull(true)
        )
    );
```

#### `And` filter

Returns `Restaurants` where all queries are satisfied. This can be further combined with other boolean filter operations.

Parameters:

* value `Filter[]`: The set of search queries to `and` together.

Example query:

```java
RestaurantObjectSet result = client.ontology()
    .objects()
    .Aircraft()
    .where(
        RestaurantFilter.$and(
            RestaurantFilter.restaurantName().isNull(false),
            RestaurantFilter.restaurantName().eq("<primarykey>")
        )
    );
```

#### `Or` filter

Returns `Restaurants` where any of the specified queries are satisfied. This can be further combined with other Boolean filter operations.

Parameters:

* value `Filter[]`: The set of search queries to `or` together.

Example query:

```java
RestaurantObjectSet result = client.ontology()
    .objects()
    .Aircraft()
    .where(
        RestaurantFilter.$or(
            RestaurantFilter.restaurantName().isNull(false),
            RestaurantFilter.restaurantName().eq("<primarykey>")
        )
    );
```

## Aggregations

Aggregations allow you to compute summary statistics over a set of data. They are useful for understanding patterns and insights from large datasets without having to manually analyze each individual data point. You can combine multiple aggregation operations to create more complex queries that provide deeper insights into the data.

Note that this endpoint leverages the underlying object syncing technology used for the object type. If `Restaurant` is backed by Object Storage v2, there is no request limit. If `Restaurant` is backed by Object Storage v1 (Phonograph), there is a limit of 10,000 results; if more than 10,000 `Restaurants` have been requested, an `ObjectsExceededLimit` error will be thrown.

Perform aggregations on `Restaurants`.

Parameters:

* aggregation `Aggregation[]` (optional): Set of aggregation functions to perform. With the SDK, aggregation computations can be chained together with further searches using `.where`.
* groupBy `GroupBy[]` (optional): A set of groupings to create for aggregation results
* where `Filter` (optional): Filter on a particular property. The possible operations depend on the type of the property.

Example query:

```java
AggregationResponse numRestaurants = client.ontology()
        .objects()
        .Restaurants()
        .where(RestaurantFilter.restaurantName().isNull(false))
        .groupBy(GroupBy.exact(Restaurant.Property.restaurantName()))
        .count()
        .compute();
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

### Types of aggregations (`Aggregation`)

#### Approximate distinct

Computes an approximate number of distinct values for `restaurantName`.

Parameters:

* field `Property`: Name of the property to use (for example, `restaurantName`).
* name `string` (optional): Alias for the computed count. By default, this is `distinctCount`.

Example query:

```java
Double distinctRestaurants = client.ontology()
        .objects()
        .Restaurant()
        .approximateDistinct(Restaurant.Property.restaurantName())
        .compute();

// This is equivalent to the above, but uses metricName as the metric name instead of the default "distinctCount"

AggregationResponse distinctRestaurants = client.ontology()
        .objects()
        .Restaurant()
        .aggregate(
            Map.of(
                "metricName",
                Aggregation.approximateDistinct(Restaurant.Property.restaurantName())
            )
        )
        .compute();
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

* name `string` (optional): Alias for the computed count. By default, this is `count`.

Example query:

```java
Double distinctRestaurants = client.ontology()
        .objects()
        .Restaurant()
        .count()
        .compute();
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

* field `NumericProperty`: Name of the property to use (for example, `numberOfReviews`).
* name `string` (optional): An alias for the computed value.

Aggregation types:

* Average: `avg()`
* Maximum: `max()`
* Minimum: `min()`
* Sum: `sum()`

Example query:

```java
Double avgReviewScore = client.ontology()
        .objects()
        .Restaurant()
        .avg(Restaurant.Property.numberOfReviews())
        .compute();

// This is equivalent to the above, but uses avgReview as the metric name instead of the default "avg"

AggregationResponse distinctRestaurants = client.ontology()
        .objects()
        .Restaurant()
        .aggregate(
            Map.of(
                "avgReview",
                Aggregation.avg(Restaurant.Property.numberOfReviews())
            )
        )
        .compute();
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

### Types of group bys (`GroupBy`)

#### Exact grouping

Groups `Restaurants` by exact values of `restaurantName`.

Parameters:

* field `Property`: Name of the property to use (for example, `restaurantName`).
* maxGroupCount `integer` (optional): Maximum number of groupings of `restaurantName` to create.

Example query:

```java
AggregationResponse groupedRestaurants = client.ontology()
       .objects()
       .Restaurant()
       .groupBy(GroupBy.exact(Restaurant.Property.restaurantName()))
       .count()
       .compute();
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

* field `NumericProperty`: Name of the property to use (for example, `numberOfReviews`).
* fixedWidth `integer` (optional): Width of each bucket to divide the selected property into.

Example query:

```java
AggregationResponse groupedRestaurants = client.ontology()
       .objects()
       .Restaurant()
       .groupBy(GroupBy.fixedWidth(Restaurant.Property.numberOfReviews(), 10))
       .count()
       .compute();
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

* field `NumericProperty | DateProperty | TimestampProperty`: Name of the property to use (for example, `numberOfReviews`).
* ranges `AggregationRange[]` (optional): Set of ranges which have an inclusive start value and exclusive end value.

Example query:

```java
AggregationResponse groupedRestaurants = client.ontology()
    .objects()
    .Restaurant()
    .groupBy(
        GroupBy.range(
            Restaurant.Property.numberOfReviews(),
            List.of(
                AggregationRange.of(0, 3),
                AggregationRange.of(3, 5)
            )
        )
    )
    .count()
    .compute();
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

* field `DateProperty | TimestampProperty`: Name of the property to use (for example, `dateOfOpening`).
* value `integer` (optional): The number of duration units to group by.

Duration types:

* Seconds `bySeconds()`
* Minutes `byMinutes()`
* Hours `byHours()`
* Days `byDays()`
* Weeks `byWeeks()`
* Months `byMonths()`
* Quarters `byQuarters()`
* Years `byYears()`

Example query:

```java
AggregationResponse groupedRestaurants = client.ontology()
       .objects()
       .Restaurant()
       .groupBy(GroupBy.byDays(Restaurant.Property.dateOfOpening(), 10))
       .count()
       .compute();
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

Action types in the Ontology refer to predefined operations that you can perform on objects within your data model. These actions can create, modify, and delete objects in the Ontology. Action types are generated based on the Ontology and can be used within the Java OSDK to perform specific tasks on objects in the code.

### Parameters for adding a review to a `Restaurant` (`AddRestaurantReview`)

| Property         | API Name        | Type    |
| ---------------- | --------------- | ------- |
| `Restaurant Id`  | `restaurantId`  | String  |
| `Review Rating`  | `reviewRating`  | Integer |
| `Review Summary` | `reviewSummary` | String  |

#### Apply action

To apply an action, fill in the input parameter values. This will execute an action and return if the response was valid or invalid.

Parameters:

* parameters `Object`: Map of parameter ID to values to use for those input parameters.
  * `restaurantId` `string`
  * `reviewRating` `integer`
  * `reviewSummary` `string`
* options `integer` (optional): The number of duration units to group by.

Example Query:

```java
AddReviewActionResponse response = client.ontology()
    .actions()
    .addReview()
    .apply(
        AddReviewActionRequest.builder()
            .restaurantId(restaurantId)
            .reviewRating(5)
            .reviewSummary("It was great!")
            .build(),
        ReturnEditsMode.ALL
    );

response.getValidationResult().accept(new ActionValidationVisitor<Object>() {
    @Override
    public Object valid(ActionValidationResponse response) {
        System.out.println("Review added successfully " + response);
        return null;
    }

    @Override
    public Object invalid(ActionValidationResponse response) {
        System.out.println("Review validation failed! " + response);
        return null;
    }
});
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

* parameters `Object`: Map of parameter ID to values to use for those input parameters.
  * `restaurantId` `string`
  * `reviewRating` `integer`
  * `reviewSummary` `string`
* value `ReturnEditsMode.(ALL|NONE)` (optional): Whether the edits are returned in the response after the action is applied.

Example Query:

```java
AddReviewBatchActionResponse response = client.ontology()
    .actions()
    .addReview()
    .applyBatch(
        List.of(
            AddReviewActionRequest.builder()
                .restaurantId("restaurantId1")
                .reviewRating(5)
                .reviewSummary("It was great!")
                .build(),
            AddReviewActionRequest.builder()
                .restaurantId("restaurantId2")
                .reviewRating(4)
                .reviewSummary("Good food but service can improve.")
                .build()
        ),
        ReturnEditsMode.ALL
    );


responseAction.getActionEdits().get().accept(new ActionEditsVisitor<Void>() {
        @Override
        public Void objectEdits(ObjectEdits response) {
            System.out.println("Edited Objects " + response);
            return null;
        }

        @Override
        public Void largeScaleObjectEdits(ObjectTypeEdits response) {
            System.out.println("Edited ObjectTypes: " + response);
            return null;
        }
    });
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

[Functions](/docs/foundry/functions/overview/) (sometimes referred to as "functions on objects" or FoO) in the Palantir platform are a powerful feature designed to enhance data modeling and manipulation. Functions provide a way to define and execute custom logic on the data stored in the Ontology, allowing users to create more sophisticated data transformations, validations, and analytics.

Within the Java SDK, a user can execute Foundry Functions through generated queries.

By adding your functions to your application, you can generate Queries that call FoO to execute logic and get the result.

In this example, we have a function `findSimilarRestaurants` that takes in an ID and returns an ObjectSet containing all the similar `Restaurants`.

### Parameters for executing a function to find similar `Restaurants`(`findSimilarRestaurants`)

| Property        | API Name       | Type   |
| --------------- | -------------- | ------ |
| `Restaurant Id` | `restaurantId` | String |

Returns: `RestaurantObjectSet`

#### Apply function

To apply a function, you must access and execute a query. This is done by accessing `.queries()` and executing the logic function through `.execute(...).getReturnValue()`

Example Query:

```java
RestaurantObjectSet response = client
    .ontology()
    .queries()
    .findSimilarRestaurants()
    .execute("restaurantId")
    .getReturnValue();
```

## Media reference properties

A [media reference](/docs/foundry/data-integration/media-sets/) in the Palantir platform is a reference to a piece of media present in a `MediaSet`.

Within the Java SDK, a user can add a media reference property that allows them to `upload` and `download` media to the backing media set.

In the following example, we have a `restaurantMenu` property that represents the menu associated with a particular `Restaurant` object.

### Property for accessing media on `Restaurants`(`restaurantMenu`)

| Property          | API Name         | Type  |
| ----------------- | ---------------- | ----- |
| `Restaurant Menu` | `restaurantMenu` | Media |

We also have an Action defined as `ChangeMenu` that allows us to modify the associated `restaurantMenu` with a `Restaurant`.

#### Parameters for changing the menu of a `Restaurant` (`ChangeMenu`)

| Property          | API Name         | Type   |
| ----------------- | ---------------- | ------ |
| `Restaurant Id`   | `restaurantId`   | String |
| `Restaurant Menu` | `restaurantMenu` | Media  |

#### Object/interface with a media reference property

```java
Restaurant restaurant = client.ontology().objects().Restaurant().fetch(primaryKey).orElseThrow();
Media restaurantMenu = restaurant.restaurantMenu().get();
```

#### Media reference property definition

The media reference property is exposed as an interface to the user. The property has functions that fetch data that are implemented internally and not exposed to the user. You can get the underlying `MediaReferenceId` by accessing `getId()`:

```java
public interface Media {

    /**
     * Get the identifier for the media reference.
     */
    MediaReferenceId getId();

    /**
     * Fetch an object's media reference property metadata.
     */
    MediaMetadata fetchMetadata();

    /**
     * Opens a new stream to load the media
     * file associated with an object's media reference property.
     */
    @MustBeClosed
    InputStream openStream();
}
```

#### Fetch metadata

To get the `MediaMetadata`, call `restaurantMenu.fetchMetadata()`:

```java
Media restaurantMenu = restaurant.restaurantMenu().get();
MediaMetadata restaurantMenuMetadata = restaurantMenu.fetchMetadata();
```

#### Download media

To download media, call `restaurantMenu.openStream()` to receive a stream to fetch the contents:

```java
try (InputStream inputStream = restaurant.restaurantMenu().get().openStream()) {
        byte[] fileBytes = inputStream.readAllBytes();
    } catch (IOException e) {
        throw new RuntimeException(e);
    }
```

#### Upload media

To upload a media file, first upload to the backing media set itself. Then, link the uploaded `MediaItem` to a specific object.

Each `ObjectSet` will have a method to upload media to a specific property’s backing `MediaSet`. This returns a `Media` instance representing the uploaded media's media reference. In this example, the object has a generated `uploadRestaurantMenu()` method that allows you to upload media to the backing `MediaSet`:

```java
Media media =
        client.ontology()
                .objects()
                .Restaurant()
                .uploadRestaurantMenu(UploadMediaRequest.builder()
                        .mediaItemPath(...)
                        .mediaType(...)
                        .inputStream(...)
                        .build());
```

Once successfully uploaded, you can use the returned `Media` object to link the uploaded media item to a corresponding object by executing the appropriate Action.

#### Media in actions

After uploading and getting a resulting `Media` object, you can use the media reference on an Action to associate the media reference with a specific object's media property:

```java
client.ontology()
        .actions()
        .changeMenuAction()
        .apply(ChangeMenuActionRequest.builder()
                .restaurant_menu(media)
                .build());
```

You can also use another object’s media reference in an Action:

```java
client.ontology()
        .actions()
        .changeMenuAction()
        .apply(ChangeMenuActionRequest.builder()
                .restaurant_menu(restaurant.restaurantMenu().get())
                .build());
```

Note that the media reference must reference the same `MediaSet` wherever it is used. This means that you cannot upload a `MediaItem` to `MediaSet A` and then link that `MediaItem` to `MediaSet B`, for example.
