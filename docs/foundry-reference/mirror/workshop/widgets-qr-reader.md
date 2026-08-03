<!-- source: https://palantir.com/docs/foundry/workshop/widgets-qr-reader/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Widget: QR Code Reader

The **QR Code Reader** widget allows you to prompt users to scan a QR code using their system camera. The widget allows you to flexibly configure a button to prompt users to scan a code:

![qr code button](/docs/resources/foundry/workshop/qr-code-button.png)

Upon selecting the button, users are prompted to grant camera access, then they can scan one or more QR codes using a fullscreen camera:

<img src="./media/qr-code-scanner-open.png" alt="qr code scanner open" width="300px">

The scanned QR code data is made available as a Workshop [variable](/docs/foundry/workshop/concepts-variables/), which you can use as desired in your application. For example, you can show the scanned data to the user directly using a Markdown widget, use it to look up objects by configuring an Object Set variable, or use the scanned data to prefill an Action form input to capture the data into Foundry.

## Configuration options

Below are the core configuration options for the QR Code Reader:

* **Single or multiple code:** Configures whether the widget scans the first code it sees, or allows users to scan multiple codes in a row. If multiple code mode is selected, then the scanned data will be output as a string array variable. If single code is selected, then the scanned data is a string variable.
* **Should prompt user before scanning:** When enabled, the user will be prompted to select a **Scan code** button to confirm that a code should be scanned. When disabled, any detected QR code will be scanned immediately.
* **Button configuration:** Configuration options for the button used to open the full-screen QR Code Reader. This is identical to the configuration for an individual button in the [Button Group Widget](/docs/foundry/workshop/widgets-button-group/).
