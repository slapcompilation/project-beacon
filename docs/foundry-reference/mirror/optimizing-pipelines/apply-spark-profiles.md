<!-- source: https://palantir.com/docs/foundry/optimizing-pipelines/apply-spark-profiles/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Apply Spark profiles

You may want to apply custom Spark properties to your transforms jobs.

To apply the Spark properties to a specific job:

1. Follow the guide for [importing the Spark profile](/docs/foundry/code-repositories/spark-profiles/) into your repository.
2. Reference the transforms profile in your code as documented [below](#transforms-profile-syntax).

You can learn more about the characteristics of the default Spark profiles available in the [Spark Profiles Reference](/docs/foundry/optimizing-pipelines/spark-profiles-reference/) section.

Note also the [recommended best practices for adjusting Spark profiles](/docs/foundry/optimizing-pipelines/spark-concepts/#for-adjusting-spark-profiles).

## Transforms profile syntax

Specifying custom Spark profiles is supported in all [languages](/docs/foundry/building-pipelines/supported-languages/). In all of the cases below, settings are evaluated from left to right. If multiple profiles specify the same setting, the one closer to the end of the list will take precedence.

### Python

You can reference the `profile1` and `profile2` profiles in your Python code by using the `configure` decorator to wrap your transform object. This decorator takes in a `profile` parameter that refers to the list of your custom transforms profiles:

```python
from transforms.api import transform, Input, Output

@transform.spark.using(
    # your input dataset(s)
    my_input=Input("/path/to/input/dataset"),
    # your output dataset
    my_output=Output("/path/to/output/dataset"),
).with_config(profiles=['profile1', 'profile2'])
# your data transformation code
def my_compute_function(my_input, my_output):
    return my_output.write_dataframe(my_input.dataframe())
```

### Java

Auto-registered transforms can reference the `profile1` and `profile2` profiles in your Java code by using the `TransformProfiles` annotation in your compute function. This annotation takes in a parameter that refers to the array of your custom Spark profiles:

```java
import com.palantir.transforms.lang.java.api.TransformProfiles;

/**
* This is an example low-level Transform intended for automatic registration.
*/
public final class LowLevel {
     @Compute
     @TransformProfiles({ "profile1", "profile2" })
     public void myComputeFunction(
             @Input("/path/to/input/dataset") FoundryInput myInput,
             @Output("/path/to/output/dataset") FoundryOutput myOutput) {
         Dataset<Row> limited = myInput.asDataFrame().read().limit(10);
         myOutput.getDataFrameWriter(limited).write();
     }
 }
```

Alternatively, if you are using manual registration, you can use the `builder` method `transformProfiles()`:

```java
public final class MyPipelineDefiner implements PipelineDefiner {

    @Override
    public void define(Pipeline pipeline) {
        LowLevelTransform lowLevelManualTransform = LowLevelTransform.builder()
               .transformProfiles(ImmutableList.of("profile1", "profile2"))
               // Pass in the compute function to use. Here, "LowLevelManualFunction" corresponds
               // to the class name for a compute function for a low-level Transform.
               .computeFunctionInstance(new LowLevelManualFunction())
               .putParameterToInputAlias("myInput", "/path/to/input/dataset")
               .putParameterToOutputAlias("myOutput", "/path/to/output/dataset")
               .build();
        pipeline.register(lowLevelManualTransform);
    }
}
```

### SQL

You can reference the `profile1` and `profile2` profiles in your SQL code by setting the `foundry_transform_profiles` property for your table:

```sql
CREATE TABLE `/path/to/output` TBLPROPERTIES (foundry_transform_profiles = 'profile1, profile2')
    AS SELECT * FROM `/path/to/input`
```

Here is another example using alternative SQL syntax:

```sql
CREATE TABLE `/path/to/output` USING foo_bar OPTIONS (foundry_transform_profiles = 'profile1, profile2')
    AS SELECT * FROM `/path/to/input`;
```

Note that specifying custom transforms profiles is not currently supported in ANSI SQL mode.
