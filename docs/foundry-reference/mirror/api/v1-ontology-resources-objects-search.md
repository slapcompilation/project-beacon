<!-- source: https://palantir.com/docs/foundry/api/v1/ontology-resources/objects/search/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Search Objects Details

```
POST /api/v1/ontologies/{ontologyRid}/objects/{objectType}/search
```

Search is an alternative to the existing [Filtering Objects syntax](/docs/foundry/api/ontology-resources/objects/ontology-object-basics#filter-objects) and may be extended to support other search operations in the future. The search query is provided as a JSON request body.

For Object Storage V1 backed objects, this endpoint returns a maximum of 10,000 objects. After 10,000 objects have been returned and if more objects
are available, attempting to load another page will result in an `ObjectsExceededLimit` error being returned. There is no limit on Object Storage V2 backed objects.

Note that null value properties will not be returned.

## Query types

| Query type            | Description                                                                                                       | Supported Property Types          |
|-----------------------|-------------------------------------------------------------------------------------------------------------------|-----------------------------------|
| [lt](#lt)             | The provided property is less than the provided value.                                                            | number, string, date, timestamp   |
| [gt](#gt)             | The provided property is greater than the provided value.                                                         | number, string, date, timestamp   |
| [lte](#lte)           | The provided property is less than or equal to the provided value.                                                | number, string, date, timestamp   |
| [gte](#gte)           | The provided property is greater than or equal to the provided value.                                             | number, string, date, timestamp   |
| [eq](#eq)             | The provided property is exactly equal to the provided value.                                                     | number, string, date, timestamp   |
| [isNull](#isNull)     | The provided property is (or is not) null.                                                                        | all                               |
| [contains](#contains) | The provided property contains the provided value.                                                                | array                             |
| [not](#not)           | The sub-query does not match.                                                                                     | -                                 |
| [and](#and)           | All the sub-queries match.                                                                                        | -                                 |
| [or](#or)             | At least one of the sub-queries matches.                                                                          | -                                 |
| [prefix](#prefix)     | The provided property contains the provided sequence of terms in order and the final term is matched as a prefix. | string                            |
| [phrase](#phrase)     | The provided property contains the provided sequence of terms in order.                                           | string                            |
| [anyTerm](#anyTerm)   | The provided property contains at least one of the terms.                                                         | string                            |
| [allTerms](#allTerms) | The provided property contains all the terms.                                                                     | string                            |

## Example search request

```
{
  "query": {
    "type": "lt",
    "field": "properties.age",
    "value": 10
  },
  "orderBy": {
    "fields": [
      {
        "field": "properties.age",
        "direction": "asc"
      }
    ]
  },
  "pageSize": 10,
  "pageToken": "v1.QnVpbGQgdGhlIEZ1dHVyZTogaHR0cHM6Ly93d3cucGFsYW50aXIuY29tL2NhcmVlcnMvP2xldmVyLXNvdXJjZSU1YiU1ZD1BUElEb2NzI29wZW4tcG9zaXRpb25z"
}
```

* `orderBy`: The list of fields to order results by. The direction of each can be `asc` or `desc`.
* `pageSize`: The desired size of the page to be returned. Defaults to 1,000. See [page sizes](/docs/foundry/api/general/overview/paging/#page-sizes) for details.
* `pageToken`: Omit this from initial requests for results. If a response contains a `nextPageToken` field, use that value as the `pageToken` field in your request for the next page of results for that query. Do not alter the page size or other parts of the request between pages.

## Example search response

```
{
  "nextPageToken": "v1.QnVpbGQgdGhlIEZ1dHVyZTogaHR0cHM6Ly93d3cucGFsYW50aXIuY29tL2NhcmVlcnMvP2xldmVyLXNvdXJjZSU1YiU1ZD1BUElEb2NzI29wZW4tcG9zaXRpb25z",
  "data": [
    {
      "rid": "ri.phonograph2-objects.main.object.88a6fccb-f333-46d6-a07e-7725c5f18b61",
      "properties": {
        "id": 50030,
        "firstName": "John",
        "lastName": "Doe",
        "age": 5
      }
    },
    {
      "rid": "ri.phonograph2-objects.main.object.dcd887d1-c757-4d7a-8619-71e6ec2c25ab",
      "properties": {
        "id": 20090,
        "firstName": "John",
        "lastName": "Haymore",
        "age": 9
      }
    }
  ],
  "totalCount": 100,
}
```

- **data**: The list of objects in the current page.
- **nextPageToken** (optional): The page token indicates where to start paging. This should be omitted from the first 
page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous 
response and use it to populate the `pageToken` field of the next request.
- **totalCount**: The total count of the results across all pages.

## Ordering

Search results can be sorted by one or more properties using an `orderBy` clause.

The sort order for strings is based on unicode code points of the raw (non-analyzed) string, meaning numbers will come before uppercase letters, which will come before lowercase letters. For example, Cat will come before bat.

**Example**

```
"orderBy": {
  "fields": [
    {
      "field": "properties.age",
      "direction": "asc"
    },
    {
      "field": "properties.firstName",
      "direction": "desc"
    }
  ]
}
```

## Example queries

### <a name="lt"></a> Less than query (`lt`)

**Description**

The provided property is less than the provided value.

**Example**

```
{
  "query": {
    "type": "lt",
    "field": "properties.age",
    "value": 10
  }
}
```

**Case-sensitive:** yes

-------

### <a name="gt"></a> Greater than query (`gt`)

**Description**

The provided property is greater than the provided value.

**Example**

```
{
  "query": {
    "type": "gt",
    "field": "properties.age",
    "value": 10
  }
}
```

**Case-sensitive:** yes

-------

### <a name="lte"></a> Less than or equal query (`lte`)

**Description**

The provided property is less than or equal to the provided value.

**Example**

```
{
  "query": {
    "type": "lte",
    "field": "properties.age",
    "value": 10
  }
}
```

**Case-sensitive:** yes

-------

### <a name="gte"></a> Greater than or equal query (`gte`)

**Description**

The provided property is greater than or equal to the provided value.

**Example**

```
{
  "query": {
    "type": "gte",
    "field": "properties.age",
    "value": 10
  }
}
```

**Case-sensitive:** yes

-------

### <a name="eq"></a> Equality query (`eq`)

**Description**

The provided property is exactly equal to the provided value.

**Example**

```
{
  "query": {
    "type": "eq",
    "field": "properties.firstName",
    "value": "john"
  }
}
```

**Case-sensitive:** yes

-------

### <a name="isNull"></a> IsNull query (`isNull`)

**Description**

The provided property is (or is not) null.

**Example**

```
{
  "query": {
    "type": "isNull",
    "field": "properties.occupation",
    "value": false
  }
}
```

-------

### <a name="contains"></a> Contains query (`contains`)

**Description**

The provided property contains the provided value.

**Example**

```
{
  "query": {
    "type": "contains",
    "field": "properties.nicknames",
    "value": "john"
  }
}
```

**Case-sensitive:** yes

-------

### <a name="not"></a> Not query (`not`)

**Description**

The sub-query does not match.

**Example**

```
{
  "query": {
    "type": "not",
    "value": {
      "type": "eq",
      "field": "properties.firstName",
      "value": "john"
    }
  }
}
```

-------

### <a name="and"></a> And query (`and`)

**Description**

All the sub-queries match.

**Example**

```
{
  "query": {
    "type": "and",
    "value": [
      {
        "type": "eq",
        "field": "properties.firstName",
        "value": "john"
      },
      {
        "type": "eq",
        "field": "properties.lastName",
        "value": "smith"
      }
    ]
  }
}
```

**Details**

Queries can be at most three levels deep.

-------

### <a name="or"></a> Or query (`or`)

**Description**

At least one of the sub-queries matches.

**Example**

```
{
  "query": {
    "type": "or",
    "value": [
      {
        "type": "eq",
        "field": "properties.firstName",
        "value": "john"
      },
      {
        "type": "eq",
        "field": "properties.firstName",
        "value": "jane"
      }
    ]
  }
}
```

**Details**

Queries can be at most three levels deep.

-------

### <a name="prefix"></a> Prefix query (`prefix`)

**Description**

The provided property contains the provided sequence of terms in order and the final term is matched as a prefix.

**Example**

```
{
  "query": {
    "type": "prefix",
    "field": "properties.notes",
    "value": "The quick bro"
  }
}
```

_The parsing of terms is subject to change._

| Example                 | Matches |
|-------------------------|---------|
| The Quick Brown Fox     | yes     |
| The Quick Brown-fox     | yes     |
| Nate the quick Bro      | yes     |
| The Quick Big Brown fox | no      |
| The Bro Quick           | no      |

**Details**

By default, terms are separated by whitespace or punctuation (`?!,:;-[](){}'"~`). Periods (`.`) on their own are ignored.

**Case-sensitive:** no<br>

-------

### <a name="phrase"></a> Phrase query (`phrase`)

**Description**

The provided property contains the provided terms in order.

**Example**

```
{
  "query": {
    "type": "phrase",
    "field": "properties.notes",
    "value": "the quick brown fox"
  }
}
```

_The parsing of terms is subject to change._

| Example                                           | Matches |
|---------------------------------------------------|---------|
| The Quick Brown Fox                               | yes     |
| The Quick Brown Fox is climbing the tree          | yes     | 
| The        Quick ------ Brown Fox                 | yes     |
| The Quick Fox Brown                               | no      |
| The Quick Brown Big Fox                           | no      |
| The Quick Brown Foxes                             | no      |
| The Brown Rabbit Met the Quick Fox Near the River | no      |

**Details**

By default, terms are separated by whitespace or punctuation (`?!,:;-[](){}'"~`). Periods (`.`) on their own are ignored.

**Case-sensitive:** no<br>

-------

### <a name="anyTerm"></a> Any Term query (`anyTerm`)

**Description**

The provided property contains at least one of the terms in any order.

**Example**

```
{
  "query": {
    "type": "anyTerm",
    "field": "properties.vehicle",
    "value": "red bike"
  }
}
```

_The parsing of terms is subject to change._

| Example          | Matches   |
|------------------|-----------|
| Red Car          | yes       |
| Car Red          | yes       |
| Red(Car          | yes       |
 | The Bike Car Red | yes       | 
| Yellow Cat       | no        |

**Details**

By default, terms are separated by whitespace or punctuation (`?!,:;-[](){}'"~`). Periods (`.`) on their own are ignored.

**Case-sensitive:** no<br>

-------

### <a name="allTerms"></a> All Terms query (`allTerms`)

**Description**

The provided property contains all the terms in any order.

**Example**

```
{
  "query": {
    "type": "allTerms",
    "field": "properties.vehicle",
    "value": "car red"
  }
}
```

_The parsing of terms is subject to change._

| Example            | Matches |
|--------------------|---------|
| Red Car Dealership | yes     |
| Car Dealership Red | yes     |
| Red-Car~Dealership | yes     |
| Red Plane          | no      |
| Yellow Cat         | no      |

**Details**

By default, terms are separated by whitespace or punctuation (`?!,:;-[](){}'"~`). Periods (`.`) on their own are ignored.

**Case-sensitive:** no<br>
