<!-- source: https://palantir.com/docs/foundry/action-types/action-log/ · mirrored 2026-09-04 from Palantir Foundry docs -->

# Action log

The action log models successful action submissions as object types to be analyzed and displayed in object-aware Foundry tooling. Use an action log object type as an input to decision-making workflows and to monitor changes to your Ontology.

:::callout{theme="neutral"}
The action log is designed to capture decisions made by submitting actions and make these decisions available as data in the Ontology. For use cases where
logging all edits to an object is desired, [edit history](/docs/foundry/object-edits/user-edit-history/) can be enabled for an object type.
:::

## Background

Actions are the primary way to modify the Ontology and trigger related side effects. Often, these Ontology modifications are the result of a specific decision or are accompanied by data audit requirements. The action log simplifies generation and maintenance of object types that represent these decisions and data edits. For easy identification, a generated action log object type takes the display name `[Log] <action type name>` and the plural display name `[Logs] <action type name>`.

## When to use the action log

Foundry offers several capabilities that answer questions about change, and they are not interchangeable. Use the following table to choose between them.

| Question you need to answer | Capability to use |
|--- |--- |
| What decision was made, by whom, when, and in what context? | **Action log** |
| What is the full history of every edit to this object, regardless of how the edit was made? | [Edit history](/docs/foundry/object-edits/user-edit-history/) |
| How often does this action succeed or fail, and how long does it take? | [Action metrics](/docs/foundry/action-types/action-metrics/) |
| How do I undo the edits an action applied? | [Undo or revert actions](/docs/foundry/action-types/action-reverts/) |
| How do I get alerted when an action starts failing? | [Monitoring](/docs/foundry/action-types/monitoring/) |

Two consequences of this division are worth stating directly:

* The action log records **successful** action submissions only. It does not record failures. [Action metrics](/docs/foundry/action-types/action-metrics/#action-failure-types) track failures.
* The action log records edits made **through action types**. Edits applied outside an action type, such as direct writes to the backing datasource or legacy Foundry Forms writeback, do not produce action log objects. Note that this is about the path, not the client: an action type applied through the API or an SDK produces an action log object just as it does in the user interface, and Object Explorer [inline edits](/docs/foundry/action-types/inline-edits/) are action-backed and therefore logged. If you need coverage of every edit regardless of path, review [how edits are applied](/docs/foundry/object-edits/how-edits-applied/).

## Where to configure the action log

The action log is configured in [Ontology Manager](/docs/foundry/ontology-manager/overview/) in two independent places.

**To generate action log objects for a single action type:** Open the action type and select the **Capabilities** tab. Find the **Create action log objects** section, which the interface describes as *Generate an object every time this action is triggered successfully*. Enable the toggle, then select **Generate object type** to create the backing action log object type.

**To require an action log on every action that edits a given object type:** open the object type, select the **Datasources** tab, then find the **Edits** section and enable **Only allow Action types with action logs**. The interface describes the effect as *All actions that edit objects of this type will need an action log in order to function.*

:::callout{theme="warning" title="The action log requirement toggle is hidden until edits are enabled"}
**Only allow Action types with action logs** only appears when the object type already has edits enabled. If you cannot find the toggle, first enable **Allow edits** on the object type, save your changes, and then return to the **Datasources** tab. Review [allow users to edit objects and links](/docs/foundry/object-link-types/allow-editing/) for how to enable edits. Turning **Allow edits** off again also clears this setting.
:::

## Action log Ontology

Action log object types map one-to-one with action types. Submitting an action generates a single new object of the corresponding action log object type. This newly-created object is automatically linked to all objects edited by the submitted action. By modeling log object types one-to-one with action types, the action log supports capturing context beyond specific object edits, such as which other objects were concurrently edited and the state of the world (as represented by the Ontology) at the time of action submission.

For example, imagine a `Close Alerts` action type that modifies the "Status" property of many selected `Alert` objects to "Closed". When configured with an action log, closing 10 `Alert` objects at once will yield a single `action log` object with foreign key links to all 10 `Alert` objects.

:::callout{theme="neutral"}
To apply an action log-backed action type, users need the appropriate permissions for the action log object type, just as they do for any other object types that the action type might create or modify through rules and functions. Review [permissions](/docs/foundry/action-types/permissions/) for the full action type permission model.
:::

### Action log schema

The **Create action log objects** section presents the values it can capture under **Values to log**, split into **Required values** and **Optional values**. Values in the **Required values** group cannot be removed from the configuration. The action log summary is configured separately, in the **Summary** section above **Values to log**.

**Required values** include the following:

* **Action RID:** Unique identifier for a single action submission
* **Action type RID:** Unique identifier for a single action type
* **Action type version:** Version number that auto-increments each time an action type is updated
* **Current timestamp:** UTC timestamp of action submission
* **Current user:** Multipass user ID for the submitting user
* **Edited objects:** Primary key values of all objects edited by the action. Note that storing properties of edited objects other than the primary key is not supported.

The **Required values** group also includes provenance for side effects and reverts, which are useful when auditing why an edit happened:

* Identifiers of the webhooks the action invoked, both synchronous and asynchronous
* Identifiers of the notifications the action sent, and the users notified
* The RID of the [scenario](/docs/foundry/ontology/overview-ontology-scenario/) the action was applied in, if any
* Whether the action was reverted, and the user and timestamp of the revert

**Optional values** include the following:

* **Parameter values**
* **Property values of object reference parameters** (this is not supported for object reference parameters if `allow multiple values` is enabled)

Action log object types can be configured to store object properties that are not edited by the action. This allows you to store data edits as well as relevant information about the context of or motivation for the Ontology edits.

Returning to the example of a `Close Alerts` action type, imagine the `Alert` objects also have a "Priority" property containing values "High Priority" and "Low Priority" as well as a "Created at" timestamp and a "Source" machine. The action log supports storing these properties, even if they are not edited by `Close Alerts`. By aggregating on "Priority", without editing the column we can answer questions such as "where is the source of most "High Priority" alerts?" or "how long does it take to close "High Priority" alerts?".

#### Summary

The **Summary** section, above **Values to log**, holds a customizable string describing the action. The interface describes it as *Add a human readable summary of what happened. You can reference parameters by hitting `/`*.

### Limits and constraints

Review the following constraints before you design a workflow around the action log.

| Constraint | Detail |
|--- |--- |
| Property types are fixed once created | The type of an action log property cannot be changed after the property is created. If the type of a source property that the log maps to changes later, the action type fails validation. To recover, create a new action log property with the new type and update the mapping to reference it. |
| Summary length | An action log summary accepts a maximum of 20 parts. Each literal text part accepts a maximum of 50 characters. This length limit does not apply to parameter parts. |
| Summary content | An action log summary cannot reference object type parameters. |
| Object reference parameters | Only single-value object reference parameters can contribute property values to the log. Parameters with `allow multiple values` enabled cannot. |
| Media reference parameters | Parameters that use media references are excluded from action logs. |
| No backfill | Enabling an action log does not create log objects for actions that were already submitted. Logging begins from the point the configuration is saved. |
| Edit limits | Action log objects are subject to the same [scale and property limits](/docs/foundry/action-types/scale-property-limits/#edit-limits) as other object edits. |

## Action log on function-backed action types

To configure the action log for a function-backed action type, the backing Ontology edit function must have `Edits` provenance configured. See the [functions documentation](/docs/foundry/functions/edits-overview/) for more information on `Edits` provenance.

## Action log timeline

You can view action log object types in a timeline using the [Action Log Timeline](/docs/foundry/workshop/widgets-action-log-timeline/) widget in Workshop. Configure the timeline to support data audits and answer the questions "what changed, by whom, and when?"

Within Workshop, action log object types can be unioned together for a holistic view of edits within a use case or across an Ontology.

Configure the action log timeline by selecting the edited object type. Then choose which action log object types to display, along with the desired action log object type properties.

Action logs can also be displayed alongside object comments in a single feed using the [Comments](/docs/foundry/workshop/widgets-comments/#action-log) widget.

## Troubleshooting

The following messages are surfaced by the platform when an action log is misconfigured.

| Message | Meaning and resolution |
|--- |--- |
| `Action Log required but not enabled` | An action type does not have an action log, but an action log is required for an object type it edits. Enable **Create action log objects** on the action type's **Capabilities** tab. |
| `Associated object type is missing. Logs are not being recorded.` | The action log object type that backed this configuration no longer exists, so no logs are being written. Select **Generate object type** to create a new one. |
| `Action log has no writeback dataset defined` | The action log object type has no writeback dataset, so it cannot store log objects. Configure the **Writeback datasource** for the action log object type. |
| `This property will not be used for logging until indexing is complete.` | A newly added action log property is waiting on indexing. Logging for that property begins once indexing finishes. |
| `Function has no Edits Decorator` | The function backing the action type does not declare `Edits` provenance, which the action log requires. Review the [functions documentation](/docs/foundry/functions/edits-overview/). |

:::callout{theme="neutral" title="Terminology note"}
Some platform messages refer to an *action log rule*. This is the same configuration as the **Create action log objects** section on the action type's **Capabilities** tab.
:::

## Next steps

* [Display action logs in a timeline with the Action Log Timeline widget.](/docs/foundry/workshop/widgets-action-log-timeline/)
* [Monitor action success, failure, and duration with action metrics.](/docs/foundry/action-types/action-metrics/)
* [Track every edit to an object with edit history.](/docs/foundry/object-edits/user-edit-history/)
* [Review the action type permission model.](/docs/foundry/action-types/permissions/)
