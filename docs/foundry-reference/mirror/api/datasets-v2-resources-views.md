<!-- source: https://palantir.com/docs/foundry/api/datasets-v2-resources/views/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# View basics

A View behaves similarly to a Foundry
[dataset view](https://www.palantir.com/docs/foundry/data-integration/datasets#dataset-views),
but it does not hold any files containing data. Instead, Views can be thought of as "pointing" to their
backing datasets. When a View is read, it is composed of the union of its backing datasets.

Views can also automatically perform deduplication of data with the addition of a primary key. If any of a
View's backing datasets have new data, a build will be automatically triggered to ensure that the latest data
is available after deduplication. Views build like regular datasets but complete almost instantly since no
data is actually read or written as part of the build.

Generally, you can use Views like regular datasets. However, Views can only be specified as transform
inputs, not transform outputs.

Additionally, Views can only be used with datasets that have a schema, since Views operate with rows.

For more information, refer to the [Views](/docs/foundry/data-integration/views) user documentation.
