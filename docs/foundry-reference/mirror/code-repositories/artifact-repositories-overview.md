<!-- source: https://palantir.com/docs/foundry/code-repositories/artifact-repositories-overview/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Artifact repositories

Artifact repositories enable users to publish and manage Artifacts, including [Conda ↗](https://docs.conda.io/en/latest/), [Docker ↗](https://www.docker.com/), and [Maven ↗](https://maven.apache.org/what-is-maven.html).

Artifact repositories should be used to upload all Conda, Docker, or Maven Artifacts that are not authored as a [library](/docs/foundry/transforms-python/use-python-libraries/) or accessible through an external URL. For example, you may have written a Conda package on your local machine that you wish to access in Code Repositories. By publishing the Conda package to an Artifact repository, you will be able to access it from the **Library** search panel in [Code Repositories](/docs/foundry/code-repositories/overview/).

Key features of Artifacts repositories are:

* [**Publishing Artifacts:**](/docs/foundry/code-repositories/publish-artifact/) Generate a token and push an Artifact into an Artifact repository.
* [**Searching for Artifacts:**](/docs/foundry/code-repositories/artifact-repositories-nav/#search) Find Artifacts from the Artifact Repository interface.
* [**Recalling Conda Artifacts:**](/docs/foundry/code-repositories/recall-artifact/) Recall Conda Artifacts to prevent downstream consumers from compiling code with a specific version.

Learn more about the Artifact Repository [interface](/docs/foundry/code-repositories/artifact-repositories-nav/) and how to [create an Artifact repository](/docs/foundry/code-repositories/create-artifact-repository/).
