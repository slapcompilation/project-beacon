<!-- source: https://palantir.com/docs/foundry/vertex/derive-property-functions/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Derive properties using Functions

[Functions](/docs/foundry/functions/overview/) can be used to create **derived properties** on objects. These can be displayed in the object view, shown in extended node labels and used to color nodes in the layer styling options.

Any function that meets the following criteria can be used as a **derived property**:

* The method is exported as a function (using the `@Function()` decorator in TypeScript v1, or `export default` in TypeScript v2).
* The method is `public`.
* The method returns a map from objects to values (`FunctionsMap<ObjectType, CustomType>` in TypeScript v1, or `Record<ObjectSpecifier<ObjectType>, CustomType>` in TypeScript v2).
* All keys in the map are objects.
* All values in the map are primitives or a custom type with primitives for each field.
* The method has been tagged for release.
* The method operates on object sets (`ExampleDataRoute[]` or `ObjectSet<ExampleDataRoute>`, for example) and not a single object (such as `ExampleDataRoute`). This ensures the function is not called for every object on the graph individually, which can be cause very slow performance for large graphs.
* The method has no other inputs besides the object set.

For example:

```typescript tab="TypeScript v1"
import { Function, FunctionsMap, Double } from "@foundry/functions-api";
import { ExampleDataRoute } from "@foundry/ontology-api";

export class VertexDerivedPropertyFunctions {
    @Function()
    public async flightCancellationPercentage(
        routes: ExampleDataRoute[],
    ): Promise<FunctionsMap<ExampleDataRoute, Double>> {
        const routeMap = new FunctionsMap<ExampleDataRoute, Double>();

        const allFlights = await Promise.all(
            routes.map((route) => route.flights.allAsync()),
        );

        for (let i = 0; i < routes.length; i++) {
            const route = routes[i];
            const flights = allFlights[i];
            const cancelledFlights = flights.filter(
                (flight) => flight.cancelled,
            );
            const cancellationPercentage =
                (cancelledFlights.length / flights.length) * 100;
            routeMap.set(route, cancellationPercentage);
        }

        return routeMap;
    }
}
```

```typescript tab="TypeScript v2"
import { ObjectSet, ObjectSpecifier } from "@osdk/client";
import { Double } from "@osdk/functions";
import { ExampleDataRoute } from "@ontology/sdk";

export default async function flightCancellationPercentage(
    routes: ObjectSet<ExampleDataRoute>,
): Promise<Record<ObjectSpecifier<ExampleDataRoute>, Double>> {
    const routeMap: Record<ObjectSpecifier<ExampleDataRoute>, Double> = {};

    for await (const route of routes.asyncIter()) {
        const flights = await Array.fromAsync(route.$link.flights.asyncIter());
        const cancelledFlights = flights.filter((flight) => flight.cancelled);
        const cancellationPercentage =
            (cancelledFlights.length / flights.length) * 100;
        routeMap[route.$objectSpecifier] = cancellationPercentage;
    }

    return routeMap;
}
```
