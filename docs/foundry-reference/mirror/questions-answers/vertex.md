<!-- source: https://palantir.com/docs/foundry/questions-answers/vertex/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Vertex

### In Vertex, can nodes in a graph be colored based on the number of links to a specific object?

At the moment, Vertex does not provide a direct method for achieving this. The application supports styling by derived properties, which only consider the object(s) being styled as input.

*Timestamp:* April 16, 2024

### How can I automatically update a graph with a new node when a new object is added to the backing dataset?

You can make a graph template and embed it in a Workshop module, passing an object set containing all the objects of the type to the graph so it regenerates automatically. Alternatively, you can rerun the template manually in standalone mode.

*Timestamp:* March 22, 2024

### Can a graph be directly copied as-is to a subgraph in Vertex?

No, this is not currently supported.

*Timestamp:* April 16, 2024

### Is it intended that an action triggered on Vertex save in Workshop does not display a dialog box for additional parameter input?

Yes, it is intended that no action form will be shown to the user if all required parameters are configured with a defined default value.

*Timestamp:* March 22, 2024

### What should a function return in Vertex to apply color to a node in Vertex?

You can choose the return type of your function, and then in the **Layers** panel you would define a mapping between the returned value and a color.

*Timestamp:* April 19, 2024

### How can I embed a Vertex graph in a Workshop application that takes a single object as an input and expands to all of its linked objects of a specific type, reflecting a parent-child relationship?

You can write a function to do a breadth-first search recursively, and then use that function in the [Configure Search Arounds](/docs/foundry/vertex/generate-graph-functions/) step of the template.

*Timestamp:* July 31, 2024
