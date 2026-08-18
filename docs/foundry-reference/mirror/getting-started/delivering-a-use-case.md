<!-- source: https://palantir.com/docs/foundry/getting-started/delivering-a-use-case/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Delivering a use case

To create value for your organization using the Palantir platform, you need to work across the platform to build tools that support operational decision-making processes. A **use case** is a time-bound effort by a dedicated team to support a specific decision-making process. Use cases are central to the delivery of new capabilities on the platform for a set of users.

## Examples of use cases

Use cases in the Palantir platform can involve a wide range of different activities and workflows, such as:

* Generating, investigating, and resolving alerts related to important operational processes.
* Optimizing inventory across a network of your facilities to improve resilience and mitigate supply chain uncertainty.
* Helping you make decisions about how to optimize the allocation of salespeople to all the different regions you serve.

Use cases require a structured and thoughtful approach to building in the platform along with gaining an understanding of some new ideas and terminology. You can find all the details of our solution design methodology as well as case studies and reference architectures in the [use case lifecycle](/docs/foundry/use-case-life-cycle/overview/) section.

## A data-driven mindset

Imagine a world where data scientists, quality analysts, assembly line workers, and executives use data as their daily communication language. Palantir turns data into a communication language by:

* Maintaining data lineage and attribution so people can trust what they discover and learn.
* Meeting users where they are, regardless of technical ability or experience, so everyone can bring data into their daily work.

This vision of collaboration is the driving force behind the Palantir platform.

The Palantir platform was built to create **data-driven loops** across an organization, in sync with your colleagues and collaborators: use data to make a decision, capture the decision that was made, and then use data to assess the decision's impact over time. Rather than relying on emailed spreadsheets and static analyses, you and your colleagues can collaborate directly on data in real time.

Project success on the Palantir platform involves creativity and thoughtfulness. There are often several solutions to any given analytical question, organizational workflow, or operational need. To choose the right path, you will need to balance three factors: the desired outcome, the available data, and platform tools.

## Outcome

As you break down your project, it's more important to think about the outcome rather than the method you use to get there. For example, instead of starting with a need to build a sales dashboard, seek to understand what decisions and outcomes your work might enable. For example, is the outcome about making decisions on time and resource allocation to different sales regions, or something else?

This level of understanding might involve more work at the start of your project, especially if you are building a tool, report, or analysis for someone else to use. Consider an outcome-oriented framing to help you move towards a realistic goal.

Flexibility and adaptation can help ensure a successful Palantir project. Identifying a clear, outcome-oriented goal makes it easier to break your project into small, logical steps. This problem decomposition is an important skill, as projects will often require multiple sources of data and several platform tools working together.

## Data

Figuring out the right data to back your project can be a daunting task. However, if you have an outcome-oriented framing and decompose your project into smaller steps, it's easier to work backwards from that outcome and identify the necessary data.

If your organization has been using the Palantir platform for a while, the data you need may already be in the platform. Try exploring datasets curated in the [Data Catalog](/docs/foundry/compass/data-catalog/) or objects and links in [Object Explorer](/docs/foundry/object-explorer/overview/). From our outcome example, we might identify that we need data on our sales force, sales territories, products, and individual sales. Each of these objects should have a primary representation in the Ontology.

If you are unable to identify the key dataset for each type of data you need, contact your platform administrator. Sometimes, it is necessary to expand the Ontology to include new organizational objects or to add new properties to those that already exist. As we will discuss later, you can use the tools in the data integration layer to connect external data sources and bring new data into the Palantir platform.

## Tools

Each application is designed to operate as part of the entire platform. It will take time to familiarize yourself with the different capabilities in the platform and which tools are best for a given job.

Once you understand the outcomes of your project and the necessary data, it's easier to map each step to a particular tool. For instance, suppose that in your project you recognize that one sub-project is to generate new sales metrics for each region. This sub-project creates several additional steps:

* Identify the key relevant metrics
* Source the data
* Develop logic to transform the data
* Develop logic to aggregate the data into the metrics
* Display the data for consumption by the sales team

Each of these steps will map to different tools in the platform, and the correct tool may vary as your project matures. For instance, you might start by prototyping transforms and metrics in **Contour**, an application for point-and-click analysis and data transformation. Contour makes it easy to understand the shape of your data and generate charts or metrics. You can add these metrics to a **dashboard** and create a quick prototype for the sales team to provide feedback. This could be a great end point for this project: a few well crafted dashboards that provide new insights to drive decisions for the sales resource allocation process.

For larger projects or those focused on production usage you can convert your logic to a pipeline in **Code Repositories**. There, you can collaborate with other technical users and use robust platform tools to schedule your data to update regularly. To create a more tailored user experience, you can set up **Object Views** or build a custom application in **Workshop** or **Slate** to enable the sales team to not only view data in dashboards, but also capture their decisions back into the system.

While many projects in the platform will not need this level of complexity, it is useful to understand how framing and decomposing your project will help you identify the data and tools you need to succeed.
