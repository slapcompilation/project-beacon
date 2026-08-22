<!-- source: https://palantir.com/docs/foundry/analytics-connectivity/tableau-oauth-setup/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Tableau OAuth setup

Tableau supports authenticating to Foundry via OAuth. This means that users will not need to manually enter a token, but can instead be prompted to log in to Foundry through a web browser. See Tableau's [OAuth Connections ↗](https://help.tableau.com/current/server/en-us/protected_auth.htm) article for an overview of OAuth in Tableau.

:::callout{theme="neutral"}
Foundry administrator permissions are required to enable this OAuth integration. Additionally, if you are enabling the OAuth integration for Tableau Server, Tableau administrator permissions are required, and Tableau Server must be restarted.
:::

***

## Part 1: Enable the OAuth client for Tableau Desktop

1. Follow [the instructions](/docs/foundry/platform-security-third-party/third-party-apps-overview/#accessing-the-third-party-applications-user-interface) to access the **Third-party applications** configuration page in Control Panel.
2. Find **Tableau Desktop** in the list of applications; from the **Actions** menu, select **Enablement settings**.
3. Enable the application using the toggle switch.

:::callout{theme="neutral"}
When Tableau users authenticate to Foundry using OAuth, individual user permissions are enforced. If you used the [Project access](/docs/foundry/platform-security-third-party/enabling-3pa-access/#project-access) or [Marking restrictions](/docs/foundry/platform-security-third-party/enabling-3pa-access/#marking-restrictions) panels to configure restrictions for the third-party application, these restrictions apply on top of the user's individual permissions.
:::

At this point, Tableau Desktop users can follow [the instructions](/docs/foundry/analytics-connectivity/tableau-getting-started/#foundry-oauth-authentication) to authenticate to Foundry using OAuth.

## Part 2: Configure an OAuth client for Tableau Server

Follow the instructions below to enable OAuth authentication for reports published to Tableau Server.

### Step 1: Register a third-party application for Tableau Server

On the same **Third-party applications** page as above, select **New application** to create a new third-party application:

1. At the **Details** step, name the application `<ORGANIZATION> Tableau Server`, substituting your own organization name.
2. At the **Client type** step, select **Confidential client**.
3. At the **Authorization grant type** step, select **Authorization code grant** and set the **Redirect URL** to `https://<YOUR_SERVER>/auth/add_oauth_token`, where `<YOUR_SERVER>` is your Tableau Server hostname.

Create the app and securely store the client ID and secret.

### Step 2: Configure Tableau Server

Run the following command on the server, substituting your client ID, secret, and redirect URL from the previous step:

```
tsm configuration set -k oauth.config.clients -v "[{\"oauth.config.id\":\"FoundryJdbc\", \"oauth.config.client_id\":\"<YOUR_CLIENT_ID>\", \"oauth.config.client_secret\":\"<YOUR_CLIENT_SECRET>\", \"oauth.config.redirect_uri\":\"https://<YOUR_TABLEAU_SERVER>/auth/add_oauth_token\"}]" --force-keys
```

### Step 3: Restart Tableau Server

Restart Tableau Server by running:

```
tsm pending-changes apply
```

***

## Usage

### Tableau Desktop

From within Tableau Desktop, users will now be able to follow [the instructions](/docs/foundry/analytics-connectivity/tableau-getting-started/#foundry-oauth-authentication) to authenticate via the **Foundry OAuth** authentication option.

### Tableau Server

When publishing to Tableau Server, it is possible to configure the report to prompt viewers to authenticate via OAuth when opening the report. This way, live queries will run using the viewer's permissions.

To configure this, develop the report in Tableau Desktop using the **Foundry OAuth** authentication option. When you are ready to publish, choose the **Prompt** option for authentication. When a user views the report on Tableau Server, live connections will refresh using the viewer's credentials.
