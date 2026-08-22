<!-- source: https://palantir.com/docs/foundry/ontology-sdk/typescript-subscriptions/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Subscribe to changes in object sets with the TypeScript OSDK

:::callout{theme="warning" title="GA"}
Subscriptions were released as part of OSDK v2.1; to access this feature, open Developer Console and generate a `2.1.x` (or later) version of your SDK. <br><br>
Before using subscriptions, ensure that you have installed a matching 2.1.x version of the `@osdk/client` package in your project by using the command below or updating your `package.json`.

```bash
npm install @osdk/client@^2.1.0
```
:::

This page provides documentation on how to receive real time updates about changes to objects in your Ontology using the TypeScript OSDK.

## Overview

The subscriptions feature in the TypeScript OSDK allows you to receive updates when objects in a specified object set are changed. This includes the addition and deletion of new objects, as well as changes to properties on objects in the object set.

The examples in the following sections use a `Country` object type with a `@subscribe-osdk-example/sdk` package name. Replace the example package name and object type with the package you created, and the object type you selected, respectively. Lastly, replace references to `population` with a property from your object type.

Note that object sets constructed using `.pivotTo` are not supported for subscriptions. Additionally, only one subscription may be active per query at a time. For example, if you are building an OSDK application and using TSv2 to subscribe to object set changes, two React components cannot simultaneously be listening on separate subscriptions for changes in the same object set.

## `.subscribe`

To subscribe to an object set, chain `.subscribe` onto an OSDK object set. The `.subscribe` function accepts a multitude of functions that will be triggered for different events during the lifecycle of the subscription. These functions can contain any logic you want to execute for the given event.

The subscribe function returns an object containing a function to end the subscription.

```typescript
import { Country } from "@subscribe-osdk-example/sdk";

const subscription = client(Country).subscribe(
    {
        onChange: (update) => {},
        onSuccessfulSubscription: () => {},
        onOutOfDate: () => {},
        onError: () => {},
    },
    { properties: [] },
);

subscription.unsubscribe();
```

Additionally, it is possible to filter the object set that is subscribed to. This will narrow the set of objects you will receive updates for.

```typescript
client(Country)
    .where({ population: { $gte: "1000000" } })
    .subscribe({});
```

Object sets that are constructed using `.pivotTo` are not supported for subscriptions.

### `onChange`

The onChange handler is triggered when an object in the specified object set has been added, changed, or deleted.

The handler function provides an object that consists of two properties:

* **Object:** An `Osdk.Instance` object and an enum describing what happened to the provided object. This is identical to the object type returned from a `.fetchPage` method on an object set.
* **State:** An enum describing what happened to the provided object.
  * **`ADDED_OR_UPDATED`:** The provided object was added to the object set or a property has changed on the provided object.
  * **`DELETED`:** The provided object was deleted.

Below is an example of `onChange` handler usage:

```typescript
const populations: { [key: string]: number } = {};

client(Country).subscribe({
    onChange: (update) => {
        if (update.state === "ADDED_OR_UPDATED") {
            populations[update.object.$primaryKey] =
                update.object.population ??
                populations[update.object.$primaryKey];
        } else if (update.state === "DELETED") {
            delete populations[update.object.$primaryKey];
        }
    },
});
```

#### Property nullability

Properties on the `Osdk.Instance` object provided to the handler represent the most up to date values for that object. The primary key property and the `$primaryKey` field on the object will always be defined.

It is possible for any property on the `Osdk.Instance` object to be undefined. This does not necessarily indicate that the property was updated to be undefined, but rather
that the property simply was not returned.

If more properties have been added to an object type since the SDK was last generated, it is possible to receive updates even though none of the properties on the provided value have changed. This indicates that a property that your SDK is not aware of has changed on the object.

#### Geotemporal series reference updates

If a subscription is requested for an object type with a geotemporal series reference property, updates will be triggered when there is a new value for that series. This value will be available on the `lastFetchedValue` property on the returned object.

### `onSuccessfulSubscription`

This handler is executed when the OSDK establishes a successful subscription and will start receiving updates. Updates before this handler is triggered may not be reflected in calls to other handlers.

### `onOutOfDate`

This handler is executed when up to date information could not be provided for updates that occurred to the object set. This indicates that you should reload the entire object set with a call to `.fetchPage` in order to make sure you receive the most up to date information.

### `onError`

This handler is executed when there has been an error in the subscription process, indicating that the subscription has been closed.

### Specify properties

The `.subscribe` method allows specifying which properties to receive on objects returned from updates. This can improve performance by reducing the amount of information sent over a network connection. To specify these, pass in an array of the properties you want as part of the second parameter on the method.

```typescript
client(Country).subscribe({}, { properties: ["population"] });
```
