<!-- source: https://palantir.com/docs/foundry/integrate-models/container-overview/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Container models

:::callout{theme="warning" title="Prerequisites"}
The following documentation assumes working knowledge of containerized infrastructure and concepts like container images. If you are unfamiliar with these topics, we recommend reviewing the [Docker overview documentation ↗](https://docs.docker.com/get-started/)
:::

Foundry allows users to package container images along with a [model adapter](/docs/foundry/integrate-models/model-adapter-overview/) to create a container-backed [Model](/docs/foundry/model-integration/models/). The model is then consumable in Foundry as with non-container-backed models. Container-backed models are particularly useful if the models are especially large, pre-trained, written in a language Foundry does not natively support (such as R), or already containerized for other usage.

[Control Panel](/docs/foundry/administration/control-panel/) houses all features around container governance, including [enabling container usage](/docs/foundry/administration/container-governance/#enable-container-workflows) and [managing vulnerabilities](/docs/foundry/administration/container-governance/#recall-vulnerabilities). If the container setting is not enabled, all Foundry jobs and deployments relying on imported containers will fail.

Once container workflows are enabled, the first step is to [create a model and begin pushing images into the platform](/docs/foundry/integrate-models/upload-image-container-model/).
