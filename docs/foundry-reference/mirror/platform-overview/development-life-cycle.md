<!-- source: https://palantir.com/docs/foundry/platform-overview/development-life-cycle/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Development lifecycle

At Palantir, we strive to continuously evolve production-grade software to meet the needs of our customers and improve the capabilities we offer. We incorporate cutting-edge technologies and frameworks while remaining grounded in the real-world problems our customers face every day. In practice, this means that Palantir can develop new capabilities in close partnership with customers.

This page outlines the various development life cycle phases of capabilities in the Palantir platform, including the definitions of these statuses, their availability, support levels, and the expectations we set for those statuses between Palantir and our customers.

:::callout{theme="warning"}
While this page explains the typical execution of the product development life cycle at Palantir, some attributes of a life cycle phase may vary based on a given product or feature.
:::

## Phases of development: Summary

This table provides an overview of the different development statuses and their core attributes. For more information, see the linked detail sections on each status.

| Status | Development | Availability | User support | Public documentation |
| ------ | ----------- | -------------| --------| -------------------- |
| [Beta](#beta): Early-stage feature with a typically slower rollout | 🟢 Active  | 🟡 Opt-in availability |🟢 Yes | 🟢 Yes |
| [Generally available (GA)](#generally-available-ga): Production feature | 🟢 Active  | 🟢 Broadly available | 🟢 Yes | 🟢 Yes |
| [Legacy](#legacy): Production feature without active development | 🟡 Critical fixes only | 🟢 Broadly available \*  |  🟢 Yes | 🟢 Yes |
| [Sunset](#sunset): Feature slated for deprecation, but no date is scheduled  | 🟡 Critical fixes only | 🟡 Existing customers only |  🟢 Yes | 🟢 Yes |
| [Planned deprecation](#planned-deprecation): Deprecation date and migration path communicated  |  🟡 Critical fixes only | 🟡 Existing customers only |  🟢 Yes | 🟢 Yes |
| [Deprecated](#deprecated): Feature is no longer available  | 🔴 None | 🔴 None |  🔴 None | 🔴 None |

\* Installed but disabled for new customers by default. New customers can enable the feature through Control Panel.

## Phases of development

### Beta

Once a feature's purpose and approach has been validated with one or more customer partners, it is made available to a broader group of customers in a **beta** phase.

The goals of the beta phase are to invest heavily in the long-term maintainability of a feature while measuring overall value and usage. For this reason, beta features may be rolled out slowly to customers to gather feedback during the development process. Sometimes, beta features are available to a wide range of customers; at other times, beta features may be limited to partners with specific business needs or feedback opportunities that advance the development process.

Beta features are documented publicly to help enable customer partners to use this early-stage functionality, even if the features are not yet available in every enrollment. When a feature is in the beta phase, it will be labeled as such in documentation.

There is no guarantee that beta features or products will progress to the next stages of development, though the vast majority do move on to general availability.

### Generally available (GA)

**Generally available** is the term used to describe the vast majority of features and products in Foundry. GA features are enabled for customers by default and constitute a core part of the platform. When features become GA, other parts of the platform may build on top of them to enable tight-knit integrations.

In the GA phase, there is a continuous feedback loop between Palantir engineers and the broad set of customers using the feature. Feedback is triaged, prioritized, and fed into Foundry's product roadmap, and updates are delivered to customers rapidly using [Apollo ↗](https://www.palantir.com/platforms/apollo/), Palantir's platform for continuous delivery.

Although GA features are widely available, it is possible in some cases that your enrollment may not have every feature enabled as some features have dependencies on specific types of infrastructure or may require specific contractual agreements. For example, some GA features in Foundry are only available in Palantir's managed SaaS environment and are not supported for self-hosted installations. Keep in mind that when a new feature or application is [announced](/docs/foundry/announcements/) as generally available, there may be a delay of a week or more before it becomes available within a specific Foundry enrollment.

Unless otherwise specified, any publicly documented feature is generally available, and you can rely on GA features to be fully supported. The removal of any GA feature from the platform will follow the sunset and planned deprecation processes outlined below.

### Legacy

In the **legacy** phase of development, features and products enter a stage where work is considered complete and no additional feature development is expected.

Legacy applications are widely installed across the Palantir customer base and available for continued production use. As in GA, products in the legacy status remain fully supported. For new customers, they are typically available on an opt-in basis. Despite legacy features not being actively developed, feedback is still encouraged as it can inform our work on new applications and tools.

All products and features in the legacy phase will be labeled as such and thoroughly documented publicly. At this point, no deprecation date is planned or expected.

### Sunset

As development progresses, an existing feature or application in Foundry may reach the end of its usefulness or purpose, or it may be superseded by another functionality. The original vision for the feature may be narrower than the problem space it has grown to address, or new tools or features may result in more robust or scalable solutions to a problem. At this point, we start to discourage use of the feature, and new customers will not be able to enable it for use in their enrollment.

In our public documentation, we will label products that are in the sunset phase and will suggest other tools and applications to replace them. As in GA, products in the sunset phase remain fully supported. Deprecation is planned for the future, but no exact date is confirmed. As soon a deprecation date is identified, the feature will move into the **planned deprecation** phase, with the date and any relevant migration details communicated.

### Planned deprecation

Products entering the **planned deprecation** phase are preparing for retirement from the platform. As products or features enter the planned deprecation phase, Palantir works to provide proactive communication around the scheduled retirement date and any migration steps, if needed. Products in planned deprecation remain fully supported. However, new enrollments will not be able to enable features in planned deprecation.

In planned deprecation, a feature *does* have a confirmed deprecation date, and we are in the process of removing the feature and its integrations from our platform. Like products in the sunset phase, we will label products in the planned deprecation in our public documentation and in the platform. Our public documentation will also offer suggestions for workflow migrations that will fit your use case.

When we move a feature into planned deprecation, you can expect time to migrate your workflows to new tools and applications before the scheduled deprecation date. We will use our platform [Upgrade Assistant](/docs/foundry/upgrade-assistant/platform-changes/) to notify administrators of the upcoming deprecation and provide a clear deadline for complying with workflow migrations. For application-level deprecations, the intent to deprecate and the final deprecation notice will be proactively shared with the registered platform administrator's [contact details](/docs/foundry/administration/platform-communications/) as well as publicly on the [Foundry Announcements page](/docs/foundry/announcements/). Progress towards feature deprecation is tracked quantitatively to ensure all customers are able to migrate to a replacement before a feature is finally removed from the platform.

### Deprecated

When a product completes the required tasks during the planned deprecation phase, it is considered fully *deprecated*. In this phase, the feature or product is no longer supported or available in the platform and all customers have been migrated away from relevant workflows. Customers will no longer have access to related API endpoints or other integrations, and support is no longer available. All public documentation of the feature is removed and no longer discoverable.
