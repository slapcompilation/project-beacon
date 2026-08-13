<!-- source: https://supabase.com/docs/guides/platform/mfa/org-mfa-enforcement · mirrored 2026-08-13 from Supabase docs -->

# Enforce MFA on Organization

All users in an organization must have a valid MFA session to interact with organization resources

Supabase provides multi-factor authentication (MFA) enforcement on the organization level. With MFA enforcement, you can ensure that all organization members use MFA. Members cannot interact with your organization or your organization's projects without a valid MFA-backed session.

Note: MFA enforcement is only available on the [Pro, Team and Enterprise plans](https://supabase.com/pricing).

## Manage MFA enforcement

To enable MFA on an organization, visit the [security settings](https://supabase.com/dashboard/org/_/security) page and toggle `Require MFA to access organization` on.

- Only organization **owners** can modify this setting
- The owner must have [MFA on their own account](https://supabase.com/docs/guides/platform/multi-factor-authentication)
- Supabase recommends creating two distinct MFA apps on your user account

Caution: When MFA enforcement is enabled, users without MFA will immediately lose access all resources in the organization. The users will still be members of the organization and will regain their original permissions once they enable MFA on their account.

## Personal access tokens

Personal access tokens are not affected by MFA enforcement. Personal access tokens are designed for programmatic access and issuing of these require a valid Supabase session backed by MFA, if enabled on the account.
