<!-- source: https://palantir.com/docs/foundry/slate/logic-overview/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Logic

Applications often require data to be modified or enriched before it can be presented to the user or visualized in some other way. Similarly, the application might require additional information to run the way you intend. For example, you may want to indicate that a widget must have the appropriate configuration to run successfully, or that certain information appears based on the state of the application. Slate provides multiple primitives to manage and manipulate states and data.

**Functions** are JavaScript snippets that can read Handlebars and return any type of output. Functions can process data coming from queries, take in states of widgets or variables and construct new values, or prepare classes for widgets. Learn more about [functions in Slate](/docs/foundry/slate/concepts-functions/).

**Handlebars** pass values from one component to another, using the output of a function in a widget or a query in an event. Handlebars give you access to all the information currently flowing through your application via two curly brackets `{{ }}`. Learn more about [using Handlebars in Slate](/docs/foundry/slate/concepts-handlebars/).

**Variables** store application state, user inputs, or defaults. Set variable values through URL parameters or events. The **Variables** panel provides a spreadsheet-like interface where you can resize columns, edit cells, use context menus, and upload CSV files to initialize or update tabular values. Learn more about [variables in Slate](/docs/foundry/slate/concepts-variables/).

**Events** are made up of an individual event and a user action. Events trigger activity in your application; for example, you can configure an Event to submit a query when a button is selected or display a toast after a dialog is closed. Events and actions handle all kinds of automated interactions inside of Slate. Learn more about [Events and Actions in Slate](/docs/foundry/slate/concepts-events/).
