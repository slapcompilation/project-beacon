<!-- source: https://palantir.com/docs/foundry/ontology/osdk-scenario/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Use scenarios with OSDK

:::callout{theme="warning" title="Experimental"}
Scenario support in the [Ontology SDK (OSDK)](/docs/foundry/ontology-sdk/overview/) is experimental and may not be available on your enrollment; be aware that the API surface described on this page is under active development and subject to change.
:::

The [Ontology SDK (OSDK)](/docs/foundry/ontology-sdk/overview/) allows you to create and interact with [Ontology scenarios](/docs/foundry/ontology/overview-ontology-scenario/) directly from your application code. A scenario-scoped client behaves like a regular OSDK client: every object you read, every aggregation you compute, and every action you apply is automatically evaluated against the scenario's isolated sandbox rather than the main Ontology.

Scenario support is available in both the TypeScript and Python OSDK. The sections below describe how to perform the following operations in each language:

* Create a new scenario or attach to an existing one.
* Read and query objects in the context of a scenario.
* Apply actions and edits within a scenario.
* Merge a scenario into the main Ontology.
* List the entities edited within a scenario.

## TypeScript OSDK

Scenario support is available in `@osdk/client` version `2.27.0` and later; generate a matching version of your SDK in [Developer Console](/docs/foundry/developer-console/create-application/).

:::callout{theme="neutral"}
[Custom widgets](/docs/foundry/custom-widgets/overview/) use the OSDK and can also create and interact with scenarios. Review [Use Ontology SDK (OSDK) in a widget set](/docs/foundry/custom-widgets/use-osdk/) for more information.
:::

### Create or attach to a scenario

Use `createScenario` to create a new scenario, or `withScenario` to attach to an existing scenario by its RID. Both functions return a scenario-scoped client.

```typescript
import { createScenario, withScenario } from "@osdk/client/unstable-do-not-use";

// Create a new scenario. This is asynchronous because it calls the platform.
const scenario = await createScenario(client);

// Or attach to an existing scenario by RID. This is synchronous and makes no network call.
const existingScenario = withScenario(client, "ri.actions..scenario.0000-...");

// Retrieve the scenario reference (RID) to persist or share.
const scenarioRid: string = scenario.getScenarioReference();
```

If the base `client` is configured with a branch, the new scenario created by `createScenario` uses that branch as its base.

You can also attach to a scenario that is stored as a [persisted scenario object](/docs/foundry/ontology/persisted-scenario/). The primary key of a persisted scenario object is its scenario reference, so pass the object's `$primaryKey` to `withScenario`.

```typescript
// `scenarioObject` is a persisted scenario object you already have, for example from an object set query.
// The scenario object's primary key is the scenario reference (RID).
const scenario = withScenario(client, scenarioObject.$primaryKey);
```

### Query objects within a scenario

The scenario client is callable exactly like a regular OSDK client. All reads are automatically scoped to the scenario.

```typescript
import { Restaurant } from "@my-app/sdk";

// Load a page of objects as they appear within the scenario.
const page = await scenario(Restaurant).fetchPage();

// Filters and aggregations are also evaluated against the scenario.
const filtered = await scenario(Restaurant)
  .where({ numberOfReviews: { $gte: 100 } })
  .fetchPage();

const counts = await scenario(Restaurant).aggregate({
  $select: { $count: "unordered" },
});
```

### Apply actions within a scenario

Apply an action through the scenario client to stage edits inside the scenario's sandbox. These edits do not affect the main Ontology until the scenario is merged.

```typescript
import { addReview } from "@my-app/sdk";

const result = await scenario(addReview).applyAction({
  restaurantId: "restaurantId",
  reviewRating: 5,
  reviewSummary: "It was great!",
});
```

:::callout{theme="warning"}
Batch actions are not supported when applying actions within a scenario. Scenarios also cannot be nested within another scenario or combined with a transaction.
:::

### Merge a scenario

To merge a scenario, apply any action type configured with an **Apply Scenario** rule. Adding this rule to an action automatically exposes a scenario parameter of type `scenarioReference`. Pass the scenario client directly as the value of that parameter; the OSDK resolves it to the scenario reference automatically.

```typescript
import { applyScenario } from "@my-app/sdk";

// `applyScenario` is an action configured with an Apply Scenario rule, which
// exposes a scenario parameter named `scenario`.
await client(applyScenario).applyAction({ scenario });
```

The action and parameter names are specific to your Ontology. Review [Merge scenarios](/docs/foundry/ontology/merge-scenario/) for guidance on configuring the **Apply Scenario** rule on an action type.

### List edited entities within a scenario

The scenario client exposes methods to discover which objects and links were edited within a scenario. These results return sparse identifiers: only the `$apiName` and `$primaryKey` fields are populated. To load full property values, pass the primary keys back through the scenario client.

#### Edited objects

Use `getEditedEntityTypes` to discover which object and link types changed, then `getEditedEntities` to page through the edited objects of a given type, or `editedEntitiesAsyncIter` to stream them.

```typescript
import { Restaurant } from "@my-app/sdk";

// Discover which object types and link types were edited in the scenario.
const { objectTypes, linkTypes } = await scenario.getEditedEntityTypes();

// Page through edited objects of a given object type.
const editedPage = await scenario.getEditedEntities(Restaurant, { pageSize: 500 });
for (const obj of editedPage.data) {
  console.log(obj.$apiName, obj.$primaryKey);
}

// Or stream all edited objects of a given object type. The iterator auto-paginates and dedupes by primary key.
for await (
  const obj of scenario.editedEntitiesAsyncIter(Restaurant, { pageSize: 500 })
) {
  console.log(obj.$primaryKey);
}
```

To load full property values for the edited objects, re-fetch them through the scenario client.

```typescript
const keys = editedPage.data.map((obj) => obj.$primaryKey);
const full = await scenario(Restaurant)
  .where({ $primaryKey: { $in: keys } })
  .fetchPage();
```

#### Edited links

Use `getEditedLinkTypes`, `getEditedLinks`, and `editedLinksAsyncIter` to inspect edited links. Each edited link is returned as a directed triple of `source`, `target`, and `linkType`. Only many-to-many links are returned; edited one-to-many links surface through `getEditedEntities` on the object type that owns the foreign key.

```typescript
import { Restaurant } from "@my-app/sdk";

// Discover which many-to-many link types for a given object type were edited.
const editedLinkTypes = await scenario.getEditedLinkTypes(Restaurant);

// Page through edited links for a given link type.
const linksPage = await scenario.getEditedLinks(Restaurant, "sisterRestaurants", {
  pageSize: 200,
});
for (const { source, target, linkType } of linksPage.data) {
  console.log(source.$primaryKey, "->", target.$primaryKey, `(${linkType})`);
}

// Or stream all edited links of a given link type.
for await (
  const { source, target } of scenario.editedLinksAsyncIter(
    Restaurant,
    "sisterRestaurants",
  )
) {
  console.log(source.$primaryKey, "->", target.$primaryKey);
}
```

## Python OSDK

Scenario support is available in Python OSDK version `2.209.0` and later. Listing edited objects and links requires version `2.221.0` or later. Scenario support is a beta feature: you must run scenario code within an `AllowBetaFeatures` context.

### Create or attach to a scenario

Use `ScenarioClient.create` to mint a new scenario, or the `ScenarioClient` constructor to attach to an existing scenario by its RID. Both return a scenario-scoped client.

```python
from foundry_sdk_runtime import AllowBetaFeatures
from osdk import FoundryClient, ScenarioClient, UserTokenAuth

with AllowBetaFeatures():
    # Create a new scenario. This calls the platform to mint the scenario.
    scenario_client = ScenarioClient.create(client)

    # Or attach to an existing scenario by RID.
    scenario_client = ScenarioClient(
        client, scenario_rid="ri.actions..scenario.0000-..."
    )

    # Retrieve the scenario reference (RID) to persist or share.
    scenario_rid = scenario_client.scenario_rid
```

The new scenario created by `ScenarioClient.create` inherits the ontology and branch of the base `client`. The base client passed to `ScenarioClient` must not itself be a scenario client.

You can also attach to a scenario that is stored as a [persisted scenario object](/docs/foundry/ontology/persisted-scenario/). The primary key of a persisted scenario object is its scenario reference, so pass the object's primary key to the `ScenarioClient` constructor.

```python
with AllowBetaFeatures():
    # `scenario_object` is a persisted scenario object you already have, for example from a query.
    # The scenario object's primary key is the scenario reference (RID).
    scenario_client = ScenarioClient(
        client, scenario_rid=scenario_object.get_primary_key()
    )
```

### Query objects within a scenario

Read and query objects through `scenario_client.ontology.objects`. All reads are automatically scoped to the scenario.

```python
with AllowBetaFeatures():
    # Load a single object as it appears within the scenario.
    restaurant = scenario_client.ontology.objects.ExampleRestaurant.get("primaryKey")

    # Load a page of objects from within the scenario.
    page = scenario_client.ontology.objects.ExampleRestaurant.page(page_size=30)
```

### Apply actions within a scenario

Apply an action through the scenario client to stage edits inside the scenario's sandbox. These edits do not affect the main Ontology until the scenario is merged.

```python
from foundry_sdk_runtime.types import ActionConfig, ActionMode

with AllowBetaFeatures():
    scenario_client.ontology.actions.add_review(
        action_config=ActionConfig(mode=ActionMode.VALIDATE_AND_EXECUTE),
        restaurant_id="restaurantId",
        review_rating=5,
        review_summary="It was great!",
    )
```

### Merge a scenario

To merge a scenario, apply any action type configured with an **Apply Scenario** rule. Adding this rule to an action automatically exposes a scenario parameter of type `scenarioReference`. Pass the scenario client (or its `scenario_rid` string) as the value of that parameter.

```python
from foundry_sdk_runtime.types import ActionConfig, ActionMode

with AllowBetaFeatures():
    # `apply_scenario` is an action configured with an Apply Scenario rule, which
    # exposes a scenario parameter named `scenario`. The action and parameter names
    # are specific to your Ontology.
    client.ontology.actions.apply_scenario(
        action_config=ActionConfig(mode=ActionMode.VALIDATE_AND_EXECUTE),
        scenario=scenario_client,  # or scenario=scenario_client.scenario_rid
    )
```

Review [Merge scenarios](/docs/foundry/ontology/merge-scenario/) for guidance on configuring the **Apply Scenario** rule on an action type.

### List edited entities within a scenario

The scenario client exposes methods to discover which objects and links were edited within a scenario. These results return sparse identifiers: only the `object_api_name` and `primary_key` fields are populated. To load full property values, pass the primary keys back through the scenario client.

#### Edited objects

Use `get_edited_entity_types` to discover which object and link types changed, then `get_edited_objects` to page through the edited objects of a given type, or `iterate_edited_objects` to stream them.

```python
from osdk.ontology.objects import ExampleRestaurant

with AllowBetaFeatures():
    # Discover which object types and link types were edited in the scenario.
    edited_types = scenario_client.get_edited_entity_types()
    print(edited_types.object_types)
    print(edited_types.link_types)

    # Load a page of edited objects of a given object type.
    edited_page = scenario_client.get_edited_objects(
        ExampleRestaurant, page_size=500
    )
    for obj in edited_page.data:
        print(obj.object_api_name, obj.primary_key)

    # Or stream all edited objects of a given object type. The iterator
    # automatically paginates and deduplicates by primary key.
    for obj in scenario_client.iterate_edited_objects(
        ExampleRestaurant, page_size=500
    ):
        print(obj.primary_key)

    # Or asynchronously stream all edited objects of a given object type.
    async for obj in scenario_client.async_iterate_edited_objects(
        ExampleRestaurant, page_size=500
    ):
        print(obj.primary_key)
```

To load full property values for the edited objects, re-fetch them through the scenario client. Deleted objects may return `None`.

```python
with AllowBetaFeatures():
    full = [
        scenario_client.ontology.objects.ExampleRestaurant.get(obj.primary_key)
        for obj in edited_page.data
    ]
```

#### Edited links

Use `get_edited_link_types`, `get_edited_links`, and `iterate_edited_links` to inspect edited links. Each edited link is returned as a directed triple of `source`, `target`, and `link_type`. Only many-to-many links are returned; edited one-to-many links surface through `get_edited_objects` on the object type that owns the foreign key.

```python
from osdk.ontology.objects import ExampleRestaurant

with AllowBetaFeatures():
    # Discover which many-to-many link types for a given object type were edited.
    edited_link_types = scenario_client.get_edited_link_types(ExampleRestaurant)

    # Load a page of edited links for a given link type.
    links_page = scenario_client.get_edited_links(
        ExampleRestaurant, "sisterRestaurants", page_size=200
    )
    for link in links_page.data:
        print(
            link.source.primary_key,
            "->",
            link.target.primary_key,
            f"({link.link_type})",
        )

    # Or stream all edited links of a given link type.
    for link in scenario_client.iterate_edited_links(
        ExampleRestaurant, "sisterRestaurants"
    ):
        print(link.source.primary_key, "->", link.target.primary_key)

    # Or asynchronously stream all edited links of a given link type.
    async for link in scenario_client.async_iterate_edited_links(
        ExampleRestaurant, "sisterRestaurants"
    ):
        print(link.source.primary_key, "->", link.target.primary_key)
```
