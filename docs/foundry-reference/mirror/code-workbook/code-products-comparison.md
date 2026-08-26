<!-- source: https://palantir.com/docs/foundry/code-workbook/code-products-comparison/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Comparison: Code Repositories vs. Code Workspaces vs. Code Workbook

Foundry has three products available for writing code-based data transformations: Code Workbook, Code Workspaces, and Code Repositories. While there is some feature overlap between these products, each is geared toward distinct workflows and user types. The guide below is intended to help you determine which tool is best suited to your needs.

[Code Repositories](/docs/foundry/code-repositories/overview/) is recommended for creating robust production pipelines and supporting workflows that require an additional layer of governance and scrutiny. With Code Repositories, data engineers can create efficient pipelines in bulk. Example workflows that are a good fit for Code Repositories include:

* A daily pipeline at high data scale which requires incremental compute.
* A high-visibility pipeline with strict governance requirements to be able to revert to previous versions of historical code, or gate code changes on unit tests passing.

[Code Workspaces](/docs/foundry/code-workspaces/overview/) is recommended for quick and efficient exploratory analyses using JupyterLab® and RStudio® Workbench to combine familiar IDEs with the benefits of the Foundry platform, such as data security, branching, build scheduling, and resource management. Example workflows that are a good fit for Code Workspaces include:

* Running a cell-by-cell data analysis and exporting its contents to a shareable report
* Prototyping a data transformation pipeline or a machine learning model

[Code Workbook](/docs/foundry/code-workbook/overview/) is recommended for performing code-based analyses on high-scale data that would not otherwise be suitable for Code Workspaces. These analyses can be for one-time use or could produce an artifact that is updated on a recurring basis. Code Workbook can also be used to prototype pipelines, which can then be [promoted to repositories](/docs/foundry/code-workbook/code-repositories-export/). Example workflows that are a good fit for Code Workbook include:

* Investigating the results of a clinical trial by testing out different p-values.
* Creating interactive visualizations to share with others.

In addition to the code-based products above, [Pipeline Builder](/docs/foundry/pipeline-builder/overview/) is the Palantir platform's primary no-code application for building and maintaining production data pipelines. Pipeline Builder uses a graph and form-based interface, enabling users to integrate data and create business logic transformations without writing code. If you are evaluating whether to use Pipeline Builder or Code Repositories for your pipeline, see [Considerations: Pipeline Builder and Code Repositories](/docs/foundry/building-pipelines/considerations-pb-cr/).

## Comparison summary

|                           | Code Repositories        | Code Workspaces          | Code Workbook            |
|---------------------------|--------------------------|--------------------------|--------------------------|
| **Features**              | **Advanced pipelines**   | **Exploratory analysis** | **Advanced analysis**    |
|                           | Enables complex workflows in long-lasting data pipelines with flexibility in performance optimization and code generation. | Enables interactive exploratory workflows using familiar IDEs tied with Foundry primitives. | Enables data analysis workflows with support for common analytical languages and visualization libraries. |
| Languages supported       | Python, SQL, Java, Mesa  | Python, R                | Python, R, SQL           |
| Environments Supported    | All environments         | Kubernetes environments only | All environments     |
| Batch Pipeline support    | Yes                      | Yes                      | Yes                      |
| Incremental computation   | Yes                      | No                       | No                       |
| Transform generation      | Yes                      | No                       | No                       |
| Multi-output transforms   | Yes                      | Yes                      | No                       |
| Filesystem access         | Yes                      | Yes                      | Yes                      |
| Visualization support     | No                       | Yes                      | Yes                      |
|                           |                          |                          |                          |
| **Iteration cycle**       | **Iterate on code logic** | **Iterate on data discovery and analysis** | **Iterate on insight generation** |
|                           | Designed to help iterate on code logic. Runtime debugger and previews can assist in validating transform logic. Data can be analyzed in Foundry after building. | Designed to help rapidly iterate on data discovery and analysis using widely known tools that seamlessly integrate with the rest of Foundry. | Designed to help generate insights from data; all transforms run on the full input data, interactive console enables ad-hoc queries, and Spark execution model is optimized for quick iteration. |
| Full data preview         | Preview data sample, with the ability to pre-filter the input sample | Full data preview | Full data preview |
| Debugger                  | Yes                      | No                       | No                       |
| Console support           | In debug mode            | Yes                      | Yes                      |
| Spark module management   | Spark modules initiated at the job level | Spark-less environment for fast feedback loop | Spark modules kept warm for immediate interactivity, and initiated at the workbook level |
|                           |                          |                          |                          |
| **Operations**            | **Data pipeline management** | **Data exploration management** | **Data analysis management** |
|                           | Supports Foundry data management libraries and publishing custom Python libraries | Fully adjustable environment that can consume pip, CRAN, and conda libraries, including those published from Code Repositories | Can consume custom libraries published from Code Repositories; users can save pieces of logic as code templates, enabling point-and-click analysis by other users. |
| Data Expectations         | Yes                      | No                       | No                       |
| Publish custom libraries  | Yes                      | No                       | No                       |
| Consume custom libraries  | Yes                      | Yes                      | Yes, for some environments |
| Point-and-click code templates | No                  | No                       | Yes                      |
|                           |                          |                          |                          |
| **Change management**     | **Governance**           | **Flexibility**          | **Rapid changes**        |
|                           | Prioritizes change traceability and governance to ensure that critical pipelines remain secure and robust; advanced review and approval workflows and complete changelogs. | Prioritizes rapid and flexible iteration with full branching support and automatic Git versioning. | Prioritizes rapid iteration and collaboration with a lightweight branching workflow; does not require CI checks or unit testing. |
| Full Git workflow         | Yes                      | Yes                      | No                       |
| Copy data after merge     | No                       | No                       | Yes                      |
| Administer and remove security markings | Yes        | No                       | No                       |
| Impact analysis views     | Yes                      | No                       | No                       |
| Advanced code review workflows | Yes                 | No                       | No                       |
| Unit testing              | Yes                      | No                       | No                       |

<details>
  <summary>Table summary</summary>

<!-- features -->

##### Code Repositories features

* Code Repositories features advanced pipelines and enables complex workflows in long-lasting data pipelines with flexibility in performance optimization and code generation.
* Languages supported in Code Repositories include Python, SQL, Java, and Mesa.
* Code Repositories supports [incremental computation](/docs/foundry/transforms-python-spark/incremental-examples/), [transform generation](/docs/foundry/transforms-python/pipelines/#automatic-registration), [multi-output transforms](/docs/foundry/transforms-python/transforms/#define-transforms), and [filesystem access](/docs/foundry/transforms-python/unstructured-files/).
* Code Repositories does not support visualizations.

##### Code Workspaces features

* Code Workspaces features quick and efficient exploratory workflows with an embedded support for JupyterLab® and RStudio® Workbench in Foundry.
* Languages supported in Code Workspaces include Python and R.
* Code Workspaces supports [filesystem access](/docs/foundry/code-workspaces/data/#non-tabular-datasets) and provides full flexibility on notebook-based analyses.
* Code Workspaces does not support distributed Spark, and is therefore better suited for data that can fit within the workspace's [compute limits](/docs/foundry/code-workspaces/compute-usage/#understanding-drivers-of-foundry-compute-usage-in-code-workspaces).

##### Code Workbook features

* Code Workbook features advanced analysis workflows with support for common analytical languages and visualization libraries.
* Languages supported in Code Workbook include Python, R, and SQL.
* Code Workbook supports [filesystem access](/docs/foundry/code-workbook/transforms-unstructured/) and [visualization](/docs/foundry/code-workbook/transforms-visualize/).
* Code Workbook does not support incremental computation, transform generation, or multi-output transforms.

<!-- iteration cycle -->

##### Code Repositories iteration cycle

* Code Repositories is designed to help iterate on code logic. Data can be analyzed in Foundry after building.
* Code Repositories supports data sample previews to validate transform logic, with the ability to pre-filter the input sample.
* Code Repositories supports [debugging at runtime](/docs/foundry/code-repositories/debug-transforms/).
* In Code Repositories, Spark modules are initiated at the job level.

##### Code Workspaces iteration cycle

* Code Workspaces is designed to help explore and analyze data. Results can then be shared, published to dashboards, turned into re-usable transforms, or exported to production-ready pipeline tools such as Code Repositories or Pipeline Builder.
* Code Workspaces offers the full flexibility of the JupyterLab® and RStudio® Workbench IDEs, including full code and data previews.
* Code Workspaces provides cell-by-cell iteration for instant feedback on code execution.
* In Code Workspaces, no Spark modules are required and a fully customizable kernel is available for ad-hoc adjustments of the environment.

##### Code Workbook iteration cycle

* Code Workbook is designed to help generate insights from data. All transforms run on the full input data, and Spark execution models are optimized for quick iteration.
* Code Workbook supports full data previews.
* Code Workbook provides [console support](/docs/foundry/code-workbook/workbooks-console/) for ad-hoc analysis of transforms.
* In Code Workbook, Spark modules are kept warm for immediate interactivity and initiated at the workbook level.

<!-- operations -->

##### Code Repositories operations

* Code Repositories supports Foundry data management libraries and custom Python libraries.
* Code Repositories supports [data expectations](/docs/foundry/transforms-python/data-expectations-getting-started/), [publishing](/docs/foundry/transforms-python/share-python-libraries/) custom libraries, and consuming custom libraries.
* Code Repositories does not support point-and-click code templates.

##### Code Workspaces operations

* Code Workspaces can consume pip, CRAN, and conda libraries, including those published from Code Repositories, and environments can be modified quickly.
* Code Workspaces does not support data expectations or publishing custom libraries.
* Code Workspaces does not support point-and-click code templates.

##### Code Workbook operations

* Code Workbook can consume custom libraries published from Code Repositories, and users can save pieces of logic as code templates, enabling point-and-click analysis by other users.
* Code Workbook does not support data expectations or publishing custom libraries.
* Code Workbook does [consume custom libraries](/docs/foundry/code-workbook/environment-overview/) for some Spark environments.
* Code Workbook supports [point-and-click templates](/docs/foundry/code-workbook/templates-overview/).

<!-- change management -->

##### Code Repositories change management

* Code Repositories prioritizes change traceability and governance to ensure that critical pipelines remain secure and robust.
* Code Repositories provides complete changelogs.
* Code Repositories provides a [full Git workflow](/docs/foundry/building-pipelines/branching-release-process/), security marking administration and [removal](/docs/foundry/building-pipelines/remove-inherited-markings/), [impact analysis](/docs/foundry/code-repositories/analyze-impact/) views, [advanced code review](/docs/foundry/code-repositories/branch-settings/#protected-branches) workflows, and [unit testing](/docs/foundry/code-repositories/unit-tests/).
* Code Repositories does not support copying data after merging.

##### Code Workspaces change management

* Code Workspaces prioritizes rapid and flexible iteration with full branching support and automatic Git versioning.
* Code Workspaces are fully backed by Code Repositories and benefit from their [full Git workflow](/docs/foundry/building-pipelines/branching-release-process/).
* Code Workspaces does not support copying data after merging.
* Code Workspaces stores safe checkpoints of its notebook's contents for 30 days, allowing users to safely retain and retrieve any given state, while also providing the opportunity to permanently store backups of the code in the Git repository.

##### Code Workbook change management

* Code Workbook prioritizes rapid iteration and collaboration with a lightweight branching workflow. Code Workbook does not require CI checks or unit testing.
* Code Workbook supports copying data after merging.
* Code Workbook does not provide a full Git workflow, security marking administration or removal, impact analysis views, advanced code review workflows, or unit testing.

***

JupyterLab® is a registered trademark of NumFOCUS.
RStudio® is a trademark of Posit™.

</details>
