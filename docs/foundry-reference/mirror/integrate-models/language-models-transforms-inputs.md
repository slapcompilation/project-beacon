<!-- source: https://palantir.com/docs/foundry/integrate-models/language-models-transforms-inputs/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Language model classes

`palantir_models` provides a set of classes to be used in Python transforms.

| Class | Description|
|---|---|
| [`OpenAiGptChatLanguageModelInput`](#openaigptchatlanguagemodelinput) | A FoundryInputParam which binds to the OpenAiGptChatLanguageModel API from language model service. Use in a Python transforms decorator. |
| [`GenericCompletionLanguageModelInput`](#genericcompletionlanguagemodelinput) | A FoundryInputParam which binds to the GenericCompletionLanguageModel API from language model service. Use in a Python transforms decorator. |
| [`GenericEmbeddingModelInput`](#genericembeddingmodelinput) | A FoundryInputParam which exposes the GenericEmbeddingsModel API from language model service. Use in a Python transforms decorator. |
| [`OpenAiGptChatLanguageModel`](#openaigptchatlanguagemodel) | Provides a client to an OpenAI chat completion model. |
| [`GenericCompletionLanguageModel`](#genericcompletionlanguagemodel) | Provides a client to execute any chat completion model available in AIP. |
| [`GenericEmbeddingModel`](#genericembeddingmodel) | Provides a client to execute any embedding model available in AIP. |

## `OpenAiGptChatLanguageModelInput`

***class* `palantir_models.transforms.OpenAiGptChatLanguageModelInput`(rid)**

* **`rid`**
  * The resource identifier that identifies the language model.

***

## `GenericCompletionLanguageModelInput`

***class* `palantir_models.transforms.GenericCompletionLanguageModelInput`(rid)**

* **`rid`**
  * The resource identifier that identifies the language model.

***

## `GenericEmbeddingModelInput`

***class* `palantir_models.transforms.GenericEmbeddingModelInput`(rid)**

* **`rid`**
  * The resource identifier that identifies the embedding model.

***

## `OpenAiGptChatLanguageModel`

***class* `palantir_models.models.OpenAiGptChatLanguageModel`**

* **`create_chat_completion(completion_request)`**
  * Executes the provided chat completion request.
  * **Parameters**
    * completion\_request: `language_model_service_api.languagemodelservice_api_completion_v3.GptChatCompletionRequest`
  * **Return Type**
    * `language_model_service_api.languagemodelservice_api_completion_v3.GptChatCompletionResponse`

***

## `GenericCompletionLanguageModel`

***class* `palantir_models.models.GenericCompletionLanguageModel`**

* **`create_completion(completion_request)`**
  * Executes the provided completion request.
  * **Parameters**
    * completion\_request: `language_model_service_api.languagemodelservice_api_completion_v3.GenericCompletionRequest`
  * **Return Type**
    * `language_model_service_api.languagemodelservice_api_completion_v3.GenericCompletionResponse`

***

## `GenericEmbeddingModel`

***class* `palantir_models.models.GenericEmbeddingModel`**

* **`create_embeddings(embeddings_request)`**
  * Computes embeddings for all inputs provided in the `embeddings_request`
  * **Parameters**
    * embeddings\_request: `language_model_service_api.languagemodelservice_api_embeddings_v3.GenericEmbeddingsRequest`
  * **Return Type**
    * `language_model_service_api.languagemodelservice_api_embeddings_v3.GenericEmbeddingsResponse`
