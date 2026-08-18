<!-- source: https://palantir.com/docs/foundry/data-connection/source-exploration/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Source exploration

When setting up syncs from a source, you may want to explore the source and the data it contains to preview syncs before they bring data into Foundry. Depending on the source type, Data Connection allows you to preview data from a sync via the **Explore** page.

To access the **Explore** page, follow the steps below:

1. Navigate to the **Sources** page and click on the name of the source you want to configure.
2. Select the **Explore** link from the **Explore and Create Syncs** component of the Sync page.

![Database Explorer](./images/db-explorer.png)

## Table-based data

1. **Left panel:** Find and add tables and views from the source system to the graph. Use the free text search helper to find specific tables, or browse the tree to find resources.

2. **Graph:** Explore tables and views and the relationships between them. You can also create a sync from the graph by right-clicking on the table. When selecting a table with a relation, the foreign key will be highlighted within the expandable column list and above the link.
   * Note that the graph is not always available for table-based data exploration. For example, a graph would not appear for exploration of a table-based REST API model as there are no clear relations between objects.

3. **Table details:** Preview a sample of the selected table.

4. **Right panel:** Review chosen tables, and create syncs for the tables.

## File-based data

1. **Left panel:** Explore and select the directory containing contents to sync into Foundry.

2. **Preview:** See a preview of the files that will be synced. A filter can be added to control which files get imported into Foundry.

3. **Right panel:** Review chosen tables, and create syncs for the tables.
