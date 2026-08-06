<!-- source: https://palantir.com/docs/foundry/ontology-sdk/deploy-osdk-application-on-foundry/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Host an OSDK application on Foundry

The web hosting feature in Developer Console adds the option for developers building frontend-only applications using the OSDK to host these applications on Foundry, removing the need for additional hosting infrastructure.

The web hosting feature only supports hosting static assets and does not support running a server, similar to GitHub Pages. This means you can host:

* HTML, CSS, and JavaScript files
* Single-page applications (React, Vue, Angular, etc.) that run entirely in the browser
* Images, fonts, and other static resources

You cannot use this feature to run server-side code such as Node.js backends, Python servers, or server-side rendering. Your application must make API calls to Foundry via the OSDK or other external services for any server-side functionality.

:::callout{theme="neutral"}
Website hosting is only available for applications configured as a **Client-facing application**. If your application is also configured as a **Backend service**, the website hosting option will not appear because this combination creates a confidential client intended for server-side applications.
:::

Each hosted website can be served from either a subdomain of your Foundry enrollment domain or a custom domain that you own. By default, you will choose a subdomain and your application will be served from `<YOUR-APPLICATION-SUBDOMAIN>.[YOUR-ENROLLMENT].palantirfoundry.com`. Alternatively, you can host your application on a custom domain such as `[your-organization].com`. See [Host your website on a custom domain](#host-your-website-on-a-custom-domain) for more details.

:::callout{theme="warning"}
If your Foundry enrollment is not served from a domain ending with `.palantirfoundry.com`, contact Palantir Support to help set up web hosting as additional coordination is required.
:::

## Prepare your application

The following section describes the steps required to host your Developer Console application on Foundry.

### Single-page application rendering

If you do not include a [custom 404 page](#custom-404-page) in your application, Foundry will assume this is a [single-page application ↗](https://en.wikipedia.org/wiki/Single-page_application) and will route any request to a path under this subdomain to the `index.html`.

### Updating the redirect URL

As part of the authentication flow, you will need to update the redirect URL to include your hosting domain followed by `/auth/callback`. If you are using an enrollment subdomain, this will be `<YOUR-APPLICATION-SUBDOMAIN>.[YOUR-ENROLLMENT].palantirfoundry.com/auth/callback`. If you are using a custom domain, this will be `<YOUR-CUSTOM-DOMAIN>/auth/callback`.
You must also add the same redirect URL to your application in Developer Console. Review [create a new OSDK](/docs/foundry/developer-console/create-application/) for more information.

### Prepare the asset

Compress the content of the directory containing a production build of your website files. **Do not** include the directory itself. The directory is typically `dist/` for common web frameworks.

If you include any directories in your compressed file, these directories will be included in the path to your website.

## Set up the domain

From within your application on Developer Console, choose **Website hosting** on the left side menu.

## Host your website on a subdomain

To host your website on a subdomain of your enrollment's domain, follow the steps below.

1. Select the subdomain for your application; this may be the application name or any other name you choose. Then, select **Request application domain**. In the example below, we are selecting `my-first-hosted-app.example.palantirfoundry.com`: <br><br>
   ![The domain request interface shows the subdomain field and request button.](./images/web-hosting-domain-request.png) <br><br>

2. Request approval from an **Information Security Officer** in your enrollment, or approve it yourself if you have the necessary permissions by selecting **View request**. An enrollment administrator can manage enrollment permissions in Control Panel. <br><br>
   ![The domain status shows pending approval with a view request link.](./images/web-hosting-domain-pending.png) <br><br>

3. After the request is approved, refresh the page. At this point, **Domain ready** should now appear, indicating the domain is prepared for use. This may take a few minutes to complete. <br><br>
   ![The domain status shows ready after approval is complete.](./images/web-hosting-domain-ready.png) <br><br>

## Host your website on a custom domain

Instead of using an enrollment subdomain, you can host your application on a custom domain that you own, such as `[your-organization].com`. This is useful when you want your application to be accessible from a branded or public-facing domain.

:::callout{theme="neutral"}
Custom domain hosting may not be available on all enrollments. If the option does not appear in your Developer Console application, contact your Palantir representative for assistance.
:::

### Prerequisites

Before requesting a custom domain for your application, ensure that a certificate covering your domain has been created in Control Panel. If no certificate exists for the domain, the approval request will not succeed. See [Configure domains and certificates](/docs/foundry/administration/configure-domains-and-certificates/) for instructions on creating certificates.

### Request a custom domain

From within your application on Developer Console, choose **Website hosting** on the left side menu.

1. Select **Request to host on a custom domain**. This option appears below the enrollment subdomain registration form. <br><br>
   ![The domain request interface shows the subdomain field and the option to host on a custom domain.](./images/web-hosting-with-custom-domain.png) <br><br>

2. In the dialog that appears, enter your custom domain (for example, `[your-organization].com`), a request title, and an optional description. Then select **Request**. <br><br>
   ![The custom domain request interface shows fields for the custom domain, the request title, and the request description.](./images/web-hosting-custom-domain-request.png) <br><br>

3. This creates an approval task that must be approved by an **Information Security Officer** in your enrollment. You can select **View** in the success notification to navigate to the approval request in Control Panel. <br><br>
   ![The custom domain request interface shows that the custom domain you requested is not yet approved.](./images/web-hosting-custom-domain-not-yet-approved.png) <br><br>

4. After the request is approved, the custom domain is associated with your application. You may need to refresh the page for the updated status to appear. Note that the domain you used to log into Foundry will be associated with the custom domain you have configured. In other words, network ingress and authentication provider configuration will be inherited from this domain. <br><br>
   ![The custom domain request interface shows that the custom domain you requested has been approved.](./images/web-hosting-custom-domain-ready.png) <br><br>

:::callout{theme="warning"}
You must also update the DNS settings for your custom domain to point to your Foundry environment. See [Configure domains and certificates](/docs/foundry/administration/configure-domains-and-certificates/#5-update-the-domain-name-server-dns) for guidance on updating DNS records.
:::

## Upload your assets and deploy

As a developer, you can choose between uploading assets manually using the Developer Console website hosting user interface or by using the `@osdk/cli` command line tool.

* To learn how to upload using the Developer Console user interface, follow the guide [below](/docs/foundry/developer-console/deploy-custom-application-on-foundry/#upload-assets-using-the-developer-console).
* To learn how to upload assets using the command line interface, follow the **Deploying applications** guide in the platform, as shown in the screenshot below. You can find more details on the `@osdk/cli` command line tool in the [public npm repository ↗](https://www.npmjs.com/package/@osdk/cli). <br><br>
  ![The deploying applications guide shows CLI deployment commands.](./images/deploy-cli-guide.png) <br><br>

### Upload assets using the Developer Console

In the following step, we take the compressed asset created [earlier](/docs/foundry/developer-console/deploy-custom-application-on-foundry/#prepare-the-asset) and upload it to Foundry.

1. Select **Upload new asset** in the **Assets** section on the page.

2. Drop your zip archive file here, or choose from your computer and select **Upload**. <br><br>
   ![Upload asset to web hosting.](./images/web-hosting-asset-upload.png) <br><br>

3. Once the upload is complete, use **Preview** to preview your site before deploying to production or use the **...** option to **Deploy to production**, as shown below. <br><br>
   ![Preview version.](./images/web-hosting-asset-preview.png) <br><br>

   Once you select **Deploy to production**, that version will serve all users. We recommend to first **Preview site**.

4. Now, select **View site** to visit the deployed site. <br><br>
   ![View deployed site.](./images/web-hosting-deployed-site.png) <br><br>

## Grant website access

Websites hosted by Foundry will only be available for users with Foundry login credentials. By default, any user that has access to your Developer Console application will also have access to the deployed site, but this is likely to include only you and your development team.
To make your site accessible to other Foundry users, navigate to the **Sharing & Tokens** menu to the left. Add the names of the users under the **Share hosted website** section of the page, as shown below.

![Share application with users.](./images/web-hosting-share.png)

## Advanced configuration

You can find additional configuration options in the **Advanced** tab of the **Website hosting** page.

### Content security policy

By default, your application will be served with a restricted [Content Security Policy (CSP) ↗](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) which only allows for loading resources from your subdomain. If needed, you can configure additional CSP rules for specific interactions within your application and they will be merged with the default policy. However, be aware that making these changes can increase your application's vulnerability to Cross-Site Scripting (XSS) and data injection attacks.

From within the **Content Security Policy** section, shown in the image below, you can control the CSP for your application. Updating the CSP is crucial when retrieving images or content hosted elsewhere and when making calls to external services.

![Content security policy edit.](./images/web-hosting-csp-config.png)

See [Mozilla's documentation ↗](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) for help with syntax. There is no validation for these fields.

## Route matching rules

Foundry supports serving HTML pages on routes both with and without extensions and trailing slashes.

Given the following layout of website files:

```
├── file.html
├── folder
│   └── index.html
├── both.html
└── both
    └── index.html
```

Foundry serves these HTML pages on the following routes:

| Route              | File               |
| ------------------ | ------------------ |
| /file              | /file.html         |
| /file/             | /file.html         |
| /file.html         | /file.html         |
| /folder            | /folder/index.html |
| /folder/           | /folder/index.html |
| /folder/index.html | /folder/index.html |
| /both              | /both.html         |
| /both.html         | /both.html         |
| /both/             | /both/index.html   |
| /both/index.html   | /both/index.html   |

Foundry does not redirect to a preferred route format such as enforcing trailing slashes or removing extensions from the route.

## Custom 404 page

You can add a `404.html` page to the root of the website to serve as a custom error page when routes are not matched. This will disable the default behavior to serve the root `index.html` page for unmatched routes described in [single-page application (SPA) rendering](#single-page-application-rendering).
