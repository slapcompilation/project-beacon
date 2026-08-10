<!-- source: https://palantir.com/docs/foundry/sap/oauth2-writeback/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# User-attributed SAP writeback with OAuth 2.0

This page contains instructions for [setting up the OAuth 2.0 server in SAP](#setting-up-the-oauth-20-server-in-sap) and [setting up the OAuth 2.0 client in Foundry](#setting-up-the-oauth-20-client-in-foundry).

## Setting up the OAuth 2.0 server in SAP

### Prerequisites

* SP21 or above of the Palantir Foundry Connector 2.0 for SAP Applications ("Connector")
* The Foundry technical user in SAP should be a `SYSTEM` user
* `/PALANTIR/OAUTH_CLIENT` should be assigned to the Foundry technical user and any end users wishing to write back to SAP from Foundry
* `/PALANTIR/CONTENT_FUNCTION_ALL` should be assigned to end user
* All services under the `/sap/public/bc`  node to be activated (for OAuth 2.0 configuration)
  * `/sap/bc/sec/oauth2*`
  * `/default_host/sap/bc/webdynpro/sap/oauth2_authority`
* SAP Gateway is active
* SAP\_BASIS (the technical component version, applicable to both SAP NetWeaver and SAP S/4HANA systems) 7.4 SP09 or above (support for OAuth 2.0 and OData)

### Reference

* [Note 1688545 - OAuth 2.0 Server in AS ABAP troubleshooting ↗](https://me.sap.com/notes/1688545) (SAP login required)
* [Help: OAuth 2.0 Server for AS ABAP ↗](https://help.sap.com/viewer/3c4e8fc004cb4401a4fdd737f02ac2b9/7.5.9/en-US/4bd73e2050e84ce99b2d781687e0c62d.html)

### OAuth 2.0 configuration

1. Run the `SOAUTH2` transaction.
2. Select **Create...**.
3. Enter the username of the Foundry technical user as the **OAuth 2.0 Client ID**.
4. Select **Next >**.
5. Enter the username of the Foundry technical user as the **User ID**.
6. Ensure **Client User ID and Password** and **SSL Client Certificate** are both checked.
7. Select **Next >**.
8. Set the **Redirect URI** as `https://<FOUNDRY_DOMAIN>/workspace/oauth2-clients/callback`.
9. Select **Next >**.
10. Add a **Scope Assignment** with an **OAuth 2.0 Scope ID** of `/PALANTIR/SRV_0001` and a description such as `Palantir Foundry writeback using SAP functions`.
11. Select **Next >** and then **Finish**.

### OData configuration

1. In the **Maintain service** page within SAP, follow the hierarchy of services to find **opu > odata > palantir**.
2. Right-click on **palantir** and select **Activate Service**.
3. Select **Yes** when prompted.
4. On the **Create/Change a Service** tab, select **GUI Configuration** under **Interactive Options**.
5. Add parameter with name `~CHECK_CSRF_TOKEN` and value `0` (zero).
6. Disable CSRF\_TOKEN validation as outlined here: https://help.sap.com/doc/saphelp\_hba/1.0/de-DE/e6/cae27d5e8d4996add4067280c8714e/content.htm
7. Run the `/IWFND/MAINT_SERVICE` transaction.
8. Select **Add System Alias** under **System Aliases**.
9. Add a system alias with the following values:
   * **Service Doc. Identifier:** `/PALANTIR/SRV_0001`
   * **User Role:** blank
   * **Host Name:** blank
   * **SAP System Alias:** `LOCAL`
   * **Metadata Default:** unchecked
   * **Default System:** checked
   * **Tech. Svc. Name:** `/PALANTIR/SRV`
   * **Ext. Service Name:** `ODATA_SRV`
   * **Version:** `1`
   * **User Name:** blank

## Setting up the OAuth 2.0 client in Foundry

This follows the general approach outlined in [Configure outbound applications](/docs/foundry/administration/configure-outbound-applications/) but has been tailored specifically to SAP systems.

### Outbound application setup

1. Navigate to Control Panel and select **Outbound applications** under **Organization settings**.
2. Select **New application**.
3. Provide an **Application name**, for example, the name of your SAP system.
4. Set the **Approval prompt** to describe the authorization action, for example, `Allow Foundry to act on your behalf in SAP?`.
5. Under **OAuth 2.0 server connection**, select the **Foundry Worker** option.
6. Set the **Authorization page URL** to the SAP OAuth 2.0 authorization endpoint:

```
https://<SAP_DOMAIN>/sap/bc/sec/oauth2/authorize
```

7. Set the **Token endpoint URL** to the SAP OAuth 2.0 token endpoint:

```
https://<SAP_DOMAIN>/sap/bc/sec/oauth2/token
```

8. Under **Egress policy**, select an [agent proxy egress policy](/docs/foundry/administration/configure-egress/#agent-proxy-egress-policies) that routes traffic through a [Data Connection agent](/docs/foundry/data-connection/core-concepts/#agents) installed in your network with access to the SAP system.

![An outbound application configured with the Foundry Worker option, SAP authorization and token endpoint URLs, and an agent proxy egress policy.](/docs/resources/foundry/sap/sap-outbound-app-foundry-worker.png)

9. Under **OAuth 2.0 settings**, set the **Client ID** to the client ID from the SAP OAuth 2.0 server configuration. Under **Scopes**, add `/PALANTIR/SRV_0001`.
10. Save the outbound application.
11. This outbound application can now be used when creating an SAP webhook.

For more details on outbound application configuration options, see [Configure outbound applications](/docs/foundry/administration/configure-outbound-applications/#configuration-options).

### (Legacy) Webhook-based OAuth 2.0 configuration

:::callout{theme="warning" title="Legacy"}
The webhook-based OAuth 2.0 configuration described below is in the [legacy](/docs/foundry/platform-overview/development-life-cycle/) phase of development and no additional development is expected. Use the [standard outbound application setup](#outbound-application-setup) above instead. For more information on the legacy approach, see [(Legacy) Custom webhook-based OAuth 2.0 handshakes](/docs/foundry/administration/configure-outbound-applications/#legacy-custom-webhook-based-oauth-20-handshakes).
:::

Previously, configuring OAuth 2.0 for SAP required creating a dedicated REST API source with webhooks to handle the token and refresh flows manually. If your existing SAP integration uses this approach, it will continue to work. However, for new configurations, use the [standard outbound application setup](#outbound-application-setup) above.

#### Source connection setup

:::callout{theme="warning" title="Warning"}
Ensure that the SAP source URL is using HTTPS, or webhooks will fail when using an OAuth flow.
:::

1. Create a new **REST API** source.

![Create REST API source](/docs/resources/foundry/sap/create-rest-source.png)

2. Configure the source with the base domain URL and port used for the SAP source.
3. Select **Basic** authentication and add the username and password used to connect to SAP.

![Configure REST API source](/docs/resources/foundry/sap/configure-rest-source.png)

4. Save the source.

#### OAuth 2.0 authorization flow webhook setup

:::callout{theme="warning" title="Webhooks published as functions are incompatible"}
Webhooks published as functions cannot be used in legacy custom webhook-based OAuth 2.0 outbound applications. When creating your token and refresh webhooks, ensure function publishing is disabled.
:::

1. On the overview page of the new **REST API** source, select **Create webhook**.

2. Give the webhook a name (such as `SAP OAuth2 authorization code flow webhook`). Ensure that **Function Configuration** is toggled off.

3. Advance to the **Request configuration** step.

4. Under **Calls**, select **POST** as the request type and enter `sap/bc/sec/oauth2/token` as the path.

5. Under **Query Params**, `sap-client` might have to be set if the client used is not the default client.

![Webhook calls](/docs/resources/foundry/sap/webhook-calls.png)

6. Scroll down to **Input Parameters** and add the following three parameters (all string type):

* `redirect_uri`
* `client_id`
* `authorization_code`

![Webhook input parameters](/docs/resources/foundry/sap/webhook-input-parameters.png)

7. Scroll back up to **Calls** and select the **Body** tab.
8. Choose **Form URL Encoded** and add the following four entries:

* `grant_type` → `authorization_code`
* `redirect_uri` → Mapped to the `redirect_uri` input parameter (see below for how to do this)
* `client_id` → Mapped to the `client_id` input parameter
* `code` → Mapped to the `authorization_code` input parameter

9. To map an input parameter, type **@** into the field and then select **Input Parameter**. Find the relevant parameter, select it and then select **Add** beneath.

![Input parameter mappings](/docs/resources/foundry/sap/webhook-mappings.png)

10. The finished **Body** configuration should look like this:

![Webhook body](/docs/resources/foundry/sap/webhook-body.png)

11. Advance to the **Responses** step.
12. Create the following five **Output Parameters**. All should be of type string and should be extracted by key from the response.

* `access_token`
* `token_type`
* `expires_in`
* `refresh_token`
* `scope`

This is an example for creating `access_token`. All output parameters should follow this pattern.

![Webhook output parameter](/docs/resources/foundry/sap/webhook-output.png)

13. Save the webhook by selecting **Create webhook and continue**.

#### OAuth 2.0 refresh flow webhook setup

1. Create a new webhook from the **REST API** source.
2. Give the webhook a distinct name (such as `SAP OAuth2 refresh flow webhook`). Ensure that **Function Configuration** is toggled off.
3. The request method should again be set to **POST** and the same path (`sap/bc/sec/oauth2/token` ) should be used.
4. As with the previous webhook, set `sap-client` as a **Query Param** if needed.
5. On the **Headers** tab, add the following header:

* `Content-Type` → `application/x-www-form-urlencoded`

![Refresh webhook header](/docs/resources/foundry/sap/refresh-webhook-header.png)

6. Set up these two **Input Parameters** (both strings):

* `client_id`
* `refresh_token`

7. Then under the **Body** tab, add these three entries:

* `grant_type` → `refresh_token`
* `client_id` → Mapped to the `client_id` input parameter
* `refresh_token` → Mapped to the `refresh_token` input parameter
  ![Refresh webhook body](/docs/resources/foundry/sap/refresh-webhook-body.png)

8. Create exactly the same five **Output Parameters** as for the authorization code flow webhook. All should be of type string and should be extracted by key from the response.

* `access_token`
* `token_type`
* `expires_in`
* `refresh_token`
* `scope`

9. Save the webhook by selecting **Create webhook and continue**.

#### Legacy outbound application setup

1. Navigate to the **Foundry Control Panel** and select **Outbound applications**.
2. Give the application a name then follow the steps outlined under [(Legacy) Custom webhook-based OAuth 2.0 handshakes](/docs/foundry/administration/configure-outbound-applications/#legacy-custom-webhook-based-oauth-20-handshakes).
3. The two webhooks created earlier should be used as the **Token webhook** and **Refresh token webhook** respectively.
4. The **Authorization page URL** should be of the form:

```
https://<SAP_DOMAIN>/sap/bc/sec/oauth2/authorize
```

5. Under **OAuth 2.0 settings**, the **Client ID** should be set to the client ID from the SAP OAuth 2.0 server configuration. Under **Scopes**, add `/PALANTIR/SRV_0001`.
6. Save the outbound application.
7. This outbound application can now be used when creating an SAP webhook.
