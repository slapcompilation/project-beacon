<!-- source: https://palantir.com/docs/foundry/functions/typescript-error-types/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Error types

:::callout{theme="warning"}
The following documentation is specific to TypeScript v1 functions. For more [robust capabilities](/docs/foundry/functions/language-feature-support/#typescript-v1-vs-typescript-v2), including support for Ontology SDK and configurable resource requests, we recommend [migrating to TypeScript v2](/docs/foundry/functions/typescript-v2-migration/).
:::

In addition to declaring an [output type](/docs/foundry/functions/types-reference/) on your TypeScript function, you can also declare an error type. This can be particularly useful for propagating and handling errors in the context of queries.

## Define an error type

You can define an error type using the `FunctionsError` type exported from `@foundry/functions-api`. It takes two type parameters; a string name and an optional type that defaults to an empty object. Any [valid output type](/docs/foundry/functions/types-reference/) for a function may be used as an error type, including objects and object sets.

You can union multiple `FunctionsError` types together to define a set of possible errors for your function. For example, you could define the following error type for a function that gets an employee's teammates:

```typescript
import { FunctionsError } from "@foundry/functions-api";
import { Employee } from "@foundry/ontology-api";

type GetTeammatesError =
    | FunctionsError<"EmployeeNotFoundForId", string>
    | FunctionsError<"MultipleEmployeesFoundForId", { employees: Employee[], employeeId: string }>
```

## Declare an error type on a function

To declare an error type on a TypeScript function, you can use the `FunctionsResult` type exported from `@foundry/functions-api`. It takes two type parameters; an output type and an error type.

Using the `GetTeammatesError` example from the previous section, you can declare the error type on a function like so:

```typescript
import { Function, FunctionsError, FunctionsResult } from "@foundry/functions-api";
import { Employee } from "@foundry/ontology-api";

type GetTeammatesError =
    | FunctionsError<"EmployeeNotFoundForId", string>
    | FunctionsError<"MultipleEmployeesFoundForId", { employees: Employee[], employeeId: string }>

@Function()
public getTeammates(employeeId: string): FunctionsResult<Employee[], GetTeammatesError> {
    ...
}
```

Note that by default the `FunctionsResult` type includes a few errors that can be returned by the TypeScript function runtime infrastructure:

* **`FunctionsTypeScriptExecutorService:CpuTimeoutError`:** Returned when the function exceeds the CPU time limit.
* **`FunctionsTypeScriptExecutorService:WallTimeoutError`:** Returned when the function exceeds the wall time limit.
* **`FunctionsTypeScriptExecutorService:OutOfMemoryError`:** Returned when the function exceeds the memory limit.
* **`FunctionsTypeScriptExecutorService:RuntimeError`:** Returned when the function encounters some other runtime error.

## Return outputs and errors in your function

To return outputs and errors, you can use the `FunctionsResult.ok` and `FunctionsResult.err` methods exported from `@foundry/functions-api`:

* **`FunctionsResult.ok`:** Takes a single output value as its argument.
* **`FunctionsResult.err`:** Takes an error name and value as its arguments.

Using the `getTeammates` example from the previous section, you can return outputs and errors like so:

```typescript
import { Function, FunctionsError, FunctionsResult } from "@foundry/functions-api";
import { Employee } from "@foundry/ontology-api";

type GetTeammatesError =
    | FunctionsError<"EmployeeNotFoundForId", string>
    | FunctionsError<"MultipleEmployeesFoundForId", { employees: Employee[], employeeId: string }>

@Function()
public getTeammates(employeeId: string): FunctionsResult<Employee[], GetTeammatesError> {
    const employees = await Objects.search().employee([employeeId]).allAsync();
    if (employees.length === 0) {
        return FunctionsResult.err("EmployeeNotFoundForId", employeeId);
    }

    if (employees.length > 1) {
        return FunctionsResult.err("MultipleEmployeesFoundForId", { employees, employeeId });
    }

    const employee = employees[0];
    const teammates = await employee.teammates.allAsync();
    return FunctionsResult.ok(teammates);
}
```

## Handle errors from queries

When a function with an error type is [called as a query from another repository](/docs/foundry/functions/query-functions/#call-a-query-function), it returns a `Result` type response, which can be an `ok` or `err` result.

You can use the `isOk` or `isErr` type guards exported from `@foundry/functions-api` to differentiate between the two possible results. For instance, call the `getTeammates` example from the previous section, assuming you also [published it as a query](/docs/foundry/functions/query-functions/#query-decorator), and handle the response like so:

```typescript
import { Function, isOk } from "@foundry/function-api";
import { getTeammates } from "@foundry/ontology-api/queries";

@Function()
public async myFunction(employeeId: string): Promise<string> {
    const result = await getTeammates({ employeeId });

    if (isOk(result)) {
        const teammates = result.value;
        // Do something with "teammates" here
        ...
    }

    // You can inspect the "name" field to case on each error by name and use the "value" field to get the error value
    switch (result.error.name) {
        case "EmployeeNotFoundForId": ...
        case "MultipleEmployeesFoundForId": ...
        case "FunctionsTypescriptExecutorService:OutOfMemoryError": ...
        ...
    }
}
```
