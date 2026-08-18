<!-- source: https://palantir.com/docs/foundry/aip-analyst/overview/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# AIP Analyst

AIP Analyst is an interface for agentic workflows that lets you use natural language to perform ad-hoc analyses across your Ontology. You can ask AIP Analyst a question, and the agent will answer by autonomously searching your Ontology, creating object sets, and transforming data before generating summaries and visualizations.

## Example workflow

As an example, imagine a user that runs a coffee chain and wants to perform a competitive analysis. They want to examine whether it is viable to open a new location in Northampton, England. To start an analysis, this user can ask "Which coffee shops are within 10km of Northampton? Are any chains particularly prominent?"

AIP Analyst searches across your Ontology for relevant data using multiple search terms to increase the likelihood of finding a relevant object type.

![An AIP Analyst object type search.](./images/aip-analyst-workflow-1.png)

Having found some coffee shops, AIP Analyst examines the data and applies a geospatial filter centered around Northampton.

![AIP Analyst geospatial filters.](./images/aip-analyst-workflow-2.png)

Finally, after performing some additional aggregations on the chains, it generates a summary of the shops within the specified area and competing chains.

![A sample AIP Analyst summary.](./images/aip-analyst-workflow-3.png)

## More ways to use AIP Analyst

In addition to running ad-hoc analyses, AIP Analyst can:

* **Save analyses as Compass resources:** Return to your work later or share with collaborators using [analysis resources](/docs/foundry/aip-analyst/analysis-resources/).
* **Embed in other applications:** Add a [Workshop widget](/docs/foundry/aip-analyst/workshop-widget/) for tighter integration inside a Workshop module, or use [URL parameters](/docs/foundry/aip-analyst/embed/) for iframe embedding in OSDK or other Foundry applications.

***

Note: AIP feature availability is subject to change and may differ between customers.
