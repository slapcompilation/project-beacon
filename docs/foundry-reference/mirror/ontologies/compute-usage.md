<!-- source: https://palantir.com/docs/foundry/ontologies/compute-usage/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Compute usage: Ontology indexing

Foundry’s Ontology stores objects in an Ontology index, a storage format optimized for rapid access. Data in Foundry datasets can be of any size or format, meaning a data transformation is required to prepare dataset data for storage in an Ontology index. This process is known as *Ontology indexing* and can be applied to datasets and objects of arbitrary size. The processing cost of Ontology indexing is measured compute-seconds. This documentation describes how Ontology indexing uses compute as well as how to manage compute usage.

## Measuring compute usage from Ontology indexing

Ontology Indexing uses a parallelized Spark backend to read arbitrarily large sets of data and transform them into the Ontology format. The amount of compute that is used to run an indexing job is based on the amount of computational resources (driver and executors) and the total wall-clock duration of the indexing job itself.

For more information on how Spark usage translates to compute-seconds, see the main [Usage Types](/docs/foundry/resource-management/usage-types/) documentation. Below, you can find [examples of the calculations for compute-seconds used by Ontology Indexing](#example-indexing-compute-calculation).

## Investigating usage from Ontology Indexing

Ontology indexing jobs are exposed in Foundry’s Builds application and are attached to the object that is being indexed. Ontology indexing jobs are Spark jobs and so are classified as parallelized batch compute; thus, Ontology indexing jobs can be measured in the same way as other jobs on the same backend, such as Code Repositories transforms and Contour queries.

Indexing jobs can be categorized based on how they are triggered.

* *Ontology indexing jobs* index datasets into the Ontology backend. This compute is used to produce indexed objects from datasets.
* *Ontology export jobs* persist edits made directly in the Ontology to datasets in the Foundry transformation framework. These jobs tend to be smaller than full indexing jobs as ontology export jobs are generally dealing with edits, which are strict subsets of the total object set.

## Drivers of usage for Ontology indexing

Ontology indexing jobs must read all of the data that needs to be indexed and transform it into a format that the Ontology backend can store, search, and edit quickly.

Compute usage when reading and indexing data is driven by the following factors:

* **Number of records per object**
  * The number of objects increases as the number of records in the dataset being indexed increases. Each object requires a certain number of computational operations for indexing, so increasing the number of objects increases the amount of compute used for indexing.
* **Number of properties per object**
  * Each property of each object must be individually analyzed by the indexing job and then written into the object index. More compute is used if there are more properties to analyze and index.
* **Size of each property**
  * Some properties are much larger than others. For instance, a text property containing a lot of content will require more space and compute to analyze than a simple number property. Objects with larger, more complex property types will require more compute to index.

Indexing frequency also plays a large role in how much compute is used for Ontology updates. Schedules set on upstream datasets will trigger auto-reindexes of objects. When examining the usage implications of keeping an object up-to-date, consider the update schedules on that object and its upstream datasets.

## Managing Ontology indexing compute

Ontology indexing jobs can be optimized to reduce compute usage. The first and simplest method of optimization is to reduce the size of the input data for the index, which decreases the amount of work needed to complete the job. This involves doing the following where possible:

* Managing the number of input records
* Managing the number of properties per object
* Managing the size of each property per object

Another optimization method is configuring Ontology index jobs to use changelog strategies for indexing. Changelog indexing significantly reduces the number of objects that need to be created or updated per indexing job by comparing the job against existing objects prior to execution. Changelog indexing requires more configuration and adherence to an update strategy, but can produce orders-of-magnitude performance and efficiency gains.

## Example indexing compute calculation

Indexing jobs take the form of parallelized Spark jobs and can be seen in the Builds application. See the following example for an indexing job. Note that Ontology indexing jobs will automatically choose the size of the driver and executors for the indexing job, depending on the size of the job.

```
Driver:
    num_vcpu: 1
    GiB_RAM: 6
Executors:
    num_vcpu: 1
    GiB_RAM: 4
    num_executors: 2
Total Runtime: 10 seconds

Calculation: 

driver_compute_seconds = max(num_vcpu, GiB_RAM / 7.5) * runtime_in_seconds
                       = max(1vcpu, 6GiB / 7.5) * 10sec
                       = 1 * 10 = 10 compute-seconds

executor_compute_seconds = max(num_vcpu, GiB_RAM / 7.5) * num_executors * runtime_in_seconds
                         = max(1vcpu, 4GiB / 7.5) * 2executors * 10sec
                         = 1 * 2 * 10 = 20 compute-seconds

total_compute_seconds = driver_commpute_seconds + exeucutor_compute_seconds
                      = 10 compute-seconds + 20 compute-seconds
                      = 30 compute-seconds

```
