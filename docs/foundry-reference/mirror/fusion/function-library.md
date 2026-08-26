<!-- source: https://palantir.com/docs/foundry/fusion/function-library/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Function library

## Core functions

These functions are Fusion's default methods.

***

#### abs(value: number): number

Computes the absolute value of a number (ie the number without its sign).

For example: `abs(-2)` will return the value 2.

**Arguments**

* `value`: *NUMBER*

***

#### acos(value: number): number

Returns the arccosine of a number. The arccosine is the angle whose cosine is a number. The returned angle is given in radians in the range 0 to Π.

For example: `acos(1)` will return the value 0.

**Arguments**

* `value`: *NUMBER*

***

#### all\_token\_match(value: any): same\_as\_first\_argument

Returns a `value` tagged with a modifier that allows search and lookups to be performed in a tokenized manner, for which all terms appear somewhere in the result.

**Arguments**

* `value`: *ANY*

***

#### any\_token\_match(value: any): same\_as\_first\_argument

Returns a `value` tagged with a modifier that allows search and lookups to be performed in a tokenized manner, for which at least one of the terms appears somewhere in the result.

**Arguments**

* `value`: *ANY*

***

#### array(\[arg: any, ...]): string

Creates an array of all input attributes. The resulting array will be surrounded by \[square brackets]. All attributes will be listed in a single cell.

For example: `array('John', 'Mary', 'Richard')` results in the array \[ John, Mary, Richard ]

Note: If the attributes are strings, they need to be enclosed in 'single quotations'.

**Arguments**

* `arg`: *ANY*

***

#### array\_concat(\[array: array, ...]): array

Concatenates all input arrays into one single array.

For example: Suppose you have the array \[1,2,3] in cell A1 and array \[4,5,6] in cell A2. `Array_concat(A1,A2)` will return the new array \[1,2,3,4,5,6].

**Arguments**

* `array`: *ARRAY*

***

#### array\_contains(array: array, value: any): boolean

Checks whether the `array` contains `value`. Function returns true if the array contains the value.

For example: If the array \[ John, Mary, Richard ] is in cell E7, implementing `array_contains(E7, 'Richard')` will check for the value 'Richard' within the array. In this case, the function will return True. If we entered `array_contains(E7, 'Louise')`, the function will return False.

**Arguments**

* `array`: *ARRAY*
* `value`: *ANY*

***

#### array\_difference(array: array, \[differenceArrays: array, ...]): array

Returns all the unique elements in the first array that are not in any of the other arrays with no guarantee on order.

For example: Given array `[ John, Mary, Richard, Richard ]` is in cell E7, and array `[ John, Mary, Bob]` is in cell E8, `array_difference(E7, E8)` will return `[ Richard ]`.

**Arguments**

* `array`: *ARRAY*
* `differenceArrays`: *ARRAY*

***

#### array\_distinct(\[value: any, ...]): array

Returns an array containing only the distinct values of the input arguments.

For example: `array_distinct(array(3, 2, 1), 4, array(1, 2))` will return array(3, 1, 4, 2).

Note: The ordering of the values is not preserved. Additionally, any tags (e.g. fuzzy or exact) attached to the values will be dropped.

**Arguments**

* `value`: *ANY*

***

#### array\_flatten(\[arg: any, ...]): string

Creates an array of all input attributes. The resulting array will be surrounded by \[square brackets]. All attributes will be listed in a single cell.
This function is similar to `array`, but will collapse cell ranges and arrays, taking the values left-to-right, row-by-row. Empty values and errors in ranges will be ignored.

For example: `array_flatten('John', A1:B2)` where `A1 = array('Zoe', 'Charles')`, `A2 = 'Mary'` and `B2 = 'Richard'`, results in the array \[ John, Zoe, Charles, Mary, Richard ]. Notice that the array in cell `A1` was flattened into the output, and that the empty cell `B1` was skipped.

Note: If the attributes are strings, they need to be enclosed in 'single quotations'.

**Arguments**

* `arg`: *ANY*

***

#### array\_get\_at\_index(array: array, index: number): any

Returns the element at position `index` (1-indexed) from the specified `array`.

For example: If the array \[ John, Mary, Richard ] is in cell E7, and we want to verify which attribute is in position 3, we can use `array_get_at_index(E7, 3)`. This will return Richard, the third attribute in the array.

**Arguments**

* `array`: *ARRAY*
* `index`: *NUMBER*

***

#### array\_get\_first(array: array): any

Gets the first element of `array`.

**Arguments**

* `array`: *ARRAY*

***

#### array\_get\_last(array: array): any

Gets the last element of `array`.

**Arguments**

* `array`: *ARRAY*

***

#### array\_intersection(array: array, \[intersectionArrays: array, ...]): array

Returns all the unique elements that are in all of the given arrays with no guarantee on order.

For example: Given array `[ John, Mary, Mary, Richard ]` is in cell E7, and array `[ John, Mary, John, Bob]` is in cell E8, `array_intersection(E7, E8)` will return `[ John, Mary ]`.

**Arguments**

* `array`: *ARRAY*
* `intersectionArrays`: *ARRAY*

***

#### array\_length(array: array): number

Returns the length of the given array.

For example: If the array \[ John, Mary, Richard ] is in cell E7 and we want to determine the length of the array, we can write: `array_length(E7)`. The function will return the value 3, as there are three attributes in the array.

**Arguments**

* `array`: *ARRAY*

***

#### array\_slice(array: array, start\_index: number, \[end\_index: number]): array

Slices `array` starting at `start_index` (inclusive) and ending at `end_index` (inclusive) and returns an array.

For example: If the array `[ John, Mary, Richard ]` is in cell E7, `array_slice(E7, 1, 2)` will return `[ John, Mary ]`.
If `start_index` is zero or greater than the length of the array, an empty array is returned. e.g. `array_slice(E7, 5, 2)` → `[]`. If `start_index` is negative, it is used as an offset from the end of the array. e.g. `array_slice(E7, -2, 2)` → `[ Mary ]`. If `end_index` is zero or greater than the length of the array, a subarray until the end of the array is extracted. e.g. `array_slice(E7, 2, 5)` → `[ Mary, Richard ]`. If `end_index` is negative, it is used as an offset from the end of the array. e.g. `array_slice(E7, 1, -2)` → `[ John, Mary ]`.

**Arguments**

* `array`: *ARRAY*
* `start_index`: *NUMBER*
* `end_index`: *NUMBER*

***

#### array\_sort(array: array, \[sort\_direction: any]): array

Returns the given array sorted ascending. You can specify FALSE or 'DESC' as the second parameter to sort descending.

For example: If the array \[ 3, 4, 1 ] is in cell E7 and we want to sort the array, we can write: `array_sort(E7, 'DESC')`. The function will return the array \[ 4, 3, 1 ].

**Arguments**

* `array`: *ARRAY*
* `sort_direction`: *ANY*

***

#### array\_zip(\[array: array, ...]): array

Creates an array of grouped elements, the first of which contains the first elements of the given arrays, the second of which contains the second elements of the given arrays, and so on. The resulting array's length will be equal to the length of the shortest input array.

For example: If you have the array `['a', 'b', 'c']` in cell A1 and array `[1, 2, 3]` in cell A2. `array_zip(A1, A2)` will return the new array `[ [ 'a', '1' ], [ 'b', '2' ], [ 'c', '3' ] ]`.

**Arguments**

* `array`: *ARRAY*

***

#### asin(value: number): number

Returns the arcsine, or inverse sine, of a number. The arcsine is the angle whose sine is number. The returned angle is given in radians in the range -Π/2 to Π/2.

For example: `asin(-1)` will return the value -Π/2.

**Arguments**

* `value`: *NUMBER*

***

#### atan(value: number): number

Returns the arctangent of a number. The arctangent is the angle whose tangent is number. The returned angle is given in radians in the range -Π/2 to Π/2.

For example: `atan(0)` will return the value 0.

**Arguments**

* `value`: *NUMBER*

***

#### atan2(x\_num: number, y\_num: number): number

Returns the arctangent, or inverse tangent, of the specified x- and y-coordinates. The arctangent is the angle from the x-axis to a line containing the origin (0, 0) and a point with coordinates (x\_num, y\_num). The angle is given in radians between -Π to Π, excluding -Π.

For example: `atan2(1,1)` will return the value 0.785398163.

**Arguments**

* `x_num`: *NUMBER*
* `y_num`: *NUMBER*

***

#### avg(\[range: range, ...]): number

Computes the numeric average of a specified `range`. This range can be entered as a set of values or a range of values.

For example: `avg(5, 7, 11)` will return 7.66.

**Arguments**

* `range`: *RANGE*

***

#### binary(\[value: any, ...]): binary

Create a binary object from numbers. Every number will be considered as an unsigned byte (0-255). Higher order bits will be ignored.

For example: `binary(0, 0, 127)`.

**Arguments**

* `value`: *ANY*

***

#### branch(dataset\_path: string, branch\_name: string): same\_as\_first\_argument

Returns `dataset_path` tagged with `branch_name`. Apply to the first argument in a lookup to specify the branch to use in the search.

Note:  If you are unable to find a dataset which is newly indexed, either refresh the page or navigate to **Find and use data**, select **Indexed datasets**, and then select the refresh button.

**Arguments**

* `dataset_path`: *STRING*
* `branch_name`: *STRING*

***

#### case\_toggle(value: string): string

Changes uppercase to lowercase and vice-versa. Numbers are left unchanged.

**Arguments**

* `value`: *STRING*

***

#### cbrt(value: number): number

Computes the cubic root of the given `value`.

For example: `cbrt(8)` will return 2.

**Arguments**

* `value`: *NUMBER*

***

#### ceil(value: number): number

Computes the ceiling of the given `value` by rounding up to the nearest number without decimals.

For example: `Ceil(5.2)` will return 6.

**Arguments**

* `value`: *NUMBER*

***

#### checkbox(\[checked: boolean], \[label: string]): boolean

Renders a checkbox that returns true if checked and false otherwise, with an optional label. Defaults to false and unchecked if no checked argument is provided.

**Arguments**

* `checked`: *BOOLEAN*
* `label`: *STRING*

***

#### coalesce(\[arg: any, ...]): any

Returns the first attribute that is not null. Or, if all attributes are null, will return null.

For example: Suppose we have a column A with a mix of names and null values. If we use `coalesce(columnA)`, the function will return the first name available.

**Arguments**

* `arg`: *ANY*

***

#### color(cell\_value: any, \[text\_color: string], \[background\_color: string]): any

Renders a cell with specified text and background color.

**Arguments**

* `cell_value`: *ANY*
* `text_color`: *STRING*
* `background_color`: *STRING*

***

#### concat(\[arg: string, ...]): string

Concatenates multiple input string attributes together into a single string attribute.

For example: Suppose the first name John lives in cell A2, and the last name Smith lives in cell B2. Using the concat function, we can type `concat(A2, ' ', B2)` in C2 to get the string `'John Smith'`.

All collection type arguments are recursively flattened.
For example, `concat(array(1, 2), array(array(3, 4, 5)), 6)` will return the string `'123456'`.

* `arg`: *STRING*

***

#### concat\_ws(separator: string, \[arg: string, ...]): string

Concatenates multiple input string attributes together into a single string attribute with a `separator` between all arguments. All collection type arguments will be recursively flattened.

For example: Suppose that the first name John lives in cell A2, and the last name Smith lives in cell B2. Using the concat\_ws function, we can type `concat_ws('_',A2, B2)` in C2 and get the result 'John\_Smith'.

All collection type arguments are recursively flattened like in the `concat` function.

**Arguments**

* `separator`: *STRING*
* `arg`: *STRING*

***

#### cos(value: number): number

Computes the cosine of the given `value`.

For example: `cos(190)` will return 0.066.

**Arguments**

* `value`: *NUMBER*

***

#### count(\[range: range, ...]): number

Returns the number of items in a group.

For example: Suppose we want to know the count of objects within a particular column. We can select the count function, highlight the column, and retrieve a value.

**Arguments**

* `range`: *RANGE*

***

#### count\_distinct(\[range: range, ...]): number

Returns the number of distinct items in a group.

For example: `count_distinct(columnA)` will return the distinct number of objects within this column. This function can also be applied to arrays and will return the distinct number of objects within that array.

**Arguments**

* `range`: *RANGE*

***

#### count\_numeric(\[value: any, ...]): number

Counts the number of numeric items in a group.

For example: Suppose you have 100 rows containing a variety of names and numbers. To determine only the number of numeric items in this column, use `count_numeric(A1:A100)` to obtain the value.

**Arguments**

* `value`: *ANY*

***

#### countif(range: range, criteria: any): number

Returns the number of items in range `range` that is equal to a specified `criteria`.

For example: Suppose Column A contains a list of animals and you want to know how many times 'Dog' is listed in the first 100 rows. Use `countif(A1:A100, 'Dog')` to receive a unique count.

**Arguments**

* `range`: *RANGE*
* `criteria`: *ANY*

***

#### countifs(\[range: range, criteria: any, ...]): number

Returns the number of items in range `range` that is equal to `criteria` for all `range`, `criteria` pairs.

For example: `countifs(A1:A100, 'Red', B1:B100, 2)` will return the count of all values that contain the value Red in Column A and the number 2 in Column B.

**Arguments**

* `range`: *RANGE*
* `criteria`: *ANY*

***

#### date(year: number, month: number, day: number): date\_time

Creates a date with a defined `year`, `month`, `day` in the format yyyy-MM-dd.

For dates where the year is < 1900 (e.g. '97'), the year will be interpreted as an offset from 1900 (e.g. '1997').

**Arguments**

* `year`: *NUMBER*
* `month`: *NUMBER*
* `day`: *NUMBER*

***

#### date\_add(dateOrDaysLeft: any, dateOrDaysRight: any): date\_time

Returns the date or timestamp that is the result of `dateOrDaysLeft` plus `dateOfDaysRight`. Each parameter can either be a number of days or fraction of days or a date. The date must be in the format yyyy-MM-dd.

For example: Suppose that we want to know the date 40 days after 2021-05-06. This date lives in cell D2. Use `date_add(D2, 40)` to get 2021-06-15. For example: If I want the timestamp for the date 2021-05-06 plus half a day. This date lives in cell D2. Use `date_add(D2, 0.5)` to get [2021-05-06 12](tel:2021050612):00.

**Arguments**

* `dateOrDaysLeft`: *ANY*
* `dateOrDaysRight`: *ANY*

***

#### date\_diff(start: date\_time, end: date\_time): number

Returns the number of days from `start` to `end`. The dates must be in the format yyyy-MM-dd.

For example: Suppose we want to know the number of days between 2021-01-15 and 2021-06-15. These cells live in B2 and B5 respectively. Use `date_diff (B2, B5)` to get a -151 day difference.

**Arguments**

* `start`: *DATE\_TIME*
* `end`: *DATE\_TIME*

***

#### date\_format(date: date\_time, format: string): string

Converts a date/timestamp `date` to a string in the format specified by the string in `format`. The format can be variations of the string yyyy-MM-dd.

For example: Re-format the date 2021-05-06 to 05-06-21 with `date_format('2021-05-06', 'MM-dd-yy')`.

**Arguments**

* `date`: *DATE\_TIME*
* `format`: *STRING*

***

#### date\_sub(dateOrDaysLeft: any, dateOfDaysRight: any): date\_time

Returns the date or timestamp that is the result of `dateOrDaysLeft` minus `dateOfDaysRight`. Each parameter can either be a number of days or fraction of days or a date. The date must be in the format yyyy-MM-dd.

For example: Suppose we want to know the date 40 days prior to 2021-05-06. This date lives in cell D2. Use `date_sub(D2, 40)` to get 2021-03-27. For example: If I want the timestamp for the date 2021-05-06 minus half a day. This date lives in cell D2. Use `date_sub(D2, 0.5)` to get [2021-05-05 12](tel:2021050512):00. For example: If I want the difference in days between two dates where one date is in cell D1 and the other in cell D2. Use `date_sub(D1, D2)`.

**Arguments**

* `dateOrDaysLeft`: *ANY*
* `dateOfDaysRight`: *ANY*

***

#### datepicker(\[selectedDateTime: date\_time], \[timePrecision: string]): date\_time

Returns a datepicker with the selected date. The date must be in the format yyyy-MM-dd with optionally HH\:mm:ss (time information). Time precision must be one of 'NONE', 'MINUTE', or 'SECOND'.

**Arguments**

* `selectedDateTime`: *DATE\_TIME*
* `timePrecision`: *STRING*

***

#### day\_of\_month(date: date\_time): number

Extracts the day of the month as an integer from a given date/timestamp/string.

For example: Suppose the date 2021-06-18 lives in cell B2. `day_of_month(B2)` will return 18.

**Arguments**

* `date`: *DATE\_TIME*

***

#### day\_of\_year(date: date\_time): number

Calculates the day of the year as an integer from a given date/timestamp/string.

For example: Suppose the date 2021-06-18 lives in cell B2. `day_of_year(B2)` will return 169.

**Arguments**

* `date`: *DATE\_TIME*

***

#### document\_metadata(key: string): string

Accesses document metadata. To implement, pass in the `key` of the metadata field you need.

Supported keys:

* `creator` returns the creator of the document (if known).
* `document_identifier` returns the internal identifier of the document (used, for example, in the `submit_to_region_with_key` function)

For example: `document_metadata('creator')` will return the username of the document's creator.

**Arguments**

* `key`: *STRING*

***

#### dropdown(values: array, \[selected\_value: string], \[allow\_invalid: boolean], \[placeholder\_text: string]): any

Renders a dropdown with values that can be selected from the supplied `values` array. The `values` must be unique, as each value is converted to a string label in the dropdown.

For example, `=dropdown(array('red', 'blue', 'green'))` will create a dropdown with values 'red', 'blue', 'green'.

When a `selected_value` is supplied, it specifies a default string label for the dropdown. `selected_value` is optional and can be set to null, which will default the dropdown's selection to an unselected state. If `selected_value` is set and the selected label is no longer found in the `values` array (such as if the underlying data changes), the result will be an empty cell.

When `allow_invalid` is set to true, it will override this behavior and still output the previously saved selection. This result can only be a string and is only recommended when trying to preserve the prior selection from a set of string values.

`placeholder_text` allows you to show a text in the dropdown when no value is selected (it can be useful as a prompt or instructions)

**Arguments**

* `values`: *ARRAY*
* `selected_value`: *STRING*
* `allow_invalid`: *BOOLEAN*
* `placeholder_text`: *STRING*

***

#### empty\_cell(): any

Return an empty result. Useful when combined with the `if` or `iferror` functions (e.g. `if(not isnull(A1), A1, empty_cell())`)

***

#### eq(value: any): same\_as\_first\_argument

Mark the current `value` as an equality (`==`) comparison.

Apply to an argument in a lookup function to change the search behavior.

**Arguments**

* `value`: *ANY*

***

#### exact(value: any): same\_as\_first\_argument

Returns a `value` tagged with a modifier to make searches and lookups seek exact matches to the `value`.

**Arguments**

* `value`: *ANY*

***

#### exp(value: number): number

Returns e raised to the power of `value`. The constant e equals 2.718, the base of the natural logarithm.

For example: `exp(2)` returns 7.389. This is the result of the natural logarithm e raised to the power of 2.

**Arguments**

* `value`: *NUMBER*

***

#### experimental\_add\_tags(value: any, tags: array): same\_as\_first\_argument \[EXPERIMENTAL]

Adds the `tags` to `value` and returns the new tagged value.

**Arguments**

* `value`: *ANY*
* `tags`: *ARRAY*

***

#### experimental\_copy\_and\_sync\_button(label: string, folder: string, name: string, \[exports: array], \[onCompleteMessage: string], \[onFailureMessage: string], \[redirectToHomeAfterCompletion: boolean]): same\_as\_first\_argument \[EXPERIMENTAL]

Render a button, with label `label`, that, when clicked, will copy the spreadsheet to `folder`, with the name `name`.

Exports will be copied using the following pattern: ‘`$name` - Export `$sheetName`'. The exports can be constrained by passing in the sheet names of the desired exports in `exports`. If any exports are missing the copy will fail. Completion and failure messages can be passed in `onCompleteMessage` and `onFailureMessage` respectively. If `redirectToHomeAfterCompletion` is set to true, the user will be redirected to their home folder after completion.

**Arguments**

* `label`: *STRING*
* `folder`: *STRING*
* `name`: *STRING*
* `exports`: *ARRAY*
* `onCompleteMessage`: *STRING*
* `onFailureMessage`: *STRING*
* `redirectToHomeAfterCompletion`: *BOOLEAN*

***

#### experimental\_error(\[value: string, ...]): any \[EXPERIMENTAL]

Output an error.

**Arguments**

* `value`: *STRING*

***

#### experimental\_get\_tags(value: any): array \[EXPERIMENTAL]

Returns the array of tags associated with `value`.

**Arguments**

* `value`: *ANY*

***

#### experimental\_io\_blocking\_function(\[extra\_delay: number]): string \[EXPERIMENTAL]

Test method that blocks I/O until timed out. Optionally can be given an extra delay to wait after being timed out to simulate badly behaving I/O functions.

**Arguments**

* `extra_delay`: *NUMBER*

***

#### experimental\_range(width: number, \[value: any, ...]): range \[EXPERIMENTAL]

Output a range.

**Arguments**

* `width`: *NUMBER*
* `value`: *ANY*

***

#### experimental\_remove\_tags(value: any, \[tags: array]): same\_as\_first\_argument \[EXPERIMENTAL]

Removes the tags in array `tags` from `value`, or removes all tags from `value` if the `tags` argument is absent.

**Arguments**

* `value`: *ANY*
* `tags`: *ARRAY*

***

#### factorial(value: number): number

Computes the factorial of the given `value`.

For example: `factorial(3)` will return 6.

**Arguments**

* `value`: *NUMBER*

***

#### find(search\_for: string, text\_to\_search: string, \[starting\_index: number]): number

Returns the index of the first instance of `search_for` in the string `text_to_search`. You can optionally provide a `starting_index` for the search.

For example: Suppose you have the phrase 'The grey cat chased the grey mouse' in cell A1. To determine the index of the first instance of 'grey', implement `find('grey', A1)` to get index 5.

**Arguments**

* `search_for`: *STRING*
* `text_to_search`: *STRING*
* `starting_index`: *NUMBER*

***

#### floor(value: number): number

Computes the floor of the given `value` by rounding down to the nearest number without decimals.

For example: `floor(3.2)` will round to 3. And, `floor (-4.5)` will round to -5.

**Arguments**

* `value`: *NUMBER*

***

#### format\_number(value: number, decimalPlaces: number): number

Formats the numeric cell `value` to a format like #,###.##, rounded to the number of decimals specified by `decimalPlaces`. The function returns the result as a string.

For example: Suppose you have a column of 4 digit numbers in column A and you want to include thousand separators as well as 2 decimal places. Use `format_number(A1, 2)` to reformat the first number to #,###.00. Drag down the box to apply to the rest of Column A.

**Arguments**

* `value`: *NUMBER*
* `decimalPlaces`: *NUMBER*

***

#### format\_string(\[format: string, ...]): number

Formats `arg` in printf-style and returns the result as a string attribute using `format`.

**Arguments**

* `format`: *STRING*

***

#### fuzzy(value: any, \[distance: number]): same\_as\_first\_argument

Returns a `value` tagged with a modifier that allows search and lookups to be performed in a fuzzy manner, where the searched value is within `distance` edits of the real value. Only edit distances of 0, 1 and 2 are supported, defaulting to 2.

The distance corresponds to the Levenshtein distance, a measure of the number of single-character edits required to go from one string to another.

**Arguments**

* `value`: *ANY*
* `distance`: *NUMBER*

***

#### get\_object\_rid(object\_or\_property: any): string

Returns the object RID of the given object or object property.

**Arguments**

* `object_or_property`: *ANY*

***

#### get\_object\_type\_id(object\_or\_property: any): string

Returns the object type id of the given object or object property.

**Arguments**

* `object_or_property`: *ANY*

***

#### get\_property(object: object, key: string): object

Returns the given property of the object.

**Arguments**

* `object`: *OBJECT*
* `key`: *STRING*

***

#### gt(value: any): same\_as\_first\_argument

Mark the current `value` as a greater-than (`>`) comparison.

Apply to an argument in a lookup function to change the search behavior.

**Arguments**

* `value`: *ANY*

***

#### gte(value: any): same\_as\_first\_argument

Mark the current `value` as a greater-than or equal to (`>=`) comparison.

Apply to an argument in a lookup function to change the search behavior.

**Arguments**

* `value`: *ANY*

***

#### hlookup(value: any, range: range, row: number): any

Lookup `value` in the first row of `range` and grab `row` (starting at 1).

For example: Say Column A is a list of colors. `hlookup(A1,A1:A100,5)` will return the color in the 5th row of that column.

**Arguments**

* `value`: *ANY*
* `range`: *RANGE*
* `row`: *NUMBER*

***

#### hour(date: date\_time): number

Extracts the hour as an integer from a given date/timestamp/string. This function will ignore the dates and minutes within the string.

For example: Suppose you have the timestamp [2021-02-15 08](tel:2021021508):30:15 in cell A2. `hour(A2)` will return 8.

**Arguments**

* `date`: *DATE\_TIME*

***

#### if(condition: boolean, value\_if\_true: any, value\_if\_false: any): any

If the `condition` evaluates to true, return the value specified in `value_if_true`. If the `condition` evaluates to false, return the value specified in `value_if_false`.

For example: Say we implement the function `if(A1 >=5, 'True', 'False')`. If A1 equals 6, the function will return True. If A1 equals 4, the function will return False.

**Arguments**

* `condition`: *BOOLEAN*
* `value_if_true`: *ANY*
* `value_if_false`: *ANY*

***

#### iferror(value: any, value\_if\_error: any): any

Returns `value` if no error is detected. Otherwise, throws the error specified by `value_if_error`. This function provides a more elegant solution to managing error messaging.

For example: Say you have the simple formula A1/B2 in cell C3. If B2 is blank, you want the formula to throw the error 'Enter a value in B2.' Implement `iferror(A1/B2, 'Enter a value in B2.')`.

**Arguments**

* `value`: *ANY*
* `value_if_error`: *ANY*

***

#### index(range: range, row\_offset: number, column\_offset: number): any

Returns the content of a cell within a `range`, specified by the `row_offset` and `column_offset`. The `row_offset` specifies the row you want to pull data from while the `column_offset` specifies the column you want to pull data from.

For example: `index(A1:C6, 2, 3)` means that you want to pull data from the range A1:C6 from row 2, column 3.

Note: If the row offset is set to 0, an entire column will be selected as specified by `column_offset`. If the column offset is 0, an entire row will be selected as specified by `row_offset`. If both are zero, the entire range of cells will be selected.

**Arguments**

* `range`: *RANGE*
* `row_offset`: *NUMBER*
* `column_offset`: *NUMBER*

***

#### internal\_region\_result(region\_id: string): any \[EXPERIMENTAL]

Internal function.

**Arguments**

* `region_id`: *STRING*

***

#### isNull(value: any): boolean

Returns true if the attribute is null or an empty cell. Otherwise, the function returns false.

For example: Suppose column A contains a mix of integers and null values. Use `isnull(A1)` to determine if the first value in the column is true (ie a null value) or an integer. Drag down this formula to apply to the rest of the column.

**Arguments**

* `value`: *ANY*

***

#### last\_day(date: date\_time): number

Given a `date` attribute, the function returns the last day of the specified month in the format yyyy-MM-dd. Note: The date must be entered as a string.

For example: Suppose the current date is 2021-02-01 and you want to compute the last date of the month. Use `last_day('2021-02-01')` to get 2021-02-28. Note: A date in January will always return 31, while a date in February will return 28 or 29, depending on the year.

**Arguments**

* `date`: *DATE\_TIME*

***

#### left(text: string, \[num\_chars: number]): string

Returns the number of characters specified in `num_chars` from the start of string `text`.

For example: If the string 'John Smith' is in cell A2 , `right(A2, 3)` will return `ith`.

**Arguments**

* `text`: *STRING*
* `num_chars`: *NUMBER*

***

#### length(value: any): number

Computes the length of a given string or binary attribute based on the number of characters.

For example: `length('John Smith')` will return 10.

**Arguments**

* `value`: *ANY*

***

#### ln(value: number): number

Computes the natural logarithm of the given value. If the value is 0 or below, the function will return an error.

For example: `ln(7)` will return 1.9459.

**Arguments**

* `value`: *NUMBER*

***

#### log(value: number, base: number): number

Computes the logarithm of `value` with the base specified in `base`.

For example: `log(8,2)` will return 3.

**Arguments**

* `value`: *NUMBER*
* `base`: *NUMBER*

***

#### lookup(dataset\_path: string, result\_column: string, \[column: string, value: string, ...]): any

Returns values from the `result_column` in `dataset_path` that match the filters defined in the `column`, `value` pairs.

For example: `lookup('/Users/me/myData', 'my_column', 'first_name', 'John', 'last_name', 'Doe')` will search through the dataset '/Users/me/myData' for the row(s) where first\_name = 'John' and last\_name = 'Doe' in the column 'my\_column'. The function will grab the value(s) of my\_column that match the filters.

Note:

* `Value` can be wrapped using `exact` or `fuzzy` functions to specify if matches should be exact or fuzzy. `Dataset_path` can be wrapped using the `branch` function to specify a branch of the dataset to lookup.
* If you are unable to find a dataset which is newly indexed, either refresh the page or navigate to **Find and use data**, select **Indexed datasets**, and then select the refresh button.

**Arguments**

* `dataset_path`: *STRING*
* `result_column`: *STRING*
* `column`: *STRING*
* `value`: *STRING*

***

#### lookup\_array(dataset\_path: string, result\_column: string, \[column: string, value: string, ...]): any

Returns matching values from `result_column` in `dataset_path` as a sorted array based on a global ordering of the rows. Results are filtered using subsequent arguments defined in `column`, `value` pairs.

For example: `lookup('/Users/me/myData', 'my_column', 'first_name', 'John', 'last_name', 'Doe')` will search through the dataset at '/Users/me/myData' for the rows where first\_name = 'John' and last\_name = 'Doe', and grab the values of my\_column in matching rows.

Note:

* `Value` can be wrapped using `exact` or `fuzzy` functions to specify if matches should be exact or fuzzy.
* If you are unable to find a dataset which is newly indexed, either refresh the page or navigate to **Find and use data**, select **Indexed datasets**, and then select the refresh button.

**Arguments**

* `dataset_path`: *STRING*
* `result_column`: *STRING*
* `column`: *STRING*
* `value`: *STRING*

***

#### lookup\_distinct(dataset\_path: string, result\_column: string, \[column: string, value: string, ...]): any

Returns distinct values from the `result_column` in `dataset_path` that match the filters defined in the `column`, `value` pair.

For example: `lookup_distinct('/Users/me/myData', 'my_column', 'first_name', 'John')` will search through the dataset '/Users/me/myData' for the row(s) where first\_name = 'John' in the column 'my\_column'. The function will grab the distinct value(s) of 'my\_column' that match the filters.

Note:

* `Value` can be wrapped using `exact` or `fuzzy` functions to specify if matches should be exact or fuzzy. `Dataset_path` can be wrapped using the `branch` function to specify a branch of the dataset to lookup.
* If you are unable to find a dataset which is newly indexed, either refresh the page or navigate to **Find and use data**, select **Indexed datasets**, and then select the refresh button.

**Arguments**

* `dataset_path`: *STRING*
* `result_column`: *STRING*
* `column`: *STRING*
* `value`: *STRING*

***

#### lookup\_dropdown(dataset\_path: string, result\_column: string, \[selected\_value: string], \[column: string, value: string, ...]): any

Returns a dropdown with suggested values from the `result_column` in `dataset_path`, `selected_value` is the current value.
`selected_value` can be set to null, which will default the dropdown's selection to an unselected state.

For example: `lookup_dropdown('/Users/me/myData', 'my_column', NULL, 'first_name', 'John')` will return a dropdown with options from '/Users/me/myData' for the row(s) where first\_name = 'John' in the column 'my\_column'. The function will grab the distinct value(s) of 'my\_column' that match the filters.

Note: If you are unable to find a dataset which is newly indexed, either refresh the page or navigate to **Find and use data**, select **Indexed datasets**, and then select the refresh button.

**Arguments**

* `dataset_path`: *STRING*
* `result_column`: *STRING*
* `selected_value`: *STRING*
* `column`: *STRING*
* `value`: *STRING*

***

#### lookup\_schema(datasource\_path: string, \[branch: string]): array

Returns the column names for the datasource specified by `datasource_path`. You can optionally provide a datasource branch for your search.

Note:

* Column names will be returned as an array.
* If you are unable to find a dataset which is newly indexed, either refresh the page or navigate to **Find and use data**, select **Indexed datasets**, and then select the refresh button.

**Arguments**

* `datasource_path`: *STRING*
* `branch`: *STRING*

***

#### \[DEPRECATED] lookup\_set(dataset\_path: string, result\_column: string, \[column: string, value: string, ...]): any

Returns matching values from `result_column` in `dataset_path` as an unordered set. Results are filtered using subsequent arguments defined in `column`, `value` pairs.

For example: lookup('/Users/me/myData', 'my\_column', 'first\_name', 'John', 'last\_name', 'Doe') will search through the dataset at '/Users/me/myData' for the rows where first\_name = 'John' and last\_name = 'Doe', and grab the values of my\_column in matching rows.

Note:

* `Value` can be wrapped using `exact` or `fuzzy` functions to specify if matches should be exact or fuzzy.
* If you are unable to find a dataset which is newly indexed, either refresh the page or navigate to **Find and use data**, select **Indexed datasets**, and then select the refresh button.

**Arguments**

* `dataset_path`: *STRING*
* `result_column`: *STRING*
* `column`: *STRING*
* `value`: *STRING*

***

#### lookup\_sorted(dataset\_path: string, result\_column: string, sort\_column: string, sort\_direction: string, \[column: string, value: string, ...]): any

Returns values from the column `result_column` in `dataset_path`, sorted by the `sort_column` in a specified `sort_direction`. The data in 'result\_column' can be filtered using subsequent arguments defined in `column`, `value` pairs.

Note:

* The `sort_column`, `result_column`, and `column`s must be column names in the dataset `dataset_path`. Additionally, the `sort_direction` can be either 'ASC' or 'DESC', for ascending and descending respectively.
* `Value` can be wrapped using `exact` or `fuzzy` functions to specify if matches should be exact or fuzzy.
* If you are unable to find a dataset which is newly indexed, either refresh the page or navigate to **Find and use data**, select **Indexed datasets**, and then select the refresh button.

**Arguments**

* `dataset_path`: *STRING*
* `result_column`: *STRING*
* `sort_column`: *STRING*
* `sort_direction`: *STRING*
* `column`: *STRING*
* `value`: *STRING*

***

#### lower(value: string): string

Converts a string specified in `value` to lower case.

For example: Suppose the string 'JANE DOE' is in B2. `lower(B2)` will return 'jane doe'.

**Arguments**

* `value`: *STRING*

***

#### lpad(value: string, length: number, pad: string): string

Left-pads the string attribute in `value` up to length `length` with the string specified in `pad`.

For example: Suppose you want to left-pad a string of phone numbers in column A with the string 'NY-'. Each padded phone number will have 13 characters. To implement, use `lpad(A1, 13, 'NY-')` and get NY-##########.

**Arguments**

* `value`: *STRING*
* `length`: *NUMBER*
* `pad`: *STRING*

***

#### lt(value: any): same\_as\_first\_argument

Mark the current `value` as a less-than (`<`) comparison.

Apply to an argument in a lookup function to change the search behavior.

**Arguments**

* `value`: *ANY*

***

#### lte(value: any): same\_as\_first\_argument

Mark the current `value` as a less-than or equal to (`<=`) comparison.

Apply to an argument in a lookup function to change the search behavior.

**Arguments**

* `value`: *ANY*

***

#### ltrim(value: string): string

Trims the spaces from the left end of the string in `value`.

For example: If the string 'John Smith' is in cell A2 and has 4 leading spaces, `ltrim(A2)` will remove the spaces.

**Arguments**

* `value`: *STRING*

***

#### match(item: any, range: range, criteria: number): same\_as\_first\_argument

Search for an item in `range` via specified `criteria`. The function returns the relative position of that item within the range (1-indexed).

Possible codes for `criteria` are as follows:

* `1` finds the largest value that is less than or equal to `item`. The values in the range defined by `range` must be placed in ascending order.
* `0` finds the first value that is exactly equal to `item`. The values in the range defined by `range` can be in any order.
* `-1` finds the smallest value that is greater than or equal to `item`. The values in the range defined by `range` must be placed in descending order.

For example: If the range `A1:A3` contains the values 5, 25, and 38, then the formula `match(25,A1:A3,0)` returns the number 2, because 25 is the second item in the range.

**Arguments**

* `item`: *ANY*
* `range`: *RANGE*
* `criteria`: *NUMBER*

***

#### max(\[value: any, ...]): any

Returns the maximum value in a group of numbers, dates or timestamps.

For example: `max(1,5,23)` will return 23. Or, `max(A1:A100)` will return the greatest value within this range. `max(date(2021, 2, 2), date(2021, 2, 1))` will return date(2021, 2, 2). `max(parse_timestamp('2021-02-02 00:00:01', 'yyyy-MM-dd HH:mm:ss'), parse_timestamp('2021-02-02 00:00:02', 'yyyy-MM-dd HH:mm:ss'))` will return this timestamp '[2021-02-02 00](tel:2021020200):00:02'.

**Arguments**

* `value`: *ANY*

***

#### md5(value: any): string

Calculates the MD5 digest of a string and returns the value as a 32 character hex string.

For example: Suppose you have the string 'John Smith' in cell A2. `md5(A2)` will return 6117323d2cabbc17d44c2b44587f682c.

**Arguments**

* `value`: *ANY*

***

#### mean(\[value: number, ...]): number

Returns the average of the numeric values in a group.

For example: `mean(5,8,12)` will result in 8.33.

**Arguments**

* `value`: *NUMBER*

***

#### median(\[value: number, ...]): number

Returns the median of the numeric values in a group.

For example: `median(10, 11, 19, 20, 21)` will return 19. Or, `median(A1:A100)` will return the median value within this range.

**Arguments**

* `value`: *NUMBER*

***

#### min(\[value: any, ...]): any

Returns the minimum value in a group of numbers, dates or timestamps.

For example: `min(5,8,12)` will return 5. Or, `min(A1:A100)` will return the smallest value within that range. `min(date(2021, 2, 2), date(2021, 2, 1))` will return date(2021, 2, 1) `min(parse_timestamp('2021-02-02 00:00:01', 'yyyy-MM-dd HH:mm:ss'), parse_timestamp('2021-02-02 00:00:02', 'yyyy-MM-dd HH:mm:ss'))` will return this timestamp '[2021-02-02 00](tel:2021020200):00:01’

**Arguments**

* `value`: *ANY*

***

#### minute(date: date\_time): number

Extracts the minute of `date` as an integer.

For example: Suppose you have the timestamp [2021-02-15 08](tel:2021021508):30:15 in cell A2. `minute(A2)` will return 30.

**Arguments**

* `date`: *DATE\_TIME*

***

#### month(date: date\_time): number

Extracts the month of `date` as an integer.

For example: Suppose you have the timestamp [2021-02-15 08](tel:2021021508):30:15 in cell A2. `month(A2)` will return 2.

**Arguments**

* `date`: *DATE\_TIME*

***

#### months\_between(start: date\_time, end: date\_time): number

Returns the number of months between dates `start` and `end`.

For example: `months_between('2020-02-15', '2022-01-15')` will return 23.

**Arguments**

* `start`: *DATE\_TIME*
* `end`: *DATE\_TIME*

***

#### multidropdown(values: array, \[selected\_value: array], \[allow\_invalid: boolean], \[placeholder\_text: string]): any

Renders a dropdown with values selectable from the supplied `values` array. Unlike the dropdown function, multidropdown allows the user to select more than one value at a time. These `values` must be unique, as each value will be converted to a string equivalent label.

When a `selected_value` is supplied, it specifies a default string label for the dropdown. `selected_value` is optional and can be set to null, which will default the dropdown's selection to an unselected state.

Note: If `selected_value` is set and the selected label is no longer found in the `values` array (such as if the underlying data changes), the result will be an empty cell.

Setting `allow_invalid` to true will override this behavior and still output the previously saved selection. This result can currently only be a string and this mode is only recommended when trying to preserve the previous selection from a set of string values.

`placeholder_text` allows a text to be shown in the dropdown when no value is selected (this can be useful as a prompt or instructions).

**Arguments**

* `values`: *ARRAY*
* `selected_value`: *ARRAY*
* `allow_invalid`: *BOOLEAN*
* `placeholder_text`: *STRING*

***

#### neq(value: any): same\_as\_first\_argument

Mark the current `value` as an inequality (`!=`) comparison.

Apply to an argument in a lookup function to change the search behavior.

**Arguments**

* `value`: *ANY*

***

#### net\_workdays(start\_date: date\_time, end\_date: date\_time, \[holidays: any]): number

Returns the number of whole working days between start\_date and end\_date. Working days exclude weekends. As of now, this function does not support holidays as an argument.

For example: net\_workdays('2021-01-01','2021-02-01') would return 23 since those were the number of work days during the month of January, ignoring holidays.

**Arguments**

* `start_date`: *DATE\_TIME*
* `end_date`: *DATE\_TIME*
* `holidays`: *ANY*

***

#### object(objectRid: string): object \[EXPERIMENTAL]

Loads the object with the given object RID.

**Arguments**

* `objectRid`: *STRING*

***

#### object\_dropdown(object\_set: array, \[selected\_object\_rid: string], \[placeholder\_text: string]): object \[EXPERIMENTAL]

Returns a dropdown with suggested values from an object set, `selected_object_rid` is the RID of the currently selected object from the object set.

**Arguments**

* `object_set`: *ARRAY*
* `selected_object_rid`: *STRING*
* `placeholder_text`: *STRING*

***

#### object\_set(objectSetRid: string, \[paramKey: string, paramValue: any, ...]): array \[EXPERIMENTAL]

Loads the object set with the given object set RID.

**Arguments**

* `objectSetRid`: *STRING*
* `paramKey`: *STRING*
* `paramValue`: *ANY*

***

#### parse\_date(date\_string: string, \[formats: string, ...]): date

Parse a string as a date. If multiple formats are specified, they will be tried in-order until one succeeds.

For example: `parse_date('25/01/2022', 'dd/MM/yyyy')` will return the date of the 25th of January 2022.

Details on patterns for formatting and parsing dates can be found in the [Java DateTimeFormatter documentation ↗](https://docs.oracle.com/javase/8/docs/api/java/time/format/DateTimeFormatter.html).

**Arguments**

* `date_string`: *STRING*
* `formats`: *STRING*

***

#### parse\_timestamp(timestamp\_string: string, \[formats: string, ...]): date\_time

Parse a string as a timestamp. If multiple formats are specified, they will be tried in-order until one succeeds.

For example: `parse_timestamp('25/01/2022 12:03', 'dd/MM/yyyy HH:mm')` will return the date of the 25th of January 2022, at 3 minutes past noon.

**Arguments**

* `timestamp_string`: *STRING*
* `formats`: *STRING*

***

#### percentile(array: array, pp: number): number

Returns the number for which `pp` values in the array lie below it.

* `array`: the array of positive/negative numbers not necessarily sorted.
* `pp`: the percentile, must be between 0 and 1 inclusive. `pp=0` will return the min value of the array, `pp=0.5` the median, and `pp=1` the max value.
* Examples:
  * `=percentile(array(7.25, 5.3, 8, 10), 0.25)` returns 6.7625, the value for which 25% of the array values lie below it.
  * `=percentile(array(12, 20, 10, 25, 28, 30, 34, 60), 0)` returns 10, the min value in the array.
  * `=percentile(A2:A9, A13)` can also be used with ranges and cell references.
  * `=percentile(array_flatten(A2:A9), A13)`

**Arguments**

* `array`: *ARRAY*
* `pp`: *NUMBER*

***

#### pow(value: number, power: number): number

Returns the result of `value` raised to the power of `power`.

For example: `pow(5, 2)` will return 25.

**Arguments**

* `value`: *NUMBER*
* `power`: *NUMBER*

***

#### product(\[value: any, ...]): number

Returns the product of all numeric values in the expression.

For example: `product(6*2)` will return 12.

**Arguments**

* `value`: *ANY*

***

#### quarter(date: date\_time): number

Extracts the yearly quarter of a date as an integer.

For example: Suppose the date 2021-08-15 is in cell A1. `Quarter(A1)` will return 3, as this date is in the third quarter of the year.

**Arguments**

* `date`: *DATE\_TIME*

***

#### query\_params(\[key: string, value: string, ...]): string

Encodes `key`, `value` pairs to be safe to use in URL query parameters.

For example: `=query_params('k1', 'this is long', 'k2', 'v+2')` will give you `k1=this%20is%20long&k2=v%2B2`

**Arguments**

* `key`: *STRING*
* `value`: *STRING*

***

#### rank(number: number, collection: array, sortOrder: number): number

Returns the rank of a specified number in a collection of numbers ordered by `sort order`. The ranking will be the number's value relative to the other values in the collection.

If `sort order` is equal to 0, the ranking of the number within the collection will be expressed in descending order.

If `sort order` is equal to a non-zero number, the rankings will be expressed in ascending order.

Note: All non-numeric values in a collection are ignored.

For example: Say you have the values 94, 79, and 83, 96 in cells A1, A2, A3, and A4 respectively. `Rank(94, A1:A4, 1)` will return 2, as 94 is the second highest ranked value in this collection of values. If we want to determine the rank of the rest of the numbers in this column, we should change the expression of the collection to A$1:A$4. This way, the range will not change.

**Arguments**

* `number`: *NUMBER*
* `collection`: *ARRAY*
* `sortOrder`: *NUMBER*

***

#### regexp\_replace(value: string, search: string, replace: string): string

Replaces all substrings in `value` that match `search` with `replace`.

For example: Suppose Column A is a list of animals and some cells contain the string 'The', such as 'The Dog'. If we want to replace every 'The' with the string 'One', simply implement `regexp_replace(A1, 'The', 'One')`. The new cell will read 'One Dog' instead of 'The Dog'. Simply drag down the corner of the cell to apply to the rest of Column A.

**Arguments**

* `value`: *STRING*
* `search`: *STRING*
* `replace`: *STRING*

***

#### reverse(value: string): string

Reverses `value` and returns it as a new string.

For example: `Reverse('John Smith')` will return htimS nhoJ.

**Arguments**

* `value`: *STRING*

***

#### right(text: string, \[num\_chars: number]): string

Returns the number of characters specified in `num_chars` from the end of string `text`.

For example: If the string 'John Smith' is in cell A2 , `left(A2, 3)` will return `Joh`.

**Arguments**

* `text`: *STRING*
* `num_chars`: *NUMBER*

***

#### round(value: number, decimalPlaces: number): number

Rounds the `value` to the number of decimal places specified by `decimalPlaces`.

For example: `Round(4.56, 1)` will return 4.6. `Round(4.56, 0)` will return 5.

**Arguments**

* `value`: *NUMBER*
* `decimalPlaces`: *NUMBER*

***

#### rpad(value: string, length: number, pad: string): string

Right-pads the string attribute in `value` up to a specified `length` with the string in `pad`.

For example: Suppose you want to right-pad a string of phone numbers in column A with the string '-NY'. Each new number will have 13 characters. To implement, use `rpad(A1, 13, '-NY')` to get ##########-NY.

**Arguments**

* `value`: *STRING*
* `length`: *NUMBER*
* `pad`: *STRING*

***

#### rtrim(value: string): string

Trims the spaces from the right end of a string specified by `value`.

For example: If the string 'John Smith' in cell A2 has 4 trailing spaces, `rtrim(A2)` will remove the spaces.

**Arguments**

* `value`: *STRING*

***

#### second(date: date\_time): number

Extracts the seconds in a `date` as an integer.

For example: Suppose you have the timestamp [2021-02-15 08](tel:2021021508):30:15 in cell A2. `second(A2)` will return 15.

**Arguments**

* `date`: *DATE\_TIME*

***

#### \[DEPRECATED] set\_get\_any(set: any): any

Retrieves a random element from a given set.

**Arguments**

* `set`: *ANY*

***

#### \[DEPRECATED] set\_to\_array(set: any): array

Converts a given set to an array, sorted in ascending order.

For example: Say we have a set of names in A1. `set_to_array(A1)` will convert these names into an array.

**Arguments**

* `set`: *ANY*

***

#### sha1(value: any): string

Calculates the SHA-1 digest of an attribute and returns the value as a 40 character hex string.

For example: sha1('The cow jumped over the moon.') will return 6e2780eb20fdaf78f6c8335d0b17526c7ef12a79.

**Arguments**

* `value`: *ANY*

***

#### sin(value: number): number

Computes the sine of `value`.

For example: `sin(140)` will return 0.98.

**Arguments**

* `value`: *NUMBER*

***

#### split(text: string, delimiter: string): array

Splits `text` with the specified `delimiter` and outputs the fragments in a row. Note: Empty fragments are ignored.

For example: Suppose you have the string 'Jane | 24 | F' in cell A1. To split this into an array of fragments you can use `split(A1, '|')` to get back '\[ Jane , 24 , F ]'.

**Arguments**

* `text`: *STRING*
* `delimiter`: *STRING*

***

#### split\_regex(text: string, delimiter: string): array

Splits `text` with the specified `delimiter` using regular expression syntax and outputs the fragments in a row. Note: Empty fragments are ignored.

For example: Suppose you have the string '123ABCDE456FGHIJKL789MNOPQ012' in cell A1. To split this into an array of the non-digit fragments (ie split on any digits) you can use `=split_regex(A1, '\d+')` to get back '\[ ABCDE, FGHIJKL, MNOPQ ]'.

**Arguments**

* `text`: *STRING*
* `delimiter`: *STRING*

***

#### sqrt(value: number): number

Computes the square root of `value`.

For example: `sqrt(16)` will return 4.

**Arguments**

* `value`: *NUMBER*

***

#### stddev(\[value: number, ...]): number

Returns the sample standard deviation of the expression in a group.

For example: Suppose you have the values 23, 45, 32 in cells A1, A2, and A3 respectively. `stddev(A1:A3)` will return 11.06.

**Arguments**

* `value`: *NUMBER*

***

#### stddev\_p(\[value: any, ...]): number

Returns the biased standard deviation of the expression in a group assuming that its arguments are the entire population. If they only represent a sample of the population, use `STDDEV` instead.

**Arguments**

* `value`: *ANY*

***

#### submit\_to\_region\_with\_key(button\_label: string, document\_identifier: string, region\_name: string, should\_submit: any, key\_column: string, key\_value: any, \[column: string, value: any, ...]): string

Creates a button that, when clicked, submits data into a region with a specified key.

For example: `=submit_to_region_with_key('Submit!', 'ri.fusion.main.document...', 'submit_table', TRUE, 'key_column', A2:A10, 'value_column', B2:B10)` will submit A2:A10 and B2:10 to columns 'key\_column' and 'value\_column' respectively of the table 'submit\_table', within the specified sheet.

Note: You can include any number of `key column`, `value` pairs into your parameters as you would like to appear in the receiving spreadsheet. However, you must list every parameter that you would like to appear in the exact order that they will be submitted.

**Arguments**

* `button_label`: *STRING* <br>Specifies the string you want to appear on the button.
* `document_identifier`: *STRING* <br>Insert the RID of the dataset that your submissions will be written to. The RID can be identified in the document's URL and looks like ri.fusion.main...
* `region_name`: *STRING* <br>Specifies the name of the table region that you are writing into. If you have not already specified this table region, go to the receiving spreadsheet, use the 'create table region' widget, and give your table an intuitive name.
* `should_submit`: *ANY* <br>Corresponds to a particular column in your submission sheet that contains a Boolean (i.e. true/false). If `should_submit` is true, then the data will be submitted.
* `key_column`: *STRING* <br>Specifies the column header that you would like to submit values into. Each value in the `key_column` must be unique.
* `key_value`: *ANY* <br>Signifies a specific cell or range of cells to be submitted into the specified `key_column`.
* `column`: *STRING*
* `value`: *ANY*

***

#### submit\_to\_region\_with\_key\_and\_timestamp(button\_label: string, document\_identifier: string, region\_name: string, should\_submit: any, timestamp\_column: string, key\_column: string, key\_value: any, \[column: string, value: any, ...]): string

Creates a button that, when clicked, submits data into a region with a specified key.

For example: `=submit_to_region_with_key_and_timestamp('Submit!', 'ri.fusion.main.document...', 'submit_table', TRUE, 'time', 'key_column', A2:A10, 'value_column', B2:B10)` will submit A2:A10 and B2:10 to columns 'key\_column' and 'value\_column' respectively of the table 'submit\_table', within the specified sheet. The current timestamp will be submitted to the 'time' column.

Note: You can include any number of `key column`, `value` pairs into your parameters as you would like to appear in the receiving spreadsheet. However, you must list every parameter that you would like to appear in the exact order that they will be submitted.

**Arguments**

* `button_label`: *STRING* <br>Specifies the string you want to appear on the button.
* `document_identifier`: *STRING* <br>Insert the RID of the dataset that your submissions will be written to. The RID can be identified in the document's URL and looks like ri.fusion.main...
* `region_name`: *STRING* <br>Specifies the name of the table region that you are writing into. If you have not already specified this table region, go to the receiving spreadsheet, use the 'create table region' widget, and give your table an intuitive name.
* `should_submit`: *ANY* <br>Corresponds to a particular column in your submission sheet that contains a Boolean (i.e. true/false). If `should_submit` is true, then the data will be submitted.
* `timestamp_column`: *STRING* <br>Specifies the column header that you would like to submit the current timestamp to.
* `key_column`: *STRING* <br>Specifies the column header that you would like to submit values into. Each value in the `key_column` must be unique.
* `key_value`: *ANY* <br>Signifies a specific cell or range of cells to be submitted into the specified `key_column`.
* `column`: *STRING*
* `value`: *ANY*

***

#### submit\_to\_region\_with\_key\_and\_timestamp\_lazy(button\_label: string, document\_identifier: string, region\_name: string, should\_submit: any, timestamp\_column: string, key\_column: string, key\_value: any, \[column: string, value: any, ...]): string

Behaves exactly like `submit_to_region_with_key`, except that it computes value to submit on-click, and caches target region information. Use this if you are submitting large ranges, or anticipate multiple submits to the same region in quick succession.

Creates a button that, when clicked, submits data into a region with a specified key.

For example: `=submit_to_region_with_key_and_timestamp_lazy('Submit!', 'ri.fusion.main.document...', 'submit_table', TRUE, 'time', 'key_column', A2:A10, 'value_column', B2:B10)` will submit A2:A10 and B2:10 to columns 'key\_column' and 'value\_column' respectively of the table 'submit\_table', within the specified sheet. The current timestamp will be submitted to the 'time' column.

Note: You can include any number of `key column`, `value` pairs into your parameters as you would like to appear in the receiving spreadsheet. However, you must list every parameter that you would like to appear in the exact order that they will be submitted.

**Arguments**

* `button_label`: *STRING* <br>Specifies the string you want to appear on the button.
* `document_identifier`: *STRING* <br>Insert the RID of the dataset that your submissions will be written to. The RID can be identified in the document's URL and looks like ri.fusion.main...
* `region_name`: *STRING* <br>Specifies the name of the table region that you are writing into. If you have not already specified this table region, go to the receiving spreadsheet, use the 'create table region' widget, and give your table an intuitive name.
* `should_submit`: *ANY* <br>Corresponds to a particular column in your submission sheet that contains a Boolean (i.e. true/false). If `should_submit` is true, then the data will be submitted.
* `timestamp_column`: *STRING* <br>Specifies the column header that you would like to submit the current timestamp to.
* `key_column`: *STRING* <br>Specifies the column header that you would like to submit values into. Each value in the `key_column` must be unique.
* `key_value`: *ANY* <br>Signifies a specific cell or range of cells to be submitted into the specified `key_column`.
* `column`: *STRING*
* `value`: *ANY*

***

#### submit\_to\_region\_with\_key\_lazy(button\_label: string, document\_identifier: string, region\_name: string, should\_submit: any, key\_column: string, key\_value: any, \[column: string, value: any, ...]): string

Behaves exactly like `submit_to_region_with_key`, except that it computes value to submit on-click, and caches target region information. Use this if you are submitting large ranges, or anticipate multiple submits to the same region in quick succession.

Creates a button that, when clicked, submits data into a region with a specified key.

For example: `=submit_to_region_with_key_lazy('Submit!', 'ri.fusion.main.document...', 'submit_table', TRUE, 'time', 'key_column', A2:A10, 'value_column', B2:B10)` will submit A2:A10 and B2:10 to columns 'key\_column' and 'value\_column' respectively of the table 'submit\_table', within the specified sheet.

Note: You can include any number of `key column`, `value` pairs into your parameters as you would like to appear in the receiving spreadsheet. However, you must list every parameter that you would like to appear in the exact order that they will be submitted.

**Arguments**

* `button_label`: *STRING* <br>Specifies the string you want to appear on the button.
* `document_identifier`: *STRING* <br>Insert the RID of the dataset that your submissions will be written to. The RID can be identified in the document's URL and looks like ri.fusion.main...
* `region_name`: *STRING* <br>Specifies the name of the table region that you are writing into. If you have not already specified this table region, go to the receiving spreadsheet, use the 'create table region' widget, and give your table an intuitive name.
* `should_submit`: *ANY* <br>Corresponds to a particular column in your submission sheet that contains a Boolean (i.e. true/false). If `should_submit` is true, then the data will be submitted.
* `key_column`: *STRING* <br>Specifies the column header that you would like to submit values into. Each value in the `key_column` must be unique.
* `key_value`: *ANY* <br>Signifies a specific cell or range of cells to be submitted into the specified `key_column`.
* `column`: *STRING*
* `value`: *ANY*

***

#### substring(value: number, index: number, length: number): string

Extracts a substring of `value` starting at the `index` (1-indexed) until length `length`.

For example: Suppose you have the phrase 'cow jumped over the moon' in cell A1 and you want to extract the substring 'cow'. The substring begins at index 1 and the length is 3. Use `substring(A1, 1, 3)` to extract just the string 'cow'.

**Arguments**

* `value`: *NUMBER*
* `index`: *NUMBER*
* `length`: *NUMBER*

***

#### subtotal(function\_code: number, \[range: range, ...]): number

Computes the aggregate specified by the `function_code`(outlined below) over the ranges specified in subsequent arguments. If there are other subtotals within `range` s (or nested subtotals), these nested subtotals are ignored to avoid double counting.

Possible codes for `function_code` are as follows:

* 1 or 101: AVG
* 2 or 102: COUNT\_NUMERIC
* 3 or 103: COUNT
* 4 or 104: MAX
* 5 or 105: MIN
* 6 or 106: PRODUCT
* 7 or 107: STDDEV
* 8 or 108: STDDEV\_P
* 9 or 109: SUM
* 10 or 110: VARIANCE
* 11 or 111: VARIANCE\_P

**Arguments**

* `function_code`: *NUMBER*
* `range`: *RANGE*

***

#### sum(\[value: number, ...]): number

Returns the sum of the expression in a group.

For example: `sum(23,45,32)` will return 100.

**Arguments**

* `value`: *NUMBER*

***

#### sum\_distinct(\[value: number, ...]): number

Returns the sum of distinct numeric values in the expression (ie will ignore all duplicate values).

For example: `sum_distinct(23,45,32,45)` will return 100. The function will ignore the second 45 because it does not calculate the duplicate numbers.

**Arguments**

* `value`: *NUMBER*

***

#### sum\_product(\[value: any, ...]): number

Multiplies corresponding components in the given `value` and returns the sum of these products. Each `value` must have the same dimensions and all non-numeric arguments are treated as zero.

For example: `sum_product(A1:A3, B1:B3)` will result in the sum of A1*B1 + A2*B2 + A3\*B3.

**Arguments**

* `value`: *ANY*

***

#### sumif(criteria\_range: range, condition: any, sum\_range: range): number

Returns the sum of all values in `sum_range`, for which `criteria_range` is equal to `condition`.

Note: The range sizes for `criteria_range` and `sum_range` must match.

For example: Suppose rows A1:A50 contain a list of first names and C1:C50 contain corresponding ages. If you want to sum the ages of every person with the first name 'John' in A1:A50, use `sumif(A1:A50, 'John', C1:C50)` to get your total sum.

**Arguments**

* `criteria_range`: *RANGE*
* `condition`: *ANY*
* `sum_range`: *RANGE*

***

#### sumifs(sum\_range: range, \[criteria\_range: range, condition: any, ...]): number

Returns the sum of all values in `sum_range` that match the criteria given by the subsequent arguments.

For example: `sumifs(A1:B5, C1:D5, 10, H4:I8, 'John')` returns the sum of all cells in A1:B5, for which the corresponding cell in C1:D5 is equal to 10,and the corresponding cell in H4:I8 is equal to 'John'.

Note: The range sizes for `criteria_range` and `sum_range` must match.

**Arguments**

* `sum_range`: *RANGE*
* `criteria_range`: *RANGE*
* `condition`: *ANY*

***

#### tan(value: number): number

Computes the tangent of `value`.

For example: `tan(45)` will return 1.6197.

**Arguments**

* `value`: *NUMBER*

***

#### timestamp(year: number, month: number, day: number, hour: number, minute: number, second: number): date\_time

Creates a timestamp with a defined `year`, `month`, `day`, `hour`, `minute`, `second` in the format yyyy-MM-dd HH\:mm:ss.
For timestamps where the year is < 1900 (e.g. '97'), the year will be interpreted as an offset from 1900 (e.g. '1997').

**Arguments**

* `year`: *NUMBER*
* `month`: *NUMBER*
* `day`: *NUMBER*
* `hour`: *NUMBER*
* `minute`: *NUMBER*
* `second`: *NUMBER*

***

#### to\_unix\_timestamp(date: string, \[pattern: string]): number

Converts a timestamp `date` with an optional `pattern` (i.e. date format) to its unix epoch which is the number of milliseconds since January 1, 1970, 00:00:00 GMT. Date can be a date, a timestamp, or a string. If providing a string, you can include a pattern for parsing.

For example: Suppose you have the string 2021-02-15. The `pattern` of the date is yyyy-MM-dd. To convert this timestamp, use `to_unix_timestamp('2021-02-15', 'yyyy-MM-dd')`.

**Arguments**

* `date`: *STRING*
* `pattern`: *STRING*

***

#### tooltip(cell\_value: any, tooltip\_content: string, \[open\_delay: number]): any

Renders a cell with a tooltip appearing on hover.

The `tooltip_content` argument can be formatted as a markdown string. The `open_delay` argument can be used to change the delay after which the tooltip appears on hover.

**Arguments**

* `cell_value`: *ANY*
* `tooltip_content`: *STRING*
* `open_delay`: *NUMBER*

***

#### trim(value: string): string

Trims the spaces on both ends of `value`.

For example: Suppose you have the string 'John Smith' in cell A1 and it has 4 spaces on both ends. `trim(A1)` will create a new string without the spaces.

**Arguments**

* `value`: *STRING*

***

#### upper(value: string): string

Converts an entire string to upper case.

For example: Suppose you have the name John Smith in cell A1. `Upper(A1)` will return JOHN SMITH.

**Arguments**

* `value`: *STRING*

***

#### url(url: string, \[label: string]): any

Renders a hyperlink to a `url` with an optional `label`.

For example: `url('myblog.com', 'My Blog')` will create a hyperlink with the label 'My Blog'.

**Arguments**

* `url`: *STRING*
* `label`: *STRING*

***

#### url\_encode(input: any): string

Encodes `input` to be safe to use in URL paths and parameters.

For example: `=url(concat('http://example.com/test?param=', url_encode(A5)))`

**Arguments**

* `input`: *ANY*

***

#### variance(\[value: number, ...]): number

Returns the unbiased variance of the values in a group.

For example: `variance(23, 45, 32)` will return 122.33.

**Arguments**

* `value`: *NUMBER*

***

#### variance\_p(\[value: any, ...]): number

Returns the biased variance of the values in a group assuming that `value` items form the entire population.

Note: If they only represent a sample of the population, use `VARIANCE` instead.

**Arguments**

* `value`: *ANY*

***

#### vlookup(value: any, range: range, column: number): any

Lookup `value` in the first column of `range` and grab `column` (starting at 1).

For example: Say Column A is a list of fruit names and Column C is a list of prices. `vlookup(A3,A1:C6,3)` will grab the fruit name in cell A3 and return the corresponding price in Column 3 of the specified range.

**Arguments**

* `value`: *ANY*
* `range`: *RANGE*
* `column`: *NUMBER*

***

#### week\_of\_year(date: date\_time): number

Calculates the week number of a `date` as an integer.

For example: `Week_of_year('2021-06-18')` will return 24.

**Arguments**

* `date`: *DATE\_TIME*

***

#### workday(start\_date: date\_time, value: number, \[holidays: any]): date

Returns a number that represents a date that is the indicated number of working days before or after a date (the starting date). Working days exclude weekends and holidays.

For example: workday('2010-01-01',10) would return 2010-01-15 because the weekends were ignored. Another example: workday('2010-01-01',10, '2010-01-05') returns 2010-01-18 because the weekends plus a holiday were ignored.

**Arguments**

* `start_date`: *DATE\_TIME*
* `value`: *NUMBER*
* `holidays`: *ANY*

***

#### year(date: date\_time): number

Extracts the year of `date` as an integer.

For example: Suppose you have the timestamp [2022-02-15 08](tel:2022021508):30:15 in cell A2. `Year(A2)` will return 2022.

**Arguments**

* `date`: *DATE\_TIME*

***

## Action functions

Fusion's default Action library methods.

***

#### compute\_on\_trigger(actionCell: any): any \[EXPERIMENTAL]

Lazily compute the Action in the given actionCell reference passed in as argument when triggered.

This will not count as a dependency on that cell, allowing you to avoid circular dependencies in some cases.

**Arguments**

* `actionCell`: *ANY*

***

#### copy\_range(source: any, target: range, \[copy\_result: boolean]): string

Action that, when triggered, copies the contents from one range to another.

**Arguments**

* `source`: *ANY* <br>Cell range to copy from. Can be `NULL` if you want to empty out the target
* `target`: *RANGE*
* `copy_result`: *BOOLEAN* <br>If `true`, copies the computed cell value. If `false` or absent, copies the cell formula.

***

#### dropdown(values: array, \[selected\_value: string], \[actionBeforeChange: any], \[allow\_invalid: boolean], \[placeholder\_text: string]): any \[EXPERIMENTAL]

Renders a dropdown with values that can be selected from the supplied `values` array. The `values` must be unique, as each value is converted to a string label in the dropdown.

This function cannot be nested in an action.serial or action.parallel

For example: `=action.dropdown(array('red', 'blue', 'green'))` will create a dropdown with values 'red', 'blue', 'green'.

When an `actionBeforeChange` is supplied, it specifies an Action that will be executed before the newly selected value of the dropdown is saved and taken into account by other formulas.

When a `selected_value` is supplied, it specifies a default string label for the dropdown. `selected_value` is optional and can be set to null, which will default the dropdown's selection to an unselected state. If `selected_value` is set and the selected label is no longer found in the `values` array (such as if the underlying data changes), the result will be an empty cell.

When `allow_invalid` is set to true, it will override this behavior and still output the previously saved selection. This result can only be a string and this is only recommended when trying to preserve the prior selection from a set of string values.

`placeholder_text` allows you to show a text in the dropdown when no value is selected (it can be useful as a prompt or instructions)

**Arguments**

* `values`: *ARRAY*
* `selected_value`: *STRING*
* `actionBeforeChange`: *ANY*
* `allow_invalid`: *BOOLEAN*
* `placeholder_text`: *STRING*

***

#### fail(): any

A no-operation failed Action. Can be combined in a serial for short-circuiting.

***

#### label(type: string, label: string, \[icon: string], \[intent: string]): string

Renders a label. Type can be one of: 'button', 'link', or 'tag'.

For example: `action.label('button', 'Submit', 'tick', 'success')` would render a green button with a tick and the word 'Submit'.

**Arguments**

* `type`: *STRING*
* `label`: *STRING*
* `icon`: *STRING* <br>Review a list of icons can in the [Blueprint documentation ↗](https://blueprintjs.com/docs/#icons).
* `intent`: *STRING* <br>`intent` defines the color of the label: 'primary' for blue, 'success' for green, 'warning' for orange and 'danger' for red. Review a full list of intents and their output in the [Blueprint documentation ↗](https://blueprintjs.com/docs/versions/1/#core/components/button.CSS-api).

***

#### open\_markdown\_panel(panel\_title: string, markdown\_content: string): string

Opens a contextual side panel with the provided title and markdown string.

If using CSS styles for the markdown, you can scope it with the `.fusion-markdown-panel` class.

**Arguments**

* `panel_title`: *STRING*
* `markdown_content`: *STRING*

***

#### open\_url(url: string, \[redirect: boolean]): string

Opens a URL, defaults to opening in a new tab, set the `redirect` parameter to true if you want to redirect the existing spreadsheet page.

**Arguments**

* `url`: *STRING*
* `redirect`: *BOOLEAN*

***

#### parallel(\[action: any, ...]): string

Given a list of Actions, trigger them all at once.

* `action`: *ANY*

***

#### plugin(action\_name: string, \[arg: any, ...]): any

Run a custom Action deployed to this server. Contact your Palantir representative to get a list of available Actions.

**Arguments**

* `action_name`: *STRING*
* `arg`: *ANY*

***

#### serial(action: any, actionOnSuccess: any, \[actionOnFailure: any]): string

Define Actions that should occur only on the success (or failure) of the previous Action.

**Arguments**

* `action`: *ANY*
* `actionOnSuccess`: *ANY*
* `actionOnFailure`: *ANY*

***

#### submit\_options(\[key: string, value: any, ...]): options \[EXPERIMENTAL]

Configurable key-value options for `action.submit_to_region_with_options(...)`.

Available options:

* submitEmptyCells: empty or null cells will overwrite data present for this column in the destination table
* succeedWhenNoRows: changes the behavior of the Action to succeed when the shouldSubmit is false or false for all rows, instead of failing and showing a toast

**Arguments**

* `key`: *STRING*
* `value`: *ANY*

***

#### submit\_to\_region(document\_identifier: string, region\_name: string, should\_submit: any, timestamp\_column: string, key\_column: string, key\_value: any, \[column: string, value: any, ...]): string

Creates a button that submits data into a region, with a specified key.

For example: `=action.submit_to_region('ri.fusion.main.document...', 'submit_table', TRUE, 'time', 'first_column', A1:A10, 'second_column', B1:B10)` will submit A1:A10 and B1:10 to columns 'first\_column' and 'second\_column' respectively of the table 'submit\_table', within the specified sheet. The current timestamp will be submitted to the 'time' column.

**Arguments**

* `document_identifier`: *STRING* <br>Insert the RID of the dataset that your submissions will be written to. The RID can be identified in the document's URL and looks like `ri.fusion.main...`. `document_metadata('document_identifier')` can be used to reference the RID of the current sheet.

* `region_name`: *STRING* <br>Specifies the name of the table region that you are writing into. If you have not already specified this table region, go to the receiving spreadsheet, use the 'create table region' widget, and give your table an intuitive name.

* `should_submit`: *ANY* <br>Corresponds to a particular column in your submission sheet that contains a Boolean (ie true/false). If `should_submit` is true, then the data will be submitted.

* `timestamp_column`: *STRING* <br>Specifies the column header that you would like to submit the current timestamp to. Use `null` if no timestamp is needed.

* `key_column`: *STRING*
  Specifies the column header that you would like to submit values into.

* `key_value`: *ANY* <br>Signifies a specific cell or range of cells to be submitted into the specified `key_column`.

* `column`: *STRING*

* `value`: *ANY*

***

#### submit\_to\_region\_with\_options(document\_identifier: string, region\_name: string, submit\_options: options, should\_submit: any, timestamp\_column: string, key\_column: string, key\_value: any, \[column: string, value: any, ...]): string \[EXPERIMENTAL]

Creates a button that submits data into a region, with a specified key.

For example: `=action.submit_to_region_with_options('ri.fusion.main.document...', 'submit_table', TRUE, 'time', 'first_column', A1:A10, 'second_column', B1:B10)` will submit A1:A10 and B1:10 to columns 'first\_column' and 'second\_column' respectively of the table 'submit\_table', within the specified sheet. The current timestamp will be submitted to the 'time' column.

**Arguments**

* `document_identifier`: *STRING* <br>Insert the RID of the dataset that your submissions will be written to. The RID can be identified in the document's URL and looks like `ri.fusion.main...`. `document_metadata('document_identifier')` can be used to reference the RID of the current sheet.
* `region_name`: *STRING* <br>Specifies the name of the table region that you are writing into. If you have not already specified this table region, go to the receiving spreadsheet, use the 'create table region' widget, and give your table an intuitive name.
* `submit_options`: *OPTIONS* <br>Specifies configurable options to use for the submit Action with `action.submit_options(...)`, possible values in the `submit_options` function documentation
* `should_submit`: *ANY* <br>Corresponds to a particular column in your submission sheet that contains a Boolean (i.e. true/false). If `should_submit` is true, then the data will be submitted.
* `timestamp_column`: *STRING* <br>Specifies the column header that you would like to submit the current timestamp to. Use `null` if no timestamp is needed.
* `key_column`: *STRING* <br>Specifies the column header that you would like to submit values into.
* `key_value`: *ANY* <br>Signifies a specific cell or range of cells to be submitted into the specified `key_column`.
* `column`: *STRING*
* `value`: *ANY*

***

#### success(): any

A no-operation successful Action. Can be combined in a serial for short-circuiting.

***

#### toast(message: string, \[intent: string], \[dismissButton: string]): string

Triggers a toast. *ding!*.

If `dismissButton` is defined, the toast will linger till the user clicks on the dismiss button. If the toast is wrapped with an `action_serial` function, the subsequent Action will then be triggered.

**Arguments**

* `message`: *STRING*
* `intent`: *STRING*
* `dismissButton`: *STRING*

***

#### trigger(label: any, action: any): string

Given a label and an Action, triggers Action when label is clicked.

Configure the label with an `action_label` function.

**Arguments**

* `label`: *ANY*
* `action`: *ANY*

***

#### validate\_table(table\_range: range, \[condition: any, ...]): string

Given a range and a list of conditions, validates that all conditions are met.

**Arguments**

* `table_range`: *RANGE*
* `condition`: *ANY*

***

## Validation functions

Fusion's default validation library methods.

***

#### column\_enum(column\_name: string, allowed\_values: array): string

Given a column name and a list of allowed values, validates that all non-null values in that column are in the allowed list.

**Arguments**

* `column_name`: *STRING*
* `allowed_values`: *ARRAY*

***

#### column\_not\_null(\[column\_name: string, ...]): string

Given a list of column names, validates that they are not empty for non-empty rows. ie. These columns can only be empty if the entire row is empty.

**Arguments**

* `column_name`: *STRING*

***

#### column\_numeric(\[column\_name: string, ...]): string

Given a list of column names, validates that each column only contains numeric values.

**Arguments**

* `column_name`: *STRING*

***

#### column\_regex(column\_name: string, regex: string): string

Given a column name and a regex string, validates that all values in that column match the given regex.

`column_name` is the name of the column to validate, as it appears in the header row of the table. If every value in that column matches `regex`, the validation succeeds. Otherwise, the validation fails and returns an error message identifying the values that did not match.

For example: `column_regex('zip_code', '^[0-9]{5}$')` validates that every value in the `zip_code` column consists of exactly five digits, such as `94105`.

**Arguments**

* `column_name`: *STRING*
* `regex`: *STRING*

***

#### table\_headers(\[column\_name: string, ...]): string

Given a list of column names, validates that they exist in the table defined.

**Arguments**

* `column_name`: *STRING*

***

#### table\_key(\[column\_name: string, ...]): string

Given a list of column names, validates that the combination of them is unique within the table. E.g. Given a range where the first row contains these two column names: Name and Age: If you have two records: \[Bob, 20] and \[Bobby, 20] then table\_key('Name', 'Age') should succeed. However if the two records are: \[Bob, 20] and \[Bob, 20] then table\_key('Name', 'Age') should fail.

**Arguments**

* `column_name`: *STRING*

***

## Chart functions

Methods for plotting data. Prefix these functions with the `chart.` namespace. The `x_values` and `y_values` arguments must each be a one-dimensional cell range or array that contains numbers, dates, timestamps, or strings.

***

#### bar(x\_values: any, y\_values: any, \[options: any, ...]): barplot

Plot a series of xy values on a bar chart

For example, `=chart.bar(A1:A4, B1:B4)` renders a bar chart in the cell, plotting the values in `B1:B4` against the values in `A1:A4`.

Available options:

* drawLabels: boolean
* orientation: "horizontal" | "vertical"

**Arguments**

* `x_values`: *ANY*
* `y_values`: *ANY*
* `options`: *ANY*

***

#### chart(\[Plots-or-options: any, ...]): chart

Plot multiple series on a chart with configurable options

Available options:

* showAxes: boolean
* showLegend: boolean
* showResetZoomButton: boolean
* showToolbar: boolean
* tooltip: false | "closest" | "aggregate"
* yAxisInset: boolean
* rangeSelection: "select" | "visual" | false
* height: number (px)
* width: number (px)
* `Plots-or-options`: *ANY*

***

#### line(x\_values: any, y\_values: any, \[options: any, ...]): lineplot

Plot a series of xy values on a line chart

For example, `=chart.line(A1:A4, B1:B4)` renders a line chart in the cell, plotting the values in `B1:B4` against the values in `A1:A4`. To chart values over time, use a range of dates or timestamps for `x_values`.

Available options:

* dataMarkers: boolean
* color: string

**Arguments**

* `x_values`: *ANY*
* `y_values`: *ANY*
* `options`: *ANY*

***

#### options(\[key: string, value: any, ...]): options

Configurable key-value options charts.

**Arguments**

* `key`: *STRING*
* `value`: *ANY*

***

## Time series functions

Methods for interacting with time series. Prefix these functions with the `ts.` namespace, such as `ts.timeseries()`.

***

#### count(timeSeries: any): number

Returns the number of points in the series.

**Arguments**

* `timeSeries`: *ANY*

***

#### derivative(timeSeries: any): any

Take the derivative of a time series (with respect to seconds).

**Arguments**

* `timeSeries`: *ANY*

***

#### difference(timeSeries: any): number

Returns the difference between the first value in the series and the last value in the series.

**Arguments**

* `timeSeries`: *ANY*

***

#### first\_timestamp(timeSeries: any): time

Returns the timestamp of the first point in the time series.

**Arguments**

* `timeSeries`: *ANY*

***

#### first\_value(timeSeries: any): any

Returns the value of the first point in the time series.

**Arguments**

* `timeSeries`: *ANY*

***

#### integral(timeSeries: any, method: string): any

For each point in the child series, output the total area under the series up until that point.

Three different methods of integration are supported: `linear`, which uses the trapezoidal rule for integral approximation, and `lhs`/`lhr` which use the left and right Riemann sums respectively.

**Arguments**

* `timeSeries`: *ANY*
* `method`: *STRING*

***

#### last(timeSeries: any, timeAmount: number, timeUnit: string): any

Filters the time series to leave the last part of the specified duration.

Supported units:

* hours/h
* minutes/m
* seconds/s
* microseconds/us
* nanoseconds/ns

**Arguments**

* `timeSeries`: *ANY*
* `timeAmount`: *NUMBER*
* `timeUnit`: *STRING*

***

#### last\_timestamp(timeSeries: any): time

Returns the timestamp of the last point in the time series.

**Arguments**

* `timeSeries`: *ANY*

***

#### last\_value(timeSeries: any): any

Returns the value of the last point in the time series.

**Arguments**

* `timeSeries`: *ANY*

***

#### max(timeSeries: any): number

Returns the maximum value over the entire time series.

**Arguments**

* `timeSeries`: *ANY*

***

#### mean(timeSeries: any): number

Returns the mean value over the entire time series.

**Arguments**

* `timeSeries`: *ANY*

***

#### min(timeSeries: any): number

Returns the minimum value over the entire time series.

**Arguments**

* `timeSeries`: *ANY*

***

#### scale(timeSeries: any, scale: number): any

Take each tick and multiply the value by the specified factor.

That is, for a source time series containing ticks `(t, v)` upon scaling by `x`, the resulting scaled time series will have ticks `(t, v * x)`.

**Arguments**

* `timeSeries`: *ANY*
* `scale`: *NUMBER*

***

#### shift(timeSeries: any, shift: number): any

Take each point of the time series and shift the value by the specified amount.

That is, for a source time series containing ticks `(t, v)` upon shifting by `x`, the resulting value-shifted time series will have ticks `(t, v + x)`.

**Arguments**

* `timeSeries`: *ANY*
* `shift`: *NUMBER*

***

#### stddev(timeSeries: any): number

Returns the standard deviation of the entire time series.

**Arguments**

* `timeSeries`: *ANY*

***

#### time\_range(timeSeries: any, startTime: any, endTime: any): any

Selects a particular time range of the time series.

**Arguments**

* `timeSeries`: *ANY*
* `startTime`: *ANY*
* `endTime`: *ANY*

***

#### timeseries(seriesId: string): any

Returns the time series of the given ID.

**Arguments**

* `seriesId`: *STRING*
