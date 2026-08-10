<!-- source: https://palantir.com/docs/foundry/object-views/use-full-views-in-platform/ · mirrored 2026-08-08 from Palantir Foundry docs -->

# Use full Object Views

Full Object Views provide comprehensive displays of an object's data. They are the primary view for the object in-platform and can be accessed within platform applications or embedded into custom Workshop applications.

An example of a full `Patient` Object View:

![Full patient Object View example.](./images/overview-full-object-view.png)

An example of a full `Rental` Object View:

![Full rental Object View example.](./images/full-object-view-airport-example.png)

## Workshop

[Workshop’s Object View widget](/docs/foundry/workshop/widgets-object-view/) can display a detailed Object View inside custom Workshop applications. When configured to display the full Object View, this widget is often used within an overlay or modal to accommodate the full page resolution.

![A Workshop Object View widget example.](./images/workshop-object-view-widget-example.gif)

## Object Explorer

In [Object Explorer](/docs/foundry/object-explorer/overview/), you can search for an object, then select it to open the full Object View, providing detailed information about the objects defined in the Ontology.

![Full Object View in Object Explorer](./images/object-explorer-full-object-view.png)

## Platform applications

Applications like Vertex, Maps, and Gaia use panel Object Views to provide a customizable, compact view of the selected object. Within the panel, selecting the object’s title will open the full Object View in a moveable and resizable modal.

![A full Object View displayed in a modal within the Vertex application.](./images/vertex-full-object-view.gif)
