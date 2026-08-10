<!-- source: https://palantir.com/docs/foundry/integrate-models/import-huggingface-models/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Import a Hugging Face model

:::callout{theme="neutral"}
Users of the now deprecated **Import an open source model** functionality can use the [language model adapters](/docs/foundry/integrate-models/language-models-adapters/) source code as a starting point to write adapters to wrap Hugging Face models. Linked adapters are no longer actively maintained by Palantir and are provided for reference only. Instead, replacement adapters should be published, maintained and extended at your discretion directly from Foundry adapter repositories.
:::

In addition to the [LLMs natively supported by Palantir AIP](/docs/foundry/aip/supported-llms/), Foundry enables users to integrate with popular language model frameworks such as [Hugging Face ↗](https://huggingface.co/models) or [spaCy ↗](https://spacy.io/models).
Such natural language frameworks are available for use in Foundry as packages distributed through Conda or PyPI.

However, these language model frameworks typically require users to download pre-trained models or corpora from the internet for further fine-tuning. These downloads often require additional steps to become fully functional within Foundry. This is a result of Foundry's security architecture, which by default denies access to the public internet for user-written Python code. The additional steps required depend on the particulars of the language model framework.

## Hugging Face

To import a Hugging Face language model into Foundry, two options are available:

1. [Import the model files as raw datasets](#import-the-model-files-as-a-dataset).
2. [Allowlist the Hugging Face domains](#allowlist-hugging-face-domains).

### Import the model files as a dataset

You can import any model from the Hugging Face model hub as a dataset. You can use that dataset in Code Repositories or Code Workspaces.

First, [download ↗](https://huggingface.co/docs/hub/models-downloading#using-git) the model files from Hugging Face. Then, upload the model as a schema-less dataset to bring the files into Foundry. These files can be uploaded either through a frontend upload (**New > Dataset > Import > Select all files**) or through a Data Connection sync if model files are stored on a shared drive in your private network.

The import dataset should contain all files from the **Files and versions** tab of the model details in Hugging Face. However, only one binary model file is required (for example, `pytorch_model.bin` or `tf_model.h5`). In most cases, we recommend using the PyTorch model as the binary model file.

Once the model files are stored in a dataset, you can use the dataset as an input in your transform. Depending on the size of your model, you may need to specify a [Spark profile](/docs/foundry/code-repositories/spark-profiles/) like `DRIVER_MEMORY_MEDIUM` to load the model into memory. The code below uses a utility from `foundry-huggingface-adapters`:

```python
from palantir_models.transforms import ModelOutput
from transforms.api import transform, Input
from transformers import AutoTokenizer, AutoModel
from huggingface_adapters.utils import copy_model_to_driver


@transform(
    model_output=ModelOutput("/path/to/output/model_asset"),
    hugging_face_raw=Input("/path/to/input/dataset"),
)
def compute(model_output, hugging_face_raw):
    temp_dir = copy_model_to_driver(hugging_face_raw.filesystem())
    tokenizer = AutoTokenizer.from_pretrained(temp_dir)
    model = AutoModel.from_pretrained(temp_dir)

    # Wrap the model with a model adapter and save as a model
    # model_output.publish(...)
```

Depending on the use case, you can use one of the [language model adapters](/docs/foundry/integrate-models/language-models-adapters/) like `EmbeddingAdapter`:

```python
# other imports
from huggingface_adapters.embedding_adapter import EmbeddingAdapter
# ...
    model_output.publish(
        model_adapter=EmbeddingAdapter(tokenizer, model),
        change_type=ModelVersionChangeType.MINOR
    )
```

#### Allowlist Hugging Face domains

To download models from Hugging Face directly, you can allowlist the relevant domains in your Foundry enrollment by [configuring a network egress policy](/docs/foundry/administration/configure-egress/). The relevant domains to allowlist are:

* [https://huggingface.co ↗](https://huggingface.co/)
* [https://hf.co ↗](https://hf.co)
* [https://cas-bridge.xethub.hf.co ↗](https://cas-bridge.xethub.hf.co)
* [https://cas-server.xethub.hf.co ↗](https://cas-server.xethub.hf.co)
* [https://transfer.xethub.hf.co ↗](https://transfer.xethub.hf.co)
* [https://cdn-lfs.hf.co ↗](https://cdn-lfs.hf.co)
* [https://cdn-lfs.hf.co ↗](https://cdn-lfs.hf.co/)
* [https://cdn-lfs-us-1.hf.co ↗](https://cdn-lfs-us-1.hf.co)
* [https://cdn-lfs-us-1.huggingface.co ↗](https://cdn-lfs-us-1.huggingface.co)
* [https://cdn-lfs-eu-1.hf.co ↗](https://cdn-lfs-eu-1.hf.co)
* [https://cdn-lfs-eu-1.huggingface.co ↗](https://cdn-lfs-eu-1.huggingface.co)
* [https://us.gcp.cdn.hf.co ↗](https://us.gcp.cdn.hf.co)

:::callout{theme="warning"}
Domains from Hugging Face you use to download models can change without warning. If you are still not able to download a model after allowlisting the above domains, then you should attempt to identify which domains are still blocked by logging requests to assist in your debugging. You can reference detailed instructions on [Stack Overflow ↗](https://stackoverflow.com/questions/16337511/log-all-requests-from-the-python-requests-module) to help you enable debugging at the `httplib` level.
:::

In addition, the code repository that loads the model from Hugging Face must have the [`transforms-external-systems` library added](/docs/foundry/data-connection/external-transforms-legacy/#add-the-transforms-external-systems-library) and be [configured accordingly](/docs/foundry/data-connection/external-transforms-legacy/) to use the newly created egress policy. Once the configuration is set up, open-source language models can be loaded in a Python transform.

:::callout{theme="neutral"}
If you receive the error `PermissionError: [Errno 13] Permission denied: '/.cache'`, you must pass in a cache directory during your model load as shown in the example below.
:::

```python
from palantir_models.transforms import ModelOutput
from transforms.api import transform, Input
from transforms.external.systems import use_external_systems, EgressPolicy, ExportControl
from transformers import AutoTokenizer, AutoModel
import tempfile

@use_external_systems(
    export_control=ExportControl(markings=['<marking ID>']),
    egress=EgressPolicy(<policy RID>),
)
@transform(
    model_output=ModelOutput('/path/to/output/model_asset'),
    text_input=Input('/path/to/input/dataset'),
)
def compute(export_control, egress, model_output, text_input):
    CACHE_DIR = tempfile.mkdtemp()
    tokenizer = AutoTokenizer.from_pretrained("bert-base-cased", cache_dir=CACHE_DIR)
    model = AutoModel.from_pretrained("bert-base-cased", cache_dir=CACHE_DIR)

    # Wrap the model instance with a model adapter and save it in the Palantir platform
    # model_output.publish(...)
```

#### Usage in Foundry

Once you have access to the language model, either through a dataset or through the Hugging Face domains, you can integrate with it as a Palantir model by wrapping the language model with a [model adapter](/docs/foundry/integrate-models/model-adapter-overview/) as defined in the [model training in Code Repositories documentation](/docs/foundry/integrate-models/model-asset-code-repositories/).
