<!-- source: https://palantir.com/docs/foundry/developer-console/how-to-bootstrapping-java/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Bootstrap a new OSDK Java application

This page walks through the process of creating a Java application using the OSDK.

## Create a Developer Console application

Before you can create a new Java application with the OSDK, you must first [create a new Developer Console application](/docs/foundry/developer-console/create-application/) page. This will set up your application's permissions and select what objects you want your Java application to use.

### Set up a personal access token

Next, export your personal access token in your local environment. This is a token associated with your Palantir user or application that allows you to access Foundry resources through third-party applications and APIs. Below is an example using a sample personal access token, but you can generate a longer-lived one in the Developer Console.

:::callout{theme="warning"}
Do **not** check this token into source control, as this can create a security vulnerability. For instance, you should *not* include your personal access token in a Git repository.
:::

```bash
export FOUNDRY_TOKEN=<YOUR-TOKEN-FROM-GETTING-STARTED-PAGE>
```

## Confirm Java version

The Java OSDK requires a Java version between 17 and 21. To check what version of Java you are using, run the command below and upgrade Java if necessary.

```bash
java --version
```

## Install the latest version of OSDK

Add the following repository and dependency to your `build.gradle` file (or equivalent, if you are using a different build tool) to install the latest version of the SDK. Replace any `< >` with your application-specific value as found on your application **Overview** page in the Developer Console.

```
repositories {
    maven {
        credentials {
            username ''
            password System.getenv('FOUNDRY_TOKEN')
        }
        url 'https://<APPLICATION-URL>'
    }

    maven {
        credentials {
            username ''
            password System.getenv('FOUNDRY_TOKEN')
        }
        url 'https://<GENERATOR-URL>'
    }
}

dependencies {
    implementation '<YOUR-PACKAGE-NAME>'
}
```

## Develop your Java application

In your application, initialize the Foundry client and start developing. If you need to create a service user to host a backend application, a typical use case for integrating the Java SDK into an existing Java service, refer to the [guide on obtaining the required OAuth information](/docs/foundry/developer-console/how-to-bootstrapping-server-side-typescript/).

### Initialize a Foundry Client with a user token

```java
import <PACKAGE-NAME>.FoundryClient;
import <PACKAGE-NAME>.objects.Aircraft;
import com.palantir.osdk.api.Auth;
import com.palantir.osdk.api.UserTokenAuth;
import com.palantir.osdk.internal.api.FoundryConnectionConfig;

Auth auth = UserTokenAuth.builder().token(System.getenv("FOUNDRY_TOKEN")).build();
FoundryClient client = FoundryClient.builder()
        .auth(auth)
        .connectionConfig(FoundryConnectionConfig.builder()
                .foundryUri("<YOUR-FOUNDRY-URL>")
                .build())
        .build();
System.out.println(client.ontology().objects().<ANY-OBJECT>.fetch(1));
```

### Initialize a Foundry Client with OAuth

```java
import <PACKAGE-NAME>.FoundryClient;
import <PACKAGE-NAME>.objects.Aircraft;
import com.palantir.osdk.api.Auth;
import com.palantir.osdk.api.UserTokenAuth;
import com.palantir.osdk.internal.api.FoundryConnectionConfig;

Auth auth = ConfidentialClientAuth.builder()
                .clientId("<YOUR-CLIENT-ID>")
                .clientSecret("<YOUR-SECURELY-STORED-CLIENT-SECRET>")
                .build();
FoundryClient client = FoundryClient.builder()
        .auth(auth)
        .connectionConfig(FoundryConnectionConfig.builder()
                .foundryUri("<YOUR-FOUNDRY-URL>")
                .build())
        .build();
System.out.println(client.ontology().objects().<ANY-OBJECT>.fetch(1));
```
