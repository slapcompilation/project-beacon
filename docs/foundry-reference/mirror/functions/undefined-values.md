<!-- source: https://palantir.com/docs/foundry/functions/undefined-values/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Handle undefined values

:::callout{theme="warning"}
The following documentation is specific to TypeScript v1 functions. For more [robust capabilities](/docs/foundry/functions/language-feature-support/#typescript-v1-vs-typescript-v2), including support for Ontology SDK and configurable resource requests, we recommend [migrating to TypeScript v2](/docs/foundry/functions/typescript-v2-migration/).
:::

Below are two useful patterns for handling `undefined` values which may be returned from accessing properties or links.

### Explicit checks

```typescript
@Function()
public getFullName(employee: Employee): string {
    if (!(employee.firstName && employee.lastName)) {
        throw new UserFacingError("Cannot derive full name because either first or last name is undefined.");
    }
    return employee.firstName + " " + employee.lastName;
}
```

By checking that both the `firstName` and `lastName` fields are defined, the TypeScript compiler knows that the final line with the `return` statement can compile correctly. The benefit of this approach is that type checking is more explicit, and in the case where `undefined` values are present, you can throw a more explicit error about what went wrong.

### Non-null assertion operator

You can use the TypeScript [non-null assertion operator ↗](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#non-null-assertion-operator) (`!`) to ignore the `undefined` case.

```typescript
@Function()
public getFullName(employee: Employee): string {
    return employee.firstName! + " " + employee.lastName!;
}
```

This approach simply overrides the TypeScript compiler and asserts that the fields you're accessing are defined. Although this makes for more concise code, this can lead to cryptic errors in the case when one of the fields turns out to be `undefined`. We recommend making explicit checks when possible.
