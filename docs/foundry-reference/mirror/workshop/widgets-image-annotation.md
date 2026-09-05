<!-- source: https://palantir.com/docs/foundry/workshop/widgets-image-annotation/ · mirrored 2026-09-04 from Palantir Foundry docs -->

# Image Annotation

The **Image Annotation** widget is used to annotate images by drawing rectangles around areas of interest.

The screenshot below shows an example of a configured **Image annotation** widget in the process of creating an annotation:

![Example of an image annotation that marks a break in a pattern.](./images/image_annotation_example.png)

Annotations are not stored inside the widget. To persist a rectangle, save it as an **object in your [Ontology](/docs/foundry/ontology/overview/)**. Persisted annotations behave like any other object: they can be searched, filtered, linked to other objects, secured with [permissions](/docs/foundry/security/overview/), and reused across applications.

The widget performs two distinct roles:

* **Displaying existing annotations.** The widget reads an object set of annotation objects and superimposes each stored bounding box onto the image.
* **Capturing new annotations.** When a user draws a rectangle, the widget writes the coordinates into a Workshop variable. You then persist that variable to the Ontology through an [Action](/docs/foundry/workshop/actions-use/).

Writing back to the Ontology is always performed by an Action; a [Scenario](/docs/foundry/workshop/scenarios-overview/) is not required. Scenarios are only needed for "what-if" analysis, where edits are staged in an isolated fork of the Ontology rather than committed. Involve a Scenario only if you specifically want annotations to be provisional and reviewed before being written to the live Ontology. Because writeback relies on an Action, before you configure the widget you need two things in place:

1. An **annotation object type** in the Ontology to store each bounding box.
2. An **Action** that creates (and optionally deletes or modifies) those annotation objects.

The end-to-end flow, from a user drawing a rectangle to a persisted, linked annotation object, proceeds as follows:

1. A user draws a rectangle on the image.
2. The widget writes the coordinates of the rectangle into the **Current bounding box selection** variable.
3. The **On annotation create** setting triggers a Workshop event that submits an Action, or the user selects a "Save" button that submits the Action.
4. The Action creates an annotation object, sets the bounding box property, and links the new object to the subject object that owns the image.
5. The widget reloads the annotation object set and draws the saved box on the image.

## Set up annotation writeback

The following steps walk through the most basic annotation workflow: letting a user draw a box on an image and save it as an object linked to the object the image belongs to. The example uses an `Inspection Photo` object (which holds the image) and an `Image Annotation` object (which holds each box), but you should substitute the object types and property names from your own Ontology.

:::callout{theme="neutral"}
This example is illustrative. Because your Ontology is customized to your data, the object and action types referenced below may not exist in your enrollment. Create equivalents that match your data model.
:::

1. [Model the annotation object type](#step-1-model-the-annotation-object-type)
2. [Create the Actions](#step-2-create-the-actions)
3. [Configure the widget inputs](#step-3-configure-the-widget-inputs)
4. [Save new annotations to the Ontology](#step-4-save-new-annotations-to-the-ontology)

### Step 1: Model the annotation object type

In [Ontology Manager](/docs/foundry/ontology-manager/overview/), create an object type to store annotations. At minimum it needs:

* **Primary key:** A value such as an `Annotation ID` string.
* **Bounding box property:** A string property that stores the box coordinates as `"x1, y1, x2, y2"`, where `(x1, y1)` is the upper-left corner and `(x2, y2)` is the lower-right corner, using pixel coordinates. This is the value the widget reads and writes.
* **Color property (optional):** A string property holding a hex color code, such as `#FF0000`, used to draw the box.
* **Link:** A link to the object that owns the image, for example a many-to-one link from `Image Annotation` to `Inspection Photo`. This link is what associates each annotation with the correct image so that only the relevant boxes are displayed.

### Step 2: Create the Actions

Create an [Action](/docs/foundry/workshop/actions-use/) that creates a new `Image Annotation` object. Its parameters should include:

* The **bounding box** string, which the widget supplies.
* A reference to the **subject object** (the `Inspection Photo`), so the Action can set the link created in Step 1.
* (Optional) The **color** string.

You can also create Actions to **delete** an annotation (for a "Remove" control) and to **modify** an existing annotation if you want users to adjust a box after it has been saved. For a full walkthrough of defining Action types, see [Use Actions in Workshop](/docs/foundry/workshop/actions-use/).

### Step 3: Configure the widget inputs

Add the Image Annotation widget to your module and configure the fields described in [Configuration options](#configuration-options):

* Set the **Image source** to the media reference or media URL for the current image.
* Set **Annotation objects** to an object set of your `Image Annotation` objects, filtered to the current `Inspection Photo`. Filtering by the current subject object ensures the widget only draws boxes that belong to the displayed image.
* Set **Bounding box property** to the string property you created in Step 1.
* (Optional) Set **Color property** to your hex color property.
* Set **Current bounding box selection** to a string variable. The widget writes the coordinates of the box the user is currently drawing into this variable; this is the value you pass to your create Action.
* Set **Active annotation object** to an object set variable. The widget populates this variable with the existing annotation object a user selects.

### Step 4: Save new annotations to the Ontology

When a user finishes drawing a rectangle, the coordinates are held in the **Current bounding box selection** variable. To persist them, trigger your create Action from Step 2:

* Use the **On annotation create** setting to trigger a Workshop [event](/docs/foundry/workshop/concepts-events/) at the moment a rectangle is drawn, or add a "Save" button using the [Button Group widget](/docs/foundry/workshop/widgets-button-group/) that lets the user confirm before saving.
* In the Action's parameter defaults, set the **bounding box** parameter to the **Current bounding box selection** variable, and set the **subject object** parameter to the object currently displayed (for example, the active `Inspection Photo`). Setting the subject object is what links the new annotation to the correct image.
* (Optional) Set the color parameter to a variable or a static hex code.

After the Action submits, the new `Image Annotation` object is written to the Ontology and linked to its subject object. Because the widget's **Annotation objects** input is an object set, it reloads to include the new object and draws the saved box on the image.

## Configuration options

Here is a screenshot of the initial state of a newly-added Image Annotation widget alongside its initial configuration panel:

![The initial Image Annotation widget configuration.](./images/image_annotation_config.png)

* **Input data**
  * **Image source:** The image can be displayed from either a media URL or media reference. Currently this widget accepts the following image file types:
    * **Media URL:** Select a string variable with a valid media URL to render a preview of the media. If referencing a media URL from a dataset, the URL should be in either of the following format: `.png`, `.jpg`, `.jpeg`, `.bmp`, or `.webp`,
      * `https://{my-foundry-url}/foundry-data-proxy/api/web/dataproxy/datasets/{dataset rid}/transactions/{transaction rid}/{filename}`
      * `https://{my-foundry-url}/foundry-data-proxy/api/web/dataproxy/datasets/{dataset rid}/views/{branch name}/{filename}`.
      * Otherwise, if referencing an external media URL, configure access in your enrollment's [Content Security Policy](/docs/foundry/administration/embed-foundry-externally/) settings.
    * **Media reference:** Define an object set with a single object and select the [media reference](/docs/foundry/media-sets-advanced-formats/media-overview/#media-references) typed property to render a preview of the media for that object.
  * **Current bounding box selection:** A string variable that tracks the active bounding box selection coordinate stored as "x1, y1, x2, y2", where (x1, y1) are the pixel coordinates for the upper-left corner of the box, and (x2, y2) are the pixel coordinates for the lower-right corner of the box. Pass this variable to your create Action to save the box a user has drawn.
  * **Active annotation object:** The object representing the currently selected annotation.
* **Annotations**
  * **Annotation objects:** The object set representing the annotations to be superimposed on the image. Filter this object set to the current image's subject object so that only the relevant annotations are displayed. Currently, up to 1000 annotations per image is supported.
  * **Bounding box property:** The annotation object set's string property that represents the point vector.
  * **Color property:** The annotation object set's string property that represents the color to be drawn as a hex code. This field is optional.
  * **On annotation create:** Enable module builders to configure Workshop events to trigger when an annotation is created by a user. Use this to trigger the Action that saves the drawn box to the Ontology.
