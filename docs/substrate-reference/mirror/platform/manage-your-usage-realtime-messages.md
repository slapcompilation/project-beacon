<!-- source: https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages · mirrored 2026-08-13 from Supabase docs -->

# Manage Realtime Messages usage

## What you are charged for

You are charged for the number of messages going through Supabase Realtime throughout the billing cycle. Includes database changes, Broadcast and Presence.

**Database changes**
Each database change counts as one message per client that listens to the event. For example, if a database change occurs and 5 clients listen to that database event, it counts as 5 messages.

**Broadcast**
Each broadcast message counts as one message sent plus one message per subscribed client that receives it. For example, if you broadcast a message and 4 clients listen to it, it counts as 5 messages—1 sent and 4 received.

## How charges are calculated

Realtime Messages are billed using Package pricing, with each package representing 1 million messages. If your usage falls between two packages, you are billed for the next whole package.

### Example

For simplicity, assume a package size of 1,000,000 and a charge of $2.50 per package without quota.

| Messages  | Packages Billed | Costs |
| --------- | --------------- | ----- |
| 999,999   | 1               | $2.50 |
| 1,000,000 | 1               | $2.50 |
| 1,000,001 | 2               | $5.00 |
| 1,500,000 | 2               | $5.00 |

### Usage on your invoice

Usage is shown as "Realtime Messages" on your invoice.

## Pricing

$2.50 per 1 million messages. You are only charged for usage exceeding your
subscription plan's quota.

| Plan       | Quota     | Over-Usage                   |
| ---------- | --------- | ---------------------------- |
| Free       | 2 million | -                            |
| Pro        | 5 million | $2.50 per 1 million messages |
| Team       | 5 million | $2.50 per 1 million messages |
| Enterprise | Custom    | Custom                       |

## Billing examples

### Within quota

The organization's Realtime messages are within the quota, so no charges apply.

| Line Item           | Units                | Costs   |
| ------------------- | -------------------- | ------- |
| Pro Plan            | 1                    | $25     |
| Compute Hours Small | 730 hours            | $15     |
| Realtime Messages   | 1.8 million messages | $0      |
| **Subtotal**        |                      | **$40** |
| Compute Credits     |                      | -$10    |
| **Total**           |                      | **$30** |

### Exceeding quota

The organization's Realtime messages exceed the quota by 3.5 million, incurring charges for this additional usage.

| Line Item           | Units                | Costs   |
| ------------------- | -------------------- | ------- |
| Pro Plan            | 1                    | $25     |
| Compute Hours Small | 730 hours            | $15     |
| Realtime Messages   | 8.5 million messages | $10     |
| **Subtotal**        |                      | **$50** |
| Compute Credits     |                      | -$10    |
| **Total**           |                      | **$40** |

## View usage

You can view Realtime Messages usage on the [organization's usage page](https://supabase.com/dashboard/org/_/usage). The page shows the usage of all projects by default. To view the usage for a specific project, select it from the dropdown. You can also select a different time period.

![Usage page navigation bar](https://supabase.com/docs/img/guides/platform/usage-navbar--dark.png)

In the Realtime Messages section, you can see the usage for the selected time period.

![Usage page Realtime Messages section](https://supabase.com/docs/img/guides/platform/usage-realtime-messages--dark.png)

## Exceeding Quotas

If you are on a paid plan and have [Spend Cap](https://supabase.com/docs/guides/platform/cost-control#spend-cap) disabled or your organization is on Team Plan or above, you will pay for any overages.

When you are exceeding your quotas while being on a Free Plan or having [Spend Cap](https://supabase.com/docs/guides/platform/cost-control#spend-cap) enabled, you will get a notification to your billing email address and put under a grace period. For more details, refer to our [Fair Use Policy](https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy).
