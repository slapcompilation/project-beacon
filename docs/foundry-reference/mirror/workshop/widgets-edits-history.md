<!-- source: https://palantir.com/docs/foundry/workshop/widgets-edits-history/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Edit History

The **Edit History** widget displays the list of user edits made to an object's properties after [**Track user edit history**](/docs/foundry/object-edits/user-edit-history/) has been enabled for the object type within Ontology Manager. Edits completed prior to enabling Edit History, edits completed by a pipeline, or edits completed while on Object Storage v1 will not be reflected.

## Audit trail and data permanence

The Edit History widget provides an **immutable audit trail** of all changes made to ontology objects. Changelog records are designed for auditing purposes and **cannot be deleted or modified** by end users, even if the corresponding ontology edits are reverted or deleted. This ensures a permanent and accurate history of all changes for compliance and traceability requirements.

<img src="./media/widgets_edits_history_example.png" alt="Edits history example">

## Configuration options

* **Object set**
  * The input variable which determines the object data that will be displayed within the widget.
  * If the object set contains more than one object, only the first object will be displayed within the widget.
* **Edits sort order**
  * Specify how edits should be ordered, either oldest-to-newest or newest-to-oldest.
* **Property configuration**
  * Select the properties to be displayed in the widget. You may also choose to display all properties on an object.
