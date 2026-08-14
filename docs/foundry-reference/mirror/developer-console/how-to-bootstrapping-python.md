<!-- source: https://palantir.com/docs/foundry/developer-console/how-to-bootstrapping-python/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Bootstrap a new OSDK Python application

On this page, we will walk through the process of creating a Python application that uses the OSDK. The example below can be used with many Python frameworks, such as [Flask ↗](https://flask.palletsprojects.com/en/3.0.x/), [Streamlit ↗](https://streamlit.io/), and [Jupyter ↗](https://jupyter.org/).

## 1: Prerequisites

### Create a Developer Console application

Follow the steps listed in the [create a new Developer Console application](/docs/foundry/developer-console/create-application/) page.

### Set up your token

Export your token in your local environment. Below is an example using a sample personal access token, but you can generate a longer-lived one in the Developer Console. This token should not be checked into source control because it is your personal access token.

```bash
export FOUNDRY_TOKEN=<YOUR-TOKEN-FROM-GETTING-STARTED-PAGE>
```

### Check Python version

The Python SDK requires a Python version >=3.10 and <3.15. To check what version of Python you are using, enter the command below:

```bash
python3 --version
```

### Optional: Set up certificate

If your organization requires certificates for network traffic, you may need to tell Python where that certificate lives.

```bash
export SSL_CERT_FILE="/path/to/my.crt"
export REQUESTS_CA_BUNDLE="/path/to/my.crt"
```

## 2: Install the latest version of your SDK

Run the following command to install the latest version of the SDK, replacing any `< >` with your application-specific value that can be found on your application **Overview** page.

```bash
pip install <YOUR-PACKAGE-NAME> --upgrade --extra-index-url "https://:$FOUNDRY_TOKEN@<INDEX-URL>"
```

### Develop your frontend application

In your application, initialize the Foundry client and start developing.

```python
import os
from <PACKAGE-NAME> import FoundryClient
from <PACKAGE-NAME>.core.api import UserTokenAuth

auth = UserTokenAuth(hostname="<YOUR-FOUNDRY-URL>", token=os.environ["FOUNDRY_TOKEN"])

client = FoundryClient(auth=auth, hostname="<YOUR-FOUNDRY-URL>")

object = client.ontology.objects.<ANY-OBJECT>
print(object.take(1))
```
