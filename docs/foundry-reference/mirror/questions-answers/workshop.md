<!-- source: https://palantir.com/docs/foundry/questions-answers/workshop/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Workshop

### Is it possible to dynamically set the initial object view tab ID for an object view widget?

Currently, it is not possible to set the initial object view tab ID dynamically. The suggested workaround is to create multiple overlays, one for each tab you want to display initially.

*Timestamp:* February 14, 2024

*Tags:* Workaround

### Is blue the only color option available for metric card outlines in tabbed layouts?

Yes, blue is currently the only option for metric card outlines in tabbed layouts.

*Timestamp:* February 14, 2024

*Tags:* Upcoming fix

### How can I improve the contrast between the node background and the text in the hierarchy widget when using dark mode?

Use a variable to track the current theme and conditionally display different copies of the widget with different styling for light and dark modes. Additionally, consider customizing the node and text colors to improve visibility in both modes.

*Timestamp:* February 14, 2024

*Tags:* Workaround

### What should I do if I get an unknown Marketplace packaging error after adding installation parameters to a mobile workshop?

To resolve the unknown Marketplace packaging error, you should: disable the marketplace configuration, check which components are problematic and fix them, clear changes without saving, and then implement the component/variable fixes with the marketplace configuration enabled and untouched.

*Timestamp:* February 14, 2024

### Is there a way to chain Actions in a workflow, specifically to run a second Action after the first one successfully completes that uses the results of the first Action?

You can use [Automate](/docs/foundry/automate/effect-actions/) to trigger additional Actions based on outcomes of the first Action.

*Timestamp:* February 14, 2024

### How can we create a permanent URL for a Workshop module that remains valid even if the underlying module changes?

You can use a top-level Workshop module that remains the same, then embed the actual Workshop module inside it. You can also possibly use promoted variables for routing, such as using `page=page1` instead of `/page1`.

*Timestamp:* February 14, 2024

### How can I export a formatted table Markdown widget to the clipboard for easier export in an email template?

You can convert the contents of the Markdown widget into a string variable and then export that string to the clipboard by configuring an Export on-click event.

*Timestamp:* February 14, 2024

### How can I access a Workshop module from the object view page if it is not visible after saving? Can it be recovered if it wasn't published?

To access a Workshop module that is not visible in the object view page after saving, you should ensure that you selected **Publish**. Doing so will ensure that the object view uses the latest saved version of the module. If the **Publish** button is not selectable, or the Workshop module seems to be disconnected, you can manually paste the module ID into the code editor in the object view editor. To recover the module ID, navigate to the object type in Ontology Manager to view all Workshop modules in which the object type is used. The module ID should include `Object View Tab` in the title unless it was renamed.

*Timestamp:* February 14, 2024

### How can I link to a specific object in Workshop using an external ID variable?

Use the primary key of the object as a promoted string variable, and have an object set variable that is filtered by the primary key.

*Timestamp:* February 14, 2024

### Does embedding Workshop modules affect the initial load time? Is it faster to build everything in one module versus splitting into multiple modules and embedding them?

Embedded Workshop modules generally improve the initial load time because they are loaded lazily after the initial render. However, if there are multiple levels of embedding that are all visible on the initial page, the initial load may be slower due to a "waterfall" effect. However, if the larger module is broken up so originally non-visible parts are split into embedded modules, there may be a slightly faster initial load.

*Timestamp:* February 14, 2024

### Can a hidden property on an object type be used in a Workshop module? If not, is there a workaround?

Hidden properties are not accessible in applications like Workshop. As a workaround, you should change the visibility of the property to `Normal`, then configure the Workshop module to hide the property in the user interface where necessary.

*Timestamp:* February 14, 2024

### Why is the AIP Generated Content widget no longer displaying the output in Markdown format?

If the LLM is changing the format of the output, explicitly instruct the LLM in the prompt to not format the output.

*Timestamp:* February 14, 2024

### How can I auto-populate the timezone in the Date and Time Picker widget based on a user-selected object's timezone code?

You can auto-populate the timezone in the Date and Time Picker widget by using IANA timezone codes (for example, `Asia/Dubai`) instead of GMT time codes.

*Timestamp:* February 14, 2024

### How can I plot an object set with a time-dependent property to create multiple series?

You can create multiple layers on a chart and set one of those layers as a time-dependent property.

*Timestamp:* February 14, 2024

### Why can't the option to save state be found in the Workshop interface after enabling state saving with filter variables? Is there a way to access state saving without having the module header visible?

The module header must be visible for the dropdown menu related to state saving to appear in the interface. If the module header is hidden, the state saving option will not be accessible.

*Timestamp:* February 14, 2024

### How can I reset a filter variable when changing a section tab?

To reset a filter variable when changing a section tab, use the **Hide default tabs** option and replace the default tabs with a tabs widget that allows configuring events.

*Timestamp:* March 18, 2024

### In Workshop, how can I filter an object set to get the latest object based on a timestamp property?

You can create a maximum timestamp aggregation variable and use that to filter the object set. This will result in an object set containing the object with the latest timestamp.

*Timestamp:* March 6, 2024

### In Workshop, can users manually rearrange the order of objects displayed in the list?

No, manual rearrangement of objects is not supported in Workshop. The order can be controlled only by sorting using a property.

*Timestamp:* March 28, 2024

### What object export limits exist in Workshop, and are there ways to work around these limits for larger exports?

When exporting object data from Workshop, there is a 200,000 object limit for exports involving regular property types and 10,000 object limit for exports involving function-backed derived columns.

To export beyond the above limits, you can first materialize the view you're attempting to export as a dataset and then download that dataset. There are several options for doing this, such as passing the object set to Quiver and then saving the object set to a dataset with Quiver.

*Timestamp:* April 4, 2024

### Is there a workflow for passing object lists or sets between Workshop modules, or from Object Explorer to Workshop, that is more efficient than exporting to Excel and manually copying and pasting primary keys?

The solution is to use the Workshop module interface, which allows you to configure object sets to pass between Workshop modules when using **Open in Workshop** events. Additionally, Carbon's discoverable modules can be used to configure an **Open in** action in Object Explorer.

*Timestamp:* March 19, 2024

### Is it possible to preload multiple embedded Slate iframe widgets on module load in a Workshop application?

No, it is currently not possible to pre-load Slate iframe widgets in Workshop.

*Timestamp:* April 9, 2024

### How do you change the tab display name in the browser for a Workshop application?

The tab name is set to the Module Header Title value; change this value to change the tab display name in the browser for a Workshop application.

*Timestamp:* March 6, 2024

### How can I merge the outputs of two map selection filters in Workshop?

In Workshop, use a variable transform that unions the two filter output object sets.

*Timestamp:* April 18, 2024

### How can I use conditional formatting in metric card widgets to format timestamps based on how stale they are compared to the current time?

You can use conditional formatting for the metric card widget to reference other variables in the Workshop application. You can create a numeric variable that represents the stale value using the `Between times` transform. This variable can then be used to control the conditional formatting of the metrics card.

*Timestamp:* April 15, 2024

### In a Workshop module, are variable transformations on strings performed locally or in the cloud?

Variable transformations on strings are executed locally within the browser.

*Timestamp:* April 18, 2024

### How can I increase the number of allowed groupings in the pivot table widget beyond the maximum limit of 7?

You cannot directly increase the maximum number of allowed groupings in the Pivot Table widget due to a set limit intended to prevent overloading the frontend. However, a workaround is to add "hidden groupings" to your table. This method allows users to swap between these hidden groupings on the UI, effectively managing more groupings than the limit without directly increasing the allowed number. This approach maintains performance while offering flexibility in data presentation.

*Timestamp:* April 19, 2024

*Tags:* Workaround

### What is the limit on the number of functions that can be executed at once from a single user in a workshop application?

While there is no limit encoded in Foundry, browsers like Chrome have a limit of 6 inflight requests per domain.

*Timestamp:* April 18, 2024

### How can the limit of object set size for sorting with calculated columns be increased beyond 200?

A workaround is to express the logic from the derived column as a function backed column, which allows sorting up to 1000 rows.

*Timestamp:* April 18, 2024

*Tags:* Workaround

### Is it possible to display the icons displayed in the Map widget in a Workshop application based on a boolean property?

It is currently not possible to display the icons based on a boolean value but a workaround solution is to use a function-backed property. You could also consider splitting the data layers based on the boolean field and then have a static icon for both the layers.

*Timestamp:* April 18, 2024

### How can I display a static string like `No Date Specified` in a table in Workshop when the date property is null?

The solution is to use a derived function-backed column, as there are currently no null value configuration options in Workshop at the moment.

*Timestamp:* April 18, 2024

### How can an interactive weighted graph from an adjacency list be displayed in either Slate or Workshop without having to build it from scratch?

The Slate graph widget can be used to display an interactive weighted graph from an adjacency list. This widget allows the specification of edge labels and provides interactivity such as moving nodes around and selecting them.

*Timestamp:* April 18, 2024

### How can you save data from the comments widget in a Workshop app into a field on the object?

There are two suggested methods:

* Using Action Logs to store the data on a linked object, or
* Having the comments widget run an Action when a user submits a comment to write back to an object.

*Timestamp:* April 18, 2024

### In Workshop, is it possible to disable the "Configure columns" feature in the Object Table widget for end users?

No, it is not possible to disable the "Configure columns" feature for end users in view mode.

*Timestamp:* April 17, 2024

### How can I conditionally hide tabs or sections based on the current users group membership?

You can create a new string array variable and assign it the Multipass attribute for groups of the current user. This variable can then be used to perform a frontend check of the user's group memberships.

*Timestamp:* March 5, 2024

### How can I make a media preview selectable in a Workshop application?

If the media reference is coming from an object, you can use the Object List widget. In the **Property Configuration**, select **Add Media** and reference the property that has the media. Then, use the **On Object Selection** configuration on the widget to trigger the desired event.

*Timestamp:* June 10, 2024

### In a Workshop application, is it possible to modify variables in the parent module from within a looped layout?

Yes, you can modify a variable inside your loop layout's embedded module; if it is interfaced with a variable in the parent module, then the value will change in the parent module. Learn more about [interface configuration](/docs/foundry/workshop/embedded-modules/#interface-configuration).

*Timestamp:* May 30, 2024

### How can I upload an Excel file into Workshop using the Media Uploader widget?

Ensure that the `.xlsx` extension is included in the **Allowed File Extensions** configuration for the Media Uploader widget.

*Timestamp:* May 19, 2024

### How can I cast a date variable to a string in Workshop and display it in a specific format?

Create a string variable through **Variable Transform** with a **String concatenation** board. In the string concatenation board, insert a date variable and hover over the date variable to access the **Format value** section that allows you to change the format of the date.

*Timestamp:* June 13, 2024

### How should I configure inline editing in a Property List widget?

Property List inline editing uses the inline action for the property that is configured in Ontology Manager. Inline editing in the widget can only be enabled if one exists for the property.

*Timestamp:* July 30, 2024

### Is there a way to trigger a copy to clipboard action from Workshop using a variable-backed string?

This can be achieved by configuring a button widget with **On Click -> Export -> Export Type -> Clipboard -> Export Content Type -> String Variable** and configuring the string variable to be copied to clipboard.

*Timestamp:* July 9, 2024

### Why are function-backed variables not recalculating automatically?

The behavior is expected if you are running the function with the same values as it fetches the cached results. You can work around this by passing the current timestamp or a `nonce` value that will force the variable to be recomputed.

*Timestamp:* June 3, 2024

### How can I hide the Foundry sidebar when embedding a Workshop or other Foundry application inside an iframe?

You can add an `embedded=true` query parameter to the URL to remove the sidebar.

*Timestamp:* February 12, 2025

### If access to AIP Logic application is restricted via the Control Panel, will the functions created from AIP Logic still be accessible in Workshop applications?

Yes, users without access to the AIP Logic application should still be able to execute Logic functions that are part of a Workshop application.

*Timestamp:* March 11, 2024
