<!-- source: https://palantir.com/docs/foundry/object-views/config-app-sidebar/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Configure the applications sidebar

The **applications sidebar** is used to display and embed applications, analyses, actions, and other resources related to the current object. The applications sidebar visually differentiates these resources from the main content of that object.

The applications sidebar supports embedding all object-based applications, including [Workshop](/docs/foundry/workshop/overview/), [Quiver](/docs/foundry/quiver/overview/), [Slate](/docs/foundry/slate/overview/), [Action types](/docs/foundry/action-types/overview/), and more. Once added to the sidebar, you can open these applications within the context of the object. The sidebar also allows parameterized URLs to link to other apps and external websites.

In the example below, you can see an `Airport` object. The body tab includes primary information about that object, while related applications include:

* A Workshop Alert Inbox on flights delays, used to triage traffic;
* A Slate application used to manage the airport’s passengers capacity; and
* A dedicated application for airport COVID response.

![Application sidebar in Object View](/docs/resources/foundry/object-views/application-sidebar-object-view.png)

## Set up the applications sidebar

The applications sidebar is an optional, opt-in addition per Object View. The sidebar is not visible to users until you add a group to it. The **Add new group** option can be found under the **Sidebar** tab or by expanding the sidebar itself (as shown in the image below). Once a builder adds applications and/or actions and publishes that version, the sidebar will be displayed to end users. The sidebar will not be displayed if it only contains an empty group or groups.

![Add new application sidebar group in Object View](/docs/resources/foundry/object-views/add-application-sidebar-groups.png)

Once you add applications and/or actions and publish your changes, the sidebar will be displayed to users. The sidebar will not be displayed if it only contains an empty group or groups.

## Edit the Applications Sidebar

The applications sidebar is modular and configurable. The sidebar can be split into groups with different application cards and actions in each group.

The sidebar has a dedicated configuration for each group and application card in the sidebar. As numbered in the images below, options include:

1. Edit the entire group with the following options:
   * (a) Configure the group title
   * (b) Reorder application cards and actions within the group
   * (c) Remove the entire group
   * (d) Edit visibility (make the group visible to only specific user profiles)

2. Edit a specific application card, which opens up a secondary menu enabling you to:
   * (A) Add or change the application resource used for a single card (more details below)
   * (B) Override the title
   * (C) Override the icon
   * (D) Use a thumbnail on the card; thumbnails must be uploaded to Foundry and saved in a folder
   * (E) Select Card mode or Compact mode
   * (F) Add parameters

3. Edit the backing application (this will open the specific module in the source app, such as Workshop or Slate)

4. Add a new application to a group

5. Add a new action to a group

6. Add new groups

<img src="./media/configuring-applications-sidebar_applications-sidebar-config.png" alt="Applications Sidebar Config" width="500" />

## Add/change an application in the sidebar

There are two main ways to add an application to the sidebar:

1. For object applications (Workshop, Quiver, Slate, etc.) embedded an Object View:
   * Select **Add application**, choose an application (e.g., Workshop) to open a resource selector, and select the specific resource (e.g., Workshop module) you would like to embed.
   * The parameter configuration for Workshop and Slate applications allows you to pass details of the current object's properties, linked objects set, or predefined values into the linked resource.
   * The parameter values are accessible within the embedded Workshop or Slate application as variables with the same name as the parameter name. In Workshop, these must be configured in the variable **Settings** panel as module interface variables.

2. For other Foundry applications and external websites to open in a new tab:
   * Add an **Application link** to create a new card with a parameterized URL.
   * All links on the sidebar are opened in a new browser tab and not embedded like object applications mentioned above.
   * These URLs can be used both for Foundry applications (Workshop, Vertex, another Object View, or Foundry documentation, for example) and for external websites.
   * The URL card requires a template that combines an address and/or any parameters defined on the parameter configuration. To place parameters in the URL, wrap the parameter name like this: `{{parameterName}}`. If the property is an entire URL, check the box for **Encode property value** to mark it as an entire URL, and include only the `{{parameterName}}` in the URL text box.
   * By default, the details of the current object are available using these parameters: `{{objectId}}` & `{{objectTypeId}}`.

:::callout{theme="neutral"}
If a user doesn’t have permissions to the embedded application, they would not be able to open it but would still see the application card. Make sure you set up the right permissions on each application in the sidebar.
:::
