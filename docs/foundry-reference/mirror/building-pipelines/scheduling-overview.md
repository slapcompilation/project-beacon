<!-- source: https://palantir.com/docs/foundry/building-pipelines/scheduling-overview/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Scheduling

In Foundry's data integration layer, a [schedule](/docs/foundry/data-integration/schedules/) is a key concept enabling data to stay up to date for end users who rely on data in a pipeline. Foundry's scheduling capabilities are designed to support all types of data pipelines, and provide considerable flexibility when creating scheduled builds.

Scheduled builds can be configured to run:

* At certain times
* When data has been updated
* When logic has been updated
* *Any combination of the above conditions*

Scheduled builds can be configured to build:

* A single dataset
* A single dataset and all its dependencies
* All datasets that depend on a dataset
* All datasets that connect two datasets
* *Any combination of the above configurations*
