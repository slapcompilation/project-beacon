<!-- source: https://palantir.com/docs/foundry/workshop/widgets-numeric-input/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Numeric Input

The Numeric Input widget allows users to enter numeric values.

## Configuration Options

* **Label**
  * Sets an optional label for the widget. This text is displayed across the top of the widget.

* **Show grouping**
  * If toggled on, formats the numeric input with a comma style thousands separator.

* **Include option to reset to default value**
  * If toggled on, adds a button on the widget’s for clearing out the input field.

* **Unit prefix**
  * If toggled on, displays read-only text or icon of choice in the left-hand side of the widget’s input field.

* **Unit suffix**
  * If toggled on, displays a read-only suffix in the right-hand side of the widget’s input field. The suffix can be text, an icon of choice, or a percent sign. If the percent sign is selected, the output variable of the widget will be the user-entered value divided by 100 to convert the value to percentage form.

* **Minimum value**
  * Sets a minimum bound for the input value. When set, values below this threshold are automatically clamped to the minimum value.

* **Maximum value**
  * Sets a maximum bound for the input value. When set, values above this threshold are automatically clamped to the maximum value.

* **Step size**
  * Defines the increment or decrement amount when using the widget's adjustment controls. This allows for custom step sizes for incremental adjustments.

* **Decimal places**
  * Specifies the number of decimal places to display and accept, up to a maximum of 10 decimal places.

* **Output data**
  * **Numeric value:** Output variable of the widget, storing the user’s inputted numeric value.
