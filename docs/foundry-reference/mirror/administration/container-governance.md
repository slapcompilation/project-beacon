<!-- source: https://palantir.com/docs/foundry/administration/container-governance/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Container governance

Open Container Initiative containers (commonly referred to as Docker containers) are a popular language-agnostic way to package software applications, allowing developers to combine dependencies from multiple toolchains into a cohesive package. Docker containers are particularly powerful for packaging complex applications, leveraging legacy technologies, or integrating libraries that are not available in Foundry's natively supported languages (Python, Java, and R).

Container workflows raise additional security risks for your organization. Because container images are authored outside Foundry and could introduce and accumulate software vulnerabilities, the administrator is responsible for implementing software supply chain controls and regularly auditing containers running in Foundry.

To mitigate these risks, Foundry's compute infrastructure implements industry-leading controls and strict [image requirements](/docs/foundry/transforms-container/container-overview/#image-requirements) that limit the type of container workloads users can run. In particular, container images must run with a non-root numeric user ID, and must not have access to kernel privileges.

Foundry also provides administrative tooling to track which containers are running in production, and regularly scans active containers to identify software vulnerabilities. The **Container governance** page in [Control Panel](/docs/foundry/administration/control-panel/) empowers administrators to audit the state of container workflows in their Foundry installation, and to recall vulnerable containers when necessary.

:::callout{theme="neutral"}
Containers running through Foundry's compute infrastructure are subject to similar [metadata visibility](../../apollo/apollo-product-specification/manifest.md#metadata-visibility) rules as containers running in Apollo platform.
:::

## Enable container workflows

The **Settings** tab of the **Container governance** page in [Control Panel](/docs/foundry/administration/control-panel/) allows resource administrators to enable or disable container workflows. By default, all container workflows are disabled. All container workflows require the [Rubix ↗](https://blog.palantir.com/introducing-rubix-kubernetes-at-palantir-ab0ce16ea42e) engine as the backing infrastructure; this toggle will be disabled if Rubix is not used.

![Container governance settings tab](./images/container-governance-settings.png)

## Vulnerability scanning

Foundry periodically scans all actively used user-uploaded Docker containers for vulnerabilities. An overview of vulnerabilities affecting your enrollment is available in the **Vulnerabilities** tab of the **Container governance** page in [Control Panel](/docs/foundry/administration/control-panel/). By default, Foundry does not take any actions based on found container vulnerabilities.

![Container governance vulnerabilities tab](./images/container-governance-vulnerabilities.png)

### Recall vulnerabilities

The **Vulnerabilities** tab of the **Container governance** page in [Control Panel](/docs/foundry/administration/control-panel/) allows resource administrators to recall or un-recall individual vulnerabilities. Any Foundry job that uses a container affected by recalled vulnerabilities will be forcefully stopped. Similarly, vulnerabilities can be un-recalled.

<img src="./images/container-governance-recall.png" alt="Container governance vulnerability recall pop up" width="500">
