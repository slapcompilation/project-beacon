<!-- source: https://palantir.com/docs/foundry/logic/evaluations-ontology-edits/ · mirrored 2026-08-16 from Palantir Foundry docs -->

# Evaluation functions and Ontology edits

When an evaluation suite is run, the Logic function for each test case is executed. For functions that involve Ontology edits (such as creating, editing, or deleting objects), each test case is executed in an Ontology simulation. This ensures that the actual Ontology remains unchanged during testing and evaluation.

## Custom evaluation functions for Ontology edits

For AIP Logic functions that result in Ontology edits, users must configure custom evaluation functions in TypeScript or use [intermediate parameters](/docs/foundry/aip-evals/intermediate-parameters/). Custom evaluation functions must return either Boolean or numeric types. One evaluation function may also return multiple metrics by returning a `struct` consisting of Boolean or numeric types.

When adding evaluation functions in the Evaluations application, you will be prompted to either author a function in Code Repositories or select an existing published function. With the guide provided below, explore various kinds of Ontology edits and learn how to effectively use TypeScript functions for their evaluation.

### Created objects

In the case of Ontology edits that involve creating objects, the created object only exists in the simulated Ontology. As such, these created objects cannot be configured as a test case parameter for passing in directly. Instead, search for it using an identifiable property and check its properties.

```typescript
@Function()
public async checkTicketWasCreated(
    expectedRequester: string,
    expectedDate: LocalDate,
    expectedClassification: string,
): Promise<boolean> {
    const matches = Objects.search().supportTicket()
        .filter(ticket => ticket.ticketRequester.exactMatch(expectedRequester))
        .filter(ticket => ticket.ticketCreationDate.exactMatch(expectedDate))
        .all();

    if (matches.length !== 1) {
        return false;
    }

    return matches[0].classification === expectedClassification;
}
```

### Edited objects

For object edit output types, the edited object already exists in the real Ontology. In the simulated Ontology, you can pass it directly into the function and check its properties, as illustrated below:

```typescript
@Function()
public checkTicketClassification(
    ticket: SupportTicket,
    expectedClassification: string,
): boolean {
    return ticket.classification === expectedClassification;
}
```

### Deleted objects

In the case of Ontology edits that involve deleting objects, the object is expected to be deleted in the simulated Ontology, so it cannot be passed into the evaluation function. To verify that the object was actually deleted, pass an identifiable property of the object and search for it to ensure that there are no results.

```typescript
@Function()
public async checkTicketWasDeleted(ticketId: string): Promise<boolean> {
    const count = await Objects.search().supportTicket()
        .filter(ticket => ticket.ticketId.exactMatch(ticketId))
        .count();
    return count === 0;
}
```
