<!-- source: https://palantir.com/docs/foundry/transforms-python/python-versions/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Python version support

As Python development continues, the Python Software Foundation [marks old Python versions as "end of life" (EOL) ↗](https://devguide.python.org/versions/); versions beyond their EOL date are officially unsupported.

## Foundry and Python versioning

Starting from Python version 3.9, Foundry will follow the Python Software Foundation's EOL schedule and will not support deprecated Python versions. Deprecated Python versions can pose security risks to the platform and may be incompatible with technologies necessary for the platform to function (for example, Apache Spark does not support older Python versions). Palantir will notify Foundry users who are using Python versions that are approaching EOL.

## How do I know if my workflows are using deprecated Python versions?

You will be notified by pop-ups and banners if one of your workflows is using a deprecated Python version. These notifications will contain information on how to upgrade from the deprecated version.

## Which Python versions are safe?

The Python Software Foundation's [version end of life table ↗](https://devguide.python.org/versions/) is continuously updated and indicates which Python versions are safe. We suggest that you always use the latest supported version. You can refer to the following table for information about Foundry support of Python versions.

| Version |  Supported in Foundry  | End of life start in Foundry | Support discontinued in Foundry |
|---------|------------------------|------------------------------|----------------------------|
| 3.6     | No<sup>*</sup>         | 2023-07-16                   | 2024-01-31                 |
| 3.7     | No<sup>*</sup>         | 2023-07-16                   | 2024-01-31                 |
| 3.8     | No<sup>*</sup>         | 2024-09-04                   | 2025-01-31                 |
| 3.9     | No<sup>*</sup>         | 2025-10-01                   | 2026-01-31                 |
| 3.10    | Yes                    | 2026-04-30                   | 2026-10-31                 |
| 3.11    | Yes                    | 2027-04-30                   | 2027-10-31                 |
| 3.12    | Yes                    | 2028-04-30                   | 2028-10-31                 |
| 3.13    | Coming soon            | 2029-04-30                   | 2029-10-31                 |
| 3.14    | In planning            | 2030-04-30                   | 2030-10-31                 |

<sup>\*</sup> This indicates a version that has reached EOL in Foundry, which means that workflows using this version are unsupported and there are no guarantees of functionality or compatibility.

:::callout{theme="warning" title="Warning"}
Palantir will not offer support for workflows that run on Python versions past EOL.
:::

## Python version deprecations

Campaigns will be created in platform to help users identify affected workflows at start of end of life.

Python 3.10 will be unsupported in Foundry starting on 2026-10-31. Users will be notified with information on how to identify any affected workflows and migrate to non-deprecated Python versions before the deadline.

Python 3.9 is no longer supported in Foundry as of 2026-01-31. Users should migrate to non-deprecated Python versions.

Python 3.6, 3.7, and 3.8 are no longer supported in Foundry as of 2025-01-31. Users should migrate to non-deprecated Python versions.

Refer to the [Environment Troubleshooting guide](/docs/foundry/transforms-python/environment-troubleshooting/) to learn more about changing your Python versions.
