<!-- source: https://palantir.com/docs/foundry/pipeline-builder/management-parameter-overview/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Parameters

Parameters are global values that can be used in multiple transforms in a pipeline. Updating a parameter value can modify many transforms at once.

## Create and edit parameters

Create, edit, and delete parameters in the **Parameters** view, accessible from the parameters button at the top of the graph. Creating a new parameter requires setting a parameter name and parameter type and defining a value. Existing parameter can also be edited or deleted in the **Parameters** view.

Editing a parameter allows users to modify many transforms at once if a parameter is used in multiple transforms; editing parameter logic will result in a logic change across all transforms in which the parameter is used.

It is possible to create a parameter without a value to use as a placeholder while working on a pipeline; when used in a transform, such parameters will resulte in errors to the transform, and the pipeline cannot be deployed until a value is added.

## Parameter types

* **Constant values:** Constant value parameters require a column type and a value. These parameters can be used as input values in any transform that allows for the value’s set column type.
* **Regex:** Regex parameters require a regex expression and can be used as input in transforms for which regex expressions are enabled.
* **Struct locator:** Struct locator parameters are strings and can be used to point to an element in a struct.
* **Column:** Column parameters are column placeholders that can be used as an input in the column selector of transforms. Column parameters can point to an existing column by its name, but the existence which will first be verified in each transform in which the parameter is used.
* **Expression:** Expression type parameters are blank Pipeline Builder expressions and can be used as expression placeholders.
