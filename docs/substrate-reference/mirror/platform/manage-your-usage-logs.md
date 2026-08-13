<!-- source: https://supabase.com/docs/guides/platform/manage-your-usage/logs · mirrored 2026-08-13 from Supabase docs -->

# Manage Logs usage

Caution: Logs pricing is being rolled out. Pricing details and included quotas on this page are subject to change. This page will be updated when billing enforcement goes live.

Logs usage is metered on two SKUs:

- **Logs Ingest** — the total GB of log data Supabase ingests across all your project's services (Postgres, API gateway, Auth, Storage, Realtime, Edge Functions, etc.) during the billing cycle.
- **Logs Query** — the total GB of log data scanned when you read logs via the Studio UI, the Management API, the CLI, or any other interface.

Each plan includes a free quota for both. Usage beyond the quota is billed per GB. Pricing details and quotas will be published on the per-SKU pages below when billing enforcement goes live.

For optimization tips and billing details, see the per-SKU pages:

- [Manage Logs Ingest usage](https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest)
- [Manage Logs Query usage](https://supabase.com/docs/guides/platform/manage-your-usage/logs-query)

## Logs vs log drains

[Log Drains](https://supabase.com/docs/guides/platform/manage-your-usage/log-drains) stream logs out of Supabase to external destinations (Datadog, Better Stack, your own S3 bucket, etc.) and are billed separately on drain hours and events. Draining logs does not replace or reduce Logs Ingest charges — ingest is metered when Supabase processes your logs, drains are metered when Supabase streams them out. These are separate billing primitives, not overlapping charges.
