<!-- source: https://palantir.com/docs/foundry/transforms-python/container-overview/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Container transforms

:::callout{theme="warning" title="Prerequisites"}
The following documentation assumes working knowledge of containerized infrastructure and concepts like container images. If you are unfamiliar with these topics, we recommend reviewing the [Docker overview documentation ↗](https://docs.docker.com/get-started/).
:::

Foundry interacts with containers pushed into the platform in two ways:

1. Using the [transforms sidecar decorator](/docs/foundry/transforms-container/transforms-sidecar/).
2. Constructing and using [container backed model assets](/docs/foundry/integrate-models/upload-image-container-model/).

In both use cases, the first step is to push the image into the Docker registry hosted within Foundry while following the image requirements listed below.

## Image requirements

1. The image has a numeric `userID`.

* The `userID` defined within the Dockerfile must be numeric and not '0'. Foundry does not allow commands to run within the container as the root user; '0' gets interpreted in some systems as zero, and non-numeric IDs can be set to function as root.
* For [bring your own container transforms](/docs/foundry/transforms-python/bring-container/), the `userID` must be specifically '5001'.

2. The image is built for `linux/amd64` platform.

* Foundry supports the execution of containers built for this platform only. The default platform for Docker is `linux`, so add `--platform linux/amd64` for the [Docker build command ↗](https://docs.docker.com/engine/reference/commandline/build/) to set the platform specifically.

3. The image is pushed with `digest` or any tag other than `latest`.

* The executed Docker push command should specify the digest of the image or use a tag that is not `latest`. Foundry will not execute images tagged as `latest` since there is no mechanism to ensure any given image is actually the latest one.

4. The maximum image layer size is less than ~10 GB.

* It is strongly recommended that each layer is smaller than ~10 GB. If your use case requires a larger layer size, contact your Palantir representative.

5. Any ports exposed are between 1024 and 65535.

* Ports 0 through 1023 are well-known ports and as such are reserved for root. Foundry does not allow commands to run within the container as the root user; therefore, any ports specified in this range will not be available when the image is launched within Foundry.

6. \[Optional] The image has telemetry enabled.

* To enable telemetry logging from your container:
  * The image must have a shell executable in `/bin/sh`.
  * The image must support the shell commands `set` and `tee`.
