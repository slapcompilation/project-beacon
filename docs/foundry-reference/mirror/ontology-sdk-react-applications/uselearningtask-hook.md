<!-- source: https://palantir.com/docs/foundry/ontology-sdk-react-applications/uselearningtask-hook/ · mirrored 2026-08-16 from Palantir Foundry docs -->

# useLearningTask hook

The `useLearningTask` hook is a custom React hook that provides functionality for fetching and managing learning task data in the advanced to-do application. It enriches basic task data with user information, media content, and metadata.

This hook uses patterns for handling different media types and binary content, showcasing error handling with `Result` types and resource management for blob URLs. It integrates seamlessly with the application's ontology while providing a clean interface for components.

[View the `useLearningTask` reference code.](/docs/foundry/ontology-sdk-react-applications/uselearningtask-tsx/)

## Key functions

* Uses React's `useCallback` for memoizing functions to prevent unnecessary re-renders
* Leverages SWR's (stale-while-revalidate) caching with custom revalidation options to optimize performance
* Implements blob URL management for binary media content
* Provides smart media type detection from MIME types
* Handles multiple content delivery mechanisms (embedded and linked)
* Uses Result types for robust error handling
* Efficiently retrieves user data with batch requests through `useAdmin`
* Employs Lodash utilities for array manipulation and null/undefined handling

## `useLearningTask` structure

### Interface definition

```typescript
interface LearningTaskEnriched {
  osdkLearningTask: osdkLearningTask.OsdkInstance;
  mediaUrl: string;
  createdBy: User;
  assignedTo: User;
  mediaType: MediaType;
}
```

This interface combines the SDK's learning task instance with user objects, a URL for the media content, and the detected media type to create a comprehensive data structure for components.

### Data fetching

The `useLearningTask` hook uses SWR data fetching capabilities with a custom fetcher function that does the following:

1. Queries for the specific learning task using `fetchOneWithErrors` for robust error handling
2. Processes media content based on the task configuration:

* If `mediaReference` exists, fetches binary content and creates a blob URL
* If `contentUrl` exists, uses it as an external link
* Handles cases where no media is available

3. Determines the media type using MIME type detection
4. Fetches user details for the task's creator and assignee through a batch request
5. Combines all data into the `LearningTaskEnriched` structure

```typescript
const fetcher = useCallback(async () => {
    const learningTaskResult = await client(osdkLearningTask).fetchOneWithErrors(task.osdkTask.$primaryKey as string);
    // Error handling and data processing
    // ...
    return learningTaskEnriched;
}, [client, task.osdkTask.$primaryKey, getBatchUserDetails]);
```

### Media type detection

The hook includes a helper function for determining media types from MIME types:

```typescript
const getMediaTypeFromMimeType = (mimeType: string): SupportedMediaType => {
    if (/application\/pdf/.test(mimeType)) {
        return SupportedMediaType.PDF;
    } else if (/image\/(jpeg|png|gif)/.test(mimeType)) {
        return SupportedMediaType.IMAGE;
    }
    // ...other type detection
};
```

This utility uses regular expressions to match MIME types against common media formats, providing a consistent way to categorize different types of learning content.

### Return value

The `useLearningTask` hook returns an object with the following structure:

```typescript
{
  learningTask: LearningTaskEnriched | undefined;  // The enriched learning task (undefined if not loaded)
  isLoading: boolean;                               // True during initial data loading
  isValidating: boolean;                            // True during background revalidation
  isError: any;                                     // Error object if the request failed
  metadata: ObjectMetadata | undefined;             // Metadata about the learning task object type
}
```

## Implementation

### Media type enumeration

The `useLearningTask` hook defines a string literal union type for different types of media:

```typescript
export const SupportedMediaType = {
    PDF: "PDF",
    IMAGE: "IMAGE",
    LINK: "LINK",
    VIDEO: "VIDEO",
    NONE: "NONE"
} as const;

export type SupportedMediaType = typeof SupportedMediaType[keyof typeof SupportedMediaType];

```

### Result type pattern

The hook uses the `Result` type from the OSDK for error handling:

```typescript
const learningTaskResult: Result<Osdk.Instance<osdkLearningTask>> = 
    await client(osdkLearningTask).fetchOneWithErrors(task.osdkTask.$primaryKey as string);

if (learningTaskResult.error) {
    throw new Error(learningTaskResult.error.message);
}
const learningTask = learningTaskResult.value;
```

This pattern does the following:

1. Captures both success and error states in a single return value
2. Enables explicit error checking before accessing data
3. Provides structured error information for better error handling
4. Creates a more robust approach than traditional try/catch

### Blob URL management

The hook manages blob URLs for media content:

```typescript
const response = await learningTask.mediaReference.fetchContents();
const blob: Blob | undefined = await response.blob();
const mediaUrl = blob ? URL.createObjectURL(blob) : "";
```

This pattern does the following:

1. Fetches binary content as a Response object
2. Converts the response to a blob
3. Creates a temporary URL for the blob to be used in media elements
4. Properly handles edge cases where the blob might be undefined

## External packages

The following external packages can be used with the `useLearningTask` hook.

### useSWR

**Purpose:** Data fetching, caching, and state management
**Benefits:**

* Provides an elegant way to fetch and cache learning task data
* Handles loading and error states automatically
* Offers built-in revalidation strategies
* Optimizes performance with configurable revalidation settings
* Reduces network requests with intelligent caching

### @osdk/client & @osdk/react

**Purpose:** Ontology SDK client for interacting with a backend data service
**Benefits:**

* Provides type-safe interfaces for data models
* Enables structured data queries with Result types for proper error handling
* Supports media content retrieval and metadata access
* Offers utilities to fetch object type metadata
* Exposes hooks like `useOsdkClient` for accessing the client instance

### @advanced-to-do-application/sdk

**Purpose:** Application-specific SDK with predefined data types
**Benefits:**

* Contains the data model specific to learning tasks (`osdkLearningTask`)
* Provides typed access to learning task properties and media references
* Enables consistent type enforcement across the application
* Supports the application's ontology model

### lodash

**Purpose:** Utility library for common operations
**Benefits:**

* Provides `_.uniq` and `_.compact` for array manipulation
* Enables efficient filtering of unique user IDs
* Simplifies null/undefined handling in array operations
* Reduces boilerplate code for data manipulation

## Usage example

```tsx
import useLearningTask, { SupportedMediaType } from '../dataServices/useLearningTask';

function LearningTaskViewer({ task }) {
  const { learningTask, isLoading, isError, metadata } = useLearningTask(task);
  
  if (isLoading) return <div>Loading learning materials...</div>;
  if (isError) return <div>Error loading content: {isError.message}</div>;
  if (!learningTask) return <div>No learning content available</div>;
  
  // Render different media types appropriately
  const renderMedia = () => {
    switch (learningTask.mediaType) {
      case SupportedMediaType.PDF:
        return (
          <div className="pdf-viewer">
            <iframe 
              src={`${learningTask.mediaUrl}#toolbar=0`} 
              title="PDF Content"
              width="100%" 
              height="500px"
            />
          </div>
        );
      case SupportedMediaType.IMAGE:
        return (
          <div className="image-viewer">
            <img 
              src={learningTask.mediaUrl} 
              alt="Learning content" 
              className="learning-image"
            />
          </div>
        );
      case SupportedMediaType.VIDEO:
        return (
          <div className="video-player">
            <video 
              src={learningTask.mediaUrl} 
              controls 
              width="100%"
            />
          </div>
        );
      case SupportedMediaType.LINK:
        return (
          <div className="external-link">
            <a 
              href={learningTask.mediaUrl} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Open learning resource
            </a>
          </div>
        );
      default:
        return <div>No media content available</div>;
    }
  };
  
  return (
    <div className="learning-task-viewer">
      <h2>{learningTask.osdkLearningTask.title}</h2>
      
      <div className="content-section">
        <div className="content-type-badge">{learningTask.mediaType}</div>
        {renderMedia()}
      </div>
      
      <div className="description-section">
        <h3>Description</h3>
        <p>{learningTask.osdkLearningTask.description || "No description provided"}</p>
      </div>
      
      <div className="people-section">
        <div className="assigned-to">
          <span>Assigned to: </span>
          <span>{learningTask.assignedTo?.displayName || "Unassigned"}</span>
        </div>
        <div className="created-by">
          <span>Created by: </span>
          <span>{learningTask.createdBy?.displayName || "Unknown"}</span>
        </div>
      </div>
    </div>
  );
}
```

## Edge cases and limitations

Consider the following scenarios and limitations before using the `useLearningTask` hook:

* **Memory management:** The hook creates blob URLs but does not currently implement cleanup. In a production application, you should release these URLs with `URL.revokeObjectURL()` when they are no longer needed to prevent memory leaks.
* **Media type detection:** The media type detection is based on MIME types and may not cover all possible formats. The default fallback is `NONE`, which might not be appropriate for some specialized media formats.
* **Error handling for media:** While the hook handles errors for task fetching, it does not have specific error handling for media content retrieval or processing. This could lead to unhandled exceptions if media loading fails.
* **Network dependencies:** The hook makes multiple network requests (task data, user data, media content) that depend on each other. In poor network conditions, this could lead to cascading failures or timeouts.
* **Large media files:** For large media files, the approach of loading the entire blob into memory might cause performance issues. Consider implementing streaming or progressive loading for large files.
* **Browser compatibility:** Blob URL support and media playback capabilities vary across browsers. Additional fallback strategies might be needed for full cross-browser compatibility.
* **No caching strategy for media:** While SWR caches task data, there is no specific caching strategy for the media content itself. Implementing a dedicated caching mechanism for media blobs could improve performance.
