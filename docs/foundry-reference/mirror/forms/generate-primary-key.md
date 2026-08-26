<!-- source: https://palantir.com/docs/foundry/forms/generate-primary-key/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Generate a primary key

:::callout{theme="warning"}
Foundry Forms is no longer the recommended approach for data entry or writeback workflows on Foundry. Instead, build user input workflows with the Foundry Ontology, representing the relevant data structures as object types and configuring the writeback interaction with Actions. Learn more in the [Forms overview](/docs/foundry/forms/overview/) documentation.
:::

A **primary key** is a value that uniquely identifies each row in a dataset. With Fusion-backed forms, a user can define or automatically generate such a value.

Ideally, the field writing to the primary key column should not be editable. Instead, the field should automatically generate a unique value (hidden or otherwise) such as a timestamp or the [concatenation of other fields](/docs/foundry/forms/faqs/#how-do-i-produce-a-field-that-is-the-concatenation-of-other-fields).

To set the primary key:

1. With the form configured with at least one field, select the **Response data** tab.
2. Find the **Table columns** section at the bottom of the panel.
3. Select the key icon to the right of the desired field.

:::callout{theme="neutral"}
If the primary key field has no value, a unique one will automatically be generated.
:::

:::callout{theme="warning"}
If the primary key field has a non-unique value, a new row will still be created, but the column will no longer have unique values.
:::
