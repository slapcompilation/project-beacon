<!-- source: https://palantir.com/docs/foundry/questions-answers/functions/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Functions

### How do you create and implement a many-to-many link within a function in Foundry?

After configuring your link type in the Ontology Manager to be many-to-many, you can use the `.add()` method on your link property type to add all instances of the linked object type that should be associated with the new object.

*Timestamp:* March 18, 2024

### Why can't a 'searchAround' type ID be resolved for an object set when triggering function-backed Actions from a pipeline using the API and an OAuth token?

The third-party application token must be given access to all the object types and backing datasets used for 'searchArounds'. Additionally, the projects of the 'searchAround' object types should also be added to the application scope.

*Timestamp:* March 11, 2024

### In functions, is `Timestamp.now()` always in UTC? Can it be in another (local) timezone?

It is always in UTC.

*Timestamp:* February 29, 2024

### Is it possible to see all the places where a given function is being used to ensure it can be safely deleted?

There is no single way to ensure a function isn't used anywhere in the platform. The best available option is to check the usage history in Ontology Manager. However, dependencies that have not executed the function in a very long time, or at all, may not be revealed by checking usage history.

*Timestamp:* April 10, 2024

### How can I handle a large number of `Promises` in parallel without causing timeouts in my function?

To handle a large number of `Promises` in parallel without causing timeouts, you should:

1. Use asynchronous link traversal APIs (`getAsync()` and `allAsync()`) for parallel link loading.
2. Analyze and identify performance issues using the **Performance** tab after a function is run.
3. Avoid unnecessary nested loops.

Additionally, consider that there are [enforced limits on function execution](/docs/foundry/functions/manage-functions/#enforced-limits) and a maximum of 10 concurrent fetches for limiting load on downstream services, except for link loading which is batched under the hood.

*Timestamp:* April 25, 2024

### Is it possible to create an object and access its `rid` within the same function?

The `rid` is assigned to objects when they are created, either from indexing a backing dataset or as part of an action, but not immediately within the function where the object is created. The changes to objects and links, including the assignment of `rid`, are propagated after the function has finished executing.

*Timestamp:* April 16, 2024

### Is there a way to access the executing user's ID in a function without passing it as a parameter?

No, there is no way to get the executing user's ID within a function without passing it as a parameter.

*Timestamp:* April 16, 2024

### Can you write functions on objects that are created on an Ontology branch?

You can currently only write functions on objects on the master branch.

*Timestamp:* April 16, 2024

### Is it possible to delete a function from Ontology Manager?

The following options are available to manage the visibility of functions:

* Hide/unhide a function: Consumers of the function will not be broken
* Hard delete all versions of a function: Consumers of any version will be broken.

To hide or delete a function, carry out the following steps in the code repository that contains the source of the function:

* 1. Open the code repository.
* 2. Go to the **Functions** tab at the bottom.
* 3. Select the function you want to hard delete or hide.
* 4. Open settings, located at the top right, and then either select the **Hide function** or **Delete function** option.

*Timestamp:* July 10, 2024

### Is there support for streaming responses from LLM queries in Ontology functions?

No, there is currently no support for streaming responses from LLM queries in Ontology functions, but the feature is actively being worked on.

*Timestamp:* June 17, 2024

### How can I filter an object type using a string array containing the object RIDs?

You can use the `Objects.search().objectType([rid1, rid2,...])` method to directly filter the object type with object RIDs.

*Timestamp:* December 20, 2024
