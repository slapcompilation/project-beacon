<!-- source: https://palantir.com/docs/foundry/authentication/scim-other-idp/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Using other identity providers

Foundry implements the standard SCIM 2.0 protocol, so it is not limited to the identity providers documented here. Any identity provider that supports SCIM 2.0 can be configured to provision users and groups to Foundry.

This documentation provides detailed steps for Microsoft Entra ID because it is a commonly used provider, and because its setup flow is representative of what you encounter elsewhere. If you use a different provider, you can follow the same general approach: determine if you should use a subdomain, configure ingress, point your provider's SCIM client at the Foundry SCIM endpoint, authenticate using the OAuth 2.0 client credentials grant, and map your provider's user and group attributes to the attributes Foundry expects that match your attribute mapping in Control Panel.

Keep in mind that while SCIM 2.0 provides a standard protocol, providers differ in how they implement and expose it. The specific terminology, configuration screens, supported attributes, and available provisioning options vary from one provider to another, and some providers may not support every part of the specification. As a result, the exact steps for your provider may differ from those documented here, and you may need to consult your provider's SCIM documentation to complete the setup.
