<!-- source: https://palantir.com/docs/foundry/ontology-sdk-react-applications/useadmin-tsx/ · mirrored 2026-08-16 from Palantir Foundry docs -->

# useAdmin reference

[Learn more about the `useAdmin` hook.](/docs/foundry/ontology-sdk-react-applications/useadmin-hook/)

```tsx
/*
 * Copyright 2025 Palantir Technologies, Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import useSWR, { mutate, useSWRConfig } from "swr";
import type { State } from "swr";
import { useOsdkClient } from "@osdk/react";
import { getCurrent, profilePicture, getBatch } from "@osdk/foundry.admin/User";
import { useCallback } from "react";
import type { User } from "@osdk/foundry.admin";

interface UserDetails {
  [key: string]: User;
}

function useAdmin() {
  const client = useOsdkClient();
  const { cache } = useSWRConfig();

  const getCurrentUserDetails = useCallback(
    async () => {
      const user: User = await getCurrent(client);
      return {
        "currentUser": user
      };
    }, [client]
  );
  const getCurrentProfilePictureUrl: (user: User) => Promise<string> =
    useCallback(
      async (user) => {
        const profilePictureResponse = await profilePicture(client, user.id)
        const blob = await profilePictureResponse.blob();
        return URL.createObjectURL(blob);
      }, [client]
    );

  const { data, isLoading, isValidating, error } = useSWR<UserDetails>(
    "currentUser",
    getCurrentUserDetails,
    { revalidateOnFocus: false }
  );

  const getBatchUserDetails: (userIds: string[]) => Promise<UserDetails> =
    useCallback(async (userIds) => {
        const cachedUsers: UserDetails = {};
        const usersToFetch: string[] = [];

        userIds.forEach((userId) => {
          const cachedUser: State<unknown, unknown> | undefined = cache.get(`user-${userId}`);
          if (cachedUser && cachedUser.data) {
            cachedUsers[userId] = cachedUser.data as User;
          } else {
            usersToFetch.push(userId);
          }
        });

        if (usersToFetch.length > 0) {
          const usersRequest = await getBatch(client, usersToFetch.map((userId) => ({ userId })));
          Object.entries(usersRequest.data).forEach(([userId, user]) => {
            cachedUsers[userId] = user;
            mutate(`user-${userId}`, user, { revalidate: false });
          });
        }
        return cachedUsers;
      }, [cache, client]
    );

  return {
    users: data,
    currentUser: data != null ? data["currentUser"]: undefined,
    isLoading,
    isValidating,
    isError: error,
    getBatchUserDetails,
    getCurrentProfilePictureUrl
  };
}

export default useAdmin;
```
