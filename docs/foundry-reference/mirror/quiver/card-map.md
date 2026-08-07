<!-- source: https://palantir.com/docs/foundry/quiver/card-map/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Map

Visualize one or more object sets on a map. Maps are backed by geospatial data (geopoints, GeoJSON, and region codes) that can be charted in a variety of ways. You can find a detailed description of map layer configurations in the [Workshop map widget documentation](/docs/foundry/workshop/widgets-map/).

* Point layers plot each object at a specific location on the map.
* Clusters take a group of points and dynamically combine them based on zoom level.
* Choropleth layers can aggregate an entire region to plot shaded areas of the map.
* Line segments are used to connect multiple points using a collection of straight lines.

## Input type

Object set

## Output type

Object selection

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |
