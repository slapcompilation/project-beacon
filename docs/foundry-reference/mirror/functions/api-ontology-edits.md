<!-- source: https://palantir.com/docs/foundry/functions/api-ontology-edits/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Ontology edits

:::callout{theme="warning"}
The following documentation is specific to TypeScript v1 functions. For the TypeScript v2 version of this page, see [Ontology edits](/docs/foundry/functions/typescript-v2-ontology-edits/). For more [robust capabilities](/docs/foundry/functions/language-feature-support/#typescript-v1-vs-typescript-v2), including support for Ontology SDK and configurable resource requests, we recommend [migrating to TypeScript v2](/docs/foundry/functions/typescript-v2-migration/).
:::

In addition to writing functions that return derived values based on the Ontology, you can also write functions that edit the properties and links between objects in the Ontology. This page documents the object edit APIs available to you in functions. For more details about how edit functions work, refer to the [overview page](/docs/foundry/functions/edits-overview/).

To actually be used in an operational context, **Ontology edit functions must be configured as an Action**, known as a [function-backed Action](/docs/foundry/action-types/function-actions-overview/). Configuring an Action in this way allows you to provide additional metadata, configure permissions, and access the Action in various operational interfaces. As noted in the [documentation](/docs/foundry/functions/edits-overview/#when-edits-are-applied), running an edit function outside of an Action will not actually modify any object data.

:::callout{theme="warning" title="Warning"}
Searching for objects after editing them may return unexpected results. See the [Caveats section](/docs/foundry/functions/edits-overview/#edits-and-object-search) for details.
:::

## Declaring an edit function

Functions that edit the Ontology must:

* Be decorated with the `@OntologyEditFunction()` decorator imported from `@foundry/functions-api`
* Be decorated with the `@Edits([object type])` decorator imported from `@foundry/functions-api` to specify the object types that will be edited
* Have an explicit `void` return type

## Updating properties

You can edit property values by simply reassigning the property value for an object. For example:

```typescript
employee.lastName = newName;
```

If you access the `lastName` property value later in the same function execution, the new value that you just set will be returned.

[Array properties](/docs/foundry/functions/api-objects-links/#array-properties) on objects are generated with the `ReadOnlyArray` type. To modify an array, create a copy of it, modify the copy, then update the property:

```typescript
// Copy to a new array
let arrayCopy = [...myObject.myArrayProperty];
// Now you can modify the copied array
arrayCopy.push(newItem);
// Then overwrite the property value
myObject.myArrayProperty = arrayCopy;
```

Note that you cannot update the primary key property value of an existing object.

## Updating links

The `SingleLink` and `MultiLink` interfaces have various methods you can use to update links:

```typescript
// Set an Employee's supervisor
employee.supervisor.set(newSupervisor);

// Clear an Employee's supervisor
employee.supervisor.clear();

// Add a new report to the given employee
employee.reports.add(newReport);

// Remove an old report associated with the given employee
employee.reports.remove(oldReport);
```

As with updating properties, accessing links after they have been updated reflects the updates you have made.

## Creating objects

You can create new objects using the `Objects.create()` interface available from `@foundry/ontology-api`. When creating a new object, you have to specify a value for its primary key.

In this example, we create a new Ticket object with the given ID, set its `dueDate` property, and assign it to the given Employee (by modifying the `assignedTickets` link).

```typescript
import { OntologyEditFunction, Edits } from "@foundry/functions-api";
import { Employee, Objects, Tickets } from "@foundry/ontology-api";

export class TicketActionFunctions {
    @Edits(Employee, Tickets)
    @OntologyEditFunction()
    public createNewTicketAndAssignToEmployee(employee: Employee, ticketId: Integer): void {
        const newTicket = Objects.create().ticket(ticketId);

        newTicket.dueDate = LocalDate.now().plusDays(7);

        employee.assignedTickets.add(newTicket);
    }
}
```

## Deleting objects

You can delete an object by calling the `.delete()` method.

In this example, we delete all the tickets assigned to the given employee.

```typescript
const tickets = employee.tickets.all();
tickets.forEach(ticket => ticket.delete());
```

## How edits are captured

When an Ontology edit function is executed, all updates to objects are captured by the functions infrastructure and returned at the end of the function execution. This includes new object creations via the `Objects.create()` API, all property updates, and object deletions.

Edits are collapsed intelligently so that the minimal set of edits are applied in an action. For example, if you create a new object and then update its properties, a single **Create Object** edit will be returned containing the property updates. Similarly, updating multiple properties of an existing object will return a single **Update Object** edit containing all of the property edits. Deleting an object will erase any other property edits that were done before the deletion. The entire function must succeed in order to generate the list of edits which is passed to the actions service executing the atomic transaction.

The captured Ontology edits are returned as a list from the function execution, which is why Ontology edit functions must have a return type of `void` or `Promise<void>`. When they are executed, the true return type of the function is a list of Ontology edits, so it is not possible to simultaneously return another value.

Edits are captured in a single edit store over the entire lifecycle of a single function execution. This means that it is possible to call into helper functions which create, update, or delete objects, even if those helper functions are not published as Ontology edit functions. For example:

```typescript
export class HelperEditFunctions {
    @Edits(ObjectA, ObjectB)
    @OntologyEditFunction()
    public createAndLink(): void {
        const objectA = this.createObjectA();
        const objectB = this.createObjectB();
        objectA.linkToB.set(objectB);
    }

    /**
     * Even though these helper functions are not annotated with @OntologyEditFunction(),
     * they can create new objects for use in other edit functions.
     */
    private createObjectA(): ObjectA {
        const objectA = Objects.create().objectA(this.generateRandomId());
        objectA.prop1 = "example";
        objectA.prop2 = 42;
        return objectA;
    }

    private createObjectB(): ObjectB {
        const objectB = Objects.create().objectB(this.generateRandomId());
        objectB.prop1 = "another example";
        return objectB;
    }

    /* Generate your primary keys as needed. For example,
    import { Uuid } from "@foundry/functions-utils";
    private generateRandomId(){
       return Uuid.random();
    }
    */
}
```

## Retrieving edited values

When edits are done in a function, the functions infrastructure will return the edited values when you read them. For example, setting a property of an object and then retrieving it will return the new value:

```
airplane.departureTime = newDepartureTime;
console.log(airplane.departureTime); // Will log newDepartureTime
```

Deleting an object will remove it from search results and prevent access to its properties.

## The @Edits decorator

Actions may require provenance information to enforce its permissions. To provide actions with this information, you can use the `@Edits` decorator and specify the object types for which your function returns edits.

Consider the following when using the `@Edits` decorator:

* When editing properties, the type of the object that was edited should be declared.
* When editing one-to-one or one-to-many links, the type of the object with the foreign key property should be declared.
* When editing join table links, both the source and target object types should be declared.

:::callout{theme="warning"}
Functions perform static analysis of your code to automatically detect referenced object types. However, static analysis *may fail* to properly detect a reference. We strongly recommend that you always use the `@Edits` decorator to provide provenance information about referenced object types.
:::

For the following example, the object types `Employee` and `Aircraft` are edited by a function:

```typescript
import { OntologyEditFunction } from "@foundry/functions-api";
import { Employee, Aircraft, Objects } from "@foundry/ontology-api";

export class MyOntologyEditFunction {
    @Edits(Aircraft, Employee)
    @OntologyEditFunction()
    public myFunction(): void {
        const x = Objects.search().aircraft().all()[0];
        x.businessCapacity = 3;
        const y = Objects.search().employee().all()[0];
        y.department = "HR";
    }
}
```

If you retrieve (or materialize) a previously edited object through the `Objects.search()` API using an identifier that the edit did not change, such as its primary key, the edited value will be returned. This is because the functions infrastructure applies your pending edits to the object when it is materialized. This differs from filtering, searching around, or aggregating on the value you edited, which will not reflect the edit until your function finishes executing. See [Edits and object search](/docs/foundry/functions/edits-overview/#edits-and-object-search) for details.

```typescript
import { OntologyEditFunction } from "@foundry/functions-api";
import { Employee, Objects } from "@foundry/ontology-api";

export class CaveatEditFunctions {
    @Edits(Employee)
    @OntologyEditFunction()
    public async editAndSearch(): Promise<void> {
        const employeeOne = Objects.search().employee().filter(e => e.id.exactMatch(1)).all()[0];
        employeeOne.name = "Bob";

        // Retrieve the already edited object
        const employeeOneAgain = Objects.search().employee().filter(e => e.id.exactMatch(1)).all()[0];
        console.log(employeeOneAgain.name); // Prints "Bob"
    }
}
```
