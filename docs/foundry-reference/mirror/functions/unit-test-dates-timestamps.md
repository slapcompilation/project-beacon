<!-- source: https://palantir.com/docs/foundry/functions/unit-test-dates-timestamps/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Mock dates, timestamps, and UUIDs

You can specify the output of non-deterministic functions by utilizing `jest.spyOn()` to inject a mock to run the test.

### UUID functions

You can specify the output of `Uuid` by injecting a mock. Here is an example:

```typescript
import { MyFunctions } from ".."

import { Objects, ExampleDataFlight } from "@foundry/ontology-api";
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";
import { Uuid } from "@foundry/functions-utils";

describe("example test suite", () => {
    const myFunctions = new MyFunctions();

    test("creates new flight", () => {
        const makeUuid = () => "my-uuid";
        jest.spyOn(Uuid, "random").mockImplementation(() => makeUuid());

        verifyOntologyEditFunction(() => myFunctions.createNewFlight())
            .createsObject({
                objectType: ExampleDataFlight,
                properties: {
                    flightId: makeUuid()
                }
            })
    })
});
```

This can be used to test the following function:

```typescript
import { Function, OntologyEditFunction, Edits } from "@foundry/functions-api";
import { Objects, ExampleDataFlight } from "@foundry/ontology-api";
import { Uuid } from "@foundry/functions-utils";

export class MyFunctions {
    @Edits(ExampleDataFlight)
    @OntologyEditFunction()
    public createNewFlight(): void {
        Objects.create().exampleDataFlight(Uuid.random());
    }
}
```

#### Advanced UUID functions

There are certain circumstances where you may want full control over the output of the `Uuid`. This requires you to adjust the code of the function you are testing. For example, the `createNewFlight` function above is wrapped in a class `MyFunctions` and you can add a constructor to the class that takes a supplier with a default value. The updated function with the supplier looks like this:

```typescript
import { Function, OntologyEditFunction, Edits } from "@foundry/functions-api";
import { Objects, ExampleDataFlight } from "@foundry/ontology-api";
import { Uuid } from "@foundry/functions-utils";

export class MyFunctions {
    constructor (private UuidSupplier: () => string = Uuid.random){} // this new constructor in the class takes a supplier

    @Edits(ExampleDataFlight)
    @OntologyEditFunction()
    public createNewFlightWithConstructor(): void {
        Objects.create().exampleDataFlight(this.UuidSupplier());
    }
}
```

This updated function can be tested with full control of the output (in this case we set the generated `Uuid` to be `my-other-uuid`):

```typescript
import { MyFunctions } from ".."

import { Objects , ExampleDataFlight } from "@foundry/ontology-api";
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";
import { Uuid } from "@foundry/functions-utils";

describe("example test suite", () => {
    const myFunctions = new MyFunctions();

    test("creates new flight with supplier", () => {
        const myNewFunctions = new MyFunctions(() => "my-other-uuid");

        verifyOntologyEditFunction(() => myNewFunctions.createNewFlightWithConstructor())
            .createsObject({
                objectType: ExampleDataFlight,
                properties: {
                    flightId: "my-other-uuid"
                }
            })

    })
});
```

### Timestamp.now() functions

You can specify the output of `Timestamp.now()` by injecting a mock. Here is an example:

```typescript
import { MyFunctions } from ".."

import { Objects , ExampleDataFlight } from "@foundry/ontology-api";
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";
import { Timestamp } from "@foundry/functions-api";

describe("example test suite", () => {
    const myFunctions = new MyFunctions();

    test("test timestamp now", () => {
        const makeTimestamp = () => Timestamp.fromISOString("2018-06-13T12:11:13+05:00");
        jest.spyOn(Timestamp, "now").mockImplementation(() => makeTimestamp());

        const flight = Objects.create().exampleDataFlight("flightAnotherTest");
        verifyOntologyEditFunction(() => myFunctions.startTakeoff(flight))
            .modifiesObject({
                object: flight,
                properties: {
                    takeoff: makeTimestamp()
                }
            })
    })
});
```

This can be used to test the following function:

```typescript
import { Function, OntologyEditFunction, Edits, Timestamp } from "@foundry/functions-api";
import { Objects, ExampleDataFlight } from "@foundry/ontology-api";

export class MyFunctions {
    @Edits(ExampleDataFlight)
    @OntologyEditFunction()
    public startTakeoff(flight: ExampleDataFlight): void {
        flight.takeoff = Timestamp.now();
    }
}
```

### LocalDate.now() functions

You can specify the output of `LocalDate.now()` by injecting a mock. Here is an example:

```typescript
import { MyFunctions } from ".."

import { Objects , ExampleDataFlight } from "@foundry/ontology-api";
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";
import { LocalDate } from "@foundry/functions-api";

describe("example test suite", () => {
    const myFunctions = new MyFunctions();

    test("test LocalDate now", () => {
        const makeLocalDate = () => LocalDate.fromISOString("2018-06-13");
        jest.spyOn(LocalDate, "now").mockImplementation(() => makeLocalDate());

        const flight = Objects.create().exampleDataFlight("flightTest");
        verifyOntologyEditFunction(() => myFunctions.dateTakeoff(flight))
            .modifiesObject({
                object: flight,
                properties: {
                    date: makeLocalDate()
                }
            })
    })
});
```

This can be used to test the following function:

```typescript
import { Function, OntologyEditFunction, Edits, LocalDate } from "@foundry/functions-api";
import { Objects, ExampleDataFlight } from "@foundry/ontology-api";

export class MyFunctions {
    @Edits(ExampleDataFlight)
    @OntologyEditFunction()
    public dateTakeoff(flight: ExampleDataFlight): void {
        flight.date = LocalDate.now();
    }
}
```
