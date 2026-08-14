<!-- source: https://palantir.com/docs/foundry/machinery/core-concepts/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Core concepts

We recommend reviewing the following concepts before using the Machinery application.

## Process

In a real-world process, entities such as documents, equipment, or individuals transition through [states](#state) over time. Many of these process objects can be linked to each other to represent multiple entities involved in a process. In Machinery, you can model these processes via process containers which hold states and actions. These process containers can be linked to one another and even be nested.

Entities within a process, also called "process objects", can be represented by an object type in your ontology, such as *Claim*, *Flight*, or *Employee*. That object type must have a string-type property that denotes the object's state.

## State

A state describes the current condition of an object, such as *in progress* or *delivered* for a parcel. The possible states must be enumerable. For instance, a `Name` property would not be suitable because there are indefinitely many possible names.

State transitions are shown as edges between state nodes.

Every object must be in **one** of the possible states at any given time. Scenarios where this is not the case should be modeled as a process hierarchy. For example, an employee could have the state *new-hire* or *onboarded*, and also *paid* or *awaiting payment* at the same time. These should be separate processes, with a parent process tracking whether the employee is *payable*.

Within the Ontology, the state is codified as a string value of the `State` property. This value is equivalent to the state ID in Machinery. To change the state label shown on the graph, you can overwrite the display name.

The state IDs in Machinery are equivalent to the state values in your data. To avoid typing errors or discrepancies, you can back your state property by an enumeration [value type](/docs/foundry/object-link-types/value-types-overview/). This will guarantee that the data in the ontology can only assume a predefined set of values. Machinery will detect this setup and keep the process states in sync.

## Action and automations

Actions are the cause of state transitions. State changes that happen within the platform are defined by an [action](/docs/foundry/action-types/overview/). You can import them to the Machinery graph and qualify their role in the process.

## Process log

The nature of a process is that entities undergo changes over time. To identify patterns in the paths that objects take or metrics like the average time spent in a state, it is essential to capture the time dimension of changes. Machinery does so by maintaining a `Log` object type that tracks every change made to an object, whether from external data sources or Foundry actions.

You can view this object type like any other, but you should not define actions on it yourself, as the log object type is maintained automatically by Machinery.

Each log object type tracks the changes of a single object type property. Each process can have a process log of its own.

For processes happening outside the platform, you need to provide a dataset in changelog format that tracks which object went into which state at what time. Machinery computes derivations required for analysis and monitoring, such as the previous state, the duration between states, and the path that an object took until this time.
