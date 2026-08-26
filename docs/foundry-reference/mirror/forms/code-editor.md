<!-- source: https://palantir.com/docs/foundry/forms/code-editor/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Code Editor

:::callout{theme="warning"}
Foundry Forms is no longer the recommended approach for data entry or writeback workflows on Foundry. Instead, build user input workflows with the Foundry Ontology, representing the relevant data structures as object types and configuring the writeback interaction with Actions. Learn more in the [Forms overview](/docs/foundry/forms/overview/) documentation.
:::

The **Code Editor** allows users to view and edit the YAML representation of the form. While most configuration is possible with the Visual Editor, the Code Editor offers complete functionality, including the ability to add four [code-only fields](#code-only-fields).

To view the Code Editor in action, open it by selecting the black **\</>** button in the bottom left of the form. Then, use the Visual Editor to add a field. Notice how the code automatically populates and updates as the field is configured.

:::callout{theme="neutral"}
Select the book icon in the top right of the Code Editor to open examples and documentation directly within the Code Editor window.
:::

![Open Code Editor and documentation.](./images/code-helper.gif)

## Code structure

The general structure of a form is as follows:

```yaml
name: New form
fields:
  - uri: name
    name: Full name
    type: Text
    # and other generic options
    options:
      placeholder: 'Last, First'
      # and other specific options
sheets:
  - name: New sheet
    fields:
      - uri: date_of_birth
        name: Date of birth
        type: DatePicker
        options:
          precision: day
      - uri: weight_kg
        name: Weight
        type: Numeric
        options:
          unit: kg
```

At the top level, there is the `name` (the title of the form), `fields` (a list of fields), and `sheets` (a list of [sheets](/docs/foundry/forms/sheets/)). Then, each `sheet` itself has these same options. Fields have [generic options](#generic-options), such as `uri`, `name`, and `type`, and specific options (underneath `options`), such as `placeholder`, `precision`, and `unit`.

### Generic options

The following options can be configured for every field:

```
    uri: string
    type: string
    name: string
    urlParam: string
    tag: string
    helperText: string
    infoText: string
    columnSpan: integer
    disabled: Boolean
    hidden: Boolean
    isBlock: Boolean
    noLabel: Boolean
    validators: list<Validators>
    transforms: list<Transforms>
```

* **uri:** A unique identifier for the field. If the field is being written back to Fusion or the Ontology, it needs to match the column name or property ID respectively. If the field is not being written back, it needs to start with the prefix `display.`.
* **type:** The type of the field (for example, `Text`, `Numeric`, `DatePicker`).
* **name:** The label for the field.
* **urlParam:** The URL parameter associated with the field. This allows users to prefill the value when the form is embedded in an iframe.
* **tag:** Another unique identifier for the field, but without restrictions. This is the identifier used when one field references another (for example, `Calculation`, `Template`), with the exception of [attachments](/docs/foundry/forms/attachments-field/).
* **helperText:** The caption below the field.
* **infoText:** The content of the informational tooltip displayed next to the label of the field.
* **columnSpan:** The number of columns occupied by the field.
* **disabled:** Allows the user to make the field read-only.
* **hidden:** Allows the user to hide the field but record the value.
* **isBlock:** Allows the user to display the label above the field instead of to the left.
* **noLabel:** Allows the user to hide the label of the field. This is only available via the Code Editor.
* **validators:** [Validators](/docs/foundry/forms/validators/) on the field.
* **transforms:** [Transforms](/docs/foundry/forms/transforms/) on the field.

## Code-only fields

Four fields are available only through the Code Editor:

* [Hidden](#hidden)
* [List](#list)
* [Composite](#composite)
* [List aggregate](#list-aggregate)

### Hidden

The **hidden** field allows users to record a value without showing a field. It is configured as follows:

```
- uri: Hidden
  name: Hidden
  type: Hidden
  options:
    val: string
```

### List

The **List** field allows users to [store multiple values](/docs/foundry/forms/faqs/#how-do-i-store-multiple-values) when a field does not innately support it. It is configured as follows:

```
- uri: names
  name: Full names
  type: List
  options:
    # allowZeroItems: true
    item:
      type: Text
      # and other supported generic options (helperText, infoText, validators)
      options:
        placeholder: 'Last, First'
        # and other specific options
```

:::callout{theme="neutral"}
`allowZeroItems` is optional and false by default.
:::

### Composite

The **composite** field allows users to store the values of multiple fields as one stringified JSON. It is configured as follows:

```
- uri: info
  name: Composite
  type: Composite
  options:
    fields:
      - uri: date_of_birth
        name: Date of birth
        type: DatePicker
        # and other supported generic options (helperText, infoText, disabled, isBlock, noLabel, validators)
        options:
          precision: day
          # and other specific options
      - uri: weight_kg
        name: Weight
        type: Numeric
        options:
          unit: kg
```

:::callout{theme="neutral"}
[Hidden](#hidden) fields and those that [allow multiple values](/docs/foundry/forms/faqs/#how-do-i-store-multiple-values) are not allowed within a composite field.
:::

### List aggregate

The **list aggregate** field is similar to [calculation](/docs/foundry/forms/auto-populating-fields/#calculation) and [template](/docs/foundry/forms/auto-populating-fields/#template) fields but works on fields that [store multiple values](/docs/foundry/forms/faqs/#how-do-i-store-multiple-values). It is configured as follows:

```
- uri: single_value
  tag: single_value
  name: Single Value
  type: RadioButtons
  options:
    options:
      - value: '10'
      - value: '20'
      - value: '30'
- uri: multi_values
  name: Multiple Values
  tag: multi_values
  type: Checkboxes
  options:
    options:
      - value: '40'
      - value: '50'
      - value: '60'
- uri: avg_value
  name: Average Value
  type: ListAggregate
  options:
    listOperation:
      operation: mean
      listTag: [single_value, multi_values]
    # errorValue: No values selected
```

Or, when used with a [composite](#composite) field:

```
- uri: grades
  tag: grades
  name: Grades
  type: List
  options:
    item:
      type: Composite
      options:
        fields:
          - uri: name
            name: Name
            type: Text
            options:
              placeholder: 'Last, First'
          - uri: grade
            name: Grade
            type: Numeric
            options:
              unit: '%'
- uri: all_grades
  name: All grades
  type: ListAggregate
  options:
    listOperation:
      operation: concatenate
      joinWith: ', '
      listTag: grades
      displayItem: grade
    # errorValue: No grades added
```

When configuring `options` fields:

* `errorText` is optional and an empty string by default.
* Within `listOperation`:
  * `operation` can be `concatenate`, `sum`, `min`, `max`, `mean`, or `count`.
  * `listTag` is the tag (or array of tags) of the field(s) being aggregated.
  * `joinWith` is only required when the operation is `concatenate`.
  * `displayItem` is only required when the aggregated field is a [composite](#composite) field and is the URI of the nested field.
