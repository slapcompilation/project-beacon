<!-- source: https://palantir.com/docs/foundry/ontology-sdk-react-applications/usetasks-hook/ · mirrored 2026-08-16 from Palantir Foundry docs -->

# useTasks hook

The `useTasks` hook is a custom React hook that manages tasks associated with a specific project in the advanced to-do application. It leverages the Ontology SDK (OSDK) to fetch task data, associate it with user information, and provide real-time updates through subscriptions. This hook is designed to work with stale-while-revalidate (SWR) for efficient data fetching, caching, and state management.

This hook implements patterns for real-time data subscription, batch data retrieval, and efficient data enrichment with user information. By handling the complexity of data management internally, it provides components with a clean, easy-to-use interface for working with task data.

[View the `useTasks` reference code.](/docs/foundry/ontology-sdk-react-applications/usetasks-tsx/)

## Key functions

* **Optimized user data fetching:** Deduplicates and batches user ID requests to minimize API calls.
* **Real-time updates:** Implements OSDK subscriptions to keep task data in sync with the backend.
* **SWR integration:** Efficiently updates the local cache for both subscription events and manual fetches.
* **Error handling:** Provides robust error handling for both fetching and subscription operations.
* **Data enrichment:** Transforms raw OSDK objects into enriched data structures with user information.
* **Type safety:** Maintains strong typing throughout with TypeScript interfaces.
* **Sorting and filtering:** Applies server-side sorting to optimize data presentation.
* **Dependency management:** Properly handles dependencies in useCallback and useEffect hooks.

## `useTasks` structure

### Interface definition

```typescript
export interface ITask {
    osdkTask: OsdkITask.OsdkInstance;
    createdBy: User;
    assignedTo: User;
}
```

This interface does the following:

* Wraps the raw `OsdkITask.OsdkInstance` data with additional context
* Associates full `User` objects for both the creator and assignee
* Creates a unified data structure that is ready for display in the interface

### Data fetching

The `useTasks` hook employs a multi-step data retrieval strategy:

1. Fetch task data filtered by project ID:

   ```typescript
   const tasksPage = await client(OsdkITask).where({
       projectId: { $eq: project.$primaryKey },
   }).fetchPage({
       $orderBy: { "dueDate": "desc", "status": "asc" },
   });
   ```

2. Extract unique user IDs and fetch user details:

   ```typescript
   const createdByIds = _.uniq(tasksPage.data.map((task) => task.createdBy as string));
   const createdByUserList = await getBatchUserDetails(createdByIds);
   ```

3. Transform and combine the data:

   ```typescript
   const tasksList: ITask[] = tasksPage.data.map((task) => ({
       osdkTask: task,
       assignedTo: assignedToUserList[task.assignedTo as string],
       createdBy: createdByUserList[task.createdBy as string],
   }));
   ```

4. Cache and return the result through SWR:

   ```typescript
   const { data, isLoading, isValidating, error, mutate } = useSWR<ITask[]>(
     ["tasks", project.$primaryKey],
     fetcher,
     { revalidateOnFocus: false }
   );
   ```

### Metadata handling

The `useTasks` hook also fetches and provides metadata about the task object type:

```typescript
const getObjectTypeMetadata = useCallback(async () => {
  const objectTypeMetadata = await client.fetchMetadata(OsdkITask);
  setMetadata(objectTypeMetadata);
}, []);
```

This metadata can be used by interface components to access display names, descriptions, and other ontology information about the task type.

### Real-time update management

The subscription implementation handles three key update scenarios:

1. **Added or updated tasks:** Fetches user details and updates the cache.

   ```typescript
   if (update.state === "ADDED_OR_UPDATED") {
       // Fetch user details and update the task in the cache
   }
   ```

2. **Removed tasks:** Filters the removed task out of the cache.

   ```typescript
   else if (update.state === "REMOVED") {
       // Remove the task from the cache
   }
   ```

3. **Out-of-date notification:** Handles cases where the subscription cannot track all changes.

   ```typescript
   onOutOfDate() {
       // We could not keep track of all changes. Please reload the objects.
   }
   ```

The `useTasks` hook cleans up the subscription when the component unmounts:

```typescript
return () => {
    subscription.unsubscribe();
}
```

### Return value

The `useTasks` hook returns an object with the following structure:

```typescript
return {
  tasks: data ?? [],
  isLoading,
  isValidating,
  isError: error,
  metadata,
};
```

The hook returns the following:

* **`tasks`:** An array of task objects with associated user information.
* **`isLoading`:** A Boolean value indicating if the initial data fetch is in progress.
* **`isValidating`:** A Boolean value indicating if a background revalidation is happening.
* **`isError`:** Any error that occurred during data fetching.
* **`metadata`:** Object type metadata for interface customization.

## Implementation

### OSDK query building pattern

The `useTasks` hook implements the OSDK query building pattern for fetching tasks associated with a specific project:

```typescript
const tasksPage = await client(OsdkITask).where({
    projectId: { $eq: project.$primaryKey },
}).fetchPage({
    $includeAllBaseObjectProperties: true,
    $orderBy: { "dueDate": "desc", "status": "asc" }, 
});
```

This pattern does the following:

* Creates a query targeting the `OsdkITask` interface
* Filters tasks to only include those associated with the specified project
* Includes all base object properties with `$includeAllBaseObjectProperties: true`
* Orders results by due date (descending) and status (ascending)
* Returns a paginated result with the matching tasks

The `$includeAllBaseObjectProperties: true` option is particularly important as it ensures that when we later use `$as` to pivot to concrete implementations, all necessary data is already available.

### Batch user data fetching

The `useTasks` hook optimizes network requests by fetching user data in batches:

```typescript
const createdByIds = _.compact(_.uniq(tasksPage.data.map((task) => task.createdBy)));
const createdByUserList = await getBatchUserDetails(createdByIds);

const assignedToIds = _.compact(_.uniq(tasksPage.data.map((task) => task.assignedTo)));
const assignedToUserList = await getBatchUserDetails(assignedToIds);
```

This pattern does the following:

1. Extracts user IDs from all tasks using `map()`
2. Removes null/undefined values with `_.compact()`
3. Eliminates duplicates with `_.uniq()`
4. Fetches all user details in a single batch operation
5. Creates a lookup map of user information by ID

This optimization reduces the number of network requests from O(n) to O(1), where `n` is the number of tasks.

### Real-time data subscription

The hook implements the OSDK subscription mechanism to provide real-time updates to task data:

```typescript
const subscription = client(OsdkITask)
    .where({
        projectId: { $eq: project.$primaryKey },
    })
    .subscribe({
        onChange(update) {
            // Handle changes to the task set
        },
        onSuccessfulSubscription() {
            // Subscription successfully established
        },
        onError(err) {
            // Handle subscription errors
        },
        onOutOfDate() {
            // Handle out-of-date notifications
        },
    });
```

This pattern does the following:

* Creates a live subscription to task changes filtered by project
* Handles different update types (additions, updates, removals)
* Updates the local data cache through SWR's `mutate` function
* Provides comprehensive error handling and lifecycle management
* Cleans up the subscription when the component unmounts

The implementation uses SWR's `mutate` function to update the cache without triggering a network request:

```typescript
mutate((currentData: ITask[] | undefined) => {
    if (!currentData) return [];
    return currentData.map((task) => 
        task.osdkTask.$primaryKey === update.object.$primaryKey ? updatedObject : task
    );
}, { revalidate: false });
```

## External packages

The following external packages can be used with the `useTasks` hook.

### useSWR

**Purpose:** Data fetching, caching, and state management library
**Benefits:**

* Provides automatic caching of fetched task data
* Handles loading and error states for better UX
* Offers built-in mutation capabilities for real-time updates
* Reduces unnecessary network requests through smart revalidation strategies
* Simplifies complex data fetching workflows with a declarative API

### @osdk/react

**Purpose:** React bindings for the Ontology SDK
**Benefits:**

* Provides the `useOsdkClient` hook for accessing the OSDK client instance
* Ensures consistent client configuration across the application
* Handles authentication and session management automatically
* Enables type-safe access to backend services

### @advanced-to-do-application/sdk

* **Purpose:** Application-specific SDK with predefined OSDK types

* **Benefits:**

* Provides the `OsdkITask` interface representing the task data model

* Ensures type safety when working with task objects

* Enables OSDK query capabilities through the client

* Supports the application's ontology model with predefined types

### lodash

**Purpose:** Utility library with helper functions
**Benefits:**

* Used for `_.compact()` to remove null/undefined values from arrays
* Used for `_.uniq()` to deduplicate user IDs before batch fetching
* Improves performance by reducing redundant user detail requests
* Simplifies data transformation operations with functional utilities

## Usage example

```tsx
import React, { useState } from 'react';
import useTasks from '../dataServices/useTasks';
import { IProject } from '../dataServices/useProjects';

function TaskList({ project }: { project: IProject }) {
  const { tasks, isLoading, isError, metadata } = useTasks(project);
  const [filter, setFilter] = useState('ALL');
  
  if (isLoading) return <div>Loading tasks...</div>;
  if (isError) return <div>Error loading tasks: {isError.message}</div>;
  
  // Filter tasks based on the selected filter
  const filteredTasks = filter === 'ALL' 
    ? tasks 
    : tasks.filter(task => task.osdkTask.status === filter);
  
  return (
    <div className="task-list">
      <h2>Tasks for {project.name}</h2>
      
      <div className="filter-controls">
        <button 
          className={filter === 'ALL' ? 'active' : ''} 
          onClick={() => setFilter('ALL')}
        >
          All ({tasks.length})
        </button>
        <button 
          className={filter === 'COMPLETED' ? 'active' : ''} 
          onClick={() => setFilter('COMPLETED')}
        >
          Completed ({tasks.filter(t => t.osdkTask.status === 'COMPLETED').length})
        </button>
        <button 
          className={filter === 'IN PROGRESS' ? 'active' : ''} 
          onClick={() => setFilter('IN PROGRESS')}
        >
          In Progress ({tasks.filter(t => t.osdkTask.status === 'IN PROGRESS').length})
        </button>
      </div>
      
      <table className="task-table">
        <thead>
          <tr>
            <th>{metadata?.propertyMetadata?.title?.displayName || 'Title'}</th>
            <th>Status</th>
            <th>Due Date</th>
            <th>Assigned To</th>
            <th>Created By</th>
          </tr>
        </thead>
        <tbody>
          {filteredTasks.map((task) => (
            <tr key={task.osdkTask.$primaryKey}>
              <td>{task.osdkTask.title}</td>
              <td>
                <span className={`status-badge ${task.osdkTask.status.toLowerCase().replace(' ', '-')}`}>
                  {task.osdkTask.status}
                </span>
              </td>
              <td>
                {task.osdkTask.dueDate 
                  ? new Date(task.osdkTask.dueDate).toLocaleDateString() 
                  : 'Not set'}
              </td>
              <td>
                <div className="user-info">
                  {task.assignedTo?.photoUrl && (
                    <img 
                      src={task.assignedTo.photoUrl} 
                      alt={task.assignedTo.displayName} 
                      className="user-avatar" 
                    />
                  )}
                  <span>{task.assignedTo?.displayName || 'Unassigned'}</span>
                </div>
              </td>
              <td>
                <div className="user-info">
                  {task.createdBy?.photoUrl && (
                    <img 
                      src={task.createdBy.photoUrl} 
                      alt={task.createdBy.displayName} 
                      className="user-avatar" 
                    />
                  )}
                  <span>{task.createdBy?.displayName || 'Unknown'}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {filteredTasks.length === 0 && (
        <div className="empty-state">
          No {filter !== 'ALL' ? filter.toLowerCase() : ''} tasks found.
        </div>
      )}
    </div>
  );
}

export default TaskList;
```

## Edge cases and limitations

Consider the following scenarios and limitations when using the `useTasks` hook:

* **Subscription edge cases:** The subscription system handles additions, updates, and removals, but the "out-of-date" scenario only logs a message without taking corrective action.
* **User detail fallback:** When user details cannot be found for a task's creator or assignee, the hook defaults to using the current user. This might not always be appropriate and could lead to incorrect user attribution.
* **Error recovery:** While the hook logs fetch errors, it does not provide a mechanism for retrying failed fetches beyond SWR's built-in retry functionality.
* **Large dataset handling:** The current implementation fetches all tasks at once without pagination, which could cause performance issues with large projects.
* **Complex filtering:** All filtering happens client-side after fetching all tasks. For very large task sets, server-side filtering would be more efficient.
* **Subscription race conditions:** If multiple subscription events happen in quick succession, there is potential for race conditions when updating the cache.
* **Dependency on `currentUser`:** The hook depends on the current user being available but does not have a robust fallback if the admin module fails to load user information.
