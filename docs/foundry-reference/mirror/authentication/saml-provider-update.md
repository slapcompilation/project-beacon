<!-- source: https://palantir.com/docs/foundry/authentication/saml-provider-update/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Update SAML provider in Control Panel

Moving from one SAML identity provider to another requires a workflow beyond creating and disabling SAML providers in Control Panel. You will need to complete the in-place SAML provider or external-to external SAML provider update process. When users log into Foundry using the new SAML provider, Foundry will provision a new, duplicate user account for them. Groups coming from the new provider will be duplicated as well. Some consequences of not performing a proper provider update include:

* Users will lose access to their previous home folder since they will get a new home folder.
* Users will lose access to anything that was shared with them, either directly or through groups coming from the previous provider.
* There will be duplicate users and groups in sharing dialogs, which can create confusion.

To prevent the above issues, users must be migrated from the old SAML provider to the new SAML provider before switching over to using the new provider. There are two options for this:

## In-place SAML provider update

This is the simplest option and should be taken only if the current and target identity providers share the same attributes. In particular, the value to which the ID attribute maps *must not change* or users will get an entirely new account provisioned in Foundry.

![ID attribute](./images/id-attribute-mapping.png)

:::callout{theme="neutral"}
If the ID attributes of incoming users or groups in the new identity provider are different from existing ID attributes, follow the external-to-external SAML provider update process.
:::

Follow these steps to perform an in-place SAML provider update:

1. From Control Panel, navigate to the **Authentication** tab under **Enrollment Settings**. Find the SAML provider you want to update, then click on the **Actions** dropdown and select **Manage**.

   ![Manage provider](./images/manageProvider.png)

   In the **SAML** section, select **Manage**.

   ![Manage SAML](./images/manageSAML.png)

2. Download the **[SAML integration metadata XML](/docs/foundry/authentication/saml-getting-started/#saml-integration-metadata)**. Update your SAML application on the identity provider side.

3. Under **Identity provider metadata**, upload your new identity provider federation metadata file to Control Panel.

4. **[Test](/docs/foundry/authentication/test-provider-integration/#test-integration)** that the new integration works as expected and that user attributes do not change and users do not get a new Foundry account provisioned.

## External-to-external SAML provider update

Follow these steps to perform an external-to-external SAML provider update:

1. From Control Panel , navigate to the **Authentication** tab under **Enrollment Settings**. Under **Authentication providers**, select **Add provider** and add the new provider.

   ![Add provider](./images/addProvider.png)

   Learn more about [configuring SAML 2.0 integration](/docs/foundry/authentication/saml-getting-started/#configure-saml-20-integration) to add a new SAML provider.

2. **[Test](/docs/foundry/authentication/test-provider-integration/#test-integration)** the new SAML integration using a test account.

3. Disable the integration temporarily to avoid having duplicate providers enabled at the same time.

4. Contact your Palantir representative for help migrating users from the old provider to the new provider.
