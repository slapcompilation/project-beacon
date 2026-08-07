<!-- source: https://palantir.com/docs/foundry/slate/concepts-events-and-actions-index/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Available events and actions

The page lists all available events and actions in Slate at the query, function, variable, widget, and application levels. Learn how to configure and use these events and actions in our [additional documentation](/docs/foundry/slate/concepts-events/).

## Global events

Global events are events that occur at the application level and are not specific to individual components or queries.

### slate.ready

The `slate.ready` event triggers once the page framework is loaded and queries have begun to run. Any actions you wish to trigger immediately on page load (for example, firing some manual queries) should happen here.

### slate.resize

The `slate.resize` event triggers whenever the browser window is resized. If any widgets are sized based on the size of the browser window, they will also be resized. However, some widgets (such as Charts) have a `redraw` action that you can trigger to ensure that widgets are redrawn to the correct size, even as the browser window size changes.

### slate.onNavigate\[`page_name`]

`slate.onNavigate[page_name]` is triggered whenever a user navigates to the page to which the event is added.

### slate.onPrint

`slate.onPrint` is triggered whenever the user closes the printing modal that was previously opened with the `slate.print` action.

### slate.userStorageChanged

`slate.userStorageChanged` detects when the userStorage was updated with the `slate.setUserStorage` action. This event is also supported if the user storage was updated through another browser tab or window.

### slate.getMessage

`slate.getMessage` is for Slate applications that live inside iframes in other applications, like Workshop. The `slate.getMessage` event triggers whenever Slate receives a postMessage from the parent iframe of the form:

```json
{ "target": "slate-parent-iframe-event", "message": <payload> }
```

The `slate.getMessage` event is also triggered if a child window or parent window sends a postMessage that contains an object with the following target property set:

```json
{ "target": "SLATE_MESSAGING_SERVICE", ...<payload> }
```

The event will be triggered. Then, inside the JavaScript pane for this event, `<payload>` will be available as `{{slEventValue}}` so the data in the message can be used appropriately.

Messages sent to Slate can also perform actions, such as setting variables:

```json
{
    "slateActionOption": {
        "type": "SET_VARIABLES",
        "payload": {
            "v_variable": 123
        }
    }
}
```

You can also run actions:

```json
{
    "slateActionOption": {
        "type": "TRIGGER_ACTION",
        "payload": <payload for action>
    }
}
```

### slate.getBroadcast

`slate.getBroadcast` is triggered whenever Slate receives a message from a `BroadcastChannel` that Slate has opened. To open a `BroadcastChannel`, use the [`slate.createBroadcastChannel`](#slatecreatebroadcastchannel) action. A channel will need to be opened before receiving a message.

The message payload will be available as `{{slEventValue}}`, which has the following structure:

```json
{
  "channel": "channel_name",
  "data": <payload>
}
```

### slate.onCloseCheckpoint

`slate.onCloseCheckpoint` is triggered whenever the user closes a Checkpoint. It provides information about the Checkpoint that was closed, which is available as `{{slEventValue}}` and has the following structure:

```json
{
    "slateCheckpointId": string,
    "status": "cancelled" | "no-checkpoint" | "success",
    "interactionRid": string (optional - if Checkpoint was successful);
}
```

`slateCheckpointId` is a user-defined string that identifies the Checkpoint. It is defined when using the [`slate.showCheckpoint`](#slateshowcheckpoint) action.

You can read more about Checkpoints in the [Checkpoints documentation](/docs/foundry/checkpoints/overview/).

### slate.onChildWindowClosed

`slate.onChildWindowClosed` is triggered when a child window that was opened with the [`slate.redirectToUrl`](#slateredirecttourl) global action, is closed. The window must have been assigned an `id` using the `windowSharingOptions` property when calling `slate.redirectToUrl`, otherwise this event will not fire.

The message payload `{{slEventValue}}` has the following structure, where `id` is the ID of the closed window:

```json
{
    "id": string | number
}
```

### slate.viewSaved

`slate.viewSaved` is triggered after a [shareable view](/docs/foundry/slate/best-practices-user-interaction/#shareable-views) is saved through the **Actions** dropdown menu or the [`slate.saveView`](#slatesaveview) action. The `{{slEventValue}}` contains the view ID (string) of the newly created view.

This event can be paired with the [`slate.loadView`](#slateloadview) action to build save-and-load workflows. For example, you can store the view ID from `{{slEventValue}}` and later pass it to `slate.loadView` to restore that view.

## Query events

Query events are events related to queries in Slate applications that are triggered when a query is completed or when a query fails to complete successfully due to reasons such as timeout, a badly formatted query, or some other server issue. Each query has its own instance of these events.

### QUERY\_NAME.success

This event triggers whenever the query specified by `QUERY_NAME` completes successfully. Each query has its own instance of this event.

### QUERY\_NAME.failure

This event triggers whenever the query specified by `QUERY_NAME` fails to successfully complete, due to reasons such as timeout, a badly formatted query, or some other server issue. Each query has their own instance of this event.

## Function events

Function events are events related to Slate functions execution. Each function has its own instance of these events.

### FUNCTION\_NAME.ran

This event triggers whenever the function specified by `FUNCTION_NAME` has finished running. Each function has its own instance of this event.

## Variable events

Variable events are events related to Slate variables interaction. Each variable has its own instance of these events.

### VARIABLE\_NAME.changed

This event triggers whenever the variable specified by `VARIABLE_NAME` has changed. The changed value will be available as `{{slEventValue}}`. Each variable has its own instance of this event.

## Widget events

Widget events are triggers that are used to cause actions or activities within your Slate application. They can be used to create interactivity and automate processes within your application. Each widget has its own instance of these events.

### WIDGET\_ID.cssClassesUpdated

This event triggers whenever the “Additional CSS Classes” property belonging to the specified widget's `WIDGET_ID` is changed. This event triggers once the DOM is updated but before it is painted; this means that if you are using CSS classes to change the size of different widgets, using this event to trigger `redraw` actions on those widgets will work exactly as expected. Each widget has its own instance of this event.

### WIDGET\_ID.transitionend

This event triggers whenever a JavaScript `transitioned` event happens from directly inside the widget specified by `WIDGET_ID`. In this case, "directly" means not from a child widget; only one event is triggered per `transitioned`. To be more specific, you can use CSS transitions to animate elements on the page, like having a sidebar slide in and out as opposed to popping up and out. Whenever one of these transitions completes, JavaScript will fire a `transitioned` event that Slate captures and passes along. This way, you can trigger other changes to occur on the page when transitions complete, or prompt a `resize` action on widgets that may have changed size.

Whenever this event is triggered, `{{slEventValue}}` is a JavaScript object that holds the following properties:

* `elapsedTime`: The amount of time the transition took
* `propertyName`: The name of the property being animated
* `targetId`: If the DOM element being animated had an ID property, it is available here

These properties may be useful to discern specific transitions from others; make sure that your code is responding to the correct one. Each widget has its own instance of this event.

### WIDGET\_ID.INTERACTION\_PROPERTY.changed

This event triggers whenever the `INTERACTION_PROPERTY` property that belongs to the widget specified by `WIDGET_ID` changes. The changed value will be available as `{{slEventValue}}`. Note that this event is not available on every single property of each widget, but only on the “interaction properties" (meaning the properties of the widget that are changeable by user interaction, such as `selectedValue`). Each widget interaction property has its own instance of this event.

## Global actions

Global actions control behavior changes at the application level such as page or window modifications, data exports and cross application messaging.

### slate.navigateTo\[`page_name`]

The `slate.navigateTo[page_name]` action will change the page in scope to `page_name` and will also update the URL route to point to the target page. [Shared variables](/docs/foundry/slate/concepts-variables/#creating-a-variable) will maintain their state across page changes.

### slate.scrollToId

The `slate.scrollToId` action will scroll the page (and any other scrollable containers in the page) to the DOM element with a given ID (the ID returned in the JavaScript code in the events panel). This action can be used to scroll the page to specific elements programmatically or return to a remembered place in a scrollable table or list.

### slate.setWindowTitle

The `slate.setWindowTitle` action allows you to rename the current browser window's title and update the tab name. Call the action and return a string to set the tab name. If this action is not called on page load, Slate defaults the tab title to the document name.

### slate.print

The `slate.print` action will open the browser's print dialog to allow the user to select their printer options before printing.

### slate.downloadBlob

The `slate.downloadBlob` action allows you to download arbitrary data blobs while following Slate's export restrictions. To use this action, add a return statement as below:

```js
return {
    fileName: "my_file.txt",
    blob: new Blob(["Hello, world!"], { type: "text/plain;charset=utf-8" }),
};
```

An example use case is to download Excel files with conditional formatting by using a library like ExcelJS in the Functions tab and then send to `slate.downloadBlob` for the user to download. For more information on Blobs, see the [MDN web docs ↗](https://developer.mozilla.org/en-US/docs/Web/API/Blob).

### slate.exportWidget

The `slate.exportWidget` action allows you to export widgets as a PNG or PDF file. To use this action, add a return statement as below:

```js
return {
    widgetId: "my_chart",
    exportType: "download",
    outputType: "png",
    fileName: "exported_chart",
};
```

Using this event will trigger the `slate.onExportWidget` event, which will have an `slEventValue` containing:

* `widgetId`: The ID of the widget that was exported.
* `base64`: The base64 encoded string of the exported widget (either as PNG or PDF).

Set the `exportType` to `eventOnly` to trigger the `slate.onExportWidget` event without copying/downloading the file.

### slate.sendMessage

The `slate.sendMessage` action is for Slate applications that live inside iframes in other applications. Specifically, this action will take the value it is passed (returned from the JavaScript code in the panel) and send a postMessage of the following form to the parent iframe:

```json
{"source": "slate-parent-iframe-action", "message": <payload>}
```

The `<payload>` is the value returned from the JavaScript code in the panel.

The `slate.sendMessage` action can also be used to send messages to other windows, even when Slate does not live inside of an iframe.

For example, you can use the [`slate.redirectToUrl`](#slateredirecttourl) to open a child window in a new tab or browser window, and set an ID for that window.

You can then send messages to a specific window using the `slate.sendMessage` action:

```js
return {
    "targetOptions": {
        "targetWindow": "child" | "opener" | "parent",
        "children": ["child-id1", "child-id2"] // (optional)
    },
    "message": <payload>
}
```

If the target window is set to `child`, you can provide an array of the children window IDs that were set when using `slate.redirectToUrl`. If this is not provided, all the child windows will have the message sent to them.

The `targetWindow` for `opener` and `parent` will perform the postMessage to `window.opener` and `window.parent` respectively.

### slate.createBroadcastChannel

The `slate.createBroadcastChannel` action will create a `BroadcastChannel` with the specified name. This channel can be used to send/receive messages to/from all broadcast channels with the same channel name.

To use this action, add a return statement as below:

```js
return {
    channel: "my_new_channel",
};
```

For more information on BroadcastChannel, see the [MDN web docs ↗](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel).

### slate.closeBroadcastChannel

The `slate.closeBroadcastChannel` action will close and delete the `BroadcastChannel` with the specified name. No messages will be received or sent if the channel is closed.

To use this action, add a return statement as below:

```js
return {
    channel: "channel_to_close",
};
```

### slate.broadcastMessage

The `slate.broadcastMessage` action will post a message to the broadcast channel with the specified name. A channel will need to be opened with the [`slate.createBroadcastChannel`](#slatecreatebroadcastchannel) action before a message will be sent.

To use this action, add a return statement as below:

```js
return {
    channel: "my_channel",
    message: <payload>
};
```

### slate.showCheckpoint

The `slate.showCheckpoint` action will open a the specified Checkpoint modal. You can read more about Checkpoints in the [Checkpoints documentation.](/docs/foundry/checkpoints/overview/)

To use this action, add a return statement as below:

```js
return {
    slateCheckpointId: string;
    checkpointType: CheckpointTypeV1;
    primaryCheckpointedItemId?: {
        id: string;
        type: CheckpointedItemIdType;
    };
    additionalCheckpointedItemIds?: {
        id: string;
        type: CheckpointedItemIdType;
    }[];
};
```

`slateCheckpointId` is a user-defined string that identifies the Checkpoint and is returned in the response of the [`onCloseCheckpoint`](#slateonclosecheckpoint) event.

`checkpointType` should be the Checkpoint type of the configured checkpoint. [View the types of Checkpoint types.](/docs/foundry/checkpoints/checkpoint-types/)

#### Export configuration

| Property   | Type                   | Description                                                      |
| ---------- | ---------------------- | ---------------------------------------------------------------- |
| widgetId   | `string`               | The ID of the widget (as shown in the widgets list) to export.   |
| exportType | `"copy" \| "download"` | Download the widget as a file or save it to clipboard.           |
| outputType | `"png" \| "pdf"`       | Export the widget as a PNG or PDF file.                          |
| fileName   | `string (optional)`    | The name of the downloaded file if `exportType` is `"download"`. |

#### Unsupported widgets

The `iframe`, `code sandbox`, and `multiselect box` widgets, as well as containers that contain any of the previously mentioned widgets, cannot be exported.

### slate.openAppsPortal

The `slate.openAppsPortal` action will open the [Applications Portal](/docs/foundry/app-building/curating-apps/). You can specify the part of the Applications Portal you want to navigate to by optionally passing an argument. The argument must be of the following form:

| Part of the Applications Portal                 | Argument                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| No specification                                | No argument                                                             |
| All applications                                | `{ type: "allResultsNavItem" }`                                         |
| Platform applications                           | `{ type: "platformAppsNavItem" }`                                       |
| Promoted apps                                   | `{ type: "promotedAppsNavItem" }`                                       |
| Platform applications with specified category   | `{ type: "platformAppsCategoryNavItem", title: string }`                |
| Promoted applications with specified collection | `{ type: "promotedAppsCollectionNavItem", title: string, rid: string }` |

### slate.askAIPAssist

The `slate.askAIPAssist` action will open the [AIP Assist](/docs/foundry/assist/overview/) support tool. You can specify an optional `prompt` string argument, which will be sent as the user's message in the AIP Assist chat. The `prompt` can be derived from the current user's state in the application to allow for targeted questions to AIP Assist.

```json
return {
  "prompt": "How do I interact with widgets in Slate?"
};
```

### slate.logout

The `slate.logout` action will open a browser dialog to confirm if the user wants to log out. If the user confirms, they will be logged out of Foundry.

### slate.copyToClipboard

The `slate.copyToClipboard` action will copy the value returned from the JavaScript code in the panel to the user's clipboard.

### slate.redirectToUrl

The `slate.redirectToUrl` Action will redirect the user to the URL passed to the Action.

:::callout{theme="warning"}
We do not recommend using this Action with the `slate.ready` event as doing so will redirect the user as soon as the page loads, making editing difficult. If your use case does require using the `slate.redirectToUrl` action with the `slate.ready` event, we recommend adding a query parameter to disable the Action.
:::

#### Configuration

| Property             | Type                         | Description                                                                                                                                                                                                          |
| -------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| url                  | `string`                     | The target URL of the redirect.                                                                                                                                                                                      |
| target               | `string (optional)`          | The name of the browsing context the resource is being loaded into. Alias for the `target` parameter in `window.open`.                                                                                               |
| popup                | `boolean (optional)`         | Specifies whether the `url` should be opened in a popup window.                                                                                                                                                      |
| windowSharingOptions | `{ id: string; } (optional)` | Enables sending or receiving of postMessages from the child windows you open. The `id` property specifies a unique ID for the child. You can then communicate with this window using the `slate.sendMessage` action. |

For example, the following code will open a new tab for the specified website:

```json
return {
  "url": "https://www.palantir.com/",
  "target": "_blank"
};
```

Multiple URLs can also be returned to open multiple tabs or pages. This can be done by returning a list of the configuration objects. For example, the following code will open a new tab for both websites:

```json
return [{
  "url": "https://www.palantir.com/",
  "target": "_blank"
}, {
  "url": "https://www.palantir.com/uk",
  "target": "_blank"
}];
```

### slate.saveView

The `slate.saveView` action saves the current application state as a new [shareable view](/docs/foundry/slate/best-practices-user-interaction/#shareable-views). No parameters are needed.

After the view is saved, the [`slate.viewSaved`](#slateviewsaved) event fires with the new view ID available as `{{slEventValue}}`.

### slate.loadView

The `slate.loadView` action loads a previously saved [shareable view](/docs/foundry/slate/best-practices-user-interaction/#shareable-views) by ID. Return the view ID string from the event JavaScript to specify which view to load.

```js
return "view-id-string";
```

When the view is loaded, the application navigates to display the specified view, applying the saved widget interaction properties and variable values.

## Query actions

Query actions operate on a specific query or its result set. They enable application builders to run a query or export the query result set when a specific event is triggered.

### QUERY\_NAME.run

This action will immediately run the query specified by `QUERY_NAME`. This action works whether the query is manual or not. Each query has its own instance of this action.

### QUERY\_NAME.export, QUERY\_NAME.exportXlsx, QUERY\_NAME.exportCsv

`QUERY_NAME.export` will export the results of the query specified by `QUERY_NAME` as an .xlsx file. It will run the query on the server, generate a file, and download it to the user’s computer. Each query has its own instance of this action.

The `QUERY_NAME.export` action can be added as a trigger to an event from the **Export on** dropdown menu in the **Queries** tab.

![The Query Export on menu](/docs/resources/foundry/slate/queries-export-on.png)

By default, the file will be named `QUERY_NAME.xlsx`. To change this, navigate to the **Events** tab and select `QUERY_NAME.export`. You can then add a return statement to configure the file name. For example, `return "january_data"` or `return {fileName: "january_data"}` will download an .xlsx file called `january_data.xlsx`. A valid file name should not be empty and must only contain letters, numbers, underscores, or spaces. If the file name in the return statement is invalid, the query's name will be used as the file name.

You can select the `QUERY_NAME.exportXlsx` or `QUERY_NAME.exportCsv` actions from the **Actions** dropdown menu in the **Events** tab. Then, you can add a return statement to change the file name to a valid file name.

### QUERY\_NAME.exportCsv, QUERY\_NAME.exportXlsx

These actions download the output of the query specified by `QUERY_NAME` to the user's local machine. The result can either be downloaded as a CSV or Excel file. By default, the file will take on the query's name, although you can customize the name by returning an `{ fileName: <<custom_string>> }` object in the event.

## Function actions

Function actions operate on a specific function or its result set. They enable application builders to run a function or export the function result set when a specific event is triggered.

### FUNCTION\_NAME.run

This action will immediately run the function specified by `FUNCTION_NAME`. Each function has its own instance of this action.

#### FUNCTION\_NAME.export, FUNCTION\_NAME.exportXlsx, FUNCTION\_NAME.exportCsv

`FUNCTION_NAME.export` will export the results of the function specified by `FUNCTION_NAME` as an .xlsx file. It will run the function, send the results to the server, generate a file, and download it to the user’s computer. Each function has its own instance of this action.

The `FUNCTION_NAME.export` action can be added as a trigger to an event from the **Export on** dropdown menu in the **Functions** tab.

![The Function Export on menu](/docs/resources/foundry/slate/functions-export-on.png)

By default, the file will be named `FUNCTION_NAME.xlsx`. To change this, navigate to the **Events** tab and select `FUNCTION_NAME.export`. You can then add a return statement to configure the file name. For example, `return "january_data"` or `return {fileName: "january_data"}` will download an .xlsx file called `january_data.xlsx`. A valid file name should not be empty and must only contain letters, numbers, underscores, or spaces. If the file name in the return statement is invalid, the function's name will be used as the file name.

You can select the `FUNCTION_NAME.exportXlsx` or `FUNCTION_NAME.exportCsv` actions from the **Actions** dropdown menu in the **Events** tab. Then, you can add a return statement to change the file name to a valid file name.

:::callout{theme="neutral"}
For function export to work, the function must return an object where *every* property represents a column name and every property value is an array of equal length representing the value of each cell in the column. This means that if you are working with query results, you must delete the `._results` property from the query; this property is added by Slate to provide information on whether a query ran successfully, but it will block exports from a function.
:::

## Variable actions

Variable actions operate on a specific variable. They enable application builders to modify with the value of the variable when a specific event is triggered.

### VARIABLE\_NAME.set

This action will set the variable specified by `VARIABLE_NAME` to whatever value the action passed (the return value of the JavaScript code in the **Action** panel). Note that the old/current value of the variable will still be available as `{{VARIABLE_NAME}}`, allowing you to use the previous value to determine what you will set the new value to. Each variable has its own instance of this action.
