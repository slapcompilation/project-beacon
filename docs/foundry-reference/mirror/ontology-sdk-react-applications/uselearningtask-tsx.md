<!-- source: https://palantir.com/docs/foundry/ontology-sdk-react-applications/uselearningtask-tsx/ · mirrored 2026-08-16 from Palantir Foundry docs -->

# useLearningTask reference

[Learn more about the `useLearningTask` hook.](/docs/foundry/ontology-sdk-react-applications/uselearningtask-hook/)

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
import { osdkLearningTask } from "@advanced-to-do-application/sdk";
import useAdmin from "./useAdmin";
import type { ObjectMetadata, Osdk, Result } from "@osdk/client";
import type { User } from "@osdk/foundry.admin";

export const SupportedMediaType = {
    PDF: "PDF",
    IMAGE: "IMAGE",
    LINK: "LINK",
    VIDEO: "VIDEO",
    NONE: "NONE"
} as const;

export type SupportedMediaType = typeof SupportedMediaType[keyof typeof SupportedMediaType];
interface LearningTaskEnriched {
  osdkLearningTask: osdkLearningTask.OsdkInstance;
  mediaUrl: string;
  createdBy: User;
  assignedTo: User;
  mediaType: SupportedMediaType;
}

function useLearningTask(task: ITask) {
    const client = useOsdkClient();
    const [metadata, setMetadata] = useState<ObjectMetadata>();
    const { getBatchUserDetails } = useAdmin();

    // Define the fetcher using useCallback.
    const fetcher = useCallback(async () => {
        // Use fetch with error handling.
        const learningTaskResult: Result<Osdk.Instance<osdkLearningTask>> = await client(osdkLearningTask).fetchOneWithErrors(task.osdkTask.$primaryKey as string);
        if (learningTaskResult.error) {
            throw new Error(learningTaskResult.error.message);
        }
        const learningTask = learningTaskResult.value;
        const users = await getBatchUserDetails([learningTask.createdBy as string, learningTask.assignedTo as string]);
        if (!learningTask.mediaReference) {
            return {
                osdkLearningTask: learningTask,
                mediaUrl: learningTask.contentUrl ?? "",
                mediaType: learningTask.contentUrl != undefined ? SupportedMediaType.LINK : SupportedMediaType.NONE,
                createdBy: users[learningTask.createdBy as string],
                assignedTo: users[learningTask.assignedTo as string],
            };
        }
        const response = await learningTask.mediaReference.fetchContents();
        const blob: Blob | undefined = await response.blob();
        const mediaUrl = blob ? URL.createObjectURL(blob) : "";
        // Use the media metadata to figure out the type.
        const mediaTypeResp = await learningTask.mediaReference.fetchMetadata();
        const codingTaskEnriched: LearningTaskEnriched = {
            osdkLearningTask: learningTask,
            mediaUrl,
            mediaType: getMediaTypeFromMimeType(mediaTypeResp.mediaType),
            createdBy: users[learningTask.createdBy as string],
            assignedTo: users[learningTask.assignedTo as string],
        };
        return codingTaskEnriched;
    }, [getBatchUserDetails, task.osdkTask.$primaryKey, client]);

    // Only pass the fetcher if the data is not already cached.
    const { data, error, isValidating } = useSWR<LearningTaskEnriched>(
    task.osdkTask.$primaryKey as string,
    fetcher,
    {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
    }
    );

    // This shows how we read the object type metadata and use the property display name from the ontology.
    const getObjectTypeMetadata = useCallback(async () => {
        const objectTypeMetadata = await client.fetchMetadata(osdkLearningTask);
        setMetadata(objectTypeMetadata);
    }, [client]);

    useEffect(() => {
        getObjectTypeMetadata();
    }, [getObjectTypeMetadata]);


    return {
    learningTask: data,
    isLoading: !data && !error,
    isValidating,
    isError: error,
    metadata,
    };
}

export default useLearningTask;

const getMediaTypeFromMimeType = (mimeType: string): SupportedMediaType => {
    if (/application\/pdf/.test(mimeType)) {
        return SupportedMediaType.PDF;
    } else if (/image\/(jpeg|png|gif)/.test(mimeType)) {
        return SupportedMediaType.IMAGE;
    } else if (/video\/mp4/.test(mimeType)) {
        return SupportedMediaType.VIDEO;
    } else if (/text\/html/.test(mimeType)) {
        return SupportedMediaType.LINK;
    } else {
        return SupportedMediaType.NONE;
    }
};
```
