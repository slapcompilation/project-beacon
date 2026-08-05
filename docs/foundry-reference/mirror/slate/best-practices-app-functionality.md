<!-- source: https://palantir.com/docs/foundry/slate/best-practices-app-functionality/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Understand dependencies

## Understanding "why things happen" in Slate

In Slate, all widgets, functions, variables, and queries are modeled as *nodes* in a graph. Each node *evaluates* to a JSON output and other nodes are *templated* to *reference* that output. These references define *dependencies* between nodes, which Slate uses to understand when to *re-evaluate* nodes when something changes (i.e. new user input; query executes; variable value updates).

A primary process of “developing” your Slate application will be the process of defining these nodes by adding *widgets* - for displaying outputs and capturing inputs; *functions* - for lightly manipulating data for display and handling application login; and *queries* - for making queries for data or connections to other Foundry service APIs, and then configuring their dependencies through [Handlebar](/docs/foundry/slate/concepts-handlebars/) syntax.

## Dependency graph

You can always view a representation of this *dependency graph* using the [Dependencies](/docs/foundry/slate/applications-dependencies/) tab, to understand how Slate interprets the relationships you've configured through your [Handlebar](/docs/foundry/slate/concepts-handlebars/) references. This graph representation *is* your application - if it represents something that seems "wrong", then your starting point is to understand *why* rather than assume the graph is misrepresenting your application.

Whenever something unexpected happens in your application, start with the Dependencies tab to understand the upstream nodes from whatever widget is misbehaving. Look for unexpected relationships that may cause a node to re-evaluate based on an unrelated query or user input.

It is sometimes useful to think of the dependency graph as "lazy" - it avoids unnecessary work by only re-evaluating a node when the upstream references have changed **value**. This results in potentially confusing behavior when an upstream node updates to the **same value** as it previously was - downstream queries won't execute and downstream widgets won't re-render. This is commonly encountered in patterns that involve resetting user input - search your Foundry for the *Intro to the Dependency Graph and Events Framework* tutorial and the *Resetting Widget Selections* example to see this in action and how to work around it using `Math.random()` to inject entropy into the dependency graph evaluation and ensure nodes re-evaluate.

## Events

With the Dependency Graph, Slate handles the complexity of determining when functions should recompute or when queries should rerun based on the state of their upstream dependencies. Most workflows can be configured using this functionality and it should *always* be the first impulse as a Slate developer to rely on the Dependency Graph wherever possible.

There are situations, however, where it makes sense to supplement the Dependency Graph with explicit trigger/action pairs, which Slate calls “Events”. Some simple cases are to trigger the display of a banner or toast when a query finishes, open a dialog when a user clicks something to view more details, or run a query from a button click after configuring a number of inputs.

[Learn more about the Event framework and examples of common basic event patterns.](/docs/foundry/slate/concepts-events/)

:::callout{theme="warning" title="Event madness"}
It can be tempting, once you've realized the power of the Events framework, to see every development task in Slate through the lens of an event-based solution. This can lead to a common failure mode where a single app contains hundreds of event/action pairs. While this is technically possible, this complexity makes it difficult to step through the expected behavior of your application and can preclude even simple debugging.

As a rule of thumb, keep your event “chains” as short as possible and bias towards solutions that rely on the Dependency Graph rather than the Events. If you find your app growing to >50 events, especially if those events are doing more than just triggering toasts or initiating queries, it's a good time to pause and think carefully through your application architecture for opportunities to refactor and simplify your development or further decompose your application into sub-applications.
:::

### Custom event triggers

In addition to the built-in event types, you can create custom events in **HTML** and **Table** type widgets to allow different elements in these widgets to broadcast different events from a user click.

The configuration of these custom triggers takes 2 steps:

1. Define the trigger in HTML element using the `slClickEvent` property:

```html
<div class='pt-button' slClickEvent='delete'>Delete Me</div>
```

2. Register the trigger in the widget configuration by adding the name to **Click Event Names** array.

Once the new event is registered, you'll see a new option wherever you can select an event trigger like `myWidgetName.click.delete`. Note that even if you dynamically generate the HTML to define the click events, the *registration* of those events still needs to be hard-coded so that Slate can keep track of the potential triggers, even if the conditions are such that you don't actually have that button generated at the moment.

You can use these events to build out custom button groups in HTML or combine them with event values, discussed below, to create lists or tables where each item has its own set of actions.

:::callout{title="Conditional events"}
If you need to add extra conditions (beyond the simple trigger firing) you can use the JavaScript portion of the Event configuration to execute additional logic. Evaluate your logic and if the event *should not* execute the action, return the special `{{slDisableAction}}` value. This value *does not* permanently disable the event, but rather interrupts that *specific* instance of the event action.

As a best practice, refrain from developing complex logic *inside* your Event JavaScript - there is no linting or error reporting so any mistakes or uncovered edge cases can cause your code to silently fail and lead to unexpected behavior. Instead, consider implementing an function that encapsulates the logic for event validity - then your event JavaScript can be as simple as:

```
unless ({{f_checkValidAction}})
    return {{slDisableAction}}
```

You can, however, put `debugger()` statements in your Events and then use the Chrome Developer Tools to catch their execution and step through your logic.
:::

### Passing event values

In addition to the `slClickEvent` property, you can define a `slClickEventValue` for a given HTML element. Whenever this event is triggered, you can reference the associated value in your event JavaScript using the special `{{slEventValue}}` variable.

This opens up a range of patterns for dynamic interactions:

1. Create a function that generates the HTML for your **Text** or **Table** widget and defines the `slClickEvent` and `slClickEventValue` for each element.
2. Create the necessary events and use those events to set the value of one or more *single* variables to the value from the event.
3. Trigger some further action - most commonly a query - off the `variable.changed` event trigger and reference the value of the variable.

For instance, you can use this pattern to add a small **'x'** next to rows in a table in an element where `slClickEvent` is 'delete' and the `slClickEventValue` is the row primary key. You can then set the value of a variable called `v_idToDelete` to the event value when `myTable.click.delete` event fires. Then run a `q_deleteRow` query based on `v_idToDelete.changed` event to complete this little chain.

Be wary of making chains much longer or more complex than this - see the caution on circular dependencies below - and favor short, distinct events rather than large, nested, or otherwise convoluted arrangements as these become difficult to reason about and debug and often lead to unexpected behavior.

:::callout{title="Events and circular dependencies"}
The Slate dependency graph is technically a 'Directed Acyclic Graph' (DAG), which means that the node relationships are directed (meaning that there is a hierarchy from root nodes to leaf nodes and node resolution happens in that direction) and that the entire graph must be acyclic, meaning Slate will attempt to prevent you from configuring any “loops” - no matter how long - in your graph of dependencies.

However, using [Events](/docs/foundry/slate/concepts-events/) and setting variable values or triggering queries, it's possible to add a loop to your application, which will result in non-deterministic behavior. If you have a workflow that seems to necessitate a circular dependency, take a step back and consider alternative patterns - there's almost always a way to achieve the desired workflow functionality.
:::

## Managing query execution

One implication of the dependency graph framework, is that by default the entire dependency graph will resolve on page load. This means that every query and function will run is the necessary order for each node in the graph to resolve. In practice, this often means that if you haven't been paying attention during development, you'll slowly notice your page load performance decrease until you start getting intermittent timeouts. The root cause is almost always many queries that are “root” nodes in that they have no upstream query dependencies - this means *all* of these queries will attempt to run simultaneously. This can lead to queuing and load shedding from so many simultaneous browser connections, so many simultaneous queries to the same table(s), and so much network traffic returning to the application. The end state non-deterministic query failures and an application that feels sluggish, if not entirely broken, on page load.

:::callout{title="Connection pools and queueing with Postgate"}
In Postgate, each user of your application has a **connection pool** specifically created for them (or restored from a cache if they already used the application recently).   Each connection pool is limited to 10 connections at once, which prevents any one application instance from overloading Postgate, as it's shared by all users of your application and by any other applications using data that's been synced. Performance wise, this limit actually results in *better* performance that allowing all the queries through at once (if there are more than 10) as Postgres is faster globally the fewer simultaneous queries it's responding to.

Once all 10 connections are used up, the remaining query requests queue up, each one taking a connection once it becomes available. However, rather than allowing a connection to wait forever, to connection pool will time out on queries that have been waiting for a connection for five seconds. This means if you have a number of queries that take several seconds saturating the pool, queries that may have been fast - for instance, when you use the **Test** button to run it in isolation, may take a long time or even be timed out.
:::

The solution here has several parts:

1. Develop your application workflow so that queries are spaced out and depend on user input. A common pattern is to run a few small queries against pre-aggregated or DISTINCT tables to populate a set of filters, but “force” the user to make some selections and click a *Submit* button to run queries that actually fetch the data.
2. Develop queries cautiously with an eye towards balancing the total number of queries - especially the total number  of “heavy” (average >5s to return) that run on page load, with the amount of data brought back from each query. Make sure your queries are not doing unnecessary work - see the sections on **Indexes and Schema** and **Postgres Tuning** above.
3. Control when your queries execute by either specifying additional criteria that must be met before the query executes or by setting the query to `manual` and then triggering the query with an event - commonly a button click.

:::callout{title="Parsimonious queries"}
In all development, you should strive towards parsimonious code - your code should do just as much work is necessary in the most efficient way possible. This is frequently a downfall of Slate queries, which spend lots of time doing the same work over and over. Consider this simple query, to populate a dropdown for a user to select a category:

```sql
SELECT DISTINCT(COALESCE(category_col)) FROM "my_table"
```

This means that on *every page load* Postgres has to repeat the work of looking at the `category_col` value in every row to see if it is null and then generate a list of all the distinct values. Using a transform and a new derived dataset, this work could be done *once* whenever there is new data added upstream and then the query is simply:

```sql
SELECT * FROM "my_table_categories"
```

Even if you can't fully remove SQL expressions, for instance where you need to accommodate users input, you should strive to factor out as much work as possible into upstream transformations and then build simpler queries. Always keep in mind this principal of “doing work” as few times as possible, and you will be on your way to more stable and performant applications.
:::

For the third part, let's look at the two common patterns in more detail. Using these in your application can greatly reduce the number of queries running on page load and ensure that your application behaves as expected.

### Conditional queries

Conditional Queries provide the most fine-grained control for query execution and can be combined with "Event triggered" or "Manual" configuration (described below) to add logical conditions that must be met for a query to execute. Turn on execution conditions for a query by checking the `In addition...` box under the dropdown next to `Run`.

In the simplest case the `All dependencies are not null` option prevents the query from executing if any of the handlebar expressions in the query or its partials do not have specified values. This is particularly useful for queries that must have some amount of user input before being meaningful and prevents unnecessary round-trips to the database for queries that will fail because the `WHERE` statement is incomplete.

### Manual queries

A simple strategy for controlling when your queries run is to set them to `manual`, using the checkbox in the dropdown next to the `Run` button.

A query set to run manually will *only* execute when it's triggered by an event or a manually-specified dependency.

This is the correct pattern for queries that should be triggered by a user action, but can lead to unnecessary complexity if you start “chaining” together too many - see the note in the **Events** section above. You can still rely on the dependency graph to take care of all the nodes downstream of your manual query - after the query runs from its trigger, any downstream dependencies will update automatically; no need to add complexity by adding events based on the `q_queryName.success` event.

## Best practices and common patterns for JavaScript functions

Functions provide the ability to lightly manipulate data or perform logic based on user selection and your application state. A couple of often overlooked patterns and features can make your work with functions cleaner and simpler.

### Avoid duplicate work by returning complex objects

If you look at the example of [Validating User Input](/docs/foundry/slate/best-practices-user-interaction/#validating-user-input), you'll notice that rather than returning a single value, the validation function returns a *JavaScript Object*. Slate can parse these objects and makes them available through Handlebars anywhere else in your application.

This means that if, for instance you need to derive a few new display columns to use in different widget, instead of making a function for each one, you can build a single function that creates all the display values needed in different formats, and return them all in an object. We'll take a closer look at this example below.

There's always a balance between consolidating logic into fewer functions, which can help reduce duplicated work and keep similar work consolidated, and breaking logic apart, which can help encapsulate discrete operations and make it easier to find just the necessary code. Keep this trade off in mind and periodically refactor your functions as you refine your application.

### Generating display columns

Often you'll find that you need to do a little extra work to shape your data for display in a chart or generate some HTML for display in a table. Where possible, for example in the case of formatting dates, you should explore doing this work as part of the data transformation and preparation phase - this follows the principle of doing work as few times as possible (i.e. once in a transform rather than on every page load for every user).

Where that's not possible, you can write a simple function to map through each value in a column and do some work to generate a new value, all while preserving the data structure that Slate expects.

```js
`// f_deriveDisplayColumns

var data = {{q_myQuery.results.[0]}}
data.newColA = _.map(data.primaryKey, (value,key,index) => {
    // Work to derive new column
    return newColValue
});
return data;`
```

This snippet uses the [Lodash ↗](https://lodash.com/docs/4.17.10) version of the `_.map()`function; you could equally use the build in `Array.map()` for this case. It is generally useful to familiarize yourself with Lodash helper functions as they are tremendously helpful in manipulating JavaScript objects and often implement complex algorithms that could be bug-prone to re-implement from scratch.

With the function complete, rather than referencing `{{q_myQuery}}` directly, you can instead reference `{{f_deriveDisplayColumns}}` anywhere in your app, since it has the same structure as the original query response object, just with additional “columns” added in.

### Factoring code with custom libraries

If you do find that you need to implement a rather complex piece of JavaScript, consider moving it to a custom library at the bottom left of the function editor. Libraries make pure JavaScript functions available in any Slate “function”, so you can avoid repeatedly implementing the same helper functions multiple times.

Since Libraries are pure JavaScript, you can't use Handlebars *inside* them; rather like normal JavaScript you can pass parameters into the library functions when they are called from a Slate “function”. These parameters can then be filled with Handlebars or otherwise dynamically generated.

### Documenting your functions

In both your Library code and your functions, always take the time to organize your code cleanly and document the potentially unintuitive sections. You can always strive to write “self-documenting” code, but it is always kind to future developers and maintainers to be in the habit of cleanly and succinctly documenting your logic.
