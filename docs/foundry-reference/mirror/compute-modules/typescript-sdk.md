<!-- source: https://palantir.com/docs/foundry/compute-modules/typescript-sdk/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# TypeScript SDK

The TypeScript SDK (`@palantir/compute-module`) for compute modules enables you to build deployed functions using TypeScript or JavaScript. The SDK provides type-safe function registration with schema validation, structured logging, and utilities for working with Foundry resources.

The TypeScript SDK provides:

* `ComputeModule`: Main class for creating and registering functions
* `SlsLogger`: Structured logging in SLS format
* `Type` (from `@sinclair/typebox`): Runtime type validation and schema generation
* Pipeline mode support with resource alias management
* Source credential retrieval
* Foundry service API access

## Installation

Install the SDK using npm or yarn:

```bash
npm install @palantir/compute-module
```

```bash
yarn add @palantir/compute-module
```

## Defining functions

### Basic usage

Register functions using vanilla JavaScript:

```javascript
import { ComputeModule } from "@palantir/compute-module";

new ComputeModule()
  .register("addOne", async ({ value }) => ({ value: value + 1 }))
  .register("stringify", async ({ n }) => "" + n)
  .default(() => ({ error: "Unsupported query name" }));
```

### Schema registration

Use [TypeBox ↗](https://github.com/sinclairzx81/typebox) for type-safe function registration with automatic schema inference:

```typescript
import { ComputeModule, SlsLogger } from "@palantir/compute-module";
import { Type } from "@sinclair/typebox";

const myModule = new ComputeModule({
  logger: new SlsLogger(),
  definitions: {
    addOne: {
      input: Type.Object({
        value: Type.Number(),
      }),
      output: Type.Object({ value: Type.Number() }),
    },
  },
});

myModule.register("addOne", async ({ value }) => ({ value: value + 1 }));
```

**Benefits of schema registration:**

* Automatic type inference for function parameters
* Compile-time type safety
* Runtime schema validation
* Automatic function registration in Foundry

### Streaming output

For large result sets, use streaming to send data progressively:

```typescript
import { ComputeModule } from "@palantir/compute-module";
import { Type } from "@sinclair/typebox";

const computeModule = new ComputeModule({
  definitions: {
    greet: {
      input: Type.Object({ name: Type.String() }),
      output: Type.Array(Type.String()),
    },
  },
});

// Each write must produce valid JSON
computeModule.registerStreaming("greet", async ({ name }, writeable) => {
  writeable.write(JSON.stringify("Hello, "));
  writeable.write(JSON.stringify(name));
  writeable.end();
});
```

**Streaming with complex types:**

```typescript
const User = Type.Object({
  name: Type.String(),
  role: Type.String(),
  active: Type.Boolean(),
});

const computeModule = new ComputeModule({
  definitions: {
    activeUsers: {
      input: Type.Object({ users: Type.Array(User) }),
      output: Type.Array(User),
    },
  },
});

computeModule.registerStreaming("activeUsers", async ({ users }, writeable) => {
  for (const user of users) {
    if (user.active) {
      writeable.write(JSON.stringify(user));
    }
  }
  writeable.end();
});
```

:::callout{theme="warning"}
**Important:** The output type must be declared as `Type.Array(...)` for streaming. Each `write()` call must produce valid JSON.
:::

## Logging

### SLS logger (recommended)

Use `SlsLogger` for structured logging in Standard Logging Specification (SLS) format:

```typescript
import { ComputeModule, SlsLogger } from "@palantir/compute-module";
import { Type } from "@sinclair/typebox";

const logger = new SlsLogger();

const myModule = new ComputeModule({
  logger,
  definitions: {
    addOne: {
      input: Type.Object({ value: Type.Number() }),
      output: Type.Object({ value: Type.Number() }),
    },
  },
});

myModule.register("addOne", async ({ value }) => {
  logger.info("Processing addOne", { input_value: String(value) });
  return { value: value + 1 };
});
```

**Log methods:**

* `logger.debug(message, params?)` - Debug-level logs
* `logger.info(message, params?)` - Info-level logs
* `logger.warn(message, params?)` - Warning logs
* `logger.error(message, params?)` - Error logs

Custom key-value pairs can be passed as the second argument and will be added to the log entry's parameters.

:::callout{theme="neutral"}
**Alternative:** Any object with `log`, `info`, `warn`, and `error` methods (for example, `console`) can be used as a logger.
:::

[Learn more about debugging and viewing logs.](/docs/foundry/compute-modules/debugging/)

## Pipeline mode

### Retrieving resource aliases

In Pipeline mode, access configured inputs and outputs using resource aliases:

```typescript
import { ComputeModule } from "@palantir/compute-module";

const resourceId = ComputeModule.getResource("myResourceAlias");
const result = await someDataFetcherForId(resourceId);
```

### Environment detection

Retrieve execution environment details:

```typescript
import { ComputeModule } from "@palantir/compute-module";

const environment = ComputeModule.getEnvironment();

// Pipeline mode
const buildToken = environment.type === "pipelines"
  ? environment.buildToken
  : undefined;

// Functions mode
const thirdPartyAppCredentials = environment.type === "functions"
  ? environment.thirdPartyApplication
  : undefined;
```

[Learn more about execution modes.](/docs/foundry/compute-modules/execution-modes/)

## Using sources

### Retrieving source credentials

Access source credentials for external system authentication:

```typescript
const myCredential = myModule.getCredential("MySourceApiName", "MyCredential");
```

### Validating sources at startup

Declare and validate sources in the module configuration:

```typescript
const myModule = new ComputeModule({
  sources: {
    MyApi: {
      credentials: ["MyCredential"]
    },
    AnotherApi: {} // Validates source exists, but not specific credentials
  }
});

// ✅ Passes type checking
myModule.getCredential("MyApi", "MyCredential");

// ❌ Will throw a type error
myModule.getCredential("YourApi", "YourCredential");

// ✅ Any credential name works for sources without declared credentials
myModule.getCredential("AnotherApi", "AnyString");
```

:::callout{theme="neutral"}
**Validation:** If sources are declared, the module validates them at startup and provides compile-time type safety. Without declaration, no validation occurs.
:::

[Learn more about configuring sources.](/docs/foundry/compute-modules/sources/)

## Retrieving Foundry services

Access Foundry service API endpoints:

```typescript
import { FoundryService } from "@palantir/compute-module";

const streamProxyApi = myModule.getServiceApi(FoundryService.STREAM_PROXY);
```

This allows calling Foundry endpoints without configuring a source for platform ingress.

## Docker configuration

### Dockerfile example

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY src .

# USER is required to be non-root and numeric
USER 5000
CMD ["node", "index.js"]
```

[Learn more about container configuration.](/docs/foundry/compute-modules/containers/)

## GitHub repository

The TypeScript SDK is open source and available on GitHub:

* [palantir/typescript-compute-module ↗](https://github.com/palantir/typescript-compute-module)
