<!-- source: https://palantir.com/docs/foundry/foundry-devops/create-products/ · mirrored 2026-09-06 from Palantir Foundry docs -->

# Create a product

This page contains instructions for creating a new [product](/docs/foundry/devops/core-concepts/#product) in Foundry DevOps. Users can [browse](/docs/foundry/marketplace/browse-products/) and [install available products](/docs/foundry/marketplace/install-product/) via the Marketplace storefront. Read more about [use cases for which you may want to create a product](/docs/foundry/foundry-devops/overview/).

For instructions on packaging multiple products simultaneously, refer to [Package multiple products](/docs/foundry/foundry-devops/package-multiple-products/).

## Choose a store

To create a new product, select a [store](/docs/foundry/devops/core-concepts/#store) in which to publish your product. To select an existing store or create a new one, select the **Change Store** option in the top-right.

![Store selection view.](./images/select-store.png)

New stores are saved to a project and inherit the permissions of that project. Specifically, anyone with edit access to a store's project can create new products and edit existing products in that store, and anyone with view or edit access to the store's project can install products from that store.

After choosing a store, select **New product** or **Create new group** to begin creating your product.

![The store overview page displays draft groups and a list of published products.](./images/store-overview.png)

## Configure a new product draft

Provide a name for your draft product in the **Set product title...** input box in the top-left.

When starting a product draft, you can either:

* **Add resources:** Manually choose resources from projects, folders, or the ontology, to package them as outputs.
* **Track a folder:** The product will [track a source folder](/docs/foundry/foundry-devops/folder-tracking/). New versions of the product will automatically bring in new outputs from the folder.

In the example below, we choose to manually add resources. At any point, the draft can be [migrated to folder tracking](/docs/foundry/foundry-devops/folder-tracking/#migrating-to-track-a-source-folder).

![The Get started page displays options for product title, installation mode, and resource selection.](./images/creation-landing-page.png)

### Add outputs

Choose **Add output** to select the outputs to include in your draft product; these outputs are the resources that Marketplace recreates when users install your product. You can choose **Add files** to select most resource types within the [Compass](/docs/foundry/compass/overview/) filesystem. If a resource is not available to select through Compass, then DevOps provides its own selection option, such as **Add ontology resources**.

<img alt="The Add outputs menu is displayed." src="./images/add-outputs-selector.png" width=500>

DevOps automatically identifies resource dependencies, so you should add the furthest downstream resources first. For example, if you want to package a [Workshop application](/docs/foundry/workshop/overview/) and four [object types](/docs/foundry/object-link-types/object-types-overview/), you should only add the Workshop application.

DevOps also enables you to add outputs in bulk. For one-time bulk addition of outputs, select **Add all files from folder**. You can also use **Add from Data Lineage** and **Add from Workflow Lineage** to add resources from a graphical dependency view. For a more automated way of tracking outputs that syncs changes with the source folder as the product evolves, consider [tracking a source folder](/docs/foundry/foundry-devops/folder-tracking/).

After you add outputs to your draft product, select a resource to launch its **Details** panel on the right side of your screen.

:::callout{theme="note"}
Packaging a [dataset](/docs/foundry/data-integration/datasets/) as an output using the **Include with static data** option reads its underlying files, which requires the `foundry-data-proxy:get-files` (**Download**) operation on the dataset. On enrollments that [restrict downloads](/docs/foundry/security/download-controls/), this operation may be granted through a role other than `Owner`, so you might need an additional role — such as an `Exporter` role — to package a dataset even if you already own it. For details, see [Package dataset permissions](/docs/foundry/foundry-devops/manage-store-permissions/#dataset-packaging-permissions).
:::

![The Resources page displays inputs and outputs with a Details panel showing resource information.](./images/output-information-panel.png)

Select the **Dependencies** tab to review the output's dependencies, which DevOps also surfaces as [inputs](#add-inputs).

### Add inputs

DevOps automatically surfaces output dependencies as **Inputs** as you add outputs to your draft product. Users who install your finished product must provide resources to satisfy each input.

When designing your product, you can promote inputs for inclusion as outputs. Select the ellipsis icon before choosing **Move to output** on the input row to promote it to an output.

![The ellipsis menu on an input displays options including Move to output and Add to other draft.](./images/move-to-output.png)

You can also move inputs to outputs in bulk by selecting multiple inputs and choosing **Move {N} to outputs** from the popup at the bottom of your screen.

![A bottom toolbar displays bulk actions including Move to outputs and Add to other draft for selected inputs.](./images/bulk-move-to-output.png)

As a general rule, if you want installers to provide their own version of a resource, such as their own [dataset](/docs/foundry/data-integration/datasets/) or object type, then you should list that requirement as an input. If you want your product to instead provide a resource for your installers, then you should promote the input to be an output.

If you iteratively promote all inputs to outputs, then users who install your product will not need to map anything during installation.

![A diagram of inputs and outputs is displayed.](./images/inputs-and-outputs.png)

You cannot move certain input types, such as [parameters](/docs/foundry/quiver/cards-parameters/) or [groups](/docs/foundry/platform-security-management/manage-groups/), to outputs since DevOps requires their configuration for installation.

![A tooltip indicates that inputs not associated with a RID cannot be moved to an output.](./images/move-to-output-not-supported.png)

To view more information about a specific input, select the input to launch the **Details** panel. The **Dependents** tab includes information on which content resources require this input. From here, you can also configure [presets](/docs/foundry/foundry-devops/input-presets/) for an input, which allow you to restrict the options of an input and provide a default to installers.

![The Details panel displays input information including description, presets, and properties.](./images/input-information-panel.png)

### Manage inputs and outputs

DevOps provides multiple options to help you manage products with a large number of outputs. Use the **Group by Folder** option in the **Outputs** panel to preview outputs in their destination folders if you enable [folder structure](#folder-structure) to replicate the organization of packaged resources during installation.

![The Outputs panel displays a dropdown with Group by type and Group by folder options.](./images/group-by-folder.png)

You can also select the filter icon in the ribbon of both the **Inputs** and **Outputs** panels to filter the resources they display. For example, this enables you to display only those resources that have an error message or are of a specific type.

### Product scale limits

A product can contain a combined total of 15,000 inputs and outputs, including nested resources such as dataset columns and object type properties. Most products are below this limit. If you are approaching it, the relevant number is not the count of resources you added, but the count of inputs and outputs those resources expand into.

DevOps validates product size as you build your product. At 75% of the limit or above, a **Product limits** counter appears in the bottom left and a warning appears in the **Draft status** panel. At 100% of the limit, the warning becomes a blocking error, and you must remove outputs or refactor your product before you can continue.

![The Draft status panel displays an error stating that the product exceeds the size limit, alongside a Product limits counter in the bottom left.](./images/product-limits-error.png)

Select **View details** on the **Product limits** counter to open the **Product packaging limits** dialog, which reports your combined input and output count against the limit and breaks that count down by resource type.

![The Product packaging limits dialog displays the combined input and output count against the limit, with inputs and outputs itemized by resource type.](./images/product-packaging-limits.png)

Treat the warning as the point to act, since an ordinary change such as adding columns to a packaged dataset can push a later version over the limit. If a product is too large, consider splitting it into several smaller products and [packaging them together](/docs/foundry/foundry-devops/package-multiple-products/) so that DevOps resolves the dependencies between them.

### Preview linked products

Select the **Linked products** tab from the left panel of your product to preview all available [linked products](/docs/foundry/marketplace/linked-products/), which can provide inputs for your products.

![The Linked Products page displays available linked products and the inputs they fulfill.](./images/linked-products-main-packaging.png)

You can also use the **Group by linked products** option in the **Inputs** table to preview the inputs provided by each of the upstream linked products.

![The Inputs panel displays a dropdown with Group by type and Group by linked products options.](./images/group-by-linked-products.png)

### Add product documentation

Select the **Documentation** tab from the left panel of your product to add information visible to users who are [browsing products in the storefront](/docs/foundry/marketplace/browse-products/). Use the **Description** section to write a short description of your product before adding an image to serve as its **Thumbnail**.

You can add additional **Images** as a preview of your product's content. Optionally, enter a longer **Product description** using [Markdown ↗](https://www.markdownguide.org/basic-syntax/) syntax that contains detailed product use instructions.

![The Documentation page displays options for submitting documentation information about a product.](./images/documentation.png)

### Configure product settings

Select the **Settings** tab to configure additional product settings.

![The Settings page is displayed.](./images/settings.png)

#### Folder structure

Enable folder structure by toggling on **Folder structure** to have DevOps create folders during installation that match the original organization.

DevOps packages folders up until the lowest common ancestor, which on installation will be replaced by the installation project.

:::callout{theme="note"}
If your product's resources are organized within a dedicated folder or project, consider [tracking a source folder](/docs/foundry/foundry-devops/folder-tracking/) for automated output management as your product evolves.
:::

![A folder structure diagram is displayed.](./images/folder-structure.png)

#### Installation mode

Use **Installation mode** to set the default settings for any installations of your product. These settings can be changed per installation.

* **Production:** Recommended when you want to manage all installations centrally and use features such as automatic upgrades. By default, installations have automatic upgrades disabled. Installers will be given the option to lock down their project to ensure safe upgrades.
* **Singleton:** The same settings as Production mode, with the restriction that there can only be one installation of the product per space and ontology.
* **Bootstrap:** Recommended when you expect that installers will use your product as a starting point for their own custom work. By default, installations have automatic upgrades disabled and installers can install into any location where they have edit access.

#### Build settings

Use **Build settings** to determine whether or not DevOps builds datasets and models automatically during the Marketplace installation job. This ensures that DevOps hydrates all datasets across the newly deployed resources upon job completion.

### Review and publish

Once you are satisfied with your product, select **Publish** to make the product available in the storefront. This launches the **Review Changes and Publish** popup, where you can review changes in your product and add a **Changelog description**. Publishing may take up to a few minutes depending on your product's size.

![The Review and publish draft group dialog displays version increments, changelog descriptions, and validation status.](./images/review-and-publish.png)
