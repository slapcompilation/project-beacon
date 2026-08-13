<!-- source: https://supabase.com/docs/guides/platform/manage-your-usage/advanced-mfa-phone · mirrored 2026-08-13 from Supabase docs -->

# Manage Advanced MFA Phone usage

## What you are charged for

You are charged for having the feature [Advanced Multi-Factor Authentication Phone](https://supabase.com/docs/guides/auth/auth-mfa/phone) enabled for your project.

Note: The Advanced MFA Phone add-on is **not** covered by the [Spend Cap](https://supabase.com/docs/guides/platform/cost-control#spend-cap).

Note: Additional charges apply for each SMS or WhatsApp message sent, depending on your third-party messaging provider (such as Twilio or MessageBird).

## How charges are calculated

MFA Phone is charged by the hour, meaning you are charged for the exact number of hours that the feature is enabled for a project. If the feature is enabled for part of an hour, you are still charged for the full hour.

### Example

Your billing cycle runs from January 1 to January 31. On January 10 at 4:30 PM, you enable the MFA Phone feature for your project. At the end of the billing cycle you are billed for 512 hours.

| Time Window                                 | MFA Phone | Hours Billed | Description         |
| ------------------------------------------- | --------- | ------------ | ------------------- |
| January 1, 00:00 AM - January 10, 4:00 PM   | Disabled  | 0            |                     |
| January 10, 04:00 PM - January 10, 4:30 PM  | Disabled  | 0            |                     |
| January 10, 04:30 PM - January 10, 5:00 PM  | Enabled   | 1            | full hour is billed |
| January 10, 05:00 PM - January 31, 23:59 PM | Enabled   | 511          |                     |

### Usage on your invoice

Usage is shown as "Auth MFA Phone Hours" on your invoice.

## Pricing

## Pricing

$0.1027 per hour ($75 per month) for the first project. $0.0137 per hour ($10 per month) for every additional project.

| Plan       | Project 1 per month | Project 2 per month | Project 3 per month |
| ---------- | ------------------- | ------------------- | ------------------- |
| Pro        | $75                 | $10                 | $10                 |
| Team       | $75                 | $10                 | $10                 |
| Enterprise | Custom              | Custom              | Custom              |

For a detailed breakdown of how charges are calculated, refer to [Manage Advanced MFA Phone usage](https://supabase.com/docs/guides/platform/manage-your-usage/advanced-mfa-phone).

## Billing examples

### One project

The project has MFA Phone activated throughout the entire billing cycle.

| Line Item                     | Hours | Costs    |
| ----------------------------- | ----- | -------- |
| Pro Plan                      | -     | $25      |
| Compute Hours Small Project 1 | 730   | $15      |
| MFA Phone Hours               | 730   | $75      |
| **Subtotal**                  |       | **$115** |
| Compute Credits               |       | -$10     |
| **Total**                     |       | **$105** |

### Multiple projects

All projects have MFA Phone activated throughout the entire billing cycle.

| Line Item                     | Hours | Costs    |
| ----------------------------- | ----- | -------- |
| Pro Plan                      | -     | $25      |
|                               |       |          |
| Compute Hours Small Project 1 | 730   | $15      |
| MFA Phone Hours Project 1     | 730   | $75      |
|                               |       |          |
| Compute Hours Small Project 2 | 730   | $15      |
| MFA Phone Hours Project 2     | 730   | $10      |
|                               |       |          |
| Compute Hours Small Project 3 | 730   | $15      |
| MFA Phone Hours Project 3     | 730   | $10      |
|                               |       |          |
| **Subtotal**                  |       | **$165** |
| Compute Credits               |       | -$10     |
| **Total**                     |       | **$155** |

### Add-on disabled after a day

Project add-ons are billed in arrears based on how many hours you used them.
If you remove the MFA Phone add-on, you are no longer billed from the time of removal onward.

| Line Item                     | Hours | Costs      |
| ----------------------------- | ----- | ---------- |
| Pro Plan                      | -     | $25        |
|                               |       |            |
| Compute Hours Small Project 1 | 730   | $15        |
| MFA Phone Hours Project 1     | 24    | $2.46      |
|                               |       |            |
| **Subtotal**                  |       | **$42.46** |
| Compute Credits               |       | -$10       |
| **Total**                     |       | **$32.46** |
