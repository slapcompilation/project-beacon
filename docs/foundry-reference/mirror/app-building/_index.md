<!-- source: https://palantir.com/docs/foundry/app-building/ · mirrored 2026-08-22 from Palantir Foundry docs -->

![Application building header image.](./images/4-Apps.svg)

# Use case development

The Palantir platform was designed to empower a diverse community of builders with a collection of powerful tools for use case development, including application building tools, workflow building tools, integrated [analytics tools](/docs/foundry/app-building/analytics-operations/), and [developer tools](/docs/foundry/dev-toolchain/overview/). Each of these leverages the power of Foundry’s core security, lineage, data, and compute primitives, allowing teams to focus on delivering operational capability rather than managing infrastructure. Each tool in the Palantir platform is designed to continuously and safely enrich a consistent set of data and logical assets contained within the [Ontology](/docs/foundry/ontology/overview/). This enables knowledge to compound as operational workflows are scaled out across the enterprise.

:::callout{theme="success" title="Palantir Learning portal"}
Understand scoping use cases for Foundry and AIP at [learn.palantir.com ↗](https://learn.palantir.com/scoping-use-cases-for-foundry-aip).
:::

## Application building

The Palantir platform offers several ways to build applications, suited to different needs:

* [Workshop](#workshop) is a no-code, object-oriented builder for operational applications, and is the fastest way to turn objects, links, and actions into an interactive workflow.
* [OSDK React applications](/docs/foundry/ontology-sdk-react-applications/overview/) let you build completely custom user interfaces with React, powered by the [Ontology SDK (OSDK)](#developer-toolchain), when you need an experience beyond what Foundry's built-in tools offer. [Pilot](/docs/foundry/pilot/overview/) provides a streamlined, AI-powered way to build these OSDK applications from a natural-language prompt.
* [Custom widgets](/docs/foundry/custom-widgets/overview/) let technical builders extend Workshop with custom frontend code, adding tailored functionality without building a standalone application from scratch.
* [Slate](#slate) is a low-code, drag-and-drop builder for operational applications, interactive dashboards, and custom landing pages, with optional customization using HTML, CSS, and JavaScript.
* [Code Workspaces applications](#code-workspaces-applications) let you build and publish interactive Streamlit, Dash, and Shiny® applications from third-party IDEs, backed by Foundry data and governance.

### Workshop

**Workshop** is a flexible, object-oriented application building tool. Workshop leverages the semantic primitives (such as objects and links) and the kinetic primitives (such as actions and functions) within the [Ontology](/docs/foundry/ontology/overview/) to enable the rapid delivery of interactive web and mobile applications. The application building experience in Workshop empowers users to create powerful applications out of no-code, low-code, and code-based widgets. No technical expertise is required to start building with widgets and weaving objects, links, and actions together into user-driven workflows that go [far beyond dashboards](/docs/foundry/app-building/operational-apps/) or passive visualizations. Meanwhile, code-based enrichment with [functions](/docs/foundry/functions/overview/) can be seamlessly embedded within Workshop widgets to allow for complex interactions, cascading processes, and complex data capture. When a workflow needs functionality beyond the built-in widgets, you can extend a Workshop application with [custom widgets](#custom-widgets) to add tailored, code-based components without leaving Workshop.

[Learn more about Workshop.](/docs/foundry/workshop/overview/)

### OSDK React applications

**OSDK React applications** let you build completely customizable user interfaces using [React ↗](https://react.dev/), powered by the [Ontology SDK (OSDK)](/docs/foundry/ontology-sdk/overview/) and created through [Developer Console](/docs/foundry/developer-console/overview/). By treating Foundry as your backend, you can combine the React ecosystem with the Ontology's high-scale queries, edits, and granular governance controls to securely deliver bespoke applications. To build an OSDK React application without starting from code, [Pilot](/docs/foundry/pilot/overview/) offers a streamlined, AI-powered experience that generates the Ontology entities, design, and frontend from a natural-language prompt and guides you through deployment.

[Learn more about OSDK React applications.](/docs/foundry/ontology-sdk-react-applications/overview/)

### Custom widgets

**Custom widgets** allow technical builders to securely extend Workshop applications with custom frontend code. Rather than building a standalone application from scratch, you can implement functionality that is not available out of the box, such as bespoke visualizations or discipline-specific views of Ontology objects, and embed them directly within a Workshop module. You can also embed a single, full-page custom widget within Workshop to bring the flexibility of custom code to the Workshop framework.

[Learn more about custom widgets.](/docs/foundry/custom-widgets/overview/)

### Slate

**Slate** provides builders with a flexible set of tools to quickly create operational applications and interactive dashboards. Slate enables application developers to construct dynamic and responsive applications with a drag-and-drop interface, reducing development time and cost. Slate includes capabilities that are seamlessly integrated with the Foundry Ontology, but also enables developers to fully customize applications using HTML, CSS, and JavaScript.

[Learn more about Slate.](/docs/foundry/slate/overview/)

### Code Workspaces applications

**Code Workspaces applications** let you build and publish interactive web applications, using [Streamlit ↗](https://streamlit.io/) or [Dash ↗](https://plotly.com/dash/) for Python and [Shiny® ↗](https://shiny.rstudio.com/) for R, directly from third-party IDEs in [Code Workspaces](/docs/foundry/code-workspaces/overview/). Data scientists and developers can turn analyses into operational applications on Foundry data, hosted in Foundry containers with the platform's version control, branching, and data governance built in.

[Learn more about Code Workspaces.](/docs/foundry/code-workspaces/overview/)

## Workflow building and management

The primary workflow building and management tools in the Palantir platform are [Workflow Lineage](#workflow-lineage), [Automate](#automate), [Solution Designer](#solution-designer), and [Use Cases](#use-cases).

### Workflow Lineage

**Workflow Lineage** provides an interactive workspace for understanding and managing applications and their underlying processes. With Workflow Lineage, you can explore workflows and view details on objects, actions, functions, large language models, and applications. Workflow Lineage is particularly useful for application builders that are creating, debugging or maintaining workflows. The graph of provenance, deeper property and workshop widget/variable provenance, and upgrade tooling are all helpful when making changes to or extending a workflow.

### Automate

**Automate** gives you a single entry point for setting up and executing all business automation in the platform. The Automate application allows users to define conditions and effects; conditions are checked continuously, and effects are executed automatically when the specified conditions were met.

[Learn more about Automate.](/docs/foundry/automate/overview/)

### Carbon

**Carbon** enables the configuration of tailored platform experiences, known as workspaces, for specific user groups. Carbon can provide a focused experience for less technical users that need to carry out critical operational workflows. Each Carbon workspace is a curated collection of applications and resources that can be configured to optimize a given set of operational, end-user workflows. For example, an aircraft parts maintenance workspace might consist of a Workshop application containing a dynamically updated list of parts requiring maintenance, along with Ontology-driven Actions for triaging each part; another application that is used to investigate each part's maintenance issue; and a Quiver analysis showing maintenance trends over time. Carbon allows the rich tapestry of Foundry applications and analytical capabilities to be integrated into focused, operational experiences.

[Learn more about Carbon.](/docs/foundry/carbon/overview/)

### Solution Designer

**Solution Designer** is an interactive tool for creating architectural representations of solutions built using the Palantir platform, including representations for first and third-party integration points, links to platform resources, on-demand access to documentation and best practices, and more.

[Learn more about Solution Designer.](/docs/foundry/solution-designer/overview/)

### Use Cases

The Use Cases application allows builders to organize their work within a single operational interface. By combining the file system view with an ontology management view, developers can access a curated view focused on the work for which they are responsible.

[Learn more about the Use Cases application.](/docs/foundry/use-cases/use-case-overview/)

## Developer toolchain

The Palantir [developer toolchain](/docs/foundry/dev-toolchain/overview/) enables you to build your own applications on top of the Palantir platform using your own tools.

The centerpiece of the Palantir developer toolchain is the [Ontology SDK (OSDK)](/docs/foundry/ontology-sdk/overview/) generated in [Developer Console](/docs/foundry/developer-console/overview/). The Ontology SDK is created either as an npm package for TypeScript or as a pip or Conda package for Python, and it only contains a pre-selected subset of your Ontology. The SDK lets you access object types, apply actions to update data in the Ontology, call functions, and run AIP Logic functions for [AIP-enabled](/docs/foundry/aip/enable-aip-features/) enrollments. The Developer Console also includes Ontology-specific documentation for the entities chosen for your application. Applications use the OAuth flow as a public or confidential client to access the data.

[Learn more about Ontology SDK.](/docs/foundry/ontology-sdk/overview/)

You can also work directly with Foundry's [REST APIs](/docs/foundry/api/general/overview/introduction/) to query objects, apply actions, and call functions against the Ontology from any language or runtime for applications built entirely outside of Foundry.
