<!-- source: https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations · mirrored 2026-08-13 from Supabase docs -->

# Manage Edge Function Invocations usage

## What you are charged for

You are charged for the number of times your functions get invoked, regardless of the response status code. Preflight (OPTIONS) requests are not billed.

## How charges are calculated

Edge Function Invocations are billed using Package pricing, with each package representing 1 million invocations. If your usage falls between two packages, you are billed for the next whole package.

### Example

For simplicity, assume a package size of 1 million and a charge of $2 per package without a free quota.

| Invocations | Packages Billed | Costs |
| ----------- | --------------- | ----- |
| 999,999     | 1               | $2    |
| 1,000,000   | 1               | $2    |
| 1,000,001   | 2               | $4    |
| 1,500,000   | 2               | $4    |

### Usage on your invoice

Usage is shown as "Function Invocations" on your invoice.

## Pricing

$2 per 1 million invocations. You are only charged for usage exceeding your
subscription plan's quota.

| Plan       | Quota     | Over-Usage                   |
| ---------- | --------- | ---------------------------- |
| Free       | 500,000   | -                            |
| Pro        | 2 million | $2 per 1 million invocations |
| Team       | 2 million | $2 per 1 million invocations |
| Enterprise | Custom    | Custom                       |

## Billing examples

### Within quota

The organization's function invocations are within the quota, so no charges apply.

| Line Item            | Units                 | Costs   |
| -------------------- | --------------------- | ------- |
| Pro Plan             | 1                     | $25     |
| Compute Hours Small  | 730 hours             | $15     |
| Function Invocations | 1,800,000 invocations | $0      |
| **Subtotal**         |                       | **$40** |
| Compute Credits      |                       | -$10    |
| **Total**            |                       | **$30** |

### Exceeding quota

The organization's function invocations exceed the quota by 1.4 million, incurring charges for this additional usage.

| Line Item            | Units                 | Costs   |
| -------------------- | --------------------- | ------- |
| Pro Plan             | 1                     | $25     |
| Compute Hours Small  | 730 hours             | $15     |
| Function Invocations | 3,400,000 invocations | $4      |
| **Subtotal**         |                       | **$44** |
| Compute Credits      |                       | -$10    |
| **Total**            |                       | **$34** |

## View usage

You can view Edge Function Invocations usage on the [organization's usage page](https://supabase.com/dashboard/org/_/usage). The page shows the usage of all projects by default. To view the usage for a specific project, select it from the dropdown. You can also select a different time period.

![Usage page navigation bar](https://supabase.com/docs/img/guides/platform/usage-navbar--dark.png)

In the Edge Function Invocations section, you can see how many invocations your projects have had during the selected time period.

![Usage page Edge Function Invocations section](https://supabase.com/docs/img/guides/platform/usage-function-invocations--dark.png)

## Exceeding Quotas

If you are on a paid plan and have [Spend Cap](https://supabase.com/docs/guides/platform/cost-control#spend-cap) disabled or your organization is on Team Plan or above, you will pay for any overages.

When you are exceeding your quotas while being on a Free Plan or having [Spend Cap](https://supabase.com/docs/guides/platform/cost-control#spend-cap) enabled, you will get a notification to your billing email address and put under a grace period. For more details, refer to our [Fair Use Policy](https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy).
