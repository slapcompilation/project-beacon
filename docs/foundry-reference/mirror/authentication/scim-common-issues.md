<!-- source: https://palantir.com/docs/foundry/authentication/scim-common-issues/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Common questions and issues

##### **I want to rely only on SCIM to keep my group membership up to date, rather than SCIM + SSO. Is this possible?**

Yes. In the **Attribute mapping** section of your authentication provider settings in Control Panel, uncheck the box labeled **Import user groups from the identity provider**. With this box unchecked, identity provider group membership will no longer be updated on login, and any existing membership will remain until the next SCIM update. Note that for some identity providers, SCIM requests are not sent synchronously with updates in the identity provider, so a user's group membership could become stale. If you use group membership for permissioning in the platform, consider whether this is a risk you are willing to take.

##### **Do organization assignment rules run for users created via SCIM?**

If you have organization assignment rules that use *externally managed groups* to triage users into an organization, these rules will not be run when SCIM originally provisions a user (either from the initial sync or for a subsequent create request). Users will need to manually log into Foundry, or SCIM will need to send an `updateUser` request, for these rules to run and users to be triaged appropriately. This is because when SCIM creates a user, it does not update group membership immediately, so Foundry is unable to conduct organization assignment based on identity provider groups.

Similarly, when SCIM updates group membership for externally managed groups, organization assignment rules will not execute for those users whose membership was updated. In other words, for organization assignment rules that rely on externally managed group membership to run, users will need to manually log into Foundry or have some other update to the user (for example, username changes) that triggers a SCIM `updateUser` request.

##### **Are nested groups supported?**

Do not attempt to sync nested groups, as Entra ID does not allow provisioning nested groups via SCIM (see relevant [documentation ↗](https://learn.microsoft.com/en-us/entra/identity/app-provisioning/how-provisioning-works#assignment-based-scoping)). This is to maintain equivalency with claims sent in an interactive login, where group membership is flattened.

##### **Are audit logs available for SCIM requests?**

Foundry has error logs when requests fail, but the best way to audit successful SCIM events is to look at the provisioning logs in your identity provider.

##### **Does Foundry support the bearer authentication method for SCIM requests?**

Not by default. The OAuth2 Client Credentials grant adds significant security improvements over bearer authentication, and is the authentication method that is required for SCIM unless in exceptional circumstances. If you need to use bearer authentication, contact Palantir Support.

##### **I am getting the `SystemForCrossDomainIdentityManagementCredentialValidationUnavailable` error (with error message `An error occurred while sending the request`) in Entra ID when attempting to test the connection. What do I do?**

You may need to set up an Azure Front Door Proxy. Entra's SCIM provisioning agent uses a specific set of egress IPs and routing that sometimes cannot establish a TCP/TLS connection to certain endpoints. Contact Palantir Support for additional information.

Occasionally, the error received will be `Unable to connect to remote server`. The same steps may be needed in this scenario as well.

##### **After SCIM provisioning has begun, I receive the error message `Cannot complete login for your user with username [username] and provider user ID [provider user ID] because that username is already being used by the user with user ID [existing user ID] and provider user ID [existing provider user ID].` How do I resolve this?**

This is likely due to a mismatch between the value that is mapped to `externalId` in your SCIM provisioning settings and the value that is mapped to `Provider ID` in Control Panel attribute mapping. These values must send the same value. Updating the value sent as `externalId` in your identity provider and waiting for an additional SCIM sync should resolve the issue.

If you run into any other issues, contact Palantir Support.
