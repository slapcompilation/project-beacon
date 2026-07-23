<!-- source: https://palantir.com/docs/foundry/logic/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# AIP Logic

AIP Logic is a no-code development environment for building, testing, and releasing functions powered by LLMs. AIP Logic enables you to build feature-rich AI-powered functions that leverage the Ontology without the complexity typically introduced by development environments and API calls. Using Logic’s intuitive interface, application builders can engineer prompts, test, evaluate and monitor, set up automation, and more.

You can use AIP Logic to automate and support your critical tasks, whether connecting key information from unstructured inputs to your Ontology, resolving scheduling conflicts, optimizing asset performance by finding the best allocation, reacting to disruptions in your supply chain, or more.

![Introductory screen for AIP Logic, containing a button to create new Logic and a space listing your Logic functions.](/docs/resources/foundry/logic/logic-overview.png)

Logic functions can also be [automated](/docs/foundry/automate/overview/) so that [Ontology edits can be automatically applied or staged for human review](/docs/foundry/logic/aip-logic-integration-automate/).

AIP Logic provides an intuitive interface to leverage the Ontology and LLMs via a Logic function that takes inputs (like Ontology objects or text strings) and can return an output (objects and/or strings) or make edits to the Ontology. For example, the LLM-powered function below takes input data from an Ontology object and cross-references that data with a customer email to recommend a solution for a given issue based on previous resolutions.

![One AIP Logic "Use LLM" block which is given a prompt "You are my supply chain helper agent. Find other emails that describe similar events to those described in the input email (at any location). Look only at the email body. Determine the best solution based on what has worked in the past. Return your one solution recommendation, do not list findings from every email." The block has the Query objects tool setup for the "\[Titan\] Distribution Center Email" object and is provided access to the email content property. The output is set as variable name "recommended solution" in type "primitive, string".](/docs/resources/foundry/logic/block-use-llm-prompt.png)

AIP Logic is built on the same rigorous [security](/docs/foundry/security/overview/) model that governs the rest of the Palantir platform, including user and [function permissions](/docs/foundry/functions/permissions/). These platform security controls grant an LLM access only to what is necessary to complete a task.

Learn more about the [core concepts](/docs/foundry/logic/core-concepts/) of AIP Logic or [get started](/docs/foundry/logic/getting-started/) with building a Logic function.
