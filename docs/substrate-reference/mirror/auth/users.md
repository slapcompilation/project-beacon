<!-- source: https://supabase.com/docs/guides/auth/users · mirrored 2026-08-13 from Supabase docs -->

# Users

A **user** in Supabase Auth is someone with a user ID, stored in the Auth schema. Once someone is a user, they can be issued an Access Token, which can be used to access Supabase endpoints. The token is tied to the user, so you can restrict access to resources via [RLS policies](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Permanent and anonymous users

Supabase distinguishes between permanent and anonymous users.

- **Permanent users** are tied to a piece of Personally Identifiable Information (PII), such as an email address, a phone number, or a third-party identity. They can use these identities to sign back into their account after signing out.
- **Anonymous users** aren't tied to any identities. They have a user ID and a personalized Access Token, but they have no way of signing back in as the same user if they are signed out.

Anonymous users are useful for:

- E-commerce applications, to create shopping carts before checkout
- Full-feature demos without collecting personal information
- Temporary or throw-away accounts

See the [Anonymous Signins guide](https://supabase.com/docs/guides/auth/auth-anonymous) to learn more about anonymous users.

Caution: Like permanent users, anonymous users use the **authenticated** role for database access.

The **anon** role is for those who aren't signed in at all and are not tied to any user ID. We refer to these as unauthenticated or public users.

## The user object

The user object stores all the information related to a user in your application. The user object can be retrieved using one of these methods:

1. [`supabase.auth.getUser()`](https://supabase.com/docs/reference/javascript/auth-getuser)
2. Retrieve a user object as an admin using [`supabase.auth.admin.getUserById()`](https://supabase.com/docs/reference/javascript/auth-admin-listusers)

A user can sign in with one of the following methods:

- Password-based method (with email or phone)
- Passwordless method (with email or phone)
- OAuth
- SAML SSO

An identity describes the authentication method that a user can use to sign in. A user can have multiple identities. These are the types of identities supported:

- Email
- Phone
- OAuth
- SAML

Note: A user with an email or phone identity will be able to sign in with either a password or passwordless method (e.g. use a one-time password (OTP) or magic link). By default, a user with an unverified email or phone number will not be able to sign in.

The user object contains the following attributes:

| Attributes           | Type             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                   | `string`         | The unique id of the identity of the user.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| aud                  | `string`         | The audience claim.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| role                 | `string`         | The role claim used by Postgres to perform Row Level Security (RLS) checks.                                                                                                                                                                                                                                                                                                                                                                                                            |
| email                | `string`         | The user's email address.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| email\_confirmed\_at | `string`         | The timestamp that the user's email was confirmed. If null, it means that the user's email is not confirmed.                                                                                                                                                                                                                                                                                                                                                                           |
| phone                | `string`         | The user's phone number.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| phone\_confirmed\_at | `string`         | The timestamp that the user's phone was confirmed. If null, it means that the user's phone is not confirmed.                                                                                                                                                                                                                                                                                                                                                                           |
| confirmed\_at        | `string`         | The timestamp that either the user's email or phone was confirmed. If null, it means that the user does not have a confirmed email address and phone number.                                                                                                                                                                                                                                                                                                                           |
| last\_sign\_in\_at   | `string`         | The timestamp that the user last signed in.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| app\_metadata        | `object`         | The `provider` attribute indicates the first provider that the user used to sign up with. The `providers` attribute indicates the list of providers that the user can use to login with.                                                                                                                                                                                                                                                                                               |
| user\_metadata       | `object`         | Defaults to the first provider's identity data but can contain additional custom user metadata if specified. Refer to [**User Identity**](https://supabase.com/docs/guides/auth/auth-identity-linking#the-user-identity) for more information about the identity object. Don't rely on the order of information in this field. Do not use it in security sensitive context (such as in RLS policies or authorization logic), as this value is editable by the user without any checks. |
| identities           | `UserIdentity[]` | Contains an object array of identities linked to the user.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| created\_at          | `string`         | The timestamp that the user was created.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| updated\_at          | `string`         | The timestamp that the user was last updated.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| is\_anonymous        | `boolean`        | Is true if the user is an anonymous user.                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Inviting users

You can invite someone to create an account by sending them an invitation email. The invited user receives an email containing a link that, when clicked, confirms their email address and lets them finish setting up their account (for example, by setting a password).

Inviting a user is an admin action, so it must be performed from a trusted server environment using your secret key, or from the Dashboard. When you invite an email that doesn't yet belong to a user, a new unconfirmed user is created. Inviting an email that already belongs to a confirmed user returns an error.

### Using the Dashboard

1. Go to **Authentication > Users** in the Dashboard.
2. Click **Add user** and select **Send invitation**.
3. Enter the user's email address and click **Invite user**.

### Using the Auth Admin API

Call [`inviteUserByEmail()`](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) from the SDK's Auth Admin API in a server-side environment. This is part of Supabase Auth (accessed via `supabase.auth.admin` with your project's [secret key](https://supabase.com/docs/guides/getting-started/api-keys)), and is distinct from the [Management API](https://supabase.com/docs/reference/api/introduction) used to configure your project. You can optionally attach custom `user_metadata` and a redirect URL for the invite link.

```js
import { createClient } from '@supabase/supabase-js'

// Use your project's secret key (sb_secret_...), and only ever on a trusted server.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
})

const { data, error } = await supabase.auth.admin.inviteUserByEmail('someone@example.com', {
  data: { name: 'Jane' }, // optional, stored in user_metadata
  redirectTo: 'https://example.com/welcome', // optional, where the invite link sends the user
})
```

Caution: The secret key (`sb_secret_...`, which replaces the legacy `service_role` key) bypasses Row Level Security and must only be used in a secure server environment. Never expose it in a browser or any publicly accessible client.

Note: The `redirectTo` URL must be in your project's [allowed redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) configuration. If it isn't, the `redirectTo` value is ignored and the invite link redirects to your Site URL instead (no error is raised).

The invitation email uses the **Invite user** email template, which you can customize. Refer to [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates) to learn more.

Caution: Invitation links expire after the duration configured in [Email OTP Expiration](https://supabase.com/dashboard/project/_/auth/providers?provider=Email), which defaults to 1 hour. This is the same value used for [email OTPs](https://supabase.com/docs/guides/auth/auth-email-passwordless#enabling-email-otp), magic links, and other email confirmation links. If an invitation expires before it's accepted, send the user a new invite.

## Resources

- [User Management guide](https://supabase.com/docs/guides/auth/managing-user-data)
