<!-- source: https://palantir.com/docs/foundry/functions/typescript-v2-staged-writes/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Staged writes \[Beta]

:::callout{theme="neutral" title="Beta"}
Staged writes are in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development. Contact Palantir Support to request access.

Live preview and published function preview are only supported in Code Repositories, not in local development or VS Code workspace environments.
:::

Staged writes provide an additional execution model for functions that edit objects in the Ontology. Unlike edits made via regular [Ontology edit functions](/docs/foundry/functions/typescript-v2-ontology-edits/), staged-write functions:

* Provide a read-after-write guarantee for Ontology edits applied in the function. All edits applied within the function are staged and will be reflected in Ontology queries and aggregations later in the function.
* Allow nested calls to other staged-write functions making Ontology edits.

This page shows how to write staged-write functions and documents their unique properties. For more details about how edit functions work, refer to the [overview page](/docs/foundry/functions/edits-overview/).

## Key differences from regular Ontology edit functions

Staged-write functions differ from regular edit functions in several important ways.

### Read-after-write guarantee

Within a staged-write function, any Ontology data read will reflect all edits previously made in the function (and all edits made in a calling staged-write function within the same action execution). Such edits are staged only and are not visible in queries made by other users or through functions outside the context of the execution. This allows you to query the Ontology from within the function using search requests and aggregations with all staged edits being reflected in the result of the query.

### No requirement to return edits at the end of the function

Regular Python and TypeScript V2 Ontology edit functions require returning a batch of Ontology edits as the return value of the function for those edits to be applied. In staged-write functions, the Ontology edits are automatically staged and will be applied to the Ontology at the end of the function execution when the action completes. This frees up the return value of the function to return other information to the caller.

For example, you can apply an action that executes a TypeScript V2 staged-write function which then makes some edits and further calls an AIP Logic function. Queries made by the AIP Logic function will return the Ontology changes made in the TypeScript V2 function; any additional edits made by the AIP Logic function will join the same staged edits without a need to return them as part of the Logic function. All staged edits will be applied automatically once the action completes.

### Atomic execution

All operations within a staged-write function, including queries, function calls, and AIP Logic executions, stage their edits together. Those staged edits are committed (that is, applied to the Ontology) after the function completes successfully. If the function throws an error, the Ontology remains unmodified and all staged edits are discarded before the function is retried by the action.

### `WriteableClient`

Staged-write functions use a `WriteableClient` instead of the standard `Client`. The `WriteableClient` provides direct methods for creating, updating, and deleting objects without needing to construct an edit batch.

## Define a staged-write function

Staged-write functions must explicitly declare the entities that will be edited using the `Edits` type exported from the `@osdk/functions` package. The first parameter must be a `WriteableClient<T>` where `T` is the union of all edit types the function will perform. The return value is no longer constrained to be an array of edits so you can return any value. The following example declares a function that will edit the `Employee` object type:

```typescript
import { Employee } from "@ontology/sdk";
import { Edits, Integer } from "@osdk/functions";
import { WriteableClient } from "@osdk/functions/experimental";

type OntologyEdit = Edits.Object<Employee>;

export default async function assignTicket(
    client: WriteableClient<OntologyEdit>,
    employeeId: string,
    ticketId: string
): Promise<Integer> {
    // ...
}
```

## Create objects

Use the `create` method on the `WriteableClient` to create new objects. You must specify the object type and provide a value for the primary key, along with any other properties you want to initialize.

```typescript
import { Employee } from "@ontology/sdk";
import { Edits } from "@osdk/functions";
import { WriteableClient } from "@osdk/functions/experimental";

type OntologyEdit = Edits.Object<Employee>;

async function createEmployee(
    client: WriteableClient<OntologyEdit>,
    employeeId: string,
    firstName: string,
    lastName: string
): Promise<Integer> {
    await client.create(Employee, {
        employeeId: employeeId,
        firstName: firstName,
        lastName: lastName
    });

    return employeeId;
}

export default createEmployee;
```

### Creating with generated IDs

When you need to generate an ID and then use it immediately:

```typescript
import { Ticket } from "@ontology/sdk";
import { Edits, Integer } from "@osdk/functions";
import { WriteableClient } from "@osdk/functions/experimental";
import { randomUUID } from "crypto";

type OntologyEdit = Edits.Object<Ticket>;

async function createTicket(
    client: WriteableClient<OntologyEdit>,
    title: string
): Promise<string> {
    const ticketId = randomUUID();

    await client.create(Ticket, {
        ticketId: ticketId,
        title: title,
        status: "open"
    });

    return ticketId;
}

export default createTicket;
```

## Update objects

### Object properties

Use the `update` method on the `WriteableClient` to modify object properties:

```typescript
await client.update(employee, { lastName: newName });
```

You can also update an object by referencing its API name and primary key:

```typescript
await client.update({ $apiName: "Employee", $primaryKey: 23 }, { lastName: newName });
```

Interface edits are not supported in staged-write functions.

## Delete objects

You can delete an object by calling the `delete` method on the `WriteableClient`:

```typescript
await client.delete(ticket);
```

Objects may also be deleted using a primary key instead of an instance:

```typescript
await client.delete({ $apiName: "Ticket", $primaryKey: 12 });
```

## Create or delete links

Use the `link` and `unlink` methods on the `WriteableClient` to add or remove many to many links between objects:

```typescript
// Assign a ticket to an employee
await client.link(employee, "assignedTickets", ticket);

// Unassign a ticket from an employee
await client.unlink(employee, "assignedTickets", ticket);
```

You can also reference either side of the link with an API name and primary key:

```typescript
await client.link(
    { $apiName: "Employee", $primaryKey: 23 },
    "assignedTickets",
    { $apiName: "Ticket", $primaryKey: 12 }
);
```

To edit one to many links, edit the foreign key property using a create or update object edit.

## Read-after-write within a staged-write function

One of the key advantages of staged-write functions is the ability to read data that was just written in the same execution. This is useful for implementing workflows that require immediate consistency.

```typescript
import { Employee, Ticket } from "@ontology/sdk";
import { Edits, Integer } from "@osdk/functions";
import { WriteableClient } from "@osdk/functions/experimental";
import { randomUUID } from "crypto";

type OntologyEdit = Edits.Object<Ticket> | Edits.Link<Employee, "assignedTickets">;

async function assignTicketAndCheckWorkload(
    client: WriteableClient<OntologyEdit>,
    employeeId: Integer,
    title: string
): Promise<{ ticketId: string, totalAssignedTickets: number }> {
    const ticketId = randomUUID();

    // Create the ticket
    await client.create(Ticket, {
        ticketId: ticketId,
        title: title,
        status: "open"
    });

    // Assign the ticket to the employee
    await client.link(
        { $apiName: "Employee", $primaryKey: employeeId },
        "assignedTickets",
        { $apiName: "Ticket", $primaryKey: ticketId }
    );

    // Query the employee's total workload including the newly assigned ticket.
    // This works because of the read-after-write guarantee.
    const result = await client(Ticket).aggregate((tickets) =>
        tickets
            .where(ticket => ticket.assignedTo.employeeId.exactMatch(employeeId))
            .where(ticket => ticket.status.exactMatch("open"))
            .count()
    );

    return {
        ticketId: ticketId,
        totalAssignedTickets: result
    };
}

export default assignTicketAndCheckWorkload;
```

## Calling other functions from a staged-write function

When you invoke another function or query from within a staged-write function, those operations participate in the same staged edits. Any reads will reflect edits previously staged in the execution, and any edits the called function makes are added to the same staged edits. This applies to:

* Other TypeScript staged-write functions
* AIP Logic functions
* Ontology queries

If the top-level function completes successfully, every edit staged across the nested calls is committed together. If any call throws, the entire batch is rolled back.

In the example below, `assignTicket` is a separate staged-write function published from the same repository. `bulkAssignTickets` calls it via the OSDK-generated `$Queries` import; each invocation adds its edits to the same staged edits.

```typescript
import { Employee, Ticket, $Queries } from "@ontology/sdk";
import { Edits, Integer } from "@osdk/functions";
import { WriteableClient } from "@osdk/functions/experimental";

type OntologyEdit = Edits.Object<Ticket> | Edits.Link<Employee, "assignedTickets">;

async function bulkAssignTickets(
    client: WriteableClient<OntologyEdit>,
    employeeId: Integer,
    ticketIds: string[]
): Promise<Integer> {
    let assignedCount = 0;

    for (const ticketId of ticketIds) {
        // Each call to `assignTicket` stages its edits alongside those of
        // the calling function.
        await client($Queries.assignTicket).executeFunction({
            employeeId: employeeId,
            ticketId: ticketId,
        });

        assignedCount++;
    }

    // All staged edits across the nested calls will be committed together
    // when the top-level function completes.
    return assignedCount;
}

export default bulkAssignTickets;
```

## Execution lifecycle

Understanding when staged edits are committed is important for building reliable functions:

1. **Function execution:** All operations (creates, updates, deletes, reads, nested function calls) are staged to the Ontology. They are visible to the function itself and all nested functions but do not appear outside of the current execution until committed.
2. **Commit:** If the function completes successfully, all staged edits are committed before the action finishes.
3. **Rollback on error:** If the function throws an error, the Ontology remains unmodified and all staged edits are discarded. The function is then retried by the action.

```typescript
import { Employee } from "@ontology/sdk";
import { Edits, Integer } from "@osdk/functions";
import { WriteableClient } from "@osdk/functions/experimental";

async function updateEmployeeWithValidation(
    client: WriteableClient<Edits.Object<Employee>>,
    employeeId: Integer,
    newSalary: number
): Promise<Integer> {
    // Validate input
    if (newSalary < 0) {
        // Staged edits will be discarded
        throw new Error("Salary cannot be negative");
    }

    // Update the employee
    await client.update(
        { $apiName: "Employee", $primaryKey: employeeId },
        { salary: newSalary }
    );

    // If we reach here, all staged edits will be committed atomically
}

export default updateEmployeeWithValidation;
```
