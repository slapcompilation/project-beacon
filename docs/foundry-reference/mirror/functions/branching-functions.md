<!-- source: https://palantir.com/docs/foundry/functions/branching-functions/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Branching functions

You can develop, publish, and consume functions on a global branch. This is currently supported for TypeScript v1 functions and AIP Logic functions.

## Developing functions

:::callout{theme="neutral"}
To use Global Branching for TypeScript v1, upgrade your repository template version to version `0.903.0` of the `functions-typescript` child template or higher. Review [the documentation on repository upgrades](/docs/foundry/code-repositories/repository-upgrades/#manual-branch-upgrade) for instructions.
:::

You can develop a function that depends on changes made to resources on your global branch, such as newly created or modified ontology entities.

![Developing a new function on a branch.](/docs/resources/foundry/functions/branch-function.png)

When you are ready, publish your function with a **version target** — the stable version published to `main` when the global branch merges. During development on your branch, the function is published as unstable preview versions.

![Publishing functions on a branch.](/docs/resources/foundry/functions/branch-function-publish.png)

Once you have successfully published your function on the branch, you can use the new function version on your branch in Workshop, AIP Logic, and function-backed actions. This function version is labeled with the `Branched pre-release` tag. Note that functions published on your branch will not be accessible from other branches, including `main`.

![Using a branched function in Workshop.](/docs/resources/foundry/functions/branch-function-backed-variable.png)

![Using a branched function in actions.](/docs/resources/foundry/functions/branch-function-backed-action.png)

:::callout{theme="neutral"}
It is currently not possible to depend on branched versions of query functions in TypeScript v1 repositories.
:::

As you continue developing on your branch, you can continue publishing function versions to the same version target. As long as your version target remains the same, any resource using your function will automatically pull the latest published version. This lets you iterate quickly without manually updating function references after each publish.

If the version target on the branch changes, you must update all dependents of the function that were using the old version on the branch to use the new version target. This will also be displayed as a [check](/docs/foundry/global-branching/core-concepts/#checks).

## Conflict resolution and rebasing functions

When developing on a branch, you will not automatically receive newer function versions published to `main`. This prevents main development from disrupting your branch work. If newer versions are available on `main`, you will see notifications in function version selectors and Ontology Manager. You can then rebase your function versions to pull in all newer versions from `main`.

![Rebasing functions dialog.](/docs/resources/foundry/functions/rebasing-functions.png)

If your version target gets published to `main` while you are developing, you must select a new version target before merging. Once you do, update any dependents to use the new version target.

## Merging

When merging your global branch, modified functions will be published on `main` with the stable version target. Resources using the version published on your branch will automatically start using the new stable version that was published on `main` as part of the merge.

:::callout{theme="warning"}
Foundry only merges your version target into `main` and does not merge other versions published on the branch. Those versions will not exist on `main` after your branch merges.
:::
