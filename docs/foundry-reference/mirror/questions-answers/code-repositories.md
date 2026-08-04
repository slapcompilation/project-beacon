<!-- source: https://palantir.com/docs/foundry/questions-answers/code-repositories/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Code Repositories

### How do I enable a code linter in my repository?

You can uncomment the lines related to lints in the `transforms-python/build.gradle` in your code repository. This will enable a `linting` task that will provide hints to violations of either `pep8` or `pylint` format rules.

*Timestamp:* June 12, 2024

### How can auto-scaling of executors be achieved in Spark profiles for dynamic scaling based on transform input sizes?

Auto-scaling of executors can be achieved by enabling dynamic allocation, which allows for auto-scaling of executors but not for executor/driver memory. Specific profiles such as DYNAMIC\_ALLOCATION\_MAX\_64 and the DYNAMIC\_ALLOCATION\_ENABLED profile support this functionality. More information and a list of profiles with built-in configurations for dynamic allocation can be found in the [Spark profiles reference documentation](/docs/foundry/optimizing-pipelines/spark-profiles-reference/#dynamic-allocation).

*Timestamp:* April 5, 2024

### How do I enable an auto formatter in my Python code repository?

Selecting the **Format before committing** option when committing code will run the `formatCode` task. This task can utilize `ruff` or `black` as formatters. This can be controlled by uncommenting the respective lines related to formatters in the `transforms-python/build.gradle` file.

*Timestamp:* June 12, 2024

### What steps should be taken to troubleshoot and resolve an import error stating `No module named <module-name>; <package-name> is not a package` in a transform?

To troubleshoot and resolve the import error, follow these steps:

1. Verify the library installation and ensure it is correctly installed in your code repository.
2. Check for hidden files and ensure environment configuration is set up properly.
3. Resolve any package conflicts by reviewing package resolution logs.
4. Re-trigger environment resolution by making a new commit if necessary.
5. If the module worked before but stopped working, check the version differences in the library for any major breaking changes.

*Timestamp:* April 25, 2024

### In transforms, what is the correct method to write a `pandas` dataframe?

To write a `pandas` dataframe, you should use the `.write_pandas()` method. If you encounter an `AttributeError: 'DataFrame' object has no attribute '_jdf'`, it means you are using a method designed for `pyspark` dataframes on a `pandas` dataframe.

*Timestamp:* May 30, 2024

### Is it possible to set a schedule on a transform that doesn't have an output dataset for the purpose of triggering a Python script to hit an external API?

No, it is not possible to set a schedule on a transform without an output dataset. The recommended solution is to track the response from the external API in an output dataset for logging. Alternatively, a function triggered via Automate could be used to run arbitrary code, but having an output dataset is still valuable for logging.

*Timestamp:* February 6, 2025
