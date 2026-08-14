<!-- source: https://palantir.com/docs/foundry/optimizing-pipelines/usage-optimization/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Foundry usage optimization

## Foundry usage optimization best practices

The following guide aims to provide methods and best practices for optimizing Foundry usage. This documentation firstly covers how usage in Foundry is determined, and secondly, how to identify usage waste and pipeline optimization. The general recommendations may also be of interest to project managers or platform administrators as they focus on monitoring and optimizing an organization’s usage consumption.

In addition to the best practices listed here, [Linter](/docs/foundry/linter/overview/) checks the state of Foundry for anti-patterns and provides opinionated recommendations to improve the state of resources. You can evaluate and act on these recommendations to reduce cost, optimize your Ontology, and increase pipeline stability and resilience.

### When to optimize

As you think about how to implement these best practices for your workflows, it is important to not fall into a well-known pitfall of prematurely optimizing a pipeline or workflow. Users should avoid prematurely optimizing pipelines and should not expect a one-size-fits-all strategy for optimization.

We advise following the mental steps below to check the validity of your approach:

* Is the workflow finished and working? If not, be mindful of premature optimization which could affect the functionality of the workflow.
* Is there a clear objective for this optimization, such as time-to-visualization or cost, which will be used as a success metric to drive further decisions?
* Is there already a defined bottleneck against the objective mentioned above?

If some of these questions are still to be answered, it might indicate that more pre-work is necessary in order to have a successful optimization effort.

With this in mind, below are good and bad examples of optimization efforts:

* \[GOOD] A working pipeline is costing $X and an engineer is asked if this can be reduced. [Resource Management](/docs/foundry/resource-management/overview/) apps show that most of the costs are related to computing resourcing. Displaying the build frequency, the engineer finds that the schedule runs every day although no one uses it every day. Changing the schedule setup to run less frequently would reduce the consumption by ~28%. After that, the pipeline would no longer be the most expensive on the platform, and the engineer can focus on improving the next bottleneck.
* \[BAD] An engineer is asked to design an advanced strategy to optimize the storage cost of a pipeline, requiring significant engineering hours. Once the strategy is implemented, the storage costs decrease but the overall infrastructure bill stayed the same. Why? The bottleneck, storage, was incorrectly identified based on the objective to save costs. Although the storage size of the dataset was unnecessarily high, the low cost of storage relative to compute meant the change only had a minor impact on the total usage cost of the workflow.

### General best practices

Some general practices for optimizing your Foundry usage include:

* Setting up projects to be able to track usage in the Resource Management application
* Leveraging resource queues
* Using incremental pipelines wherever possible
* Managing schedules to ensure they are running to meet and not exceed your Organization's requirements
* Optimizing Spark usage (depending on whether your level of comfort with implementation)

## Step 1: Understand the components of Foundry usage

Foundry usage is made up of three components: Foundry compute, Ontology volume, and Foundry storage.

The majority of accounts are on this 3 dimension model; however, usage criteria may vary for some accounts. Review terms with your Palantir representative to confirm.

### 1. Foundry compute

[Foundry compute](/docs/foundry/resource-management/usage-types/#foundry-compute) is driven by tools for data integration and analysis. There are three main types of Foundry compute: batch, interactive, and streaming.

Batch compute represents queries or jobs that run in a "batch" capacity, meaning they are triggered to run in the background on a certain scheduled cadence or ad-hoc basis. Batch compute jobs do not consume any compute when they are not being run. A few examples of batch compute include all transform jobs, builds of datasets from Contour, code workbooks, data health checks, and syncs to Ontology/indexed storage.

Interactive compute represents queries that are evaluated in real-time, usually as part of an interactive user session. To provide fast responses to users, interactive compute systems maintain always-on idle compute, which means interactive queries tend to take up more compute than batch evaluation. The main form of interactive compute is [Contour](/docs/foundry/contour/overview/) - Contour dashboards, analyses, and embedded contour charts all are examples of interactive compute.

Streaming compute represents always-on processing jobs that continuously receive messages and process them using arbitrary logic. Streaming compute is measured for the length of time that the stream is ready to receive messages; streaming compute has the highest cost compared to batch and interactive compute. Examples of streaming compute include streaming transformations and [Pipeline Builder](/docs/foundry/pipeline-builder/overview/) streams.

The amount of compute usage for batch, interactive, and streaming are driven by the following factors:

* **Data logic:** The logic applied to data is one of the biggest factors that impacts Foundry usage and the factor that users can influence the most.
* **Transformation speed:** Transformation speed is achieved by parallelizing your jobs. Foundry can scale up to thousands of simultaneous machines to quickly tackle massive computation on large datasets. However, faster results and parallelizing jobs can introduce overhead and inefficiencies which might lead to more usage.
* **Type of computation:** Different computation types require different amounts of compute to execute on the same data. For example, batch processing tends to take less compute than stream data processing because batch processing only uses compute during the runtime while streaming is always-on.
* **Data scale and type:** The more data there is, the more compute it takes to process it.
* **Data freshness:** The more often you compute new results and the more scheduled transformations, the more compute it takes to execute.

### 2. Ontology volume

The second component of Foundry usage is [Ontology volume](/docs/foundry/resource-management/usage-types/#ontology-volume). One of Foundry’s unique capabilities is the Ontology layer. An Ontology is a translation layer between enterprise data and the objects your Organization cares about. An Ontology is a categorization of your data world that allows an Organization to think of their data in more tangible terms such as an “aircraft” or “car” rather than aggregations of the many rows and columns that describe them. If you are not familiar with an Ontology, you can [learn more from the documentation](/docs/foundry/ontology/overview/).

Ontology volume is driven by the following factors:

* **Number of Objects:** Foundry’s Ontology layer can scale up to billions of Objects per Object type. The total Ontology volume of an Object type is directly related to the total number of Objects.
* **Object sizes:** Ontology Objects can each have hundreds of properties of arbitrary type. Objects with more or larger properties (for example, long text or images) use more Ontology volume.
* **Number of Object-to-Object links:** Objects with many links to other Objects can use more Ontology volume due to the size of their link metadata.

### 3. Foundry storage

[Foundry storage](/docs/foundry/resource-management/usage-types/#foundry-storage) measures the general purpose data stored in the non-Ontology transformation layers in Foundry, sometimes referred to as "cold storage".

Dataset branches and previous transactions (and views) impact how much disk space a single dataset consumes. Foundry comes with a variety of retention rules to help you keep your Foundry instance lean. When files are removed from a view with a `DELETE` transaction, the files are not removed from the underlying storage and thus continue to accrue storage costs. The only way to reduce size is to use Retention to clean up unnecessary transactions. Committing a `DELETE` transaction or updating branches do not reduce the storage used.

Having a clear understanding of what makes up Foundry usage and what impacts it can provide you insight into optimization opportunities.

| Foundry application                              | Usage impact type    |
|--------------------------------------------------|------------------------|
| Code Repositories                                | Foundry compute        |
| Pipeline Builder                                 | Foundry compute        |
| Code Workbooks                                   | Foundry compute        |
| Contour                                          | Foundry compute        |
| Live models                                      | Foundry compute        |
| Ontology                                         | Ontology volume        |
| Dataset                                          | Foundry storage        |

## Step 2: Understanding how to track Foundry usage

The [Resource Management application](/docs/foundry/resource-management/overview/) provides visibility and transparency for an Organization to understand their Foundry usage consumption. The application enables users to see Foundry usage consumption broken out by each Foundry usage type (Foundry compute, Ontology volume, and Foundry storage). A user can look at usage by resource (Project), source (application), and user.

When trying to identify where Foundry Usage can be optimized, the **first place to check is the Resource Management application**. This allows you to see what resources are taking up the most compute and identify where you have bottlenecks. From here, you can leverage [Foundry usage optimization best practices](#foundry-usage-optimization-best-practices) to identify ways to potentially reduce usage, but always remember - **focus on the bottlenecks**.

## Step 3: Set up Projects to be able to track Foundry usage

### Projects and the Resource Management application

As mentioned above, compute resources are managed at the Project-level by default within Resource Management (RMA); within RMA, we see Foundry compute, Ontology volume, and Foundry storage metrics measured per Project. Therefore, proper Project set-up is absolutely crucial in order to effectively track usage metrics across a data pipeline. A proper set-up will enable data engineers or platform administrators to monitor these usage metrics at key phases of the pipeline to identify areas to optimize. An improper set-up will result in a failure to identify resource-heavy and computationally expensive pieces of a data pipeline.

### Recommended Project structure for tracking Foundry usage

Foundry projects should be used to enable a properly structured data pipeline. The best practices for project set-up along with pipeline stages are covered in-depth in the [recommended Project and team structure documentation](/docs/foundry/building-pipelines/recommended-project-structure/). Ensuring that projects follow the recommended structure, from importing the raw data from datasources to an actual workflow, will enable users to analyze compute and storage metrics along key phases of a pipeline.

### Permissions

When looking for usage reduction strategies, administrators should consider who on their team should have access to create Projects and resources. Restricting this access to the smallest possible number of individuals who are educated on set-up best practices will allow for less spread of Projects and resources, cutting down on unnecessary storage and compute. Allowing any user to create Projects on the platform will likely result in Projects created against the recommended structure for tracking usage, leading to unnecessary and expensive pipelines that ultimately drive up usage. Organizations may manage their Project creation access differently based on the number of users on the platform and data access restrictions; developing a process for determining this access and educating those with access on proper Project structure is recommend to enable proper usage monitoring for these resources.

## Step 4: Resource queues

A key feature within the Resource Management application that enables you to control your spending in Foundry is [resource queues](/docs/foundry/resource-management/resource-queues/#resource-queues). In order to constrain the amount of compute power associated with a specific project or multiple Projects, you can bundle Projects into queues. Each queue will be assigned a specific resource limit that defines the number of maximum vCPUs used at once. For example, you can assign XXX vCPUs to a given queue which will be the maximum number of vCPUs running at any given time for the Projects assigned. This will ensure that you have visibility and awareness to the amount of usage each Project will consume.

## Step 5: Incremental pipelines

[Incremental pipelines](/docs/foundry/building-pipelines/incremental-overview/) are often used to process input datasets that change significantly over time. By avoiding unnecessary computing on all the rows or files of data that have not changed, incremental pipelines enable lower end-to-end latency while minimizing compute costs. The way to execute this is by understanding the difference between a `SNAPSHOT` and `APPEND` transaction.

### Snapshot transaction

The default transaction type is `SNAPSHOT`. Snapshot transactions are treated as a replacement of all data in the dataset. That means when you open a dataset where the latest transaction type is `SNAPSHOT`, the preview will contain only data received in that latest snapshot transaction. The same happens when you try to read that dataset in a data transform or Contour analysis - you will only see data from that latest transaction.

Snapshot is the default transaction type because it’s the easiest one to use - each time your sync runs, it will download all data returned from the database query, and create a snapshot transaction that effectively replaces all data that was in the dataset before. Files present in a previous transaction are of course still available in the historical versions of the dataset, but the preview and the downstream transformation using the data will now access the new transaction by default.

Of course, snapshot transactions are simple to use correctly, but copying all data every time can be very inefficient. One potential efficiency improvement is to use the `APPEND` transaction type instead.

### Append transaction

When a dataset consists of append transactions, its default view is a sum of all transactions. This means you do not have to sync files you already uploaded when you use the `APPEND` transaction type - only the new data is synced into Foundry. This results in a reduction of Foundry storage because each transaction only contains the added files, and NOT a snapshot of everything available in the source system.

## Step 6: Manage schedules

Another way to optimize Foundry usage is via schedules. [Schedules](/docs/foundry/pipeline-builder/schedules-overview/), configured in the Scheduler tool, are used to run [builds](/docs/foundry/data-integration/builds/) on a recurring basis to keep data flowing through Foundry consistently.

Schedules should be set up to meet your Organization's requirements, but to optimize Foundry usage it is imperative that schedules are set up efficiently and not running more than necessary. For example, if you set up a schedule for a dataset to refresh at 8 AM every day, but do not actually need updated data at 8 AM every day - your Organization is wasting Foundry usage. Instead, you set your schedule for however frequently you need updated data, for example, every other day at 8 AM. Making this adjustment would halve the amount of Foundry usage.

The two biggest themes to keep in mind when thinking about [best practices](/docs/foundry/building-pipelines/scheduling-best-practices/#scheduling-best-practices) for optimizing schedules are 1) eliminating duplicate schedules and 2) eliminating unnecessary schedules.

### Eliminating duplicate schedules

To identify redundant schedules, start by going into the [Data Lineage](/docs/foundry/data-lineage/overview/) application and changing the node color to `Schedule Count`. If select nodes have more than one schedule associated with them, select the node and view the **Manage schedule** tool. There, you will be able to view the associated schedules, determine who owns them, and whether they can be consolidated.

**The best practice is to ensure each dataset in your pipeline only has one scheduled build associated with it.** Having a dataset built by two different schedules can lead to queuing and a slow-down on both schedules and wasteful batch compute.

Another best practice to reduce redundant schedules, is to avoid full builds and use connecting builds instead. One example is an Ontology pipeline that includes a raw dataset, cleaned dataset, data transforms, and then ultimately ending with an Ontology. Instead of having three schedules set up, one to run on the raw dataset, the second to run the cleaned dataset, and the third to run on the transformed dataset, you only need one schedule where the raw dataset is the trigger and the Ontology dataset is the target.

### Eliminating unnecessary schedules

To identify unnecessary schedules, go into the Data Lineage application and color the nodes by `Time since last built`. This allows you to view what data is being updated most frequently and determine whether this is the most optimal frequency for your Organization.

The **frequency & timing** of schedules is a critical factor in optimizing usage. How frequently does your Organization need data updated?

* If you have a schedule set to daily, consider whether you need updated data on the weekends. If you do not, changing the schedule to only update Monday to Friday could save nearly 30% of Foundry batch compute usage for that pipeline or dataset.
* If you have a schedule set to run three time a day, is your Organization using the refreshed data 3 times a day or is once overnight sufficient?
* Is a time-based trigger needed or will a condition-based trigger work? Do you need to schedule the pipeline to refresh every day at 2 AM or can it refresh only when a certain input dataset refreshes? Event-based triggers tend to be more efficient and save more usage than time-based triggers.

Additionally, it is best to not try and schedule builds all at the same time to ensure debugging will be more efficient and use less compute. When thinking about frequency and timing, it is important to orient back to your Organization's requirement and ensure the refresh rate you are setting complies with what your Organization needs, but not exceeding it.

Lastly, it is important to look at the **Advanced options** when setting up a schedule. Consider enforcing **Abort build on failure** to reduce wasted batch compute. You can also **update the number of allowed attempts for failed jobs** to three or lower, compared to the maximum of 5 attempts. It is also recommended to set the minutes between rebuilds to at least one to three minutes to give time for any glitches that caused the failure to resolve themselves.

## Step 7: Optimize Spark

[Spark](/docs/foundry/code-workbook/transforms-spark/) is an open-source, distributed cluster-computing framework for quick, large-scale data processing and analytics. Spark makes it easier and quicker for computers to process a lot of data or analytics by splitting up the work between different systems and tackling them in parallel instead of waiting for everything to be completed linearly.

As an initial disclaimer, and as a general best practice when it comes to optimization, we recommend that you manually tweak Spark configurations only if a particular bottleneck is identified, and not as a general practice on the entire platform. This is because new optimization features are progressively added and enabled on Foundry for transforms which do not have manual overrides. A simple example is the introduction of dynamic allocation on Spark 3. While it was previously very important to manually set the number of executors for a transform, nowadays this number is automatically adjusted at execution time to avoid waste.

:::callout{theme="neutral"}
Optimizing Spark should only be done by users who are familiar with Spark concepts and have a strong understanding of how it is used within a pipeline.
:::

A first step to optimizing Spark is reviewing and understanding Spark profiles. A [“Spark profile”](/docs/foundry/code-repositories/spark-profiles/#spark-profiles) is the configuration that Foundry uses to configure distributed compute resources (such as drivers and executors) with the appropriate amount of CPU cores and memory. Most of the time, we recommend using automatic profiles rather than attempting to tweak manually; however, sometimes you may be able to identify the use of a large driver that is not necessary.

You can use the Spark usage coloring on Data Lineage to identify datasets that may be using higher profiles.

Below are some core [Spark concepts](/docs/foundry/optimizing-pipelines/spark-concepts/#spark-concepts) and terminology to understand before starting to optimize.

* **Driver cores:** Controls how many CPU cores are assigned to a Spark driver.
* **Driver memory (JVM, not off-heap):** Controls how much memory is assigned to the Spark driver.
* **Executor cores:** Controls how many CPU cores are assigned to each Spark executor which in turn controls how many tasks are run concurrently in each executor.
* **Executor memory:** Controls how much memory is assigned to each Spark executor and shared among all tasks it is running.
* **Number of executors:** Controls how many executors are requested to run the job.

Beyond Spark profiles, the following best practices provide a starting point when looking to optimize Spark for the purpose of reducing Foundry usage.

* Help Spark's query optimizer by reducing the data early in your code.
  * Order matters - Re-order operations so that any filtering of the data is done in earlier stages.
  * Drop what you do not need - if you wait to drop the data you do not need until the end, this will take up Spark processing power and time.
* Be aware and minimize the data exchange between executors, also called “shuffling”.
* Be aware and minimize the use of Spark actions (such as `count`, `collect`, `take`). Unlike transformations (such as `filter`, `select`) which are lazily executed, actions put constraints on the computation graph and prevent potential optimizations.
* Be aware of the differences between repartition (shuffle and re-organize all the data) and coalesce (merge existing partitions).
* Be aware and watch out for skewness. Many techniques exist to resolve skewness, amongst which is the use of Broadcast join (if the left dataset is small enough) or the technique of “join salting”.
* Be aware and maximize the parallelism of your job. The **Spark details** interface provides a view on the execution parallelism at each step. Note that if you are using Spark dynamic executor allocation (enabled by default), unnecessary executors will automatically be scaled down when possible, avoiding any waste.
* Be aware of the overhead of starting a Spark task (viewable in the **Spark Details** interface in Foundry). A large amount of tiny tasks will lead to overhead and unnecessary data exchange. As a rule of thumb, 30 s to 60 s is a decent number (to be put in perspective to the total time of the stage).

If you are trying to decide between multiple single output transforms versus multi-output transforms in your workflow, review our guide on [Optimize multi-output transforms.](/docs/foundry/transforms-common/optimize-multi-output-transforms/)
