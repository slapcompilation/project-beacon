<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/parseXmlAsSchemaV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Parse XML as schema

> Supported in: Batch, Streaming

Parses xml strings following the given schema definition, ignoring any fields not in the schema.

**Expression categories:** File, Struct

## Declared arguments

* **Input schema:** Schema definition used when parsing the xml strings.<br>*Type\<Struct>*
* **Xml:** The xml string to parse.<br>*Expression\<String>*
* *optional* **Attribute prefix:** Prefix for attributes on tags.<br>*Literal\<String>*
* *optional* **Ignore namespace:** If set, ignores the namespace on elements and attributes. For example, \<ns1:author ns2:attr="value" /> would be treated as if it were just <author attr="value" />. Defaults to false.<br>*Literal\<Boolean>*
* *optional* **Output mode:** The 'simple' output mode will return null if an error is encountered during parsing (including those found as a result of invalid input). The 'with errors' output mode will return a parsable struct with any errors found during parsing in an 'errors' field and a valid parsed xml in the 'ok' field.<br>*Enum\<Simple, With errors>*
* *optional* **Value tag:** The tag used for the value when there are attributes in the element having no child.<br>*Literal\<String>*

**Output type:** *Struct*

## Examples

### Example 1: Base case

**Argument values:**

* **Input schema:** Struct\<id:String, airport:Struct\<id:String, miles:Integer>>
* **Xml:** `xml`
* **Attribute prefix:** *null*
* **Ignore namespace:** *null*
* **Output mode:** `SIMPLE`
* **Value tag:** *null*

| xml | **Output** |
| ----- | ----- |
| \<airline><br> \<id>XB-112\</id><br> \<airport><br>   \<id>JFK\</id><br>   \<miles>2000\</miles><br> \</airport><br>\</airline> | {<br> **airport**: {<br> **id**: JFK,<br> **miles**: 2000,<br>},<br> **id**: XB-112,<br>} |

***

### Example 2: Base case

**Description:** When namespace is ignored, parsing ignores namespace in the data. Note that namespaces in the schema will never match a key since the namespace is filtered.

**Argument values:**

* **Input schema:** Struct\<name:String, \_attribute:String, email:String, address:Struct\<nevermatches\:street:String, city:String, state:String, zip:String>>
* **Xml:** `xml`
* **Attribute prefix:** \_
* **Ignore namespace:** true
* **Output mode:** `SIMPLE`
* **Value tag:** *null*

| xml | **Output** |
| ----- | ----- |
| \<ns1:person ns1:attribute="tall"><br>\<ns1:name>John Doe\</ns1:name><br>\<email>john.doe@exampl... | {<br> **\_attribute**: tall,<br> **address**: {<br> **city**: Exampleville,<br> \*... |

***

### Example 3: Null case

**Description:** When a requested field is missing in the input XML the field becomes null.

**Argument values:**

* **Input schema:** Struct\<id:String, airport:Struct\<id:String, miles:Integer>>
* **Xml:** `xml`
* **Attribute prefix:** *null*
* **Ignore namespace:** *null*
* **Output mode:** `SIMPLE`
* **Value tag:** *null*

| xml | **Output** |
| ----- | ----- |
| \<airline><br> \<id>XB-112\</id><br> \<airport><br>   \<id>JFK\</id><br> \</airport><br>\</airline> | {<br> **airport**: {<br> **id**: JFK,<br> **miles**: *null*,<br>},<br> **id**: XB-112,<br>} |

***

### Example 4: Null case

**Description:** When the requested schema is too small, only the fields in the schema are parsed.

**Argument values:**

* **Input schema:** Struct\<id:String>
* **Xml:** `xml`
* **Attribute prefix:** \_
* **Ignore namespace:** *null*
* **Output mode:** `SIMPLE`
* **Value tag:** *null*

| xml | **Output** |
| ----- | ----- |
| \<airline><br> \<id>XB-112\</id><br> \<airport><br>   \<id>JFK\</id><br> \</airport><br>\</airline> | {<br> **id**: XB-112,<br>} |

***

### Example 5: Null case

**Description:** You can read attributes by putting attribute prefix in front of the name.

**Argument values:**

* **Input schema:** Struct\<id:String, airport:Struct<\_id:String, miles:Integer>>
* **Xml:** `xml`
* **Attribute prefix:** \_
* **Ignore namespace:** *null*
* **Output mode:** `SIMPLE`
* **Value tag:** *null*

| xml | **Output** |
| ----- | ----- |
| \<airline>    \<id>XB-112\</id>    \<airport id="JFK"><br>   \<miles>2000\</miles><br> \</airport><br>\</airline> | {<br> **airport**: {<br> **\_id**: JFK,<br> **miles**: 2000,<br>},<br> **id**: XB-112,<br>} |

***
