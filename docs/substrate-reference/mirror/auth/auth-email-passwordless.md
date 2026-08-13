<!-- source: https://supabase.com/docs/guides/auth/auth-email-passwordless · mirrored 2026-08-13 from Supabase docs -->

# Passwordless email logins

Email logins using Magic Links or One-Time Passwords (OTPs)

Supabase Auth provides several passwordless login methods. Passwordless logins allow users to sign in without a password, by clicking a confirmation link or entering a verification code.

Passwordless login can:

- Improve the user experience by not requiring users to create and remember a password
- Increase security by reducing the risk of password-related security breaches
- Reduce support burden of dealing with password resets and other password-related flows

Supabase Auth offers two passwordless login methods that use the user's email address:

- [Magic Link](#with-magic-link)
- [OTP](#with-otp)

## With Magic Link

Magic Links are a form of passwordless login where users click on a link sent to their email address to log in to their accounts. Magic Links only work with email addresses and are one-time use only.

### Enabling Magic Link

Email authentication methods, including Magic Links, are enabled by default.

Configure the Site URL and any additional redirect URLs. These are the only URLs that are allowed as redirect destinations after the user clicks a Magic Link. You can change the URLs on the [URL Configuration page](https://supabase.com/dashboard/project/_/auth/url-configuration) for hosted projects, in the `config.toml` [file](https://supabase.com/docs/guides/local-development/cli/config#auth.additional_redirect_urls) for local development, or in the `.env` configuration file for [self-hosted Supabase](https://supabase.com/docs/guides/self-hosting/docker).

By default, a user can only request a magic link once every 60 seconds and they expire after 1 hour.

### Signing in with Magic Link

Call the "sign in with OTP" method from the client library.

Though the method is labelled "OTP", it sends a Magic Link by default. The two methods differ only in the content of the confirmation email sent to the user.

If the user hasn't signed up yet, they are automatically signed up by default. To prevent this, set the `shouldCreateUser` option to `false`.

**JavaScript**

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')

// ---cut---
async function signInWithEmail() {
  const { data, error } = await supabase.auth.signInWithOtp({
    email: 'valid.email@supabase.io',
    options: {
      // set this to false if you do not want the user to be automatically signed up
      shouldCreateUser: false,
      emailRedirectTo: 'https://example.com/welcome',
    },
  })
}
```

**Expo React Native**

```ts
import { makeRedirectUri } from 'expo-auth-session'

const redirectTo = makeRedirectUri()

const { error } = await supabase.auth.signInWithOtp({
  email: 'valid.email@supabase.io',
  options: {
    emailRedirectTo: redirectTo,
  },
})
```

Read the [Deep Linking Documentation](https://supabase.com/docs/guides/auth/native-mobile-deep-linking) to learn how to handle deep linking.

**Dart**

```dart
Future<void> signInWithEmail() async {
  await supabase.auth.signInWithOtp(email: 'valid.email@supabase.io');
}
```

**Swift**

```swift
try await supabase.auth.signInWithOTP(
  email: "valid.email@supabase.io",
  redirectTo: URL(string: "https://example.com/welcome"),
  // set this to false if you do not want the user to be automatically signed up
  shouldCreateUser: false
)
```

**Kotlin**

```kotlin
suspend fun signInWithEmail() {
	supabase.auth.signInWith(OTP) {
		email = "valid.email@supabase.io"
	}
}
```

**Python**

```python
response = supabase.auth.sign_in_with_otp({
  'email': 'valid.email@supabase.io',
  'options': {
    # set this to false if you do not want the user to be automatically signed up
    'should_create_user': False,
    'email_redirect_to': 'https://example.com/welcome',
  },
})
```

**C#**

```c#
var options = new SignInOptions { RedirectTo = "https://example.com/welcome" };
var didSendMagicLink = await supabase.Auth.SendMagicLink("valid.email@supabase.io", options);
```

That's it for the implicit flow.

If you're using PKCE flow, edit the Magic Link [email template](https://supabase.com/docs/guides/auth/auth-email-templates) to send a token hash:

```html
<h2>Sign in to your account</h2>

<p>Use this link to sign in to your account:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
```

At the `/auth/confirm` endpoint, exchange the hash for the session:

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')

// ---cut---
const { error } = await supabase.auth.verifyOtp({
  token_hash: 'hash',
  type: 'email',
})
```

## With OTP

Email one-time passwords (OTP) are a form of passwordless login where users key in a six digit code sent to their email address to log in to their accounts.

### Enabling email OTP

Email authentication methods, including Email OTPs, are enabled by default.

Email OTPs share an implementation with Magic Links. To send an OTP instead of a Magic Link, alter the **Magic Link** [email template](https://supabase.com/dashboard/project/_/auth/templates/magic-link-or-otp). Refer to the [Email Templates guide](https://supabase.com/docs/guides/auth/auth-email-templates) for more information.

Modify the template to include the `{{ .Token }}` variable, for example:

```html
<h2>One time login code</h2>

<p>Please enter this code: {{ .Token }}</p>
```

By default, a user can only request an OTP once every 60 seconds, and they expire after 1 hour. This is configurable via **Authentication > Sign In / Providers > Auth Providers > Email > Email OTP expiration**. An expiry duration of more than 86,400 seconds (one day) is strongly discouraged and can only be set via the [Management API](https://supabase.com/docs/reference/api/v1-update-auth-service-config). Make sure to read the [security recommendations](https://supabase.com/docs/guides/deployment/going-into-prod#security) before going into production.

Caution: The **Email OTP Expiration** setting also governs the validity of Magic Links and other email links, including confirmation, password recovery, email change, and [invitation](https://supabase.com/docs/guides/auth/users#inviting-users) links.

### Signing in with email OTP

#### Step 1: Send the user an OTP code

Get the user's email and call the "sign in with OTP" method from your client library.

If the user hasn't signed up yet, they are automatically signed up by default. To prevent this, set the `shouldCreateUser` option to `false`.

**JavaScript**

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')

// ---cut---
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'valid.email@supabase.io',
  options: {
    // set this to false if you do not want the user to be automatically signed up
    shouldCreateUser: false,
  },
})
```

**Dart**

```dart
Future<void> signInWithEmailOtp() async {
  await supabase.auth.signInWithOtp(email: 'valid.email@supabase.io');
}
```

**Swift**

```swift
try await supabase.auth.signInWithOTP(
  email: "valid.email@supabase.io",
  // set this to false if you do not want the user to be automatically signed up
  shouldCreateUser: false
)
```

**Kotlin**

```kotlin
suspend fun signInWithEmailOtp() {
	supabase.auth.signInWith(OTP) {
		email = "valid.email@supabase.io"
	}
}
```

**Python**

```python
response = supabase.auth.sign_in_with_otp({
  'email': 'valid.email@supabase.io',
  'options': {
    # set this to false if you do not want the user to be automatically signed up
    'should_create_user': False,
  },
})
```

**C#**

```c#
await supabase.Auth.SendMagicLink("valid.email@supabase.io");
```

If the request is successful, you receive a response with `error: null` and a `data` object where both `user` and `session` are null. Let the user know to check their email inbox.

```json
{
  "data": {
    "user": null,
    "session": null
  },
  "error": null
}
```

#### Step 2: Verify the OTP to create a session

Provide an input field for the user to enter their one-time code.

Call the "verify OTP" method from your client library with the user's email address, the code, and a type of `email`:

**JavaScript**

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')

// ---cut---
const {
  data: { session },
  error,
} = await supabase.auth.verifyOtp({
  email: 'email@example.com',
  token: '123456',
  type: 'email',
})
```

**Swift**

```swift
try await supabase.auth.verifyOTP(
  email: email,
  token: "123456",
  type: .email
)
```

**Kotlin**

```kotlin
supabase.auth.verifyEmailOtp(type = OtpType.Email.EMAIL, email = "email", token = "151345")
```

**Python**

```python
response = supabase.auth.verify_otp({
  'email': email,
  'token': '123456',
  'type': 'email',
})
```

**C#**

```c#
var session = await supabase.Auth.VerifyOTP("email@example.com", "123456", EmailOtpType.Email);
```

If successful, the user is now logged in, and you receive a valid session that looks like:

```json
{
  "access_token": "<redacted-by-mirror: example credential>.1BqRi0NbS_yr1f6hnr4q3s1ylMR3c1vkiJ4e_N55dhM",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "LSp8LglPPvf0DxGMSj-vaQ",
  "user": {...}
}
```
