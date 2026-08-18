<!-- source: https://palantir.com/docs/foundry/getting-started/application-reference/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Application reference

You can interact with the Palantir platform using **applications** accessible via the [sidebar](/docs/foundry/getting-started/orientation-and-nav/#workspace-navigation-sidebar). This page provides a reference for the range of applications available and describes when you may want to use each one.

## Data connectivity and integration

Data connectivity and integration in the Palantir platform goes beyond traditional ETL/ELT solutions by offering a comprehensive suite of tools designed to enhance data team capabilities and reduce integration costs over time. Foundry serves as a robust data integration backbone for complex environments, providing an extensible framework that connects to various source systems and supports diverse data transfer methods. With integrated data transformation, management, and pipeline capabilities, Foundry ensures secure, scalable, and high-quality data delivery for critical operations.

|Application  |Description  |Use  |
|---  |---  |---  |
|[Data Lineage](/docs/foundry/data-lineage/overview/) |Data Lineage shows a graph of how different resources interacts with and flows through the platform. |Explore the origins or downstream usage of any data or resource in the Palantir platform. |
|[Pipeline Builder](/docs/foundry/pipeline-builder/overview/) | Pipeline Builder creates end-to-end pipelines from data sources to final outputs using LLMs and other built-in data transformations. | Integrate data towards analysis and application building with batch and streaming pipelines. |
|[Code Repositories](/docs/foundry/code-repositories/overview/) \[1] \[2] |Code Repositories is a web-based code authoring environment with support for versioning and collaboration.|Create data pipelines or write Functions in the Ontology. |
|[Dataset Preview](/docs/foundry/dataset-preview/overview/) |Dataset Preview shows the contents and history of a dataset. |Browse a dataset and understand its history and other metadata. |
|[Data Health](/docs/foundry/health-checks/overview/) |Data Health lets you define health checks to ensure datasets are high-quality. |Add or monitor health checks on datasets. |
|[Data Connection](/docs/foundry/data-connection/overview/) |Data Connection allows you to connect to data sources and sync data into the Palantir platform. |Connect to organizational data sources or sync new datasets into the Palantir platform. |
|[HyperAuto (SDDI)](/docs/foundry/hyperauto/overview/) |HyperAuto generates end-to-end data pipelines on top of common ERP systems. |Generate an Ontology from enterprise systems without needing to develop pipelines manually. |
|[Linter](/docs/foundry/linter/overview/) | Linter analyzes the state of your enrollment to identify anti-patterns and offers recommendations for optimizing resources, enhancing cost-efficiency, and improving pipeline stability and resilience. |Identify the highest impact recommendations, which can then be assigned to users for action using guided or automated workflows. Periodically review the expected impact using the impact summary feature.|

\[1] Code Workbook or Code Workspaces may be more suitable for certain data science workflows. [Learn more about the difference between Code Workbook, Code Workspaces, and Code Repositories.](/docs/foundry/code-workbook/code-products-comparison/) <br>
\[2] Pipeline Builder may be a better fit if you are a less-technical user.

## Model connectivity and development

Model connectivity and development involve creating and integrating machine learning models that can be utilized across data pipelines, Ontology, and application layers to support diverse use cases. Models can be developed within the platform using open-source tools or imported from external environments, and once integrated, they benefit from platform features like inference, deployment, governance, and ML Ops. The platform ensures that every step of model development and deployment adheres to stringent standards for lineage, security, versioning, and auditing, enabling robust operationalization and continuous feedback loops for model improvement.

|Application  |Description  |Use  |
|---  |---  |---  |
|[Model Assets](/docs/foundry/integrate-models/integrate-overview/) | Model Assets enable integration of many model types into the Palantir platform. | Train models, and connect to externally hosted models in the Palantir platform. |
|[Modeling Objectives](/docs/foundry/model-integration/objectives/) |A modeling objective allows organizational stakeholders and model developers to collaborate on and deploy machine learning models. |Submit models; discuss modeling objectives, and deploy models into production. |

## Ontology building

Ontology building in the Palantir platform involves creating an operational layer that maps datasets and models to their real-world counterparts, serving as a digital twin of the organization with both semantic and kinetic elements. By defining object types, link types, action types, and functions, the Ontology allows for robust end-user workflows, comprehensive metadata management, and dynamic security and governance. This integration empowers organizations to enhance decision-making at scale through Palantir's analytical and operational tools, enabling efficient data exploration, analysis, and application development.

|Application  |Description  |Use  |
|---  |---  |---  |
|[Ontology Manager](/docs/foundry/ontology-manager/overview/) |Ontology Manager enables you to define your organization's Ontology. | Create new ontology resources such as objects, links or action types. |
|[Object Views](/docs/foundry/object-views/overview/) |Object Views represent the canonical way to display an object type. |Define user interfaces that can be used across use cases. |
|[Object Explorer](/docs/foundry/object-explorer/overview/) |Object Explorer allows you to visualize your Ontology. | Search, explore, and analyze your ontology.|
|[Vertex](/docs/foundry/vertex/overview/) |Vertex enables you to explore object relationships and run simulations. |Create system graphs of related objects and run end-to-end simulations using models. |
|[Machinery](/docs/foundry/machinery/overview/)| Machinery is a framework that enables the understanding and management of processes by identifying unwanted behaviors and facilitating improvements, while leveraging AIP's LLM capabilities to orchestrate multi-step automations in AIP workflows. | Use to optimize processes across various domains, such as procurement, sales, and customer service, by resolving inefficiencies, managing AI-driven workflows, mining event logs, monitoring performance metrics, and enabling real-time human intervention. |
|[Foundry Rules](/docs/foundry/foundry-rules/overview/)  |Foundry Rules enables users to actively manage complex business logic in the platform. |Create and apply rules to datasets, objects, and time series for a variety of use cases. |
|[Map](/docs/foundry/map/overview/) |Map provides powerful geospatial and temporal analysis and visualization capabilities. |Integrate data from across the platform into a cohesive geospatial experience. |
|[Dynamic scheduling](/docs/foundry/dynamic-scheduling/scheduling-overview/)| Dynamic scheduling capabilities allow builders to create tailored scheduling and resource allocation workflows that accommodate the complex needs of their organization by leveraging the Ontology and modeling resource constraints and interdependencies. | Optimize employee schedules, enhance resiliency in transportation and logistics, and improve manufacturing output by providing interactive scheduling tools, real-time resolutions, and machine learning-backed recommendations. |

## Developer toolchain

The Palantir platform's developer toolchain provides a comprehensive set of tools, including Core APIs and SDKs, development environments, and Compute Modules, enabling developers to build applications that leverage the Ontology's full capabilities. The Ontology SDK (OSDK) supports Python, Java, and TypeScript, allowing developers to interact with Ontology data and execute AIP Logic functions, while APIs facilitate programmatic management of platform access and data. Additionally, integrated development environments like VS Code and Compute Modules allow for scalable, containerized deployments, enhancing the development and integration of third-party applications and workflows.

|Application  |Description  |Use  |
|---  |---  |---  |
|[Ontology SDK](/docs/foundry/ontology-sdk/overview/)| The Ontology Software Development Kit (SDK) provides developers with direct access to the full capabilities of the Ontology from their development environment, supporting multiple languages and enabling seamless integration with Palantir APIs for application creation and management.| Accelerate application development by providing easy access to Ontology APIs, ensuring type-safety, reducing maintenance, and enhancing security, allowing developers to efficiently build applications powered by the Palantir platform.|
|[Compute modules \[Beta\]](/docs/foundry/compute-modules/overview/)| Compute modules allow you to deploy interactive containers on the Palantir platform, enabling you to run your existing code base, regardless of language, as serverless Docker images that can scale horizontally based on load in applications like Workshop and Slate. | Use compute modules to interact with code or third-party code by enabling container-backed functions, data integration, and hosting models, while integrating existing code bases in any language with dynamic scaling and connectivity.|
|[Code Workspaces](/docs/foundry/code-workspaces/overview/) \[3] |Code Workspaces brings the JupyterLab® and RStudio® Workbench third-party IDEs to Palantir. |Accelerate data science, statistics, and code-based workflows with industry-standard tools integrated into the Palantir platform. |
|[VS Code workspaces](/docs/foundry/vs-code/overview/)|VS Code Workspaces integration on the Palantir platform uses the open-source VS Code to provide an IDE for writing and collaborating on production-ready code, with native support for Python transforms and OSDK React applications. | Efficiently develop code by accessing a pre-configured VS Code environment directly from within the Palantir platform, leveraging features like preview integration, debugging support, and automatic setup of Python environments, and get access to a pre-configured AI Coding Assistant which understands Foundry and its APIs.|
|[Palantir extension for Visual Studio Code](/docs/foundry/vs-code/overview/)| The Palantir extension for Visual Studio Code integrates features from Code Repositories into VS Code, with a current focus on supporting Python transforms, providing a seamless development experience within the Palantir ecosystem.| Enhance the coding workflow by accessing Palantir repositories directly in VS Code, enabling features like authoring Python transforms and running Builds in Foundry.|
|[Palantir MCP](/docs/foundry/palantir-mcp/overview/) | Palantir MCP enables external AI IDEs and agents to connect to the Palantir platform and gain context on your Ontology and Foundry tools.| Use Palantir MCP to let external AI systems query data, access documentation, and build applications more efficiently.|
|[Ontology MCP (OMCP)](/docs/foundry/developer-console/ontology-mcp/) | Ontology MCP (OMCP) exposes application ontology resources as MCP tools, enabling external AI agents to read objects, execute actions, and query ontology data through controlled access. | Use Ontology MCP to enable external AI agents to safely interact with production ontology data through predefined actions and application restrictions.|

## Use case development

The Palantir platform facilitates use case development by providing a suite of tools, such as application and workflow building tools, integrated analytics, and developer tools, all built on Foundry's core security and data management features. These tools allow teams to concentrate on enhancing operational capabilities, rather than dealing with infrastructure complexities, by continuously enriching a consistent set of data and model assets within the Ontology. This approach ensures that knowledge compounds as operational workflows are expanded across the enterprise, fostering scalable and efficient development.

### Application building

|Application  |Description  |Use  |
|---  |---  |---  |
|[Workshop](/docs/foundry/workshop/overview/) \[1] |Workshop enables the creation of interactive and high-quality applications for end users. | A point-and-click application builder that support pro-code customizations. | Slate may be a better fit if you need heavy customization for your application. |
|[Slate](/docs/foundry/slate/overview/) \[2] |Slate is an extensible application development framework. |Create a customized application using HTML, CSS, and JavaScript. | Workshop is a better fit for applications of low to moderate complexity. |
|[OSDK React applications](/docs/foundry/ontology-sdk-react-applications/overview/)| OSDK React applications allow developers to create fully customizable user interfaces using React, powered by the Ontology Software Development Kit, enabling seamless integration with Foundry as the backend for high-scale queries and secure application development. | Rapidly build and customize user interfaces by leveraging React's developer-friendly environment and Palantir's robust backend capabilities, ensuring efficient and secure application development in an organization. |
|[Pilot](/docs/foundry/pilot/overview/)| Pilot is an AI-powered builder that creates frontends from natural language prompts, automatically generating ontology entities, design specifications, frontend code, and seed data. Pilot builds standalone OSDK applications deployed through Developer Console and custom widgets published to the Widget Registry for embedding in Workshop. | Describe what you want to build in natural language and deploy production-grade hosted applications or custom widgets using OSDK and React. |

\[1] Slate may be a better fit if heavy customization is needed for your application. <br>
\[2] Workshop is a better fit for applications of low to moderate complexity, and generally poses a lower maintenance cost over time.

### Workflow building

|Application  |Description  |Use  |
|---  |---  |---  |
|[Automate](/docs/foundry/automate/overview/)  | Automate allows end users and application builders to see when data changes in the Palantir Ontology.  |Configure automations to send notifications or submit Actions when certain conditions are met. |
|[Solution Designer](/docs/foundry/solution-designer/overview/) | Solution Designer is an interactive tool for crafting architectural representations of solutions on the Palantir platform, offering integration points, links to resources, and access to documentation and best practices. | Develop and refine solution architectures by exploring industry patterns, creating and comparing proposals, and facilitating project collaboration and knowledge transfer within an organization.|
|[Carbon](/docs/foundry/carbon/overview/) | Carbon lets you combine apps and other resources in the platform to create curated workspaces for end users. |Deliver a use case to end users that combines multiple applications or dashboards. |

## Analytics

Palantir offers comprehensive analytical capabilities for all organizational users, integrating seamlessly with the Foundry Ontology to support both point-and-click and code-based analyses, such as table-based, geospatial, and temporal analysis. Its core applications—Contour, Quiver, Code Workbook, Notepad, and Fusion—facilitate diverse analytical tasks, from top-down data exploration and multimodal charting to machine learning and spreadsheet-driven computations, while enabling data to be written back into the Ontology for enriched insights. Additionally, Foundry supports deep integration with existing analytical tools through out-of-the-box connectors, REST APIs, ODBC/JDBC drivers, and SDKs for Python and R, enhancing connectivity with platforms like Power BI, Tableau, and Excel.

Learn more about [analytical applications and the available types of analysis in the platform](/docs/foundry/analytics/types-of-analysis/).

|Application  |Description  |Use  |
|---  |---  |---  |
|[Contour](/docs/foundry/contour/overview/) \[1] |Contour enables high-scale, top-down analysis on datasets. |To analyze tabular data in a point-and-click fashion. |
|[Quiver](/docs/foundry/quiver/overview/) \[2] |Quiver enables analysis on object data and time series. |Analyze Ontology data and time series in a point-and-click fashion. |
|[Insight](/docs/foundry/insight/overview/) \[3] |Insight enables point-and-click analysis on Ontology objects with step-by-step analysis paths. |Perform analysis on Ontology data with link traversal, aggregations, visualizations, maps, SQL queries, and data writeback. |
|[Code Workbook \[Legacy\]](/docs/foundry/code-workbook/overview/) \[4] |Code Workbook is a web-based environment for code-based analysis. |Analyze datasets in code, conduct data science workflows, or develop models. |
|[Notepad](/docs/foundry/notepad/overview/) |Notepad is an ontology-aware collaborative rich-text editor and document templating system. |Create rich-text documents with data and visualizations from Foundry applications. Use templates to add automated reporting to your workflows. |
|[Fusion](/docs/foundry/fusion/overview/) |Fusion is a bidirectional spreadsheet application for the Palantir platform. |Sync data from an editable spreadsheet to a dataset, or query and display data from the ontology in a spreadsheet. |

\[1] Quiver or Insight may be a better fit for some workflows. [Learn more](/docs/foundry/analytics/types-of-analysis/#point-and-click-analysis).<br>
\[2] Contour may be a better fit for some workflows. [Learn more](/docs/foundry/analytics/types-of-analysis/#point-and-click-analysis).<br>
\[3] Insight is suited for analysis on known Ontology data with an intuitive workflow; Object Explorer is better for discovery and searching across unfamiliar Ontology data.<br>
\[4] Code Repositories and Pipeline Builder are recommended for developing production data pipelines. Learn more about [Pipeline Builder](/docs/foundry/pipeline-builder/overview/) and [the difference between Code Workbook, Code Workspaces, and Code Repositories](/docs/foundry/code-workbook/code-products-comparison/).

## Product delivery

Foundry DevOps accelerates the development and deployment of data-driven workflows by packaging resources—such as ontologies, AI models, and pipelines—into flexible products, with automated version and dependency management ensuring seamless scalability. Key features include tagging product versions with release channels, managing a fleet of installations, and supporting use cases like product distribution, ecosystem building, release management, and bootstrapping new applications.

Marketplace further enhances product delivery by offering a storefront for easy discoverability and installation of published data products, complete with guided installation and related product recommendations.

|Application  |Description  |Use  |
|---  |---  |---  |
|[DevOps](/docs/foundry/foundry-devops/overview/)| Create Foundry products for release management or workflow distribution. |Create Foundry products, manage installations, and release versions via release channels. |
|[Marketplace](/docs/foundry/marketplace/overview/)| Discover and install Foundry products.| Customize installations of Foundry products, Examples, and workflow starter packs. Manage installations and configure upgrades to ensure installations stay up-to-date with minimal effort. |

## Security and governance

Palantir’s platform is designed with security and governance as foundational pillars. This approach provides robust protection for sensitive data across industries such as healthcare, finance, and government. Moreover, Palantir's solutions are aligned with global regulatory frameworks like HIPAA, GDPR, and ITAR, ensuring comprehensive compliance and safeguarding of sensitive information.

The platform enforces strict access controls through a sophisticated security model that includes mandatory and discretionary permissions, granular access controls, and mandatory encryption, ensuring users only access authorized data. Palantir's enterprise security features include strong authentication measures, comprehensive audit logging, and extensive information governance.

|Application  |Description  |Use  |
|---  |---  |---  |
|[Approvals](/docs/foundry/approvals/overview/) | The Approvals application manages the workflow of requesting, approving, and invoking changes in Foundry, consolidating compliance, governance, and peer-review processes for efficient management of tasks like project access requests and ontology proposals. | Handle change requests in the Palantir platform by reviewing and approving tasks, tracking request status, and ensuring compliance with governance policies, all while staying informed through notifications about request progress and required actions. |
|[Checkpoint](/docs/foundry/checkpoints/overview/)| The Checkpoints tool is a data governance application that prompts users for justifications during potentially sensitive interactions, ensuring adherence to data protection, governance, and compliance policies through real-time review and auditability.| Customize prompts and gather justifications for user interactions, and review justifications in real-time and ensure compliance with organizational policies, while gaining insights into user behavior across various workflows. |
|[Cipher](/docs/foundry/cipher/overview/)| Cipher is a service that enables users to obfuscate data through cryptographic operations like encryption, decryption, and hashing. It provides easy-to-use tooling to manage algorithms and keys via Channels and Licenses, enabling the secure and accessible deployment of privacy-enhancing tools.| Apply cryptographic operations and manage permissions in workflows, enhancing privacy and governance by securely encrypting, decrypting, or hashing data within the Palantir platform's operational environment.|
|[Sensitive Data Scanner](/docs/foundry/sensitive-data-scanner/overview/)| Sensitive Data Scanner (SDS) is a tool that enables organizations to discover and secure sensitive information within Foundry by specifying patterns of sensitive data to identify. It further allows organizations to automate appropriate actions to manage such data once detected, thereby reinforcing compliance with global data protection regulations.| Conduct singular or recurring scans across datasets to allow for enhanced control over sensitive data management and ensure compliance with privacy laws by automating the identification and handling of sensitive information. |
|[Data Lifetime \[Beta\]](/docs/foundry/data-lifetime/overview/)| Data Lifetime is a service that enables the application of lineage-aware retention policies on datasets in the Palantir platform. This service governs the deletion of transactions and manages their downstream impacts, reinforcing compliance with the highest industry standards.| Set and manage retention policies that control the deletion of datasets and their downstream derivatives, ensuring comprehensive data removal and compliance with regulatory requirements by leveraging Foundry's data lineage capabilities. |

## Management and enablement

Management and enablement capabilities are centralized within the Control Panel, offering a comprehensive suite for governance, resource management, and security administration, which supports enterprise data architectures like data mesh and data fabric. Control Panel allows administrators to configure and manage enrollments, map administrative functions to existing governance systems, and manage access through identity providers using SAML 2.0, ensuring seamless integration and security as the platform scales. Additionally, resource management tools provide granular insights into resource utilization, while customizable platform experiences ensure alignment with organizational branding and user-specific needs.

|Application  |Description  |Use  |
|---  |---  |---  |
|[In-platform custom documentation](/docs/foundry/custom-docs/overview/)| Custom documentation is a feature that allows users to create, publish, and manage documentation hosted on the Palantir platform, which can be indexed by AIP Assist to enhance query responses using your organization's documentation. | Develop and manage specific internal documentation within your organization, making it accessible through various platform entry points. |
|[Walkthroughs](/docs/foundry/walkthroughs/overview/)| Walkthroughs is a tool that allows users to create custom, step-by-step tutorials on the Palantir platform, guiding end-users through applications or workflows with tailored, on-demand resources. | Design and share interactive tutorials that facilitate self-guided learning across multiple applications, incorporating rich media and progress tracking to enhance user engagement and support organizational workflows. |

## Artificial Intelligence Platform (AIP) application reference

See the [AIP application reference](/docs/foundry/aip/aip-features/#aip-application-reference) for a list of AIP applications.
