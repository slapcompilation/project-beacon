<!-- source: https://palantir.com/docs/foundry/ontology-sdk-react-applications/useprojects-tsx/ · mirrored 2026-08-16 from Palantir Foundry docs -->

# useProjects reference

[Learn more about the `useProjects` hook.](/docs/foundry/ontology-sdk-react-applications/useprojects-hook/)

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

import { AdvanceTodoProject } from "@advanced-to-do-application/sdk";
import { useCallback } from "react";
import useSWR from "swr";
import { useOsdkClient } from "@osdk/react";
import type { Osdk, PropertyKeys } from "@osdk/client";

export type IProject = Osdk.Instance<AdvanceTodoProject, never, PropertyKeys<AdvanceTodoProject>> & {
  numberOfTasks: number,
  numberOfCompletedTasks: number,
  numberOfInProgressTasks: number,
  numberOfNotStartedTasks: number,
}

function useProjects() {
  const client = useOsdkClient();
  const fetcher = useCallback(async () => {
    // We are using runtime-derived properties (RDP) on the concrete links as an example.
    // In the future, we might convert this to operate on the interface so the project does not need to know about the concrete links.
    const projectsPage = await client(AdvanceTodoProject)
            .withProperties({
        "numberOfCodingTasks": (baseObjectSet) =>
          baseObjectSet.pivotTo("codingTasks").aggregate("$count"),
        "numberOfCompletedCodingTasks": (baseObjectSet) =>
          baseObjectSet.pivotTo("codingTasks").where({
            "status": { $eq: "COMPLETED" },
            }).aggregate("$count"),
        "numberOfInProgressCodingTasks": (baseObjectSet) =>
          baseObjectSet.pivotTo("codingTasks").where({
            "status": { $eq: "IN PROGRESS" },
            }).aggregate("$count"),
        "numberOfNotStartedCodingTasks": (baseObjectSet) =>
          baseObjectSet.pivotTo("codingTasks").where({
            "status": { $eq: "NOT STARTED" },
            }).aggregate("$count"),
        "numberOfLearningTasks": (baseObjectSet) =>
          baseObjectSet.pivotTo("learningTasks").aggregate("$count"),
        "numberOfCompletedLearningTasks": (baseObjectSet) =>
          baseObjectSet.pivotTo("learningTasks").where({
            "status": { $eq: "COMPLETED" },
            }).aggregate("$count"),
        "numberOfInProgressLearningTasks": (baseObjectSet) =>
          baseObjectSet.pivotTo("learningTasks").where({
            "status": { $eq: "IN PROGRESS" },
            }).aggregate("$count"),
        "numberOfNotStartedLearningTasks": (baseObjectSet) =>
          baseObjectSet.pivotTo("learningTasks").where({
            "status": { $eq: "NOT STARTED" },
            }).aggregate("$count")
        })
      .fetchPage();
      const projects: IProject[] = projectsPage.data.map((project) => {
        return {
        ...project,
        numberOfTasks: Number(project.numberOfCodingTasks) + Number(project.numberOfLearningTasks),
        numberOfCompletedTasks: Number(project.numberOfCompletedCodingTasks) + Number(project.numberOfCompletedLearningTasks),
        numberOfInProgressTasks: Number(project.numberOfInProgressCodingTasks) + Number(project.numberOfInProgressLearningTasks),
        numberOfNotStartedTasks: Number(project.numberOfNotStartedCodingTasks) + Number(project.numberOfNotStartedLearningTasks),
      }});
      return projects;
    }, [client]);
  const { data, isLoading, isValidating, error } = useSWR<IProject[]>(
    "projects",
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    projects: data ?? [],
    isLoading,
    isValidating,
    isError: error,
  };
}

export default useProjects;
```
