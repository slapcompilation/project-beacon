<!-- source: https://palantir.com/docs/foundry/workshop/application-design-faqs/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Application design frequently asked questions

## When should I embed other modules in my Workshop module?

[Embed Workshop modules](/docs/foundry/workshop/embedding-workshop-modules-overview/) to separate logic and reduce the number of variables contained in one large module with many distinct components or independent pages that users must navigate. If you reuse an interface across multiple pages in a single module, then you should consider using embedded modules to streamline module maintenance over time.

## When should I use a centered pop-up window versus a drawer popover that renders on one side of a user's screen?

Use a centered pop-up window for critical tasks or decisions that require a user's undivided attention, such as confirmations, alerts, or action forms.

Use a drawer popover for secondary tasks that contain supplementary information, such as details about a component, settings, or secondary actions. Drawer popovers keep the module's main content visible, as users may need to reference that content to help them complete a secondary task you embed in the popover.

## When should I use an Object Table versus an Object List?

Use an [Object Table](/docs/foundry/workshop/widgets-object-table/) to display data with multiple attributes or columns, enabling comparison, sorting, and bulk actions.

Use an [Object List](/docs/foundry/workshop/widgets-object-list/) for simpler, linear content with few attributes, enabling fast review or single-item actions.

## When should I use a collapsible section versus a completely hidden section that a user opens by selecting a button?

Use a collapsible section when you want users to be able to render and hide content while keeping the section's location visible. Collapsible sections are most compatible with side panels and filters that contain supplementary information. You can configure visibility through a user toggle or through variable-based logic.

Hide a section that a user makes visible through button selection when the section's content is only relevant for certain actions or use cases within your module. This can also be useful for modules with dense user interfaces or limited screen space when a collapsible section is already used.

If you are building an application for use on a mobile device, then you should review the [mobile design best practices documentation](/docs/foundry/workshop/mobile-design/).

:::callout{theme="neutral"}
You should avoid stacking collapsible sections.
:::

## When should I show the side panel by default?

Show a side panel by default when:

* Its content is essential or frequently used, such as content that aids in module navigation or provides critical metrics.
* The panel's user interface is simple.
* Users will primarily use your module on larger screens, meaning space is not a constraint.

You should [use a collapsible or hidden section](#when-should-i-use-a-collapsible-section-versus-a-completely-hidden-section-that-a-user-opens-by-selecting-a-button) when the panel is optional, contains secondary information, or when users will primarily use your module on smaller screens.

## When should I create a page overlay?

Review the [overlays section of the core concepts documentation](/docs/foundry/workshop/concepts-layouts/#overlays) to determine if an overlay is appropriate for your specific workflow.
