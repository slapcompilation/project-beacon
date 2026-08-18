<!-- source: https://palantir.com/docs/foundry/functions/version-range-dependencies-for-functions/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Version range dependencies for functions

Workshop, Actions, and Automate can depend on either a pinned function version or a version range. A version range enables automatic runtime upgrades, which can reduce development work and allow [deployed functions](/docs/foundry/functions/functions-deployed/) to upgrade without downtime.

While version range dependencies are a powerful feature, they also carry certain risks (for example, there are [permissioning consequences specific to Actions](#permissions-and-provenance-in-actions)). This documentation explains the mechanics behind version range resolution so that you can better understand these risks and make an informed decision on whether version range dependencies are suitable for your application.

:::callout{theme="neutral"}
This documentation page assumes prior knowledge on topics like backward compatibility and the Semantic Versioning system. If you are not familiar with these topics, review our documentation on [functions versioning](/docs/foundry/functions/functions-versioning/).

You should also be familiar with the rules around version precedence as defined in the [Semantic Versioning specification ↗](https://semver.org/#spec-item-11). In other words, you should be able to determine, given two distinct versions, which one has lower precedence. For example, `1.0.0-rc.1` < `1.0.0` < `1.0.1` < `1.1.0` < `2.0.0`.
:::

## Version ranges

In its simplest form, a version range is a collection of version inequalities, and a version is said to "satisfy" a range if it satisfies all of its inequalities. For example, version `1.2.0` satisfies the range `>=1.0.0 <2.0.0`.

:::callout{theme="neutral"}
Internally, the semantics of Function version ranges are adopted from NPM, a popular package manager for the JavaScript ecosystem. Review the [NPM documentation on version ranges ↗](https://docs.npmjs.com/cli/v6/using-npm/semver#ranges) for a rigorous definition.
:::

Applications like Workshop and Actions currently only allow version ranges that comprise backward compatible versions (that is, minor or patch upgrades).

:::callout{theme="neutral"}
The NPM equivalent of this backward compatible range used by Workshop and Actions is the [caret range ↗](https://docs.npmjs.com/cli/v6/using-npm/semver#caret-ranges-123-025-004).
:::

## Version range resolution

With the exception of deployed functions, when you depend on a Function at a version range, a concrete version that satisfies the range will be chosen at runtime during execution. In particular, the *maximum* satisfying version will be chosen on an eventual basis (it can take a few minutes to pick up new releases).

### Deployed functions

For deployed functions, a concrete version is instead resolved to the currently deployed version, if it satisfies the range. If the deployed version does not satisfy the range, an error will be returned.

## Risks

While functions developers are guided towards the Semantic Versioning specification and general best practices, it is always possible for breaks to be accidentally introduced in non-major version releases.

If your application picks up a breaking change, it can manifest in any number of problems, like runtime failures or unexpected behavior.

Upon noticing a breaking change, you should immediately contact the developer of the Function so that they can [release a fix](/docs/foundry/functions/functions-versioning/#accidentally-releasing-a-backward-incompatible-change-as-a-patch-or-minor-version), and in the meantime, you should pin your Function dependency to the last working version.

:::callout{theme="warning"}
With the caveat of deployed Function dependencies, if your application has strict uptime requirements and cannot tolerate any breaks, you should use pinned version dependencies.
:::

:::callout{theme="neutral"}
Function publishers can reduce risk by [restricting stable version tags](/docs/foundry/code-repositories/branch-settings/#restrict-stable-version-tags) to protected branches. This restriction requires code review before releasing a stable version that downstream applications might consume automatically.
:::

### Permissions and provenance in Actions

When using Function version ranges in [Function-backed Actions](/docs/foundry/action-types/function-actions-overview/), there are important considerations around permissions and provenance that can affect Action behavior. For more information about these implications, refer to the Actions documentation on [auto upgrades](/docs/foundry/action-types/function-actions-getting-started/#auto-upgrades).
