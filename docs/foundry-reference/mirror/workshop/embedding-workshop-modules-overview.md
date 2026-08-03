<!-- source: https://palantir.com/docs/foundry/workshop/embedding-workshop-modules-overview/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Embed Workshop modules

Workshop offers two features that support embedding another Workshop module: the **Embedded Module** widget and the **Loop** section layout ("loop layout").

These features allow building Workshop modules that can be embedded within other Workshop modules. Embedded modules support all features offered by Workshop, though there are some [limitations](#limitations) to the interaction of the embedded and embedding modules. This documentation will at times refer to a module that embeds another module as the "parent" module, and the module that is embedded as the "child" module. When this documentation refers to an "embedded module", the reference applies to both the **Embedded Module** widget, and the module embedded in the **Loop** layout, unless otherwise indicated.

## Use cases

Embedded modules have a number of use cases, including:

* [Reuse across many modules](#reuse-across-many-modules)
* [Reuse within a single module](#reuse-within-a-single-module)
* [Maintainability](#maintainability)
* [Marketplace customization](#marketplace-customization)
* [In-place replacement of a Workshop module](#in-place-replacement-of-a-workshop-module)

### Reuse across many modules

Embedded modules allow a single child module to be configured and reused in many parent modules. Some examples of the types of embedded modules that can be built include:

* A configured object view
* A single widget with a complex configuration
* A set of widgets backed by complex variable logic
* Complex variable logic with no widgets at all

### Reuse within a single module

Embedded modules can be used many times in a single parent module, either through the loop layout, or individual embedded module widgets. Some examples of a child module that would be embedded many times in the same parent module include:

* A custom card view derived from provided variables
* A set of widgets that will be displayed one time per tab, or page

### Maintainability

Embedded modules can be used to break up a larger parent module into many child modules for better maintainability. This allows each child module to have its own variable scope, and for each child module to be edited at the same time by different Workshop builders.

### Marketplace customization

An embedded module can be used to provide an area of customization when packaging a Workshop module with Marketplace. The embedded child module will be packaged as a dependency, and at installation time, a Marketplace user may select a module with the same module interface variable type signature to customize part of the installed parent module.

### In-place replacement of a Workshop module

Embedded modules can be used to deploy a new Workshop module implementation without changing the Workshop resource that your users are already using. You can do this by using an embedded module as the only widget in the module. This allows you to make large changes to a module without requiring your users to migrate to a new Workshop resource.

## Communicating across embedded modules

Use [module interface variables](/docs/foundry/workshop/module-interface/) to communicate between a parent and child module or between sibling modules. For example, these shared interface variables can back shared state, such as a selected object, a selected tab, or whether an overlay is shown. Embedded modules may modify the value of interface variables through events, allowing other places that reference these variables to respond according to the updated value.

:::callout{theme="neutral"}
Workshop always uses the parent module's variable definition and ignores the embedded module's interface variable definition. The [embedded modules interface configuration documentation](/docs/foundry/workshop/embedded-modules/#interface-configuration) contains more information about this behavior.
:::

When you open an embedded child module in edit mode (for example, via **Open referenced module** from the **Embedded Module** widget or a **Loop** instance), the child module editor opens with the current values of any mapped module interface variables applied. This mirrors view-mode behavior and makes it easier to debug embedded modules with the same state that is present in the parent.

## Limitations

### No module settings inheritance of child modules

Configuration at the module level for child modules, such as [routing](/docs/foundry/workshop/routing/), [state saving](/docs/foundry/workshop/state-saving/), and [auto-refresh](/docs/foundry/workshop/auto-refresh/), is not used. This means auto-refresh must be explicitly configured for every module that you intend to use auto-refresh with, and auto-refresh will not work specifically within the context of the embedded module. To embed a module that will auto-refresh inside a parent module that does not auto-refresh, you can use the [iFrame widget](/docs/foundry/workshop/widgets-iframe/) to embed a separate module that acts as a sandboxed environment that will auto-refresh. You can set a URL query parameter `embedded=true` to hide the Foundry sidebar.

Should your workflow require, you can configure these settings at the parent module level, with variables passed down to child modules through the [module interface](/docs/foundry/workshop/module-interface/).

### Event passing

Embedded modules do not support the concept of *event passing*. *Event passing* would allow a builder to pass an event configuration from the parent module to the child module, allowing the child module to call an event that references configuration from the parent module (for example, the child module calling an event that opens an overlay in the parent module).

To [communicate across embedded modules](#communicating-across-embedded-modules), a parent module may pass variables backing layout state to module interface variables of the child module as a way for the child to modify the layout state of the parent.

### Embedded module provenance

Similar to other "Foundry apps" widgets in Workshop, the provenance of embedded modules used by other Workshop modules is not reported by [Data Lineage](/docs/foundry/data-lineage/overview/).

### Self-referential embedded modules

A module may not embed itself, either directly or through a chain of child modules. If a self-reference is configured, the module will display a warning to builders and render nothing to viewers in order to prevent a possible infinite chain of embedded modules. Contact your Palantir representative if you have a use case that requires recursive or self-referential embedded modules.

### Permission of embedded modules

Embedded modules are separate resources with their own permission settings. If a user has permission to view a parent module that embeds a child module for which they lack permission to view, the user will see a "failed to load module" error.

### Performance

Embedded modules should have similar performance characteristics to that of normal Workshop modules. One notable difference is that initialization of embedded modules is delayed until the embedded module is displayed in view. Once initialized, the embedded module is expected to run as if the entire module had been configured in the same place.

Note that the child module configuration will be initialized one time per instance, which comes with a cost to initialize its variables, but the child module configuration will only need to be loaded a single time if reused across many instances.

Usage of embedded modules and loop layouts make it much easier for builders to configure very large, complex modules. Builders should be aware of the total number of widgets and variables being displayed at once, particularly ones that are expensive to load.

### Mobile mode

The **Embedded Module** widget and **Loop** layout can only embed other mobile modules when the module is in [mobile mode](/docs/foundry/workshop/mobile-overview/).
