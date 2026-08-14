<!-- source: https://palantir.com/docs/foundry/compute-modules/java-sdk/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Java SDK

The Java SDK for compute modules enables you to build deployed functions that integrate with Foundry. The SDK provides a builder pattern for function registration, authentication helpers, structured logging, and utilities for working with Foundry resources.

The Java SDK provides these key classes from the `com.palantir.computemodules` package:

| Class/Package               | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `ComputeModule`             | Builder pattern for creating and starting modules               |
| `functions.Context`         | Context object passed to every function (metadata, credentials) |
| `auth.PipelinesAuth`        | Retrieve pipeline tokens for Pipeline mode                      |
| `auth.RefreshingOauthToken` | Auto-refreshing OAuth token wrapper for application permissions |

## Defining functions

### ComputeModule builder

The `ComputeModule` builder is the main way to create and register functions:

```java
import com.palantir.computemodules.ComputeModule;
import com.palantir.computemodules.functions.Context;

public class App {
    public static void main(String[] args) {
        ComputeModule.builder()
                .add(App::hello, String.class, String.class, "hello")
                .add(App::goodbye, Payload.class, Integer.class, "goodbye")
                .build()
                .start();
    }

    record Payload(String name) {}

    static String hello(Context context, String name) {
        return "Hello, " + name;
    }

    static Integer goodbye(Context context, Payload payload) {
        return payload.name.length();
    }
}
```

**The `.add()` method parameters:**

1. **Function reference (`App::hello`):** Reference to the function to call
2. **Input type (`String.class`):** Matches the second parameter type
3. **Output type (`String.class`):** Matches the return type
4. **Endpoint name (`"hello"`):** Public name for invoking the function

:::callout{theme="warning"}
**Important:** Every function must receive `Context` as the first parameter and your payload type as the second parameter.
:::

### Defining input/output types

**Java Records (recommended):**

Records provide a concise way to define immutable data types:

```java
public record Car(String brand, int doors) {}

public record CalculateInput(double x, double y, String operation) {}

public record CalculateOutput(double result, String operation) {}
```

**Classes with @JsonProperty Annotations:**

For more complex scenarios, use classes with Jackson annotations:

```java
import com.fasterxml.jackson.annotation.JsonProperty;

public static class Car {
    @JsonProperty("brand")
    private String brand;

    @JsonProperty("doors")
    private int doors;

    Car() {} // Required for Jackson deserialization

    public String brand() { return brand; }
    public int doors() { return doors; }
}
```

[Learn more about type systems and schema inference.](/docs/foundry/compute-modules/functions/#automatic-function-schema-inference)

## Authentication

### Pipeline mode token

For Pipeline mode, retrieve the build2 token:

```java
import com.palantir.computemodules.auth.PipelinesAuth;

String token = PipelinesAuth.retrievePipelineToken();
```

### Application permissions (3PA)

Use `RefreshingOauthToken` to access Foundry resources with automatically refreshing tokens:

```java
import com.palantir.computemodules.auth.RefreshingOauthToken;

String HOSTNAME = "myenrollment.palantirfoundry.com";

RefreshingOauthToken refreshingToken = new RefreshingOauthToken(
    HOSTNAME,
    List.of("api:datasets-read", "api:datasets-write")
);

// Token automatically refreshes before expiry
String token = refreshingToken.getToken();
```

The `RefreshingOauthToken` wrapper automatically handles token refreshing, ensuring your tokens remain valid throughout long-running operations.

[Learn more about authentication modes.](/docs/foundry/compute-modules/execution-modes/)

## Working with Foundry resources

### Using the Ontology SDK (OSDK)

The Java SDK integrates with the Ontology SDK for working with Ontology objects. First, generate an OSDK for Java in Developer Console, then:

```java
import com.palantir.computemodules.client.config.EnvVars;
import com.palantir.foundry.your_osdk_package.FoundryClient;
import com.palantir.foundry.your_osdk_package.objects.Employee;
import com.palantir.osdk.api.Auth;
import com.palantir.osdk.api.auth.ConfidentialClientAuth;
import com.palantir.osdk.internal.api.FoundryConnectionConfig;
import java.util.List;

static String returnObject() {
    Auth auth = ConfidentialClientAuth.builder()
            .clientId(EnvVars.Reserved.CLIENT_ID.get())
            .clientSecret(EnvVars.Reserved.CLIENT_SECRET.get())
            .build();

    FoundryClient client = FoundryClient.builder()
            .auth(auth)
            .connectionConfig(FoundryConnectionConfig.builder()
                    .foundryUri("https://" + System.getenv("FOUNDRY_URL"))
                    .build())
            .build();

    List<Employee> objects = client.ontology().objects().Employee().fetchStream().toList();
    return objects.get(0).toString();
}
```

:::callout{theme="neutral"}
The `CLIENT_ID` and `CLIENT_SECRET` environment variables are automatically set when using application permissions. You can access them using `EnvVars.Reserved.CLIENT_ID.get()` and `EnvVars.Reserved.CLIENT_SECRET.get()`, or directly with `System.getenv()`.
:::

[Learn more about OSDK integration.](/docs/foundry/compute-modules/osdk-integration/)

## Logging

The SDK automatically configures logging when `start()` is called. It outputs to STDOUT using SLS (`service.1`) JSON layout and automatically includes `session_id`, `job_id`, and `pid` in every log line.

### Using SafeLogger (recommended)

Use SafeLogger for structured, secure logging:

```java
import com.palantir.logsafe.SafeArg;
import com.palantir.logsafe.logger.SafeLogger;
import com.palantir.logsafe.logger.SafeLoggerFactory;

public class App {
    private static final SafeLogger log = SafeLoggerFactory.get(App.class);

    static String hello(Context context, String name) {
        log.info("Greeting user", SafeArg.of("name", name));
        return "Hello, " + name;
    }

    static Integer calculate(Context context, CalculateInput input) {
        log.debug("Starting calculation",
                  SafeArg.of("operation", input.operation()),
                  SafeArg.of("x", input.x()),
                  SafeArg.of("y", input.y()));

        try {
            int result = performCalculation(input);
            log.info("Calculation successful", SafeArg.of("result", result));
            return result;
        } catch (Exception e) {
            log.error("Calculation failed", e);
            throw e;
        }
    }
}
```

[Learn more about debugging and viewing logs.](/docs/foundry/compute-modules/debugging/)

## Important configuration

If you are using an old version of the Java SDK with `DeployedAppRuntime` instead of `ComputeModule` as the main class, navigate to the **Configure** tab and ensure the **Include runtime** option is turned **OFF**. This is required for Java compute modules with `DeployedAppRuntime` to function correctly.

## GitHub repository

The Java SDK is open source and available on GitHub:

* [palantir/java-compute-module ↗](https://github.com/palantir/java-compute-module)
