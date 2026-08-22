<!-- source: https://palantir.com/docs/foundry/slate/widgets-control/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Control

The Control Widget category consists of the following widgets:

* [Button](#button-widget)
* [Checkbox](#checkbox-widget)
* [Dropdown](#dropdown-widget)
* [Input box](#input-box-widget)
* [Multiselect box](#multiselect-box-widget)
* [Radio button](#radio-button-widget)
* [Segmented control](#segmented-control-widget)
* [Slider](#slider-widget)
* [Textarea](#textarea-widget)
* [Toggle](#toggle-widget)

***

## Button widget

The following tables offer usage details about the properties available to Button widgets. Several examples follow the tables.

### Properties

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|cssClasses	|The CSS classes for the button.	|string\[]	|No	|Direct Edit	|
|disabled	|Specifies whether the user can interact with the widget. Defaults to false. Values are typically templated expressions that produce booleans (e.g. “{{w1.on}}”).	|boolean	|Yes	|Direct Edit	|
|text	|The display text for the button.	|string	|Yes	|Direct Edit	|

### Examples

#### Button

```json
{"cssClasses": ["pt-button","pt-intent-primary"],"disabled": false,"text": "Run"}
```

### Defaults

```json
{"cssClasses": ["pt-button","pt-intent-primary"],"disabled": false,"queryNames": [],"text": "Run"}
```

***

## Checkbox widget

The following tables offer usage details about the properties available to Checkbox widgets.

### Properties

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|disabled	|Specifies whether the user can interact with the widget. Defaults to false. Values are typically templated expressions that produce booleans (e.g. “{{w1.on}}”).	|boolean	|Yes	|Direct Edit	|
|displayValues	|An optional list that defines the display values of the items in the checkbox group. There should be a display value for each item in ‘values’. If ‘displayValues’ is not specified, the raw value for each item will be displayed instead.	|string\[]	|No	|Direct Edit	|
|hover	|When tooltipsEnabled = true, this property determines the value you are hovering over.	|ICheckboxHover	|No	|User Interaction	|
|selectedDisplayValues	|The list of display values of the items that are currently checked.	|string\[]	|Yes	|User Interaction	|
|selectedValues	|The list of items that are currently checked.	|any\[]	|Yes	|User Interaction	|
|tooltipsEnabled	|Specifies whether tooltips are enabled.	|boolean	|Yes	|Direct Edit	|
|tooltipText	|The text displayed in tooltips. If this value is null or the empty string then no tooltip will be displayed. Supports HTML.	|string	|No	|Direct Edit	|
|values	|The values for the items in the checkbox group.	|any\[]	|Yes	|Direct Edit	|

#### ICheckboxHover

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|displayValue	|The display value of the checkbox currently being hovered over.	|string	|Yes	|User Interaction	|
|index	|The index of the checkbox label currently being hovered over.	|number	|Yes	|User Interaction	|
|value	|The raw value of the checkbox currently being hovered over.	|any	|Yes	|User Interaction	|

***

## Dropdown widget

The following tables offer usage details about the properties available to Dropdown widgets. Several examples follow the tables.

### Properties

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|disabled	|Specifies whether the user can interact with the widget. Defaults to false. Values are typically templated expressions that produce booleans (e.g. “{{w1.on}}”).	|boolean	|Yes	|Direct Edit	|
|defaultPosition	|Specifies whether the dropdown should default to the top or bottom of the widget when opened. Valid values are “top” and “bottom”.	|string	|No	|Direct Edit	|
|fuzzySearchEnabled	|Toggle fuzzy matching for search.	|boolean	|Yes	|Direct Edit	|
|displayValues	|The values displayed in the dropdown. If not specified, ‘values’ will be used.	|any\[]	|No	|Direct Edit	|
|groups	|The group in which corresponding ‘values’ entries will be displayed.	|any\[]	|No	|Direct Edit	|
|maintainValidSelection	|Indicates whether the currently selected value should remain the selected value when the widget is invalidated, so long as the value is still valid.	|boolean	|Yes	|Direct Edit	|
|searchText	|Search text to filter the ‘values’ array. See serverSearchEnabled for details.	|string	|Yes	|User Interaction	|
|selectedDisplayValue	|The displayed value of the dropdown.	|string	|Yes	|User Interaction	|
|selectedValue	|The current user selected dropdown value.	|any	|Yes	|User Interaction	|
|serverSearchEnabled	|Indicates that user input search text should trigger a new query. Otherwise, the ‘values’ array is searched locally for matches.	|boolean	|Yes	|Direct Edit	|
|values	|The values from which ‘selectedValue’ is set. Should be a one-to-one mapping to displayValues if displayValues is used.	|any\[]	|Yes	|Direct Edit	|

### Examples

#### Dynamic Dropdown

```json
{
  "disabled": false,
  "displayValues": "{{query1.memberName}}",
  "searchText": "John",
  "selectedValue": "65849",
  "serverSearchEnabled": true,
  "values": "{{query1.memberId}}"
}
```

#### Static Dropdown

```json
{
  "disabled": false,
  "searchText": "",
  "selectedValue": "giraffe",
  "serverSearchEnabled": false,
  "values": [
    "giraffe",
    "rhinoceros",
    "elephant"
  ]
}
```

### Defaults

```json
{
  "disabled": false,
  "searchText": "",
  "selectedValue": null,
  "serverSearchEnabled": false,
  "values": []
}
```

***

## Input Box widget

The following tables offer usage details about the properties available to Input Box widgets. Several examples follow the tables.

### Properties

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|disabled	|Specifies whether the user can interact with the widget. Defaults to false. Values are typically templated expressions that produce booleans (e.g. “{{w1.on}}”).	|boolean	|Yes	|Direct Edit	|
|placeholder	|The text to use for the input box placeholder (no IE9 support).	|string	|No	|Direct Edit	|
|queryNames	|The names of the queries this input box should execute when the Enter key is used.	|string\[]	|No	|Direct Edit	|
|text	|The text the user has typed in the box.	|string	|Yes	|User Interaction	|

### Examples

#### Input Box

```json
{
  "disabled": false,
  "placeholder": "Choose an animal...",
  "queryName": "query1",
  "text": ""
}
```

### Actions

|Action Name	|Description	|
|---	|---	|
|clear	|Triggering this action clears the value in the input box.	|

### Defaults

```json
{
  "disabled": false,
  "placeholder": "placeholder goes here",
  "text": ""
}
```

***

## Multiselect Box widget

The following tables offer usage details about the properties available to Multiselect Box widgets. Several examples follow the tables.

### Properties

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|disabled	|Specifies whether the user can interact with the widget. Defaults to false. Values are typically templated expressions that produce booleans (e.g. “{{w1.on}}”).	|boolean	|Yes	|Direct Edit	|
|displayValues	|The values displayed in the multiselect box. If not specified, ‘values’ will be used.	|string\[]	|No	|Direct Edit	|
|fuzzySearchEnabled	|Toggle fuzzy matching for search.	|boolean	|Yes	|Direct Edit	|
|placeholder	|The text to use for the multiselect box placeholder	|string	|No	|Direct Edit	|
|hasValues	|Indicates if the user has input a value.	|boolean	|Yes	|User Interaction	|
|selectedDisplayValues	|The current user input displayed selected values.	|string\[]	|Yes	|User Interaction	|
|selectedValues	|The current user input selected values.	|any\[]	|Yes	|User Interaction	|
|searchText	|Search text to filter the ‘values’ array. See serverSearchEnabled for details.	|string	|Yes	|User Interaction	|
|serverSearchEnabled	|Indicates that user input search text should trigger a new query. Otherwise, the ‘values’ array is searched locally for matches.	|boolean	|Yes	|Direct Edit	|
|tokenSeparator	|String that separates tokens in the input. If not specified, input will not be tokenized. New line characters are read as spaces in the input.	|string	|No	|Direct Edit	|
|values	|The values from which ‘selectedValues’ is set. Should be a one-to-one mapping to ‘displayValues’ if ‘displayValues’ is used.	|any\[]	|Yes	|Direct Edit	|

### Examples

#### Dynamic Multiselect

```json
{
  "disabled": false,
  "displayValues": "{{query1.memberName}}",
  "hasValues": false,
  "searchText": "John",
  "selectedDisplayValues": [],
  "selectedValues": [],
  "serverSearchEnabled": true,
  "values": "{{query1.memberId}}"
}
```

#### Static Multiselect

```json
{
  "disabled": false,
  "hasValues": true,
  "selectedDisplayValues": [
    "giraffe",
    "rhinoceros"
  ],
  "selectedValues": [
    "giraffe",
    "rhinoceros"
  ],
  "serverSearchEnabled": false,
  "values": [
    "giraffe",
    "rhinoceros",
    "elephant"
  ]
}
```

### Defaults

```json
{
  "disabled": false,
  "hasValues": false,
  "selectedDisplayValues": [],
  "selectedValues": [],
  "serverSearchEnabled": false,
  "values": []
}
```

***

## Radio button widget

The following tables offer usage details about the properties available to radio button widgets.

### Properties

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|disabled	|Specifies whether the user can interact with the widget. Defaults to false. Values are typically templated expressions that produce booleans (e.g. “{{w1.on}}”).	|boolean	|Yes	|Direct Edit	|
|displayValues	|An optional list that defines the display values of the items in the radio button group. There should be a display value for each item in ‘values’. If ‘displayValues’ is not specified, the raw value for each item will be displayed instead.	|string\[]	|No	|Direct Edit	|
|preselectFirstElement	|Specifies whether the first value is selected by default or not.	|boolean	|Yes	|Direct Edit	|
|hover	|When tooltipsEnabled = true, this property determines the value you are hovering over.	|IRadioHover	|No	|User Interaction	|
|selectedDisplayValue	|The display value that is currently selected.	|string	|Yes	|User Interaction	|
|selectedValue	|The value that is currently selected.	|any	|Yes	|User Interaction	|
|tooltipsEnabled	|Specifies whether tooltips are enabled.	|boolean	|Yes	|Direct Edit	|
|tooltipText	|The text displayed in tooltips. If this value is null or the empty string then no tooltip will be displayed. Supports HTML.	|string	|No	|Direct Edit	|
|values	|The values for the items in the radio button group.	|any\[]	|Yes	|Direct Edit	|

#### ICheckboxHover

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|displayValue	|The display value of the radio currently being hovered over.	|string	|Yes	|User Interaction	|
|index	|The index of the radio label currently being hovered over.	|number	|Yes	|User Interaction	|
|value	|The raw value of the radio currently being hovered over.	|any	|Yes	|User Interaction	|

***

## Segmented Control widget

The following tables offer usage details about the properties available to Segmented Control widgets.

### Properties

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|disabled	|Specifies whether the user can interact with the widget. Defaults to false. Values are typically templated expressions that produce booleans (e.g. “{{w1.on}}”).	|boolean	|Yes	|Direct Edit	|
|displayValues	|The values displayed in the segmented control. If not specified, ‘values’ will be used.	|any\[]	|No	|Direct Edit	|
|hover	|When tooltipsEnabled = true, this property determines the value you are hovering over.	|ISegmentedControlHover	|No	|User Interaction	|
|multiselectEnabled	|Specifies whether the user can select only one value or multiple values.	|boolean	|Yes	|Direct Edit	|
|preselectFirstElement	|Specifies whether the first value is selected by default or not.	|boolean	|Yes	|Direct Edit	|
|selectionRequired	|Specifies whether you can deselect all values. When enabled, this flag prevents the user from deselecting the final selected value in the widget. If the widget starts off with no values selected, prevents deselecting only after the user makes an initial selection.	|boolean	|Yes	|Direct Edit	|
|selectedValues	|The current user selected value or values.	|any\[]	|Yes	|User Interaction	|
|tooltipsEnabled	|Specifies whether tooltips should be shown or not	|boolean	|Yes	|User Interaction	|
|tooltipText	|The text displayed in tooltips. Supports HTML.	|string	|No	|Direct Edit	|
|values	|The values from which ‘selectedValues’ is set. Should be a one-to-one mapping to displayValues if displayValues is used.	|any\[]	|Yes	|Direct Edit	|

#### ISegmentedControlHover

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|displayValue	|The display value of the segment currently being hovered over.	|string	|Yes	|User Interaction	|
|index	|The index of the segment currently being hovered over. segments are numbered from left to right	|number	|Yes	|User Interaction	|
|value	|The raw value of the segment currently being hovered over.	|any	|Yes	|User Interaction	|

***

## Slider widget

The following tables offer usage details about the properties available to Slider widgets. Several examples follow the tables.

### Properties

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|disabled	|Specifies whether the user can interact with the widget. Defaults to false. Values are typically templated expressions that produce booleans (e.g. “{{w1.on}}”).	|boolean	|Yes	|Direct Edit	|
|formatMode	|Specifies how to format the slider labels. “Grouped” groups digits together with a specified delimiter. For example: 1000000 will become 1,000,000 if the delimiter is a comma. “Numeric” will format the values using a provided [Numeral.js ↗](http://numeraljs.com/) format. “Time” will format the values using a provided [moment.js ↗](https://momentjs.com/docs/#/displaying/format/) format.	|string	|Yes	|Direct Edit	|
|formatter	|When “Numeric” or “Time” is selected, this property holds the format string.	|string	|No	|Direct Edit	|
|from	|When range mode is enabled, this property holds the value of the lower bound of the range. Otherwise, it holds the value associated with the current position of the single slider handle.	|number	|Yes	|User Interaction	|
|groupingDelimiter	|When the “Grouped” format is selected, this property holds the delimiter string used to separate groups.	|string	|No	|Direct Edit	|
|max	|The maximum selectable value.	|number	|Yes	|Direct Edit	|
|min	|The minimum selectable value.	|number	|Yes	|Direct Edit	|
|numLabels	|The number of axis labels to display. If no value is provided, defaults to 6.	|number	|Yes	|Direct Edit	|
|postfix	|The text to append to all values. For example: ” €” will convert “100” in to “100 €”	|string	|No	|Direct Edit	|
|prefix	|The text to prepend to all values. For example: “$” will convert “100” in to “$100”	|string	|No	|Direct Edit	|
|rangeEnabled	|Specifies whether selection is enabled for a range of values or just a single point.	|boolean	|Yes	|Direct Edit	|
|step	|The step size for selectable values.	|number	|No	|Direct Edit	|
|to	|When range mode is enabled, this property holds the value of the upper bound of the range.	|number	|No	|User Interaction	|
|updateOnSlide	|Specifies when the value of the slider is updated. “Release” indicates that the value will be updated after the handle is released. “Slide” indicates that the value will be updated as the slider is dragged. You should avoid using “Slide” except for light operations (such as UI updates) due to performance impact. “Slide” updates are throttled to 100ms.	|boolean	|Yes	|Direct Edit	|

### Examples

#### Slider

```json
{
  "disabled": false,
  "from": 25,
  "groupingDelimiter": " ",
  "groupingEnabled": true,
  "max": "{{query1.maxValue}}",
  "min": 1,
  "prefix": "$",
  "rangeEnabled": true,
  "to": 50
}
```

### Defaults

```json
{
  "disabled": false,
  "from": 25,
  "groupingEnabled": false,
  "max": 100,
  "min": 0,
  "rangeEnabled": false
}
```

***

## Textarea widget

The following tables offer usage details about the properties available to Textarea widgets. Several examples follow the tables.

### Properties

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|delimiter	|A sequence of one or more characters which indicates separation of two values. For instance, if ‘text’ is “hello- -world” and ‘delimiter’ is “- -“, ‘values’ will result to `["hello", "world"]`	|string	|No	|Direct Edit	|
|disabled	|Specifies whether the user can interact with the widget. Defaults to false. Values are typically templated expressions that produce booleans (e.g. “{{w1.on}}”).	|boolean	|Yes	|Direct Edit	|
|hasValues	|Indicates if the user has input a value.	|boolean	|Yes	|User Interaction	|
|maxLengthEnabled	|If enabled, limits the length of text entered by the user.	|boolean	|Yes	|Direct Edit	|
|maxLength	|The maximum length of text allowed to be typed into the box.	|number	|No	|Direct Edit	|
|placeholder	|The text to use for the textarea placeholder (no IE9 support)	|string	|No	|Direct Edit	|
|text	|The text the user types into the box.	|string	|Yes	|User Interaction	|
|values	|The user input values derived from the inputText.	|array	|Yes	|User Interaction	|

### Examples

#### Textarea

```json
{
  "delimiter": ";",
  "disabled": false,
  "hasValues": true,
  "placeholder": "Choose an animal...",
  "text": "giraffe; rhinoceros; elephant",
  "values": [
    "giraffe",
    "rhinoceros",
    "elephant"
  ]
}
```

### Defaults

```json
{
  "delimiter": ";",
  "disabled": false,
  "hasValues": false,
  "text": "",
  "values": []
}
```

***

## Toggle widget

The following tables offer usage details about the properties available to Toggle widgets. Several examples follow the tables.

### Properties

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|disabled	|Specifies whether the user can interact with the widget. Defaults to false. Values are typically templated expressions that produce booleans (e.g. “{{w1.on}}”).	|boolean	|Yes	|Direct Edit	|
|offLabel	|The label for the ‘off’ state of the toggle switch	|string	|Yes	|Direct Edit	|
|onLabel	|The label for the ‘on’ state of the toggle switch	|string	|Yes	|Direct Edit	|
|useCustomIcons	|When selected, the toggle will use custom icons from Blueprint	|checkbox	|Yes	|Direct Edit	|
|onIcon	|The icon for the ‘on’ state of the toggle switch	|string	|No	|Direct Edit	|
|offIcon	|The icon for the ‘off’ state of the toggle switch	|string	|No	|Direct Edit	|
|on	|The current state of the toggle switch, with the ‘on’ state corresponding to ‘true’	|boolean	|Yes	|User Interaction	|
