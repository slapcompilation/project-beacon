<!-- source: https://palantir.com/docs/foundry/questions-answers/builds/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Builds

### Is it possible to have two build jobs running against a single dataset at the same time?

No, you can only have one open transaction on a dataset at any given time; one job will queue behind the other.

*Timestamp:* April 10, 2024
