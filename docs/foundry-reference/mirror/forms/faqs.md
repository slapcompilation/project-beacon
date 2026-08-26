<!-- source: https://palantir.com/docs/foundry/forms/faqs/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# FAQs

This page discusses some common questions and debugging steps that may be helpful to reference when using Foundry Forms.

## What can I use instead of Foundry Forms?

Foundry Forms is no longer the recommended approach for data entry or writeback workflows on Foundry. Instead, build user input workflows with the Foundry Ontology, representing the relevant data structures as object types and configuring the writeback interaction with Actions.

[Actions](/docs/foundry/action-types/use-actions/) provide more robust and granular control over the permissions associated with adding, editing, and deleting data, including respect for restricted views and configuring complex conditional permissions. Furthermore, Actions can be backed by [Foundry Functions](/docs/foundry/functions/use-functions/), allowing for more expressive writeback logic.

In addition to the built-in Form builder in the Actions configuration, Actions are natively supported in Workshop and Slate where complex data entry user experience can be crafted with the full suite of application building tools.

Actions also automatically generate API bindings for the Foundry API, where external applications write data into Foundry, and interface with webhooks, through which Actions can write data into external data systems or trigger other downstream effects.

There is currently no timeline for deprecating Foundry Forms, and existing implementations using Foundry Forms will be supported. New workflows are strongly recommended to use an Ontology-based approach, and it is not expected that Foundry Forms will receive new features, enhancements, or non-security-related fixes.

## How do I store multiple values?

Various field types allow respondents to select multiple values (for example, `checkboxes`, `dropdown` and `list`). With Fusion sheets, values are automatically stored in a single cell as an array. With object types, some additional setup is required:

* In the schema for both the source and writeback datasets, the relevant column must have the type `Array<X>`, where `X` is a basic type like `String` or `Integer`.
* In the Ontology configuration, the relevant property must have the same base type `X`, and the checkbox `Allow multiple values` must be checked.

## How do I transform multiple values into multiple rows in the destination dataset

After configuring a field to [store multiple values](#how-do-i-store-multiple-values), you can use the [`explode` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.functions.explode.html) function to separate each value into its own row. This function can be used in a SQL/Python transform of the dataset or a Contour expression.

## How do I produce a field that is the concatenation of other fields?

Use the template field to configure the following:

```
- uri: display.Text1
  name: Text 1
  type: Text
  tag: X
- uri: display.Text2
  name: Text 2
  type: Text
  tag: Y
- uri: display.Template
  name: Text 1_Text 2
  type: Template
  options:
    inputs:
      a: X
      b: Y
    template: '{{a}}_{{b}}'
```

## How do I debug a failing submission?

When saving an object-backed form, you may see this error: `Submitting failed! Please try again or contact your Palantir support.`.

To debug further, follow these steps:

1. Right-click the page and select **Inspect**. Then, open the **Console** tab.
2. Find the message starting with `Submitting failed! Reason ...`.
3. Expand the group of messages titled `e` and `body`.
   * The most common `errorName` is `FormEntries:PhonographEntryParseError`, which can be caused by an inconsistency between the form and dataset schema/Ontology configuration.
4. Expand the group of messages titled `parameters`.
   * In the specific example of `FormEntries:PhonographEntryParseError`, this will highlight the culprit field (`PropertyId`).

As an example, if a column/property of type `String` was paired with a field that allowed multiple values, the user would either need to change the type to `Array<String>` or update the field to only allow a single value.

## Are mobile submissions supported?

Forms has a responsive web design and will work on mobile devices; however, Forms was not specifically designed for mobile and thus is not officially supported.
