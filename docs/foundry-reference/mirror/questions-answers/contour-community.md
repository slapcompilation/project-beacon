<!-- source: https://palantir.com/docs/foundry/questions-answers/contour-community/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Contour (Community)

### What set of operations are required to export a Contour dashboard to a PDF?

Users should be able to download a Contour dashboard as PDF as long as they have `read` permissions on the dashboard and underlying datasets. The specific operations are `export-dashboard-data` and `export-data`.

*Topic Link:* [https://community.palantir.com/t/permissions-required-for-export-of-contour-dashboard-to-pdf/177 ↗](https://community.palantir.com/t/permissions-required-for-export-of-contour-dashboard-to-pdf/177)

*Timestamp:* October 17, 2024

### What could cause different row counts between different widgets in Contour when using the same data and path?

The difference could be due to inherent non-determinism in certain functions. Please refer to the [documentation](/docs/foundry/contour/correctness-non-determinism/) to check if you have any of the operations mentioned that could lead to non-deterministic behavior.

*Topic Link:* [https://community.palantir.com/t/specifications-for-row-counts-in-contour/514 ↗](https://community.palantir.com/t/specifications-for-row-counts-in-contour/514)

*Timestamp:* October 17, 2024
