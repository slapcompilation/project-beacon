<!-- source: https://palantir.com/docs/foundry/interfaces/create-interface/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Create an interface

Follow the steps below to create a new interface in [Ontology Manager](/docs/foundry/ontology-manager/overview/).

1. First, verify you are working within your ontology of choice by checking the **Ontologies** dropdown menu located at the top of the left side panel.

2. To create a new interface, you can do either of the following:
   * At the top right of the page, select **New > Interface**.
   * From the left panel, select **Interfaces > + New interface** under the **Resources** section. Then, from the **Interfaces** page, select **New interface** from the top right corner of the screen.

3. The first page of the helper provides information about interfaces. Select **Next**. <img src="./media/create-interface-about.png" alt="Interface creation about page." width="800" />

4. Input the display name and API name for your interface. You can also optionally provide a description of the interface and select an appropriate icon.

    <img src="./media/create-interface-metadata.png" alt="Interface metadata creation" width="800" />

5. Add properties to your interface. You can define properties locally on the interface (recommended) or use [shared properties](/docs/foundry/object-link-types/shared-property-overview/). For each property, choose whether it is **required** or **optional**.

    <img src="./media/create-interface-choose-properties.png" alt="Interface property selection" width="800" />

   For **required** properties, any object type that implements the interface must provide a mapping from a local property to the interface property. For **optional** properties, mapping may be skipped during implementation. Optional properties can be useful when building Marketplace packages to iterate on your interface without introducing upgrade blockers that may be difficult to resolve.

6. Select a project to save this interface to, then select **Create**.

    <img src="./media/create-interface-save-location.png" alt="Interface save location." width="800" />

7. Back in Ontology Manager, select **Save** in the upper right corner to [make the change to your ontology](/docs/foundry/ontology-manager/save-changes/).

## Create interface link types (optional)

If you want this interface to link to another interface or object type, you can optionally add any [interface link types](/docs/foundry/interfaces/interface-link-types-overview/) to the interface.

<img src="./media/create-link-type-constraint.png" alt="Add a link type constraint" width="800" />

1. Select **Link type constraints** in the left side panel.
2. Then, select **Create new link type constraint** in the top right corner.

<img src="./media/create-link-type-constraint-modal.png" alt="Create a link type constraint" width="400" />

If an interface link type is required for your modeling use case, any object type that implements the interface must add a new or existing link type that satisfies the interface link type constraints.

## Create interface action type constraints (optional)

If you want an interface to define expected action capabilities across implementing object types, you can optionally add [interface action type constraints](/docs/foundry/interfaces/interface-action-type-constraints/) to the interface.

<img src="./media/iatc-config-page.png" alt="Interface action type constraints tab." width="800" />

1. Select **Action type constraints** in the left side panel.
2. Select **Create new**.
3. Add the constraint metadata, choose whether implementation is required, and configure any parameter constraints.

<img src="./media/iatc-config-dialog-set.png" alt="Action type constraint configuration dialog." width="500" />

If an interface action type constraint is required for your modeling use case, any object type that implements the interface must map the constraint to a concrete action type that satisfies the interface action type constraint.
