<!-- source: https://supabase.com/docs/guides/security/platform-audit-logs · mirrored 2026-08-13 from Supabase docs -->

# Platform Audit Logs

Monitor and track organization member activities via platform API or dashboard.

This topic covers how to view and stream Platform Audit Logs for your organization.

Any [Platform API](https://supabase.com/docs/reference/api/introduction) or [dashboard](https://supabase.com/dashboard) actions performed by organization members are logged automatically for auditing and security purposes. This includes actions such as creating a new project, inviting members, modifying an edge function or changing project settings. You can view these logs in the dashboard or stream them to an external destination using [Audit Log Drains](#accessing-audit-log-drains).

Besides Platform Audit Logs, Supabase Auth also provides [Auth Audit Logs](https://supabase.com/docs/guides/auth/audit-logs) to monitor authentication-related activities within your projects.

Note: Platform Audit Logs are only available on the [Team and Enterprise plans](https://supabase.com/pricing).

## Accessing audit logs

Platform Audit Logs can be found under your [organization's audit logs](https://supabase.com/dashboard/org/_/audit).

![Platform audit logs](https://supabase.com/docs/img/guides/security/platform-audit-logs--dark.png)

For each audit log, you can see additional details by clicking on the log entry:

- Timestamp of action
- Actor who performed the action
  - IP address
  - Email
  - Token Type
- Action performed
  - Name
  - Metadata such as route and response status
- Action Target (Project, organization, Edge Function, ...)

Each Supabase user account also has access to [Account Audit logs](https://supabase.com/dashboard/account/audit) which displays these logs for only the associated user account.

## Accessing Audit Log Drains

Audit Log Drains can be configured under your [organization's audit log drains](https://supabase.com/dashboard/org/_/audit-log-drains). For setup instructions and supported destinations, see the [Log Drains guide](https://supabase.com/docs/guides/monitoring-and-debugging/log-drains).

## Limitations

- There is currently no way to export the logs via dashboard
- Retention periods depend on your plan
