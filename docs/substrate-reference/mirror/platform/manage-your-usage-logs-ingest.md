<!-- source: https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest · mirrored 2026-08-13 from Supabase docs -->

# Manage Logs Ingest usage

Caution: Logs pricing is being rolled out. Pricing details and included quotas on this page are subject to change. This page will be updated when billing enforcement goes live.

## What you are charged for

You are charged for the total volume of log data that Supabase ingests across all your project's services (Postgres, API gateway, Auth, Storage, Realtime, Edge Functions, etc.) during the billing cycle, measured in GB.

## How charges are calculated

Logs Ingest is charged per GB of log data ingested during the billing cycle.

### Usage on your invoice

Usage is shown as "Logs Ingest" on your invoice.

## Pricing

Pricing details and included quotas will be published here when billing enforcement goes live.

## Billing examples

Billing examples will be published here when pricing is finalized.

## View usage

You can view Logs Ingest usage on the [organization's usage page](https://supabase.com/dashboard/org/_/usage) of the Dashboard. The page shows the usage of all projects by default. To view the usage for a specific project, select it from the dropdown. You can also select a different time period.

## Optimize usage

Every service in your Supabase project automatically generates logs — you don't write them directly. Log volume scales with your application's traffic and behavior. To reduce ingest volume:

- **Configure Postgres logging settings.** Postgres emits logs for connections, checkpoints, statements, and more — many of which can be tuned or disabled. Adjusting settings such as `log_connections`, `log_min_duration_statement`, and `log_statement` can significantly reduce Postgres log volume. See [Customizing Postgres configs](https://supabase.com/docs/guides/database/custom-postgres-config) for the full list of configurable parameters.
- **Reduce log-level verbosity** in your Edge Functions and server-side code (for example, `info` → `warn` in production).
- **Audit verbose logging in your application code.** Application-level logs forwarded to Supabase services count toward ingest.
- **Cap log payload size.** Large structured payloads can inflate GB-billed volume.
- **Investigate spikes.** Use the [**Logs Explorer**](https://supabase.com/dashboard/project/_/logs-explorer) in the Dashboard to find services or endpoints producing unusually high volume.

## Exceeding Quotas

If you are on a paid plan and have [Spend Cap](https://supabase.com/docs/guides/platform/cost-control#spend-cap) disabled or your organization is on Team Plan or above, you will pay for any overages.

When you are exceeding your quotas while being on a Free Plan or having [Spend Cap](https://supabase.com/docs/guides/platform/cost-control#spend-cap) enabled, you will get a notification to your billing email address and put under a grace period. For more details, refer to our [Fair Use Policy](https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy).
