<!-- source: https://palantir.com/docs/foundry/ontology-sdk/typescript-osdk-testing/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Unit testing TypeScript OSDK code

:::callout{theme="warning" title="Experimental"}
The `@osdk/unit-testing` package is experimental. The package is published as `@osdk/unit-testing` and only exports through the `/experimental` subpath. The API surface may evolve before promotion to a stable name.
:::

The `@osdk/unit-testing` package allows you to unit test code that takes an OSDK `Client`, including [Foundry functions](/docs/foundry/functions/overview/), without making a request to Foundry. The package provides:

* **`createMockClient`:** A `Client` you stub with fluent `.when`, `.whenObjectSet`, and `.whenQuery` matchers.
* **`createMockOsdkObject`:** Builds fully shaped `Osdk.Instance` values, including `$primaryKey`, `$title`, `$rid`, `$link`, and `$clone`.
* **`createMockObjectSet`:** A standalone `ObjectSet` that you can pass anywhere a real one would go, or use as a many-link target for aggregations.
* **`createMockAttachment`:** A placeholder for attachment values.

## Install

Install the package as a development dependency:

```bash
npm install --save-dev @osdk/unit-testing
```

The package has the following peer dependencies, which should already be installed in your project:

* `@osdk/api`
* `@osdk/client`
* `@osdk/functions`

The package uses `vitest` internally for example tests; you can use any test runner in your own code.

## Import

All exports are available from the `/experimental` subpath:

```typescript
import {
  createMockAttachment,
  createMockClient,
  createMockObjectSet,
  createMockOsdkObject,
} from "@osdk/unit-testing/experimental";

import type {
  AggregateStubBuilder,
  FetchOneStubBuilder,
  FetchPageStubBuilder,
  QueryStubBuilder,
  StubBuilderFor,
} from "@osdk/unit-testing/experimental";
```

## Write your first test

Consider a Foundry function that reads the first `Employee` from a page:

```typescript
import type { Osdk } from "@osdk/api";
import type { Client } from "@osdk/client";
import { Employee } from "your-app-sdk";

export async function basicFetchPage(
  client: Client,
): Promise<Osdk.Instance<Employee>> {
  const objects = await client(Employee).fetchPage();
  const object = objects.data[0];
  if (object == null) throw new Error("No objects returned");
  return object;
}
```

A unit test with the mock client is shown below:

```typescript
import {
  createMockClient,
  createMockOsdkObject,
} from "@osdk/unit-testing/experimental";
import { describe, expect, it } from "vitest";
import { Employee } from "your-app-sdk";
import { basicFetchPage } from "./basicFetchPage.js";

describe("basicFetchPage", () => {
  it("returns the first Employee", async () => {
    const mockClient = createMockClient();
    const mockEmployee = createMockOsdkObject(Employee, {
      employeeId: 1,
      fullName: "John",
    });

    mockClient
      .when((stub) => stub(Employee).fetchPage())
      .thenReturnObjects([mockEmployee]);

    const actual = await basicFetchPage(mockClient);
    expect(actual).toEqual(mockEmployee);
  });
});
```

The test does three things:

1. **`createMockClient()`** returns a `MockClient` that satisfies the `Client` interface; pass it anywhere your code expects a real client.
2. **`createMockOsdkObject(Employee, { ... })`** builds a real-shaped `Osdk.Instance`.
3. **`mockClient.when(stub => stub(Employee).fetchPage()).thenReturnObjects([...])`** records a stub. The `stub` argument is a `Client`-like factory; rebuild the same call chain that your code under test will execute.

## Mock objects and links

`createMockOsdkObject` builds a fully shaped `Osdk.Instance<T>` that you can pass to your code under test or place inside a `.thenReturnObjects([...])` stub. The following sections cover the object shape, the `links` option (single, many, errors, and mock object sets), and `createMockAttachment`.

### Arguments

`createMockOsdkObject` takes three arguments:

```typescript
createMockOsdkObject(objectType, properties, options);
```

1. **`objectType`:** The generated object type constant from your SDK (for example, `Employee`). The mock reads its `apiName` and `primaryKeyApiName` from this value.
2. **`properties`:** The property values you want on the mock. Must include the primary key property. Other properties are optional and are only relevant if your code reads them.
3. **`options`:** Three optional fields:
   * **`links`:** Mock data for the object's `$link` accessor. See [Links](#links).
   * **`titlePropertyApiName`:** The API name of the property that should back `$title`. See [Set the title property](#set-the-title-property).
   * **`$rid`:** Override the auto-generated `$rid`. The default is `"ri.mock.main.object.<apiName>.<primaryKey>"`.

The returned mock has the same shape as a real OSDK instance:

| Field                     | Description                                                               |
| ------------------------- | ------------------------------------------------------------------------- |
| `$apiName`, `$objectType` | The object type's API name.                                               |
| `$primaryKey`             | The value of the primary key property in `properties`.                    |
| `$title`                  | The value of the `titlePropertyApiName` property; `undefined` if not set. |
| `$rid`                    | `options.$rid` if provided, otherwise an auto-generated mock RID.         |
| `$objectSpecifier`        | `"<apiName>:<primaryKey>"`.                                               |
| `$link`                   | A proxy backed by `options.links`.                                        |
| `$clone(updates?)`        | Returns a fresh mock with merged property values.                         |

Mocks do not model the `$as` and `$__EXPERIMENTAL__NOT_SUPPORTED_YET__*` accessors; accessing them throws an error.

### Basic usage

```typescript
import { createMockOsdkObject } from "@osdk/unit-testing/experimental";
import { Employee } from "your-app-sdk";

const emp = createMockOsdkObject(
  Employee,
  { employeeId: 1, fullName: "John Doe" },
  { titlePropertyApiName: "fullName" },
);

emp.$primaryKey; // 1
emp.$title; // "John Doe"
emp.$objectSpecifier; // "Employee:1"
```

You must include the primary key property. `createMockOsdkObject` reads `objectType.primaryKeyApiName` and throws an error if that key is not present in `properties`.

### Set the title property

In the test environment, the OSDK does not know which property on a given object type is its title. If your code under test reads `obj.$title`, you must tell the mock which property to surface there by passing `titlePropertyApiName`:

```typescript
const emp = createMockOsdkObject(
  Employee,
  { employeeId: 1, fullName: "John Doe" },
  { titlePropertyApiName: "fullName" },
);

emp.$title; // "John Doe"
```

`titlePropertyApiName` must name a property that you actually included in `properties`; `createMockOsdkObject` throws an error if it is missing. If you omit `titlePropertyApiName` entirely, `$title` is `undefined`.

### Links

The `links` option mirrors the link API names from the object type. Each value can be one of the following:

| Link multiplicity | Allowed values                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Single            | A mock object, or an `Error` instance.                                                      |
| Many              | An array of mock objects, or a `MockObjectSet` (see [Mock object sets](#mock-object-sets)). |

#### Successful link fetch

```typescript
const office = createMockOsdkObject(Office, {
  officeId: "nyc",
  name: "New York Office",
});

const employee = createMockOsdkObject(
  Employee,
  { employeeId: 1, fullName: "John Doe" },
  { links: { officeLink: office } },
);

await employee.$link.officeLink.fetchOne();
// → office

(await employee.$link.officeLink.fetchOneWithErrors()).value;
// → office
```

#### Failed link fetch

Pass an `Error` instance to exercise the failure branch in the calling code. `fetchOne()` rejects with the error, and `fetchOneWithErrors()` resolves to `{ error }`:

```typescript
const employee = createMockOsdkObject(
  Employee,
  { employeeId: 1 },
  { links: { officeLink: new Error("link unavailable") } },
);

await expect(employee.$link.officeLink.fetchOne()).rejects.toThrow(
  "link unavailable",
);

const result = await employee.$link.officeLink.fetchOneWithErrors();
result.error; // the Error
result.value; // undefined
```

#### Missing links

If your code accesses `$link.someLink` and you did not configure it, the accessor still exists. The `fetchOne` method rejects, and `fetchOneWithErrors` resolves with `{ error }`, containing the link name, object type, and primary key:

```typescript
const employee = createMockOsdkObject(Employee, { employeeId: 1 });

await employee.$link.officeLink.fetchOne();
// rejects
```

#### Many-link with an array

Pass an array; the `$link` accessor exposes the same call shapes that a real many-link does:

```typescript
const peep1 = createMockOsdkObject(Employee, {
  employeeId: 10,
  fullName: "Alice",
});
const peep2 = createMockOsdkObject(Employee, {
  employeeId: 11,
  fullName: "Bob",
});

const employee = createMockOsdkObject(
  Employee,
  { employeeId: 1 },
  { links: { peeps: [peep1, peep2] } },
);

(await employee.$link.peeps.fetchPage()).data;
// → [peep1, peep2]

await employee.$link.peeps.fetchOne(11);
// → peep2 (matched by $primaryKey)

for await (const peep of employee.$link.peeps.asyncIter()) {
  // peep1, peep2
}
```

`fetchOne(primaryKey)` throws an error when no array element has a matching `$primaryKey`. The `aggregate()` method is **not** supported on the array form; pass a [`MockObjectSet`](#mock-object-sets) instead.

#### Many-link with a `MockObjectSet`

A many-link can also be backed by a `MockObjectSet` instead of an array. Use this approach when your code calls `aggregate()`, `where()`, or other object-set methods on the link:

```typescript
const employee = createMockOsdkObject(
  Employee,
  { employeeId: 1 },
  { links: { peeps: peepsSet } },
);
```

See [Mock object sets](#mock-object-sets) for how to build `peepsSet` and stub calls on it.

### Mock object sets

`createMockObjectSet(objectType)` returns an `ObjectSet<T>` that you can pass anywhere a real one would go: directly into a function under test, or as the value of a many-link in `createMockOsdkObject`. By itself, the mock object set holds no data; you wire up its behavior by registering stubs against it on a `MockClient`.

```typescript
import {
  createMockClient,
  createMockObjectSet,
  createMockOsdkObject,
} from "@osdk/unit-testing/experimental";

const mockClient = createMockClient();
const peepsSet = createMockObjectSet(Employee);

mockClient
  .whenObjectSet(
    peepsSet,
    (os) => os.aggregate({ $select: { $count: "unordered" } }),
  )
  .thenReturnAggregation({ $count: 7 });
```

Now `peepsSet.aggregate(...)` resolves to `{ $count: 7 }`. You can attach the same set to a parent mock object as a many-link:

```typescript
const employee = createMockOsdkObject(
  Employee,
  { employeeId: 1 },
  { links: { peeps: peepsSet } },
);

const result = await employee.$link.peeps.aggregate({
  $select: { $count: "unordered" },
});
result.$count; // 7
```

You can register `fetchPage`, `where`, and other call shapes on the same set; see [Stub calls on a mock object set](#stub-calls-on-a-mock-object-set) for the full builder reference.

### Mock attachments

For function inputs of type `Attachment`, `createMockAttachment` returns a placeholder value with the surface that your code can call against. Use it the same way you would use `createMockOsdkObject`:

```typescript
import { createMockAttachment } from "@osdk/unit-testing/experimental";

const blob = new Blob(["hello world!"], { type: "text/plain" });
const attachment = createMockAttachment("ri.attachments.main.attachment.abc", blob);
```

### Cloning and updates

`$clone` is supported and returns a fresh frozen mock with merged properties. Updating the primary key to a different value throws an error.

```typescript
const updated = employee.$clone({ fullName: "Jane Doe" });
updated.$primaryKey; // unchanged
updated.fullName; // "Jane Doe"
```

## Stub client calls

`createMockClient()` returns a value that satisfies the OSDK `Client` interface, plus four additional methods for setting up stubs:

* **`client.when(callback)`:** Stub a call rooted at the client. Pass a callback that rebuilds the chain that your code under test will make (for example, `stub(Employee).where(...).fetchPage()`). Returns a builder whose `.thenReturn*` matcher depends on the call shape.
* **`client.whenObjectSet(set, callback)`:** Stub a call on a specific `MockObjectSet` (created with `createMockObjectSet`). Use this approach when your code is handed an object set directly, or for a many-link backed by a mock object set.
* **`client.whenQuery(query, params?)`:** Stub a query call (a generated function on the Ontology). Returns a builder with `.thenReturn(value)` and `.thenThrow(error)`.
* **`client.clearStubs()`:** Removes every stub registered on this client.

Each registrar is covered in the following sections.

### Stub calls rooted at the client

Use `client.when(callback)` to rebuild the call chain that your code under test will make. The argument is a `Client`-like factory; chain `where`, `aggregate`, `fetchPage`, `fetchOne`, and so on, just as your code would.

#### `fetchPage` with `thenReturnObjects`

```typescript
const mockClient = createMockClient();
const emp = createMockOsdkObject(Employee, { employeeId: 1, fullName: "John" });

mockClient
  .when((stub) => stub(Employee).fetchPage())
  .thenReturnObjects([emp]);

const page = await mockClient(Employee).fetchPage();
page.data; // [emp]
```

`thenReturnObjects` also wires up `asyncIter`. If your code iterates instead of paginating, the same stub serves both call shapes.

#### `fetchOne` with `thenReturnObject`

```typescript
mockClient
  .when((stub) => stub(Employee).fetchOne(1))
  .thenReturnObject(emp);
```

#### `aggregate` with `thenReturnAggregation`

```typescript
mockClient
  .when((stub) =>
    stub(Employee)
      .where({ employeeId: { $eq: 5 } })
      .aggregate({ $select: { "employeeLocation:exactDistinct": "asc" } })
  )
  .thenReturnAggregation({ employeeLocation: { exactDistinct: 3 } });
```

Stub `$groupBy` aggregations the same way; return an array of group rows:

```typescript
mockClient
  .when((stub) =>
    stub(Employee).aggregate({
      $select: { "employeeId:max": "unordered" },
      $groupBy: { employeeId: "exact" },
    })
  )
  .thenReturnAggregation([
    { $group: { employeeId: 5 }, employeeId: { max: 5 } },
  ]);
```

#### Multiple stubs on the same client

You can register as many stubs as needed. Stubs are matched against the calls your code makes; registration order does not affect matching.

### Stub calls on a mock object set

When code receives an `ObjectSet` directly (not built from `client(Type)`), or when you are stubbing aggregate or fetch behavior for a many-link backed by a `MockObjectSet`, register stubs against the set itself:

```typescript
import { createMockObjectSet } from "@osdk/unit-testing/experimental";

const empSet = createMockObjectSet(Employee);
const emp1 = createMockOsdkObject(Employee, {
  employeeId: 1,
  fullName: "Alice",
});
const emp2 = createMockOsdkObject(Employee, { employeeId: 2, fullName: "Bob" });

mockClient
  .whenObjectSet(empSet, (os) => os.fetchPage())
  .thenReturnObjects([emp1, emp2]);

mockClient
  .whenObjectSet(
    empSet,
    (os) => os.aggregate({ $select: { $count: "unordered" } }),
  )
  .thenReturnAggregation({ $count: 42 });
```

The same `empSet` can then be passed wherever your code expects an `ObjectSet<Employee>`: into a function under test, or as a many-link target on a parent mock object.

### Stub Foundry queries

Queries (functions on the Ontology) can be stubbed as well:

```typescript
import { addOne } from "your-app-sdk";

mockClient.whenQuery(addOne, { n: 5 }).thenReturn(6);
mockClient.whenQuery(addOne, { n: 99 }).thenThrow(new Error("boom"));
```

`thenReturn(value)` resolves the query promise to `value`, and `thenThrow(error)` rejects it. Different parameter objects can be stubbed independently:

```typescript
mockClient.whenQuery(addOne, { n: 10 }).thenReturn(11);
mockClient.whenQuery(addOne, { n: 20 }).thenReturn(21);
```

Queries with array parameters follow the same pattern; match the parameters that your code passes:

```typescript
mockClient
  .whenQuery(queryTypeReturnsArray, { people: ["Alice", "Bob"] })
  .thenReturn(["Alice - processed", "Bob - processed"]);
```

### Reset stubs between tests

`mockClient.clearStubs()` removes every stub registered on the client. This is useful if you reuse a client across multiple `it` blocks; otherwise, construct a fresh `createMockClient()` for each test for isolation.

## Test Foundry Platform APIs with MSW

`createMockClient` only stubs Ontology calls (object types, queries, and object sets). It does not intercept the Foundry Platform APIs in `@osdk/foundry.*` and `@osdk/internal.foundry.*`; those calls go through the regular `fetch` path. To keep them off the network in tests, intercept them with [MSW ↗](https://mswjs.io/).

### How it works

You stub Platform SDK requests with a network request stubbing library. It uses a placeholder base URL:

```
https://mock.invalid/
```

Every Platform call your code makes will resolve against that origin. Provide MSW handlers for the specific paths that your function calls.

### Set up MSW

Install MSW as a development dependency:

```bash
npm install --save-dev msw
```

Set up a Node server in your test file. The standard MSW lifecycle hooks reset handlers between tests so each `it` block is isolated:

```typescript
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Set `onUnhandledRequest: "error"`; it surfaces accidental Platform calls without a handler instead of letting them fall through silently.

### Stub a Platform call

A function that loads the current user and gates on a username suffix:

```typescript
import type { Client } from "@osdk/client";
import { Users } from "@osdk/foundry.admin";

export async function requireAdminUser(client: Client): Promise<string> {
  const user = await Users.getCurrent(client);
  if (!user.username.endsWith("@admin")) {
    throw new Error(`User ${user.username} is not an admin`);
  }
  return user.username;
}
```

The test stubs the Platform endpoint with MSW and uses `createMockClient()` for the `Client`:

```typescript
import type { getCurrent } from "@osdk/foundry.admin/User";
import { createMockClient } from "@osdk/unit-testing/experimental";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { requireAdminUser } from "./requireAdminUser.js";

type User = Awaited<ReturnType<typeof getCurrent>>;

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("requireAdminUser", () => {
  it("resolves when the current user is an admin", async () => {
    server.use(
      http.get(
        "https://mock.invalid/api/v2/admin/users/getCurrent",
        () =>
          HttpResponse.json(
            {
              id: "user-1",
              username: "alice@admin",
              givenName: "Alice",
              familyName: "Admin",
              realm: "default",
              status: "ACTIVE",
              attributes: {},
            } satisfies User,
          ),
      ),
    );

    const mockClient = createMockClient();
    expect(await requireAdminUser(mockClient)).toBe("alice@admin");
  });

  it("rejects when the user is not an admin", async () => {
    server.use(
      http.get(
        "https://mock.invalid/api/v2/admin/users/getCurrent",
        () =>
          HttpResponse.json(
            {
              id: "user-2",
              username: "bob@example.com",
              givenName: "Bob",
              familyName: "Example",
              realm: "default",
              status: "ACTIVE",
              attributes: {},
            } satisfies User,
          ),
      ),
    );

    const mockClient = createMockClient();
    await expect(requireAdminUser(mockClient)).rejects.toThrow(
      "User bob@example.com is not an admin",
    );
  });
});
```

:::callout{theme="neutral" title="Type your fixtures against the real Platform type"}
The MSW response body is a JSON literal, so the body can drift from the actual `@osdk/foundry.*` shape (a renamed field, a new required property, and so on) and only fail at runtime.

To keep the fixture tied to the real type, derive it from the `Platform` function itself:

```typescript
import type { somePlatformFn } from "@osdk/foundry.<service>/<Resource>";

type ResponseShape = Awaited<ReturnType<typeof somePlatformFn>>;
```

Then assert the response body with `satisfies ResponseShape`:

```typescript
HttpResponse.json(
  {/* ...response fields... */} satisfies ResponseShape,
);
```

`Awaited<ReturnType<typeof fn>>` unwraps the `Promise<T>` returned by an `async` function, giving you `T` directly, which ensures that the mocked response matches what would be returned from real calls exactly.

In the example above, the concrete instance of this pattern is `type User = Awaited<ReturnType<typeof getCurrent>>`; name the alias after whatever the endpoint returns.
:::

### Tips

* **Use `onUnhandledRequest: "error"`.** Spotting a missing handler is simpler than debugging a hung test.
* **Reuse one server across handlers.** Call `setupServer()` once at module scope, then call `server.use(...)` inside each `it` block for the per-test handler. Use `afterEach(server.resetHandlers)` to clear them.
* **Combine Ontology stubs with Platform stubs.** A single `mockClient` handles both kinds of call simultaneously; Ontology calls go through `when`, `whenObjectSet`, and `whenQuery`, while Platform calls go through MSW.
