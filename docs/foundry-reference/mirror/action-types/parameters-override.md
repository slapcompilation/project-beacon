<!-- source: https://palantir.com/docs/foundry/action-types/parameters-override/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Overrides

Overrides are used to change a parameter's behavior and configuration under specific circumstances. Using overrides, parameters and forms can become more flexible, removing the need to configure separate action types with only minor variations. Appropriate use of overrides can improve the user experience by guiding users through an action submission.

For example, let's assume that you have an action type which changes the status of a support ticket object and you want to restrict action submission to managers and assignees. While assignees can change the status, managers will have to provide a justification. Using overrides, the `Justification reason` parameter can be made required and visible for managers, while it is hidden and optional for the assignee.

## Add and edit overrides

You can add and edit overrides from different places on the parameter view. The easiest way to add a new override is directly from the **Value** tab in the **General** section. By clicking **Add override** on one of the three options, you can easily create an override via the pop-up, which now automatically configured the override based on the selected option. The **General** section also shows when and how many overrides have already been configured for one of the options. To edit existing overrides, select the override button.

![Override pop up](/docs/resources/foundry/action-types/override_pop_up.png)

You can also add an override manually via the **Overrides** tab. The overrides tab shows an overview of all overrides configured for the parameter. You can add override blocks from here or add new conditions or overrides to existing blocks.

![Override tab](/docs/resources/foundry/action-types/override_tab.png)

## Override block

An override block presents the basis for overrides. It defines both the conditions (shown in the "if" part) and the overrides (shown in the "then" part). Each block's header shows a summary of the logic. Every parameter can contain multiple override blocks, however, if more than one is true, only the first one will be executed.

![Override block](/docs/resources/foundry/action-types/override_block.png)

### "If" and conditions

Each block can contain one or multiple conditions. To read more about conditions and how to configure them, see the [submission criteria documentation on conditions](/docs/foundry/action-types/submission-criteria/#conditions). The only difference between override conditions and submission criteria conditions is that only parameters which appear above the current parameter in the form hierarchy can be referenced in override conditions.

### "Then" and overrides

The **Then** section defines the overrides which will be applied when the conditions of the block are met. Each block can contain multiple overrides in its **Then** section, which are all be applied together. An override can change the configuration of the parameter's constraints, visibility, requiredness, and default values. If an override is configured to take on the same value as the default already set on the parameter, a warning will be shown on the override itself.

### Multiple override blocks

You can add multiple override blocks to a single parameter. If more than one block is true, only the first override is executed.
