<!-- source: https://palantir.com/docs/foundry/optimizing-pipelines/troubleshoot-ooms/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Troubleshoot out-of-memory (OOM) errors

Out-of-memory errors can show up in a job in a few ways:

* Seeing **“Job aborted due to stage failure”**
* Seeing **“ExecutorLostFailure”**
* Seeing **“Spark module died while job `[jobID]` was using it. (ExitReason: MODULE\_UNREACHABLE)”**
* Seeing **Connection lost to driver**

These error messages indicate you've gone past the maximum permitted memory for this build. This is usually not a fault with the platform, but a problem with the build you've asked the platform to run. There are a few steps you can take to reduce the memory required to run a build.

To troubleshoot, perform the following steps:

* If your transform is written in Python or Pandas:
  * Move your computation into PySpark as much as possible to benefit from the power of the entire compute cluster. Logic in raw Python and Pandas is executed in the driver on a single processor which is probably slower than your laptop.
* If your transform is using joins:
  * Look for 'null joins' - joins onto columns where many of the row values are null. This can significantly increase the memory consumption of a join. To fix this, you can filter out nulls from problematic columns in your transform or in a previous transform.
  * Look for joins that greatly increase the number of rows in the output dataset and confirm this is necessary. One tip is to run an Analysis computing the number of rows per key in a dataset and the resultant rows after the join.
  * Look for recursive joins that can be checkpointed. Repeated joins onto a single table will cause the query plan to grow rapidly. Use checkpoints to cache intermediate results to avoid this.
* Check the size of files in your input datasets **(Dataset → Details → Files → Dataset Files)**. They should be at least 128MB each. If they're too small, or much too large, you'll need to repartition them.
* Split the transform into multiple smaller transforms. This can also help you identify which part of the transform is causing the failure.
* Remove columns you don't need from the input datasets or pre-filter datasets to remove rows you don't need to reduce the amount of data Spark has to hold in memory.
* If you can, simplify the logic of your transform.
* In cases where code optimization is not enough to build your job successfully, you can allocate additional resources. Note that adding additional resources can increase compute costs associated with the build. For more information on allocating additional resources, see:
  * [When to modify your Spark profile from the default](/docs/foundry/optimizing-pipelines/spark-concepts/#when-to-modify-your-spark-profile-from-the-default): Guidance around which Spark profiles to increase, based on your error.
  * [Spark profiles reference](/docs/foundry/optimizing-pipelines/spark-profiles-reference/): List of Spark profiles available in Foundry.
  * [Apply Spark profiles](/docs/foundry/optimizing-pipelines/apply-spark-profiles/): Instructions for how to apply custom Spark properties to your jobs.
