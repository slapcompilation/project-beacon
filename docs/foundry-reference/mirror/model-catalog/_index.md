<!-- source: https://palantir.com/docs/foundry/model-catalog/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Model Catalog

:::callout{theme="neutral"}
You can enable Model Catalog in [Control Panel](/docs/foundry/administration/configure-application-access/).
:::

Model Catalog is an AIP application in Foundry, created to help with discovery and orientation of all Palantir-provided models.

Model Catalog enables builders to:

* View the models that are available in AIP and discover new models.
* Select the right model for your use case. Upcoming updates should provide more tools and benchmarks for comparison and decision-making.
* Get started with a workflow both using basic templates and entire use case templates through Marketplace.
* Test different models using a sandbox/playground.

:::callout{theme="warning"}
Model Catalog currently does not include custom ML/AI models, only LLMs. You can find ML/AI models in [Modeling Objectives](/docs/foundry/model-integration/objectives/).
:::

Model Catalog has two main views:

* [Model Catalog homepage](#model-catalog-homepage)
* [Model entity page](#model-entity-page)

## Model Catalog homepage

![Model Catalog homepage](./images/model-catalog-home.png)

The Model Catalog homepage is a discovery and navigation interface, displaying all large language models available for a user in their Foundry enrollment.

:::callout{theme="neutral"}
[Review an exhaustive list of available models in AIP.](/docs/foundry/aip/supported-llms/#available-llms)
:::

There are a few ways to filter models on the homepage:

* **Lifecycle status**
  * **Experimental:** An experimental model may be treated as experimental by either the provider or Palantir, indicating that APIs might change, token capacity could be limited, behavior in AIP applications may not be fully supported, or other unstable behavior may occur. All models will start as experimental when they are first available in AIP. Experimental models are typically used for exploration and testing, with less emphasis on long-term stability and support. A model is promoted from experimental to stable after it meets Palantir's performance and availability standards, which include, but are not limited to: sufficient throughput to handle requests for production workloads while remaining available, usability in all AIP applications, and broad regional availability.

:::callout{theme="neutral"}
Enrollment administrators can enable or disable **Experimental** models for their enrollment in the **AIP settings** section of [Control Panel](/docs/foundry/administration/control-panel/) so Model Catalog only displays models within the **Stable** lifecycle stage.
:::

* **Stable:** A stable or generally available (GA) model is a reliable model endorsed by both the model provider and Palantir. These models offer robust functionality, guaranteed support, and are designed for long-term production usage. Regional availability for models varies based on the offerings for model providers. You can reference a comprehensive list of model availability by region in the [supported LLMs documentation](/docs/foundry/aip/supported-llms/#llm-availability-by-geography) and information about each model's status in Model Selector. Palantir moves models from stable to sunset, and notifies users of that shift through [Upgrade Assistant](/docs/foundry/upgrade-assistant/overview/), after receiving the prescribed sunset date from the model provider.

* **Sunset:** A sunset model will deprecate in the coming months, as determined and announced by the model provider. While sunset models can no longer back new workflows after their prescribed deprecation date, the model may still support existing workflows. Compared to their stable counterparts, sunset models will not receive the same level of technical support. Palantir moves models from sunset to deprecated, and notifies users of that shift through [Upgrade Assistant](/docs/foundry/upgrade-assistant/overview/), after receiving the prescribed deprecation date from the model provider. For more information on sunset models, review the [model deprecation documentation](/docs/foundry/model-catalog/model-deprecation/).

* **Deprecated:** Palantir removes, or deprecates, models from Foundry in coordination with the model provider after its sunset period expires. Deprecated models cannot support existing workflows, including new API calls, so projects must migrate to a stable model before a model's deprecation to maintain functionality. Foundry retains and makes accessible the deprecated model's historical data and logs. For more information on deprecated models, review the [model deprecation documentation](/docs/foundry/model-catalog/model-deprecation/).

* **Type**
  * **Completion model:** A completion model is designed to generate contextually relevant text by predicting and completing input text. This makes it suitable for tasks such as content generation, auto-completion, translation, and question-answering. For example, GPT-4 Turbo, Mixtral 8x7B, and Llama2 70B Chat.
  * **Embedding model:** An embedding model converts discrete data like words and sentences into continuous vector representations. It is most commonly used for semantic search and other information retrieval use cases. For example, text-embedding-ada-002 and Instructor Large.
  * **Vision model:** A vision model is trained to analyze and interpret visual input, enabling it to recognize objects, classify images, and support various computer vision tasks for image and video data. For example, GPT-4 Vision and Gemini Pro Vision.

* **Model creator**
  * A model creator is the organization responsible for creating, developing, and maintaining a specific LLM. Examples include OpenAI, Anthropic, Google Gemini, and Mixtral AI. Model creators may offer their LLMs directly or through partnerships with other organizations, such as OpenAI through Azure and Anthropic through AWS. Some models may be provided and hosted by Palantir, such as Llama and Mixtral.

If a model is unavailable or grayed out, it means that it is not enabled for your enrollment. To enable a model, contact your platform administrator or Palantir representative.

[Learn more about Model enablement](/docs/foundry/aip/enable-aip-features/).

## Model entity page

![Model catalog model view](./images/model-catalog-model.png)

Each model has an entity page with three main sections:

* **Playground:** An interface for builders to try out the different models.
* **How to use it:** Get started by creating a resource, already populated with the content required to start building your workflow. Model Catalog currently supports Functions and Transforms.
* **Model description:** A basic description, legal disclaimer, context window of the model like tokens limit, training data cutoff, and more.

## Model comparison page

![Model catalog comparison view](./images/model-catalog-comparison.png)

The Model Catalog comparison page allows builders to efficiently compare and evaluate the performance of various LLMs. The interface allows users to select two LLMs and test them on the same completion or vision tasks. This enables informed decision-making and allows builders to quickly select a model that is optimal for their workflow.
