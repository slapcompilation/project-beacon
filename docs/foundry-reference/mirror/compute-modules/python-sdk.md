<!-- source: https://palantir.com/docs/foundry/compute-modules/python-sdk/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Python SDK

The Python SDK for compute modules enables you to build deployed functions that integrate with Foundry. The SDK provides decorators for function registration, authentication helpers, structured logging, and utilities for working with Foundry resources.

The Python SDK provides these key modules:

| Module                        | Purpose                                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| `compute_modules.annotations` | `@function` decorator for registering functions                     |
| `compute_modules.auth`        | `RefreshingOauthToken`, `retrieve_third_party_id_and_creds()` for authentication |
| `compute_modules.logging`     | `get_logger()`, `set_internal_log_level()` for structured logging   |
| `compute_modules.sources_v2`  | `get_source()` for accessing configured sources                     |

## Defining functions

### Basic function

Every function annotated with `@function` is automatically registered as an endpoint in your compute module:

```python
from compute_modules.annotations import function

@function
def my_function(context, event):
    """
    context: Dict with metadata (tokens, credentials, job ID, etc.)
    event: Dict with function parameters
    """
    return str(event['value'])
```

**Function signature requirements:**

1. **`context`:** Metadata about the invocation (job ID, credentials, etc.)
2. **`event`:** The input payload (can be typed with TypedDict or dataclass)

The return value must be JSON serializable.

### Typed functions (recommended)

Using typed inputs and outputs enables automatic schema inference and provides better IDE support.

**Using TypedDict:**

```python
from typing import TypedDict
from compute_modules.annotations import function

class CalculateInput(TypedDict):
    x: float
    y: float
    operation: str

class CalculateOutput(TypedDict):
    result: float
    operation: str

@function
def calculate(context, event: CalculateInput) -> CalculateOutput:
    ops = {
        'add': lambda a, b: a + b,
        'subtract': lambda a, b: a - b,
        'multiply': lambda a, b: a * b,
        'divide': lambda a, b: a / b if b != 0 else float('inf')
    }
    result = ops.get(event['operation'], lambda a, b: 0)(event['x'], event['y'])
    return {'result': result, 'operation': event['operation']}
```

**Using dataclass:**

```python
from dataclasses import dataclass
from compute_modules.annotations import function
import datetime

@dataclass
class EventInput:
    name: str
    timestamp: datetime.datetime
    value: float

@function
def process_event(context, event: EventInput) -> str:
    return f"Processed {event.name} at {event.timestamp} with value {event.value}"
```

[Learn more about type systems and automatic schema inference.](/docs/foundry/compute-modules/functions/#automatic-function-schema-inference)

### Streaming output

For large result sets, use streaming to avoid memory issues and provide progressive results:

```python
from compute_modules.annotations import function
from typing import Iterable

@function(streaming=True)
def generate_items(context, event) -> Iterable[str]:
    for i in range(event['count']):
        yield f"Item {i}"
```

:::callout{theme="warning"}
**Important:** Generators are NOT JSON-serializable. You MUST use `streaming=True` when returning a generator.
:::

## Authentication

### Application permissions (3PA)

Use application permissions (third-party application authorization) to access Foundry resources on behalf of users. The `RefreshingOauthToken` class automatically refreshes tokens every 30 minutes:

```python
from compute_modules.auth import RefreshingOauthToken, retrieve_third_party_id_and_creds

HOSTNAME = "yourenrollment.palantirfoundry.com"

# Get client ID and secret
client_id, client_secret = retrieve_third_party_id_and_creds()

# Create refreshing token (refreshes every 30 minutes by default)
refreshing_token = RefreshingOauthToken(
    hostname=HOSTNAME,
    scope=["api:datasets-read", "api:datasets-write"]
)

# Get token (always returns valid token)
access_token = refreshing_token.get_token()
```

[Learn more about authentication modes.](/docs/foundry/compute-modules/execution-modes/)

## Working with Foundry resources

### Using the Ontology SDK

The Python SDK integrates with the Ontology SDK (OSDK) for working with Ontology objects:

```python
import os
from compute_modules.annotations import function
from compute_modules.auth import retrieve_third_party_id_and_creds
from your_osdk_package import FoundryClient, ConfidentialClientAuth

foundry_url = os.environ["FOUNDRY_URL"]
CLIENT_ID, CLIENT_CREDS = retrieve_third_party_id_and_creds()

@function
def get_object(context, event):
    auth = ConfidentialClientAuth(
        client_id=CLIENT_ID,
        client_secret=CLIENT_CREDS,
        hostname=foundry_url,
        should_refresh=True,
        scopes=[
            "api:ontologies-read",
            "api:ontologies-write",
        ],
    )
    client = FoundryClient(auth=auth, hostname=foundry_url)
    employee = client.ontology.objects.Employee
    return str(employee.take(1))
```

[Learn more about OSDK integration.](/docs/foundry/compute-modules/osdk-integration/)

### Reading and writing datasets

Use the Foundry APIs to read and write dataset files:

```python
import logging
import os
import requests
from dataclasses import dataclass
from compute_modules.annotations import function
from compute_modules.auth import RefreshingOauthToken
from compute_modules.logging import get_logger

logger = get_logger(__name__)
logger.setLevel(logging.INFO)

FOUNDRY_URL = os.environ["FOUNDRY_URL"]
BASE_URL = f"https://{FOUNDRY_URL}"
refreshing_token = RefreshingOauthToken(
    hostname=FOUNDRY_URL,
    scope=["api:datasets-read", "api:datasets-write"]
)
CA_PATH = os.environ["DEFAULT_CA_PATH"]

@dataclass
class UploadFileRequest:
    dataset_rid: str
    file_path: str
    file_content: str

@dataclass
class UploadFileResponse:
    status: int

@function
def upload_file(context, event: UploadFileRequest) -> UploadFileResponse:
    """Write a file to a dataset."""
    logger.info(f"Uploading file to path: {event.file_path}")
    url = f"{BASE_URL}/api/v2/datasets/{event.dataset_rid}/files/{event.file_path}/upload"
    response = requests.post(
        url,
        params={"transactionType": "APPEND", "branchName": "master"},
        headers={
            "Authorization": f"Bearer {refreshing_token.get_token()}",
            "Content-Type": "application/octet-stream",
        },
        data=event.file_content,
        verify=CA_PATH,
    )
    return UploadFileResponse(status=response.status_code)

@dataclass
class GetFileRequest:
    dataset_rid: str
    file_path: str

@dataclass
class GetFileResponse:
    status: int
    file_content: str

@function
def get_file(context, event: GetFileRequest) -> GetFileResponse:
    """Read contents of a file from a dataset."""
    logger.info(f"Getting file from {event.file_path}")
    url = f"{BASE_URL}/api/v2/datasets/{event.dataset_rid}/files/{event.file_path}/content"
    response = requests.get(
        url,
        headers={"Authorization": f"Bearer {refreshing_token.get_token()}"},
        verify=CA_PATH,
    )
    return GetFileResponse(
        status=response.status_code,
        file_content=response.content.decode('utf-8'),
    )
```

## Logging

The SDK provides structured logging that automatically includes session IDs, job IDs, and process IDs:

```python
import logging
from compute_modules.logging import get_logger

logger = get_logger(__name__)
logger.setLevel(logging.INFO)

@function
def my_function(context, event) -> str:
    logger.debug(f"Input: {event}")
    try:
        result = process(event)
        logger.info(f"Success: {result}")
        return result
    except Exception as e:
        logger.error(f"Failed: {e}", exc_info=True)
        raise
```

**Log levels:**

```python
logger.debug("Debug logs")     # severity = 0
logger.info("Info logs")       # severity = 1
logger.warning("Warning logs") # severity = 2
logger.error("Error logs")     # severity = 3
logger.critical("Critical logs") # severity = 4
```

Set the minimum log level using `logger.setLevel(logging.INFO)`. Only logs with severity greater than or equal to the set level will appear.

[Learn more about debugging and viewing logs.](/docs/foundry/compute-modules/debugging/)

## Using sources

Compute modules can access external systems through configured sources. The SDK provides utilities for using sources:

```python
from compute_modules.sources_v2 import get_source

# Access source credentials
source = get_source("my-source-identifier")
```

:::callout{theme="warning"}
**Additional dependencies required:** To use sources, you must run:

`pip install foundry-compute-modules[sources]`
:::

[Learn more about configuring and using sources.](/docs/foundry/compute-modules/sources/)

## GitHub repository

The Python SDK is open source and available on GitHub:

* [palantir/python-compute-module ↗](https://github.com/palantir/python-compute-module)
