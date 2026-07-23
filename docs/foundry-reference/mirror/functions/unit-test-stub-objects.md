<!-- source: https://palantir.com/docs/foundry/functions/unit-test-stub-objects/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Create stub objects

You can create and define your mock objects using `Objects.create()`, which can be used the same way as if it was a regular function. You can then use these mock objects when writing unit tests. Here is an example:

```typescript
import { MyFunctions } from ".."

import { Objects, ExampleDataAirport } from "@foundry/ontology-api";

describe("example test suite", () => {
    const myFunctions = new MyFunctions();

    test("test created objects", () => {
        const JFK = Objects.create().exampleDataAirport("JFK Test");
        JFK.displayAirportName = "John F. Kennedy International";
        expect(myFunctions.getAirportName(JFK)).toEqual("John F. Kennedy International");
    });
});
```

For reference, the above example is using the Jest syntax [`expect(...).toEqual(...)` ↗](https://jestjs.io/docs/expect#toequalvalue).
