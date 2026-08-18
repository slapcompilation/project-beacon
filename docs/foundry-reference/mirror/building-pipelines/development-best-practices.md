<!-- source: https://palantir.com/docs/foundry/building-pipelines/development-best-practices/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Development best practices

This guide is meant to provide guidance for pipeline developers who are developing transformations. The **General** recommendations may also be of interest to project managers or platform administrators as they focus on higher-order principles of clean pipelines in general.

## General best practices

**Pipeline development is software development**

Many of the best practices from general software development apply equally to defining the transformations that make up your data pipeline. Below are a few common practices that exemplify this approach:

* **Reduce cognitive load:** Wherever possible, reduce the amount of thinking necessary. If you need to use complex functions or API calls that are non-obvious, make sure you have clear documentation.
* **Be nice to future you:** Pipelines are the foundation of your data enterprise. Think long-term and high vision while planning and implementing.
* **Don't Repeat Yourself (DRY):** Duplicated code or concepts require more maintenance and lead to subtle errors. Instead, refactor frequently at all levels, including building and publishing your own libraries or packages for cross-repository use, to ensure minimum duplication.
* **Avoid tech debt:** A corollary to long-term thinking, tech debt is easy to accrue in the face of deadlines of project-specific demands, but always comes back to bite.
* **Conventions matter:** Set a precedent and stick with it; this reduces cognitive load and helps legibility between Code Repositories. For instance, column and dataset names are conventionally written in `snake_case` - following this convention means anyone else who wants to reference your awesome dataset knows that it's `awesome_dataset`, not `AwesomeDataset` or `Awesome_Dataset`.
* **Less is more:** Systems with many smaller units are easier to maintain and reason about than systems with few large units; therefore bias towards:
  * Tightly-scoped Foundry Projects
  * Smaller transforms chained together
  * Short functions - and helper functions in transforms

### Anti-patterns

* **Overwrite vs. Delete:** Unlike other file systems, Foundry resources and datasets are connected to other artifacts rather than just the file itself. Hence, if you are iterating on a pipeline or data, deletion should occur only if you fundamentally want that type of data gone. For example, if you've written a transaction with incorrect data to a dataset, don't delete the dataset; instead, write a new `SNAPSHOT` transaction to overwrite the previous one. More challenges are likely to arise from trying to delete a dataset than from creating a new dataset in the same location.
* **Don't introduce circular dependencies:** If you are looking to use the dataset output of your transform as an input into other transforms, you should ensure you are not introducing any circular dependencies in your code. Foundry's build orchestration layer will attempt to prevent you from configuring any loops on the branch you are currently on and your Code Repository branch will fail checks if a loop is detected

:::callout
Foundry will check for circular dependencies on the branch being developed on, but will not run the check across all branches while writing code, such as if there are ontology writeback datasets that only exist on the master branch. Foundry will still fail checks if circular dependencies are detected on other branches when attempting to merge the feature branch with the branch that contains the circular dependencies.
:::

## Project folder structure

See [Recommended Project structure](/docs/foundry/building-pipelines/recommended-project-structure/) for a description of an overarching model to organize the entire flow of data through multiple Projects.

### Best practices

* **Manage permissions at the Project level:** If you anticipate needing to further partition permissions within a project, consider if the project should be further decomposed into smaller pieces. [Learn more about the concepts and practices of applying and managing permissions.](/docs/foundry/security/securing-a-data-foundation/)
* **Keep Projects tightly scoped:** Avoid “feature creep” and adding tangentially-related resources or use-case specific logic within your Project
* **Use meaningful folder names:** Remember that you're designing a Project for consumption outside your team as well as for daily iteration and development. Consider that at minimum you should have a `/Documentation` folder and a `/Output` folder. Different use-case or workflow Projects will have needs for more specific names, but always consider that your Project structure and naming scheme are signposts for visitors.

### Anti-patterns

* **Working in your home folder:** Your personal folder is not a place for development - the access controls are strict and sharing is difficult. Consider creating a `/scratch` folder in your Project for experiments or throw-away work rather than building in your home folder.

## Naming

### Best practices

* **Follow convention:** Name columns, datasets, repositories, files, and other resources following the common patterns for your organization or the convention for your Foundry instance.
* **Choose descriptive names:** Take the time to come up with two or three word names that orient a reader to the purpose or content of the resource being named. Consider putting the distinctive portion of the name first; this can help with long names where the full text is cut off in a dropdown and helps immediately distinguish references when scanning a code base or list of files, for instance. Avoid using abbreviations.

### Anti-patterns

* **Cryptic names:** Choosing names that simply increment a number (i.e. `dataset1`, `dataset2`, and so on) or names that are a single letter will make it more difficult to read and refactor your code and much more difficult for a new developer to approach your work.
* **Names distinguished only by path:** In some cases this is acceptable, for instance when you have `/raw/my_important_dataset` and then `/clean/my_important_dataset`, however in many cases this naming pattern can create confusion in views where only the dataset name itself is prominently displayed. Remember, provenance is tracked and easily visible, so you don't need to embed this kind of "state" into the names of your datasets.

## Data types

### Best practices

**Explicitly cast column types:** If you are working in a **Datasource Project**, explicitly cast the column types in the `raw` → `clean` transform, even if the schema inference from the data connection has chosen correct values. This will help catch breaking changes from the source system if a column type changes or an invalid value creates an incorrect inference during the sync.

### Patterns

**Use Timestamps for 'Time Only' data types:** Spark doesn't have a time-only data type for fields with values like “10:59:00”. In order to leverage the time functions that come with Spark's timestamp type, cast the values to seconds and then add `-2208988800` to it before casting it to a timestamp in order to put it in year 0. Alternatively, leave it as a string and let the users parse it as they need to.

### Anti-patterns

* **Casting all numeric fields to numeric datatypes:** Consider a column of aircraft IDs, like `545`, `972`, `314`.  It can be tempting to cast these to an integer column (after all, they look like integers and may even be integers in the source system).  However, this has significant drawbacks:
  * If leading zeros are meaningful, e.g. 123 and 0123 are both legal IDs that should be differentiated, this will result in errors.
  * The IDs may be formatted in an undesirable way in the UI (e.g. `545.0`, `1,234`, right justified).
  * If the IDs are too long, you can run into MAX\_INT issues.
  * Numeric functions won't ever be applied to these values (e.g. you won't ever add two aircraft IDs together).  *The rule of thumb should be to only cast numeric fields to numeric datatypes if it would be appropriate to perform arithmetic on them, otherwise cast them as strings.*

* **Storing timestamps in different timezones:** — Spark timestamps are timezone agnostic.  They are stored internally in UTC (aka Zulu, GMT); displaying a timezone is expected to be done by the front end.
  * If you need a particular timezone for display purposes, use [PySpark's `from_unixtime()` function ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.functions.from_unixtime.html) to store a string in the appropriate timezone.
  * If timestamps in a given datasource are in a timezone other than UTC, use [PySpark's `to_utc_timestamp()` function ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.functions.to_utc_timestamp.html) to normalize them to UTC.

## Code comments

### Anti-patterns

* **Commenting out code in commits:** When making changes, it can be tempting to comment out old code and leave it for reference or in case you need to revert later.  You can use comments while iterating, but do not commit code with statements commented out. Doing so builds cruft and reduces legibility. Old code is easy to find in previous commits.

* **Comments with authorship details and dates:** These are automatically tracked in the commits/git repository.  Manually commenting them is prone to not being updated and creates cruft.

* **Over-verbose Commenting:** Comments should share the *rationale behind decisions* rather than explain the logic itself. Strive to write “self-documenting” code; if a set of statements is difficult to understand, that is a clear sign to refactor and simplify.

## Repository practices

### Best practices

* **Protect the `master` branch:** If you're developing with a team, or even just working on a long-lived individual project, protect the master branch and practice [GitFlow ↗](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) or your preferred development workflow. The key concepts are simply to ensure that code moving to master is reviewed and tested.

* **Write commit messages:** Commit messages are the log of all activity in the repository. Take the time to write a useful description of your change:
  * Code reviewers can look at your commits to get a sense of your workflow and what changes were made.
  * If you want to revert a change, it's much easier if you can find the commit you were looking for at a glance.
  * Note that clicking the build button will autogenerate a commit message with a timestamp; avoid using this. Click commit first, write a commit message, and then click build.

* **Prune your branches:** In long-lived repositories, branches can accumulate. If development of a branch is abandoned, especially if a branch is merged into another, keep things tidy by *deleting the branch*. This helps with legibility of which branches are actively developed.

* **Upgrade your Repository:** When prompted, follow the steps to upgrade the language bundles in your repository. This process will open a pull request to the active branch containing the upgrades. You should feel free to run a build of your pipeline on the upgrade branch to ensure that none of the version bumps impact your code. However, staying up-to-date with these upgrades often ensures you do not encounter edge cases seen elsewhere, which are patched in the upgraded versions.

* **Practice Code Reviews:** As you collaborate with teammates to develop transformations, implement some practice of code reviews during the pull request process. We've shared our thoughts on [Code Review Best Practices ↗](https://blog.palantir.com/code-review-best-practices-19e02780015f) and many of the concepts will apply equally to reviewing data transformation code.

### Patterns

**Share code between repositories:** Repositories in Foundry operate on a Project level for a variety of reasons, but often there is logic that could be reused across pipelines, which has several advantages:

* General code reuse in accordance with DRY.

* Avoiding forked/inconsistent logic across different areas of the data foundation.

* There may be pipelines which would ideally use foundational pipelines but which have much stricter SLAs or performance requirements.  In this case, the solution is often to share the logic but not the transforms/datasets so that the critical pipeline can rely on pre-filtered datasets, fewer transforms, have different build schedules, and so on.

* Code Repositories are an excellent way to accomplish this. For example, when working with Python transforms, libraries can publish themselves to a Conda channel and allow other repositories to consume them. See the documentation on [Sharing Python Libraries](/docs/foundry/transforms-python/share-python-libraries/).

* An additional advantage of shared repositories is *semantic versioning*. The shared repository can tag its commits with versions (e.g. 1.0.0, 1.0.1, 2.0.0) and the consuming libraries can choose how they pick up new versions. For example, a repository might choose to take the latest version (2.0.0 above) or to only take a specific version (say, 1.0.1) and defer picking up new versions until they manually decide to. The latter case is particularly valuable when the pipeline is critical and the pipeline owners would like a chance to opt into/approve changes to the shared repository.

* **Releases:** Along the same lines, if a team wants to have an explicit release schedule for pipelines, one option (which avoids staging instances or long-lived develop branches) is to factor the logic out into functions in a shared repository and use the semantic version to keep the consuming repository at major releases, such as 1.0.0, 2.0.0, or even .0.0.  That way, the developers can continue to iterate on the logic and tag intermediate releases without them going live on master.  Moreover, on a branch on the consuming repository, the developers can always pick up intermediate versions as long as they do not merge them to master before the release date.

## Unit testing

Unit testing is a popular way of improving and maintaining code quality. In [unit testing ↗](https://en.wikipedia.org/wiki/Unit_testing), small and discrete components ("units") of software are tested in an individual, independent, and automated fashion.

* **Python unit tests:** You can enable `pytest` unit tests as part of the CI checks for your Python transforms repository by following the [Python unit test instructions](/docs/foundry/transforms-python/unit-tests/).

* **Java unit tests:** The steps for configuring unit tests for Java transforms can be found [in the Java unit tests documentation](/docs/foundry/transforms-java/unit-tests/).

### Best practices

Unit tests should:

* Only test one piece of logic at a time;
* Be lightweight (see the language-specific instructions for tips on how to reduce memory usage);
* Not rely on extra inputs to function; and
* Not rely on or call each other.

## Health checks

### Best practices

**Check your data health:** Often, once a portion of a pipeline is completed, it is easy to set the schedule and put it out of mind. However, even if your logic is sound, the incoming data can change in ways that affect your build, leading to slower performance, increased data scale, or outright build failure. Configuring basic checks on dataset size and build time, even if you do not configure alerts, will provide a view over time of these key metrics so you can observe, for instance, the rate of increase in dataset size or the average build time for the dataset. Read more about the specific [health checks](/docs/foundry/health-checks/checks-reference/) available and how to configure them.

### Patterns

**Extend health checks:** In most cases, the default health check configurations should be sufficient. If you need further flexibility, however, consider adding one or more derived `health check` datasets to your pipeline. The transform for this dataset can perform arbitrary logic to determine the validity of its input dataset (the dataset you are validating), and then output data formatted so that a simple health check, like `Allowed Value`, can report if the dataset is valid.

Set a schedule for this dataset to build whenever there is an update on the input dataset and you will have an extra set of comprehensive health checks.

## Scheduling

### Best practices

Review the [scheduling best practices](/docs/foundry/building-pipelines/scheduling-best-practices/).
