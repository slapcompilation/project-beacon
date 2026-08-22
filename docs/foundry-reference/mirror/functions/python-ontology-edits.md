<!-- source: https://palantir.com/docs/foundry/functions/python-ontology-edits/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Ontology edits

In addition to writing functions that read data from the Ontology, you can also write functions that create objects and edit the properties and links between objects.
This page documents the object edit APIs available to you in functions.
For more details about how edit functions work, refer to the [overview page](/docs/foundry/functions/edits-overview/).

For the edits created in a function to actually be applied, Ontology edit functions *must be configured as a [function-backed Action](/docs/foundry/action-types/function-actions-overview/)*.
Configuring an Action in this way allows you to provide additional metadata, configure permissions, and access the Action in various operational interfaces.
As noted in the [documentation](/docs/foundry/functions/edits-overview/#when-edits-are-applied), running an edit function outside of an Action will not actually modify any object data.

:::callout{theme="warning" title="Warning"}
Searching for objects immediately after editing them may return unexpected results. See the [Caveats section](/docs/foundry/functions/edits-overview/#edits-and-object-search) for details.
:::

## Define an edit function

Functions that edit the Ontology must:

* Be decorated with the `@function(edits=[MyObjectType])` decorator imported from `functions.api` to specify the object types that will be edited.
* Have an explicit `list[OntologyEdit]` return type hint imported from `functions.api`.

## Construct an Ontology edits container

To perform Ontology edits in a Python function, first construct an Ontology edits container from the [OSDK client](/docs/foundry/functions/python-functions-on-objects/). For example:

```python
ontology_edits = FoundryClient().ontology.edits()
```

This container is used to keep track of all edits made in a function.

## Update properties

Ontology objects in Python functions are read-only by default. Attempts to modify their properties will raise an exception.

In order to edit an object, first obtain an editable view of that object using an Ontology edits container, either from an existing object instance:

```python
editable_object = ontology_edits.objects.MyObjectType.edit(my_object)
```

or given an object primary key:

```python
editable_object = ontology_edits.objects.MyObjectType.edit(object_primary_key)
```

Once you have an editable object, you can edit property values by reassigning the property value for an object. For example:

```python
editable_employee.last_name = new_name
```

Subsequent access to the `last_name` property value of `editable_employee` later in the same function execution will yield the new value that was just set. However, the original non-editable object will *not* reflect the changes.

[Array properties](/docs/foundry/functions/api-objects-links/#array-properties) on editable objects are read-only. To modify an array, create a copy of it, modify the copy, then update the property:

```python
# Copy to a new array
array_copy = list(editable_object.my_array_property)
# Now you can modify the copied array
array_copy.append(new_item)
# Then overwrite the property value
editable_object.my_array_property = array_copy
```

Note that the primary key property value of an existing object cannot be updated.

## Update links

Single-link and multi-link properties have various methods for updating links:

```python
# Set an Employee's supervisor
editable_employee.supervisor.set(new_supervisor)

# Clear an Employee's supervisor
editable_employee.supervisor.clear()

# Add a new report to the given employee
editable_employee.reports.add(new_report)

# Remove an old report associated with the given employee
editable_employee.reports.remove(new_report)
```

As with updating properties, accessing links of `editable_employee` after they have been updated will reflect the updates you have made.

## Create objects

You can create new objects using the `MyObjectType.create()` method on the Ontology edits container. When creating a new object, you must specify a value for its primary key.

In this example, we create a new Ticket object with the given ID, set its `due_date` property, and assign it to the given Employee by modifying the `assigned_tickets` link.

```python
from datetime import datetime, timedelta

from functions.api import function, Integer, Array, OntologyEdit
from ontology_sdk import FoundryClient
from ontology_sdk.ontology.objects import Employee, Ticket

@function(edits=[Employee, Ticket])
def create_new_ticket_and_assign_to_employee(
    employee: Employee,
    ticket_id: Integer
) -> list[OntologyEdit]:
    ontology_edits = FoundryClient().ontology.edits()

    new_ticket = ontology_edits.objects.Ticket.create(ticket_id)
    new_ticket.due_date = datetime.now() + timedelta(days=7)

    editable_employee = ontology_edits.objects.Employee.edit(employee)
    editable_employee.assigned_tickets.add(new_ticket)

    return ontology_edits.get_edits()
```

Property values may also be passed directly to the create method in addition to the primary key. For example:

```python
new_due_date = datetime.now() + timedelta(days=7)
new_ticket = ontology_edits.objects.Ticket.create(ticket_id, due_date=new_due_date)
```

## Delete objects

You can delete an object by calling the `MyObjectType.delete()` method on the Ontology edits container.

In this example, we delete all the tickets assigned to the given employee:

```python
for ticket in employee.tickets:
    ontology_edits.objects.Ticket.delete(ticket)
```

Objects may also be deleted using a primary key instead of an instance:

```python
ontology_edits.objects.Ticket.delete(ticket_id)
```
