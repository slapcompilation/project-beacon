<!-- source: https://palantir.com/docs/foundry/api/v2/general/overview/getting-started/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Getting started

To make API calls, please follow the subsequent steps.

1. [Find your hostname](#find-your-hostname)
2. [Get an authentication token](#get-an-authentication-token)
3. [Make a request](#make-a-request)

## Find your hostname

The hostname is present in all URLs when accessing Palantir applications through the user interface.
Find your hostname from your browser's URL address bar while logged into Palantir.
The hostname should look like the following: `https://<hostname>/`.

## Get an authentication token

Follow the steps in [Authentication](/docs/foundry/api/general/overview/authentication/) to get an authentication token.

## Make a request

After getting your hostname and authentication token, you can use API clients to interact with the API.

All API calls to Foundry API should use HTTPS and the hostname for the particular instance.

To simplify the process of making API calls, use the [Foundry platform SDKs](/docs/foundry/api/general/overview/sdks/) for supported languages.

### Example Requests

- [cURL](#using-curl)
- [Python](#using-python)
- [Node JS](#using-nodejs)
- [Java](#using-java)

#### Using cURL

Run the following to get the list of `employee` objects in your `company` Ontology by calling the [list objects](/docs/foundry/api/v2/ontologies-v2-resources/ontology-objects/list-objects/) endpoint:

```bash
curl -H "Content-type: application/json" -H "Authorization: Bearer $FOUNDRY_TOKEN" \ # Store token securely or use OAuth2
 "https://<hostname>/api/v2/ontologies/company/objects/employee"
```

To send a POST request, use the `-d` flag to include a POST body and be sure to set a `Content-type` of `application/json`.

Run the following to call the [apply action](/docs/foundry/api/v2/ontologies-v2-resources/actions/apply-action/) endpoint and trigger the `rename-employee` action:

```bash
curl -X POST -H "Content-type: application/json" -H "Authorization: Bearer $FOUNDRY_TOKEN" \ # Store token securely or use OAuth2
 "https://<hostname>/api/v2/ontologies/company/actions/rename-employee/apply" \
 -d '{"parameters": {"id": 80060, "newName": "Anna Smith-Doe"}}'
```

<a id="using-python"></a>
#### Using the Python SDK 

Run the following to get the list of `employee` objects in your `company` Ontology by calling the [list objects](/docs/foundry/api/v2/ontologies-v2-resources/ontology-objects/list-objects/) endpoint:

```python
import foundry_sdk
import os

auth = foundry_sdk.UserTokenAuth(token=os.environ["BEARER_TOKEN"]) # Store token securely or use OAuth2
client = foundry_sdk.FoundryClient(auth=auth, hostname="<hostname>")

employees = client.ontologies.OntologyObject.list(
    ontology="company",
    object_type="employee",
    page_size=10
)

print(employees)
```

Run the following to call the [apply action](/docs/foundry/api/v2/ontologies-v2-resources/actions/apply-action/) endpoint and trigger the `rename-employee` action:

```python
import foundry_sdk
import os

auth = foundry_sdk.UserTokenAuth(token=os.environ["BEARER_TOKEN"]) # Store token securely or use OAuth2
client = foundry_sdk.FoundryClient(auth=auth, hostname="<hostname>")

response = client.ontologies.Action.apply(
    ontology="company",
    action="rename-employee",
    parameters={"id": 80060, "newName": "Anna Smith-Doe"},
)

print(response)
```

#### Using NodeJS

:::callout{theme=neutral}
These requests should be executed from a NodeJS client, not from a browser.
:::

Run the following to get the list of `employee` objects in your `company` Ontology by calling the [list objects](/docs/foundry/api/v2/ontologies-v2-resources/ontology-objects/list-objects/) endpoint:

```javascript
var bearerToken = process.env.FOUNDRY_TOKEN; // Store token securely or use OAuth2; never send service user tokens to the browser
var url = "https://<hostname>/api/v2/ontologies/ri.ontology.main.ontology.efc12906-e7cd-49dc-b102-ff73e52535c8/objects/employee";
fetch(url, {
    headers: {
      "Authorization": "Bearer " + bearerToken
    }
  }).then(response => response.json())
  .then(data => console.log(JSON.stringify(data)));
```

Run the following to call the [apply action](/docs/foundry/api/v2/ontologies-v2-resources/actions/apply-action/) endpoint and trigger the `rename-employee` action:

```javascript
var bearerToken = process.env.FOUNDRY_TOKEN; // Store token securely or use OAuth2; never send service user tokens to the browser
var url = "https://<hostname>/api/v2/ontologies/ri.ontology.main.ontology.efc12906-e7cd-49dc-b102-ff73e52535c8/actions/rename-employee/apply";
var requestBody = {"parameters": {"id": 80060, "newName": "Anna Smith-Doe"}};
fetch(url, {
    method: 'POST',
    headers: {
      "Authorization": "Bearer " + bearerToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  }).then(response => response.json())
  .then(data => console.log(data));
```

#### Using Java 

Run the following to get the list of `employee` objects in your `company` Ontology by calling the [list objects](/docs/foundry/api/v2/ontologies-v2-resources/ontology-objects/list-objects/) endpoint:

```java
String bearerToken = System.getenv("FOUNDRY_TOKEN"); // Store token securely or use OAuth2
String url = "https://<hostname>/api/v2/ontologies/ri.ontology.main.ontology.efc12906-e7cd-49dc-b102-ff73e52535c8/objects/employee";
HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .header("Authorization", "Bearer " + bearerToken)
        .build();
HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

System.out.println(response.body());
```

Run the following to call the [apply action](/docs/foundry/api/v2/ontologies-v2-resources/actions/apply-action/) endpoint and trigger the `rename-employee` action:

```java
String bearerToken = System.getenv("FOUNDRY_TOKEN"); // Store token securely or use OAuth2
String url = "https://<hostname>/api/v2/ontologies/ri.ontology.main.ontology.efc12906-e7cd-49dc-b102-ff73e52535c8/actions/rename-employee/apply";
String requestBody = "{\"parameters\": {\"id\": 80060, \"newName\": \"Anna Smith-Doe\"}}";

HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .header("Authorization", "Bearer " + bearerToken)
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(requestBody))
        .build();
HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

System.out.println(response.body());
```
