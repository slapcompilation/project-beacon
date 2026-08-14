<!-- source: https://palantir.com/docs/foundry/transforms-python/transforms-python-foundry-connectors/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Foundry connectors

Connectors for interacting with Foundry from the transforms APIs.

A Connector can be used interactively to construct [`TransformInput`](/docs/foundry/api-reference/transforms-python-library/api-transforminput/#transforms.api.TransformInput) and [`TransformOutput`](/docs/foundry/api-reference/transforms-python-library/api-transformoutput/#transforms.api.TransformOutput) objects and also to run a [`Transform`](/docs/foundry/api-reference/transforms-python-library/api-transform/).

## FoundryConnector

### *class* `transforms.foundry.connectors.FoundryConnector`(*service\_config*, *auth\_header*, *filesystem\_id=None*, *fallback\_branches=None*, *resolver=None*)

* Entry point for accessing *Foundry* services.
* The *Foundry* object manages interactions with Foundry services by providing APIs for manipulating datasets.

#### Parameters

* **service\_config** (*[dict ↗](https://docs.python.org/3/library/stdtypes.html#mapping-types-dict)*)
  * A configuration dictionary conforming to the JSON spec in the Java class com.palantir.remoting.api.config.service.ServicesConfigBlock.
* **auth\_header** (*[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq)*)
  * The authorization string to use when connecting to Foundry services.
* **filesystem\_id** (*[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq), optional*)
  * The backing filesystem to use.
* **fallback\_branches** (*List\[[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq)], optional*)
  * Fallback branches.
* **resolver** (*Callable\[\[[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq)], [str ↗](https://docs.python.org/3/library/stdtypes.html#textseq)], optional*)
  * Function for resolving a dataset alias into a rid. Defaults to resolving the alias as a Project path.

***

### `input`(*alias=None*, *rid=None*, *branch=None*, *end\_txrid=None*, *start\_txrid=None*, *schema\_version=None*)

* Construct a [`TransformInput`](/docs/foundry/api-reference/transforms-python-library/api-transforminput/#transforms.api.TransformInput) from the given parameters.
* The *resource identifier* used to construct the [`TransformInput`](/docs/foundry/api-reference/transforms-python-library/api-transforminput/#transforms.api.TransformInput) will be resolved from the given `alias` unless the `rid` parameter is passed.

#### Parameters

* **alias** (*[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq), optional*)
  * The alias of the dataset.
* **rid** (*[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq), optional*)
  * The resource identifier of the dataset.
* **branch** (*[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq), optional*)
  * The branch from which to read the dataset. If not set the branch is chosen as the first branch in the *fallbacks* list that exists in the *Catalog*.
* **end\_txrid** (*[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq), optional*)
  * The end transaction of the view, if not set, defaults to the latest transaction on the given branch.
* **start\_txrid** (*[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq), optional*)
  * The starting transaction of the view.
* **schema\_version** (*[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq), optional*)
  * The schema version to use when reading, if not set, defaults to the latest schema version on the given branch.

#### Returns

* An input object representing the requested dataset.

#### Return type

* [`transforms.api.TransformInput`](/docs/foundry/api-reference/transforms-python-library/api-transforminput/#transforms.api.TransformInput)

#### Raises

* [`ValueError` ↗](https://docs.python.org/3/library/exceptions.html#ValueError)
  * If either the *alias* or *rid* (but not both) is not specified.
* [`ValueError` ↗](https://docs.python.org/3/library/exceptions.html#ValueError)
  * If a branch is not specified and a fallback branch cannot be found in the *Catalog*.

***

### `output`(*alias=None*, *rid=None*, *branch=None*, *txrid=None*, *filesystem\_id=None*)

* Construct a [TransformOutput](/docs/foundry/api-reference/transforms-python-library/api-transformoutput/#transforms.api.TransformOutput) from the given alias or rid.
* The *resource identifier* used to construct the [`transforms.api.TransformOutput`](/docs/foundry/api-reference/transforms-python-library/api-transformoutput/#transforms.api.TransformOutput) will be resolved from the given `alias` unless the `rid` parameter is passed.

#### Parameters

* **alias** (*[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq), optional*)
  * The alias of the dataset.
* **rid** (*[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq), optional*)
  * The resource identifier of the dataset.
* **branch** (*[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq), optional*)
  * The branch to which to write the dataset. If not set the branch is chosen as the first branch in the *fallbacks* list.
* **txrid** (*[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq), optional*)
  * The transaction into which data should be written.
* **filesystem\_id** (*[str ↗](https://docs.python.org/3/library/stdtypes.html#textseq), optional*)
  * The filesystem in which to create the dataset if it doesn’t already exist.

#### Returns

* An output object representing the requested dataset.

#### Return type

* [`transforms.api.TransformOutput`](/docs/foundry/api-reference/transforms-python-library/api-transformoutput/#transforms.api.TransformOutput)

#### Raises

* [`ValueError` ↗](https://docs.python.org/3/library/exceptions.html#ValueError)
  * If either the *alias* or *rid* (but not both) is not specified.

***

### `run`(transform)

* Run the given [Transform](/docs/foundry/api-reference/transforms-python-library/api-transform/) using the latest inputs and outputs.

#### Parameters

* **transform** ([`transforms.api.Transform`](/docs/foundry/api-reference/transforms-python-library/api-transform/))
  * The transform to run.

***

### `auth_header`

* *str*
  * The auth header used to contact Foundry.

***

### `fallback_branches`

* *List\[str]*
  * The fallback branches used to retrieve datasets.

***

### `spark_session`

* [`pyspark.sql.SparkSession` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.SparkSession.html)
  * Understand the *SparkSession* created by *FoundrySparkManager*.
