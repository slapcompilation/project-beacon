<!-- source: https://palantir.com/docs/foundry/map/layer-management/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Layer management

All data on your map is grouped into different [types of layers](/docs/foundry/map/core-concepts/), which can be managed in the **Layers** panel.

## Toggle layer visibility

Show or hide the contents of a layer by using the visibility toggle:

<img src="./images/layer-management-hide-layer.png" alt="Hide layer button" />

## Rename layers

Edit a layer's name by clicking on the current name.

<img src="./images/layer-management-edit-layer-name.png" alt="Edit layer name" />

## Reorder layers

Change the order of layers by dragging the layer's icon. Reordering layers can alter the rendering of your map, as layers that appear higher in the list of layers render on top of layers that appear lower in the list.

![Layer ordering and rendering with weather layer on top of snotel layer](./images/layer-management-ordering-weather-first.png)

![Layer ordering and rendering with snotel layer on top of weather layer](./images/layer-management-ordering-snotel-first.png)

## Move objects to new or existing layers

Objects can be spread into multiple layers, as long as the contents are all of the same object type. After moving a selected set into a new layer, the objects in each set can be styled differently, as demonstrated in the images below.

![Creating a new layer with selected set of weather station objects](./images/layer-management-move-to-new-layer.png)

![Moving weather station objects to an existing layer](./images/layer-management-move-to-layer.png)
