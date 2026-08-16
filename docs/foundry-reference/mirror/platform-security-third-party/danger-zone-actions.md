<!-- source: https://palantir.com/docs/foundry/platform-security-third-party/danger-zone-actions/ · mirrored 2026-08-16 from Palantir Foundry docs -->

# Danger zone actions

Foundry platform administrators have access to several “danger zone” actions for third-party applications. These are called “danger zone” actions because they result in irreversible changes to an application’s registration and should be treated with caution due to their potentially widespread and destructive effects. A warning dialog will appear in advance of executing these actions. The available “danger zone” actions are [rotating a client secret](#rotate-a-client-secret) and [deleting an application registration](#delete-an-application-registration).

## Rotate a client secret

You can rotate an application's secret on the [Manage application](/docs/foundry/platform-security-third-party/manage-3pa/) page for [confidential clients ↗](https://tools.ietf.org/html/rfc6749#section-2.1) only. Rotating the secret will require every user to set up the application again, since every client configured with the secret will cease to work given that the rotated secret is invalidated. Rotating secrets should only be done if the secret has become compromised or lost; keep in mind that the application will need to be reinstated after secret rotation.

:::callout{theme="warning" title="Warning"}
When might you want to rotate a secret? Given the consequences of rotating a secret, this is something that should only happen if the secret has been compromised or has become inaccessible.
:::

1. From **Control Panel**, navigate to [Third-party applications](/docs/foundry/platform-security-third-party/third-party-apps-overview/#accessing-the-third-party-applications-user-interface) page.
2. Click **Actions** on the application you want to modify, then click **Manage application**.
3. Scroll down and click on **Rotate secret**.
4. Review the warning dialog prior to confirming the action.
5. Confirm the action and securely store your new client secret as it will not be viewable again at any other time.

## Delete an application registration

1. From **Control Panel**, navigate to [Third-party applications](/docs/foundry/platform-security-third-party/third-party-apps-overview/#accessing-the-third-party-applications-user-interface) page.
2. Click **Actions** on the application you want to delete, then click **Manage application**.
3. Scroll down and click **Delete application**.
4. Review the warning dialog prior to confirming the action.
5. Confirm the action and the application will be deleted. This cannot be undone.
