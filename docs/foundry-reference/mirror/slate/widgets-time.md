<!-- source: https://palantir.com/docs/foundry/slate/widgets-time/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Time

The Time Widget category consist of the following widgets:

* [Calendar](#calendar-widget)
* [Date picker](#date-picker-widget)
* [Date range picker](#date-range-picker-widget)
* [Timeline](#timeline-widget)

***

## Calendar widget

The following tables offer usage details about the properties available to Calendar widgets.

### Properties

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|areEventsAllDay	|An Array of booleans that determine if the corresponding events are all-day events. All day events will appear in the “all-day” section of the views, and will only appear on days that are fully within the start and end times. Additionally, When all-day events are selected, their start and end times will reflect the adjusted time boundaries. For example: An all-day event from “January 1st 03:00” to “January 3rd 03:00” will render as “January 1st 00:00” to “January 3rd 00:00”.If left empty, events will default to All Day = false.	|json	|No	|Direct Edit	|
|dateRangeEnabled	|Adds the date range as a title for the Calendar that corresponds to the current view. This will be the day, week, or month currently displayed depending on the view.	|string	|Yes	|Direct Edit	|
|defaultDate	|The date that the calendar will default to on page load. If set to the empty string this will default the view to “today” thus causing the range to match the current date on page load.	|string	|Yes	|User Interaction	|
|eventEnds	|The end times of each event.	|json	|Yes	|Direct Edit	|
|eventNames	|The names to display on each event.	|json	|Yes	|Direct Edit	|
|eventSeries	|An Array of labels (strings) that group events into series for styling. If left empty, events will be displayed using the default styles.	|json	|No	|Direct Edit	|
|eventStarts	|The start times of each event.	|json	|Yes	|Direct Edit	|
|pagingEnabled	|Adds buttons which enable movement forwards and backwards by the current interval displayed, as well as a button to return to the current date.	|boolean	|Yes	|Direct Edit	|
|pagingYearEnabled	|Adds additional buttons which enable moving the currently viewed time range forwards or backwards by a full year	|boolean	|Yes	|Direct Edit	|
|selectedIndex	|The index of the event selected on the calendar. “null” if no event selected	|number	|Yes	|User Interaction	|
|viewDefault	|The view type (day, week, month) which will be rendered on application load. The dates displayed in this view are determined by the value of “defaultDate”. This defaults to the “Month” view.	|string	|Yes	|User Interaction	|
|viewType	|Controls the views accessible via the Day & Week buttons if they are enabled. When the type is set to “List” events will display as a list of items on in the order they are given to the widget, rather than in the order of their start times. When the type is set to “Time” events will display as blocks spanning the hours during which the event occurs. The display type has no effect on the Month view.	|string	|Yes	|Direct Edit	|
|viewSwitchingEnabled	|Enables/Disables the buttons for switching between day/week/month views. By default these buttons are enabled.	|boolean	|Yes	|Direct Edit	|

***

## Date Picker widget

The following tables offer usage details about the properties available to Date Picker widgets. Several examples follow the tables.

### Properties

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|disabled	|Specifies whether the user can interact with the widget. Defaults to false. Values are typically templated expressions that produce booleans (e.g. “{{w1.on}}”).	|boolean	|Yes	|Direct Edit	|
|displayFormat	|Format to use for displaying the selection in the picker’s input box. Must be a valid [moment.js format ↗](https://momentjs.com/docs/#/displaying/format/).	|string	|No	|Direct Edit	|
|maxDate	|The maximum selectable date, formatted as a string. If left blank, then the default maximum date is used (Dec. 31st of this year). The date must be formatted using the [ISO 8601 standard ↗](https://momentjs.com/docs/#/displaying/as-iso-string/).	|string	|No	|Direct Edit	|
|minDate	|The minimum selectable date, formatted as a string. If left blank, then the default minimum date is used (Jan. 1st, 20 years in the past). The date must be formatted using the [ISO 8601 standard ↗](https://momentjs.com/docs/#/displaying/as-iso-string/).	|string	|No	|Direct Edit	|
|placeholder	|The text to use as a placeholder when no date is selected.	|string	|Yes	|Direct Edit	|
|timeEnabled	|Specifies whether or not a time picker should be shown with the date picker.	|boolean	|Yes	|Direct Edit	|
|timePickerPrecision	|Determines what the precision of the time picker should be.	|number	|Yes	|Direct Edit	|
|value	|The current selection formatted as a string.	|string	|Yes	|User Interaction	|
|valueFormat	|The output string format for the “value” field. Must be a valid [moment.js format ↗](https://momentjs.com/docs/#/displaying/format/). If not provided or set to null, ISO 8601 formatting will be used.	|string	|No	|Direct Edit	|

### Examples

#### Date Picker

```json
{
  "disabled": false,
  "displayFormat": "MM/DD/YYYY",
  "timeEnabled": false,
  "value": "2014-09-10T05:00:00.000Z"
}
```

#### Date Picker with time enabled

```json
{
  "disabled": false,
  "timeEnabled": true,
  "value": "2014-09-10 13:00",
  "valueFormat": "YYYY-MM-DD HH:mm"
}
```

### Defaults

```json
{
  "disabled": false,
  "timeEnabled": false,
  "value": "",
  "valueFormat": "YYYY-MM-DD"
}
```

***

## Date Range Picker widget

The following tables offer usage details about the properties available to Date Range Picker widgets. Several examples follow the tables.

### Properties

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|disabled	|Specifies whether the user can interact with the widget. Defaults to false. Values are typically templated expressions that produce booleans (e.g. “{{w1.on}}”).	|boolean	|Yes	|Direct Edit	|
|displayFormat	|Format for displaying the dates. Must be a valid [moment.js format ↗](https://momentjs.com/docs/#/displaying/format/).	|string	|No	|Direct Edit	|
|fromDateValue	|The current ‘from’ date selection, formatted as a string. The date must be formatted using the [ISO 8601 standard ↗](https://momentjs.com/docs/#/displaying/as-iso-string/).	|string	|Yes	|User Interaction	|
|maxDate	|The maximum date the user can select in the date picker, formatted as a string. If left blank, then the default maximum date is used (Dec. 31st of this year). The date must be formatted using the [ISO 8601 standard ↗](https://momentjs.com/docs/#/displaying/as-iso-string/).	|string	|No	|Direct Edit	|
|minDate	|The minimum date the user can select in the date picker, formatted as a string. If left blank, then the default minimum date is used (Jan. 1st, 20 years in the past). The date must be formatted using the [ISO 8601 standard ↗](https://momentjs.com/docs/#/displaying/as-iso-string/).	|string	|No	|Direct Edit	|
|shortcutLabels	|Names of the shortcut ranges to display when shortcuts are shown, e.g. ‘Last 3 Days’ or ‘Last 3 Months’. If no labels are given, then the default shortcut ranges and labels are used.	|string\[]	|Yes	|Direct Edit	|
|shortcutRanges	|Date ranges for each shortcut. Each range must be formatted using the [ISO 8601 standard ↗](https://momentjs.com/docs/#/displaying/as-iso-string/)\[from\_date\_string, to\_date\_string], e.g. \[‘2016-05-01’, ‘2016-05-10’] or \[‘2016-05-01 16:00’, ‘2016-05-01 18:00’]	|string\[]\[]	|No	|Direct Edit	|
|shortcutsEnabled	|Determines whether date range shortcuts (e.g. Last 3 Days, Last 3 Months, etc.) are shown.	|boolean	|No	|Direct Edit	|
|toDateValue	|The current ‘to’ date selection, formatted as a string. The date must be formatted using the [ISO 8601 standard ↗](https://momentjs.com/docs/#/displaying/as-iso-string/).	|string	|Yes	|User Interaction	|
|timeEnabled	|Specifies whether a time picker should be shown with the date picker.	|boolean	|Yes	|Direct Edit	|
|timePickerPrecision	|Determines the precision of the time picker.	|number	|Yes	|Direct Edit	|

### Examples

#### Date Range Picker

```json
{
  "disabled": false,
  "displayFormat": "YYYY-MM-DD",
  "fromDateValue": "2016-09-10T05:00:00.000Z",
  "maxDate": "2020-01-01",
  "minDate": "2000-01-01",
  "shortcutsEnabled": false,
  "timeEnabled": false,
  "toDateValue": "2016-10-10T05:00:00.000Z"
}
```

#### Date Range Picker with time and shortcuts enabled

```json
{
  "disabled": false,
  "displayFormat": "YYYY-MM-DD hh:mm:sss a",
  "fromDateValue": "2016-09-10T05:13:11.001Z",
  "shortcutLabels": ["Q1", "Q2", "Q3", "Q4"],
  "shortcutRanges": [
    ["2015-10-01", "2015-12-31"],
    ["2016-01-01", "2016-03-31"],
    ["2016-04-01", "2016-06-30"],
    ["2016-07-01", "2016-09-30"]
  ],
  "shortcutsEnabled": true,
  "timeEnabled": true,
  "timePickerPrecision": 0,
  "toDateValue": "2016-10-10T05:14:11.002Z"
}
```

### Defaults

```json
{
  "disabled": false,
  "displayFormat": "YYYY-MM-DD",
  "fromDateValue": null,
  "shortcutsEnabled": false,
  "timeEnabled": false,
  "timePickerPrecision": 0,
  "toDateValue": null
}
```

***

## Timeline widget

The following tables offer usage details about the properties available to Timeline widgets. Several examples follow the tables.

### Properties

|Attribute	|Description	|Type	|Required	|Changed By	|
|---	|---	|---	|---	|---	|
|cssClasses	|An array of class names, each to be added to its respective event on the timeline.	|string\[]	|No	|Direct Edit	|
|dates	|An array of dates, denoting the events to display on the timeline. Will be displayed in the order provided.	|any\[]	|Yes	|Direct Edit	|
|details	|Supporting details to be displayed underneath corresponding event title.	|string\[]	|No	|Direct Edit	|
|titles	|The names/titles of the events to be displayed on the timeline.	|string\[]	|Yes	|Direct Edit	|

### Examples

#### Timeline

```json
{
  "cssClasses": [
    "green",
    "red",
    "green"
  ],
  "dates": "{{query1.dates}}",
  "details": [
    "this first event was spectacular",
    null,
    "the third event was alright"
  ],
  "titles": "{{query1.titles}}"
}
```

### Defaults

```json
{
  "cssClasses": [],
  "dates": [],
  "details": [],
  "titles": []
}
```
