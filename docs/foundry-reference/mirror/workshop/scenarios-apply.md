<!-- source: https://palantir.com/docs/foundry/workshop/scenarios-apply/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Apply scenarios

Applying a Scenario applies the Actions associated with the Scenario to the Ontology. These Actions are applied transactionally, such that either all of the Actions will be applied or none of them will be applied if there is a validation failure on any of the actions.

:::callout{theme="neutral"}
Note that Model results in a Scenario will *not* be applied to the Ontology as these represent expected results rather than explicitly modifiable values.
:::

Scenarios are applied using the **Scenario event** option from the **On click** configuration for a button in the Button Group widget. In the **Scenario event** configuration section, select **Apply scenario** and the Scenario variable you want to apply when this button is clicked.

![applying-scenarios-1](/docs/resources/foundry/workshop/applying-scenarios-1.png)

You can also optionally specify an Action to perform after successfully applying the Scenario to the Ontology. If an apply Action is configured, then the validation logic for that action will also be used to control apply permissions within the application. That is, the user must be able to run the configured apply Action in order to be able to apply a Scenario.

![applying-scenarios-2](/docs/resources/foundry/workshop/applying-scenarios-2.png)

If the Scenario you are applying has been saved to an object, then the button will be disabled if there are any unsaved changes to the Scenario.

![applying-scenarios-3](/docs/resources/foundry/workshop/applying-scenarios-3.png)

If you are applying a saved Scenario and using an apply Action, you can set the type class `scenarios:scenario-object-locator` on an object parameter of the apply Action to automatically populate the parameter with the object backing the saved Scenario. In this way, you can modify workflow specific metadata of the saved Scenario object when successfully applied.

![applying-scenarios-4](/docs/resources/foundry/workshop/applying-scenarios-4.png)
