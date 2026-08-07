<!-- source: https://palantir.com/docs/foundry/slate/applications-types/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Application types

Slate supports two types of applications: Integrated applications and public applications.

* [Integrated applications](#integrated-applications)
* [Public applications](#public-applications)
  * [Limitations](#limitations)
  * [Permissions](#permissions)

## Integrated applications

In most cases, you will want to create an integrated application. An integrated Slate application can make use of the Foundry ecosystem to create widgets, use functions, configure Events and Actions, and more. Integrated applications are published to Foundry users within your Organization and can be viewed or edited based on user permissions.

Learn more about how to [create an integrated application](/docs/foundry/slate/applications-create/#create-an-integrated-application).

## Public applications

Slate supports "public" applications, meaning Slate applications that can be used by individuals without Foundry accounts. Public applications allow users without Foundry accounts to submit information, upload data, or upload files into Palantir Foundry, subject to validation logic and other safety measures.

Uploaded data from public applications can directly feed into pipelines without the need to set up additional data connections to external systems. Developers can build and publish public applications to facilitate highly-customized workflows for partners, vendors, or employees who do not have Foundry accounts.

With Slate, you can develop public applications without the need to configure servers, DNS, or authentication, all while leveraging Slate's toolset of widgets, custom CSS overrides, functions, and events.

Learn more about how to [create a public application](/docs/foundry/slate/applications-create/#create-a-public-application).

### Limitations

Public Slate applications are not able to read data and resources outside of the application itself. The application cannot access objects, datasets, actions, or files (like stored images or videos). Therefore, widgets and components that require access to other elements of the platform are not available in public Slate applications. All data and resources required for the Slate application need to be stored in the Slate application itself. Images, fonts, and other resources can be stored in the Slate application by encoding them in base64.

Example 1: Images encoded via base64 can be added with the image tag in HTML. Rather than the source tag being a URL, the tag needs to be configured to display an encoded image, like the following:

```
<image src="data:image/png;base64,<<base64_code>>">
```

Example 2: Fonts encoded in base64 can be added in the Styles panel in Slate. While web fonts are available as-is, custom fonts need to be declared within the app as shown below. Once the font has been added, it can be used anywhere in the application via the font family name.

```
@font-face {
    font-family: '<<font_name>>';
    src: url(data:application/font-woff2;charset=utf-8;base64,<<base64_code>>) format('woff2'),
    }
```

### Permissions

Public Slate applications require an additional set of permissions to create and edit files beyond existing file and project permissions. In order to create or edit public applications, users require access to the **Manage public Slate applications** workflow, grantable through Control Panel's **Organization permissions** settings found in the **Security and governance** section.

Once published, non-Foundry users have view-only access to the published Slate application using the public link.

The application is hosted in the same network as Foundry itself, therefore users require access to the Foundry instance in order to see public applications. Foundry instances only accessible via a restricted network are not able to publish applications to the web.

As public applications are not indexed by search engines by default, non-Foundry users will need to be provided with the link in order to access the application.
