<!-- source: https://palantir.com/docs/foundry/questions-answers/code-repositories-community/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Code Repositories (Community)

### How does the "Reset" option in Code Repositories work?

The "Reset" option is equivalent to a `git` reset where all uncommitted changes of that branch is discarded and the branch is reset to the latest commit.

*Topic Link:* [https://community.palantir.com/t/reset-button-in-code-repositories/744 ↗](https://community.palantir.com/t/reset-button-in-code-repositories/744)

*Timestamp:* October 10, 2024

### Is there a way to preview or build a transform based on a historical version of the input dataset?

Specifically in Code Repositories, there is no way to select a specific input transaction (see the existing [Input class parameters](/docs/foundry/api-reference/transforms-python-library/api-input/#transforms.api.Input)). However, you can call the [createBranch](/docs/foundry/api/datasets-resources/branches/create-branch/) endpoint which takes a `transactionRid` parameter that can be set to a previous transaction. Then you would be able to use this branch in your transform (`branch` being a parameter of the Input class).

Additionally, the simplest way to work with historical data is to use Contour: You can very easily change the input dataset version to a previous one, see the [docs](/docs/foundry/contour/change-dataset-version/).

*Topic Link:* [https://community.palantir.com/t/preview-on-historical-dataset/189 ↗](https://community.palantir.com/t/preview-on-historical-dataset/189)

*Timestamp:* December 6, 2024
