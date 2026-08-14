<!-- source: https://palantir.com/docs/foundry/authentication/saml-getting-started/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Getting started

[SAML 2.0 (Security Assertion Markup Language) ↗](https://en.wikipedia.org/wiki/SAML_2.0) is an XML-based data format used to exchange authentication and authorization data between a *service provider* (often abbreviated *SP*), such as Foundry, and an *identity provider* (*IdP*), such as Azure AD or Okta. The most common use case for SAML 2.0 is *Single Sign-On* (*SSO*) from a web browser.

## Concepts

In the following section, authentication concepts common in Foundry are discussed.

### SAML integration metadata

The SAML integration metadata, also called service provider metadata, is the information about Foundry that needs to be passed to the identity provider. This information includes:

* **Entity ID:** A unique ID identifying Foundry for the identity provider, in a [URN ↗](https://en.wikipedia.org/wiki/Uniform_Resource_Name) format `urn:uuid:[$UUID]`.
* **Assertion Consumer Service (ACS) URL:** The Foundry endpoint that accepts SAML response messages for the purpose of establishing a session based on an assertion.
* **Single Logout URL:** The Foundry endpoint that accepts SAML single logout requests from the identity provider.
* **Certificate:** Used for signing the SAML messages sent to the identity provider.

This information is encoded as an auto-generated XML file that can be copied in whole to be uploaded to the identity provider by the customer. In addition, Control Panel extracts the information to separate fields that can be copied individually.

### Identity provider metadata

Identity provider metadata is the information about the identity provider that needs to be passed to Foundry. This information includes the identity provider’s entity ID, Single Sign-On (SSO) and Single Logout URLs, and a certificate.

Identity provider metadata is encoded as an XML file that can be uploaded to Control Panel in the following ways:

* `Upload`: Save the XML file from the identity provider and upload it into Control Panel.
* `Fetch`: Provide a metadata discovery URI, from which Foundry can retrieve information about your identity provider, including your identity provider's entity ID, Single Sign-On (SSO), Single Logout URLs (SLO), and a certificate. You will also need to configure a network egress policy to enable Foundry to access the metadata discovery URI provided.

SAML certificates have an expiration date, after which users may experience login issues. When the certificate associated with the identity provider is due to expire within the next 30 days, a [warning banner](#there-are-x-providers-with-certificates-expiring-within-30-days) will appear in Control Panel.

### Email domains

Email domains are used to decide which identity provider integrations are presented to users as a login option. When a user enters their email or username in the login screen, email domains of all the configured identity provider integrations will be tested and only matching identity provider integrations will be shown.

Email domains can be regular expressions, though they are usually of the simple form `@example.com`, which will be automatically converted into `.*@example\.com`. Use `.*` if the identity provider integration should be shown to all users.

!["Allowed email domains" window that enables you to define the email domains associated with an authentication provider. The "Restrict email domains" option is selected and several example domains, both of the simple form and as regular expressions, have been allowed.](./images/authentication-saml-email-domains.png)

:::callout{theme="neutral"}
Note that both the simple form of email domains (`@example.com`) and regular expressions (`.*@example\.com`) are case-sensitive by default. Email domains can be made case-insensitive by adding `(?i)` to the start of the regular expression, so a case-insensitive version of the simple form `@example.com` would be `(?i).*@example\.com` or `(?i)@example\.com`.
:::

### Supported hosts

Supported hosts are used to:

* Construct the ACS & Single Logout URLs in the SAML integration metadata.
* Ensure the integration is only presented to users that log in using these hosts.

You can choose from the hosts configured for your enrollment.

### Map attributes

Map SAML responses to Foundry to ensure sufficient and correct user attributes are being passed through.

#### User attributes

After a user authenticates with the identity provider during the SAML login process, a SAML response is sent to Foundry. This SAML response contains the user’s attributes (also called "claims"), such as name, email, and any available additional information. These attributes are sent in a map of attribute key to value (e.g. `email` → `user@example.com`) or values.

For Foundry to have the correct values for user attributes, you must map identity provider attributes (or "claims") to matching Foundry attributes. Foundry requires the following mappings:

* ID: Set to `NameID` by default, but can be changed to a different stable identifier. This value should always be present on SAML assertions and has a static unique value.
* Username: Set to `NameID` by default, but can be changed to a different human-readable attribute (e.g., `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name` for Azure AD).
* Email: Should be mapped to the email attribute (e.g., `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` for Azure AD).
* First name: Should be mapped to the first name attribute (e.g., `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname` for Azure AD).
* Last name: Should be mapped to the last name attribute (e.g., `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname` for Azure AD).

View the reference mappings for [Azure AD](/docs/foundry/authentication/saml-azure-ad/#attribute-mapping) and [Okta](/docs/foundry/authentication/saml-okta/#attribute-mapping).

Additional mappings can be set to create more user attributes in Foundry by clicking **Add attribute mapping**. Input the attribute name in Foundry in the left field, and the attribute name in the identity provider on the right field.

For each mapping, there is a toggle that lets you choose the behavior when an attribute has multiple values in the SAML response. This toggle can be set to **First** (which will populate the attribute with the first value received) or **All** (which will populate the attribute with all the values received).

#### Provider groups

You can also configure Foundry to create groups based on identity provider attributes (called "provider groups"), allowing you to mirror your existing group memberships in Foundry. You may need to additionally configure your provider to include group attributes in the SAML response.

To set up a mapping for a provider group, check the box labeled **Import user groups from the identity provider** and enter the attribute key that will be sent with the SAML claim. When a user logs in, every value for the configured attributes will be mirrored as provider groups, and the user will be enrolled as a member. With this box unchecked, provider group membership will not be kept up to date on login. If you decide to keep this unchecked, we recommend enabling [SCIM](/docs/foundry/authentication/scim-overview/) to update provider group membership without requiring interactive login.

Optionally, you can set a regex pattern to extract groups in cases where the groups are sent as a single value instead of a list. For instance, use `[^,]+` for comma-separated groups.

### Advanced settings

#### Asynchronous user managers

Asynchronous user managers (AUMs) are configurable extra steps in the login flow. Expand **Asynchronous user managers** to see the available AUMs.

##### Checkpoints Login

Creating a [Login Checkpoint](/docs/foundry/checkpoints/overview/) redirects users at the time of login to a configurable prompt that can ask for a justification before allowing the login to proceed. To enable a Login Checkpoint, first toggle on the **Checkpoints Login** AUM, and then follow the steps to [create a checkpoint](/docs/foundry/security/requesting-justification-for-sensitive-actions/).

## Configure SAML 2.0 integration

To configure a new SAML integration, see the specific steps for your identity provider below:

* [Azure](/docs/foundry/authentication/saml-azure-ad/)
* [Okta](/docs/foundry/authentication/saml-okta/)
* [Other identity providers](/docs/foundry/authentication/saml-other-idp/)

## Troubleshooting

### “Login failed as a suitable authentication provider could not be located. Please contact your administrator for further assistance.” error

This error indicates that the username entered by the user does not match any of the authentication provider [email domains](#email-domains) that were configured and allowlisted in Control Panel. It could also mean that the host from which the user is attempting to log in was not added as a [supported host](#supported-hosts) for their configured authentication provider.

### "There are x providers with certificates expiring within 30 days."

This warning banner indicates that the certificates in the identity provider metadata will expire within 30 days. The identity provider should switch to a new certificate to avoid authentication disruptions. You can resolve this through manual upload or automatic refresh.

#### Manual upload

1. Generate a new certificate in the identity provider. **Ensure that the old certificate is still present and active.** This way, logins will continue to work until the new metadata is passed to Control Panel.
2. Upload the new XML file to your provider in Control Panel via the `Upload` method and confirm that you can view both the expiring and the new certificates extracted.
3. Once saved, the identity provider can switch to using the new certificate and remove the old certificate. The metadata does not need to be re-uploaded once the expiring certificate is removed.

Note that if your identity provider starts signing with the new certificate before you upload the new XML file to Control Panel, users will experience login issues.

#### Automatic refresh

When you configure the `Fetch` method described above, you can choose to **Automatically refresh the identity provider's metadata using the provider metadata URI**. When your identity provider rotates to a new certificate, the next login attempt will initially fail, prompting Foundry to automatically fetch the updated metadata from the metadata discovery URI and retry the request without a disruption to the user's login experience.

Note that automatic metadata refresh will not work if your identity provider changes the metadata URI during certificate rotation. If this occurs, you must manually update the metadata discovery URI in Control Panel before the existing certificate expires.

:::callout{theme="note"}
Some identity providers include a `validUntil` date in their metadata. This date may be tied to the expiration of the currently active signing certificate rather than the latest expiry across all published certificates. As a result, even if a new certificate has been published in the metadata, the metadata itself will become invalid once the `validUntil` date passes, causing login failures. When the identity provider switches to using the new certificate, the `validUntil` date will typically update to reflect the new certificate's expiration.

With automatic metadata refresh enabled, Foundry will fetch the new metadata after the certificate switch, which includes the updated `validUntil` date, resolving login failures caused by an expired `validUntil` date without manual intervention. Without automatic metadata refresh, you will need to re-upload the updated provider metadata to Control Panel after the identity provider switches to the new certificate.
:::
