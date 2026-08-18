<!-- source: https://palantir.com/docs/foundry/functions/unit-test-object-searches/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Stub object searches and aggregations

When writing unit tests you may want to create canned answers (also called "stubs") for object sets searches or object aggregations to dictate the responses to the calls your code is making when writing unit tests. You need to import `{ whenObjectSet }` from `"@foundry/functions-testing-lib"` to use stubs.

#### Testing filters on object sets

```typescript
import { Objects } from "@foundry/ontology-api";

const objectSet = Objects.search().objectType();

expect(myFunctions.filterObjectSet(objectSet))
        .toEqual(objectSet.filter(s => s.prop.range().gte(0)))
```

#### Testing aggregations on an object property using stubs

You can define the response to aggregation calls using stubs.

```typescript
import { whenObjectSet } from "@foundry/functions-testing-lib"

whenObjectSet(Objects.search().objectType().sum(s => s.property)).thenReturn(55);
```

This means that whenever `Objects.search().objectType().sum(s => s.property))` is run, the result will be 55.

#### Testing objects using stubs

You can also define the response to certain object searches using stubs.

```typescript
import { whenObjectSet } from "@foundry/functions-testing-lib";

whenObjectSet(Objects.search().objectType().orderBy().takeAsync(10)).thenReturn([employeeObj])
await expect(myFunctions.aggregateSum(objectSet)).resolves.toEqual(65);
```

This means that whenever this particular objects search aggregation is run, the property sum will resolve to 65.

#### Testing different object sets using stubs

You can mock multiple specific object set searches by overloading the search constructor. You must give each object a `rid` property.

```typescript
import { whenObjectSet } from "@foundry/functions-testing-lib";

const objA = Objects.create().objectType('a');
const objB = Objects.create().objectType('b');

objA.rid = 'ridA';
objB.rid = 'ridB';

whenObjectSet(Objects.search().ObjType([objA]).all()).thenReturn([objA]);
whenObjectSet(Objects.search().ObjType([objB, objB]).all()).thenReturn([objA, objB]);
```
