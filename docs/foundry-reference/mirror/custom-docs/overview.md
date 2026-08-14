<!-- source: https://palantir.com/docs/foundry/custom-docs/overview/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# In-platform custom documentation

You can create, publish, and manage custom documentation hosted on the Palantir platform with a [documentation code repository](/docs/foundry/custom-docs/create-custom-docs-repository/). These "custom docs" can be [indexed by AIP Assist](/docs/foundry/assist/aip-assist-custom-docs-overview/), enabling AIP Assist to answer queries using your organization's documentation.

You can access custom documentation in the following ways:

* From the application launcher
* If custom documentation currently exists in your workspace, through the **?** help icon on the left sidebar.
* Directly with your enrollment documentation URL: `https://<your-enrollment>/workspace/documentation/`

See [the section below](#in-platform-documentation-application-title) for details on how to configure the title of the in-platform documentation application in your enrollment.

Note that the in-platform documentation application may include core documentation pages published by default that do not come from a custom documentation repository (for example, information on installing SAP connectors in data integrations).

## In-platform documentation application title

The title of your custom documentation application is based on the Palantir platform title configured in [Control Panel](/docs/foundry/administration/configure-platform-experience/#configure-the-platform-title). For example, if your platform title is `ABC`, the application title will be `ABC documentation`. The platform title can be set in Control Panel in the **Platform experience** settings. If no platform title is set in Control Panel, or if it is set to `Palantir`, the custom documentation application title will default to `Custom documentation`.

## Code Repositories documentation template

Palantir's in-platform custom documentation uses a special documentation template in [Code Repositories](/docs/foundry/code-repositories/overview/). This documentation template requires a specific organization of files to enable discovery and publishing by the custom documentation service. In-platform custom documentation pages are written in Markdown with a few important [differences from standard Markdown](/docs/foundry/custom-docs/faq/#what-are-the-differences-between-standard-markdown-and-the-syntax-required-for-custom-docs).

[Get started with creating a new documentation repository.](/docs/foundry/custom-docs/create-custom-docs-repository/)
