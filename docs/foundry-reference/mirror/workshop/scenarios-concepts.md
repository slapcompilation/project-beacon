<!-- source: https://palantir.com/docs/foundry/workshop/scenarios-concepts/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Core concepts and limitations

## Scenarios

A **Scenario** is fork of the data in the Ontology created by applying a set of [Actions](/docs/foundry/action-types/overview/) and evaluating a set of [Models](#models).

The fork contains only the edits or changes from the base [Ontology](/docs/foundry/ontology/overview/) including modified Object properties, created Objects, deleted Objects, created link types, and deleted link types.

A Scenario is immutable once created. To "modify" a Scenario, create a new Scenario with a modified set of Actions or Models. You can also duplicate a Scenario along with its existing Actions and parameters by selecting the more options **...** dropdown menu next to the name of the existing scenario.

## Models

A **Model** in Foundry is a function that estimates object properties given other object properties. This is most commonly used to estimate or forecast unknown values in the Ontology.

To use a model as part of a Scenario, wrap the model [in a Function](/docs/foundry/functions/functions-on-models/) and use it in a [Function-backed Action](/docs/foundry/action-types/function-actions-overview/).

## Domains

A **Domain** describes the valid set over which Model can be evaluated.

A Domain is defined in terms of a set of Objects in the [Ontology](/docs/foundry/ontology/overview/).

In the simplest case, a Domain will be defined as all Objects of a particular [object type](/docs/foundry/object-link-types/object-types-overview/), but more complex sets can be constructed as well.

When evaluating a Model for Objects in a Domain, the results must be *independent*.
That is, evaluating the Model over a subset of the Domain should yield the same results for those Objects as evaluating over the entire Domain.

Domains are primarily used to determine when and how Models should be evaluated in the context of Object-based applications.

However, they can also be used to improve application performance. For example, if only a subset of the Domain is used in an application, then the Model need only be evaluated over that subset. Since model results over Objects in the Domain must be independent, there is no concern that evaluating over the subset would yield different results.

## Limitations

For performance reasons, there are a few limitations that you should consider when building out your workflow using Scenarios.

* A single Scenario cannot make more than 30,000 edits to the Ontology.
* Since Scenarios infrastructure is built on top of Actions, any limits applied by Actions also apply to the Actions in your Scenario. Refer to the [Actions documentation](/docs/foundry/action-types/scale-property-limits/) for a complete list of limitations on Actions.
* If your Scenario contains a [Function-backed Action](/docs/foundry/functions/use-functions/#function-backed-actions), then that Function is subject to the limitations that exist on [Foundry Functions](/docs/foundry/functions/overview/).
* Your Scenario cannot contain more than 50 Actions.
* When loading object data from an object set in the context of a Scenario, you cannot load more than 10,000 objects. Attempting to load more than 10,000 objects will result in an error. For example, this can happen when using the `.all()` or `.allAsync()` methods in a [Foundry Function](/docs/foundry/functions/api-object-sets/#retrieving-all-objects).
* Attachment properties are not supported in Scenarios, since uploaded files will not be registered to the referencing objects.
