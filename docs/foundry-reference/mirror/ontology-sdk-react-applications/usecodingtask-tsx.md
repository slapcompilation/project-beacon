<!-- source: https://palantir.com/docs/foundry/ontology-sdk-react-applications/usecodingtask-tsx/ · mirrored 2026-08-16 from Palantir Foundry docs -->

# useCodingTask reference

[Learn more about the `useCodingTask` hook.](/docs/foundry/ontology-sdk-react-applications/usecodingtask-hook/)

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

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { useOsdkClient } from "@osdk/react";
import { ITask } from "./useTasks";
import { osdkCodingTask } from "@advanced-to-do-application/sdk";
import type { User } from "@osdk/foundry.admin";
import type { ObjectMetadata } from "@osdk/client";

interface CodingTaskEnriched {
  osdkCodingTask: osdkCodingTask.OsdkInstance;
  createdBy: User;
  assignedTo: User;
}

function useCodingTask(task: ITask) {
    const client = useOsdkClient();
    const [metadata, setMetadata] = useState<ObjectMetadata>();

    // Define the fetcher using useCallback.
    const fetcher = useCallback(async () => {
        // We are using $as to pivot to the osdkCodingTask interface implementation.
        // Note that this is possible because we used `$includeAllBaseObjectProperties: true` when fetching the task in useTasks.
        const codingTask: osdkCodingTask.OsdkInstance = task.osdkTask.$as(osdkCodingTask);
        const codingTaskEnriched: CodingTaskEnriched = {
            osdkCodingTask: codingTask,
            createdBy: task.createdBy,
            assignedTo: task.assignedTo,
        };
        return codingTaskEnriched;
    }, [task]);

    // Only pass the fetcher if the data is not already cached.
    const { data, error, isValidating } = useSWR<CodingTaskEnriched>(
    task.osdkTask.$primaryKey as string,
    fetcher,
    {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
    }
    );

    // This shows how we read the object type metadata and use the property display name from the ontology.
    const getObjectTypeMetadata = useCallback(async () => {
        const objectTypeMetadata = await client.fetchMetadata(osdkCodingTask);
        setMetadata(objectTypeMetadata);
    }, [client]);

    useEffect(() => {
        getObjectTypeMetadata();
    }, [getObjectTypeMetadata]);


    return {
    codingTask: data,
    isLoading: !data && !error,
    isValidating,
    isError: error,
    metadata,
    };
}

export default useCodingTask;
```
