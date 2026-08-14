<!-- source: https://palantir.com/docs/foundry/transforms-python/pipelines/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Pipelines

Each Python transforms sub-project in a repository exposes a single `transforms.api.Pipeline` object. This `Pipeline` object is used to do the following:

1. Register datasets in Foundry with instructions for how to build them.
2. Locate and execute the `@transform` logic responsible for building a given dataset during a Foundry build.

In most cases, the default repository setup will register transforms automatically, and the `Pipeline` object will not require special configuration.

### Add transforms to a pipeline

When a transform that is associated with your project’s pipeline declares a dataset as an `Output`, you can build this dataset in Foundry. The two recommended ways to add transforms to a `Pipeline` object are [automatic registration](#automatic-registration) and [manual registration](#manual-registration).

:::callout{theme="neutral"}
If you have a more advanced workflow and/or want to explicitly add each transform to your project’s pipeline, you can use manual registration. Otherwise, it is highly recommended that you use automatic registration to ensure that your registration code is concise and contained. With automatic registration, the `discover_transforms` method recursively discovers any transforms defined at the module level. Refer to the sections below for more information.
:::

### Automatic registration

:::callout{theme="warning"}
The `discover_transforms` method imports every module it finds. As a result, any code in your imported modules will be executed.
:::

As the complexity of a project grows, manually adding transforms to a `Pipeline` object can become unwieldy. To remedy this, the `Pipeline` object provides the `discover_transforms()` method to recursively discover all transforms in a Python module or package.

```python
from transforms.api import Pipeline
import my_module  # This is where your transform definition lives


my_pipeline = Pipeline()
my_pipeline.discover_transforms(my_module)
```

### Manual registration

Transforms can be manually added to a `Pipeline` object using the `add_transforms()` function. This function takes any number of transforms and adds them to the pipeline. It also checks whether any two transforms declare the same output dataset.

```python
from transforms.api import transform, Pipeline, Input, Output


@transform.using(
    my_output=Output('/path/to/output/dataset'),
    my_input=Input('/path/to/input/dataset')
)
def my_compute_function(my_output, my_input):
    my_output.write_table(my_input.polars())

my_pipeline = Pipeline()
my_pipeline.add_transforms(my_compute_function)
```

### Transform generation

:::callout{theme="warning"}
If you want to define a data transformation that creates multiple outputs, you can either use transform generation or [define a multiple-output transform](/docs/foundry/transforms-common/optimize-multi-output-transforms/#multi-output-transforms). With transform generation, it may be necessary to read and process the same input once for each output. With a multiple-output transform, it is possible to read and process the input just once. For more information, review the documentation on [optimizing multi-output transforms](/docs/foundry/transforms-common/optimize-multi-output-transforms/).
:::

You may want to re-use the same data transformation logic across multiple transforms. For instance, consider the following scenarios:

* You have an input dataset with information about various states. You have code that filters the input by state and then calculates various statistics.
* You have multiple input datasets that may contain null values. You have code that removes any null values.

In both cases, it would be useful to use the same data transformation code across multiple transforms. Instead of separately defining a transform object for each of your outputs, you can generate transform objects using a for-loop and register them in bulk to your project’s pipeline.

Below is an example of a transform generator:

```python tab="Polars"
import polars as pl
from transforms.api import transform, Input, Output


def transform_generator(sources):
    transforms = []
    # This example uses multiple input datasets. You can also generate multiple outputs
    # from a single input dataset.
    for source in sources:
        @transform.using(
            my_input=Input('/sources/{source}/input'.format(source=source)),
            output=Output('/sources/{source}/output'.format(source=source))
        )
        def compute_function(my_input, output, source=source):
            # To capture the source variable in the function, pass it as a keyword argument with a default value.
            df = my_input.polars()
            filtered = df.filter(pl.col('source') == source)
            output.write_table(filtered)
        transforms.append(compute_function)
    return transforms

TRANSFORMS = transform_generator(['src1', 'src2', 'src3'])
```

```python tab="DuckDB"
from transforms.api import transform, Input, Output

def transform_generator(sources):
    transforms = []
    # This example uses multiple input datasets. You can also generate multiple outputs
    # from a single input dataset.
    for source in sources:
        @transform.using(
            my_input=Input('/sources/{source}/input'.format(source=source)),
            output=Output('/sources/{source}/output'.format(source=source))
        )
        def compute_function(ctx, my_input, output, source=source):
            # To capture the source variable in the function, pass it as a keyword argument with a default value.
            conn = ctx.duckdb().conn
            query = conn.sql(f"""SELECT * FROM my_input WHERE source = '{source}'""")
            output.write_table(query)
        transforms.append(compute_function)
    return transforms

TRANSFORMS = transform_generator(['src1', 'src2', 'src3'])
```

```python tab="Pandas"
from transforms.api import transform, Input, Output

def transform_generator(sources):
    transforms = []
    # This example uses multiple input datasets. You can also generate multiple outputs
    # from a single input dataset.
    for source in sources:
        @transform.using(
            my_input=Input('/sources/{source}/input'.format(source=source)),
            output=Output('/sources/{source}/output'.format(source=source))
        )
        def compute_function(my_input, output, source=source):
            # To capture the source variable in the function, pass it as a keyword argument with a default value.
            df = my_input.pandas()
            filtered = df[df['source'] == source]
            output.write_table(filtered)
        transforms.append(compute_function)
    return transforms

TRANSFORMS = transform_generator(['src1', 'src2', 'src3'])
```

If using manual registration, you can then add the generated transforms to the pipeline. If you are unfamiliar with the `*` syntax, refer to the [Python documentation ↗](https://docs.python.org/3/tutorial/controlflow.html#unpacking-argument-lists).

```python
import my_module

my_pipeline = Pipeline()
my_pipeline.add_transforms(*my_module.TRANSFORMS)
```

:::callout{theme="warning" title="Important considerations"}
Read the following considerations carefully for information on how to avoid errors and failures.
:::

* **Capturing the source value:** To capture the source variable in the function, you must pass the `source` keyword argument with a default value in your compute function.
* **Using a for-loop to generate transforms:** The loop for generating your transform objects must be within a function, since Python for-loops do not create new scopes. If a function is not used, automatic registration will mistakenly only discover the final transform object defined in your for-loop. This function should return a list of the generated transform objects, and the return value should be set equal to a variable. Following these criteria in a module that is configured to be discovered with [automatic registration](#automatic-registration) will allow you to use automatic registration with generated transforms. Alternatively, you can use [manual registration](#manual-registration).
* **Changes to the list of input datasets:** If the list of input datasets changes between builds, for example, if the list of input datasets is read from a file that is modified between builds, the build will fail. This is because the new dataset references will not be found in the job specification for the build.
* **Dynamic input/output naming:** Dynamic input/output naming is not possible in transforms. When the CI job runs, all relations between inputs and outputs are determined, including the links between unique identifiers and dataset names. Output datasets that do not exist are created, and a [JobSpec](/docs/foundry/data-integration/builds/#jobs-and-jobspecs) is added to them.
  * When a dataset is built, the reference to the repository, source file, and the entry point of the function that creates the dataset is obtained from the JobSpec. Following this, the build process is initiated and your function is called to generate the final result. If there are changes in your inputs or outputs and the build process is launched, it will lead to an error because the JobSpecs are no longer valid. This disrupts the connection between the unique identifier and the dataset name.
* **Manual registration in Code Repositories:** The **Build** button in Code Repositories may not work for manual registration, and will present a **No transforms discovered in the pipeline from the requested file** error. You can still build these datasets with [Data Lineage](/docs/foundry/data-lineage/overview/) or Dataset Preview.

### Entry points

:::callout{theme="neutral"}
The default entry point and `Pipeline` object setup is sufficient for most use cases. Configuring the entry point is only recommended for multi-pipeline repositories or differing directory structures.
:::

The runtime responsible for executing a Python transformation needs to be able to find the project’s `Pipeline` object. To export a `Pipeline` object, add it to the `entry_points` argument in the `setup.py` file in a Python transforms sub-project. For more information about entry points, refer to the [setuptools library documentation ↗](https://setuptools.readthedocs.io/en/latest/pkg_resources.html#entry-points).

By default, it is required that each Python sub-project exports a `transforms.pipelines` entry point named `root`. This entry point references the module name and the `Pipeline` attribute.

For example, if you have a `Pipeline` called “my\_pipeline” defined in `myproject/pipeline.py` as show below:

```python
from transforms.api import Pipeline


my_pipeline = Pipeline()
```

You can register this `Pipeline` in `setup.py` as follows:

```python
from setuptools import find_packages, setup


setup(
    entry_points={
        'transforms.pipelines': [
            'root = myproject.pipeline:my_pipeline'
        ]
    }
)
```

In the code above, `root` refers to the name of the `Pipeline` object you are exporting. `myproject.pipeline` refers to the module containing your `Pipeline`, and `my_pipeline` refers to the `Pipeline` attribute defined in that module.
