<!-- source: https://supabase.com/docs/guides/auth/auth-anonymous · mirrored 2026-08-13 from Supabase docs -->

# Anonymous Sign-Ins

Create and use anonymous users to authenticate with Supabase

[Enable Anonymous Sign-Ins](https://supabase.com/dashboard/project/_/auth/providers) to build apps which provide users an authenticated experience without requiring users to enter an email address, password, use an OAuth provider or provide any other PII (Personally Identifiable Information). Later, when ready, the user can link an authentication method to their account.

Note: Calling `signInAnonymously()` creates an anonymous user. It behaves like a permanent user, except the user can't access their account if they sign out, clear browsing data, or use another device.

Like permanent users, the `authenticated` Postgres role will be used when using the Data APIs to access your project. JWTs for these users will have an `is_anonymous` claim which you can use to distinguish in RLS policies.

This is different from the `anon` API key which does not create a user and can be used to implement public access to your database as it uses the `anonymous` Postgres role.

Anonymous sign-ins can be used to build:

- E-commerce applications, such as shopping carts before check-out
- Full-feature demos without collecting personal information
- Temporary or throw-away accounts

Caution: Review your existing RLS policies before enabling anonymous sign-ins. Anonymous users use the `authenticated` role. To distinguish between anonymous users and permanent users, your policies need to check the `is_anonymous` field of the user's JWT.

See the [Access control section](#access-control) for more details.

Caution: The Supabase team has received reports of user metadata being cached across unique anonymous users as a result of Next.js static page rendering. For the best user experience, use dynamic page rendering.

Note: For self-hosting, you can update your project configuration using the files and environment variables provided. See the [local development docs](https://supabase.com/docs/guides/local-development/cli/config) for more details.

## Sign in anonymously

**JavaScript**

Call the [`signInAnonymously()`](https://supabase.com/docs/reference/javascript/auth-signinanonymously) method:

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')

// ---cut---
const { data, error } = await supabase.auth.signInAnonymously()
```

**Flutter**

Call the [`signInAnonymously()`](https://supabase.com/docs/reference/dart/auth-signinanonymously) method:

```dart
await supabase.auth.signInAnonymously();
```

**Swift**

Call the [`signInAnonymously()`](https://supabase.com/docs/reference/swift/auth-signinanonymously) method:

```swift
let session = try await supabase.auth.signInAnonymously()
```

**Kotlin**

Call the [`signInAnonymously()`](https://supabase.com/docs/reference/kotlin/auth-signinanonymously) method:

```kotlin
supabase.auth.signInAnonymously()
```

**Python**

Call the [`sign_in_anonymously()`](https://supabase.com/docs/reference/python/auth-signinanonymously) method:

```python
response = supabase.auth.sign_in_anonymously()
```

**C#**

Call the [`SignInAnonymously()`](https://supabase.com/docs/reference/csharp/sign-in-anonymously) method:

```c#
var session = await supabase.Auth.SignInAnonymously();
```

## Convert an anonymous user to a permanent user

Converting an anonymous user to a permanent user requires [linking an identity](https://supabase.com/docs/guides/auth/auth-identity-linking#manual-linking-beta) to the user. This requires you to [enable manual linking](https://supabase.com/dashboard/project/_/auth/providers) in your Supabase project.

### Link an email / phone identity

**JavaScript**

You can use the [`updateUser()`](https://supabase.com/docs/reference/javascript/auth-updateuser) method to link an email or phone identity to the anonymous user. To add a password for the anonymous user, the user's email or phone number needs to be verified first.

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')

// ---cut---
const { data: updateEmailData, error: updateEmailError } = await supabase.auth.updateUser({
  email: 'valid.email@supabase.io',
})

// verify the user's email by clicking on the email change link
// or entering the 6-digit OTP sent to the email address

// once the user has been verified, update the password
const { data: updatePasswordData, error: updatePasswordError } = await supabase.auth.updateUser({
  password: 'password',
})
```

**Flutter**

You can use the [`updateUser()`](https://supabase.com/docs/reference/dart/auth-updateuser) method to link an email or phone identity to the anonymous user.

```dart
await supabase.auth.updateUser(UserAttributes(email: 'valid.email@supabase.io'));
```

**Swift**

You can use the [`update(user:)`](https://supabase.com/docs/reference/swift/auth-updateuser) method to link an email or phone identity to the anonymous user.

```swift
try await supabase.auth.update(
  user: UserAttributes(email: "valid.email@supabase.io")
)
```

**Kotlin**

You can use the [`updateUser()`](https://supabase.com/docs/reference/kotlin/auth-updateuser) method to link an email or phone identity to the anonymous user.

```kotlin
supabase.auth.updateUser {
    email = "valid.email@supabase.io"
}
```

**Python**

You can use the [`update_user()`](https://supabase.com/docs/reference/python/auth-updateuser) method to link an email or phone identity to the anonymous user. To add a password for the anonymous user, the user's email or phone number needs to be verified first.

```python
response = supabase.auth.update_user({
  'email': 'valid.email@supabase.io',
})

# verify the user's email by clicking on the email change link
# or entering the 6-digit OTP sent to the email address

# once the user has been verified, update the password
response = supabase.auth.update_user({
  'password': 'password',
})
```

**C#**

You can use the [`Update()`](https://supabase.com/docs/reference/csharp/update-user) method to link an email or phone identity to the anonymous user. To add a password for the anonymous user, the user's email or phone number needs to be verified first.

```c#
var updateEmail = await supabase.Auth.Update(new UserAttributes { Email = "valid.email@supabase.io" });

// verify the user's email by clicking on the email change link
// or entering the 6-digit OTP sent to the email address

// once the user has been verified, update the password
var updatePassword = await supabase.Auth.Update(new UserAttributes { Password = "password" });
```

### Link an OAuth identity

**JavaScript**

You can use the [`linkIdentity()`](https://supabase.com/docs/reference/javascript/auth-linkidentity) method to link an OAuth identity to the anonymous user.

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')

// ---cut---
const { data, error } = await supabase.auth.linkIdentity({ provider: 'google' })
```

**Flutter**

You can use the [`linkIdentity()`](https://supabase.com/docs/reference/dart/auth-linkidentity) method to link an OAuth identity to the anonymous user.

```dart
await supabase.auth.linkIdentity(OAuthProvider.google);
```

**Swift**

You can use the [`linkIdentity()`](https://supabase.com/docs/reference/swift/auth-linkidentity) method to link an OAuth identity to the anonymous user.

```swift
try await supabase.auth.linkIdentity(provider: .google)
```

**Kotlin**

You can use the [`linkIdentity()`](https://supabase.com/docs/reference/kotlin/auth-linkidentity) method to link an OAuth identity to the anonymous user.

```kotlin
supabase.auth.linkIdentity(Google)
```

**Python**

You can use the [`link_identity()`](https://supabase.com/docs/reference/python/auth-linkidentity) method to link an OAuth identity to the anonymous user.

```python
response = supabase.auth.link_identity({'provider': 'google'})
```

**C#**

You can use the [`LinkIdentity()`](https://supabase.com/docs/reference/csharp/link-identity) method to link an OAuth identity to the anonymous user.

```c#
var state = await supabase.Auth.LinkIdentity(Provider.Google, new SignInOptions { FlowType = OAuthFlowType.PKCE });
var authorizeUrl = state.Uri;
```

## Access control

An anonymous user assumes the `authenticated` role like a permanent user. You can use row-level security (RLS) policies to differentiate between an anonymous user and a permanent user by checking for the `is_anonymous` claim in the JWT returned by `auth.jwt()`:

```sql
create policy "Only permanent users can post to the news feed"
on news_feed as restrictive for insert
to authenticated
with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false );

create policy "Anonymous and permanent users can view the news feed"
on news_feed for select
to authenticated
using ( true );
```

Note: RLS policies are permissive by default, which means that they are combined using an "OR" operator when multiple policies are applied. It is important to construct restrictive policies to ensure that the checks for an anonymous user are always enforced when combined with other policies.
Be aware that a single 'restrictive' RLS policy alone will fail unless combined with another policy that returns true, ensuring the combined condition is met.

## Resolving identity conflicts

Depending on your application requirements, data conflicts can arise when an anonymous user is converted to a permanent user. For example, in the context of an e-commerce application, an anonymous user would be allowed to add items to the shopping cart without signing up / signing in. When they decide to sign-in to an existing account, you will need to decide how you want to resolve data conflicts in the shopping cart:

1. Overwrite the items in the cart with those in the existing account
2. Overwrite the items in the cart with those from the anonymous user
3. Merge the items in the cart together

### Linking an anonymous user to an existing account

In some cases, you may need to link an anonymous user to an existing account rather than creating a new permanent account. This process requires manual handling of potential conflicts. Here's a general approach:

```javascript
// 1. Get the current session and verify the user is anonymous
const { data: anonData, error: anonError } = await supabase.auth.getSession()

if (!anonData.session?.user?.is_anonymous) {
  console.log('User is not anonymous. This flow only applies to anonymous users.')
  return
}

// 2. Attempt to update the user with the existing email
const { data: updateData, error: updateError } = await supabase.auth.updateUser({
  email: 'valid.email@supabase.io',
})

// 3. Handle the error (since the email belongs to an existing user)
if (updateError) {
  console.log('This email belongs to an existing user. Please sign in to that account.')

  // 4. Sign in to the existing account
  const {
    data: { user: existingUser },
    error: signInError,
  } = await supabase.auth.signInWithPassword({
    email: 'valid.email@supabase.io',
    password: 'user_password',
  })

  if (existingUser) {
    // 5. Reassign entities tied to the anonymous user
    // This step will vary based on your specific use case and data model
    const { data: reassignData, error: reassignError } = await supabase
      .from('your_table')
      .update({ user_id: existingUser.id })
      .eq('user_id', anonData.session.user.id)

    // 6. Implement your chosen conflict resolution strategy
    // This could involve merging data, overwriting, or other custom logic
    await resolveDataConflicts(anonData.session.user.id, existingUser.id)
  }
}

// Helper function to resolve data conflicts (implement based on your strategy)
async function resolveDataConflicts(anonymousUserId, existingUserId) {
  // Implement your conflict resolution logic here
  // This could involve ignoring the anonymous user's metadata, overwriting the existing user's metadata, or merging the data of both the anonymous and existing user.
}
```

## Abuse prevention and rate limits

Since anonymous users are stored in your database, bad actors can abuse the endpoint to increase your database size drastically. It is strongly recommended to [enable invisible CAPTCHA or Cloudflare Turnstile](https://supabase.com/docs/guides/auth/auth-captcha) to prevent abuse for anonymous sign-ins. An IP-based rate limit is enforced at 30 requests per hour which can be modified in your [dashboard](https://supabase.com/dashboard/project/_/auth/rate-limits). You can refer to the full list of rate limits [here](https://supabase.com/docs/guides/deployment/going-into-prod#rate-limiting-resource-allocation--abuse-prevention).

## Automatic cleanup

Automatic cleanup of anonymous users is currently not available. Instead, you can delete anonymous users from your project by running the following SQL:

```sql
-- deletes anonymous users created more than 30 days ago
delete from auth.users
where is_anonymous is true and created_at < now() - interval '30 days';
```

## Resources

- [Supabase - Get started for free](https://supabase.com)
- [Supabase JS Client](https://github.com/supabase/supabase-js)
- [Supabase Flutter Client](https://github.com/supabase/supabase-flutter)
- [Supabase Kotlin Client](https://github.com/supabase-community/supabase-kt)
