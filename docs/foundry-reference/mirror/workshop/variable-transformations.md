<!-- source: https://palantir.com/docs/foundry/workshop/variable-transformations/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Variable transformations

Variable transformations allow builders in Workshop to apply common operations to variables, as well as chain operations together by referencing previous operations.

## Transformation types

### General operations

* **String concatenation:** Returns a string concatenation of given static text and/or variable values. If an array variable is inputted, the operation will concatenate and cast elements within the array into string. Builders may optionally specify a separate input to be added between elements.
* **If/else statement:** Runs a conditional statement to return a predefined output value or variable.
* **Cast operation:** Cast variables between different primitives. The following type castings are supported:
  * String → Numeric: Pass in a string type containing only numeric characters to cast to a numeric type.
  * String → Date: Pass in a string type containing a validly formatted date value and select the corresponding date format used in the `Parser` field. For example, if passing in a string variable with the value `06/26/24`, select `M/dd/yyyy` as the corresponding parser format to cast to a date type.
  * String → Timestamp: Pass in a string type containing a validly formatted timestamp value and select the corresponding timestamp format used in the `Parser` field. The timezone used when casting the outputted timestamp value may be defined either using the user’s local timezone, set statically via options in a dropdown, or set dynamically using a string reference or variable. For example, if passing in a string variable with value `2024 06 26 12:50 AM`, select `yyyy M dd hh:mm aa` as the corresponding parser format to cast to a timestamp type.
  * String → GeoPoint: Pass in a string type formatted as a `[latitude], [longitude]` pair to cast to a geopoint type. For example: `40.782142,-73.96596`.
  * String → GeoShape: Pass in a string type formatted in JSON with a shape type and an array of coordinates to cast to a geoshape type. For example: `{"type":"Polygon","coordinates":[[[-73.9580917968885,40.80044406792189],[-73.98186087075722,40.76811683550534],[-73.97304465743831,40.76434392565562],[-73.94930767833077,40.79687062648023],[-73.9580917968885,40.80044406792189]]]}`.
  * Timestamp → Date: Pass in a timestamp type to cast to a date type. The timezone used when casting the outputted date value may be defined either using the user’s local timezone, set statically via options in a dropdown, or set dynamically using a string reference or variable.  The inputted timestamp will be converted to a date using the absolute timestamp at the specified timezone.
  * Date → Timestamp: Pass in a date type to cast to a timestamp type. The timezone used when casting the outputted date value may be defined either using the user’s local timezone, set statically via options in a dropdown, or set dynamically using a string reference or variable. The inputted date will be converted to a timestamp representing start of day at the specified timezone.
  * Any -> String: Casting of any primitive type to a string may be done using the `String concatenation` operation.

### Object set transforms

* **Is empty:** Runs a boolean check for the absence of objects in a given object set.
* **Is not empty:** Runs a boolean check for the presence of objects in a given object set.
* **Object property:** Returns a property value given a single object and specified property of that object type.
* **Object set aggregation:** Runs an aggregation over a specified property of a given object set. Supported aggregations include min, max, sum, average, and cardinality.
* **Object RID:** Returns the object RID for a given object.

### Math operations

* **Add:** Returns the sum of given numeric values or variables.
* **Subtract:** Returns the difference between given numeric values or variables.
* **Multiply:** Returns the product of given numeric values or variables.
* **Divide:** Returns the quotient of given numeric values or variables.
* **Absolute:** Returns the absolute value of a given numeric value or variable.
* **Negate:** Returns the negated value of a given numeric value or variable.
* **Round Up (Ceil):** Returns the rounded up value to a specified precision of a given numeric value or variable.
* **Round Down (Floor):** Returns the rounded down value to a specified precision of a given numeric value or variable.
* **Round Nearest:** Returns the rounded value to a specified precision of a given numeric value or variable.
* **Max:** Returns the maximum value from a collection of numeric, date, or timestamp values or variables.
* **Min:** Returns the minimum value from a collection of numeric, date, or timestamp values or variables.

### Date/time math

* **Relative date:** Returns a calculated date given a numeric value or variable, specifying the number of days, weeks, months or years to add or subtract, and a date value or variable.
* **Relative time:** Returns a calculated time given a numeric value, specifying the number of seconds, minutes, hours, days, weeks, months or years to add or subtract, and a time value or variable.
* **Between dates:** Returns the numeric difference between two given date values or variables. The returned difference can be calculated in days, weeks, months, or years.
* **Between times:** Returns the numeric difference between two given time values or variables. The returned difference can be calculated in seconds, minutes, hours, days, weeks, months, or years.
* **Current date:** Returns the current date.

### Date comparisons

* **Is on or after:** Runs a boolean check on if the first given date value or variable is on or after the second given date value or variable.
* **Is after:** Runs a boolean check on if the first given date value or variable is after the second given date value or variable.
* **Is on or before:** Runs a boolean check on if the first given date value or variable is on or before the second given date value or variable.
* **Is before:** Runs a boolean check on if the first given date value or variable is before the second given date value or variable.
* **Is equal:** Runs a boolean check comparing two given date values or variables for equality.

### Time comparisons

* **Is on or after:** Runs a boolean check on if the first given time value or variable is on or after the second given time value or variable.
* **Is after:** Runs a boolean check on if the first given time value or variable is after the second given time value or variable.
* **Is on or before:** Runs a boolean check on if the first given time value or variable is on or before the second given time value or variable.
* **Is before:** Runs a boolean check on if the first given time value or variable is before the second given time value or variable.
* **Is equal:** Runs a boolean check comparing two given time values or variables for equality.

### Numeric comparisons

* **Equal to:** Runs a boolean check comparing given numeric values or variables for equality.
* **Not equal to:** Runs a boolean check comparing given numeric values or variables for non-equality.
* **Less than:** Runs a boolean check on if the first given numeric value or variable is less than the second given numeric value(s) or variable(s).
* **Less than or equal to:** Runs a boolean check on if the first given numeric value or variable is less than or equal to the second given numeric value(s) or variable(s).
* **Greater than:** Runs a boolean check on if the first given numeric value or variable is greater than the second given numeric value(s) or variable(s).
* **Greater than or equal to:** Runs a boolean check on if the first given numeric value or variable is greater than or equal to the second given numeric value(s) or variable(s).

### String comparison

* **Is:** Runs a boolean check comparing given string values or variables for equality.
* **Is not:** Runs a boolean check comparing given string values or variables for non-equality.
* **Contains:** Runs a boolean check on if the second given string value(s) or variable(s) is a substring of the first given string value or variable.
* **Does not contain:** Runs a boolean check on if the second given string value(s) or variable(s) is a substring of the first given string value or variable.
* **Starts with:** Runs a boolean check on if the second given string value(s) or variable(s) is a prefix of the first given string value or variable.
* **Ends with:** Runs a boolean check on if the second given string value(s) or variable(s) is a suffix of the first given string value or variable.

### Boolean comparisons

* **Is true:** Runs a boolean check on if a given boolean variable is true.
* **Is false (NOT):** Runs a boolean check on if a given boolean variable is false.
* **Is null:** Runs a boolean check on if a given variable is null.
* **Is not null:** Runs a boolean check on if a given variable is not null.

### Geospatial

* **Geohash from geopoint:** Converts a given geopoint into a geohash value as a string.
* **Latitude from geopoint:** Returns the numeric latitude value from a given geopoint.
* **Longitude from geopoint:** Returns the numeric longitude value from a given geopoint.
* **MGRS from geopoint:** Converts a given geopoint into an MGRS value as a string.

### Array operations

* **Compose:** Returns an array containing all values of the given arrays.
* **Intersection:** Returns an array containing only common values between the given arrays.
* **Update element at:** Returns an array with a specific element in the given array updated. A builder may specify the element to be updated by specifying the index representing the element's position within the array.
* **Get element at:** Returns a value corresponding to the element at a specified index within the given array and matching the array's type.
* **Length:** Returns a numeric value representing the number of elements within the given array.

### Array checks

* **Contains:** Runs a boolean check for the presence of given values within a given array.
* **Does not contain:** Runs a boolean check for the absence of given values within a given array.
* **Is subset of:** Runs a boolean check on if a given array is a subset of another given array.
* **Is null:** Runs a boolean check on if a given array is null.
  * Note: This transform will evaluate and display as "is empty" if an array variable reference is selected for the value.
* **Is not null:** Runs a boolean check on if a given array is not null.
  * Note: This transform will evaluate and display as "is not empty" if an array variable reference is selected for the value.

### Struct transforms

* **Extract struct field:** Returns a struct field value given a struct and field ID. See [Extract a field from a struct](/docs/foundry/workshop/struct-variables/#extract-a-field-from-a-struct) for more details.
