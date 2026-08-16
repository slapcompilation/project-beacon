<!-- source: https://palantir.com/docs/foundry/ontology-sdk-react-applications/useadmin-hook/ · mirrored 2026-08-16 from Palantir Foundry docs -->

# useAdmin hook

The `useAdmin` hook is a custom React hook that provides functionality for interacting with user data from the Foundry Admin API. It centralizes user-related operations such as retrieving the current authenticated user, fetching multiple users in batch, and managing profile pictures.

This hook leverages SWR (stale-while-revalidate) for efficient data fetching and caching strategies, which helps optimize network requests and provides a consistent interface for user data across your application. By combining SWR with the Foundry Admin SDK, it creates a robust solution for user management that handles loading states, caching, and error handling automatically.

[View the `useAdmin` reference code.](/docs/foundry/ontology-sdk-react-applications/useadmin-tsx/)

## Key functions

* Uses React's `useCallback` for memoizing functions, preventing unnecessary re-renders and optimizing performance
* Implements an intelligent caching strategy with SWR to minimize API calls and improve application responsiveness
* Creates blob URLs for profile pictures, allowing efficient rendering of binary image data
* Handles empty user ID arrays gracefully by returning the current user as a fallback
* Supports batch fetching of users to reduce the number of API calls when multiple users need to be loaded
* Provides loading, validation, and error states for comprehensive UI feedback
* Uses TypeScript for strong typing of all data structures and function signatures

## `useAdmin` structure

### Interface definition

```typescript
interface UserDetails {
  [key: string]: User;
}
```

This interface defines a dictionary-type structure that maps string keys (user IDs) to `User` objects. This pattern enables the following:

* Fast O(1) lookups of users by ID
* Efficient storage of multiple user objects
* Easy aggregation of user data from multiple sources (cache and API)

### Data fetching

The `useAdmin` hook implements several data fetching strategies:

1. Current user fetching:

```typescript
const getCurrentUserDetails = useCallback(async () => {
  const user: User = await getCurrent(client);
  return { "currentUser": user };
}, [client]);
```

2. Profile picture fetching:

```typescript
const getCurrentProfilePictureUrl = useCallback(async (user) => {
  const profilePictureResponse = await profilePicture(client, user.id);
  const blob = await profilePictureResponse.blob();
  return URL.createObjectURL(blob);
}, [client]);
```

3. Batch user fetching with cache optimization.

### CRUD operations

1. Read (current user):
   * `getCurrentUserDetails`: Retrieves the currently authenticated user.
   * The primary SWR hook fetches and maintains current user state.
2. Read (profile picture):
   * `getCurrentProfilePictureUrl`: Gets a blob URL for a user's profile picture.
3. Read (multiple users):
   * `getBatchUserDetails`: Efficiently fetches multiple users with cache optimization.

Note that the `useAdmin` hook focuses on read operations; it does not implement create, update, or delete operations for user data.

### Return value

The `useAdmin` hook returns an object with the following structure:

```typescript
{
  users: UserDetails | undefined;         // Object containing all fetched users
  currentUser: User | undefined;          // The currently logged-in user
  isLoading: boolean;                     // Loading state for data fetching
  isValidating: boolean;                  // Whether data is being revalidated
  isError: Error | undefined;             // Error state if any
  getBatchUserDetails: (userIds: string[]) => Promise<UserDetails>; // Function to fetch multiple users
  getCurrentProfilePictureUrl: (user: User) => Promise<string>;     // Function to get a user's profile picture URL
}
```

## Implementation

### Cache-first data fetching strategy

The `useAdmin` hook implements a cache-first strategy for fetching user data:

```typescript
const getBatchUserDetails = useCallback(async (userIds) => {
  const cachedUser: UserDetails = {};
  const usersToFetch: string[] = [];
  
  // Check cache first for each requested user
  userIds.forEach((userId) => {
    const cachedUserState = cache.get(`user-${userId}`);
    if (cachedUserState && cachedUserState.data) {
      cachedUser[userId] = cachedUserState.data as User;
    } else {
      usersToFetch.push(userId);
    }
  });
  
  // Only fetch users not found in cache
  if (usersToFetch.length > 0) {
    const usersRequest = await getBatch(client, usersToFetch.map((userId) => ({ userId })));
    // Store results in cache for future use
    Object.entries(usersRequest.data).forEach(([userId, user]) => {
      cachedUser[userId] = user;
      mutate(`user-${userId}`, user, { revalidate: false });
    });
  }
  
  return cachedUser;
}, [cache, client, getCurrentUserDetails]);
```

This strategy improves performance with the following steps:

1. Checking if requested data exists in cache
2. Only fetching data that is not already available
3. Updating the cache with newly fetched data
4. Returning a combination of cached and freshly fetched data

### Blob URL creation pattern

The `useAdmin` implements a pattern for handling binary data (profile pictures) by converting API responses to blob URLs:

```typescript
const getCurrentProfilePictureUrl = useCallback(async (user) => {
  const profilePictureResponse = await profilePicture(client, user.id);
  const blob = await profilePictureResponse.blob();
  return URL.createObjectURL(blob);
}, [client]);
```

This pattern does the following:

1. Fetches binary data from the API
2. Converts the response to a blob object
3. Creates a temporary URL that can be used as an image source
4. Allows for efficient rendering of binary data in the UI

## External packages

The following external packages can be used with the `useAdmin` hook.

### @osdk/react (useOsdkClient)

**Purpose:** React hook for accessing the OSDK client instance
**Benefits:**

* Provides access to the authenticated client needed for all API calls
* Manages authentication context without requiring manual prop drilling
* Ensures consistent API access across the application
* Integrates with Foundry's authentication mechanisms

### @osdk/foundry.admin

**Purpose:** Foundry Admin SDK for interacting with user-related services.
**Benefits:**

* Provides type-safe interfaces for user data with the `User` type
* Includes specialized functions for user operations (`getCurrent`, `profilePicture`, `getBatch`)
* Abstracts away complex API interactions into simple function calls
* Ensures compatibility with Foundry's backend services and data models

### SWR: useSWR, mutate, useSWRConfig

**Purpose:** Data fetching, caching, and state management library
**Benefits:**

* Provides an elegant way to fetch, cache, and revalidate data with a simple API
* Manages loading, error, and validation states automatically without additional code
* Implements optimistic UI updates and background revalidation strategies
  Offers a global cache that can be accessed and manipulated throughout the application
* Reduces unnecessary network requests through intelligent caching

## Usage example

```typescript
import useAdmin from '../dataServices/useAdmin';
import { useState, useEffect } from 'react';

// Example 1: Display current user information with profile picture
function UserProfile() {
  const { currentUser, isLoading, isError, getCurrentProfilePictureUrl } = useAdmin();
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfilePic() {
      if (currentUser) {
        try {
          const url = await getCurrentProfilePictureUrl(currentUser);
          setProfilePicUrl(url);
        } catch (error) {
          console.error("Failed to load profile picture", error);
        }
      }
    }
    
    loadProfilePic();
  }, [currentUser, getCurrentProfilePictureUrl]);

  if (isLoading) return <div>Loading user information...</div>;
  if (isError) return <div>Error loading user information</div>;
  if (!currentUser) return <div>No user found</div>;
  
  return (
    <div className="user-profile">
      {profilePicUrl && <img src={profilePicUrl} alt="Profile" className="profile-pic" />}
      <h1>{currentUser.displayName}</h1>
      <p>Email: {currentUser.email}</p>
      <p>User ID: {currentUser.id}</p>
    </div>
  );
}

// Example 2: Display a list of collaborators
function CollaboratorsList({ userIds }) {
  const { getBatchUserDetails, isLoading } = useAdmin();
  const [users, setUsers] = useState({});
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchUsers() {
      if (userIds.length > 0) {
        try {
          const fetchedUsers = await getBatchUserDetails(userIds);
          setUsers(fetchedUsers);
        } catch (err) {
          setError(err);
        }
      }
    }
    
    fetchUsers();
  }, [userIds, getBatchUserDetails]);
  
  if (isLoading) return <div>Loading collaborators...</div>;
  if (error) return <div>Error loading collaborators</div>;
  
  return (
    <div className="collaborators">
      <h2>Project Collaborators</h2>
      <ul>
        {Object.entries(users).map(([userId, user]) => (
          <li key={userId} className="collaborator-item">
            <span className="name">{user.displayName}</span>
            <span className="email">{user.email}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Edge cases and limitations

Consider the following scenarios and limitations before using the `useAdmin` hook:

* **Profile picture memory management:** The hook creates blob URLs for profile pictures using `URL.createObjectURL()` but does not handle revoking these URLs. This could potentially lead to memory leaks if many profile pictures are loaded. Consumers should call `URL.revokeObjectURL()` when the URLs are no longer needed.
* **Race conditions:** When fetching multiple users in quick succession, there is potential for race conditions where newer requests complete before older ones. The hook does not implement request cancellation, so stale data might occasionally be displayed.
* **Error handling granularity:** The hook provides a single error state for the current user fetch but does not have detailed error handling for individual user fetches in the batch operation. Consumers need to implement their own error handling for batch operations.
* **Cache invalidation:** There is no explicit mechanism for invalidating stale user data. The hook relies on SWR's built-in revalidation strategies, which might not be sufficient for all use cases.
* **Limited user operations:** The hook focuses on reading user data but does not provide methods for updating or modifying user information. Applications requiring user management features would need additional hooks or extensions.
* **Empty user ID handling:** When `getBatchUserDetails` is called with an empty array, it returns the current user with an empty string key. While this prevents errors, it might not be the expected behavior in all contexts.
