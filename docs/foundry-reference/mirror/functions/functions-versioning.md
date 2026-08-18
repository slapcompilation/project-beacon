<!-- source: https://palantir.com/docs/foundry/functions/functions-versioning/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Function versioning

This document describes the versioning system used for functions. Versions for function releases are chosen by their publishers and are immutable after creation. Applying appropriate versions is critical to providing consumers of your functions with a stable and reliable experience.

## Backward compatible changes vs. breaking changes

The versioning system for functions distinguishes between backward compatible changes and breaking changes. *Backward compatible changes* are changes that do not disrupt existing consumers of your functions. A change that is not backward compatible can be referred to as a *backward incompatible* or a *breaking* change.

Some examples of backward compatible changes are:

* Adding an optional input to a function’s signature.
* Optimizing a function’s performance without changing its expected behavior.
* Fixing a bug in your function without changing its expected behavior.

Some examples of breaking changes are:

* Adding a required input to a function’s signature.
* Changing the output type of a function’s signature from an integer to a string.
* Deleting a function.

When considering whether a change to an existing version is backward compatible, ask yourself if the change would cause disruption to or require explicit attention from a consumer of the existing version.

Remember that you are ultimately in charge of dictating the expected consumption patterns of your functions.

## The semantic versioning system

Functions are versioned according to the [Semantic Versioning ↗](https://semver.org/) system.

In Semantic Versioning, versions take the form `X.Y.Z` where `X`, `Y`, and `Z`—known as the major, minor, and patch versions respectively—are non-negative integers (for instance, `1.2.3`). A version may also include a prerelease identifier comprised of alphanumeric characters by appending a hyphen immediately following the patch version (for example, `1.2.3-rc1`).

:::callout{theme="neutral"}
This page provides a brief summary of Semantic Versioning. We encourage you to read the [full specification ↗](https://semver.org/) since adhering to the specification is an important aspect of publishing functions that can be reliably consumed in other applications.
:::

### Choosing a release version

When publishing a new version of a function, consider the following points from the Semantic Versioning specification:

* Major version `0` (`0.y.z`) is for initial development. During initial development, the function may change at any time and your functions should not be considered stable by consumers.
* The major version should be incremented when you make backward incompatible changes.
* The minor version should be incremented when you add functionality in a backward compatible manner.
* The patch version should be incremented when you make backward compatible bug fixes.
* A pre-release version indicates that the version is unstable and might not satisfy the intended compatibility requirements as denoted by its associated normal version.

### Backward compatibility checks

Backward compatibility checks are performed for your functions before you publish a new version. In particular, you will be warned about any of the following breaking changes:

* Dropping a function. This includes deleting a function in your Python or TypeScript function code repository.
* Dropping an input (even an optional one) on a function’s signature.
* Reordering an input on a function’s signature.
* Adding a required input to a function’s signature.
* Bad input type changes (such as integer to string). Note that widening a numeric input type (like integer to float) will result in a warning.
* Bad output type changes (such as string to optional string).

If these checks fail for any reason, it is recommended that you release a major version. However, this does not apply if you are still in the initial development phase (that is, you are still at major version `0`).

:::callout{theme="warning"}
Palantir's built-in checks are not exhaustive of all types of breaking changes. For instance, breaking changes from your internal implementation may not be detected. It is not safe to release a minor or patch version based solely on a successful outcome from these checks.
:::

#### Caveat: Custom types

The internal functions data type representation currently lacks sufficient information regarding the optionality of custom type fields. As a result, you may notice that for custom type inputs and outputs, the backward compatibility checks will warn you when removing or adding any fields, including optional fields (such as `quantity?: Integer` in Typescript or `quantity: Integer = 0` in Python).

We are currently making changes so that going forward you will not be warned when removing an optional field on an output custom type or adding an optional field on an input custom type.

:::callout{theme="neutral"}
You will still receive a warning when removing an optional field on an input custom type. It is generally considered bad practice to ignore any fields provided by a consumer as they likely expect the provided fields to tell the behavior of your function.
:::

### Restrict stable version tags

Stable Semantic Version releases (non-prerelease versions) may be immediately consumed by downstream production applications if the applications have been configured to reference the Function by a version range (for example, `>=1.2.3 <2.0.0`). This makes it important to review and test code changes before releasing them in a new stable version.

It is possible to enforce restrictions on the release of stable versions of your Functions by [enabling a toggle](/docs/foundry/code-repositories/branch-settings/#restrict-stable-version-tags) in the repository settings for protected branches.

## Frequently asked questions

### Choosing release versions in the 0.y.z initial development phase

It is common practice that any breaking changes be made in a minor release and any backward compatible changes be made in a patch release. This is an assumption made by consumers in many development spheres, such as the Node/NPM ecosystem, as demonstrated by their wide use of [caret ranges ↗](https://docs.npmjs.com/cli/v6/using-npm/semver#caret-ranges-123-025-004).

### Accidentally releasing a backward incompatible change as a patch or minor version

As soon as you realize that you’ve released a breaking change, you should correct the problem and restore backward compatibility in a new minor version.

Consider the following example.

1. You have a function called `myFunction` at version `1.0.0` which takes a single string input.
2. You add a new required input to `myFunction` and accidentally release this change in a minor version release `1.1.0`.

To remediate this, you can revert the breaking change to the signature (that is, remove the new required input you added in `1.1.0`) and release this change in version `1.2.0`.

### Checking backward compatibility when a release fails or has not yet been published

In the case of TypeScript or Python functions, your functions may fail or take a few minutes to publish. In either of these cases, the built-in backward compatibility checks will be unable to run. If you want to see the results of these checks before making a new release, you have the following options:

* If the last release failed, you should use the “custom tag” option to compare against the last successful tag.
* If the last release has not been published yet, you should wait for it to finish.
