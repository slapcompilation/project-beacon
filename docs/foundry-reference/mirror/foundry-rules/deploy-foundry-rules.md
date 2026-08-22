<!-- source: https://palantir.com/docs/foundry/foundry-rules/deploy-foundry-rules/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Deploy Foundry Rules

:::callout{theme="neutral"}
The expected total deployment time for Foundry Rules is approximately 30 minutes.
:::

Deploying Foundry Rules involves deploying each [component](/docs/foundry/foundry-rules/core-concepts/), specifically the Workshop application, the backing objects and Actions, and the Foundry Rules workflow configuration. This is done by first deploying a template, then configuring the workflow, and finally authoring and running a rule. These steps are described in the documentation below:

1. [Deploy workflow template:](/docs/foundry/foundry-rules/deploy-workflow/) <em class="bp3-text-muted"> Expected time ~ 3 mins</em>
2. [Configure workflow:](/docs/foundry/foundry-rules/configure-workflow/) <em class="bp3-text-muted"> Expected time ~ 10 mins</em>
3. [Author and run a rule:](/docs/foundry/foundry-rules/author-and-run-a-rule/) <em class="bp3-text-muted"> Expected time ~ 10 mins</em>

If you encounter any issues during deployment, review the [troubleshooting reference](/docs/foundry/foundry-rules/common-issues/) page.

For information about how to modify the Foundry Rules product (for instance by enabling optional features, adding custom properties, or changing editor permissions), review the [customize Foundry Rules](/docs/foundry/foundry-rules/customization/) page.

:::callout{theme="neutral"}
Prior to July 2022, Foundry Rules (previously known as Taurus) required more configuration, including a user-authored transform. If you deployed Foundry Rules before this date, learn more about these [configurations and concepts](/docs/foundry/foundry-rules/legacy-foundry-rules-setup-taurus/).
:::
