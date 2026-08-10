<!-- source: https://palantir.com/docs/foundry/questions-answers/pipeline-builder-community/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Pipeline Builder (Community)

### Is it possible to use relative date in Pipeline Builder?

You can use the "Current Date" option (under the `Expression` tab) and then add or subtract from that as needed.

*Topic Link:* [https://community.palantir.com/t/pipeline-builder-relative-date/810 ↗](https://community.palantir.com/t/pipeline-builder-relative-date/810)

*Timestamp:* October 10, 2024

### In Pipeline Builder, what is the recommended approach to collect an array of values where the order is defined by a field?

By default, the order in a `Collect Array` expression is not deterministic. A possible workaround is to use an `Ordered Window` expression with `Collect Array` and then sort on the required field.

*Topic Link:* [https://community.palantir.com/t/ordered-collect-array-in-pipeline-builder/423 ↗](https://community.palantir.com/t/ordered-collect-array-in-pipeline-builder/423)

*Timestamp:* October 10, 2024
