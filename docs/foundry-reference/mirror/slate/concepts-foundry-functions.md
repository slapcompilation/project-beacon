<!-- source: https://palantir.com/docs/foundry/slate/concepts-foundry-functions/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Use Foundry Functions in Slate

The Foundry Functions panel allows Slate to execute business logic written in a Functions repository as a "backend" service. In this paradigm, consider the Slate application the *client*, the Foundry Functions implementation the *server*, and the Ontology the *database* of a traditional web application infrastructure. Consult the documentation for more information on how to [get started with Foundry Functions](/docs/foundry/functions/getting-started/) or how to use [Functions on Objects](/docs/foundry/functions/functions-on-objects/).

The Foundry Functions panel lets you:

* Select a Foundry Function for which you have access,
* Select the version of this Function (e.g. version 0.0.5),
* Pass a typed Input into the Function, if the Function permits (note that if the Function takes object sets as inputs, you can pass in Slate-defined Object Sets as inputs via Handlebars and resolve them), and
* Use the typed Output of the Function in Slate by referencing the Function’s handlebar `{{ff_foundry_function1}}`.

The Function will need to be created in the [Function Repository](/docs/foundry/functions/getting-started/) before being used in Slate.

## Approaches for Slate

When writing Functions to use in a Slate application, you should consider two approaches that differ based on where the application *logic* is implemented.

* In a *thin Functions* approach, the Functions are a simple pass-through to access data in the Ontology API. Any additional manipulation, for example to scale a value appropriately to use as the `Radius` for a **Scatterplot** chart, is done in the Slate app in a regular JavaScript function.
* In a *thick Functions* approach, all the business and display logic is also pushed into the Foundry Functions layer, leaving only very specific formatting or display logic and the actual layout and widget configuration within the Slate app itself.

Using Foundry Functions to organize and manage the logic layer of a complex Slate application has significant benefits, such as:

* **Strong typing**, which is a best practice that prevents entire categories of potential edge cases.
* **Working in a repository**, which provides separate versioning and collaboration for the frontend and backend of the application, and also enables standard practices for organizing and structuring code.
* **Decoupling application logic from a specific frontend** creates reusable components that can be referenced in other applications.

## Function Input and Output Types

Foundry Functions supports a wide range of standard, ontology-generated, and custom input and output types as documented in [Functions Input and Output Types](/docs/foundry/functions/types-reference/).

In a *thick Functions* approach, it's common to define [custom input and output types](/docs/foundry/functions/types-reference/#structcustom-type) so that data is returned in exactly the format necessary to populate specific charts or populate HTML widgets.
