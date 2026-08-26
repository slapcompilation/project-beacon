<!-- source: https://palantir.com/docs/foundry/forms/auto-populating-fields/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Auto-populating fields

:::callout{theme="warning"}
Foundry Forms is no longer the recommended approach for data entry or writeback workflows on Foundry. Instead, build user input workflows with the Foundry Ontology, representing the relevant data structures as object types and configuring the writeback interaction with Actions. Learn more in the [Forms overview](/docs/foundry/forms/overview/) documentation.
:::

You can capture metadata about a form, such as who created the response and when, by using auto-populating form fields. This page discusses the seven types of auto-populating fields available when adding a field to your form.

## Calculation

The **calculation** field displays a calculated value based on other single-value fields. Users can configure the following options:

* Create a formula that references the value of other fields.
* Customize the value stored when the formula evaluates to `NaN`, `infinity`, or other errors.
* Specify an `Output` (Number, Date, or Timestamp).
* Set a `Number precision`.
* Provide a `Default missing value` for each parameter.
* Set a `Unit label` (for example, `kg` or `lbs`).
* Use the [Code Editor](/docs/foundry/forms/code-editor/) to set `placeholder: string`.

:::callout{theme="neutral"}
Users can create any formula supported by the [expr-eval library ↗](https://github.com/silentmatt/expr-eval).
:::

## Created at

The **created at** field displays the entry's time of creation or modification. Users can configure the following options:

* Specify the `Recorded format` (for example, "YYYY/MM/DD" or "DD.MM.YYYY").
* Record the value as a timestamp that also represents the timezone, or as a simple representation that stores whatever the time is at that location.
* Record the time the form is opened rather than submitted.

:::callout{theme="neutral"}
If you toggle on **Record as local date or timestamp** in the field configuration, the field will store whatever the time is in the timezone the user is in. Therefore, the time on different entries may not represent the order in which they actually occurred.  You can express what timezone the entry was created in if you include the `z` option in the timestamp format.
:::

The **created at** field can be useful for tracking which entries are the most recent, how many entries are being created over time, or at what time of day they tend to get created.

## Created by

The **created by** field displays the user ID of the entry's creator or modifier.

This field can be used in combination with a user attributes field to get the current user's name or email address.

## Modified at

The **modified at** field displays the entry's latest time of modification. Users can configure the following options:

* Specify the `Recorded format` (for example, "YYYY/MM/DD" or "DD.MM.YYYY").
* Record the value as a timestamp that also represents the timezone, or as a simple representation that stores whatever the time is at that location.
* Record the time the form was opened rather than submitted.

:::callout{theme="neutral"}
If you toggle on **Record as local date or timestamp** in the field configuration, the field will store whatever the time is in the timezone the user is in. Therefore, the time on different entries may not represent the order in which they actually occurred.  You can express what timezone the entry was created in if you include the `z` option in the timestamp format.
:::

The **modified at** field can be useful for tracking which entries are the most recent, how often entries are being edited, or what has changed since creation and requires downstream updates.

## Modified by

The **modified by** field displays the user ID of the entry's modifier.

This field can be used in combination with a user attributes field to get the current user's name or email address.

## Template

The **template** field displays a concatenated value based on the value of other, single-value fields. Users can configure the following options:

* Create a template that references the value of other fields.
* Use the [Code Editor](/docs/foundry/forms/code-editor/) to set `placeholder: string` and `errorValue: string`.

### Examples

* Suppose you want to combine a score field and comment field in a survey. You could target "score" as variable `a` and "comment" as `b`. From there, create the template `{{a}} - {{b}}` and get results of the form `5 - very satisfied`.

* To use the property of an object referenced in the form, you can use an object property display field to select the property, hide that field, and reference it from the template field.

* You can use a field configuration transform to change which fields or format the template uses based on other conditions on the values in the form. For example, you could ask respondents to select a standard response from a dropdown or let them write a custom response in a text field. A different template will be used depending on the action of the respondent.
