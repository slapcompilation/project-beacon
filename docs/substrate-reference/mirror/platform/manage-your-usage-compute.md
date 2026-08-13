<!-- source: https://supabase.com/docs/guides/platform/manage-your-usage/compute · mirrored 2026-08-13 from Supabase docs -->

# Manage Compute usage

## What you are charged for

Each project on the Supabase platform includes a dedicated Postgres instance running on its own server. You are charged for the [Compute](https://supabase.com/docs/guides/platform/compute-and-disk#compute) resources of that server, independent of your database usage.

Note: Paused projects do not count towards Compute usage. Compute Hours are **not** covered by the [Spend Cap](https://supabase.com/docs/guides/platform/cost-control#spend-cap).

## How charges are calculated

Compute is charged by the hour, meaning you are charged for the exact number of hours that a project is running and, therefore, incurring Compute usage. If a project runs for part of an hour, you are still charged for the full hour.

Caution: Each project you launch increases your monthly Compute costs.

### Example

Your billing cycle runs from January 1 to January 31. On January 10 at 4:30 PM, you switch your project from the Micro Compute size to the Small Compute size. At the end of the billing cycle you are billed for 233 hours of Micro Compute size and 512 hours of Small Compute size.

| Time Window                                 | Compute Size | Hours Billed | Description         |
| ------------------------------------------- | ------------ | ------------ | ------------------- |
| January 1, 00:00 AM - January 10, 4:00 PM   | Micro        | 232          |                     |
| January 10, 04:00 PM - January 10, 4:30 PM  | Micro        | 1            | full hour is billed |
| January 10, 04:30 PM - January 10, 5:00 PM  | Small        | 1            | full hour is billed |
| January 10, 05:00 PM - January 31, 23:59 PM | Small        | 511          |                     |

### Usage on your invoice

Usage is shown as "Compute Hours" on your invoice.

## Compute Credits

Paid plans include $10 in Compute Credits, which cover one project running on the Micro/Nano Compute size or portions of other Compute sizes. Compute Credits are applied to your Compute costs and are provided to an organization each month. They reset monthly and do not accumulate.

## Pricing

| Compute Size | Hourly Price USD | Monthly Price USD                                                                                                            |
| ------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Nano[^1]     | $0               | $0                                                                                                                           |
| Micro        | $0.01344         | \~$10                                                                                                                        |
| Small        | $0.0206          | \~$15                                                                                                                        |
| Medium       | $0.0822          | \~$60                                                                                                                        |
| Large        | $0.1517          | \~$111                                                                                                                       |
| XL           | $0.2877          | \~$210                                                                                                                       |
| 2XL          | $0.562           | \~$410                                                                                                                       |
| 4XL          | $1.32            | \~$960                                                                                                                       |
| 8XL          | $2.562           | \~$1,870                                                                                                                     |
| 12XL         | $3.836           | \~$2,800                                                                                                                     |
| 16XL         | $5.12            | \~$3,730                                                                                                                     |
| >16XL        | -                | [Contact Us](https://supabase.com/dashboard/support/new?category=sales\&subject=Enquiry%20about%20larger%20instance%20sizes) |

[^1]: Compute resources on the Free Plan are subject to change.

Note: In paid organizations, Nano Compute are billed at the same price as Micro Compute. It is recommended to upgrade your Project from Nano Compute to Micro Compute when it's convenient for you. Compute sizes are not auto-upgraded because of the downtime incurred. See [Supabase Pricing](https://supabase.com/pricing) for more information. You cannot launch Nano instances on paid plans, only Micro and above - but you might have Nano instances after upgrading from Free Plan.

## Billing examples

### One project

The project runs on the same Compute size throughout the entire billing cycle.

| Line Item                     | Hours | Costs   |
| ----------------------------- | ----- | ------- |
| Pro Plan                      | -     | $25     |
| Compute Hours Small Project 1 | 730   | $15     |
| **Subtotal**                  |       | **$40** |
| Compute Credits               |       | -$10    |
| **Total**                     |       | **$30** |

### Multiple projects

All projects run on the same Compute size throughout the entire billing cycle.

| Line Item                     | Hours | Costs   |
| ----------------------------- | ----- | ------- |
| Pro Plan                      | -     | $25     |
| Compute Hours Small Project 1 | 730   | $15     |
| Compute Hours Small Project 2 | 730   | $15     |
| Compute Hours Small Project 3 | 730   | $15     |
| **Subtotal**                  |       | **$70** |
| Compute Credits               |       | -$10    |
| **Total**                     |       | **$60** |

### One project on different Compute sizes

The project's Compute size changes throughout the billing cycle.

| Line Item                     | Hours | Costs      |
| ----------------------------- | ----- | ---------- |
| Pro Plan                      | -     | $25        |
| Compute Hours Micro Project 1 | 230   | $3.09      |
| Compute Hours Small Project 1 | 500   | $10.30     |
| **Subtotal**                  |       | **$38.39** |
| Compute Credits               |       | -$10       |
| **Total**                     |       | **$28.39** |

### Projects not running for full month

One project is running for the entire month, two other projects were launched and deleted within a few days.
We only bill for the hours while the project was running and billing stops once a project is deleted.
Compute is always billed in arrears when your billing cycle resets.

| Line Item                     | Hours | Costs      |
| ----------------------------- | ----- | ---------- |
| Pro Plan                      | -     | $25        |
| Compute Hours Small Project 1 | 730   | $15        |
| Compute Hours Micro Project 2 | 20    | $0.27      |
| Compute Hours Micro Project 3 | 70    | $0.94      |
| **Subtotal**                  |       | **$41.21** |
| Compute Credits               |       | -$10       |
| **Total**                     |       | **$31.21** |

## View usage

You can view Compute usage on the [organization's usage page](https://supabase.com/dashboard/org/_/usage). The page shows the usage of all projects by default. To view the usage for a specific project, select it from the dropdown. You can also select a different time period.

![Usage page navigation bar](https://supabase.com/docs/img/guides/platform/usage-navbar--dark.png)

In the Compute Hours section, you can see how many hours of a specific Compute size your projects have used during the selected time period. Hover over a specific date for a daily breakdown.

![Usage page Compute Hours section](https://supabase.com/docs/img/guides/platform/usage-compute--dark.png)

## Optimize usage

- Start out on a smaller Compute size, [create a report](https://supabase.com/dashboard/project/_/observability) on the Dashboard to monitor your CPU and memory utilization, and upgrade the Compute size as needed
- Load test your application in staging to understand your Compute requirements
- [Transfer projects](https://supabase.com/docs/guides/platform/project-transfer) to a Free Plan organization to reduce Compute usage
- Delete unused projects

## FAQ

### Do Compute Credits apply to line items other than Compute?

No, Compute Credits apply only to Compute and do not cover other line items, including Read Replica Compute and Branching Compute.
