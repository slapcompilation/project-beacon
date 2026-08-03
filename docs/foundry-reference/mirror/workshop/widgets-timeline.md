<!-- source: https://palantir.com/docs/foundry/workshop/widgets-timeline/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Timeline

The Timeline widget is used to visualize temporal data, rendering objects as events in a chronologically ordered timeline.

<img src="./media/widgets-timeline.png" alt="Timeline example" width=400>

## Configuration Options

* **Timeline layers**
  * Multiple timeline layers can be used to aggregate temporal data across multiple object types as events on a single timeline widget.
  * **Configure timeline layer**
    * **Layer label:** sets the label for a timeline layer
    * **Object set:** inputted object set definition that will be displayed for a timeline layer. The object set definition must be of a single object type.
    * **Load data from scenario:** select the Scenario to load data for a timeline layer. This input also affects what objects appear and their respective order in the Object Table.
    * **Date / timestamp property:** select the date or timestamp property to be used for visualizing and ordering the objects by in the Timeline widget.
    * **Event title**
      * **Object title:** sets the display title for the objects in the Timeline widget to be the object’s title.
      * **Property title:** sets the display title for the objects in the Timeline widget to a specified property.
      * **Custom title:** sets the display title for the objects in the Timeline to be custom-defined text.
  * **Event properties**
    * **Properties to display on timeline event**
      * **Prominent properties:** only display the ontology-defined prominent properties of the object in the Timeline widget.
      * **Specific properties:** specify which object properties to be displayed in the Timeline widget.
  * **Event appearance**
    * **Color**
      * **Default:** use the default color set in the ontology for the object’s icon and display title in the Timeline widget
      * **Static:** manually override and set the color used for the object’s icon and display title in the Timeline widget
      * **Dynamic:** define conditional formatting rules to dynamically set the color used for the object’s icon and display title in the Timeline widget
    * **Icon override**
      * **Default:** use the default icon set in the ontology for the object in the Timeline widget
      * **None:** show no icon for the object in the Timeline widget
      * **Custom:** manually override and set the icon for the object in the Timeline widget
  * **Selection event override**
    * **Override selection event:** set event(s) to be triggered when an event within the timeline layer is selected in the Timeline widget. Setting this will override any events set for the widget’s ‘On active timeline event selection’ configuration.
* **Timeline appearance**
  * **Timeline orientation:** the display orientation of the timeline can either be set to Vertical or Horizontal
  * **Timeline events order:** the ordering of events in the timeline can either be set to display Newest First or Oldest first
  * **Show legend:** toggle on an interactive legend card that can be toggled to show or hide selected timeline layers
  * **Show time between events in tooltip on hover:** toggle on to display a tooltip of the calculated time between two events when hovering between events in the Timeline widget
* **Selection**
  * **Active object:** outputs an object set of the currently selected object in the widget
  * **Enable highlight of event on selection:** when toggled on, selected events will remained highlighted in the widget.
  * **On active timeline event selection:** set event(s) to be triggered when an event is selected in the widget.
