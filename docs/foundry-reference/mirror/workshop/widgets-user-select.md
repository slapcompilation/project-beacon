<!-- source: https://palantir.com/docs/foundry/workshop/widgets-user-select/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# User Select

Use the **User Select** widget for selection of user(s) through a single or multi-select dropdown menu.

<img src="./media/widgets-user-select.png" alt="User Select widget example." width="300">

## Configuration options

* **Label:** Set an optional label for the widget to display text above the dropdown menu.
* **Placeholder:** Set optional placeholder text to display in the widget’s empty selection state
* **Selected user(s):**
  * If the selection is set to ‘Single’, the widget will be displayed as a single-select dropdown menu.
    * **Output variable:** The output variable of the widget that stores the user’s selected option. If the selection is set to ‘Single’, the output variable will be a string variable containing the ID of the selected user.
    * **Allow clear:** Toggle to enable/disable clearing of the selected dropdown menu option.
  * If the selection is set to ‘Multiple’, the widget will display as a multi-select dropdown menu.
    * **Output variable:** The output variable of the widget that stores the user’s selected option(s). If the selection is set to ‘Multiple’, the output variable will be a string array variable containing the ID(s) of the selected user(s).
  * **Specify Multipass group IDs:** Provide a string array variable of group IDs to filter users displayed in the dropdown to users in the specified groups. Users must have the `View group membership` role on the organization for configured groups or else they will see a permission error, see [below](#multipass-group-ids-permission).

## Multipass group IDs permission

If multipass group IDs are provided, users need to have the `View group membership` permission on the group's Organization, or else they will see a permission error for this widget. This permission can be granted from **Settings > Platform Settings > Organizations** by selecting the Organization of interest and then choosing **Manage** for **Organization permissions**. Read more about [managing groups here](/docs/foundry/platform-security-management/manage-groups/).
