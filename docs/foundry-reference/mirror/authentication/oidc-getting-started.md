<!-- source: https://palantir.com/docs/foundry/authentication/oidc-getting-started/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Getting started

The [OpenID Connect 1.0 (OIDC) ↗](https://openid.net/connect/) protocol is a simple identity layer on top of the OAuth 2.0 protocol. It allows clients like Foundry to verify the identity of the end-user and obtain basic user profile information.

:::callout{theme="warning"}
Some OIDC providers are publicly available and allow any individual to create an account. Misconfiguration of public providers may grant unwanted users access to your enrollment. Proceed with caution.
:::

## Network egress

Egress calls are required for OIDC authentication and metadata collection. You can select an egress policy or [configure a network egress policy](/docs/foundry/administration/configure-egress/).

## OIDC concepts

The following section will outline the OIDC authentication concepts that are common in Foundry.

### Redirect URL

The redirect URL needs to be registered with the OIDC provider. It allows the provider to communicate the result of the authorization request back to Foundry. The provider includes the redirect URL in the authorization request that is sent to the end-user, and the end-user is redirected to this URL during authorization. Foundry can then handle the response from the provider.

### Logout URL

Foundry provides front-channel and back-channel URLs. Which logout URL is registered with the OIDC provider is dependent on desired logout behavior.

### OIDC integration metadata

The OIDC integration metadata is the information about your identity provider that is passed to Foundry. Foundry can automatically fetch the required metadata fields if provided with the metadata discovery URI.

Alternatively, you can provide the required metadata manually. This information includes:

* **Issuer:** This is the URL of the OIDC provider, which identifies the provider and its location. Foundry uses this URL to locate the OIDC discovery document, which among other things can specify the provider's OIDC endpoints, claims, supported scopes, and public keys.
* **Authorization endpoint:** The provider's authorization endpoint, which is used to redirect the end-user to obtain an authorization code.
* **Token endpoint:** This provider's token endpoint, which is used to exchange an authorization code for an access token and ID token.
* **JWKS URI:** This is the URL of the provider's JSON Web Key Set (JWKS) document, which contains the public keys used to verify the signatures of the ID token.
* **User info endpoint** (if applicable): The provider's user info endpoint, which is used to retrieve the end-user's profile information. This endpoint is not supported by all providers and is required by some providers that do support it.
* **End session endpoint** (optional): The provider's end session endpoint, which is used to log the end-user out of the provider's session. This endpoint is optional and may not be supported by all providers.

### Client credentials

The client credentials refer to the client ID and client secret that are issued by the OIDC provider to Foundry. These credentials are used by Foundry to authenticate to the provider and obtain access to the end-user's resources.

Obtaining these credentials differs across providers, so check your provider’s documentation.

### Authentication method

Select how Foundry can authenticate requests to the token endpoint. The options are:

* HTTP basic authentication scheme.
* POST: Include credentials as form values in the request.

### Scopes

OIDC scopes determine what information is included in the ID token and user info responses. Each scope returns a set of user attributes (i.e. claims).

The `openid`, `email`, and `profile` scopes must be included.

### Email domains

These are the email domains associated with the configured authentication provider. These domains restrict who can log in with this provider and determine if a user is presented this provider as an option during login.

### Supported hosts

Supported hosts are used to ensure the integration is only presented to users that log in using these hosts.

You can choose from the hosts configured for your enrollment.

### Attribute mapping

Map the attributes defined in your identity provider to their representation in Foundry.

#### User attributes

User attributes, also called "claims", include fields such as name, email, and other available additional information. These attributes are sent in a map of attribute key to value or values, for example `email → user@example.com`.

For Foundry to have the correct values for user attributes, you must map identity provider attributes, also called "claims", to matching Foundry attributes. Foundry requires the following mappings:

* **ID:** Set to `sub` by default, but can be changed to a different stable identifier. This value should always be present on OIDC assertions and has a static unique value. Note that if you are setting up a Microsoft Entra ID OIDC provider, set this value to `oid` instead, as Entra does not send the `sub` value in SCIM requests.
* **Username:** Set to `preferred_username` by default. You can change the value to a different human-readable attribute.
* **Email:** Set to `email` by default. This should be mapped to the email attribute.
* **First name:** Set to `given_name` by default. This should be mapped to the first name attribute.
* **Last name:** Set to `family_name` by default. This should be mapped to the last name attribute.

You can create additional mappings to set more user attributes in Foundry by selecting **Add attribute mapping**. Input the attribute name in Foundry in the left field, and the path to claim in the JSON Web Token (JWT) in the right field.

For advanced usage, JSONPath syntax is supported to specify paths to claims in the JWT returned by your provider. By default, claim values will be extracted as a single string. Append `[*]` to the end of the path to extract the values individually. Example: `groups` could extract `"[group1, group2]"`, whereas `groups[*]` would extract `["group1", "group2"]`.

Each mapping has a toggle in Foundry where you can choose the behavior when an attribute has multiple values in the OIDC response. The options are:

* **First:** Populate the attribute with the first value received.
* **All:** Populate the attribute with all the values received.

You can import a user's provider groups by checking the box labeled **Import user groups from the identity provider** and providing the appropriate path to claim in the JWT corresponding to the user groups. When a user logs in, every value for the configured attributes will be mirrored as provider groups, and the user will be enrolled as a member. With this box unchecked, provider group membership will not be kept up to date on login. If you decide to keep this unchecked, we recommend enabling [SCIM](/docs/foundry/authentication/scim-overview/) to update provider group membership without requiring interactive login.

### Advanced settings

#### Prompts (optional)

The prompt parameter is used to request that the user be prompted to perform a specific action during authentication. The possible values for the prompt parameter are:

* `none`: no further user input is required for authentication.
* `login`: users will be prompted to enter their credentials in order to be authenticated.
* `consent`: users will be prompted to grant consent for authentication to be completed.
* `select_account`: users will be prompted to select the account they want to use for authentication. This is typically used when users have multiple accounts with the same provider.

You can select multiple prompts. The default behavior if no prompts are selected depends on the provider.

#### Asynchronous user managers

Asynchronous user managers (AUMs) are configurable extra steps in the login flow. Expand **Asynchronous user managers** to view the available AUMs.

#### Checkpoints Login

Creating a [Login checkpoint](/docs/foundry/checkpoints/overview/) redirects users at the time of login to a configurable prompt that asks for a justification before allowing the login to proceed. To enable a Login checkpoint, first toggle on the **Checkpoints Login AUM**, and then follow the steps to [create a checkpoint](/docs/foundry/security/requesting-justification-for-sensitive-actions/).
