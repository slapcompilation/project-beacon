<!-- source: https://palantir.com/docs/foundry/functions/attachments/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Attachments

:::callout{theme="warning"}
TypeScript v1 functions are executed in an environment that has strict memory limits. Exceeding these memory limits can happen quickly when dealing with file data; we recommend only interacting with attachments under 20MB. Python and TypeScript v2 functions have a default limit of 1GB, which can be adjusted in Ontology Manager.
:::

An attachment is a file that acts like an object property. Attachments are uploaded as temporary files and [attached to objects using actions](/docs/foundry/action-types/upload-attachments/). Once attached to an object, an attachment is persisted and can be accessed similarly to other properties.

## Attachments in functions

Attachments can be passed into functions as inputs from actions, or accessed as properties on objects. You can also create and return attachments in functions.

When using Python, attachments are managed using the [API Gateway](/docs/foundry/api/ontologies-v2-resources/attachments/attachment-basics/). An attachment type is provided in the [Python OSDK](/docs/foundry/ontology-sdk/python-osdk/).

Below is the import syntax for attachments by language:

```typescript tab="TypeScript v1"
import { Attachment } from "@foundry/functions-api";
```

```typescript tab="TypeScript v2"
import { Attachment } from "@osdk/functions";
```

```python tab="Python"
# For convenience, the OSDK Attachment type is re-exported from the Python functions `functions.api` package.
from functions.api import Attachment
```

## Read attachment data

A read method is provided on attachments to read their raw data. The signature for the method is as follows:

```typescript tab="TypeScript v1"
// Blob is a standard JavaScript type, representing a file-like object of immutable, raw data.
// https://developer.mozilla.org/en-US/docs/Web/API/Blob
readAsync(): Promise<Blob>;
```

```typescript tab="TypeScript v2"
// Response interface is part of the Fetch API, and is provided by `undici` in the TypeScript v2 environment.
// https://developer.mozilla.org/en-US/docs/Web/API/Response
fetchContents(): Promise<Response>;
```

```python tab="Python"
# BytesIO is a standard Python type, representing a binary stream.
# https://docs.python.org/3/library/io.html#io.BytesIO
def read(self) -> BytesIO: ...
```

You may need to use libraries or write your own custom code for handling complex file types. For example, PDFs must be parsed with an appropriate library. [Learn more about adding dependencies to functions repositories](/docs/foundry/functions/add-dependencies/).

### Parse Excel files from attachments

To create or update Ontology objects in bulk, accept an Excel file as an attachment parameter and parse its rows.

```typescript tab="TypeScript v1"
import { Attachment, OntologyEditFunction, Edits } from "@foundry/functions-api";
import { MyObjectType } from "@foundry/ontology-api";
import * as XLSX from "xlsx";

interface ExcelRow {
    [key: string]: string | number | null;
}

@OntologyEditFunction()
@Edits(MyObjectType)
public async processExcelUpload(file: Attachment): Promise<void> {
    // Read the file as a Blob
    const blob: Blob = await file.readAsync();

    // Convert Blob to ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer();

    // Parse the Excel file using SheetJS
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert worksheet to JSON rows
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as ExcelRow[];

    // Process each row to create or update objects
    for (const row of data) {
        // Create or update ontology objects based on row data
    }
}
```

```python tab="Python"
from io import BytesIO
import pandas as pd

from functions.api import function, Attachment, OntologyEdit
from ontology_sdk import FoundryClient
from ontology_sdk.ontology.objects import MyObjectType


@function(edits=[MyObjectType])
def process_excel_upload(excel_file: Attachment) -> list[OntologyEdit]:
    client = FoundryClient()
    ontology_edits = client.ontology.edits()

    # Read the uploaded Excel file
    sheet_data: BytesIO = excel_file.read()
    df = pd.read_excel(sheet_data)

    # Process each row to create or update objects
    for _, row in df.iterrows():
        new_obj = ontology_edits.objects.MyObjectType.create(str(row["id"]))
        new_obj.property_a = row["column_a"]
        new_obj.property_b = row["column_b"]

    return ontology_edits.get_edits()
```

For multiple file uploads, accept `Attachment[]` (TypeScript) or `list[Attachment]` (Python) as the parameter type. For libraries such as `xlsx` (SheetJS) or `pandas`, see [Add dependencies](/docs/foundry/functions/add-dependencies/).

### File parsing in TypeScript v1

TypeScript v1 functions do not offer filesystem support. Often, dependencies related to parsing file data will rely on the `fs` module, which is not available in the functions environment. This restriction may cause `fs` module errors during compilation and execution. To work around this restriction, you can introduce a dependency on an in-memory file system (`memfs`, for example). Then, alias the dependency under the `fs` name.

Below is an example using the NPM dependency `memfs` in a `package.json` file:

```json
"fs": "npm:memfs@^x.x.x"
```

## Create attachments

Functions can also be used to create attachments and attach them to objects. For attachments created in functions to be persisted, the function must make an [Ontology edit](/docs/foundry/functions/api-ontology-edits/) that links the attachment to an object.

:::callout{theme="warning"}
Attachments that are not attached to an object can only be viewed by the uploader and are automatically deleted after a certain period of time. <br><br>
TypeScript v2 functions do not support creating attachments.
:::

To create an attachment, use an upload function on the attachment. The signature for the upload function by language is as follows:

```typescript tab="TypeScript v1"
import { Attachments, Attachment } from "@foundry/functions-api";

// On Attachments:
uploadFile(filename: string, blob: Blob): Promise<Attachment>;
```

```python tab="Python"
from ontology_sdk import FoundryClient
from foundry_sdk_runtime.attachments import AttachmentMetadata

# On FoundryClient:
def upload(file_path: str, attachment_name: str) -> AttachmentMetadata: ...
# `file_path` is a local file to be uploaded.
```

The following example shows the process for uploading a file and assigning the resulting attachment to an object.

```typescript tab="TypeScript v1"
import { Attachments, Attachment, OntologyEditFunction } from "@foundry/functions-api";

@OntologyEditFunction()
public async updateMaintenanceLog(aircraft: Aircraft): Promise<void> {
    const aircraftMaintenanceLogData: Blob = await aircraft.maintenanceLog.readAsync();
    const completedMaintenanceLogData: Blob = await completedMaintenanceLog.readAsync();

    // You will likely need to rely on libraries or custom code to create the `Blob` object, which is
    // passed as a parameter into the `uploadFile` method.

    // Compare the current aircraft logs and completed logs and create a new maintenance log.
    const updatedMaintenanceLogData: Blob;

    aircraft.maintenanceLog = await Attachments.uploadFile("maintenance-log.txt", updatedMaintenanceLogData);
}
```

```python tab="Python"
from io import BytesIO

from functions.api import function, Attachment, OntologyEdit
from ontology_sdk import FoundryClient
from ontology_sdk.ontology.objects import Aircraft


@functions(edits=[Aircraft])
def update_maintenance_log(
    aircraft: Aircraft,
    completed_maintenance_log: Attachment
) -> list[OntologyEdit]:
    client = FoundryClient()
    ontology_edits = client.ontology.edits()

    maintenance_log_data: BytesIO = aircraft.maintenance_log.read()
    completed_maintenance_log_data: BytesIO = completed_maintenance_log.read()

    # Compare the current aircraft logs and completed logs and create a new maintenance log
    updated_maintenance_log_data: BytesIO = get_updated_maintenance_log(
        maintenance_log_data,
        completed_maintenance_log_data
    )

    editable_aircraft = ontology_edits.objects.Aircraft.edit(aircraft)

    with open("updated-maintenance-log.txt", "wb") as f:
        f.write(updated_maintenance_log_data.getbuffer())

    editable_aircraft.maintenance_log = client.ontology.attachments.upload(
        "updated-maintenance-log.txt",
        "my_attachment"
    )

    return ontology_edits.get_edits()
```
