<!-- source: https://supabase.com/docs/guides/platform/manage-your-usage/disk-size · mirrored 2026-08-13 from Supabase docs -->

# Manage Disk size usage

## What you are charged for

Each database has a dedicated [disk](https://supabase.com/docs/guides/platform/compute-and-disk#disk). You are charged for the provisioned disk size.

Note: Disk size is not relevant for the Free Plan. Instead Free Plan customers are limited by [Database size](https://supabase.com/docs/guides/platform/database-size).

## How charges are calculated

Disk size is charged by Gigabyte-Hours (GB-Hrs). 1 GB-Hr represents 1 GB being provisioned for 1 hour.
For example, having 10 GB provisioned for 5 hours results in 50 GB-Hrs (10 GB × 5 hours).

### Usage on your invoice

Usage is shown as "Disk Size GB-Hrs" on your invoice.

## Pricing

Pricing depends on the [disk type](https://supabase.com/docs/guides/platform/compute-and-disk#disk-types), with gp3 being the default disk type.

### General purpose disks (gp3)

$0.000171 per GB-Hr ($0.125 per GB per month). The primary
database of your project gets provisioned with an 8 GB disk. You are only charged for provisioned
disk size exceeding these 8 GB.

| Plan       | Included Disk Size | Over-Usage per GB per month | Over-Usage per GB-Hr |
| ---------- | ------------------ | --------------------------- | -------------------- |
| Pro        | 8 GB               | $0.125                      | $0.000171            |
| Team       | 8 GB               | $0.125                      | $0.000171            |
| Enterprise | Custom             | Custom                      | Custom               |

Note: Launching a Read Replica creates an additional database with its own dedicated disk. You are charged from the first byte of provisioned disk for the Read Replica. Refer to [Manage Read Replica usage](https://supabase.com/docs/guides/platform/manage-your-usage/read-replicas) for details on billing.

### High performance disks (io2)

$0.000267 per GB-Hr ($0.195 per GB per month). Unlike general
purpose disks, high performance disks are billed from the first byte of provisioned disk.

| Plan       | Included Disk size | Usage per GB per month | Usage per GB-Hr |
| ---------- | ------------------ | ---------------------- | --------------- |
| Pro        | 0 GB               | $0.195                 | $0.000267       |
| Team       | 0 GB               | $0.195                 | $0.000267       |
| Enterprise | Custom             | Custom                 | Custom          |

## Billing examples

### Gp3

Project 1 and 2 don't exceed the included disk size, so no charges for Disk size apply. Project 3 exceeds the included disk size by 42 GB, incurring charges for this additional usage.

| Line Item                     | Units     | Costs      |
| ----------------------------- | --------- | ---------- |
| Pro Plan                      | 1         | $25        |
|                               |           |            |
| Compute Hours Small Project 1 | 730 hours | $15        |
| Disk Size Project 1           | 8 GB      | $0         |
|                               |           |            |
| Compute Hours Small Project 2 | 730 hours | $15        |
| Disk Size Project 2           | 8 GB      | $0         |
|                               |           |            |
| Compute Hours Small Project 3 | 730 hours | $15        |
| Disk Size Project 3           | 50 GB     | $5.24      |
|                               |           |            |
| **Subtotal**                  |           | **$75.24** |
| Compute Credits               |           | -$10       |
| **Total**                     |           | **$65.24** |

### Io2

This disk type is billed from the first byte of provisioned disk, meaning for 66 GB across all projects.

| Line Item                     | Units     | Costs      |
| ----------------------------- | --------- | ---------- |
| Pro Plan                      | 1         | $25        |
|                               |           |            |
| Compute Hours Small Project 1 | 730 hours | $15        |
| Disk Size Project 1           | 8 GB      | $1.56      |
|                               |           |            |
| Compute Hours Small Project 2 | 730 hours | $15        |
| Disk Size Project 2           | 8 GB      | $1.56      |
|                               |           |            |
| Compute Hours Small Project 3 | 730 hours | $15        |
| Disk Size Project 3           | 50 GB     | $9.75      |
|                               |           |            |
| **Subtotal**                  |           | **$82.87** |
| Compute Credits               |           | -$10       |
| **Total**                     |           | **$72.87** |

## View usage

You can view Disk size usage on the [organization's usage page](https://supabase.com/dashboard/org/_/usage). The page shows the usage of all projects by default. To view the usage for a specific project, select it from the dropdown.

![Usage page navigation bar](https://supabase.com/docs/img/guides/platform/usage-navbar--dark.png)

In the Disk size section, you can see how much disk size your projects have provisioned.

![Usage page Disk Size section](https://supabase.com/docs/img/guides/platform/usage-disk-size--dark.png)

### Disk size distribution

To see how your disk usage is distributed across Database, WAL, and System categories, refer to [Disk size distribution](https://supabase.com/docs/guides/platform/database-size#disk-size-distribution).

## Reduce Disk size

To see how you can downsize your disk, refer to [Reducing disk size](https://supabase.com/docs/guides/platform/database-size#reducing-disk-size)

## Exceeding Quotas

If you are on a paid plan and have [Spend Cap](https://supabase.com/docs/guides/platform/cost-control#spend-cap) disabled or your organization is on Team Plan or above, you will pay for any overages.

When you are exceeding your quotas while being on a Free Plan or having [Spend Cap](https://supabase.com/docs/guides/platform/cost-control#spend-cap) enabled, you will get a notification to your billing email address and put under a grace period. For more details, refer to our [Fair Use Policy](https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy).
