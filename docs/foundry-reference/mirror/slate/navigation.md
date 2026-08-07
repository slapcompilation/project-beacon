<!-- source: https://palantir.com/docs/foundry/slate/navigation/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Navigation

There are four main areas of Slate in edit mode:

![Slate UI divided into four sections labeled 1, 2, 3, 4](/docs/resources/foundry/slate/slate-ui-annotated.png)

1. **Action bar:** This is where you’ll find the application name, the **Actions** dropdown, exit to view mode, and buttons to open various editing panels.
2. **Widget List:** The Widget List is where all the widgets in your application are listed. If you have a toolbar in your application, the list is divided into toolbar widgets and canvas widgets.
3. **Canvas:** This is the workspace for your application. Here you can rearrange widgets and test layout options. You can change the screen size using the dropdown at the top right to preview how your application will look on different screens.
4. **Widget Editor:** When you select a widget, either from the list or from the canvas, the [Widget Editor](#widget-editor) lets you configure that widget.

Additionally, there are panels that pop out in front of the canvas:

* [Queries editor](/docs/foundry/slate/concepts-queries/)
* [Functions editor](/docs/foundry/slate/concepts-functions/)
* Platform editor
  * [Object sets](/docs/foundry/slate/concepts-object-sets/)
  * [Object context](/docs/foundry/slate/concepts-object-context/)
  * [Foundry Functions](/docs/foundry/slate/concepts-foundry-functions/)
* [Events editor](/docs/foundry/slate/concepts-events/)
* [Dependency graph](/docs/foundry/slate/applications-dependencies/)
* [Styles editor](/docs/foundry/slate/concepts-styles/)
* [Variables editor](/docs/foundry/slate/concepts-variables/)

The **global search** in editor mode, accessed with the keyboard shortcut Ctrl+K on Windows or Cmd+K on macOS, allows you to search and go to Slate queries, functions, objects, variables and widgets. Slate's global search will also keep a history of your searches to prioritize recent results. Selecting the result will open up the appropriate Slate editor panel.

![cmd-k-history](/docs/resources/foundry/slate/cmd-k-history.png)

## Widget Editor

The Widget Editor has three tabs with editing options for the selected widget.

**Property tab:** This is the main editing tab. Use this tab to change the widget’s properties. The options available vary by type of widget.

![widget-editor-property-tab](/docs/resources/foundry/slate/widget-editor-property-tab.png)

**Layout tab:** Set the position and size of your widget, and apply custom styling.

![widget-editor-layout-tab](/docs/resources/foundry/slate/widget-editor-layout-tab.png)

**JSON tab:** If the changes you would like to apply are not possible using the settings available in the **Property** tab, you can edit the raw JSON configuration of the widget in this tab. Each widget starts with template code containing the most commonly-used attributes, and any fields you change in the **Property** tab are also added to the **JSON** tab.

:::callout{theme="warning"}
State that is not exposed through the **Property** tab is managed internally by Slate, so you should closely review any modifications you make to Slate's default values in the **JSON** tab to avoid unexpected behavior.
:::

![widget-editor-json-tab](/docs/resources/foundry/slate/widget-editor-json-tab.png)

**Events tab:** Some widgets have associated events, which you can configure here.

![widget-editor-events-tab](/docs/resources/foundry/slate/widget-editor-events-tab.png)
