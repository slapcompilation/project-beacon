<!-- source: https://palantir.com/docs/foundry/ontology-sdk-react-applications/usetasks-tsx/ · mirrored 2026-08-16 from Palantir Foundry docs -->

# useTasks reference

[Learn more about the `useTasks` hook.](/docs/foundry/ontology-sdk-react-applications/usetasks-hook/)

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

import useSWR from "swr";
import { useOsdkClient } from "@osdk/react";
import { OsdkITask } from "@advanced-to-do-application/sdk";
import { IProject } from "./useProjects";
import { useCallback, useEffect, useState } from "react";
import useAdmin from "./useAdmin";
import _ from "lodash";
import type { User } from "@osdk/foundry.admin";
import type { InterfaceMetadata } from "@osdk/api";

export interface ITask {
    osdkTask: OsdkITask.OsdkInstance;
    createdBy: User;
    assignedTo: User;
}

function useTasks(project: IProject) {
    const client = useOsdkClient();
    const [metadata, setMetadata] = useState<InterfaceMetadata>();
    const { getBatchUserDetails } = useAdmin();
    // `$includeAllBaseObjectProperties: true,` means that although we are fetching the object through its interface implementation,
    // we are still going to get all the base object properties; when we pivot to the base object using $as, we don not need to fetch them again.
    const fetcher = useCallback(async () => {
        const tasksPage = await client(OsdkITask).where({
            projectId: { $eq: project.$primaryKey },
        }).fetchPage({
            $includeAllBaseObjectProperties: true,
            $orderBy: { "dueDate": "desc", "status": "asc" },
        });
        // Get the user details for the createdBy field.
        const createdByIds = _.uniq(tasksPage.data.map((task) => task.createdBy as string));
        const createdByUserList = await getBatchUserDetails(createdByIds);
        // Get the user details for the assignedTo field.
        const assignedToIds = _.uniq(tasksPage.data.map((task) => task.assignedTo as string));
        const assignedToUserList = await getBatchUserDetails(assignedToIds);
        const tasksList: ITask[] = tasksPage.data.map((task) => ({
            osdkTask: task,
            assignedTo: assignedToUserList[task.assignedTo as string],
            createdBy: createdByUserList[task.createdBy as string],
            }));
      return tasksList;
    } , [getBatchUserDetails, project.$primaryKey, client]);

  const { data, isLoading, isValidating, error, mutate } = useSWR<ITask[]>(
    ["tasks",project.$primaryKey],
    fetcher,
    { revalidateOnFocus: false }
  );

  // This shows how we read the object type metadata and use the property display name from the ontology.
  const getObjectTypeMetadata = useCallback(async () => {
    const objectTypeMetadata = await client.fetchMetadata(OsdkITask);
    setMetadata(objectTypeMetadata);
    } , [client]);

    useEffect(() => {
        getObjectTypeMetadata();
    }, [getObjectTypeMetadata]);


    useEffect(() => {
        // Subscribe to the object set to get real-time updates.
        const subscription = client(OsdkITask)
            .where({
                projectId: { $eq: project.$primaryKey },
            })
            .subscribe(
                {
                    onChange(update) {
                        if (update.state === "ADDED_OR_UPDATED") {
                            // An object has received an update or an object was added to the object set.
                            const currentObject = data?.find((task) => task.osdkTask.$primaryKey === update.object.$primaryKey);
                            if (currentObject !== undefined) {
                                // Get the user details for the createdBy field and the assignedTo field.
                                getBatchUserDetails([update.object.createdBy as string, update.object.assignedTo as string]).then((userList) => {
                                    const updatedObject: ITask = {
                                        osdkTask: update.object,
                                        assignedTo: userList[update.object.assignedTo as string],
                                        createdBy: userList[update.object.createdBy as string],
                                    };
                                    // Replace the object in date with the new one to mutate without fetching.
                                    mutate((currentData: ITask[] | undefined) => {
                                        if (!currentData) return [];
                                        return currentData.map((task) => task.osdkTask.$primaryKey === update.object.$primaryKey ? updatedObject : task);
                                    }, { revalidate: false });
                                });
                            }
                        }
                        else if (update.state === "REMOVED") {
                            // remove the object from the data mutate without fetching.
                            mutate((currentData: ITask[] | undefined) => {
                                if (!currentData) return [];
                                return currentData.filter((task) => task.osdkTask.$primaryKey !== update.object.$primaryKey);
                            }, { revalidate: false });
                        }
                    },
                    onSuccessfulSubscription() {
                        // The subscription was successful and you can expect to receive updates.
                    },
                    onError(err) {
                        // There was an error with the subscription and you will not receive any more updates.
                        console.error(err);
                    },
                    onOutOfDate() {
                        // We could not keep track of all changes. Reload the objects in your set.
                    },
                },
            );

        return () => {
            subscription.unsubscribe();
        };
    },[data, getBatchUserDetails, mutate, project.$primaryKey, client]);

  return {
    tasks: data ?? [],
    isLoading,
    isValidating,
    isError: error,
    metadata,
  };
}

export default useTasks;
```
