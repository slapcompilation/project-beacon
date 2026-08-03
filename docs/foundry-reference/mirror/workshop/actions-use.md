<!-- source: https://palantir.com/docs/foundry/workshop/actions-use/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Use Actions in Workshop

Actions in Foundry allow users to edit, create, delete, and link object data based on defined rule sets (known as action types). For example, an Action might allow a user to do one or more of the following:

* Create a new `Flight` object and fill in its `Flight Number`, `Time of Departure`, `Origin`, and `Destination` properties.
* Modify an existing `Flight` object to change the `Destination` property.
* Link a specific `Flight` object to a specific `Passenger` object.
* Delete a `Flight` object that was created by mistake.

By creating a user-friendly wrapper for complex object data edits, Actions enables application creators to use meaningful and secure building blocks for user writeback to object data. These building blocks can then be:

* Used in multiple applications (such as Workshop or Object Views) to support business process workflows.
  * A Form component is automatically generated based on the Action definition, so writeback to object data and the user interface associated with it are not defined separately. The core interactions of Workshop and Actions are detailed below.
* Granularly permissioned to support different writeback permissions for different users and conditions.
  * For example, an analyst may be allowed to start a new investigation, but the ability to close investigations may be restricted to members of the manager user group.

## Define an Action in the Ontology Manager

:::callout
To create, configure, or edit an action, a given Palantir Foundry user must belong to the `actions-admins` group.
:::

:::callout
For full details on defining actions, see the [actions documentation](/docs/foundry/action-types/overview/). The documentation below provides a brief notional example of action configuration focused on using actions within Workshop.
:::

Actions administrators can create, configure, and edit action types in the Ontology manager. To access, select **Ontology manager** from the Apps sidebar.  The **Action types** tab (seen in the screenshot below) provides a list of existing action types, which can be selected to be viewed and edited. The **New action type** button allows you to define a new action type from scratch. Alternatively, you can also create action types right from the object type which it should be based on. Navigate to the object type and select **Create new** in the action types box.

:::callout{theme="neutral"}
Note that this example is illustrative and you may not be able to complete every step as written. Since your Foundry Ontology is customized to your needs and data, you may not have access to the ontology objects required to complete the tutorial.
:::

Select the **Create new** button on the object type to begin. In this example, we’ll be defining a “Modify Flight Destination” action that will allow users to modify the `Destination` property on an existing Flight object.

The creation wizard walks you through the most important steps to bootstrap your new action type. Enter a **Display name** and select **Modify** under the **Change object(s)** option to configure your action type. From the object dropdown, select your previously created `Flight` object and then select the `Comment` and `Destination` properties which this action type should modify.

![action\_wizard](/docs/resources/foundry/workshop/action_wizard.png)

The first tab of an action type definition is called **Overview** and allows you to define the **API Name** (a unique ID), the user-facing **Display Name**, the user-facing **Description**, and **Status** of the action. Some of these fields will already be filled based on the previous step. Fill the missing fields with values such as those seen below. The API name **cannot be edited after saving**, so it is important to take care when choosing an API name.

![action\_type](/docs/resources/foundry/workshop/action_type.png)

Next, select the **Rules** tab of this action type definition. This is where you’ll configure the core of your action type: its **Rules** or outputs / execution. After selecting the object type and the kind of changes you want this action type to perform, you can see the Rule configured as a modification rule as well as the added properties. You can add additional properties from the dropdown if needed.

![action\_rules](/docs/resources/foundry/workshop/action_form.png)

The **Form** tab lists the **Parameters** or inputs of your action type. The parameters have already been added automatically by the **Rules** section.

![action\_form](/docs/resources/foundry/workshop/action_form.png)

Next, let’s configure some basic **Submission Criteria** for our action type. In this example, we want to confirm that the user has entered a valid three-character airport code (like `EWR`) for their modified destination. Navigate to the **Security & Submission Criteria** tab and select **Add a condition** in the **Submission Criteria** section. Use the **Parameter** condition template in this example to compare the `Destination` property with a regular expression like `^[A-Z]{3}$`; this lets us confirm that the value entered for our destination parameter is exactly three characters. To give the user more information about why a submission is potentially failing on a condition, add an error message at the bottom of the sidebar.

![configure\_submission\_criteria](/docs/resources/foundry/workshop/configure_submission_criteria.png)

To test the new action type, navigate back to the **Form** tab and use the preview of the form on the right side of your screen to test your action type. You can enter different values and select the **Submit** button. This only tests whether an action would be submittable and does not actually submit an action.

![action\_form](/docs/resources/foundry/workshop/action_form.png)

You have now finished configuring your first action type and need to save it on our Ontology. To do so, select the **Save** button at the top right of the screen, review the list of modifications that appear in a modal, and then select **Save** again twice to confirm.

![save\_action](/docs/resources/foundry/workshop/save_action.png)

Your first action type is now saved, and we can head to Workshop to build a module that will allow users to execute this action type.

## Use an Action within Workshop

:::callout{theme="success" title="Tip"}
The below section assumes familiarity with building Workshop modules. See [this page](/docs/foundry/workshop/getting-started/) for a tutorial covering these topics.
:::

Within Workshop, actions can be exposed to users through a number of different widgets, including Button Groups and the Create Action panel. The example below begins with a Flight Inbox module and describes how to trigger actions via a Button Group from within this Workshop module.

![flight\_inbox](/docs/resources/foundry/workshop/flight_inbox.png)

### Button Groups

The Button Group widget in Workshop allows a module builder to add one or more buttons to their module. For this example, we focus on how Button Groups can be used to expose an action in Workshop.

#### Configuring an action in a Button Group

After a Button Group is added to your Workshop module, single-clicking on the Button Group within your on-screen module will open the widget's configuration panel in the right-hand side of your screen. The core configuration options can be found in the **Widget setup** tab and are divided into three sections — **Layout**, **Style**, and **Buttons**. The **Layout** and **Style** sections control advanced display options, but this example focuses on the **Buttons** section, where a module builder can configure basic display options and determine how actions are applied when a button is selected.

![button\_group](/docs/resources/foundry/workshop/button_group.png)

Within the **Buttons** section of the above, you can adjust the **Text**, **Color**, **Left icon**, and **Right icon** options to control the display of the button. As an example, let's configure these four options for the "Modify Destination" action we intend to trigger from the button.

![button\_config](/docs/resources/foundry/workshop/button_config.png)

This above configuration will produce a button that looks like the below. Accurately labeling a button with appropriate text, color, and an icon will help users understand what will happen when they select it. You can choose a preset color (**primary**, **success**, **warning**, **danger**) or specify a custom color, including via a hex code.

![modify\_destination](/docs/resources/foundry/workshop/modify_destination.png)

Now that our button is labeled, we proceed to the **On click** section to connect our intended action. To do so, select the **Select an action...** dropdown and then filter to and select the "Modify Destination" action. Doing so will cause the below to appear, which contains all three of the action parameters that we defined when creating the "Modify Destination" action above.

![on\_click](/docs/resources/foundry/workshop/on_click.png)

The **Parameter defaults** allows the user to optionally set default values for the action parameters. As a reminder, each parameter corresponds to an input in the action type Definition (an object list, object reference, integer, string, and so on). For each parameter the user has two options:

* **Set a default value equal to a variable in the Workshop module**
  * To do this we can select the **Selected Flight** parameter's "no default" value and set this instead to be the "Active object" variable output by our object table of flights. Once this is set, additional options will appear to set the parameter to be **Visible** (default value can be further modified by a user in the actions form), **Hidden** (the parameter is entirely hidden from the user in the actions form), or **Disabled** (parameter appears as read-only to the user in the actions form). In this example, let's keep the default option of **Visible.**
* **Leave no default**
  * Parameters with no default will initially appear as empty fields in the actions form, and the values will be input by the user.
  * In this example, we leave Modified Destination and Comment(s) fields without defaults.

![on\_click\_2](/docs/resources/foundry/workshop/on_click_2.png)

#### Applying an action from a Button Group

After configuring the action in the Button Group, when a user selects the **Modify Destination** button in the Workshop module they will see an actions form appear. The default values of a field are based on the above configuration; the **Selected Flight** field is auto-populated based on the module variable, while the **Modified Destination** and **Comment** fields are left empty for user input.

![modify flight](/docs/resources/foundry/workshop/modify_flight.png)

In the form above, **1 issue** is flagged at the bottom left of the actions form. By hovering over the **1 issue** text, the user can see that the issue is that the **Modified Destination** field is not currently a valid three-character airport code.

![validation](/docs/resources/foundry/workshop/validation.png)

When the actions form is filled out and all parameters pass validation, the action can be submitted (the submit button will be available).

![action submit](/docs/resources/foundry/workshop/action_submit.png)

After selecting submit, a user will see a green toast appear on top of the module, indicating that the action was successfully completed and the selected `Flight` object was updated to reflect the changes entered.

![action complete](/docs/resources/foundry/workshop/action_complete.png)

### Trigger actions from the Media Uploader widget

Actions can also be triggered when users upload files via the Media Uploader widget. This is useful for workflows that depend on newly uploaded media, such as processing, enrichment, or linking workflows.

When configuring the Media Uploader to trigger an action on upload, you can reference the uploaded file in the action's parameter configuration using the special file identifier value:

* For uploads to datasets, the file identifier is the uploaded filename.
* For uploads to Compass folders, the file identifier is the uploaded file's RID.
* For uploads to media sets, the file identifier is the uploaded file's media reference.

If multi-file upload is enabled, the configured action triggers once for each uploaded file, with the file identifier corresponding to the specific file being processed.

For setup details including button configuration, upload destination, allowed file extensions, dynamic destinations, and multi-file options, see the [Media Uploader widget documentation](/docs/foundry/workshop/widgets-media-uploader/).
