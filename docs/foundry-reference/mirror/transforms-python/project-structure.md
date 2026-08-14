<!-- source: https://palantir.com/docs/foundry/transforms-python/project-structure/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Project structure

## Default bootstrapped repository

Here is the standard structure for a bootstrapped Python transforms repository:

```
transforms-python
├── conda_recipe
│   └── meta.yaml
└── src
    ├── myproject
    │   ├── __init__.py
    │   ├── datasets
    │   │   ├── __init__.py
    │   │   └── examples.py
    │   └── pipeline.py
    ├── setup.cfg
    └── setup.py
```

There are also additional files inside the repository that can be viewed by going to the **Settings** cog in the File Explorer tab in Code Repositories and selecting **Show hidden files and folders**. In almost all cases, these hidden files should not be edited; Palantir does not provide support for repositories with custom changes to these hidden files.

You can learn more about the following files below:

* [`pipeline.py`](#pipelinepy)
* [`setup.py`](#setuppy)
* [`examples.py`](#examplespy)
* [`meta.yaml`](#metayaml)

:::callout{theme="neutral"}
Make sure you go through the [getting started guide](/docs/foundry/transforms-python/getting-started/) before reading on. Also, this page assumes that you are using the default project structure that is included in a bootstrapped Python transforms repository.
:::

## Repository upgrade file changes

When you create the repository for the first time, it is bootstrapped with the default contents of the latest Python transforms template version at that time. During subsequent [repository upgrades](/docs/foundry/code-repositories/repository-upgrades/), files in the repository are upgraded to align with the contents of the most recent Python transforms template version. Custom user changes to these files may be overwritten during the new upgrade template to ensure consistency. We do not support custom changes to these files as it can lead to unexpected behavior.

The following files will **not** be overwritten by a repository upgrade:

* Default files in the `conda_recipe` and `src` folders
* Inner and outer `build.gradle` files

The following files will be merged with the newest Python template file during a repository upgrade. In the case of any common keys, the Python template's version is chosen:

* `gradle.properties`
* `versions.properties`

The remaining files will be overwritten by the upgrade to match the files of the newest Python template versions.

## `pipeline.py`

In this file, you define your project’s Pipeline, which is a registry of the Transform objects associated with your data transformations. Here is the default `src/myproject/pipeline.py` file:

```python
from transforms.api import Pipeline
from myproject import datasets
my_pipeline = Pipeline()
my_pipeline.discover_transforms(datasets)
```

Note that the default `pipeline.py` file uses [automatic registration](/docs/foundry/transforms-python/pipelines/#automatic-registration) to add your Transform objects to your project’s Pipeline. Automatic registration discovers all Transform objects in your project’s `datasets` package. Thus, if you re-structure your project such that your transformation logic is not contained within the `datasets` folder, make sure to update your `src/myproject/pipeline.py` file appropriately.

Alternatively, you can explicitly add each of your Transform objects to your project’s Pipeline using [manual registration](/docs/foundry/transforms-python/pipelines/#manual-registration). Unless you have a workflow that requires you to explicitly add each Transform object to your Pipeline, it’s recommended to use automatic registration. For more information about Pipeline objects, refer to the [section describing Pipelines](/docs/foundry/transforms-python/transforms/).

## `setup.py`

In this file, you define a `transforms.pipeline` entry point named `root` that’s associated with your project’s Pipeline—this allows Python transforms to discover your project’s Pipeline. Here is the default `src/setup.py` file:

```python
import os
from setuptools import find_packages, setup

setup(
    name=os.environ['PKG_NAME'],
    version=os.environ['PKG_VERSION'],

    description='Python data transformation project',

    # Modify the author for this project
    author='{{REPOSITORY_ORG_NAME}}',

    packages=find_packages(exclude=['contrib', 'docs', 'test']),

    # Instead, specify your dependencies in conda_recipe/meta.yml
    install_requires=[],

    entry_points={
        'transforms.pipelines': [
            'root = myproject.pipeline:my_pipeline'
        ]
    }
)
```

If you modify the default project structure, you may need to modify the content in your `src/setup.py` file. For more information, refer to the [section describing the transforms.pipeline entry point](/docs/foundry/transforms-python/pipelines/#entry-points).

## `examples.py`

This file contains your data transformation code. Here is an uncommented version of the default `src/myproject/datasets/examples.py` file:

```python
from transforms.api import Input, Output, transform, LightweightInput, LightweightOutput


@transform.using(
    output_dataset=Output("/path/to/output/dataset"),
    input_dataset=Input("/path/to/input/dataset"),
)
def compute(input_dataset: LightweightInput, output_dataset: LightweightOutput) -> None:
    output_dataset.write_table(input_dataset.polars(lazy=True))
```

After un-commenting the sample code, you can replace `/path/to/input/dataset` and `/path/to/out/dataset` with the full paths to your input and output datasets, respectively. If your data transformation relies on multiple datasets, you can provide additional input datasets. You can update the `compute` function to contain the code to transform your input dataset(s) to your output dataset. Also, keep in mind that a single Python file supports the creation of multiple output datasets.

Note that the sample code uses the Polars compute engine. You can also modify the code to use other compute options. See [Compute engines](/docs/foundry/transforms-python/compute-engines/) for more details on compute options, and [Getting started](/docs/foundry/transforms-python/getting-started/) for code examples across all engines.

For more information about creating Transform objects, which describe your input and output datasets as well as your transformation logic, refer to the [section describing Transforms](/docs/foundry/transforms-python/transforms/#transforms).

## `meta.yaml`

A conda build recipe is a directory containing all the metadata and scripts required to build a [conda ↗](https://docs.conda.io/projects/conda-build/en/latest/index.html) package. One of the files in the build recipe is `meta.yaml`—this file contains all the metadata. For more information about the structure of this file, refer to the [conda documentation on the meta.yaml file ↗](https://docs.conda.io/projects/conda-build/en/latest/resources/define-metadata.html).
Here is the default `conda_recipe/meta.yaml` file:

```yaml
# If you need to modify the runtime requirements for your package,
# update the 'requirements.run' section in this file

package:
  name: "{{ PACKAGE_NAME }}"
  version: "{{ PACKAGE_VERSION }}"

source:
  path: ../src

requirements:
  # Tools required to build the package. These packages are run on the build system and include
  # things such as revision control systems (Git, SVN) make tools (GNU make, Autotool, CMake) and
  # compilers (real cross, pseudo-cross, or native when not cross-compiling), and any source pre-processors.
  # https://docs.conda.io/projects/conda-build/en/latest/resources/define-metadata.html#build
  build:
    - python 3.9.*
    - setuptools

  # Packages required to run the package. These are the dependencies that are installed automatically
  # whenever the package is installed.
  # https://docs.conda.io/projects/conda-build/en/latest/resources/define-metadata.html#run
  run:
    - python 3.9.*
    - transforms {{ PYTHON_TRANSFORMS_VERSION }}
    - transforms-expectations
    - transforms-verbs

build:
  script: python setup.py install --single-version-externally-managed --record=record.txt
```

If your Python transforms project requires any additional build dependencies, you can use the [package tab](/docs/foundry/transforms-python/use-python-libraries/) to discover available packages and automatically add these to your `meta.yml` file as described in the [documentation on sharing Python libraries](/docs/foundry/transforms-python/share-python-libraries/). This step will automatically detect the channel that produces the package you are trying to import and it will add it as a [backing repository](/docs/foundry/code-repositories/artifact-settings/).

It is also possible to manually update the "requirements" section in this file. However, it is strongly recommended not to do so manually as you run the risk of requesting packages and versions that are not available, and which will subsequently cause Checks to fail on your repository. For any dependencies that you add, make sure that the [required packages for your dependencies are available](/docs/foundry/transforms-python/use-python-libraries/).

Note that it is unlikely you will need to modify sections other than "requirements".

### Supported Python 3 versions

Palantir supports active versions of Python, adhering to the Python Software Foundation's end-of-life schedule. Refer to the [Python version support page](/docs/foundry/transforms-python/python-versions/) for more details.

Example usage:

```yaml
requirements:
  build:
    - python 3.9.*
    - setuptools

  # Any extra packages required to run your package.
  run:
    - python 3.9.*
    - transforms {{ PYTHON_TRANSFORMS_VERSION }}
```

:::callout{theme="neutral"}
* Be sure that the Python dependencies in the build and run sections are identical. Mismatches between the Python dependencies can lead to undesired outcomes and failures.
* Ranges such as `python >=3.9` or `python >3.9,<=3.10.11` are not supported for Python versions.
:::

### Pinning run-time versions

If your transforms require a specific library version to be pinned, and you wanted to manually add this rather than using the recommended [package tab](/docs/foundry/transforms-python/use-python-libraries/), you can explicitly specify this alongside the library name in the `requirements` block. Below is an example pinning:

```yaml
requirements:
  run:
    # The below pins an explicit version
    - mylibrary 1.0.1

    # The below specifies a maximum version (version equal or lower):
    - scipy <=1.4.0
```

Note:

* No space is allowed after the operator. e.g. `scipy <= 1.4.0` will fail CI checks.
* The operator `>=` for versions is not yet supported in Foundry.

### Using pip-managed dependencies

If your transform requires a specific library that is not available through Conda, but is available when installed using [pip ↗](https://pip.pypa.io/en/stable/), you can declare those in the additional `pip` section. The dependency will be installed on top of your Conda environment. Below is an example of adding a pip dependency:

```yaml
requirements:
  build:
    - python 3.9.*
    - setuptools

  run:
    - python 3.9.*
    - transforms {{ PYTHON_TRANSFORMS_VERSION }}

  pip:
    - pypicloud
```

Note:

* Dependencies added to the `pip` section are installed on top of the Conda environment that is derived from the packages in the `run` section. Therefore, removing `run` or `build` would cause failures.
* The `pip` section can only be used in Python transforms repositories, and cannot be used in Python libraries.
