<!-- source: https://palantir.com/docs/foundry/integrate-models/container-models-faq/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# FAQ

### Is there a central place to view all user uploaded images within Foundry?

Yes; Control Panel provides Foundry administrators the ability to view all images pushed into the platform, as well as [view and recall any vulnerabilities present in those images](/docs/foundry/administration/container-governance/).

### Are container-backed models compatible with live deployments?

Yes, container models can be used within [live](/docs/foundry/model-integration/objectives/#live-deployments) and [batch](/docs/foundry/model-integration/objectives/#batch-deployments) deployments.

### Is there a particular base image that should be used when creating images to push to Foundry?

No, there is no standard base image provided nor required. However, all images pushed must adhere to the [image requirements](/docs/foundry/transforms-container/container-overview/#image-requirements).

### Is there a standard API that the image must expose?

No; how Foundry interacts with the image will be defined by the [model adapter implementation](/docs/foundry/integrate-models/model-adapter-overview/). A common pattern reflected in [this example custom adapter](/docs/foundry/integrate-models/container-model-adapter-example/) is to construct the image to listen on a specific port for input, then have the model adapter send post requests.

### What is the maximum image size for containerized models?

Typically, images larger than 22 GB will time out during the Docker push step. If your use case requires a larger image, contact your Palantir representative.

### Does Foundry support the execution of Windows-based containers?

No; all images pushed into the platform must be [built for the Linux platform](/docs/foundry/transforms-container/container-overview/#image-requirements) as the entities in the Foundry Kubernetes cluster are Linux machines.

### Can I use multiple containers within my model?

Yes; multiple images can be [configured to back a model version](upload-image-container-model.md#3-configure-the-model-version), but there is no orchestration support. All containers will be launched simultaneously at execution time and it will not be possible to guarantee container start time ordering.

### Are container-backed models supported on all Foundry instances?

No. All user-provided container workflows require the [Rubix ↗](https://blog.palantir.com/introducing-rubix-kubernetes-at-palantir-ab0ce16ea42e) engine as the backing infrastructure. Also, you need to enable container workflows in [Control Panel](/docs/foundry/administration/control-panel/).

### How do I enable telemetry on my model?

To enable telemetry on your model, create a new model version and toggle on **Enable telemetry** in the [third step](/docs/foundry/integrate-models/upload-image-container-model/#3-configure-the-model-version) of model version creation. The image must have a shell executable in `/bin/sh`, and the image must support the shell commands `set` and `tee`.

### Will telemetry work for all types of models?

No, telemetry for containerized models only works in [Python transforms](/docs/foundry/transforms-container/container-overview/#image-requirements) and [live deployments](/docs/foundry/model-integration/objectives/#live-deployments), but will not emit container logs for batch deployments.

### How can I test if my container has the necessary commands and settings for telemetry?

You can test this by running `docker run --entrypoint /bin/sh <EXAMPLE_IMAGE>:<IMAGE_TAG_OR_DIGEST> -c 'set -a && tee -a' && echo "Telemetry compatible"`. An output of `Telemetry compatible` indicates telemetry can be enabled for this container.
