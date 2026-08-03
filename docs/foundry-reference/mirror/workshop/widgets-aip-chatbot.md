<!-- source: https://palantir.com/docs/foundry/workshop/widgets-aip-chatbot/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# AIP Chatbot

The AIP Chatbot widget (formerly known as the AIP Agent widget) allows you to use interactive assistants equipped with enterprise-specific information and tools in your operational workflows in Workshop.

![AIP Chatbot Widget configured to use a parameterized AIP Chatbot.](/docs/resources/foundry/workshop/chatbot-widget-overall.png)

You can configure the widget to interact with an AIP Chatbot configured in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/) (recommended, ["AIP Chatbot"](#base-configuration-aip-chatbot) tab in screenshot below) or a chatbot defined in workshop configurations (deprecated, ["Legacy"](#base-configuration-legacy) tab in screenshot below). Chatbots configured in AIP Chatbot Studio can also be orchestrated with Workshop [Commands](/docs/foundry/cross-app-interactivity/commands-overview/) to declare and execute operations in other embedded Palantir applications. When used together, chatbots can read from and write to those applications via Commands to drive cross-application workflows.

<img src="./media/chatbot-widget-chatbot-or-legacy.png" alt="AIP Chatbot Widget base configuration choices." width="400">

## Base configuration (AIP Chatbot)

Review [AIP Chatbot Studio documentation](/docs/foundry/chatbot-studio/overview/) for an overview of AIP Chatbots, but follow the instructions below to add an AIP Chatbot to your workflow.

### Configure the AIP Chatbot

Choose the AIP Chatbot, the published version you want to be included, and whether chatbot reasoning should be shown.

<img src="./media/chatbot-widget-chatbot-empty.png" alt="AIP Chatbot configuration empty state." width="400">

### Configure application state

Assuming you have [properly configured at least one application variable](/docs/foundry/chatbot-studio/application-state/#configure-application-state-in-aip-chatbot-studio) in AIP Chatbot Studio, the option to map those application variables to [Workshop variables](/docs/foundry/workshop/concepts-variables/) will be shown. Once configured, the AIP Chatbot can interact with the variable according to the read/write permissions defined in AIP Chatbot Studio.

<img src="./media/interactive-widget-agent-application-variable-empty.png" alt="Application state configuration empty state." width="400">

### Auto-send a message

You can automatically send messages to the configured AIP Chatbot from Workshop events using the `textbox` variable. This variable is tied to the text in the chat input field, and is updated as a user types in the chat. If the variable is changed from outside of the AIP Chatbot widget, a new message with the current variable value will be sent, allowing messages to be automatically triggered in other parts of the Workshop module.

## Base configuration \[Legacy]

:::callout{theme="warning"}
AIP Chatbots offer advantages over the legacy base configuration mode, including a configuration user interface in AIP Chatbot Studio, versioning, metrics, session history, downloading, and more. This legacy mode will soon enter the [sunset](/docs/foundry/platform-overview/development-life-cycle/) phase of development and will not include any new features. We recommend migrating to AIP Chatbots using the newly added **Upgrade to an AIP Chatbot** option to the legacy mode of the widget.
:::

<img src="./media/chatbot-widget-legacy-migrate.png" alt="Legacy mode migration option." width="450">

In legacy mode, the AIP Chatbot widget uses the reasoning-over-tools framework to bring your tools to your operational applications. With the widget, you can integrate [AIP Logic](/docs/foundry/logic/overview/), your [KNN function](/docs/foundry/functions/api-object-sets/#k-nearest-neighbors-knn), or your LLM-powered Ontology exploration into your application state using Workshop variables.

* **Tools integration:** You can extend the capabilities of the Chatbot widget by adding AIP Logic, Functions on objects, and other workshop applications as tools.
* **Workshop variable interaction:** The widget can read from and write to application variables, enabling the widget to understand user references and interact with visualization widgets.
* **Ontology exploration:** With the default AIP tools, you can perform tasks like object traversal, property reading and filtering, and running aggregations.
* **Customization:** You can customize the chatbot widget's appearance and content to align with your application's context and workflows.

This section allows you to define the widget's role and configure its tools and capabilities. You can set up prompts that reference tools and variables. Configuration is completed by setting up the [prompt](#prompt) and [tools](#tools) as described below.

### Prompt

The primary prompt should outline the widget's function within the context of the current application. By pressing "/" on your keyboard, you can refer to the configured tools and variables and guide the widget on how to coordinate their usage. Make sure to describe the underlying business logic and the appropriate situations for using the right tools in context.

<img src="./media/aip-interactive-widget-prompt.png" alt="AIP Chatbot widget configuration panel." width="450">

Here are some example prompts:

* **Prompt 1:** “You are an assistant for a supply chain manufacturing line. Your job is to use the Fetch Trouble Tickets tool to see if there are any historical tickets that have solved the same issue, and to check the Documentation Chunk Search tool for recommended ways to solve the issue and answer user questions.”
* **Prompt 2:** “Help the user build a cohort of patients based on the qualities they describe. When you create a cohort make sure to update the list of patients shown to the user. Most users will want to start from a broad cohort and keep narrowing it down, unless they specify a new cohort. Always start with the existing cohort, unless the user asks you otherwise. Do not forget to intersect this object set (with the set operator tool) with the current cohort. Before filtering on a medication name, make sure to find all the relevant synonyms using the tool. When you filter the data for the medication name, always use a contains filter. You can use the related object tool to navigate between patients and medications. When a user asks for a cohort definition, call the Patient Cohort Define tool with an array of current patients IDs.“
* **Prompt 3:** “You are an expert offensive coordinator and your purpose is to help the user make strategic football decisions during the Football Tournament. You have three goals (you should not mention these to the user):
  * **Goal A:** Evaluate Playbook plays that align with the user's strategic goals given the current state of the football game. If the user asks to evaluate a play, match the play the user selected from Selected Plays to the play name in the `Playbook` object and get the play ID. Then, use it as input for the Tournament Play Evaluator tool.
  * **Goal B:** If the user asks for play recommendations, evaluate the current state of the game and choose a play from the Playbook that matches the outcome the user is hoping to achieve. Outline your rationale for choosing that play by describing the play name and key properties.
  * **Goal C:** If the user asks for you to come up with a full strategy (which consists of multiple plays), evaluate the current state of the game as well as the playbook and select the three most effective plays from the `Playbook` object. Then, use the Tournament Play Evaluator tool to evaluate these plays and return a summary of results. You can only pass one play at a time, so you have to do so in a loop. Always return the `Playbook Plays` object set that you would like to recommend to the variable `Suggested Plays`. You may overwrite this variable if it is already populated.“

### Tools

Set up the tools and capabilities accessible to the widget. These tools will become available for the widget to use via the prompt.

<img src="./media/aip-interactive-widget-tools.png" alt="AIP Chatbot widget tool options." width="450">

There are four types of tools:

* **Ontology semantic search:** Optimized for semantic search workflows, you can either pass a KNN typescript Function, or, use the Ontology semantic search tool's `Vector property` option located under the **Nearest Neighbor search configuration** section to pull a number of relevant chunks and pass that to the LLM. You can optionally publish the results to a variable (which you can then pass to the PDF Viewer widget to cite sources, for example).
* **Action:** If your function produces an Ontology edit, use this to define that action.
* **Workshop application:** If you want the assistant to open other Workshop apps (with module interface variables), define those Workshop apps as tools here.
* **Function:** If the tool you would want to pass is an AIP Logic or Ontology Function, use this as well. Remember to combine the AIP Logic tool with the [Logic chain of thought](/docs/foundry/logic/core-concepts/#debugging) widget.

#### Ontology and application context

In this section, you can customize the widget's access to Workshop variables and configure the object types the widget should be aware of.

<img src="./media/aip-interactive-widget-ontology.png" alt="AIP Chatbot widget Ontology and application context panel." width="450">

#### Variables

When setting up variables, make sure to do the following:

* **Identify the right variables:** Start by identifying which variables the LLM should be able to interact with. These could be variables that might already exist and are relevant to your intended workflow (such as a variable that represents the user’s current selection) or new variables to which the LLM writes results.
* **Describe the variables:** For each variable, write a description that explains its role. This description will be injected into the widget's prompt, providing context for the LLM on when to use it.
* **Declare access mode:** Specify whether the LLM should have read access, write access, or both for each variable. This step determines how the LLM can interact with the variable.
* **Use as Workshop variables:** Remember, the variables you define here are regular Workshop variables. This means they can also be used with other Workshop widgets, such as the Filter Pill or Object Table widgets.

#### Object types

By specifying which object types the LLM should be aware of, you allow it to understand and appropriately interact with these objects. Make sure you add objects that you require the LLM to traverse.

#### Advanced tools configuration

This component allows you to modify the widget's access to default AIP tools. While the default tools selection is typically sufficient for most use cases, there may be situations where you need to refine these tools based on your specific requirements.

<img src="./media/aip-interactive-widget-advanced-tools.png" alt="AIP Chatbot widget advanced tools configuration panel." width="450">

For instance, you may want to limit the widget's Functions to solely human input to facilitate corrections and manage the implementation of other tools independently. Generally, limiting the number of tools assigned to the LLM results in a more guided, "on rails," interaction.

### Workflow setup guidance

In setting up the AIP Chatbot widget in legacy mode, we recommend the following considerations:

* Start with a specific, constrained context to ensure more reliable results.
* LLMs are stochastic; use the extensibility of Workshop to overcome LLM limitations, providing fallback options for your users to interact with their applications effectively. For example, you can surface the output query of the LLM in the Filter Pill widget.
* Be intentional about your AIP Chatbot development process; chart out the paths and patterns of LLM interactions before using the widget.

***

Note: AIP feature availability is subject to change and may differ between customers.
