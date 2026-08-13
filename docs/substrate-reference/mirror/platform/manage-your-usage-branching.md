<!-- source: https://supabase.com/docs/guides/platform/manage-your-usage/branching · mirrored 2026-08-13 from Supabase docs -->

# Manage Branching usage

## What you are charged for

Each [Preview branch](https://supabase.com/docs/guides/deployment/branching) is a separate environment with all Supabase services (Database, Auth, Storage, etc.). You're charged for usage within that environment—such as [Compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute), [Disk Size](https://supabase.com/docs/guides/platform/manage-your-usage/disk-size), [Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), and [Storage](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size)—the same as the project you branched from.

Note: Usage by Preview branches counts toward your subscription plan's quota. Branches are **not** covered by the [Spend Cap](https://supabase.com/docs/guides/platform/cost-control#spend-cap).

## How charges are calculated

Refer to individual [usage items](https://supabase.com/docs/guides/platform/manage-your-usage) for details on how charges are calculated. Branching charges are the sum of all these items.

### Usage on your invoice

Compute incurred by Preview branches is shown as "Branching Compute Hours" on your invoice. Other usage items are not shown separately for branches and are rolled up into the project.

## Pricing

There is no fixed fee for a Preview branch. You only pay for the usage it incurs. A branch running on the default Micro Compute size starts at $0.01344 per hour.

## Billing examples

The project has a Preview branch "XYZ", that runs for 30 hours, incurring Compute and Egress costs. Disk Size usage remains within the 8 GB included in the subscription plan, so no additional charges apply.

| Line Item                      | Costs     |
| ------------------------------ | --------- |
| Pro Plan                       | $25       |
|                                |           |
| Compute Hours Small Project 1  | $15       |
| Egress Project 1               | $7        |
| Disk Size Project 1            | $3        |
|                                |           |
| Compute Hours Micro Branch XYZ | $0.4      |
| Egress Branch XYZ              | $1        |
| Disk Size Branch XYZ           | $0        |
|                                |           |
| **Subtotal**                   | **$51.4** |
| Compute Credits                | -$10      |
| **Total**                      | **$41.4** |

## View usage

You can view Branching usage on the [organization's usage page](https://supabase.com/dashboard/org/_/usage). The page shows the usage of all projects by default. To view the usage for a specific project, select it from the dropdown. You can also select a different time period.

![Usage page navigation bar](https://supabase.com/docs/img/guides/platform/usage-navbar--dark.png)

In the Usage Summary section, you can see how many hours your Preview branches existed during the selected time period. Hover over "Branching Compute Hours" for a detailed breakdown.

![Usage summary Branching Compute Hours](https://supabase.com/docs/img/guides/platform/usage-summary-branch-hours--dark.png)

## Optimize usage

- Merge Preview branches as soon as they are ready
- Delete Preview branches that are no longer in use
- Check whether your [persistent branches](https://supabase.com/docs/guides/deployment/branching#persistent-branches) need to be defined as persistent, or if they can be ephemeral instead. Persistent branches will remain active even after the underlying PR is closed.

## FAQ

### Do Compute Credits apply to Branching Compute?

No, Compute Credits do not apply to Branching Compute.
