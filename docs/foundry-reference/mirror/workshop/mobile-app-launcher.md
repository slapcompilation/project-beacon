<!-- source: https://palantir.com/docs/foundry/workshop/mobile-app-launcher/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Mobile application launcher

The **Mobile application launcher** is a simple landing page that enables users to search for, browse, and open Workshop applications that have been designed for use on a mobile device.

<img src="./images/mobile-app-launcher.png" alt="mobile app launcher" width="300px">

There is no configuration required to set up the mobile app launcher; when you [create a mobile Workshop application](/docs/foundry/workshop/mobile-getting-started/), the application will appear in the app launcher. In addition to helping users find and use mobile applications, the mobile app launcher provides a few additional features:

* The mobile app launcher is optimized to reduce the dependencies loaded when it is opened. This makes the app launcher load more quickly, reducing bandwidth usage on mobile devices.
* Navigating into an application, or between pages within an application, updates the browser history so that Back and Forward interactions work as expected on a phone. This enables users to swipe from the left or right to navigate on iOS, or use the hardware back button on Android devices to navigate back.

![mobile ios navigation](./images/mobile-navigation-ios.gif)

Once you have created one or more mobile applications, tell your users to navigate to the mobile app launcher to get started finding and using your applications. The mobile app launcher is available in your environment at `https://<your-foundry-url>/workspace/m`.

You can open the mobile app launcher on your desktop device, but the launcher will appear in full width across your desktop screen. To simulate how apps will appear on a mobile device, we recommend using the device mode preview in your browser of choice:

* [Chrome Device Mode ↗](https://developer.chrome.com/docs/devtools/device-mode/)
* [Safari Responsive Design Mode ↗](https://developer.apple.com/safari/tools/)
* [Edge Emulate mobile devices ↗](https://docs.microsoft.com/en-us/microsoft-edge/devtools-guide-chromium/device-mode/)
