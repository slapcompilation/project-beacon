<!-- source: https://palantir.com/docs/foundry/workshop/widgets-spreadsheet-display/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Spreadsheet Display widget

![An example of a Spreadsheet Display widget.](/docs/resources/foundry/workshop/spreadsheet_display_widget_example.png)

The Spreadsheet Display widget displays spreadsheet files from a [media reference](/docs/foundry/media-sets-advanced-formats/media-overview/#media-references) property on an object.

This widget provides a way to visualize spreadsheet data directly within your Workshop module, allowing users to view and interact with spreadsheet content, such as by creating annotations.

## Configuration options

**Spreadsheet display:** Configure the object type and media reference and enable optional annotations.

<img src="./media/spreadsheet_display_widget_configuration.png" alt="An example configuration of the media reference configuration for the Spreadsheet Display widget" width=345 />

* **Object set with a single object:** An object set containing a single object with a media reference property
* **Spreadsheet media reference property:** A [media reference](/docs/foundry/media-sets-advanced-formats/media-overview/#media-references) property that contains a spreadsheet media reference.
* **Spreadsheet annotations:** Enable this optional configuration to display annotations on top of the spreadsheet.

**Spreadsheet annotation inputs:** Configure one or more annotation layers.

<img src="./media/spreadsheet_display_widget_annotation_layer_configuration_example.png" alt="An example of an annotation layer configuration for the Spreadsheet Display widget." width=345 />

* **Annotation layer name:** A custom name for the annotation layer.
* **Object set:** An object set containing annotation data.
* **Sheet name property:** A property containing the name of the sheet of the annotation.
* **Cell range property:** A property containing the cell range of the annotation. The property can be either a `string` or a `struct`:
  * A `string` in the JSON format following `{"startRow": 0, "startCol": 0, "endRow": 0, "endCol": 0}`.
  * A `struct` with the fields `startRow (integer)`, `endRow (integer)`, `startCol (integer)`, and `endCol (integer)`.
  * The range uses zero-indexing; cell A1 equals `(0,0)`, and a range from cell A1 to B2 equals `{"startRow": 0, "startCol":0, "endRow": 1, "endCol": 1}`.

**Existing annotation interaction:** An optional configuration to track selected annotations.

* **Selected annotation:** The existing annotation(s) to track.
  * Select only one annotation at a time. When the selection changes, the preview seeks to the selected annotation.
  * If the annotation cell range falls outside the sheet boundaries, the preview jumps to the sheet but not to the cell range.
  * If the sheet name does not exist in the preview, no action occurs.

**Annotation interactions:** Configure one or more actions to surface in the widget.

![An example of an annotation interaction configuration for the Spreadsheet Display widget.](/docs/resources/foundry/workshop/spreadsheet_display_widget_annotation_interaction_configuration.png)

* **Icon to display:** A custom icon for the action.
* **Name:** A custom name for the action.
* **Action on annotation:** The action to execute on the annotation.
* **Parameter defaults:**
  * **Sheet name:** The current sheet name (string).
  * **Cell range:** The selected cell range (string).
* **Additional options**
  * **Hide form and apply immediately if valid:** Enable to apply the action immediately instead of showing a form If the configured action has all the required information.
