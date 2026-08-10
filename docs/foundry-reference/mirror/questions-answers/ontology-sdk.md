<!-- source: https://palantir.com/docs/foundry/questions-answers/ontology-sdk/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Ontology SDK

### What is the difference between tokens from the Developer Console and those from third-party applications in the context of configuring a service user for group administration?

Developer Console tokens are always locked down to specific resource scopes and are not designed for group administration tasks. To configure a service user for group administration, one should create a third-party application via the Control Panel, ensuring the application is set to `unrestricted` to avoid project scoping restrictions. This will provide the appropriate token for the desired operations.

*Timestamp:* April 13, 2024

### Can the `Upload File` endpoint in Foundry's API be used to upload a file from a local machine to a Foundry dataset?

Yes, the `Upload File` endpoint is for uploading a file to an existing Foundry dataset from a local machine.

*Timestamp:* March 21, 2024

### Why might a user receive a 403 `PermissionDenied` error when trying to write rows to stream-data-proxy using a backend service/client credentials OSDK client, and how can this be resolved?

The user should use the control-panel to create an OAuth2 client, as the tokens from the Developer Console are only intended to work with the selected data scopes and may not include necessary permissions for raw datasets/streams.

*Timestamp:* March 21, 2024

### Can an OSDK be pinned to Python 3.9 version to avoid conflicts with other packages that require Python 3.9?

No, the Python OSDK requires a Python version >=3.10 and <3.15. The other packages need to be upgraded to the supported Python versions.

*Timestamp:* July 2, 2026

### Is there a C# SDK available to work with an API, and if not, what is the alternative solution?

No, there is no C# SDK currently available. The alternative solution is to export the OpenAPI and use an open-source generator like [OpenAPI Generator ↗](https://github.com/OpenAPITools/openapi-generator) to create a C# client. Additionally, [Microsoft's OpenAPI.NET SDK ↗](https://github.com/microsoft/OpenAPI.NET) can be used for the C# generator along with [OAuth libraries for .NET ↗](https://oauth.net/code/dotnet/) for managing OAuth.

*Timestamp:* March 2, 2024

### How can one use the Typescript SDK to perform a `contains` search on a string property?

The current Typescript SDK does not support arbitrary substring matching; it can only match on whole terms and prefixes.

*Timestamp:* March 6, 2024

### Why does the `/loadObjects` API call not return properties using the inherited shared property API name?

The `/loadObjects` API call does not return properties using the inherited shared property API name because interfaces are treated as views. When you are looking at the concrete object type, you have the local properties, and when you are looking at it as an interface, you have the shared/interface properties. This design means that properties are contextually based on whether they are viewed as a part of the local concrete object or as part of an interface.

*Timestamp:* March 27, 2024

### How can custom headers be added to each call in the Python OSDK?

Custom headers can be added to each call in the Python OSDK by updating the session headers of the `FoundryClient` instance as follows:

```
client = FoundryClient(auth=auth, hostname="<https://YOUR_ENROLLMENT.palantirfoundry.com>")
client._session._session.headers = client._session._session.headers.update({
"YOUR_API_KEY_HEADER": "key_goes_here"
})

MyObject = client.ontology.objects.MyObject
print(MyObject.take(1))
```

*Timestamp:* April 15, 2024

### How can I resolve the `Authorization error invalid_request Client authentication failed` issue when trying to log into an OSDK application?

Ensure that the application is enabled for the right Organizations. The OSDK application needs to be enabled for the following Organizations:

* The Organization the application belongs to after creation. If the creator has admin permissions on the Organization, this is enabled automatically.
* Any other Organizations with users that intend to use the application. This must be done manually, and guest membership do not appl.

*Timestamp:* December 2, 2024
