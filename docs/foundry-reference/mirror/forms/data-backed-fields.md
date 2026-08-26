<!-- source: https://palantir.com/docs/foundry/forms/data-backed-fields/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Data-backed fields

:::callout{theme="warning"}
Foundry Forms is no longer the recommended approach for data entry or writeback workflows on Foundry. Instead, build user input workflows with the Foundry Ontology, representing the relevant data structures as object types and configuring the writeback interaction with Actions. Learn more in the [Forms overview](/docs/foundry/forms/overview/) documentation.
:::

Data-backed fields link a form to data that already exists in Foundry. This page discusses the seven types of data-backed fields available in Foundry Forms.

## User dropdown

The **user dropdown** field allows respondents to select a Foundry user. The field displays the name of the userc but records the user ID. Users can configure the following options:

* Allow [multiple selections](/docs/foundry/forms/faqs/#how-do-i-store-multiple-values).
* Prefill the field if only one value is available.
* Set a `Placeholder`.
* Hide the list of selected users below the dropdown.
* Use the [Code Editor](/docs/foundry/forms/code-editor/) to set `onlyUsersInGroupIds: list<string>`.

## Object dropdown

The **object dropdown** field allows respondents to select an object of a given type. This field displays the title of the object but records its primary key. Users can configure the following options:

* Specify a filter based on the value of a property.
* Specify which properties should be searched on.
* Allow [multiple selections](/docs/foundry/forms/faqs/#how-do-i-store-multiple-values).
* Prefill the field if only one value is available.
* Show a preview of the hovered object's properties.
* Hide the object type icon.
* Set a `Placeholder`.
* Use the [Code Editor](/docs/foundry/forms/code-editor/) to set `noResultsText: string` and `displayedProperties: list<string>`.

:::callout{theme="neutral"}
To be filtered on, properties must be configured with the render hint "Low cardinality" in the Ontology.
:::

## Object property dropdown

The **object property dropdown** field allows respondents to select a property value of a given object type. Users can configure the following options:

* Specify a filter based on the value of another property.
* Allow [multiple selections](/docs/foundry/forms/faqs/#how-do-i-store-multiple-values).
* Prefill the field if only one value is available.
* Allow the creation of values other than the ones given.
* Set a `Placeholder`.
* Use the [Code Editor](/docs/foundry/forms/code-editor/) to set `noResultsText: string`.

## Dataset value dropdown

The **dataset value dropdown** field allows respondents to select a column value of a given dataset. Users can configure the following options:

* Specify a filter based on the value of another column.
* Allow [multiple selections](/docs/foundry/forms/faqs/#how-do-i-store-multiple-values).
* Prefill the field if only one value is available.
* Allow the creation of values other than the ones given.
* Set a `Placeholder`.
* Use the [Code Editor](/docs/foundry/forms/code-editor/) to set `noResultsText: string`.

:::callout{theme="neutral"}
To use this field, the dataset must be [indexed into Lime](/docs/foundry/fusion/index-datasets/).
:::

## Objects provider

The **objects provider** field is read-only and shows chosen objects of a given type. Users can configure the following options:

* Specify a filter based on the value of a property.
* Display a summary view or a collapsible list of all objects.
* Use the [Code Editor](/docs/foundry/forms/code-editor/) to set `maxObjects: integer`.

## Object property display

The **object property display** field is read-only and shows the selected property of a chosen object. Users can configure the following options:

* Specify the primary key of the object or the field that references it.
* Hide the object type icon.
* Customize the message when:
  * No object is selected.
  * The value is empty.
  * The request fails.
  * The object is "missing" (either does not exist or the respondent does not have the appropriate permissions).
* Specify what to do when:
  * The request fails.
  * The object is "missing".

If referencing a field with multiple selection enabled, the object property display will show the properties of all of the objects, separated by commas.

## User properties

The **user properties** field is read-only and shows the selected property of a chosen Foundry user. Users can configure the following options:

* Specify the user ID or the field that references it.
* Specify the format (for example, `Last name, first name`).
* Customize the message when:
  * No user is selected.
  * The value is empty.
  * The request fails.
  * The user is "missing" (either does not exist or the respondent does not have the appropriate permissions).
* Specify what to do when:
  * The request fails.
  * The user is "missing".

If referencing a field with multiple selection enabled, the user property display will show the properties of all of the users, separated by commas.
