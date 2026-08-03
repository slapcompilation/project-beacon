<!-- source: https://palantir.com/docs/foundry/workshop/example-applications/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Example applications

## Workshop home page

Create ready-to-use applications using your own data directly from the Workshop home page. Currently, there is support for building an inbox, map, and metrics application.

<img src="./media/splash-page-templates.png" alt="Image showing inbox, map, and metrics templates for Workshop." width="1000">

To begin, choose the template you would like to use. Then, simply select an object type and relevant properties to be used in the template. The images below illustrate this process for the creation of a map application.

<img src="./media/map-template-overview.png" alt="Image showing a preview and description of the map template." width="800">
<img src="./media/map-template-inputs.png" alt="Image showing object type and property inputs for the map template." width="800">

Once you have chosen a save location for the module and selected **Create module**, you will have a ready-to-use template with the data you inputted.

<img src="./media/map-template.png" alt="Image showing the map Workshop application." width="1200">

## Workshop Design Hub

The Workshop Design Hub is a [Marketplace](/docs/foundry/marketplace/overview/) product that is a compilation of example applications and templates designed to assist you in creating superior applications using Foundry Workshop, a low-code application building tool.

The Design Hub consists of six high-quality Workshop application examples for you to use as inspiration for your own workflows.

Design Hub modules are intended as design examples and inspiration rather than ready-made app templates. These example modules come with notional data and provide functional end-to-end apps which can be reverse-engineered and analyzed by app builders. We hope that the concepts and patterns in Design Hub modules can be applied to new apps that you build or existing apps that you manage.

![workshop\_design\_hub\_splash\_page](/docs/resources/foundry/workshop/workshop-design-hub-splash-page.png)

### Supported Workshop applications

The following Workshop applications are available in the Design Hub, with each one's unique features and functionalities listed below:

* **Alert Inbox:** Design an attractive, action-oriented inbox using Workshop. Learn how to create engaging and visually appealing inboxes that are functional and efficient.
* **Guided Creation Form:** Build a seamless creation form to walk your users through a defined workflow. Decrease user error and cognitive load by creating manageable steps and understanding the essentials of a guided form.
* **Metrics Dashboard:** Create dynamic executive overview and drill-down metric dashboards to monitor performance. Discover how to design visually informative dashboards and effectively track important metrics.
* **Common Operating Picture:** Visualize geographical metrics contextualized on a map. Learn how maps can be an effective way to enable filtering and explore the benefits of displaying data geographically.
* **Rental Booking App:** Browse and filter through NYC rental listings to book your next stay. Learn how to create a highly visual exploratory application and enhance user experience with intuitive filtering options.
* **Illustrations App:** A small collection of illustrations in Workshop, showcasing the potential of incorporating visual elements into your app designs.

## Access sample modules

To access a Workshop Design Hub sample module, navigate to the `Workshop Design Hub` project. Then, duplicate the desired Workshop module to a location of your choosing.

To access the Workshop Design Hub from your Foundry enrollment, contact your Palantir representative.

## Usage recommendations

By default, the assets in the Workshop Design Hub (Ontology objects, apps, datasets) are set to read-only and we strongly recommend duplicating any Workshop module to another project before modifying it for a specific use case. In the case where your administrator has configured the assets to be read-write, it is still essential to treat Ontology elements (such as object types or action types) and Workshop applications within the Design Hub as read-only as periodic Design Hub updates overwrite local changes made to these aforementioned elements.

### Inboxes

A common application type built in Workshop is an inbox. Often, the core components of an inbox are:

* A clear set of alerts to review or tasks to complete, and the ability to easily filter and prioritize among them.
* A detailed view of each individual alert or task that allows for in-depth review.
* Configured action types that enable decision-making on each alert or task.

The example below shows an example Workshop inbox displaying information about Flight Alerts that require triage, review, and action. Core widgets used include the Prominent Terms Filter, [Filter List](/docs/foundry/workshop/widgets-filter-list/), [Object Table](/docs/foundry/workshop/widgets-object-table/), and [Button Group](/docs/foundry/workshop/widgets-button-group/). Additionally, [state saving](/docs/foundry/workshop/state-saving/) is enabled to allow users to preserve the inbox settings most relevant to them and also share these saved views with other users.

![example inbox](/docs/resources/foundry/workshop/example-inbox.png)

### Common operating pictures

Senior leaders often need a way to understand how the critical parts of their organization are functioning in real-time. *Common operating pictures* built in Workshop can convey the geospatial context, detailed charts, and top-line metrics necessary to make high-level decisions on the fly.

The example below shows an example Workshop common operating picture overlaying COVID case information atop retail store sales and operations data. The aim is to help a store manager understand store performance and more effectively adjust their plans as local case counts change. Core widgets used include the [Metric Card](/docs/foundry/workshop/widgets-metric-card/), [Map](/docs/foundry/workshop/widgets-map/), [Chart: XY](/docs/foundry/workshop/widgets-chart/), and [Object Table](/docs/foundry/workshop/widgets-object-table/).

![example common operating picture](/docs/resources/foundry/workshop/example-cop.png)
