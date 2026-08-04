<!-- source: https://palantir.com/docs/foundry/ontology/aip-multimodal-and-embedding-models/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Process multimodal and embedding models

This page discusses some methods you can use to process multimodal and embedding models.

## Multimodal models

If you want to answer questions based on diagrams, LLMs with the text-in-text-out architecture will be of no help. While GPT-4o and GPT-4o mini are able to take image inputs, there are other open-source options available for your consideration.

* **[Pix2Struct ↗](https://proceedings.mlr.press/v202/lee23g/lee23g.pdf):** Performed quite well during initial tests on quality assurance for a table in German. You can try it on [huggingface ↗](https://huggingface.co/docs/transformers/main/en/model_doc/pix2struct).
* **[Microsoft UDOP (Universal document processing) ↗](https://github.com/microsoft/UDOP):** Open source, but not available on huggingface.

In this setup, you can use the initial text extraction just to have something to (semantic-)search for, but then later run the multimodal model on top of the raw source page (image).

## Embedding models

If you are working in English, you can try MSMARCO models from the [**sentence-transformers docs** ↗](https://www.sbert.net/docs/pretrained-models/msmarco-v3.html).

[MS MARCO ↗](https://microsoft.github.io/msmarco/) is a collection of large scale information retrieval datasets that were created based on real user search queries using the Bing search engine. The provided models can be used for semantic search, in that given keywords, a search phrase, or a question, the model will find passages that are relevant for the search query.

This means these models were **specifically trained to put queries and relevant passages close together in embedding space.**

By this definition, embedding models may be a better fit for semantic search workflows that start from a user query than general-purpose OpenAI Ada. When you use Ada to embed a query directly and compare that to chunk embeddings, you are not comparing the same concept and may instead use asymmetric embedding models to bridge that gap. Alternatively, you can attempt using an [LLM to get generate a hypothetical chunk](/docs/foundry/ontology/ontology-augmented-generation/#hyde-hypothetical-document-embeddings) first.

Ada, in turn would make more sense when your starting point is a chunk, and you are searching for similar chunks. Note that most non-ada embedding models only support 512 tokens, so you need to adapt your chunking strategy accordingly.

If you are working in German, for example, GPT is currently the only LLM that performs decently for the language. With a German document corpus, try ada.
