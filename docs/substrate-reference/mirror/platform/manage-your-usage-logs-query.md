<!-- source: https://supabase.com/docs/guides/platform/manage-your-usage/logs-query · mirrored 2026-08-13 from Supabase docs -->

# Manage Logs Query usage

Caution: Logs pricing is being rolled out. Pricing details and included quotas on this page are subject to change. This page will be updated when billing enforcement goes live.

## What you are charged for

You are charged for the volume of log data scanned when you read logs via the Studio UI, the Management API, the CLI, or any other interface, measured in GB.

## How charges are calculated

Logs Query is charged per GB of log data scanned during the billing cycle.

### Usage on your invoice

Usage is shown as "Logs Query" on your invoice.

## Pricing

Pricing details and included quotas will be published here when billing enforcement goes live.

## Billing examples

Billing examples will be published here when pricing is finalized.

## View usage

You can view Logs Query usage on the [organization's usage page](https://supabase.com/dashboard/org/_/usage) of the Dashboard. The page shows the usage of all projects by default. To view the usage for a specific project, select it from the dropdown. You can also select a different time period.

## Optimize usage

Logs Query usage scales directly with the time range and data volume you scan. Keep usage low by:

- **Using the Logs Explorer** in the [Dashboard](https://supabase.com/dashboard/project/_/logs-explorer) for ad-hoc queries — it surfaces the most relevant log data without over-scanning.
- **Keeping time ranges narrow.** A 1-day window scans 7× less data than a 7-day window.
- **Applying service and endpoint filters early** to reduce the volume scanned per query.
- **Avoiding frequent programmatic polling.** Repeated API or CLI log queries accumulate GB rapidly. For continuous log streaming, [Log Drains](https://supabase.com/docs/guides/platform/manage-your-usage/log-drains) are more cost-effective.

## Exceeding Quotas

If you are on a paid plan and have [Spend Cap](https://supabase.com/docs/guides/platform/cost-control#spend-cap) disabled or your organization is on Team Plan or above, you will pay for any overages.

When you are exceeding your quotas while being on a Free Plan or having [Spend Cap](https://supabase.com/docs/guides/platform/cost-control#spend-cap) enabled, you will get a notification to your billing email address and put under a grace period. For more details, refer to our [Fair Use Policy](https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy).
