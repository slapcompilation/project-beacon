<!-- source: https://palantir.com/docs/foundry/questions-answers/slate/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Slate

### How can I plot multiple stacked areas on one chart so they overlay on top of each other?

You can plot stacked areas that overlay by using multiple X-axes, one for each collection of stacked areas, and then hiding the additional X-axes.

*Timestamp:* March 21, 2024

### How can I retrieve and handle an object set in Slate that was passed through from a Workshop module via an iframe widget, especially when dealing with a large number of objects?

To retrieve and handle an object set in Slate that was passed through from a Workshop module via an iframe widget, follow these steps:

1. Use `slate.getMessage` to get the filter payload. The code snippet for this step is:
   ```
   const payload = {{slEventValue}};
   return payload["workshop_variable_name"]
   ```
2. Set a Slate variable with the payload for the filter spec.
3. Query the object set service with the following body, replacing `{{slate_var}}` with your variable name:
   ```
   {
       objectSet: "{{slate_var}}",
       pageSize: 50
   }
   ```
   This will return a list of RIDs (resource identifiers).
4. Use a TypeScript function to retrieve your objects with all properties. The code snippet for this step is:

   `Objects().search().yourObject(listOfRids).allAsync()`

Note that there is a 100,000 object limit for `Objects().search()`. If your object set is larger than the `pageSize`, you'll need to handle pagination by creating a function to go through each paged result. The `pageSize` can be adjusted based on the number of objects you expect to retrieve and what can be handled by the object service and a user's network.

*Timestamp:* March 27, 2024

### Why isn't the query running when called from a function, despite running successfully through the UI?

To make the query run when called from a function, you need to either enable "Automatically run this query when the app loads and when its dependencies change" in the query's configuration, or configure an action that triggers the query using Slate events.

*Timestamp:* March 6, 2024

### How can a user show all available favorite application icons in Slate?

While there is no native Slate solution, a possible workaround is to use the resource widget in Workshop and embed it in Slate via an iframe.

*Timestamp:* April 12, 2024

### How can I display attached Ontology images in Slate using the attachment RID?

To display attached Ontology images in Slate using the attachment RID, you can use the Blobster Salt API to get a URL that points to the image, and then put that URL into an `<img>` HTML component. For example, you can replace `ri.blobster.main.image...` with the Blobster RID of the image to get a URL that you can use in an `<img>` HTML component.

*Timestamp:* March 27, 2024

### How can users upload an external library like D3.js for use in Slate Functions?

Users can add their own libraries on a per-app basis in the Functions panel, while the Admin Panel is for uploading libraries that are available to all users and apps.

*Timestamp:* March 6, 2024

### What is the best way to embed a single button built in Slate into a Workshop application and adjust the dimensions between the Slate canvas, the button, and the Workshop widget?

You could try different styling options in Slate, such as the iframe and button width, and the styling in Workshop, like widget width/height until the desired output is achieved. If the canvas is too large, you can set the styling on the canvas in Slate to disable scrolling with the following CSS: `sl-app-canvas { overflow: hidden; }`.

*Timestamp:* February 29, 2024

### What materials or resources can help a team quickly learn Slate, especially for non-technical members?

The training available in the [Palantir Learning Slate course ↗](https://learn.palantir.com/slate-course) is recommended for a quick introduction to Slate and is suitable for non-technical members.

*Timestamp:* March 21, 2024

### How can I implement a real-time countdown timer in Slate that updates every second?

To implement a real-time countdown timer in Slate that updates every second, you can create a dummy query and configure it to rerun every second. Then, set up a Slate event that is triggered by the query run, which triggers a "run" action on the function. Alternatively, you can use JavaScript's setInterval method to create a countdown timer that updates every second.

*Timestamp:* March 27, 2024

### How can I change a line in a line chart from solid to dashed using CSS?

To change a line in a line chart from solid to dashed, you can create a CSS class and apply the 'stroke-dasharray' property to it. Here's an example of the CSS code you could use:

```css
.myCSSClassForLine {
 stroke-dasharray: 4 1 2;
}
```

Then, you need to ensure that this class is applied only to the specific line you want to be dashed by using the correct selector. You may need to inspect the HTML to find the ID or class of that particular line. Both the dataset name and the series get added as classes, which can be used for targeting the specific line.

*Timestamp:* April 5, 2024

### How can I reference the x or y value in custom tool tips in the chart widget to customize it, such as showing 'y value: {{value}}'?

Examine the Handlebar values for the widget; the desired values will look like `Value: {{w_chart_1.hover.yValue}}`.

*Timestamp:* April 3, 2024

### The map widget in Slate fails to recognize the JSON string stored in an object property and throws the error message "Please enter valid json". How can this be fixed?

The problem can be solved by declaring a function in the Slate application that parses the JSON. For example, `return {{object.property}}.map(str => JSON.parse(str))`. The parsed value can then be used in the map widget.

*Timestamp:* March 6, 2024

### Is it possible to apply different colors to specific pairs of points in a scatter plot in Slate?

Yes, it is possible to apply different colors to specific pairs of points in a scatter plot in Slate by using the `Series Names` corresponding to the points. This will allow you to assign different colors to each series.

*Timestamp:* February 27, 2024

### How can I resolve the `Invalid JSON` error when using handlebars to specify inputs to Functions in a Slate application?

To resolve the `Invalid JSON` error, surround the handlebars expression with double quotations. Example: `"{{variable_name}}"`.

*Timestamp:* July 10, 2024

### How to resolve the "Multipage Slate applications are not supported" error when you try to package a Slate application for Marketplace?

The error is usually raised for `Shared` variables. To resolve the error, ensure the variables are `Local`.

*Timestamp:* June 24, 2024

### How can I embed a Workshop application into a Slate application and pass variables to the Workshop application?

You can use the iFrame widget in Slate to embed a Workshop application. Make sure to append `?embedded=true` at the end of the URL. To pass promoted variables, you can include them as URL parameters.

*Timestamp:* May 30, 2024

### What are the limitations of using public Slate applications as request forms in Foundry?

Public Slate applications in Foundry only support writing data, not reading from Foundry. All data must be static and manually entered. Additionally, external Slate applications are unable to utilize the Ontology SDK.

*Timestamp:* May 19, 2024

### How can I duplicate a Slate application?

A Slate application can be duplicated from **File -> Save As**.

*Timestamp:* July 31, 2024

### How do I redirect to relative URLs in Slate?

A feature has been recently released where you can access the base URL via `{{$global.window.origin}}` and use it to construct your redirect URL. Alternatively, you can use JavaScript to dynamically get the base URL by running `window.location.origin`, and then construct your full URL for redirection. This can be done by creating a small invisible code sandbox that runs on Slate load and returns the value to a variable.

*Timestamp:* July 25, 2024

### In Slate, how can I highlight a specific subset of `td` elements?

You can highlight specific `td` elements by using a custom CSS like below:

```
tr td:first-child {
	background-color: rgb(245, 248, 250);
	width: 5px
}

td:first-child, th:first-child {
	width: 10px !important;
}

td:nth-child(2), th:nth-child(2) {
	width: 200px !important;
}
```

*Timestamp:* July 24, 2024

### How do I remove the left side panel on a Slate application in standalone mode?

You can remove the left side panel on a Slate application in standalone mode by adding the following CSS rule to your styles:

```css
sl-app-chrome {
    display: none; 
}
```

*Timestamp:* July 18, 2024

### Is there any difference between Slate OSDK and Functions OSDK, or are they intrinsically the same?

OSDK in Slate uses the same engine on the backend as the Functions OSDK. The difference lies in a tighter integration with Slate's variables, events, and actions framework, allowing for more complex interactions within a Slate application.

*Timestamp:* August 2, 2024

### In Slate, is it possible to pre-fill a dropdown menu with Ontology objects?

The format of the raw data to pre-fill a dropdown menu depends on what you want to populate the dropdown menu with. However, it is currently not possible to render mini object options with an icon and hover state in the dropdown widget.

*Timestamp:* July 24, 2024

### Will a query automatically rerun if the input changes?

Yes; by default, functions, queries, and widgets will re-run when their dependencies change. You can override this for the Queries using the configuration panel. An alternative method would be to trigger a re-calculation from an event, such as a button press. Use the events configuration panel in order to configure this.

*Timestamp:* September 9, 2024

### Is it possible to package a Slate application that uses a Code Sandbox widget in Marketplace?

Yes, Slate supports packaging the Code Sandbox widget with JavaScript/CSS libraries in Marketplace following the usual Marketplace/DevOps process.

*Timestamp:* November 25, 2024
