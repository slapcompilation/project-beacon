<!-- source: https://palantir.com/docs/foundry/workshop/widgets-object-set-title/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Object Set Title

The **Object Set Title** widget displays a summary of a given object set as a title.

## Configuration Options

* **Input object set**
  * The input variable which determines the object data that will be displayed within the widget.

* **Contains single object**
  * If toggled on, the widget will display the title of the single object from the inputted object set. If toggled off, the widget will display the title of the object type and the total count of objects from the inputted object set, and its total count.

* **Show icon**
  * If toggled on, the widget will display the icon of the object type from the inputted object set.

* **Enable drag**
  * Enables dragging the objects within the object set to an accepting drop zone. Must have data bank service installed and have fewer than 500 objects within the object set.

* **Title override**
  * Allows overriding the title displayed on the widget with text of choice. This option is only available when **Contains single object** is disabled.

* **Render widget when the object set is empty**
  * **Yes:** Allows selection of an object type to display as a placeholder if the inputted object set is empty.
  * **No:** Default option. Widget will not render in the module view if the inputted object set is empty
