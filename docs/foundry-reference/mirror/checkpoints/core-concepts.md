<!-- source: https://palantir.com/docs/foundry/checkpoints/core-concepts/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Core concepts

## Checkpoint

A **checkpoint** is a justification prompt a user sees when attempting a sensitive interaction (as described in [What is a checkpoint?](/docs/foundry/checkpoints/overview/#what-is-a-checkpoint)). [Checkpoint configurations](#checkpoint-configurations) define these prompts and declare under which conditions and to which users they will be shown. When a user submits a checkpoint, a [checkpoint record](#checkpoint-records) is created.

## Checkpoint configurations

A **checkpoint configuration** defines the prompt and requested justification type which determines how the checkpoint prompt looks and functions from the user perspective. Configurations also define the conditions where a checkpoint should be shown to users. The [Configure checkpoints](/docs/foundry/checkpoints/configure-checkpoints/) page describes these options and conditions in depth and provides a walkthrough of how to create a new configuration.

## Checkpoint records

When a user submits a checkpoint, a **checkpoint record** is automatically created. Each checkpoint record can be [reviewed](/docs/foundry/checkpoints/review-checkpoint-records/) and contains several pieces of information:

* The user who created the record.
* The timestamp of when a record was **Created**.
* The [**Checkpoint Type**](/docs/foundry/checkpoints/checkpoint-types/) of the record.
* The **Checkpoint Language**, which includes the **Checkpoint Title**, **Checkpoint Prompt**, and **Checkpoint Description**. These values are inherited from the checkpoint configuration but are static; they always reflect the text shown to a user in the checkpoint and will not be updated if the underlying checkpoint configuration is edited or deleted.
* The **Justification** a user provided.
* **Checkpointed Items** for the interaction: For [checkpoint types](/docs/foundry/checkpoints/checkpoint-types/) that describe an interaction involving a resource or other entity in the platform, references to those resources or entities will be saved in the record. For example, if you attempt to export a resource and submit a checkpoint generated from a configuration of type **Compass export**, then the record will contain a checkpointed item reference to this resource. Likewise, if you submit a checkpoint generated from a configuration of type **Submit action**, then the record will contain a checkpointed item reference to the Action type (including related metadata, like the Action type's Ontology and that Ontology's version at time of submission).
* A **Checkpoint RID** uniquely identifying each record.
* The **Checkpoint Configuration RID** uniquely identifying the checkpoint configuration the checkpoint was generated from.
