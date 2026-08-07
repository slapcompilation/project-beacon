<!-- source: https://palantir.com/docs/foundry/data-lineage/node-coloring/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Node coloring

There are several built-in options for coloring graph nodes to give you more information about your pipeline:

|Coloring option	|Description	|
|---	|---	|
|**No color**	|Would remove coloring altogether	|
|**Custom color**	|Allows you to select nodes and assign them a color by clicking on the **Color** button	|
|**Data Catalog**	|Nodes would be colored based on the Data Catalog collection they are in. If the node belongs to more than one collection it would be colored as “In multiple collections“	|
|**Folder**	|Colors the nodes by name of the folder the resource is located in	|
|**Issues**	|Colors the nodes by the number of Foundry issues assigned to them. This option would also allow you to filter by issues labels. 	|
|**Permissions**	|Colors the nodes by the level of access the user has to the data or the resource. If you have access to the resources on the graph, this view also allows you to choose any Foundry user and view their permissions.	|
|**Project**	|Colors the nodes based on the Foundry Project they are in.	|
|**Repository**	|Colors the nodes based on the code repository used to create them. You can either color the nodes by the name of the repository, or by its type (e.g. Code Repository, Code Workbook). 	|
|**Resource overview**	|This view colors the node by details of the resource. The details of the resource generally refer to the way the resource was created (such as in Contour, Code Workbook, Fusion spreadsheet sync, by Upload, etc.).	|
|**Resource type**	|Colors the nodes by Foundry resource types.	|
|**Build status**	|Indicates the current build status of each dataset on the graph. If the nodes are grouped the more severe status would be presented.	|
|**Data Heath**	|Indicates the status of resources health checks with the ability to filter to only watched health checks. If the nodes are grouped, the color of the group would indicate the most severe health check status of the group. 	|
|**Out-of-date**	|This option would indicate if the data or logic is out of date relative to the dataset ancestors. <br> **Out-of-date with parent** means a direct parent of the resource had been updated and the resource itself hasn't yet updated accordingly. <br>**Out-of-date with ancestor** means the resource is up-to-date with its direct parents, but there is a resource upstream that is more updated. This options allows you to filter for two types of updates: Data and Logic. <br>**Data out-of-date** means the data was updated in an ancestor and the resource hasn't yet picked up the update in a build. <br> **Logic out-of-date** means job-specs has changed.	|
|**Schedule count**	|Indicates the amount of build schedules set on a dataset with the option to filter out paused schedules. 	|
|**Sync status**	|If there are syncs set on the dataset, this option would indicate the status of the sync	|
|**Time last built**	|Indicates the time since the last time the dataset was successfully built. 	|
|**Build duration**	|According to the most recent successful build of each resource, this option would indicate the approximate build duration	|
|**Files**	|Colors the nodes on the graph by files-related metrics: Average file size, count of files and dataset size	|
|**Row count**	|Colors nodes by the number of rows in each dataset. If row count does not exist, it could be calculated in the dataset details helper or in the dataset view in Foundry (dataset app).	|
|**Spark usage**	|Colors each node by Executor run/CPU time in a given period 	|
|**User views**	|Colors nodes by the number of user views	|
|**Branch**	|Indicates the currently viewed branch of each node on the graph. 	|
|**Code Status** |Indicates the code status for this node/dataset. <br> **CI running** means CI checks are currently running for this node. <br> **CI Failed** means that CI checks failed on this node. <br> **Out of date** means that the code is out of date for this node. <br> **Unavailable** means that the node/dataset is not a stemma backend or that the user is lacking permissions.	|
|**Storage**	|Indicates where data is stored. Will be **Foundry** unless you are using [Virtual Tables](/docs/foundry/data-integration/virtual-tables/).	|
|**Compute**	|Indicates the compute engine used by each node on the graph. For transforms run in Foundry, this will show the type of compute used (Spark or Flink, for example). For transforms that use compute pushdown, this will indicate the external compute engine used (BigQuery, Databricks or Snowflake, for example).     |
|**Transaction type**	|Indicates each nodes transaction type: Append or Snapshot  |
