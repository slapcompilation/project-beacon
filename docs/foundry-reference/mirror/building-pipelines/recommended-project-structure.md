<!-- source: https://palantir.com/docs/foundry/building-pipelines/recommended-project-structure/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Recommended project and team structure

This page outlines the recommended ways to structure a [data pipeline](/docs/foundry/data-integration/data-pipeline/) in Foundry using [projects](/docs/foundry/getting-started/projects-and-resources/) to enable:

* Well-structured permissions across the pipeline
* Effective collaboration across roles
* A legible and maintainable pipeline structure

Additionally, we cover the range of [roles and responsibilities](#pipeline-management-roles) that need to be fulfilled for successful pipeline management in production environments.

This provides a conceptual overview of the various pipeline stages and what each is for. For a step-by-step guide for how to set up this structure in Foundry, refer to [Securing a data foundation](/docs/foundry/security/securing-a-data-foundation/) in the Platform Security documentation.

## Pipeline stages

These stages define the logical separation of projects that compose a well-ordered pipeline. We'll go into each in more detail below.

1. [Data Connection](#1-data-connection): Syncs land raw data from source systems into a `Datasource project`.
2. [Datasource project](#2-datasource-project): One `Datasource project` per logical datasource defines the basic cleanup steps for each raw dataset and applies a consistent schema.
3. [Transform project](#3-transform-project): Datasets are imported from one or more `Datasource projects` and transformed to produce canonical, re-usable datasets.
4. [Ontology project](#4-ontology-project): Datasets are imported from one or more `Transform projects` and transformed to produce the canonical tables representing discrete operational objects. A single Ontology project often groups related sets of objects for a given operational domain for ease of management.
5. [Workflow project](#5-workflow-project): Workflow projects import data from Ontology projects to pursue a specific outcome. Frequently this is an operational workflow, data science investigation, business intelligence analysis and report, or application development project.

![pipeline-overview](/docs/resources/foundry/building-pipelines/pipeline_overview.png)

Each pipeline stage is a discrete unit, and the outputs are the datasets made available for downstream projects to import and use for other use cases, pipeline development, analysis, and so on. Within each project, the responsible team should, in addition to the implementation of the transformation steps, also [manage the stability and integrity](/docs/foundry/maintaining-pipelines/overview/) of their outputs. This involves managing the build schedules, configuring and monitoring data health checks, and, where relevant [writing unit tests](/docs/foundry/code-repositories/unit-tests/) or additional data integrity tests.

The sections below will walk through each downstream project type in more detail to follow the flow of data through the pipeline. In the process of designing a pipeline, instead work backwards from the Ontology layer to determine the necessary source systems to connect and pipeline transformations to implement.

:::callout{theme="neutral"}
**Projects** provide a way of organizing data and code within Foundry. They are the primary unit to manage access and permissions for individuals and teams collaborating around a specific scope of work. In addition, projects expose functionality for capturing and sharing metadata such as an event log of project activity, a space for project documentation, and project resource consumption and computation metrics.

When thinking about what makes a good project, consider as an analogy what makes a good microservice: well defined purpose, clear output datasets/API used by downstream dependencies, ownership by a set of people small enough that they can effectively coordinate with each other and set their own standards for project management.

When deciding whether to create a new project or build in an existing one, consider:

* Projects should be 1:1 with Code Repositories. Larger scope enables deeper collaboration, but introduces more challenging operational requirements to ensure frictionless version control.
* Projects are the level at which you want to impose a file structure and permissions for all the related resources. If a single conceptual "project" has sub-components that will require individual permissions, consider creating multiple projects in Foundry.
:::

### 1. Data Connection

The data flowing through a pipeline in Foundry normally originates from an external source system. The [Data Connection](/docs/foundry/data-connection/overview/) service provides a management interface where source systems are registered. For each source system, one or more individual syncs are configured land data into `raw` datasets in a **Datasource project**.

In order to configure a source system or sync in the first place, an **Agent Administrator** typically needs to configure a Data Connection [agent](/docs/foundry/data-connection/core-concepts/#agents). Each agent should be stored in a dedicated project only accessible to **Agent Administrators**.

Managing the new connection of a new datasource is a multi-disciplinary effort requiring the collaboration of the **Datasource Owner**, the **Agent Administrator**, and the **Datasource Developer**, though it is often necessary for a **Compliance/Legal Officer** to sign off on the movement of data out of the source system into the new environment.

Once a source system is configured, however, the Datasource Developer is able to work independently to configure individual syncs. This greatly reduces the back-and-forth between teams and ensures connecting a new system is a low, one-off effort.

A critical consideration for each connection is choosing between a [`SNAPSHOT`](/docs/foundry/data-integration/datasets/#snapshot), which replaces the current data with each sync, and an [`APPEND`](/docs/foundry/data-integration/datasets/#append), which adds cumulatively to the existing data with each sync. To understand these concepts more fully and the implications for creating efficient, performant pipelines in the [Incremental pipelines](/docs/foundry/building-pipelines/incremental-overview/) section.

#### Further reading

For more on principles, architecture, and configuration of datasources and syncs, visit the [Data Connection documentation](/docs/foundry/data-connection/overview/).

For more thoughts on monitoring your connections and ensuring the data flowing into your pipelines is accurate and within expectations, review the [Maintaining pipelines](/docs/foundry/maintaining-pipelines/overview/) section.

### 2. Datasource project

Each source system should land data into a matching project inside the platform. The normal pattern involves landing data from each sync in as 'raw' a format as possible. The transformation step to a “clean” dataset is defined in the project *Code Repository*.

![pipeline\_datasource](/docs/resources/foundry/building-pipelines/pipeline_datasource.png)

Establishing this project-per-datasource model has a number of convenient benefits:

* Encourages exploration of new data sources in a consistent location.
* Provides a single location to specify Access Controls to a data source.
* Minimizes the chance of duplicated effort syncing the same data by different teams.
* Code Repositories are small and purpose-built to handle the type and format of source system data.
* Allows anonymization, clean up, and standardization of data before it is accessed by the pipeline layer.

#### Datasource project goals

Inside each datasource project, the goal is to prepare the synced data for consumption by a wide variety of users, use cases, and pipelines across the organization.

The output datasets, and their schema, should be thought of as an API - that is , the goal will be for them to be logically organized and stable over time, as the output datasets from a data source project are the backbone of all downstream work. The outputs should map 1:1 with the source tables or files; each row in the dataset should have a direct matching row in the source system.

To this end, some typical objectives of the raw → clean transformation include:

* Imposing a consistent column naming scheme.
* Ensuring appropriate types are applied to columns.
* Handling missing, malformed, or mis-typed values.
* Establishing primary [Health checks](/docs/foundry/health-checks/overview/).
* Removing [PII (Personally Identifiable Information) or other sensitive data](/docs/foundry/security/data-protection-and-governance/#sensitive-data-classification) unsuitable for general consumption.

Even where the source system provide column data type information, it is sometimes necessary to bring in values as a `STRING` type. Pay special attention to `DATE`, `DATETIME`, and `TIMESTAMP` types, which are often represented in source systems in non-standard formats and numeric types, which are occasionally troublesome. If these types do prove to be unreliable in format from the source system, importing as a `STRING` type provides the option to implement more robust parsing and define logic for handling malformed values or dropping unusable or duplicated rows.

In addition to these programmatic steps, clean datasets should be rigorously documented. A qualitative description of the dataset, the source system provenance, the appropriate contacts and management protocol and, where relevant, per-column metadata describing features of the data will all ensure future developers use the data appropriately.

#### Implementing a Datasource project

1. A system administrator creates a new project for the target datasource and adds the appropriate **Datasource Developers** to a new [user group](/docs/foundry/security/users-and-groups/#groups) to manage the project.
   * Only members of the datasource developers group for the specific datasource should have permissions to build datasets within the project.
2. The **Datasource Owner** and **Agent Administrator** collaborate to [deploy a Data Connection agent](/docs/foundry/data-connection/set-up-agent/) on the source system and configure the datasource connection in the UI.
   * Ensure appropriate permissions are configured so that tables and files in the source system are able to be previewed by the datasource developers.
3. The **Datasource Developers** [configure the syncs](/docs/foundry/data-connection/set-up-sync/) for one or more raw datasets in the project, considering the correct sync cadence and sync type, as well as adding appropriate Data Health checks for each raw dataset.
4. The **Datasource Developers** implement the cleanup transformations to produce “clean” datasets ready for use in other projects.
5. Downstream developers request new datasets from the source system, enhancements to the clean datasets, or data quality issues by filing an **Issue** with the project or a specific clean dataset.

While every datasource will be somewhat unique, the steps of cleaning and preparing a source system often have shared steps, such as parsing raw string values to a given type and handling errors. When datasources have a number of similar cleanup transforms, it's best practice to define a library in [Python](/docs/foundry/transforms-python/share-python-libraries/) to provide a set of consistent tooling and reduce duplicated code.

#### Recommended folder structure

* `/raw`: For datasets from a data connection sync.
* `/processed` (optional): File-level transformations to create tabular data from non-tabular files.
* `/clean`: For datasets that are 1:1 with datasets in `/raw` but with cleaning steps applied.
* `/analysis`: For Resources created to test or document the cleanup transforms and show the shape of the data.
* `/scratchpad`: Any temporary resources created in the process of building or testing the cleanup transforms.
* `/documentation`: The [Data Lineage](/docs/foundry/data-lineage/overview/) graphs that show the pipeline steps for cleanup as well as additional documentation (beyond the top-level project README) written in [Foundry Notepad](/docs/foundry/notepad/overview/).

### 3. Transform project

The goal of Transform projects is to encapsulate a shared, semantically meaningful grouping of data and produce canonical views to feed into the Ontology layer.

These projects import the cleaned datasets from one or more Datasource projects, join them with lookup datasets to expand values, normalize or de-normalize relationships to create object-centric or time-centric datasets, or aggregate data to create standard, shared metrics.

#### Recommended folder structure

* `/data`
  * `/transformed`(optional): These datasets are output from intermediate steps in the transform project.
  * `/output`: These datasets are the "output" of the transform project and are the only datasets that should be relied on in downstream Ontology projects.
* `/analysis`: Resources created to test or document the cleanup transforms and show the shape of the data.
* `/scratchpad`: Any temporary resources created in the process of building or testing the cleanup transforms.
* `/documentation`: The [Data Lineage](/docs/foundry/data-lineage/overview/) graphs that show the pipeline steps for cleanup as well as additional documentation (beyond the top-level project README) written in Notepad.

### 4. Ontology project

The Ontology enforces a shared communication layer across Foundry, and the curation of a clean, organized, and stable Ontology is the highest order objective to ensure a wide-range of valuable projects can move forward simultaneously while enriching the common operating picture. For more on the concepts and practicalities of designing and managing your Ontology, reference the [Ontology concepts documentation](/docs/foundry/ontology/core-concepts/).

An Ontology project is the center-point of any pipeline and represents the final transformation necessary to produce datasets that conform to the definition of a single or related-group of objects defined in the Ontology. These projects also (and separately) produce datasets that are synced to back the Object Explorer views.

Since the Ontology datasets represent the canonical truth about the operational object they represent, they form the starting point for all “consuming” projects. While the provenance and transformation logic of upstream cleaning and pipeline steps are visible, conceptually these steps and intermediate datasets could be a black box for the project developers, analysts, data scientists, and operational users who consume data only from the Ontology projects. In this sense, the Ontology layer serves as an API for operational objects.

#### Implementing an Ontology project

Similar to Datasource projects, essential factors in maintaining an Ontology project are:

* Robust documentation
* Meaningful health checks
* Regular schedules
* Curation in the [Data Catalog](/docs/foundry/compass/data-catalog/) and appropriate tags

These are discussed in more detail in the [Maintaining pipelines](/docs/foundry/maintaining-pipelines/overview/) and in the callout on documenting projects below.

In addition, as your Ontology grows more robust and more teams contribute to the Ontology layer, maintaining the integrity of the dataset "APIs" becomes more critical. To this end, consider implementing additional checks to ensure that proposed changes preserve the integrity of the output dataset schema. This will be discussed in more depth in additional documentation available soon.

#### Recommended folder structure

* `/data`
  * `/transformed`(optional): These datasets are output from intermediate steps in the Ontology project.
  * `/ontology`: These datasets are the "output" of the Ontology project and are the only datasets that should be relied on in downstream use case or workflow projects.
* `/analysis`: Resources created to test or document the cleanup transforms and show the shape of the data.
* `/scratchpad`: Any temporary resources created in the process of building or testing the cleanup transforms.
* `/documentation`: The Data Lineage graphs that show the pipeline steps for cleanup as well as additional documentation (beyond the top-level project README) written in reports.

### 5. Workflow project

Workflow projects, also known as **use case projects**, should be flexibly designed for the context at hand, but usually are built around a single project or a team to an effective unit of collaboration and delineate the boundaries of responsibility and access.

In general, workflow projects should reference data from the Ontology projects, to ensure that operational workflows, business intelligence analysis, and application projects all share a common view of the world. If, in the course of developing a workflow project, the datasources available in the Ontology layer aren't sufficient as sources, it's an indication that the Ontology should be enriched and expanded. Avoid referencing data from earlier (or later) in the pipeline as this can fragment the source of truth for a particular type of data.

:::callout{title="Document projects"}
Each project should be documented thoroughly throughout the development process. Here are a few common patterns and best practices:

* Save one or more Data Lineage graph resources at the root of each project to capture the most important datasets and pipeline relationships. Different graphs can use different color schemes to highlight relevant features, such as the regularity of data refresh, the grouping of related datasets, or the dataset characteristics, such as size.
* Add a short description to the project - available directly below the project title. This will be used in the list view of all projects. Focus on putting the project into context for users who may be unfamiliar with it.
* Use the **Add Documentation** button in the right sidebar of the top-level project folder to write [Markdown ↗](https://www.markdownguide.org/basic-syntax/) syntax. This is the best place to explain the purpose of the project, the primary outputs, and any other relevant information for project consumers.
* Place further global project documentation in Markdown (.md) files created locally and uploaded to a **Documentation** folder or in [Notepad](/docs/foundry/notepad/overview/) and link to these from the top level documentation.
* Add a README.md file to the Code Repository for your project and ensure that each transform file has a description and additional inline code comments.
:::

#### Recommended folder structure

The structure of Workflow projects will be more varied than other project types and should focus on making the primary resource(s) immediately accessible and well-documented.

* `/data`
  * `/transformed`(optional): These datasets are output from intermediate steps in the workflow project.
  * `/analysis`(optional): These datasets are output from analysis workflows.
  * `/model_output`(optional): These datasets are outputs from model workflows and can then be analyzed to determine model fit.
  * `/user_data`(optional): If your workflow enables users to create their own "slice" of data, store them here in user-specific folders.
* `/analysis`: Resources and reports created to drive decisions and feedback loops.
* `/models`: Any models created should be stored here.
  * `/templates`: Any [Code Workbook templates](/docs/foundry/code-workbook/templates-overview/) shared for project-specific usage should be stored.
* `/applications`: Additional workflow applications or sub-applications are stored here. A primary application should be stored at the project root for prominent access.
  * `/develop`: Applications in development, new features, and templates are stored here.
* `/scratchpad`: Any temporary resources created in the process of building or testing the cleanup transforms.
* `/documentation`: The Data Lineage graphs that show the pipeline steps for cleanup as well as additional documentation (beyond the top-level project README) written in reports.

## Pipeline management roles

The roles below are examples of the profiles commonly involved in the scoping, design, implementation, and management of pipelines in Foundry. Not all roles may be necessary in all circumstances, especially in the early stages of Platform development, and individuals might fill more than one role at a time. However, generally considering these role descriptions and how they interact will help create well ordered, effective teams.

The diagram below relates the primary roles to the segments of the pipeline where they're most commonly active.

![pipeline\_roles](/docs/resources/foundry/building-pipelines/pipeline_roles.png)

### Primary roles

* **Agent Administrator:** The Agent Administrator is responsible for creation and configuration of a Data Connection *agent* and sharing it with the relevant **datasource owner**. This centralizes control of agent installation and configuration for better security and control.
* **Datasource Developer:** Data source developers are engineers who own the sourcing process for each of the data sources relevant to the data lake. This can be done as a single team or broken out by source systems.
  * Each datasource developer owns (1) a Data Connection data source with the technical connection to the data source and (2) a Foundry project to which the synced data is sourced.
  * The output of the datasource project is a cleaned and prepared dataset, ready for consumption by one or more downstream use case projects. Datasource developers also define the refresh frequency of each data source they own and work with the **Release Manager** or **Operation Manager** to schedule a *pipeline build policy*.
* **Data Pipeline Developer:** Data pipeline developers are data engineers responsible for building a common Ontology layer, which provide data assets for use by all use cases. The data pipeline developers are responsible for defining this Ontology layer and building the transformations needed from the source structure to the Ontology structure.
* **Release Manager:** Release managers own the production pipeline and manage the release process to ensure the production pipeline adheres to the organization's standards and executes reliably.
  * For code changes to the pipeline, this is usually done through the approval process of pull-requests into master and approval to run the pipeline build on master. For ongoing reliability, the Release Manager monitors the *Health Checks* defined in conjunction with the pipeline and datasource developers for key datasets.
* **Compliance Officer / Legal Officer:** A compliance officer is responsible for approving use cases before they are developed. Such approval should take into account: (1) the data that needs to be used, (2) the purpose of the project, and (3) the users who will have access to the data in light of the data protection regime for their jurisdictions and the organization's own policies.
* **Use-Case Developer:** Use-case developers are the engineers - software developers and/or data scientists - who own the development of the use case. They use data which is sourced from the Ontology layer and approved to them by the compliance officer.

### Other roles

* **Operations Manager:** This role owns the monitoring of the healthy execution of the production pipeline. They monitor data refresh of the different sources, execution of the build of different pipeline and help triage support requests. This role supports the **Release Manager**.
* **Permissions Owner / Identity Manager:** In most cases the assignment of users into groups is managed in the customers identity management system and the information is passed into Foundry through SAML integration. In such cases the permission manager owns that process.
* **Data Officer:** Responsible for modeling the Ontology layer into a user-centric view of the world, owning data quality, and hunting for new data sources which should be integrated to expand the Ontology layer. The data officer is also responsible for monitoring enrichments done in the use cases and generalizing them into the Ontology layer for better reusability.
* **Project Manager:** A project manager works with the engineers contributing to a project to ensure the alignment of technical and business goals, the adherence to best practice standards for development on the platform, and coordination between other project teams. The project manager is also responsible for documenting the project.
* **Datasource Owner:** This is the primary point of contact for the particular source system. They will need to work closely with the **Agent Administrator** during the configuration of a new data connection, and afterwards assume some level of responsibility for “upstream” issues - either with the agent service running on their server or file system or with the integrity of the data itself.
