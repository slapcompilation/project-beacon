<!-- source: https://palantir.com/docs/foundry/object-monitors/evaluation/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Evaluation

:::callout{theme="warning"}
Object Monitors are superseded by [Automate](/docs/foundry/automate/overview/). Automate is a fully backward-compatible product that offers a single entry point for all business automation in the platform.
:::

Object monitors are evaluated and Action effects are executed individually by subscriber. This ensures that data access permissions and Action validations that rely on user attributes are respected while allowing users to configure object monitors for their individual workflows.

### Realtime evaluation

Some input and condition combinations support realtime evaluation. Object monitors that support it will be continuously evaluated. Notifications or Actions are usually executed within a few minutes of detected changes. If a large number of changes are synced from a pipeline build, the evaluation of monitors using those objects as inputs and its subsequent Actions or notifications may take a longer time to execute.

To support realtime evaluation, all of the following must be true:

* The input object type has been migrated to [Object Storage v2](/docs/foundry/object-backend/overview/#evolution-of-the-ontology-backend) in the Ontology configuration.
* The input object type has less than 10 million object instances. If a condition is being evaluated in realtime and the object type grows beyond this limit due to new objects being added, the monitor will fail to evaluate.
* The input object set definition uses only exact-match filters on strings, ranges of numbers, or boolean properties.
* The input object set definition does not contain linked object properties or array properties.
* The rule uses an [event condition](/docs/foundry/object-monitors/condition/#event) for objects added or removed from input.

#### Scheduling monitors

:::callout{theme="neutral"}
Realtime evaluation only applies to changes coming from a pipeline build. Changes made through Actions may take up to seven hours before they are detected by Object Monitors. To shorten this time, include a [notification rule](/docs/foundry/action-types/set-up-notification/#add-a-notification) to any Action that must trigger an immediate notification.
:::

While realtime evaluation does not currently support scheduling monitors, it is possible to configure a function-backed Action to run when the object monitor detects an event between certain hours, using TypeScript to detect the current time/day. This code snippet shows an example:

```typescript
@Edits(ObjectType)
@OntologyEditFunction()
public someEditFunction(): void {
    const currentTime = Timestamp.now()
    const currentHour = currentTimestamp.getHours();
    if (currentHour >= 0 && currentHour < 12) {
      // Perform edits
    }
}
```

### Non-realtime evaluation

Object monitors that cannot be evaluated in realtime are evaluated using a polling mechanism. Monitors are guaranteed to evaluate within 24 hours of the previous evaluation. To distribute the load of evaluating for large numbers of monitors, the specific time when a polling-based evaluation occurs cannot be explicitly scheduled. The last-evaluated time for polling-based monitors is stored and displayed in the in the monitor overview panel of the Object Monitors application interface.

### Manual evaluation

Non-realtime object monitors may also be evaluated manually from the Object Explorer interface. This option is primarily intended for testing when setting up non-realtime monitors.

![Manual evaluation button in Object Explorer](/docs/resources/foundry/object-monitors/manual_evaluation_button.png)
