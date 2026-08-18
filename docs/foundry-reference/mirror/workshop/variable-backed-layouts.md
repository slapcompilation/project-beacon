<!-- source: https://palantir.com/docs/foundry/workshop/variable-backed-layouts/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Variable-backed layouts

Variable-backed layouts allow you to dynamically control the state of layout components using variables. This enables you to build responsive applications where user interface elements react to user interactions, object properties, or custom logic defined in functions.

The following layout components support variable backing:

* **Pages:** Control which page is displayed in a multi-page module
* **Sections:** Control visibility and collapse state
* **Tabs:** Control which tab is selected
* **Overlays:** Control whether an overlay is open or closed

## Variable-backed page selection

You can bind a string variable to a multi-page module to control which page is displayed. When the variable value matches a page's ID, that page becomes active.

To configure variable-backed page selection:

1. Open the module settings panel from the left side bar in edit mode.
2. In the configuration panel under **Pages**, locate the **Variable-backed page selection** setting.
3. Select a string variable to control the displayed page.
4. For each page, set a unique **Page ID** that matches the values your variable will contain.

This feature is useful for deep linking to specific pages through URL parameters, navigating between pages based on user actions, or controlling page selection from parent modules through interface variables.

:::callout{theme="neutral"}
[Layout events](/docs/foundry/workshop/concepts-events/#layout) that switch pages do not update the value of the variable configured for variable-backed page selection. To keep the variable in sync with page changes triggered by events, use a [set variable value](/docs/foundry/workshop/concepts-events/#set-variable-value) event instead.
:::

## Variable-backed section conditional visibility

You can bind a Boolean variable to a section to control whether it is visible or hidden. By default, the section is hidden when the variable evaluates to `true` and visible when it evaluates to `false`. You can invert this default behavior by changing the Boolean selector to the right of the variable selection.

To configure variable-backed section visibility:

1. Select the section in your module.
2. Locate and toggle on the **Conditional Visibility** setting.
3. In the configuration panel, locate the **Hide section if** setting.
4. Select a Boolean variable to control the section visibility.
5. Optionally, configure the section to hide when the Boolean variable is false.

This differs from the collapse state feature in that hidden sections do not appear in the layout at all, whereas collapsed sections still show their headers and can be expanded by users. Events will not be offered to update section visibility. Use [set variable value](/docs/foundry/workshop/concepts-events/#set-variable-value) events instead.

## Variable-backed section collapse state

You can bind a Boolean variable to a collapsible section to control whether it is expanded or collapsed. When the variable evaluates to `true`, the section is collapsed. When it evaluates to `false`, the section is expanded.

To configure variable-backed collapse state:

1. Select the section in your module.
2. In the configuration panel, enable the **Collapsible** setting.
3. Locate the **Variable-backed collapse state** setting and select a Boolean variable.

This feature is useful for expanding sections only when relevant data is present, or for coordinating the expand and collapse behavior of multiple sections.

:::callout{theme="neutral"}
[Layout events](/docs/foundry/workshop/concepts-events/#layout) that expand, collapse, or toggle sections do not update the value of the variable configured for variable-backed collapse state. To keep the variable in sync with section state changes triggered by events, use a [set variable value](/docs/foundry/workshop/concepts-events/#set-variable-value) event instead.
:::

## Variable-backed overlay open state

You can bind a Boolean variable to an overlay to control whether it is open or closed. When the variable evaluates to `true`, the overlay opens. When it evaluates to `false`, the overlay closes.

To configure variable-backed overlay state:

1. Select the overlay in your module.
2. In the configuration panel, locate the **Variable-backed open state** setting.
3. Select a Boolean variable to control the overlay state.

This feature is useful for opening overlays in response to events, controlling overlay state from parent modules through interface variables, or coordinating multiple overlays.

:::callout{theme="neutral"}
[Layout events](/docs/foundry/workshop/concepts-events/#layout) that open or close overlays will update the value of the variable configured for variable-backed open state. You can also configure an **On close** event to reset an upstream variable or perform other actions when the overlay is closed.
:::

## Variable-backed selected tab

You can bind a string variable to a tab container to control which tab is currently selected. When the variable value matches a tab's ID, that tab becomes active. This works bidirectionally: selecting a tab updates the variable, and changing the variable selects the corresponding tab.

To configure variable-backed tab selection:

1. Select the tab container in your module.
2. In the configuration panel, locate the **Variable-backed tab selection** setting.
3. Select a string variable to control the selected tab.
4. For each tab, set a unique **Tab ID** that matches the values your variable will contain.

This feature is useful for synchronizing tab state across multiple tab containers, persisting the selected tab in the URL through a module interface variable, or programmatically changing tabs based on user actions elsewhere in the module.

:::callout{theme="neutral"}
Unlike page selection and section collapse state, [layout events](/docs/foundry/workshop/concepts-events/#layout) that change the selected tab will also update the value of the variable configured for variable-backed tab selection.
:::
