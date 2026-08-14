<!-- source: https://palantir.com/docs/foundry/transforms-python/bring-container/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Bring your own container workflows

Most computations can be easily expressed with just Python. However, there are use cases where one might want to rely on a non-Python execution engine or script. For instance, it could be an F# application, an ancient VBA script, or even just an end-of-life (EOL) version of Python. The possibilities are limitless when using bring-your-own-container (BYOC) workflows. In short, BYOC enables the creation of a Docker image locally with all the specific dependencies and/or binaries an application requires, and then running a lightweight transform on top of this image.

The following is an example of how to run a COBOL transform in Foundry. For simplicity, this example compiles the COBOL program inside the transform. Alternatively, you may pre-compile the program and copy the binary executable into the Docker image. First, [enable containerized workflows](/docs/foundry/administration/container-governance/#enable-container-workflows) then build the Docker image locally following these [image requirements](/docs/foundry/transforms-container/container-overview/#image-requirements).

Consider the following minimal Dockerfile as an example:

```dockerfile
FROM ubuntu:latest

RUN apt update && apt install -y coreutils curl sed build-essential gnucobol

RUN useradd --uid 5001 user
USER 5001
```

**Note:** The Docker image does not need to have Python installed for lightweight to work.

:::callout{theme="warning"}
Using `ubuntu:latest` as the base image might result in cURL command failures in IL5 or FedRAMP environments. If that occurs, use `ubuntu:jammy` instead.
:::

Then, build the image and upload it to Foundry. To do so, [create an Artifacts repository](/docs/foundry/code-repositories/create-artifact-repository/) and follow [these instructions to tag and push](/docs/foundry/code-repositories/publish-artifact/) our image. In this example, the image is tagged with the name `my-image` and version `0.0.1`. The final step before authoring the BYOC lightweight transform is to [add this Artifacts Repository as a local backing repository](/docs/foundry/code-repositories/artifact-settings/#add-a-new-artifact-to-your-code-repository) to the Code Repository.

This following example considers a COBOL script which generates a CSV file, with its source code located at `resources/data_generator.cbl` inside my Code Repository.

The final step is to write a lightweight transform that allows a connection of the data processing program to Foundry. The following snippet demonstrates how to access the dataset through the Python API while also including arbitrary executables shipped inside the image in question. To invoke the COBOL executable, use the Python standard library's functions (in this case, `os.system(...)`).

```python
from transforms.api import Output, transform


@transform.using(
    my_output=Output('my-output')
).with_container(
   container_image="my-image",
   container_tag="0.0.1"
)
def compile_cobol_data_generator(my_output):
    """Demonstrate how we can bring dependencies that would be difficult to get through Conda."""
    # Compile the Cobol program
    # (Everything from the src folder is available in $USER_WORKING_DIR/user_code)
    os.system("cobc -x -free -o data_generator $USER_WORKING_DIR/user_code/resources/data_generator.cbl")

    # Run the program to create and populate data.csv
    os.system('$USER_WORKING_DIR/data_generator')

    # Store the results into Foundry
    my_output.write_table(pd.read_csv('data.csv'))
```

:::callout{theme="warning"}
Preview is not yet supported for BYOC workflows.
:::

Using the **Build** button will eventually instantiate a container from our Docker image and invoke the commands specified. Resource allocation, logging, communicating with Foundry, enforcing permissions and auditability are all taken care of automatically.
