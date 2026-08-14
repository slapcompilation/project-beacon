<!-- source: https://palantir.com/docs/foundry/transforms-r/overview/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# R transforms

With R transforms in Foundry, you can use the [Code Workspace RStudio® Workbench](/docs/foundry/code-workspaces/rstudio/) to write and publish data transformations in the R language and access R libraries.

R transforms use a different execution mode and provide different APIs compared to other transform languages supported in Foundry. Specifically, R transforms execute on a single node and do not leverage Spark for data reads and writes.

R transforms support reading and writing both structured (tabular) and unstructured datasets using the [Palantir R SDK ↗](https://github.com/palantir/palantir-r-sdk) and importing R libraries from CRAN, Posit™ Package Manager, and Bioconductor.

[Get started writing R transform in Foundry.](/docs/foundry/transforms-r/getting-started/)

***

*RStudio® is a trademark of Posit™.*

All third-party trademarks (including logos and icons) referenced remain the property of their respective owners. No affiliation or endorsement is implied.
