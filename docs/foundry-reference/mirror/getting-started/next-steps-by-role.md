<!-- source: https://palantir.com/docs/foundry/getting-started/next-steps-by-role/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Next steps by user role

Now that you are oriented in the Palantir platform and understand its core concepts, you can explore the platform capabilities that are most relevant for your role.

The boundaries between roles in the Palantir platform can shift, and some responsibilities and workflows may not align perfectly into a single role. You may end up performing different roles; if your organization is just getting started with Palantir, or if you are working on a small implementation team, you may use many parts of the platform in your day-to-day work.

Alternatively, you can explore the Palantir platform by reviewing the [application reference](/docs/foundry/getting-started/application-reference/), which provides a high-level overview of the major platform applications.

## Standard user roles

With this in mind, the following roles are generally adopted at most organizations using Palantir. Below, we discuss these high-level roles and how each type of user can get started:

* [Data engineer](#data-engineer)
* [Application builder](#application-builder)
* [Analyst](#analyst)
* [Data scientist](#data-scientist)
* [Platform administrator](#platform-administrator)
* [Data governance](#data-governance)

If you would like to get started right away, [jump into the Palantir platform.](#jump-into-the-platform)

## Data engineer

Palantir's data integration layer provides the foundation for all the other work that happens in the platform. By building and maintaining data pipelines, data engineers produce datasets that are high-quality, relevant, and frequently updated to serve the needs of the organization. A wide variety of tools are available to maintain the durability of data pipelines over time, including programmatic health checks and transparency into the underlying computation.

The primary tools used by data engineers include [**Pipeline Builder**](/docs/foundry/pipeline-builder/overview/) and [**Code Repositories**](/docs/foundry/code-repositories/overview/) for authoring data pipelines, and [**Data Lineage**](/docs/foundry/data-lineage/overview/) for visualizing them end-to-end. Data engineers should also understand how to use [recommended health checks](/docs/foundry/maintaining-pipelines/recommended-health-checks/), [monitoring views](/docs/foundry/monitoring-views/overview/), and lineage to operate pipelines after they are deployed. Data engineers will need to be familiar with the concept of data pipelines and develop an understanding of what makes for a high-quality pipeline in the platform.

[Learn more about data pipelines.](/docs/foundry/data-integration/data-pipeline/)

## Application builder

Palantir's Ontology and application building capabilities enable you to create tailored applications for end users. These end users are usually operators in an organization, making decisions that can be informed by data. Beyond just presenting data to users, you can use custom applications to capture information from users in the form of action types configured in the Ontology.

Application builders will need to be familiar with the Palantir [**Ontology**](/docs/foundry/ontology/overview/), which is usually the layer at which application builders collaborate with data engineers to establish a data foundation for workflow development. Builders can create and maintain their organization's Ontology in [**Ontology Manager**](/docs/foundry/ontology-manager/overview/), then use [**Workflow Lineage**](/docs/foundry/workflow-lineage/overview/) to understand how objects, actions, functions, large language models (LLMs), and applications fit together.

To create and deliver applications, builders can use [**Workshop**](/docs/foundry/workshop/overview/) for point-and-click application building on top of the Ontology, extend Workshop with [**custom widgets**](/docs/foundry/custom-widgets/overview/), or use [**Pilot**](/docs/foundry/pilot/overview/) to start from a natural language description. For code-first development, builders can use the [**OSDK**](/docs/foundry/ontology-sdk/overview/) and [**OSDK React applications**](/docs/foundry/ontology-sdk-react-applications/overview/), manage application configuration and SDK generation in [**Developer Console**](/docs/foundry/developer-console/overview/), write [**Functions**](/docs/foundry/functions/overview/) for shared business logic, or build applications in [**Slate**](/docs/foundry/slate/overview/). Builders can also create LLM-backed workflows with [**AIP Logic**](/docs/foundry/logic/overview/) and trigger ontology-driven work with [**Automate**](/docs/foundry/automate/overview/).

[Learn more about application building.](/docs/foundry/app-building/overview/)

## Data scientist

The Palantir platform includes support for analyzing data using code and developing, evaluating, and deploying machine learning models. This functionality builds on top of the rigor of the data integration layer to provide lineage and reproducibility for models in the same way as datasets. The result is an environment where analytics and machine learning can build on high-quality data and shared modeling workflows.

In the Palantir platform, data scientists often use [**Code Workbook**](/docs/foundry/code-workbook/overview/), an application designed to enable code-based analysis and the development of machine learning models. Code Workbook enables you to write code in Python, R, and SQL to access, normalize, and analyze high-quality datasets prepared by data engineers. The resulting analyses and models can then be connected to [model integration](/docs/foundry/model-integration/overview/), shared through [**Model Catalog**](/docs/foundry/model-catalog/overview/), evaluated with [**AIP Evals**](/docs/foundry/aip-evals/overview/), and integrated into the Ontology for use in applications and workflows.

As an alternative, data scientists can work in their preferred third-party IDEs with [**Code Workspaces**](/docs/foundry/code-workspaces/overview/). Code Workspaces containers are integrated with the rest of the Palantir ecosystem to combine JupyterLab® and RStudio® Workbench IDEs with the security, branching, and resource management benefits of the Palantir platform.

Learn more about [model integration](/docs/foundry/model-integration/overview/) and [code-based analysis](/docs/foundry/analytics/types-of-analysis/#code-based-analysis).

## Analyst

As Palantir can be used to build a secure and high-quality data foundation, analysts can find and explore data that is relevant to the questions they need to answer. A rich set of tools is available for analyzing data in a wide variety of formats—tabular, relational, temporal, geospatial, and more. Once your analysis yields insight, you can make it repeatable by creating [dashboards](/docs/foundry/analytics/dashboards/) or present your findings using [reporting](/docs/foundry/analytics/reporting/) tools.

Analysts typically use [**Contour**](/docs/foundry/contour/overview/) to explore datasets in the platform and conduct open-ended analysis at high-scale, and use [**Quiver**](/docs/foundry/quiver/overview/) to analyze data in the Ontology, along with associated time series. Analysts can also use [**AIP Analyst**](/docs/foundry/aip-analyst/overview/) to explore ontology-backed questions with natural language. These applications support moving from ad-hoc analysis into dashboards, reports, or [**Notepad**](/docs/foundry/notepad/overview/) documents that share results with colleagues.

[Learn more about analytics](/docs/foundry/analytics/overview/).

## Platform administrator

Platform administrators can use Palantir's dedicated administrative tooling to configure the platform, manage and understand how it is being used, and ensure that the organization's data is being managed securely.

Platform administrators typically set up [authentication](/docs/foundry/authentication/overview/) to connect to an organization's identity provider, configure [application access](/docs/foundry/administration/configure-application-access/), then set up [**Data Connection**](/docs/foundry/data-connection/overview/) to enable data to flow into the platform. As use of the platform matures, administrators can use [**Resource Management**](/docs/foundry/resource-management/overview/) to manage resource consumption, [**Developer Console**](/docs/foundry/developer-console/overview/) to support custom application development, and [monitoring views](/docs/foundry/monitoring-views/overview/) to help teams observe operational health. Administrators should also understand access considerations for [**Palantir MCP**](/docs/foundry/palantir-mcp/security/) and [**Ontology MCP**](/docs/foundry/ontology-mcp/overview/) when those capabilities are enabled.

[Learn more about platform administration.](/docs/foundry/administration/overview/)

## Data governance

Palantir provides tools for securing data and providing transparency to data governance leads. These tools provide guarantees about how data is protected as it is transformed in the Palantir platform and used for user-facing applications. They also preserve the ability for you to introspect and validate who has access to what information.

Users in data governance roles should learn about the broad set of data security workflows in the platform, ranging from [securing a data foundation](/docs/foundry/security/securing-a-data-foundation/) to [protecting sensitive data](/docs/foundry/security/protecting-sensitive-data/). These capabilities are built on Palantir's data security concepts, namely [**Projects**](/docs/foundry/security/projects-and-roles/) and [**Markings**](/docs/foundry/security/markings/). Governance leads should also understand [object permissioning](/docs/foundry/object-permissioning/ontology-permissions/), [application restrictions](/docs/foundry/developer-console/application-restrictions/), [OSDK permissions](/docs/foundry/developer-console/permissions/), [Ontology MCP restrictions](/docs/foundry/ontology-mcp/overview/), and [Workflow Lineage security visibility](/docs/foundry/workflow-lineage/manage-security/) where those controls are part of their organization's workflows.

[Learn more about data protection and governance.](/docs/foundry/security/data-protection-and-governance/)

## Jump into the platform

Now that you have learned how to navigate through the platform, start building by:

* Learning with the [Training application, a curated set of courses from learn.palantir.com](/docs/foundry/getting-started/training-application/).
* Using [Examples](/docs/foundry/getting-started/start-with-examples/), a comprehensive library designed to facilitate learning and effective platform usage with reference examples, tutorials, and starter kits.
