<!-- source: https://palantir.com/docs/foundry/transforms-common/optimize-multi-output-transforms/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Optimize multi-output transforms

There are two ways to derive a set of output datasets from a set of input datasets with transforms:

* Make multiple transforms with the same inputs and different outputs.
* Define a multi-output transform that takes multiple inputs and produces multiple outputs.

A hybrid approach is also possible, where you have multi-output transforms, each having the same inputs and different sets of outputs. These options are explored in the following section.

## Multiple single-output transforms

A single output transform has `X1, X2, ..., Xn` inputs and produces one output `Y`. To obtain multiple outputs `Y1, Y2, ..., Yn`, write multiple transforms taking these `X` inputs, each writing to a different output. Each output has its own transform.

### Benefits of multiple single-output transforms

The following is a list that describes the advantages of having multiple single-output transforms.

* Logic for each output is contained in different transforms, making it easier to maintain.
* If each output has different inputs, we can attribute the minimal set of inputs required for each transform. This can make builds quicker and allows you to separate inputs with markings to limit propagation, if necessary.
* You can build each output independently.
  * You do not need to wait for all outputs to finish to rerun one output. This is useful if you want to build transforms at varying frequencies.
  * You can build single outputs without building all outputs, which may become expensive.
* You can customize Spark profiles for each output, which is useful if they vary in compute costs.
* You can write to different projects. This is possible because you can move transforms to different repositories. Note that this can also be achieved with multi-output transforms by adding a step to copy data to a different location.
* You can use different libraries or frameworks for your transforms. For instance, some outputs could use lightweight transforms in Pandas, and others could use PySpark.
* Failures are contained to single transforms, whether they are coming from the data, the code, or the platform.
* Parallelization is performed between transforms, and within transforms.

### Multiple single-output transforms limitations

Conversely, having single-output transforms may also bring with it the following disadvantages.

* There might be duplicate logic.
  * This means maintainability could be harder; you might want to extract duplicate logic into shared libraries.
  * This could mean redundant PySpark operations for each output. Depending on the context, you might want to save an intermediate dataset to avoid redundant Spark operations.
  * If output datasets are too dependent on each other, the duplicate logic may require many intermediate datasets. This would essentially translate into a multi-output transform.
* Each transform will have its own Spark environment, including the driver and probably executors.
  * This compute sums up and if all outputs are run at the same time, some queuing might happen.
  * The overhead costs to run transforms are applied across all transforms. This includes Spark initialization and costs to run the drivers.
  * Even though Spark profiles are customizable per transform, in practice it is a management cost to fine tune each one, and is not always realistic to do so. If profiles are not customized, then outlier datasets of bigger scale will have fewer executors to work with than in multi-output transforms, leading to longer builds and potential timeouts.

Overall, this option comes with the most flexibility, but is less adapted to duplicate operations and might be more computationally expensive.

## Multi-output transforms

A multi-output transform has `X1, X2, ... Xn` inputs and produces `Y1, Y2, ... Yn` outputs.
We have a single transform for all outputs.

### Benefits of multi-output transforms

Consider the advantages of using multi-output transforms below:

* No repeated transform overhead costs.
  * A single driver and job.
  * This can become significant at high scale.
* The logic for all outputs is in a single place.
  * Intermediate datasets are no longer required, and will be computed in memory.
  * No duplicate costs for redundant logic.

### Multi-output transforms limitations

Consider the disadvantages of using multi-output transforms below:

* If the logic differs too much for each output, it can get unorganized and become harder to maintain.
* Each output cannot be built independently.
  * You need to wait for the previous build to finish all outputs before triggering a new one. You cannot customize the frequency of outputs within the transform.
* A single set of Spark profiles is assigned to the transform. There are considerations to keep in mind given that a single driver will process all operations and attribute tasks to the executors.
  * This can be mitigated with dynamic allocation profiles, but these profiles will fill resource queues quickly.
  * Tasks that are not parallelizable will generate an overhead on the driver. This includes, but is not limited to collecting to the driver, running user-defined functions (UDFs), and running Python code (for example, calling APIs).
  * When the data scale is small compared to the number of executors, the overhead from network inputs and outputs may become more significant than the computational work performed by the executors.
* A build failure affects all outputs.
  * If the operations of one output take more than 24 hours, or contain an error, it will trigger a failure of all outputs.
  * This can make it harder to debug issues.
* Cost usage is split amongst all output datasets equally; if there are 10 outputs, then a tenth of the build's cost is associated with each dataset. This means it is not easy to identify the cost association for each output.
* If the size of the input data varies, the build duration variance will be the sum of the variances introduced by all inputs. This can become significant for incremental transforms, where dynamic allocation profiles would be better suited.

Multi-output transforms are less flexible, but they are well suited for repeated logic in outputs.

### Additional considerations

Things to consider when you are using multi-output transforms:

* You can check if the task parallelization matches the number of executors in the Spark details. If builds take too long, or the Spark profile too big, consider splitting the transform.
* The more executors you use for each transform, the less significant the overhead costs. If you are transforming small-scale datasets into a lot of outputs, then network input/output could be more significant than executor work for a multi-output transform. Instead, you could use multiple transforms or lightweight transforms that are parallelized locally.

## Which approach to use

Single-output transforms are very flexible and well-suited to cases where the logic between outputs varies. Multi-output transforms are less flexible, but they can be more cost-effective under the right conditions. Generally, opt for multi-output transforms if you meet the following criteria:

* The constraints of multi-output transforms satisfy your needs. Review [multi-output transforms limitations](#multi-output-transforms-limitations) to see if this option is right for your use case.
* You have similar logic for the outputs.
* Your operations are parallelizable.

If these conditions are met, you should opt for multi-output transforms. Otherwise, decide case by case while keeping in mind that multiple single-output transforms are the fallback option.
