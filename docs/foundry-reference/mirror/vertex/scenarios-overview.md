<!-- source: https://palantir.com/docs/foundry/vertex/scenarios-overview/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Scenarios

Scenarios allow you to interact with your modeled universe, unlocking the ability to ask “What if” questions to simulate different operating conditions. To learn more about Palantir's high-level approach to connecting models with organizational outcomes, refer to [Models in the Ontology](/docs/foundry/ontology/models/).

Configured against your system graph, a scenario evaluates actions along with one or more modeled inputs and computes the output value to reflect the real-world interactions of your digital twin. The integrated power of Vertex allows you to model multiple sets of interactions and automatically chain these together to forward the outputs of one model as the inputs to another. This allows you to understand and interact with multiple processes across multiple systems to understand the end-to-end impact of a proposed change.

## Business logic and models in Foundry

In order to simulate operating conditions, you first need to define these conditions, their ontological relationships, and expected behavior. You can do this through the creation of [Functions on models](/docs/foundry/functions/functions-on-models/) where you can author, evaluate, and deploy business logic based on models within Foundry.

Consider models as jobs that take a pre-defined set of inputs and return a set of calculated outputs. The model version specifies the input and output parameters and can be configured alongside the ontological objects seen in your system graph. This allows you to closely align your modeled concepts with your digital twin to provide dynamic system interactions. [Learn more about Machine Learning and Modeling in Foundry.](/docs/foundry/model-integration/overview/).

Once [published as actions](/docs/foundry/action-types/function-actions-getting-started/), Functions on models will be available for configuration in Vertex, where you can interactively run scenarios to understand the impact of potential operating conditions.

Functions in Foundry enables code authors to write logic that can be executed quickly in operational contexts, such as dashboards and applications designed to empower decision-making processes. Once published, Functions can also be used in Vertex to support dynamic simulated case studies. [Learn more about Functions.](/docs/foundry/functions/overview/)

## Time series for scenarios

To understand and interact with changes to your system over time, it is critical to shape your measured values as time series in order to configure these as inputs to your model which will generate calculated time series outputs for comparison. This will allow you to monitor your current state, view historic trends, and predict future changes with simulated overrides to modeled conditions.

You can find more information on time series setup in the [time series documentation](/docs/foundry/time-series/time-series-overview/). Contact your Palantir representative for further assistance with time series.
