<!-- source: https://palantir.com/docs/foundry/ontology-sdk-react-applications/osdk-react/ · mirrored 2026-08-16 from Palantir Foundry docs -->

# Build applications with `@osdk/react`

The `@osdk/react` library connects the Ontology Software Development Kit (OSDK) to the React component lifecycle. It provides typed hooks and a shared cache so that you can load and update Ontology data without managing each request and its state separately.

We recommend always using `@osdk/react` when building React applications with the OSDK. It provides a more declarative and maintainable way to interact with your Ontology data.

## Capabilities

With `@osdk/react`, you can:

* Query objects, object sets, links, and aggregations with typed React hooks.
* Apply and validate actions, including optimistic updates.
* Call Ontology functions and track their dependencies.
* Share normalized, cached objects across components.
* Automatically synchronize affected cached objects after actions.

## Example

The following component loads incomplete `Todo` objects from a generated OSDK package:

```typescript
import { Todo } from "@my/osdk";
import { useOsdkObjects } from "@osdk/react";

function TodoList() {
  const { data, error, isLoading } = useOsdkObjects(Todo, {
    orderBy: { createdAt: "desc" },
    where: { isComplete: false },
  });

  if (data == null && isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (data == null) {
    return <div>No todos found</div>;
  }

  return (
    <div>
      {data.map(todo => <div key={todo.$primaryKey}>{todo.title}</div>)}
    </div>
  );
}
```

For installation, provider setup, hook options, and additional examples, review the [OSDK React documentation ↗](https://palantir.github.io/osdk-ts/react/getting-started).
