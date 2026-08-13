<!-- source: https://supabase.com/docs/guides/platform/cost-control · mirrored 2026-08-13 from Supabase docs -->

# Control your costs

## Spend Cap

The Spend Cap determines whether your organization can exceed your subscription plan's quota for any usage item. Scenarios that could lead to high usage—and thus high costs—include system attacks or bugs in your software. The Spend Cap can protect you from these unexpected costs for certain usage items.

This feature is available only with the Pro Plan. However, you will not be charged while using the Free Plan.

### What happens when the Spend Cap is on?

After exceeding the quota for a usage item, further usage of that item is disallowed until the next billing cycle. You don't get charged for over-usage but your services will be restricted according to our [Fair Use Policy](https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy) if you consistently exceed the quota.

Note: Note that only certain usage items are covered by the Spend Cap.

### What happens when the Spend Cap is off?

Your projects will continue to operate after exceeding the quota for a usage item. Any additional usage will be charged based on the item's cost per unit, as outlined on the [pricing page](https://supabase.com/pricing).

Note: When the Spend Cap is off, we recommend monitoring your usage and costs on the [organization's usage page](https://supabase.com/dashboard/org/_/usage).

### Usage items covered by the Spend Cap

- [Disk Size](https://supabase.com/docs/guides/platform/manage-your-usage/disk-size)
- [Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)
- [Edge Function Invocations](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations)
- [Logs Ingest](https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest)
- [Logs Query](https://supabase.com/docs/guides/platform/manage-your-usage/logs-query)
- [Monthly Active Users](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users)
- [Monthly Active SSO Users](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users-sso)
- [Monthly Active Third Party Users](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users-third-party)
- [Realtime Messages](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages)
- [Realtime Peak Connections](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-peak-connections)
- [Storage Image Transformations](https://supabase.com/docs/guides/platform/manage-your-usage/storage-image-transformations)
- [Storage Size](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size)

### Usage items not covered by the Spend Cap

Usage items that are predictable and explicitly opted into by the user are excluded.

- [Compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute)
- [Branching Compute](https://supabase.com/docs/guides/platform/manage-your-usage/branching)
- [Read Replica Compute](https://supabase.com/docs/guides/platform/manage-your-usage/read-replicas)
- [Custom Domain](https://supabase.com/docs/guides/platform/manage-your-usage/custom-domains)
- Additionally provisioned [Disk IOPS](https://supabase.com/docs/guides/platform/manage-your-usage/disk-iops)
- Additionally provisioned [Disk Throughput](https://supabase.com/docs/guides/platform/manage-your-usage/disk-throughput)
- [IPv4 address](https://supabase.com/docs/guides/platform/manage-your-usage/ipv4)
- [Log Drain Hours](https://supabase.com/docs/guides/platform/manage-your-usage/log-drains#log-drain-hours)
- [Log Drain Events](https://supabase.com/docs/guides/platform/manage-your-usage/log-drains#log-drain-events)
- [Multi-Factor Authentication Phone](https://supabase.com/docs/guides/platform/manage-your-usage/advanced-mfa-phone)
- [Point-in-Time-Recovery](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery)

### What the Spend Cap is not

The Spend Cap doesn't allow for fine-grained cost control, such as setting budgets for specific usage item or receiving notifications when certain costs are reached. We plan to make cost control more flexible in the future.

### Configure the Spend Cap

You can configure the Spend Cap when creating an organization on the Pro Plan or at any time in the Cost Control section of the [organization's billing page](https://supabase.com/dashboard/org/_/billing).

## Keep track of your usage and costs

You can monitor your usage on the [organization's usage page](https://supabase.com/dashboard/org/_/usage). The Upcoming Invoice section of the [organization's billing page](https://supabase.com/dashboard/org/_/billing) shows your current spending and provides an estimate of your total costs for the billing cycle based on your usage.
