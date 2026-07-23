<!-- source: https://palantir.com/docs/foundry/functions/use-functions/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Use functions in the platform

This section documents various ways that you can use functions throughout the Foundry platform. This list is kept mostly up to date, but there may be additional ways to use functions that are not captured here.

## Workshop

[Workshop](/docs/foundry/workshop/overview/) supports integration with functions in a variety of ways, enabling the use of custom logic throughout modules built in Workshop.

### Variables

Most Workshop [Variables](/docs/foundry/workshop/concepts-variables/) can be Function-backed, allowing an application builder to use functions to compute values that can then be used throughout Workshop. By default, the value for a variable is recomputed when another variable it depends on is updated. This enables flexible recomputation of values in response to user feedback—for example, when a user edits an input component, a dependent Function-backed Object Set variable will be recomputed automatically.

To learn more, take a look at the [tutorial on how to use functions to back Workshop variables](/docs/foundry/workshop/functions-use/#function-backed-variables-in-workshop).

Below is the mapping between Workshop variable types and their equivalents in TypeScript. A Workshop variable of each given type can be backed by a Function that returns one of the valid types listed. [Learn more about the available Function types are documented.](/docs/foundry/functions/types-reference/)

* Boolean: `boolean`
* String: `string`
* Numeric: `Integer`, `Long`, `Float`, `Double`
* Date: `LocalDate`
* Timestamp: `Timestamp`
* Array: `BaseType[]` or `Set<BaseType>`
* Object Set: `ObjectSet<ObjectType>` (recommended), `ObjectType[]`, or `Set<ObjectType>`

### Object Table: Derived properties

Workshop’s **Object Table** widget can be configured to compute a Function-backed column, which can update based on user input and will be recomputed on the fly as end users scroll through the table. You can see a [full tutorial for using this functionality](/docs/foundry/workshop/widgets-object-table/#function-backed-columns).

### Chart: Derived aggregations

Workshop’s **Chart: XY** widget supports using a Function-backed aggregation to derive aggregated values on demand. This can be useful if you want to have aggregation data be based on user selection. To use functions in a Chart widget, simply click to configure a chart layer and select *Function aggregation*.

![use-functions-chart](/docs/resources/foundry/functions/use-functions-chart.png)

A [reference for the Aggregation API](/docs/foundry/functions/types-reference/#aggregation-types) is available. For more advanced use cases, you may want to read the documentation about [how to compute custom aggregations](/docs/foundry/functions/create-custom-aggregation/).

## Actions

[Action types](/docs/foundry/action-types/overview/) enable applications to make changes to the objects in the Foundry ontology and to dispatch external notifications and side effects in a way that is flexible and secure. Within Actions, functions provide complete flexibility, enabling code authors to define how objects should be updated or how side effects should be configured.

### Function-backed Actions

Function-backed Actions use the [Ontology edits](/docs/foundry/functions/api-ontology-edits/) API to define the logic for how objects should be updated. This allows you to express complex edits in code—for example, updating every objected linked to some starting object. [See a tutorial for how to use Function-backed Actions end-to-end.](/docs/foundry/action-types/function-actions-getting-started/)

### Side effects: Notifications

An Action can be configured to send a Notification to a specified user. You can use functions to compute which users should receive a Notification, as well as the contents of the Notification itself. This provides flexibility such as loading recipient user IDs that are stored within objects, or rendering email content based on object data. To learn more, consult the [full documentation about Notifications](/docs/foundry/action-types/notifications/) and a [guide for how to use functions to configure Notifications](/docs/foundry/functions/configure-notifications/).

### Side effects: Webhooks

An Action can also be configured to trigger a Webhook when it is applied. Webhooks enable integration of Foundry with other systems, enabling user-applied Actions to write back to APIs outside of Foundry. You can use functions to compute the parameters that should be sent to the Webhook that will be executed, enabling workflows like populating Webhook parameters based on object data. [View full documentation about Webhooks.](/docs/foundry/action-types/webhooks/)

## Slate

[Slate](/docs/foundry/slate/overview/) includes native support for finding and using functions within the **Platform** tab. When editing a Slate document, open the Platform tab and add a **Foundry Function** in the bottom-left. Now, you can search for a Function, configure parameters, and use the result in your Slate document.

![use-functions-slate](/docs/resources/foundry/functions/use-functions-slate.png)

Note that for historical reasons, the Slate product has its own notion of "functions", which are snippets of JavaScript logic located within each Slate document. This is why the functions product is called "Foundry functions" and is located under the **Platform** tab. Slate's functions capability allows for quick, easy data manipulation within a document, but do not have native support for objects.

You can use Slate's functions and Foundry functions in combination with each other—for example, you could return data from a Foundry Function and manipulate it in a Slate Function, or use a Slate Function to compute parameters that should be passed into a Foundry Function.

## Quiver

[Object set plots](/docs/foundry/quiver/objects-chart-drilldown/#code-function-categorical-plot) in Quiver use the same underlying component as Workshop's Chart: XY widget. As such, you can use Function-backed Aggregations in Quiver analyses as well.

## Automate

[Automate](/docs/foundry/automate/overview/) allows you to create function-backed automations, which automatically execute functions when a specified condition is met.

When configuring a Function effect, you can select a function and specify its version. For stable versions (1.0.0 and greater), you can enable automatic upgrades to compatible versions. Functions in Automate execute asynchronously and can run for up to 4 hours.

Note that functions with ontology edit return types will not have the edits applied when used as effects in Automate. To learn more, see the [Function effects documentation](/docs/foundry/automate/effect-function/).
