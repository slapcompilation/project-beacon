<!-- source: https://palantir.com/docs/foundry/building-pipelines/building-production-pipeline/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Building a production pipeline

Production workflows need reliable pipelines to back them. Following the principles laid out in this document when building a pipeline will result in easier maintenance, allowing you to catch problems before they cause SLA breaches. Some guidance here will also make it easier to share knowledge about what is important in your pipeline. This is important in all stages of the pipeline’s lifecycle, from development all the way through to long-term maintenance.

This document is useful for both pipeline developers and pipeline maintainers. For developers, it is useful before you start building a pipeline if it will be going straight into production. Equally, this document can be used when a proof-of-concept pipeline is being converted into a production pipeline. For pipeline maintainers, the following elements should be prerequisites to entering maintenance mode.

## Pipeline definition and expectations

While it may not always be possible to have definitive answers around expectations before you start building a production pipeline, it is valuable to be mindful about them early as possible. It’s highly recommended to document the pipeline definition and expectations as you establish them.

The expectations influence several aspects of design and set-up of a production pipeline, including:

* The pipeline design and architecture decisions.
* How schedules should be set up (as this is the primary way to control how frequently the pipeline is built).
* What validations and monitoring are required.
* How to prioritize issues when the pipeline is in maintenance mode.

The important questions that should be addressed by your team, include:

* **What exactly is the scope of the pipeline?** Where does it start, where does it end? Where should it feed into other pipelines?
  * If parts of your pipeline overlap with another pipeline or use case, consider treating the overlapping section as its own pipeline.
* **What is the requirement on pipeline refresh rate?**
  * Or perhaps there is a specific time of day when data needs to be refreshed by?
  * Should the pipeline run over weekends?
  * When is data considered critically out of date?
  * What will the expectation in terms of refresh rate and support?
  * *Be careful* — while this sounds easy, this area is where pipeline maintenance teams often face the most difficulty. Without clear definitions here, it is difficult to prioritize work as a pipeline maintainer or make the right fix.
* **What is the expectation for end-to-end propagation delay?** In other words, how long should it take for data to flow through the pipeline from the moment it lands in Foundry, to the point where the outputs of the pipeline are updated?
* **Who’s your contact point on each and every external source that you pull from?** External sources can be Data Connection syncs or a separate upstream Foundry pipeline that feeds into your pipeline.
* **What are the functional guarantees for correctness in your data?** Are there critical columns or key validations that must be true for your pipeline?
  * *Note:* it’s important to determine what the outcome should be if a guarantee is broken. Should a failing validation prevent data from reaching your end user or should it fire an alert without preventing your pipeline from updating? You may want to do the latter to allow other up-to-date data to flow through your pipeline? The implementation for these two different situations would differ. Documentation is a good place to start tracking guarantees early on.
* **Are the expectations determined compatible?** As complex systems grow, they become more prone to failures. You generally want to allow sufficient time after an alert is fired to address the underlying issue - whether that is an unexpected pipeline failure or missing data from an upstream source.
  * *Example 1:* It’s important to think about the propagation delay in relation to the expected pipeline refresh rate. If the expected refresh rate is every 2 hours, and the pipeline takes 1.5 hours to build, it may become difficult to adhere to SLAs.
  * *Example 2:* if a workflow requires an hourly refresh rate, but the upstream data source only provides data twice a day. This means that you will not be able to achieve hourly refreshes.

## Principles for production pipelines

The key principle for setting up a successful production pipeline can be summarized as: **“build with the idea that you won’t be around to maintain it”**.

Some concrete tips that can help you achieve this:

* **Version your code, and write meaningful commit messages:** this makes it easier to keep track of what changes were made, when they were committed and by whom.
  * In production pipelines, [Java](/docs/foundry/transforms-java/overview/) and [Python](/docs/foundry/transforms-python/overview/) are recommended if possible. There are a lot of available resources and a strong developer community for both these languages. Whilst SQL is very accessible, it can get convoluted very quickly and hence can be more difficult to debug.
* **Optimize for legibility above all else:** Simple pipelines are simpler to maintain. Opting for standard or existing solutions in transform code will reduce the maintenance burden and development complexity down the line. If you *must* do something unconventional, be sure to document it thoroughly.
* **Linear pipelines where possible:** In terms of general architecture, the pipelines that are easier to maintain are those that are fairly straightforward and linear, but it’s difficult to give recommendations on how to get there. Be mindful of the general structure of the pipeline, and optimize for readability and simplicity as much as possible given your constraints. Once you are thinking about moving the pipeline to production, taking some time to untangle the pipeline is usually time well spent.
* **Production pipelines are often long-lived.** As a result there’s a good chance that those who write the pipelines are not those who maintain or manage the pipelines in the long-term.  Keep in mind that the next person who takes over the pipeline development or maintenance needs to be able to read the code and make sense of the pipeline setup.
* **Keep concise documentation:**
  * *Logic documentation:* It is generally advised that documentation about the logic itself is kept in code comments.
  * *Overall pipeline documentation (including documenting recurring issues in a pipeline)*: should also be kept close to the pipeline, in an intuitive location. A good example place for this would be in the Project that the pipeline belongs to. It should be easy to find for pipeline developers and maintainers.
  * Bear in mind: over-documenting can also make it hard to read and less useful. Be concise and document key information. If you need to capture very long and detailed pipeline information that will not be referred to as often, consider keeping it in a separate document.

## Development process and infrastructure setup

**Development**

Once a pipeline goes into production, it’s important to ensure that the development processes around making further contributions to the pipeline are established and effectively communicated to pipeline developers. This ensures that no unexpected outages on the pipeline occur.

As a result, we recommend reading:

* **[Development Best Practices](/docs/foundry/building-pipelines/development-best-practices/):** At the very least, production pipelines should be easy-to-read, easy-to-maintain, and with locked master branches. However to ensure your development setup is more robust, we recommend reading through the more detailed advice in this documentation.
* **[Branching and Pipeline release process](/docs/foundry/building-pipelines/branching-release-process/):** if you haven’t already been working with a branching and pipeline release process during the development phase of your pipeline, we recommend this when moving your pipeline into production. The documentation will provide an example process that you can use.

**Infrastructure (schedules)**

On a related note, setting up schedules early will allow you to develop without having to think about manually triggering builds of different parts of your pipeline. If your scheduling is messy, you may find that this hinders your development and slows you down as changes are not propagating automatically through your pipeline.

When moving a pipeline into production, it is also recommended to review and re-structure your schedules as the schedules used during development may no longer make sense or may contain antipatterns. This step should be done before moving into maintenance mode.

Setting up or reviewing schedules according to best practices can be achieved by following the **[scheduling best practices documentation](/docs/foundry/building-pipelines/scheduling-best-practices/)**.

## Start monitoring early

As soon as the pipelines are running regularly, you want to start monitoring its behavior. This prevents tech debt from accumulating and allows you to track if the expectations for the pipeline are realistic or not. It may not always be feasible to start monitoring right away, given deadlines and the capacities of your team, however it is encouraged where possible.

See the documentation on [Pipeline Monitoring Best Practices](/docs/foundry/maintaining-pipelines/overview/) for more information on how to set up monitoring.
