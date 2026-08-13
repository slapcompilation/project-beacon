<!-- source: https://supabase.com/docs/guides/platform/access-control · mirrored 2026-08-13 from Supabase docs -->

# Access Control

Roles and permissions at the organization and project levels

Supabase provides granular access controls to manage permissions across your organizations and projects.

For each organization and project, a member can have one of the following roles:

- **Owner**: full access to everything in organization and project resources.
- **Administrator**: full access to everything in organization and project resources **except** updating organization settings, transferring projects outside of the organization, and adding new owners.
- **Developer**: read-only access to organization resources and content access to project resources but cannot change any project settings.
- **Read-Only**: read-only access to organization and project resources.

Note: Read-Only role is only available on the [Team and Enterprise plans](https://supabase.com/pricing).

When you first create an account, a default organization is created for you and you'll be assigned as the **Owner**. Any organizations you create will assign you as **Owner** as well.

## Manage organization members

To invite others to collaborate, visit your organization's team [settings](https://supabase.com/dashboard/org/_/team) to send an invite link to another user's email. The invite is valid for 24 hours. For project scoped roles, you may only assign a role to a single project for the user when sending the invite. You can assign roles to multiple projects after the user accepts the invite.

Note: Invites sent from a SAML SSO account can only be accepted by another SAML SSO account from the same identity provider.

This is a security measure to prevent accidental invites to accounts not managed by your enterprise's identity provider.

### Viewing organization members using the Management API

You can also view organization members using the Management API:

```bash
# Get your access token from https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN="your-access-token"
export ORG_ID="your-organization-id"

# List organization members
curl "https://api.supabase.com/v1/organizations/$ORG_ID/members" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

### Transferring ownership of an organization

Each Supabase organization must have at least one owner. If your organization has other owners then you can relinquish ownership and leave the organization by clicking **Leave team** in your organization's team [settings](https://supabase.com/dashboard/org/_/team).

Otherwise, you'll need to invite a user as **Owner**, and they need to accept the invitation, or promote an existing organization member to **Owner** before you can leave the organization.

### Organization scoped roles vs project scoped roles

Note: Project scoped roles are only available on the [Team and Enterprise plans](https://supabase.com/pricing).

Each member in the organization can be assigned a role that is scoped either to the entire organization or to specific projects.

- If a member has an organization-level role, they will have the corresponding permissions across all current and future projects within that organization.
- If a member is assigned a project-scoped role, they will only have access to the specific projects they've been assigned to. They will not be able to view, access, or even see other projects within the organization on the Supabase Dashboard.

This allows for more granular control, ensuring that users only have visibility and access to the projects relevant to their role.

### Organization permissions across roles

The table below shows the actions each role can take on the resources belonging to the organization.

| Resource                           | Action     | Owner | Administrator | Developer | Read-Only[^1] |
| ---------------------------------- | ---------- | :---: | :-----------: | :-------: | :-----------: |
| **Organization**                   |            |       |               |           |               |
| Organization Management            | Update     |   ✅   |       ❌       |     ❌     |       ❌       |
|                                    | Delete     |   ✅   |       ❌       |     ❌     |       ❌       |
| OpenAI Telemetry Configuration[^2] | Update     |   ✅   |       ❌       |     ❌     |       ❌       |
| **Members**                        |            |       |               |           |               |
| Organization Members               | List       |   ✅   |       ✅       |     ✅     |       ✅       |
| Owner                              | Add        |   ✅   |       ❌       |     ❌     |       ❌       |
|                                    | Remove     |   ✅   |       ❌       |     ❌     |       ❌       |
| Administrator                      | Add        |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | Remove     |   ✅   |       ✅       |     ❌     |       ❌       |
| Developer                          | Add        |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | Remove     |   ✅   |       ✅       |     ❌     |       ❌       |
| Owner (Project-Scoped)             | Add        |   ✅   |       ❌       |     ❌     |       ❌       |
|                                    | Remove     |   ✅   |       ❌       |     ❌     |       ❌       |
| Administrator (Project-Scoped)     | Add        |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | Remove     |   ✅   |       ✅       |     ❌     |       ❌       |
| Developer (Project-Scoped)         | Add        |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | Remove     |   ✅   |       ✅       |     ❌     |       ❌       |
| Invite                             | Revoke     |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | Resend     |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | Accept[^3] |   ✅   |       ✅       |     ✅     |       ✅       |
| **Billing**                        |            |       |               |           |               |
| Invoices                           | List       |   ✅   |       ✅       |     ✅     |       ✅       |
| Billing Email                      | View       |   ✅   |       ✅       |     ✅     |       ✅       |
|                                    | Update     |   ✅   |       ✅       |     ❌     |       ❌       |
| Subscription                       | View       |   ✅   |       ✅       |     ✅     |       ✅       |
|                                    | Update     |   ✅   |       ✅       |     ❌     |       ❌       |
| Billing Address                    | View       |   ✅   |       ✅       |     ✅     |       ✅       |
|                                    | Update     |   ✅   |       ✅       |     ❌     |       ❌       |
| Tax Codes                          | View       |   ✅   |       ✅       |     ✅     |       ✅       |
|                                    | Update     |   ✅   |       ✅       |     ❌     |       ❌       |
| Payment Methods                    | View       |   ✅   |       ✅       |     ✅     |       ✅       |
|                                    | Update     |   ✅   |       ✅       |     ❌     |       ❌       |
| Usage                              | View       |   ✅   |       ✅       |     ✅     |       ✅       |
| **Integrations (Org Settings)**    |            |       |               |           |               |
| Authorize GitHub                   | -          |   ✅   |       ✅       |     ❌     |       ❌       |
| Add GitHub Repositories            | -          |   ✅   |       ✅       |     ❌     |       ❌       |
| GitHub Connections                 | Create     |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | Update     |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | Delete     |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | View       |   ✅   |       ✅       |     ✅     |       ✅       |
| Vercel Connections                 | Create     |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | Update     |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | Delete     |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | View       |   ✅   |       ✅       |     ✅     |       ✅       |
| **OAuth Apps**                     |            |       |               |           |               |
| OAuth Apps                         | Create     |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | Update     |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | Delete     |   ✅   |       ✅       |     ❌     |       ❌       |
|                                    | List       |   ✅   |       ✅       |     ✅     |       ✅       |
| **Audit Logs**                     |            |       |               |           |               |
| View Audit logs                    | -          |   ✅   |       ✅       |     ✅     |       ✅       |
| **Legal Documents**                |            |       |               |           |               |
| SOC2 Type 2 Report                 | Download   |   ✅   |       ✅       |     ✅     |       ✅       |
| Security Questionnaire             | Download   |   ✅   |       ✅       |     ✅     |       ✅       |

### Project permissions across roles

The table below shows the actions each role can take on the resources belonging to the project.

| Resource                         | Action                 | Owner | Admin | Developer | Read-Only[^4][^6] |
| -------------------------------- | ---------------------- | :---: | :---: | :-------: | :---------------: |
| **Project**                      |                        |       |       |           |                   |
| Project Management               | Transfer               |   ✅   |   ❌   |     ❌     |         ❌         |
|                                  | Create                 |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | Delete                 |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | Update (Name)          |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | Pause                  |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | Restore                |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | Restart                |   ✅   |   ✅   |     ✅     |         ❌         |
| Custom Domains                   | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
| Data (Database)                  | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Manage                 |   ✅   |   ✅   |     ✅     |         ❌         |
| **Infrastructure**               |                        |       |       |           |                   |
| Read Replicas                    | List                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Create                 |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | Delete                 |   ✅   |   ✅   |     ❌     |         ❌         |
| Add-ons                          | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
| **Integrations**                 |                        |       |       |           |                   |
| Authorize GitHub                 | -                      |   ✅   |   ✅   |     ✅     |         ✅         |
| Add GitHub Repositories          | -                      |   ✅   |   ✅   |     ✅     |         ✅         |
| GitHub Connections               | Create                 |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | Delete                 |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
| Vercel Connections               | Create                 |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | Delete                 |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
| **Database Configuration**       |                        |       |       |           |                   |
| Reset Password                   | -                      |   ✅   |   ✅   |     ❌     |         ❌         |
| Pooling Settings                 | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
| SSL Configuration                | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
| Disk Size Configuration          | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
| Network Restrictions             | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Create                 |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | Delete                 |   ✅   |   ✅   |     ❌     |         ❌         |
| Network Bans                     | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Unban                  |   ✅   |   ✅   |     ❌     |         ❌         |
| **API Configuration**            |                        |       |       |           |                   |
| API Keys                         | Read service key       |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Read anon key          |   ✅   |   ✅   |     ✅     |         ❌         |
| JWT Secret                       | View                   |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Generate new           |   ✅   |   ✅   |     ❌     |         ❌         |
| API settings                     | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
| **Auth Configuration**           |                        |       |       |           |                   |
| Auth Settings                    | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
| SMTP Settings                    | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
| Advanced Settings                | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
| **Storage Configuration**        |                        |       |       |           |                   |
| Upload Limit                     | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
| S3 Access Keys                   | View                   |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Create                 |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | Delete                 |   ✅   |   ✅   |     ❌     |         ❌         |
| **Edge Functions Configuration** |                        |       |       |           |                   |
| Secrets                          | View                   |   ✅   |   ✅   |     ✅     |       ✅ [^5]      |
|                                  | Create                 |   ✅   |   ✅   |     ❌     |         ❌         |
|                                  | Delete                 |   ✅   |   ✅   |     ❌     |         ❌         |
| **SQL Editor**                   |                        |       |       |           |                   |
| Queries                          | Create                 |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Delete                 |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | List                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Run                    |   ✅   |   ✅   |     ✅     |       ✅ [^7]      |
| **Database**                     |                        |       |       |           |                   |
| Scheduled Backups                | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Download               |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Restore                |   ✅   |   ✅   |     ✅     |         ❌         |
| Physical backups (PITR)          | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Restore                |   ✅   |   ✅   |     ✅     |         ❌         |
| **Authentication**               |                        |       |       |           |                   |
| Users                            | Create                 |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Delete                 |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | List                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Send OTP               |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Send password recovery |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Send magic link        |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Remove MFA factors     |   ✅   |   ✅   |     ✅     |         ❌         |
| Providers                        | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
| Rate Limits                      | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
| Email Templates                  | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
| URL Configuration                | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ❌     |         ❌         |
| Hooks                            | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Create                 |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Delete                 |   ✅   |   ✅   |     ✅     |         ❌         |
| **Storage**                      |                        |       |       |           |                   |
| Buckets                          | Create                 |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Update                 |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Delete                 |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | List                   |   ✅   |   ✅   |     ✅     |         ✅         |
| Files                            | Create (Upload)        |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Update                 |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Delete                 |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | List                   |   ✅   |   ✅   |     ✅     |         ✅         |
| **Edge Functions**               |                        |       |       |           |                   |
| Edge Functions                   | Update                 |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Delete                 |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | List                   |   ✅   |   ✅   |     ✅     |         ✅         |
| **Reports**                      |                        |       |       |           |                   |
| Custom Report                    | Create                 |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Update                 |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Delete                 |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | List                   |   ✅   |   ✅   |     ✅     |         ✅         |
| **Logs & Analytics**             |                        |       |       |           |                   |
| Queries                          | Create                 |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Update                 |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Delete                 |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | View                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | List                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Run                    |   ✅   |   ✅   |     ✅     |         ✅         |
| **Branching**                    |                        |       |       |           |                   |
| Production Branch                | Read                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Write                  |   ✅   |   ✅   |     ✅     |         ❌         |
| Development Branches             | List                   |   ✅   |   ✅   |     ✅     |         ✅         |
|                                  | Create[^8]             |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Update                 |   ✅   |   ✅   |     ✅     |         ❌         |
|                                  | Delete                 |   ✅   |   ✅   |     ✅     |         ❌         |

[^1]: Available on the Team and Enterprise Plans.

[^2]: Sending anonymous data to OpenAI is opt in and can improve Studio AI Assistant's responses.

[^3]: Invites sent from a SSO account can only be accepted by another SSO account coming from the same identity provider. This is a security measure that prevents accidental invites to accounts not managed by your company's enterprise systems.

[^4]: Available on the Team and Enterprise Plans.

[^5]: Read-Only role is able to access secrets.

[^6]: Listed permissions are for the API and Dashboard.

[^7]: Limited to executing SELECT queries. SQL Query Snippets run by the Read-Only role are run against the database using the **supabase\_read\_only\_user**. This role has the [predefined Postgres role pg\_read\_all\_data](https://www.postgresql.org/docs/current/predefined-roles.html).

[^8]: When using dashboard branching without a GitHub integration, the first branch creation also registers the project's production branch — a one-time step that requires Owner or Administrator. See [Branching via the dashboard](https://supabase.com/docs/guides/deployment/branching/dashboard) for details. Developers can create, update, and delete branches normally after that.
