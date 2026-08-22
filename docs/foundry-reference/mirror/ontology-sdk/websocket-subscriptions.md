<!-- source: https://palantir.com/docs/foundry/ontology-sdk/websocket-subscriptions/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Subscribe to changes in object sets via WebSocket

The TypeScript OSDK's [`.subscribe`](/docs/foundry/ontology-sdk/typescript-subscriptions/) method uses the WebSocket protocol to stream object updates to the client. You can also directly establish a connection to our Object Set Watcher endpoint (located at `/api/v2/ontologySubscriptions/ontologies/{ontology}/streamSubscriptions`) to subscribe to an object set.

## Endpoint

```
wss://{foundryUrl}/api/v2/ontologySubscriptions/ontologies/{ontology}/streamSubscriptions
```

Replace `{foundryUrl}` with your Foundry instance's URL (without the `https://` prefix) and `{ontology}` with your ontology's API name.

## Authentication

Connections are authenticated by passing `"Bearer-{token}"` as a sub-protocol on the WebSocket. Note that the WebSocket version of our bearer token authentication uses a `-` before the token instead of the space that our REST APIs use.

## Message format

Communication occurs through JSON-serialized messages. The client sends subscription requests. The server responds with subscription confirmations or errors, as well as object updates for subscribed object sets.

## Subscribing to an object set

Send a message to establish subscriptions:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "requests": [
    {
      "objectSet": {
        "type": "base",
        "objectType": "Country"
      },
      "propertySet": ["population", "countryName"],
      "referenceSet": []
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | A unique request ID to correlate with the response |
| `requests` | array | Yes | List of object sets to subscribe to |
| `requests[].objectSet` | object | Yes | The object set definition |
| `requests[].propertySet` | string\[] | No | Property API names to include in updates. If omitted, all properties are returned. |
| `requests[].referenceSet` | string\[] | No | Reference property API names to subscribe to (for example, geotemporal series) |
| `requests[].objectLoadingResponseOptions` | object | No | Optional response configuration |
| `requests[].objectLoadingResponseOptions.shouldLoadObjectRids` | boolean | No | Whether to include object RIDs in responses (default: false). Including RIDs adds latency, so only enable this if necessary. |

You can filter the object set using [standard](/docs/foundry/api/v2/ontologies-v2-resources/ontology-object-sets/load-object-set) object set syntax:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "requests":[
    {
      "objectSet": {
        "type": "filter",
        "objectSet": {
          "type": "base",
          "objectType": "Country"
        },
        "where": {
          "type": "gte",
          "field": "population",
          "value": 1000000
        }
      },
      "propertySet": ["population"]
    }
  ]
}
```

## Managing subscriptions

Sending a new subscription message updates your active subscriptions. The server compares your new request list against existing subscriptions. Matching subscriptions remain open, missing subscriptions are closed, and new subscriptions are opened.

To unsubscribe from all object sets, send an empty requests array:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "requests": []
}
```

## Object set updates

The client will receive different message types throughout the subscription lifecycle.

#### `subscribeResponses`

Sent after receiving a subscribe request, containing a response for each requested subscription:

```json
{
  "type": "subscribeResponses",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "responses": [
    {
      "type": "success",
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    }
  ]
}
```

A successful response includes a subscription ID that identifies updates for that subscription. Error responses include diagnostic information:

```json
{
  "type": "subscribeResponses",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "responses": [
    {
      "type": "error",
      "errors": [
        {
          "error": "INVALID_OBJECT_TYPE",
          "args": [{ "name": "objectType", "value": "InvalidType" }]
        }
      ]
    }
  ]
}
```

If you receive a subscription response with a `type` of `"qos"`, the server is under heavy load. We recommend using exponential backoff with jitter to retry requests.

#### `objectSetChanged`

Sent when objects in your subscribed object set are added, updated, or removed:

```json
{
  "type": "objectSetChanged",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "updates": [
    {
      "type": "object",
      "object": {
        "__apiName": "Country",
        "__primaryKey": "US",
        "countryName": "United States",
        "population": 331000000
      },
      "state": "ADDED_OR_UPDATED"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `object` | The updated object with requested properties |
| `object.__apiName` | The object type API name |
| `object.__primaryKey` | The object's primary key value |
| `state` | Either `"ADDED_OR_UPDATED"` or `"REMOVED"` |

When `state` is `"REMOVED"`, the object was either deleted or no longer matches the object set filter.

For subscriptions with reference properties (like geotemporal series), you may receive reference updates:

```json
{
  "type": "objectSetChanged",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "updates": [
    {
      "type": "reference",
      "objectType": "Aircraft",
      "primaryKey": { "aircraftId": "AC-123" },
      "property": "currentLocation",
      "value": {
        "type": "geotimeSeriesValue",
        "position": { "type": "Point", "coordinates": [-122.4194, 37.7749] },
        "timestamp": "2024-01-15T10:30:00Z"
      }
    }
  ]
}
```

#### `refreshObjectSet`

Indicates that the server cannot provide incremental updates. You should reload the object set with a normal HTTP request to the standard [load object set](/docs/foundry/api/v2/ontologies-v2-resources/ontology-object-sets/load-object-set) endpoint:

```json
{
  "type": "refreshObjectSet",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "objectType": "Country"
}
```

#### `subscriptionClosed`

Indicates that a subscription has been closed. This can occur for several reasons, such as errors:

```json
{
  "type": "subscriptionClosed",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "cause": {
    "type": "error",
    "error": "SUBSCRIPTION_MEMORY_LIMIT_EXCEEDED",
    "args": []
  }
}
```

Subscriptions are also closed when you remove a subscription from your request list:

```json
{
  "type": "subscriptionClosed",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "cause": {
    "type": "reason",
    "reason": "USER_CLOSED"
  }
}
```

## Limitations

* Object sets constructed using joins are not fully supported. The server watches the selected portion and sends notifications when it changes, but cannot guarantee completeness.
* Subscriptions do not persist across server restarts. Implement reconnection logic in your client.
* Memory limits apply per subscription. Subscriptions tracking large numbers of objects may be closed if limits are exceeded.
* Some advanced full-text search filters are not supported for subscription filtering.
* When subscribing to an interface object set, object updates are returned as their underlying object types. You must remap object properties to interface properties when processing updates.

## Interfaces

To handle interface object set subscriptions, you need to fetch mappings from object property types to their corresponding interface property types. This can be done via the [Load Object Type Full Metadata](/docs/foundry/api/v2/ontologies-v2-resources/object-types/get-object-type-full-metadata) endpoint. This beta endpoint returns the full metadata for the requested object type, including interface property mappings for all implemented interfaces.

The object type API name is accessible via the updated object's `"__apiName"` key. For an interface with API name `interfaceType` and a [Load Object Type Full Metadata](/docs/foundry/api/v2/ontologies-v2-resources/object-types/get-object-type-full-metadata/) response `response`, the returned interface mappings can be accessed via `response["implementsInterfaces2"][interfaceType]["properties"]`. This mapping is from object property type API name to the corresponding interface property type API name.

We recommend caching these property mappings for the lifetime of the subscription.

## Python Example

Below is a sample Python script showing how to subscribe to a filtered object set and process updates. This example does not show how to remap interface properties.

```python
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "websockets",
# ]
# ///
import asyncio
import json
import os
import uuid

from websockets.asyncio.client import connect

TOKEN = ...
FOUNDRY_URL = ...
ONTOLOGY_RID = ...


async def main() -> None:
    filtered_object_set = {
        "type": "filter",
        "objectSet": {
            "type": "base",
            "objectType": "Country",
        },
        "where": {
            "type": "gte",
            "field": "population",
            "value": 10000000,
        },
    }
    subscribe_msg = {
        "id": str(uuid.uuid4()),
        "requests": [
            {
                "objectSet": filtered_object_set,
                "propertySet": ["timeUntilNextFlight", "aircraftRegistration"],
            },
        ],
    }

    open_subscriptions: set[str] = set()

    async with connect(
        f"wss://{FOUNDRY_URL}/api/v2/ontologySubscriptions/ontologies/{ONTOLOGY_RID}/streamSubscriptions",
        subprotocols=[f"Bearer-{TOKEN}"],  # Bearer token authentication
    ) as websocket:
        await websocket.send(json.dumps(subscribe_msg))

        async for message in websocket:
            match json.loads(message):
                case {"type": "subscribeResponses", "responses": [*responses]}:
                    for response in responses:
                        match response:
                            case {"type": "success", "id": identifier}:
                                print(f"Subscribed: ID {identifier}")
                                open_subscriptions.add(identifier)
                            case {"type": "error", "errors": [*errors]}:
                                print(f"Subscription errors: {errors}")
                    if not any(response["type"] == "success" for response in responses):
                        print("All subscriptions failed. Exiting.")
                        return

                case {"type": "objectSetChanged", "updates": [*updates]}:
                    for update in updates:
                        match update:
                            case {"type": "object", "state": state, "object": {**obj}}:
                                print(f"{state}: {obj}")
                            case {
                                "type": "reference",
                                "property": prop,
                                "primaryKey": primary_key,
                            }:
                                print(f"Reference update: {primary_key} <- {prop}")

                case {"type": "refreshObjectSet", "objectType": object_type}:
                    print(f"Refresh required for object type: {object_type}")

                case {
                    "type": "subscriptionClosed",
                    "id": identifier,
                    "cause": {**cause},
                }:
                    print(f"Subscription {identifier} was closed: {cause}")
                    open_subscriptions.remove(identifier)
                    if not open_subscriptions:
                        print("All subscriptions closed. Exiting.")
                        return


if __name__ == "__main__":
    asyncio.run(main())

```
