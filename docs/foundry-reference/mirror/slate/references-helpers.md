<!-- source: https://palantir.com/docs/foundry/slate/references-helpers/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Handlebar helpers

Helpers are predefined functions that can be called from inside [Handlebars](/docs/foundry/slate/concepts-handlebars/) templates. Helpers have names, parameters, and return values. For example, the template `{{add 5 var1}}` calls the **add** helper on an integer (5) and a variable called `var1`. If `var1` is set to 7, then the template evaluates to 12.

Helpers fall into one of the following categories:

* Built-in helpers - from the Handlebars library
* Core helpers - available within queries and widgets
* Widget helpers - accessible only in widgets
* Foundry helpers - accessible only in Foundry queries
* SQL helpers - accessible only in SQL queries

:::callout{theme="neutral"}
Helpers cannot be used in the [Functions](/docs/foundry/slate/concepts-functions/) editor.
:::

## Built-in helpers

The following helpers from the Handlebars library are available. See the [Handlebars documentation ↗](https://handlebarsjs.com/guide/builtin-helpers.html) to learn about each helper:

* [if ↗](https://handlebarsjs.com/guide/builtin-helpers.html#if)
* [unless ↗](https://handlebarsjs.com/guide/builtin-helpers.html#unless)
* [each ↗](https://handlebarsjs.com/guide/builtin-helpers.html#each)

## Core helpers

The following core helpers are available within queries and widgets:

* [toString](#tostring)
* [toNumber](#tonumber)
* [concat](#concat)
* [substring](#substring)
* [contains](#contains)
* [jsonParse](#jsonparse)
* [jsonStringify](#jsonstringify)
* [add](#add)
* [subtract](#subtract)
* [multiply](#multiply)
* [divide](#divide)
* [max](#max)
* [min](#min)
* [eq](#eq)
* [ne](#ne)
* [lt](#lt)
* [le](#le)
* [gt](#gt)
* [ge](#ge)
* [encodeURI](#encodeuri)
* [encodeURIComponent](#encodeuricomponent)
* [getSelectedDisplayValue](#getselecteddisplayvalue)
* [getSelectedDisplayValues](#getselecteddisplayvalues)
* [lookup](#lookup)
* [and](#and)
* [or](#or)
* [not](#not)

### toString

The toString helper converts any given value to a string using the [JavaScript String() ↗](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)function.

#### Examples

* Using toString on a String
  * `{{toString 'hello'}}` renders to "hello"
* Using toString on a Number
  * `{{toString 1}}` renders to "1"
* Using toString on a String Array
  * `{{toString variable}}` where context is `{ variable: ["hello", "world"] }` renders to "hello,world"
* Using toString on a Number Array
  * `{{toString variable}}` where context is `{ variable: [1, 2, 3] }` renders to "1,2,3"
* Using toString on an Object
  * `{{toString variable}}` where context is `{ variable: {"hello": "world"} }` renders to "\[Object Object]"

### toNumber

The toNumber helper converts any given value to a number with the [JavaScript Number() ↗](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)function. If the value cannot be converted to a number, it will return NaN.

#### Examples

* Using toNumber on a Number
  * `{{toNumber 1}}` renders to 1
* Using toNumber on a String that represents a Number
  * `{{toNumber '2'}}` renders to 2
* Using toNumber on a String that does not represent a Number
  * `{{toNumber 'hello'}}` renders to NaN
* Using toNumber on an Array
  * `{{toNumber variable}}` where context is `{ variable: [1, 2, 3] }` renders to NaN
* Using toNumber on an Object
  * `{{toNumber variable}}` where context is `{ variable: {"hello": "world"} }` renders to NaN

### concat

The concat helper takes an arbitrary number of arguments and concatenates them together by first converting each argument into a string with the JavaScript String() function.<br>

#### Examples

* Using concat on two numbers
  * `{{concat 1 2}}` renders to "12"
* Using concat on two strings and a number
  * `{{concat 'hello' 'world' 2}}` renders to "helloworld2"
* Using concat on two string arrays
  * `{{concat array1 array2}}` where context is `{ array1: ["hello", "world"], array2: ["again", "and again"] }` renders to "helloworldagainand again"
* Using concat on three numbers and an object
  * `{{concat 1 2 3 variable}}` where context is `{ variable: {"hello": "world"} }` renders to "123\[Object Object]"

### substring

The substring helper takes an input string (value) and a start and end (optional), then passes it to the JavaScript substring() function. This enables you to get a substring of your input string.

#### Examples

* Using substring on a string
  * `{{substring 'foo' 0 1}}` renders to "f"
* If you use an input string that is shorter than the end, it will return the input string
  * `{{substring 'foo' 0 6}}` renders to "foo"
* If you do not provide an end index
  * `{{substring 'foo' 1}}` renders to "oo"

### contains

The contains helper takes an array or string (value) and a value to search for (searchValue) and returns true if the value is in the array, and false otherwise. It does this by calling `value.indexOf(searchvalue) !== -1`.

#### Examples

* Using contains on an array
  * `{{contains variable 3}}` where context is `{ variable: [1, 2, 3] }` renders to true
* Using contains on a string
  * `{{contains variable "hello"}}` where context is `{ variable: "hello world" }` renders to true

### jsonParse

The jsonParse helper takes a JSON string as input, and parses it using JavaScript’s [JSON.parse ↗](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse) function.

#### Examples

* Using jsonParse on a JSON stringified string
  * `{{jsonParse '\"foo\"'}}` renders to "foo"
* Using jsonParse on a JSON stringified array
  * `{{jsonParse varA}}` where context is `"[\"hello\",\"world\"]"` renders to `["hello", "world"]`
* Using jsonParse on a JSON stringified object
  * `{{jsonParse varA}}` where context is `"{\"varA\":{\"hello\":\"world\",\"foo\":[\"bar\",\"baz\"]}}"` renders to `{ varA: {"hello": "world", "foo": ["bar", "baz"]} }`
* Using jsonParse on a number
  * `{{jsonParse 123}}` throws an error in the console saying "jsonParse: Error: value must be a string"
* Using jsonParse on an invalid JSON string
  * `{{jsonParse varA}}` where context is `"[\"hello\","` throws an error in the console saying "jsonParse: SyntaxError: Unable to parse JSON string"

### jsonStringify

The jsonStringify helper takes any object as input, and returns that object converted to JSON (as passed to JavaScript’s [JSON.stringify ↗](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) function).

#### Examples

* Using jsonStringify on a string
  * `{{jsonStringify 'foo'}}` renders to `"foo"` (the double-quotes are included in the rendered text)
* Using jsonStringify on an object `{{jsonStringify varA}}` where context is `{ varA: {"hello": "world", "foo": ["bar", "baz"]} }` renders to `{"hello":"world","foo":["bar","baz"]}` (again, the double-quotes are in the rendered text)

### add

The add helper adds two numbers.

#### Examples

* Using add with two numbers
  * `{{add 20 5}}` renders to 25
* Using add on a value that is not a number
  * `{{add 10 'abc'}}` throws an error in the console saying "value must be a number"

### subtract

The subtract helper subtracts the second number from the first number.

#### Examples

* Using subtract with two numbers
  * `{{subtract 20 5}}` renders to 15
* Using subtract on a value that is not a number
  * `{{subtract 10 'abc'}}` throws an error in the console saying "value must be a number"

### multiply

The multiply helper multiplies two numbers.

#### Examples

* Using multiply with two numbers
  * `{{multiply 20 5}}` renders to 100
* Using multiply on a value that is not a number
  * `{{multiply 10 'abc'}}` throws an error in the console saying "value must be a number"

### divide

The divide helper divides the first number by the second number.

#### Examples

* Using divide with two numbers
  * `{{divide 20 5}}` renders to 4
* Using divide on a value that is not a number
  * `{{divide 10 'abc'}}` throws an error in the console saying "value must be a number"

### max

The max helper finds the maximum from any given numbers or array of numbers.

#### Examples

* Using max with an array of numbers
  * `{{max variable}}` where context is `{ variable: [1, 2, 3] }` renders to 3
* Using max with an array of numbers and two numbers
  * `{{max variable 12 15}}` where context is `{ variable: [1, 2, 3] }` renders to 15
* Using max with a string
  * `{{max 'hello' 123}}` throws an error in the console saying "value must be a number or a number array"
* Using max with an invalid array
  * `{{max variable}}` where context is `{ variable: ["hello", "world"] }` throws an error in the console saying "value must be a number or a number array"

### min

The min helper finds the minimum from any given numbers or an array of numbers.

#### Examples

* Using min with an array of numbers
  * `{{min variable}}` where context is `{ variable: [1, 2, 3] }` renders to 1
* Using min with an array of numbers and two numbers
  * `{{min variable 6 10}}` where context is `{ variable: [1, 2, 3] }` renders to 1
* Using min with a string
  * `{{min 'hello' 123}}` throws an error in the console saying "value must be a number or a number array"
* Using min with an invalid array
  * `{{min variable  }}` where context is `{ variable: ["hello", "world"] }` throws an error in the console saying "value must be a number or a number array"

### eq

The eq helper compares two numbers or strings and checks to see if they are equal

#### Examples

* Using eq with two numbers
  * `{{eq 1 1}}` renders to true
* Using eq on values that are not numbers or strings, or are different types
  * `{{eq [1, 2] 5}}` throws an error in the console saying "type mismatch"
* Using eq inside an if block

  ```
  {{#if (eq name 'Steven')}}
    Your name is Steven.
  {{else}}
    Your name is not Steven.
  {{/if}}
  ```

  where context is `{ name: "Steven" }` renders to "Your name is Steven."

### ne

The ne helper compares two numbers or strings and checks to see if they are different

#### Examples

* Using ne with two numbers
  * `{{ne 1 1}}` renders to false
* Using ne on values that are not numbers or strings, or are different types
  * `{{ne [1, 2] 5}}` throws an error in the console saying "type mismatch"

### lt

The lt helper compares two numbers or strings and checks if the first one is less than the second one.

#### Examples

* Using lt with two numbers
  * `{{lt 1 2}}` renders to true
* Using lt on values that are not numbers or strings, or are different types
  * `{{lt [1, 2] 5}}` throws an error in the console saying "type mismatch"

### le

The le helper compares two numbers or strings and checks if the first one is less than or equal to the second one.

#### Examples

* Using le with two numbers
  * `{{le 1 1}}` renders to true
* Using le on values that are not numbers or strings, or are different types
  * `{{le [1, 2] 5}}` throws an error in the console saying "type mismatch"

### gt

The gt helper compares two numbers or strings and checks if the first one is greater than the second one.

#### Examples

* Using gt with two numbers
  * `{{gt 2 1}}` renders to true
* Using gt on values that are not numbers or strings, or are different types
  * `{{gt [1, 2] 5}}` throws an error in the console saying "type mismatch"

### ge

The ge helper compares two numbers or strings and checks if first one is greater than or equal to the second one.

#### Examples

* Using ge with two numbers
  * `{{ge 1 1}}` renders to true
* Using ge on values that are not numbers or strings, or are different types
  * `{{ge [1, 2] 5}}` throws an error in the console saying "type mismatch"

### encodeURI

The encodeURI helper encodes any given string with the [JavaScript encodeURI() ↗](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI) function.

#### Examples

* Using encodeURI on a string
  * `{{encodeURI 'hello world?'}}` renders to "hello%20world?"
* Using encodeURI on a value that is not a string
  * `{{encodeURI variable}}` where context is `{ variable: [1, 2, 3] }` throws an error in the console saying "value must be a string"

### encodeURIComponent

The encodeURIComponent helper encodes any given string with the [JavaScript encodeURIComponent() ↗](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent) function.

#### Examples

* Using encodeURIComponent on a string
  * `{{encodeURIComponent 'hello world?'}}` renders to "hello%20world%3F"
* Using encodeURI on a value that is not a string
  * `{{encodeURIComponent variable}}` where context is `{ variable: [1, 2, 3] }` throws an error in the console saying "value must be a string"

### getSelectedDisplayValue

The getSelectedDisplayValue helper gets the selectedDisplayValue from displayValues given values and selectedValue.

#### Examples

* Using getSelectedDisplayValue with values, displayValues and selectedValue
  * `{{getSelectedDisplayValue values displayValues selectedValue}}` where context is `{ values: [1, 2, 3], displayValues: ["a", "b", "c"], selectedValue: 2 }` returns `["b"]`
* Using getSelectedDisplayValue when values or displayValues is not an array
  * `{{getSelectedDisplayValue values displayValues selectedValue}}` where context is `{ values: "hello", displayValues: ["a", "b", "c"], selectedValue: 2 }` throws an error in the console saying "values must be an array"
* Using getSelectedDisplayValue when selectedValue is not in values
  * `{{getSelectedDisplayValue values displayValues selectedValue}}` where context is `{ values: [1,2,3], displayValues: ["a", "b", "c"], selectedValue: 4 }` throws an error in the console saying "selectedValue '4' is not in values"

### getSelectedDisplayValues

The getSelectedDisplayValues helper gets the selectedDisplayValues from displayValues given values and selectedValues.

#### Examples

* Using getSelectedDisplayValues with values, displayValues and selectedValues
  * `{{getSelectedDisplayValues values displayValues selectedValues}}` where context is `{ values: [1, 2, 3], displayValues: ["a", "b", "c"], selectedValues: [2, 3] }` returns `["b", "c"]`
* Using getSelectedDisplayValues when values, displayValues or selectedValues is not an array
  * `{{getSelectedDisplayValues values displayValues selectedValues}}` where context is `{ values: "hello", displayValues: ["a", "b", "c"], selectedValues: 2 }` throws an error in the console saying "values must be an array"
* Using getSelectedDisplayValues when some selectedValue is not in values
  * `{{getSelectedDisplayValues values displayValues selectedValues}}` where context is `{ values: [1,2,3], displayValues: ["a", "b", "c"], selectedValues: [4] }` throws an error in the console saying "selectedValue '4' is not in values"

### lookup

The lookup helper uses a variant of the built-in [Handlebars lookup ↗](https://handlebarsjs.com/guide/builtin-helpers.html#lookup) and may be used as described in the Handlebars documentation. In addition, Slate’s lookup variant can describe long chains of properties as in the example below.

#### Example

* `{{lookup a "b" "c"}}` where the context is `{ a: { b: { c: "test" } } }` will return "test"

### and

The `and` helper performs an AND (&&) logical comparison on the supplied Boolean arguments. It requires at least two arguments.

#### Example

* `{{and var1 var2}}` where context is `{ var1: "true", var2: "false" }` renders to "false"

### or

The `or` helper performs an OR (||) logical comparison on the supplied Boolean arguments. It requires at least two arguments.

#### Example

* `{{or var1 var2}}` where context is `{ var1: "true", var2: "false" }` renders to "true"

### not

The `not` helper performs a NOT (!) logical comparison on the supplied Boolean argument. It can only be applied to one single argument.

#### Example

* `{{not var}}` where context is `{ var : "true" }` renders to "false"

## Widget helpers

The following widget helpers are available within widgets:

* [formatNumber](#formatnumber)
* [formatDate](#formatdate)

### formatNumber

The formatNumber helper format any given number to a string using the [Numeral.js ↗](http://numeraljs.com/) library. Note that the value must be a number and the format must be a string.

#### Examples

* Using formatNumber on a number
  * `{{formatNumber 1400 '0,0'}}` renders to "1,400"
    * For more examples of formatting a number, check the Numeral.js library.
* Using formatNumber on a value that is not a number
  * `{{formatNumber 'abc' '0,0'}}` throws an error in the console saying "value must be a number"
* Using formatNumber with an invalid format (format that is not a string)
  * `{{formatNumber 1400 variable}}` where context is `{ variable: ["hello": "world"] }` throws an error in the console saying "format must be a string"

### formatDate

The formatDate helper format any given date to a string using the [Moment.js ↗](https://momentjs.com/) library. Note that the value must be a date and the format must be a string.

#### Examples

* Using formatDate on a string
  * `{{formatDate '2014-1-2' 'MM/DD/YYYY'}}` renders to "01/02/2014"
    * For more examples of formatting a date, see check the Moment.js library.
* Using formatDate on a number
  * `{{formatDate 1237705200000 'YYYY-MM-DD'}}` renders "2009-03-22"
    * For more examples of formatting a date, see the Moment.js library.
* Using formatDate on a value that is an invalid date string
  * `{{formatDate 'some string' 'YYYY-MM-DD'}}` throws an error in the console saying "value must be a valid date"
* Using formatDate with an invalid format (format that is not a string)
  * `{{formatDate '2014-1-2' variable}}` where context is `{ variable: ["hello": "world"] }` throws an error in the console saying "format must be a string"

## Foundry helpers

The following helper is available within HttpJson Foundry queries.

* [joinParams](#joinparams)

### joinParams

The joinParams helper takes an array of parameters and joins single quoted parameters with `,`.

#### Examples

* Using joinParams with an array of strings
  ```
  "SELECT * FROM `table1` WHERE name IN ({{joinParams names}})"
  ```
  where context is `{ names: ["Bill", "John J.", "Sam's", "Jay"] }`
  renders to
  ```
  "SELECT * FROM `table1` WHERE name IN ('Bill', 'John J.', 'Sam\'s', 'Jay')"
  ```
* Using joinParams with a string
  ```
  "SELECT * FROM table1 WHERE name IN ({{joinParams name}});"
  ```
  where context is `{ name: "Bill" }`
  throws an error saying "parameters must be an array in joinParams helper"

## SQL helpers

The following SQL helpers are available within SQL queries. Note that while HttpJson Foundry queries use Spark SQL syntax, these helpers should not be used in those queries.

* [alias](#alias)
* [schema](#schema)
* [table](#table)
* [column](#column)
* [param](#param)

### alias

The alias helper takes an alias column or table name. The column and table helpers check values against the information schema. However, temporary column or table names are not in the schema. The alias helper provides a way for the user to register temporary column or table names. It throws an error when the name is not a constant value.

#### Examples

* Using alias to register an alias column name
  ```
  "SELECT id as {{alias 'alias_column_name'}} FROM table1 ORDER BY {{column aliasColumnName}};"
  ```
  where context is `{ aliasColumnName: "alias_column_name" }` renders to
  ```
  "SELECT id as alias_column_name FROM table1 ORDER BY alias_column_name;"
  ```

* Using alias to register an alias case sensitive column name
  ```
  "SELECT id as "{{alias 'Alias Column Name'}}" FROM table1 ORDER BY "{{column aliasColumnName}}";"
  ```
  where context is `{ aliasColumnName: "Alias Column Name" }` renders to
  ```
  "SELECT id as "Alias Column Name" FROM table1 ORDER BY "Alias Column Name";"
  ```

* Using alias to register an alias table name
  ```
  "SELECT id as "{{alias 'Alias Column Name'}}" FROM table1 ORDER BY "{{column aliasColumnName}}";"
  ```
  where context is `{ aliasColumnName: "Alias Column Name" }` renders to
  ```
  "SELECT id as "Alias Column Name" FROM table1 ORDER BY "Alias Column Name";"
  ```

* Using alias with non-constant value:
  ```
  "SELECT id as {{alias aliasColumnName}} FROM table1 ORDER BY {{table aliasColumnName}};"
  ```
  where context is `{ aliasColumnName: "alias_column_name" }` throws an error saying "Only constant parameters are not allowed..."

### schema

The schema helper takes a schema name and a list of whitelist names. It checks to make sure the schema name is in the list of whitelist names and checks the schema name against the data source’s information table. It throws an error when a schema name does not exist in the list of whitelist names or the information table.

#### Examples

* Using schema with a valid schema name
  ```
  "SELECT * FROM {{schema schemaName 'schema1' 'schema2'}}.table1;"
  ```
  where context is `{ schemaName: "schema1" }` renders to
  ```
  "SELECT * FROM schema1.table1;"
  ```
* Using schema with a schema name that is not in the list of whitelist names
  ```
  "SELECT * FROM {{schema schemaName 'schema1' 'schema2'}}.table1;"
  ```
  where context is `{ schemaName: "schemaNameNotInList" }` renders to
  ```
  "SELECT FROM schemaNameNotInList.table1"
  ```
  and an error will be thrown on execute saying "schema name must be in the list of the whitelist names."
* Using schema with a schema name with a reference in the list of whitelist names
  ```
  "SELECT * FROM {{schema schemaName 'schema1' 'schema2' templatizedName}}.table1;"
  ```
  where context is `{ schemaName: "schema1", templatizedName: "anotherSchemaName" }` renders to
  ```
  "SELECT * FROM schema1.table1;"
  ```
  and an error will be thrown on execute saying "References \['templatizedName'] cannot be dynamic for security reasons."
* Using schema with an invalid schema name
  ```
  "SELECT * FROM {{schema schemaName 'invalidSchema1'}}.table1;" 
  ```
  where context is `{ schemaName: "invalidSchema1" }` renders to
  ```
  "SELECT * FROM invalidSchema1.table1;"
  ```
  and an error will be thrown on execute saying "Invalid schema name 'invalidSchema1.'"

### table

The table helper takes a table name and a list of whitelist names. It checks to make sure the table name is in the list of whitelist names and checks the table name against the data source’s information table. It throws an error when a table name does not exist in the list of whitelist names or the information table.

#### Examples

* Using table with a valid table name
  ```
  "SELECT * FROM {{table tableName 'table1' 'table2'}};"
  ```
  where context is `{ tableName: "table1" }` renders to
  ```
  "SELECT * FROM table1;"
  ```
* Using table with a table name that is not in the list of whitelist names
  ```
  "SELECT * FROM {{table tableName 'table1' 'table2'}};"
  ```
  where context is `{ tableName: "tableNameNotInList" }` renders to
  ```
  "SELECT * FROM tableNameNotInList;"
  ```
  and an error will be thrown on execute saying "table name must be in the list of the whitelist names."
* Using table with a table name with a reference in the list of whitelist names
  ```
  "SELECT * FROM {{table tableName 'table1' 'table2' templatizedName}};"
  ```
  where context is `{ tableName: "table1", templatizedName: "anotherTableName" }` renders to
  ```
  "SELECT * FROM table1;"
  ```
  and an error will be thrown on execute saying "References \['templatizedName'] cannot be dynamic for security reasons."
* Using table with an invalid table name
  ```
  "SELECT * FROM {{table tableName 'invalidTable1'}};"
  ```
  where context is `{ tableName: "invalidTable1" }` renders to
  ```
  "SELECT * FROM invalidTable1;"
  ```
  and an error will be thrown on execute saying "Invalid table name 'invalidTable1'."

### column

The column helper takes a column name, or a list of column names, and checks it against the data source’s information table. It throws an error when a column name does not exist in the information table.

#### Examples

* Using column with a valid column name
  ```
  "SELECT {{column columnName}} FROM table1;"
  ```
  where context is `{ columnName: "column1" }` renders to
  ```
  "SELECT column1 FROM table1;"
  ```
* Using column with a valid case sensitive column name
  ```
  "SELECT "{{column columnName}}" FROM table1;"
  ```
  where context is `{ columnName: "Column 1" }` renders to "SELECT "Column 1" FROM table1;"
* Using column with a list of valid column names
  ```
  "SELECT {{column columnNames}} FROM table1;"
  ```
  where context is `{ columnNames: ["column1", "column2"] }` renders to
  ```
  "SELECT column1, column2 FROM table1;"
  ```
* Using column with an invalid column name
  ```
  "SELECT {{column columnName}} FROM table1;"
  ```
  where context is `{ columnName: "invalidColumn1" }` renders to
  ```
  "SELECT invalidColumn1 FROM table1;"
  ```
  and an error will be thrown saying "Invalid column name 'invalidColumn1'."

### param

The param helper takes a parameter or a list of parameters. In regular mode, it stores the parameters in a list and returns a question mark. In preview mode, it returns the parameters. Note: preview mode is used for previewing the rendered query and for debugging.

#### Examples

* Using param with a number in regular mode
  ```
  "SELECT * FROM table1 WHERE id = {{param parameter1}};"
  ```
  where context is `{ parameter1: 1234 }` renders to
  ```
  "SELECT * FROM table1 WHERE id = ?;"
  ```
  with the list of parameters `[1234]`
* Using param with a list of strings in regular mode
  ```
  "SELECT * FROM table1 WHERE text IN ({{param parameter1}});"
  ```
  where context is `{ parameter1: ["some", "text"] }` renders to
  ```
  "SELECT * FROM table1 WHERE text IN (?, ?);"
  ```
  with the list of parameters `["some", "text"]`
* Using param with a number using toString helper in regular mode
  ```
  "SELECT * FROM table1 WHERE text = {{param (toString parameter1)}};"
  ```
  where context is `{ parameter1: 1234 }` renders to
  ```
  "SELECT * FROM table1 WHERE text = ?;"
  ```
  with the list of parameters `["1234"]`
* Using param with a string using toNumber helper in regular mode
  ```
  "SELECT * FROM table1 WHERE text = {{param (toNumber parameter1)}};"
  ```
  where context is `{ parameter1: "1234" }` renders to
  ```
  "SELECT * FROM table1 WHERE text = ?;"
  ```
  with the list of parameters `[1234]`
* Using param with LIKE operation using concat helper in regular mode
  ```
  "SELECT * FROM table1 WHERE text LIKE {{param (concat '%' parameter1 '%')}};"
  ```
  where context is `{ parameter1: "some text" }` renders to
  ```
  "SELECT * FROM table1 WHERE text = ?;" with the list of parameters `["%some text%"]`
  ```
* Using param with a number in preview mode
  ```
  "SELECT * FROM table1 WHERE id = {{param parameter1}};"
  ```
  where context is `{ parameter1: 1234 }` renders to
  ```
  "SELECT * FROM table1 WHERE id = 1234;"
  ```
* Using param with a list of strings in preview mode
  ```
  "SELECT * FROM table1 WHERE text IN ({{param parameter1}});"
  ```
  where context is `{ parameter1: ["some", "text"] }` renders to
  ```
  "SELECT * FROM table1 WHERE text IN ('some', 'text');"
  ```
* Using param with an undefined parameter
  ```
  "SELECT * FROM table1 WHERE id = {{param parameter1}};"
  ```
  where context is `{ }` throws an error saying "Error: parameter value cannot be null in param helper"
* Using param with an array containing null
  ```
  "SELECT * FROM table1 WHERE text IN ({{param parameter1}});"
  ```
  where context is `{ parameter: ["some", null] }` throws an error saying "Error: parameter array cannot have null value in param helper".
