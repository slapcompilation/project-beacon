<!-- source: https://palantir.com/docs/foundry/workshop/widgets-current-location/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Widget: Current Location Manager

The **Current Location Manager** widget prompts users to share their location and publishes the detected location as a string variable that you can use in your application. Additionally, the widget can display a human-readable preview of the detected location to the end user, determined using the Mapbox reverse geocoding API.

![current location manager](/docs/resources/foundry/workshop/current-location-manager.png)

If the user denies access to their current location, a warning is shown and no current location variable value is set:

![current location permission denied](/docs/resources/foundry/workshop/current-location-permission-denied.png)

Note that the Current Location Manager widget will only prompt the user to share their location and update the user's detected location while the page containing it is open. If your user navigates to a different page within your application, location detection and updates will be paused. We recommend placing the widget in a toolbar or other prominent location so that it is consistently visible when needed. Opening a drawer on top of a page containing the Current Location Manager will not prevent it from updating; only navigating to a different page will cause updates to be paused.

## Configuration options

Below are the core configuration options for the Current Location Manager:

* **Label:** The text label shown to the left of the location preview. Can be empty to remove the label.
* **Location output variable:** The string variable that stores the user's current location in `lat,long` format.
* **Hide location display:** If enabled, both the label and location preview will be hidden, but the user will still be prompted to share their location. Additionally, no request will be made to attempt to reverse geocode the user's location. This is suitable in cases when there is no need to show the user a preview of the detected location.
