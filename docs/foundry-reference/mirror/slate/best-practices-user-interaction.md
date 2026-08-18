<!-- source: https://palantir.com/docs/foundry/slate/best-practices-user-interaction/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Enable user interaction

Almost every application needs user interaction and Slate provides three primary functions for enabling interactivity:

* **Input Widgets:** Simple widgets that provide common UX elements for capturing input such as dropdown lists, text fields, radio buttons, and more.
* **Selection state within other widgets:** Most other widget types support some type of selection. Selection works a bit differently in each widget, so you'll need to play around to understand what selection type is possible.
* **Event triggers:** All widgets have a set of event triggers that broadcast when something in the widget state changes or when a user takes an action. Review the [**Events** documentation](/docs/foundry/slate/concepts-events/) for more details on how to incorporate events into your application.

The simplest pattern for capturing user input would be a static form: add input widgets and provide static options, then the user selections can be referenced in queries and functions to provide dynamic view. Normally, however, there is some complexity of “chained” inputs, where the selection in one or more inputs affects the set of available options in the next set of inputs. It's important to keep these chains short and intelligible - having too many parameters to set can lead to unintuitive and un-performant applications. See the 'Open Ended Exploration' anti-pattern below.

In this more complex configuration of dependent inputs, it's best practice to separate the workflow of configuring filters and the workflow of analyzing the resulting data. Put simply, these means that you should set any queries that depend on these user inputs to `manual` and provide the user with a button widget to *Update Data*. This pattern ensures that your application doesn't waste resources (and user time) by re-running all the queries with every filter change. This is especially key if you have any kind of free-text input - a *text field* or *text area* type widget - because otherwise downstream dependencies like queries will re-evaluate *with every user keystroke.*

:::callout{title="Writeback workflows"}
Any time your application is capturing user input to write back data, you **must** configure the query to run manually and trigger the query on an explicit user action. Otherwise your query to persist the data will run with every input change, including every keystroke in text input widgets, leading to highly unexpected behavior.
:::

## Maintain user selections between sessions

If your application requires configuring a number of different inputs to get a useful view, users may want a way to “save” their configuration to share or return to later.

It is possible to [build custom versions of this functionality](/docs/foundry/slate/concepts-variables/#user-storage-variable), but it is easier to use the built-in [shareable views](#shareable-views) feature.

## Reset selections and manage default values

Another common pattern is to give a single action for the user to reset all fields to a set of default values. The simplest pattern here is to define a `v_defaults` variable:

```json
{
    "w_multiselectWidget_raw": ["a", "b"],
    "w_multiselectWidget_display": ["Alpha", "Beta"],
    "w_textInput": "default",
    ...
}
```

Then, in the configuration for each widget, in the json definition (under the `</>` icon) you can template the particular version of the selected value property.

For any widget that has a display value in addition to the raw value, make sure you template **both** the *selectedValues* and *selectedDisplayValues*:

```json
{
    ...
    selectedValues: "{{v_defaults.w_multiselectWidget_raw}}",
    selectedDisplayValues: "{{v_defaults.w_multiselectWidget_display}}",
    ...
}
```

The final step is to configure an event to trigger an update to the `v_defaults` variable, which will cause the dependency graph to update all the downstream nodes, which will include all the input widgets with templated selection values, and the selections will return to default.

It would seem enough to simply set up an event like this: `w_resetWidgetButton.click` → `v_defaults.set`

```js
// Set v_defaults to itself
return {{v_defaults}}
```

As discussed in the [Why Things Happen in Slate](/docs/foundry/slate/best-practices-app-functionality/#understanding-why-things-happen-in-slate) section above, there is a nuance here around “forcing” the dependency graph to re-evaluate if the resolved value of the node hasn't changed. Therefore we need to add some “entropy” so that Slate understands this is a new value. It's as simple as:

```js
// Get the default values
const defaults = {{v_defaults}}

// Generate some randomness
defaults.entropy = Math.random()

// Set the value
return defaults
```

With this pattern, you can easily give the user a button to click to reset the defaults or reset them after a query is submitted.

You can go further with defaults by setting variable values through URL parameters. For instance, you may want to give users following a link from one application a different default that users coming to the app directly, and another set again for users who view it within an iframe inside a different tool all together.

To integrate this into the pattern above, rather than use a single, complex variable with multiple properties, you'd “explode” that variable to have one per default, so you could use the variable name in the URL- see [Variables](/docs/foundry/slate/concepts-variables/) for more details on how this works). One additional variable would serve as “entropy” and you could combine them all in a function that returns an object just like the one we originally had in a single variable:

```js
const defaults = {
    "w_multiselectWidget_raw": {{v_multiSelect_raw}},
    "w_multiselectWidget_display": {{v_multiSelect_raw}},
    "w_textInput": {{v_textInput}},
    "entropy": {{v_entropy}}
    ...
}
```

Whenever you wanted to move back to the defaults, you could simply have an event reset `v_entropy` to a random value and the defaults would reset.

## Validating User Input

Frequently you will need to validate user input to disable actions and provide user feedback. There are many ways to do this in Slate, but here's a common pattern that might be helpful in general cases. This function gathers all the user inputs and then implements checks. Each check can disable the form and/or provide feedback to the user.

In this example, we will validate a form for collecting information about projects, including the title, URL, contact name, project description, and project status. We want to both check the user input is valid (such that the email address has correct formatting) and also that the project doesn't already exist (such that the primary key is not already in use).

In the end we produce a JSON output that represents our validation and that we can reference throughout our application to provide user feedback and disable certain actions.

**f\_validateInputs**

```js
// -----------------------------
// Collect Inputs for Validation
// -----------------------------

// Values coming from user input
var inputs = {
    Project_Title: {{i_projectTitle.text}},
    Primary_URL: {{i_primaryUrl.text}},
    Contact: {{i_contact.text}},
    Project_Quote: {{i_projectQuote.text}},
    Status: {{i_status.selectedValue}},
}

// Other values useful for validation
var uniqueTitle = {{q_searchDuplicateProject.result.[0].hits.length}} ? false : true


// --------------------
// Initialize Variables
// --------------------

// Global flag to determine if the action should be disabled
var disable = false;

// Messages to display to the user
var messages = [];

// Text to display in the 'Save' button
var button_text = "Save " + (inputs.Project_Title ? inputs.Project_Title : "")


// --------------------------------
// Implement Form Validation Checks
// --------------------------------

// For all new projects, check if the `title` is already in use
if ({{i_newProjectToggle.selectedValue}} && !uniqueTitle){
    disable = true;
    messages.push(`Title must be unique. "${{{i_projectTitle.text}}}" already exists.`)
}

// For new projects, check if the title is already a primary key
if ({{i_newProjectToggle.selectedValue}} && {{q_checkUniquePrimaryKey.result.[0].rows.length}}){
    disable = true;
    messages.push(`This title conflicts with an existing project. The project was created as "${{{q_checkUniquePrimaryKey.result.[0].rows.[0].primaryKey.project_id}}}" and is now titled as
"${{{q_checkUniquePrimaryKey.result.[0].rows.[0].columns.title}}}"`)
}

// Check if all the required fields have a value
if (!(inputs.Project_Title &&
         inputs.Contact &&
         inputs.Primary_URL &&
         inputs.Project_Quote &&
         inputs.Status
        )){
    disable = true;
    messages.push("Complete all required fields.");
}

const email_regex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
if (inputs.Contact && !email_regex.test(inputs.Contact)){
    messages.push('Enter a valid email for "Contact Email"')
    disable = true;
}

// Check character count for project description
if (inputs.Project_Quote && inputs.Project_Quote.length > 140){
    messages.push ("'Project Quote' must be less that 140 characters.");
    disable = true;
}

// Dynamic Save vs. Update text for the button
if (inputs.Project_Title && uniqueTitle) {
    button_text = "Update " + inputs.Project_Title
}


return {
    inputs,
    disable,
    messages,
    button_text
}
```

We could use the output of this function to template the `disabled` property of our `w_submit` button to `{{f_validate.disable}}`. We can also have a simply text widget to display the error messages in a red warning:

```html
{{#each f_validateForm.messages}}
    <div class='pt-tag pt-intent-danger pt-minimal'>{{this}}</div>
{{/each}}
```

This is a very simple example and could easily be extended to have messages that are specific to each check and displayed next to a particular widget, our provide classes to apply to specific widgets to control their display - for instance you could apply an `invalid` class that has CSS to turn the input header red.

## “Dynamic Inputs”

Sometimes you need to capture input that doesn't seem to fit into static input widgets. In many cases you can tilt the problem on it's head and find a simple solution, but let's say you need to allow users to build a more complex filter or your use case seemingly can't be done with any creative use of static inputs.

You might be tempted to use a *Repeating Container* widget for this workflow, however these widgets are limited to display only. You can use an input widget inside a repeating container, but it is scoped *only* to that container and you won't be able to reference any instance of that input widget except from another widget inside the container.

Instead, you can have a single instance of your inputs, but allow the user to make selections multiple times by allowing them to ”save” their selections. You can display the accumulated selections in an HTML widget and even build in functionality to remove previous selections.

To implement this pattern, use a variable `v_userSelections` set to an empty array (`[]`). Then each time the user clicks the button to save their selection, you can update this variable:

`w_saveSelection.click` → `v_userSelections.set`

```js
// Get the existing selections
const userSelections = {{v_userSelections}}

// Get the new selection from the current state of the input widgets
const newSelection = {
    primaryCategory = {{w_primaryCategory.selectedValue}},
    secondaryCategories = {{w_secondaryCategory.selectedValues}}
    ...
}

// Combine the new selections with the prior selections
const userSelections.push(newSelection);

// Update the value of the variable
return userSelections;
```

You can then implement further events to allow users to manipulate their existing selections, most commonly to have a "delete" action for each so they can be removed.

With this pattern, you can allow users to build up arbitrarily complex sets of input criteria. Be cautious as complexity blossoms and read further into the considerations for event-heavy patterns in the **Events** section above.

In general this pattern is a specific case of the general **Stateful Application** pattern discussed in more detail below.

\:::callout{title=”Mutually dependent filters”}
The nature of the dependency graph means you can't configure widgets depend on each other in a circular relationship. Dependencies between input widgets need to “trickle down” and you won't be able to build a set of filters where the selection in *any* filter selection affect *all* widgets.
\:::

## Shareable views

Shareable views allow users to capture the current state of a Slate application and generate a unique URL that can be shared with others. When another user opens the URL, the application loads with the same selections and configurations that were present when the view was created.

A shareable view stores the following:

* The current value of all widget [interaction properties](/docs/foundry/slate/concepts-events-and-actions-index/#widget_idinteraction_propertychanged); these are properties that are changeable by user interaction, such as `selectedValue`.
* The current value of all local [variables](/docs/foundry/slate/concepts-variables/).

When a shareable view URL is loaded, the saved values override widget and local variable defaults, and downstream dependencies initialize accordingly.

### Create a shareable view

To manually create a shareable view, open the application in **View** mode and select **Get shareable view** from the **Actions** dropdown menu. This generates a unique URL with a view ID that you can share.

Slate application builders can programmatically create and load shareable views using the [`slate.saveView`](/docs/foundry/slate/concepts-events-and-actions-index/#slatesaveview) and [`slate.loadView`](/docs/foundry/slate/concepts-events-and-actions-index/#slateloadview) actions. The [`slate.viewSaved`](/docs/foundry/slate/concepts-events-and-actions-index/#slateviewsaved) event fires after a view is saved, providing the view ID that can be passed to `slate.loadView`.

### Limitations

Shareable views have the following limitations:

* **Home page only:** Shareable views currently only save and restore the home page state of a Slate application. Only local variables are included; shared variables are not saved or restored.
* **Widget and variable names:** Shareable views are tied to widget and variable names. If a widget or variable is renamed after a view is created, the saved state for that widget or variable will not be restored when the view is loaded.
* **Widget type changes:** If a widget's type is changed between when a view is saved and when it is opened, the saved state for that widget will not be applied.
* **Version independent:** Shareable views work across any version of the application. A view created on one version of the application will load on any other version, as long as the referenced widget and variable names still exist.
