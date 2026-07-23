<!-- source: https://palantir.com/docs/foundry/functions/unit-test-ontology-edits/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Verify Ontology edits

You can use the `verifyOntologyEditFunction()` API to verify edits performed by your function. You need to import it from `"@foundry/functions-testing-lib"`. This allows you to create unit tests around the workflows listed below.

#### Verify object creation

You can use the `.createsObjects` method to verify an object creation. Here's an example:

```typescript
import { MyFunctions } from ".."

import { Objects , ExampleDataAirport } from "@foundry/ontology-api";
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";

describe("example test suite", () => {
    const myFunctions = new MyFunctions();

    test("create airport", () => { 
        verifyOntologyEditFunction(() => myFunctions.createAirport("airportCode", "airportDisplayName"))
            .createsObject(
                {
                    objectType: ExampleDataAirport,
                    properties: {
                        airport: "airportCode",
                        displayAirportName: "airportDisplayName",
                    },
                });
    });
});
```

This can be used to test the following function:

```typescript
import { Function, OntologyEditFunction, Edits } from "@foundry/functions-api";
import { Objects, ExampleDataAirport } from "@foundry/ontology-api";

export class MyFunctions {

    @Edits(ExampleDataAirport)
    @OntologyEditFunction()
    public createAirport(airport: string, displayName: string): void {
        const newAirport = Objects.create().exampleDataAirport(airport);
        newAirport.displayAirportName = displayName;
    }
}
```

#### Verify edits on a newly created object

You can verify edits that are created involving a newly created object. For example, you may want to create a new `ExampleDataFlight` objects and verify that the link is created to the `new-flight-delay-0`. Here's an example:

```typescript
import { MyFunctions } from ".."

import { Objects , ExampleDataFlight, ExampleFlightDelayEvent } from "@foundry/ontology-api";
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";

describe("example test suite", () => {
    const myFunctions = new MyFunctions();

    test("single key with single created object", () => {
            const flight = Objects.create().exampleDataFlight("flightTest");
            verifyOntologyEditFunction(() => myFunctions.createAndLinkDelays(flight, 1))
                .createsObject({
                    objectType: ExampleFlightDelayEvent,
                    properties: {
                        eventId: "new-flight-delay-0",
                    },
                })
                .addsLink(edits => ({
                    link: flight.flightDelayEvent,
                    linkedObject: edits.createdObjects.byObjectType(ExampleFlightDelayEvent)[0],
                }))
        });
});
```

This can be used to test the following function:

```typescript
import { Function, Integer, OntologyEditFunction, Edits } from "@foundry/functions-api";
import { Objects, ExampleDataFlight, ExampleFlightDelayEvent } from "@foundry/ontology-api";

export class MyFunctions {

    @Edits(ExampleDataFlight, ExampleFlightDelayEvent )
    @OntologyEditFunction()
    public createAndLinkDelays(flight: ExampleDataFlight, numDelay: Integer): void {
        for (let n = 0; n < numDelay; n++) {
            const delay = Objects.create().exampleFlightDelayEvent(`new-flight-delay-${n}`);
            flight.flightDelayEvent.add(delay);
        }
    }
}
```

#### Verify object property edits

You can verify edits to the property using `.modifiesObjects`. Here's an example:

```typescript
import { MyFunctions } from ".."

import { Objects , ExampleDataFlight, ExampleFlightDelayEvent } from "@foundry/ontology-api";
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";

describe("example test suite", () => {
    const myFunctions = new MyFunctions();

    test("modifies aircraft of the flight", () => {
        const flight = Objects.create().exampleDataFlight("NY -> LA");
        const oldAircraft = Objects.create().exampleDataAircraft("N11111");
        flight.aircraft.set(oldAircraft);
        const newAircraft = Objects.create().exampleDataAircraft("A00000");
        verifyOntologyEditFunction(() => myFunctions.assignAircraftToFlight(flight, newAircraft))
            .modifiesObject(
                { 
                    object: flight, 
                    properties: { 
                        tailNumber: "A00000" 
                    } 
                })
        });
});
```

This can be used to test the following function:

```typescript
import { Function, OntologyEditFunction, Edits } from "@foundry/functions-api";
import { Objects, ExampleDataFlight, ExampleFlightDelayEvent } from "@foundry/ontology-api";

export class MyFunctions {

    @Edits(ExampleDataFlight)
    @OntologyEditFunction()
    public assignAircraftToFlight(flight: ExampleDataFlight, aircraft: ExampleDataAircraft): void {
        flight.aircraft.clear();
        aircraft.flight.set(flight);
        flight.tailNumber = aircraft.tailNumber;
    }
}
```

#### Verify no other edits to an object

You can ensure there are no other edits using the optional `.hasNoMoreEdits()`. This means that only the specified edits are allowed, and the verification will fail if other edits are detected. Here's an example:

```typescript
import { MyFunctions } from ".."

import { Objects , ExampleDataFlight, ExampleFlightDelayEvent } from "@foundry/ontology-api";
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";

describe("example test suite", () => {
    const myFunctions = new MyFunctions();

    test("single key with linked object", () => {
            const flight = Objects.create().exampleDataFlight("flightAnotherTest");
            const delay = Objects.create().exampleFlightDelayEvent("new-flight-delay")
            verifyOntologyEditFunction(() => myFunctions.linkDelays(flight, delay))
                .addsLink({link: flight.flightDelayEvent, linkedObject: delay })
                .hasNoMoreEdits();
        });
});
```

When using `.hasNoMoreEdits()`, you can ignore specific kinds of edits that take place. You do this by passing an object with some or all of the following:

* `ignoreExtraCreatedObjects: true`
* `ignoreExtraModifiedObjects: true`
* `ignoreExtraDeletedObjects: true`
* `ignoreExtraLinkedObjects: true`
* `ignoreExtraUnlinkedObjects: true`

#### Verify link creation to an object

You can verify link creation on an object using `.addsLink`. Here's an example:

```typescript
import { MyFunctions } from ".."

import { Objects , ExampleDataFlight, ExampleFlightDelayEvent } from "@foundry/ontology-api";
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";

describe("example test suite", () => {
    const myFunctions = new MyFunctions();

    test("single key with linked object", () => {
            const flight = Objects.create().exampleDataFlight("flightAnotherTest");
            const delay = Objects.create().exampleFlightDelayEvent("new-flight-delay")
            verifyOntologyEditFunction(() => myFunctions.linkDelays(flight, delay))
                .addsLink({link: flight.flightDelayEvent, linkedObject: delay })
                .hasNoMoreEdits();
        });
});
```

This test is equivalent to testing for the same link going in the opposite direction:

```typescript
import { MyFunctions } from ".."

import { Objects , ExampleDataFlight, ExampleFlightDelayEvent } from "@foundry/ontology-api";
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";

describe("example test suite", () => {
    const myFunctions = new MyFunctions();

    test("single key with linked object reverse", () => {
            const flight = Objects.create().exampleDataFlight("flightAnotherTest");
            const delay = Objects.create().exampleFlightDelayEvent("new-flight-delay")
            verifyOntologyEditFunction(() => myFunctions.linkDelays(flight, delay))
                .addsLink({link: delay.flight, linkedObject: flight })
                .hasNoMoreEdits();
        });
});
```

This can be used to test the following function:

```typescript
import { Function, OntologyEditFunction, Edits } from "@foundry/functions-api";
import { Objects, ExampleDataFlight, ExampleFlightDelayEvent } from "@foundry/ontology-api";

export class MyFunctions {

    @Edits(ExampleDataFlight, ExampleFlightDelayEvent )
    @OntologyEditFunction()
    public linkDelays(flight: ExampleDataFlight, delay: ExampleFlightDelayEvent): void {
        flight.flightDelayEvent.add(delay);
    }
}
```

#### Verify link removal from an object

You can verify link removal from an object using `.removesLink`. Here's an example:

```typescript
import { MyFunctions } from ".."

import { Objects , ExampleDataFlight, ExampleFlightDelayEvent } from "@foundry/ontology-api";
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";

describe("example test suite", () => {
    const myFunctions = new MyFunctions();

    test("test link removal", () => {
            const flight = Objects.create().exampleDataFlight("flightAnotherTest");
            const delay = Objects.create().exampleFlightDelayEvent("new-flight-delay")
            flight.flightDelayEvent.add(delay);
            verifyOntologyEditFunction(() => myFunctions.removeAllDelays(flight))
                .removesLink({link: flight.flightDelayEvent, unlinkedObject: delay })
                .hasNoMoreEdits();
        });
});
```

This can be used to test the following function:

```typescript
import { Function, OntologyEditFunction, Edits } from "@foundry/functions-api";
import { Objects, ExampleDataFlight, ExampleFlightDelayEvent } from "@foundry/ontology-api";

export class MyFunctions {

    @Edits(ExampleDataFlight, ExampleFlightDelayEvent)
    @OntologyEditFunction()
    public removeAllDelays(flight: ExampleDataFlight): void {
        flight.flightDelayEvent.clear();
    }
}
```

#### Verify deleting an object

You can verify deleting an object using `.deletesObject`. Here's an example:

```typescript
import { MyFunctions } from ".."

import { Objects , ExampleDataFlight } from "@foundry/ontology-api";
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";

describe("example test suite", () => {
    const myFunctions = new MyFunctions();

    test("test object deletion", () => {
            const flight = Objects.create().exampleDataFlight("flightAnotherTest");
            verifyOntologyEditFunction(() => myFunctions.deleteFlight(flight))
                .deletesObject(flight)
                .hasNoMoreEdits();
        });
});
```

This can be used to test the following function:

```typescript
import { Function, OntologyEditFunction, Edits } from "@foundry/functions-api";
import { Objects, ExampleDataFlight } from "@foundry/ontology-api";

export class MyFunctions {

    @Edits(ExampleDataFlight)
    @OntologyEditFunction()
    public deleteFlight(flight: ExampleDataFlight): void {
        flight.delete();
    }
}
```

#### Verify multiple objects were created

You can use the `.createsObjects` method and pass in a list to create multiple objects to test on. Here's an example:

```typescript
import { MyFunctions } from ".."

import { Objects , ExampleDataFlight, ExampleFlightDelayEvent } from "@foundry/ontology-api";
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";

describe("example test suite", () => {
    const myFunctions = new MyFunctions();

    test("single key with many created objects", () => {
            const flight = Objects.create().exampleDataFlight("flightTest");
            verifyOntologyEditFunction(() => myFunctions.createAndLinkDelays(flight, 3))
                .createsObjects(
                    [0, 1, 2].map(i => ({
                        objectType: ExampleFlightDelayEvent,
                        properties: {
                            eventId: "new-flight-delay-" + i,
                        },
                    })),
                )
                .addsLinks(edits =>
                    edits.createdObjects.byObjectType(ExampleFlightDelayEvent).map(event => ({
                        link: flight.flightDelayEvent,
                        linkedObject: event,
                    })),
                )
                .hasNoMoreEdits();
        });
});
```

This can be used to test the following function:

```typescript
import { Function, Integer, OntologyEditFunction, Edits } from "@foundry/functions-api";
import { Objects, ExampleDataFlight, ExampleFlightDelayEvent } from "@foundry/ontology-api";

export class MyFunctions {

    @Edits(ExampleDataFlight, ExampleFlightDelayEvent )
    @OntologyEditFunction()
    public createAndLinkDelays(flight: ExampleDataFlight, numDelay: Integer): void {
        for (let n = 0; n < numDelay; n++) {
            const delay = Objects.create().exampleFlightDelayEvent(`new-flight-delay-${n}`);
            flight.flightDelayEvent.add(delay);
        }
    }
}
```

### Asynchronous ontology edits

You can verify asynchronous ontology edits as follows:

```typescript
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";

test("test async edit function", async () => {
        const obj = Objects.create().objectWithAllPropertyTypes(1);
        (await verifyOntologyEditFunction(() => myFunctions.setDateAndTimestampToNow(obj))).modifiesObject({
            object: obj,
            properties: {
                timestampProperty: makeTimestamp(),
            },
        });
    });
```

### Multiple verifications

As we have seen in the examples above, we can chain verifications. The following pattern illustrates this:

```typescript
import { verifyOntologyEditFunction } from "@foundry/functions-testing-lib";
import { Objects, ExampleDataObject } from "@foundry/ontology-api";

test("multiple action edit", () => { 
    verifyOntologyEditFunction(() => myFunctions.multistageEdits("objectId", "objectName"))
        .createsObject({...})
        .modifiesObjects({...})
        .addsLinks({...})
        .removesLinks({...})
        .deletesObject(...)
        .hasNoMoreEdits(); 
});
```
