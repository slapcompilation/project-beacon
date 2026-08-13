<!-- source: https://supabase.com/docs/guides/auth/debugging/error-codes · mirrored 2026-08-13 from Supabase docs -->

# Error Codes

Learn about the Auth error codes and how to resolve them

Supabase Auth Error Codes

## Auth error codes

Supabase Auth can return various errors when using its API. This guide explains how to handle these errors effectively across different programming languages.

## Error types

Supabase Auth errors are generally categorized into two main types:

- API Errors: Originate from the Supabase Auth API.
- Client Errors: Originate from the client library's state.

Client errors differ by language so do refer to the appropriate section below:

**JavaScript**

All errors originating from the `supabase.auth` namespace of the client library will be wrapped by the `AuthError` class.

Error objects are split in a few classes:

- `AuthApiError` -- errors which originate from the Supabase Auth API.
  - Use `isAuthApiError` instead of `instanceof` checks to see if an error you caught is of this type.
- `CustomAuthError` -- errors which generally originate from state in the client library.
  - Use the `name` property on the error to identify the class of error received.

Errors originating from the server API classed as `AuthApiError` always have a `code` property that can be used to identify the error returned by the server. The `status` property is also present, encoding the HTTP status code received in the response.

**Dart**

All errors originating from the `supabase.auth` namespace of the client library will be wrapped by the `AuthException` class.

Error objects are split in a few classes. `AuthApiException` is an exception which originates from the Supabase Auth API.

Errors originating from the server API classed as `AuthApiException` always have a `code` property that can be used to identify the error returned by the server. The `statusCode` property is also present, encoding the HTTP status code received in the response.

**Swift**

All errors originating from the `supabase.auth` namespace of the client library will be a case of the `AuthError` enum.

The `api(message:errorCode:underlyingData:underlyingResponse:)` case is a special case for errors which originates from the Supabase Auth API, this error always have an `errorCode` property that can be used to identify the error returned by the server.

**Python**

All errors originating from the `supabase.auth` namespace of the client library will be wrapped by the `AuthError` class.

Error objects are split in a few classes. `AuthApiError` is an error which originate from the Supabase Auth API.

Errors originating from the server API classed as `AuthApiError` always have a `code` property that can be used to identify the error returned by the server. The `status` property is also present, encoding the HTTP status code received in the response.

**Kotlin**

All exceptions originating from the `supabase.auth` namespace of the Kotlin client library will be a subclass of `RestException`.

Rest exceptions are split into a few classes:

- `AuthRestException` -- exceptions which originate from the Supabase Auth API and have a `errorCode` property that can be used to identify the error returned by the server.
- `AuthWeakPasswordException` -- an `AuthRestException` which indicates that the password is too weak.
- `AuthSessionMissingException` -- an `AuthRestException` which indicates that the session is missing, if the user was logged out or deleted.

All instances and subclasses of a `AuthRestException` have a `errorCode` property that can be used to identify the error returned by the server.

**C#**

All exceptions originating from the `supabase.Auth` namespace of the C# client library are wrapped by the `GotrueException` class.

`GotrueException` exposes:

- `StatusCode` -- the HTTP status code returned by the Supabase Auth API.
- `Reason` -- a `FailureHint.Reason` value that categorizes the error, so you can branch on it without parsing the message.

## HTTP status codes

Below are the most common HTTP status codes you might encounter, along with their meanings in the context of Supabase Auth:

### [403 Forbidden](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403)

Sent out in rare situations where a certain Auth feature is not available for the user, and you as the developer are not checking a precondition whether that API is available for the user.

### [422 Unprocessable Entity](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/422)

Sent out when the API request is accepted, but cannot be processed because the user or Auth server is in a state where it cannot satisfy the request.

### [429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)

Sent out when rate-limits are breached for an API. You should handle this status code often, especially in functions that authenticate a user.

### [500 Internal Server Error](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500)

Indicate that the Auth server's service is degraded. Most often it points to issues in your database setup such as a misbehaving trigger on a schema, function, view or other database object.

### [501 Not Implemented](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/501)

Sent out when a feature is not enabled on the Auth server, and you are trying to use an API which requires it.

## Auth error codes table

The following table provides a comprehensive list of error codes you may encounter when working with Supabase Auth. Each error code is associated with a specific issue and includes a description to help you understand and resolve the problem efficiently.

| Error code | Description |
| --- | --- |
| `anonymous_provider_disabled` | Anonymous sign-ins are disabled. |
| `bad_code_verifier` | Returned from the PKCE flow where the provided code verifier does not match the expected one. Indicates a bug in the implementation of the client library. |
| `bad_json` | Usually used when the HTTP body of the request is not valid JSON. |
| `bad_jwt` | JWT sent in the Authorization header is not valid. |
| `bad_oauth_callback` | OAuth callback from provider to Auth does not have all the required attributes (state). Indicates an issue with the OAuth provider or client library implementation. |
| `bad_oauth_state` | OAuth state (data echoed back by the OAuth provider to Supabase Auth) is not in the correct format. Indicates an issue with the OAuth provider integration. |
| `captcha_failed` | CAPTCHA challenge could not be verified with the CAPTCHA provider. Check your CAPTCHA integration. |
| `conflict` | General database conflict, such as concurrent requests on resources that should not be modified concurrently. Can often occur when you have too many session refresh requests firing off at the same time for a user. Check your app for concurrency issues, and if detected, back off exponentially. |
| `email_address_invalid` | Example and test domains are currently not supported. Use a different email address. |
| `email_address_not_authorized` | Email sending is not allowed for this address as your project is using the default SMTP service. Emails can only be sent to members in your Supabase organization. If you want to send emails to others, set up a custom SMTP provider. Learn more: [Setting up a custom SMTP provider](/docs/guides/auth/auth-smtp) |
| `email_conflict_identity_not_deletable` | Unlinking this identity causes the user's account to change to an email address which is already used by another user account. Indicates an issue where the user has two different accounts using different primary email addresses. You may need to migrate user data to one of their accounts in this case. |
| `email_exists` | Email address already exists in the system. |
| `email_not_confirmed` | Signing in is not allowed for this user as the email address is not confirmed. |
| `email_provider_disabled` | Signups are disabled for email and password. |
| `flow_state_expired` | PKCE flow state to which the API request relates has expired. Ask the user to sign in again. |
| `flow_state_not_found` | PKCE flow state to which the API request relates no longer exists. Flow states expire after a while and are progressively cleaned up, which can cause this error. Retried requests can cause this error, as the previous request likely destroyed the flow state. Ask the user to sign in again. |
| `hook_payload_invalid_content_type` | Payload from Auth does not have a valid Content-Type header. |
| `hook_payload_over_size_limit` | Payload from Auth exceeds maximum size limit. |
| `hook_timeout` | Unable to reach hook within maximum time allocated. |
| `hook_timeout_after_retry` | Unable to reach hook after maximum number of retries. |
| `identity_already_exists` | The identity to which the API relates is already linked to a user. |
| `identity_not_found` | Identity to which the API call relates does not exist, such as when an identity is unlinked or deleted. |
| `insufficient_aal` | To call this API, the user must have a higher Authenticator Assurance Level. To resolve, ask the user to solve an MFA challenge. Learn more: [MFA](/docs/guides/auth/auth-mfa) |
| `invalid_credentials` | Login credentials or grant type not recognized. |
| `invite_not_found` | Invite is expired or already used. |
| `manual_linking_disabled` | Calling the supabase.auth.linkUser() and related APIs is not enabled on the Auth server. |
| `mfa_challenge_expired` | Responding to an MFA challenge should happen within a fixed time period. Request a new challenge when encountering this error. |
| `mfa_factor_name_conflict` | MFA factors for a single user should not have the same friendly name. |
| `mfa_factor_not_found` | MFA factor no longer exists. |
| `mfa_ip_address_mismatch` | The enrollment process for MFA factors must begin and end with the same IP address. |
| `mfa_phone_enroll_not_enabled` | Enrollment of MFA Phone factors is disabled. |
| `mfa_phone_verify_not_enabled` | Login via Phone factors and verification of new Phone factors is disabled. |
| `mfa_totp_enroll_not_enabled` | Enrollment of MFA TOTP factors is disabled. |
| `mfa_totp_verify_not_enabled` | Login via TOTP factors and verification of new TOTP factors is disabled. |
| `mfa_verification_failed` | MFA challenge could not be verified -- wrong TOTP code. |
| `mfa_verification_rejected` | Further MFA verification is rejected. Only returned if the MFA verification attempt hook returns a reject decision. Learn more: [MFA verification hook](/docs/guides/auth/auth-hooks/mfa-verification-hook) |
| `mfa_verified_factor_exists` | Verified phone factor already exists for a user. Unenroll existing verified phone factor to continue. |
| `mfa_web_authn_enroll_not_enabled` | Enrollment of MFA Web Authn factors is disabled. |
| `mfa_web_authn_verify_not_enabled` | Login via WebAuthn factors and verification of new WebAuthn factors is disabled. |
| `no_authorization` | This HTTP request requires an Authorization header, which is not provided. |
| `not_admin` | User accessing the API is not admin, i.e. the JWT does not contain a role claim that identifies them as an admin of the Auth server. |
| `oauth_provider_not_supported` | Using an OAuth provider which is disabled on the Auth server. |
| `otp_disabled` | Sign in with OTPs (magic link, email OTP) is disabled. Check your server's configuration. |
| `otp_expired` | OTP code for this sign-in has expired. Ask the user to sign in again. |
| `over_email_send_rate_limit` | Too many emails have been sent to this email address. Ask the user to wait a while before trying again. |
| `over_request_rate_limit` | Too many requests have been sent by this client (IP address). Ask the user to try again in a few minutes. Sometimes can indicate a bug in your application that mistakenly sends out too many requests (such as a badly written useEffect React hook). Learn more: [React useEffect hook](https://react.dev/reference/react/useEffect) |
| `over_sms_send_rate_limit` | Too many SMS messages have been sent to this phone number. Ask the user to wait a while before trying again. |
| `phone_exists` | Phone number already exists in the system. |
| `phone_not_confirmed` | Signing in is not allowed for this user as the phone number is not confirmed. |
| `phone_provider_disabled` | Signups are disabled for phone and password. |
| `provider_disabled` | OAuth provider is disabled for use. Check your server's configuration. |
| `provider_email_needs_verification` | Not all OAuth providers verify their user's email address. Supabase Auth requires emails to be verified, so this error is sent out when a verification email is sent after completing the OAuth flow. |
| `reauthentication_needed` | A user needs to reauthenticate to change their password. Ask the user to reauthenticate by calling the supabase.auth.reauthenticate() API. |
| `reauthentication_not_valid` | Verifying a reauthentication failed, the code is incorrect. Ask the user to enter a new code. |
| `refresh_token_already_used` | Refresh token has been revoked and falls outside the refresh token reuse interval. See the documentation on sessions for further information. Learn more: [Auth sessions](/docs/guides/auth/sessions) |
| `refresh_token_not_found` | Session containing the refresh token not found. |
| `request_timeout` | Processing the request took too long. Retry the request. |
| `same_password` | A user that is updating their password must use a different password than the one currently used. |
| `saml_assertion_no_email` | SAML assertion (user information) was received after sign in, but no email address was found in it, which is required. Check the provider's attribute mapping and/or configuration. |
| `saml_assertion_no_user_id` | SAML assertion (user information) was received after sign in, but a user ID (called NameID) was not found in it, which is required. Check the SAML identity provider's configuration. |
| `saml_entity_id_mismatch` | (Admin API.) Updating the SAML metadata for a SAML identity provider is not possible, as the entity ID in the update does not match the entity ID in the database. This is equivalent to creating a new identity provider, and you should do that instead. |
| `saml_idp_already_exists` | (Admin API.) Adding a SAML identity provider that is already added. |
| `saml_idp_not_found` | SAML identity provider not found. Most often returned after IdP-initiated sign-in with an unregistered SAML identity provider in Supabase Auth. |
| `saml_metadata_fetch_failed` | (Admin API.) Adding or updating a SAML provider failed as its metadata could not be fetched from the provided URL. |
| `saml_provider_disabled` | Using Enterprise SSO with SAML 2.0 is not enabled on the Auth server. Learn more: [Enterprise SSO](/docs/guides/auth/enterprise-sso/auth-sso-saml) |
| `saml_relay_state_expired` | SAML relay state is an object that tracks the progress of a supabase.auth.signInWithSSO() request. The SAML identity provider should respond after a fixed amount of time, after which this error is shown. Ask the user to sign in again. |
| `saml_relay_state_not_found` | SAML relay states are progressively cleaned up after they expire, which can cause this error. Ask the user to sign in again. |
| `session_expired` | Session to which the API request relates has expired. This can occur if an inactivity timeout is configured, or the session entry has exceeded the configured timebox value. See the documentation on sessions for more information. Learn more: [Auth sessions](/docs/guides/auth/sessions) |
| `session_not_found` | Session to which the API request relates no longer exists. This can occur if the user has signed out, or the session entry in the database was deleted in some other way. |
| `signup_disabled` | Sign ups (new account creation) are disabled on the server. |
| `single_identity_not_deletable` | Every user must have at least one identity attached to it, so deleting (unlinking) an identity is not allowed if it's the only one for the user. |
| `sms_send_failed` | Sending an SMS message failed. Check your SMS provider configuration. |
| `sso_domain_already_exists` | (Admin API.) Only one SSO domain can be registered per SSO identity provider. |
| `sso_provider_not_found` | SSO provider not found. Check the arguments in supabase.auth.signInWithSSO(). |
| `too_many_enrolled_mfa_factors` | A user can only have a fixed number of enrolled MFA factors. |
| `unexpected_audience` | (Deprecated feature not available via Supabase client libraries.) The request's X-JWT-AUD claim does not match the JWT's audience. |
| `unexpected_failure` | Auth service is degraded or a bug is present, without a specific reason. |
| `user_already_exists` | User with this information (email address, phone number) cannot be created again as it already exists. |
| `user_banned` | User to which the API request relates has a banned_until property which is still active. No further API requests should be attempted until this field is cleared. |
| `user_not_found` | User to which the API request relates no longer exists. |
| `user_sso_managed` | When a user comes from SSO, certain fields of the user cannot be updated (like email). |
| `validation_failed` | Provided parameters are not in the expected format. |
| `weak_password` | User is signing up or changing their password without meeting the password strength criteria. Use the AuthWeakPasswordError class to access more information about what they need to do to make the password pass. |

## Best practices for error handling

- Always use `error.code` and `error.name` to identify errors, not string matching on error messages.
- Avoid relying solely on HTTP status codes, as they may change unexpectedly.
