<!-- source: https://palantir.com/docs/foundry/transforms-python/environment-overview/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Python environment

The **Python environment** used for a transform is resolved during Checks using the Hawk package manager based on the specified list of packages in the [`conda_recipe/meta.yaml`](/docs/foundry/transforms-python/project-structure/#metayaml) file. Using the package tab, you can [discover available packages and automatically add these to your `meta.yml` for environment resolution](/docs/foundry/transforms-python/use-python-libraries/). This resolved environment is published internally to Artifacts ready for use during the build.

When the transform is built, it fetches the environment file and installs the required packages specified in the environment file. If this fails for some reason, the transform will fall back to resolving the environment again during the build using Hawk.

### Useful resources

See [Introduction to Environment Creation](/docs/foundry/transforms-python/environment-creation-overview/) for an introduction to using Conda, Mamba, and Hawk to create environments. For general troubleshooting of common environment problems, see [Environment Troubleshooting Guide](/docs/foundry/transforms-python/environment-troubleshooting/).
