<!-- source: https://palantir.com/docs/foundry/automate/effect-function/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Function effects

:::callout{theme="neutral" title="Beta"}
Function effects are in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.
:::

Function effects allow you to automatically run [functions](/docs/foundry/functions/overview/) when an automation triggers or recovers. Functions enable custom compute logic that can analyze data, transform inputs, and return computed results. Note that functions with ontology edit return types cannot apply these edits as part of a function effect; to apply the edit, you will need to use a function-backed action.

## Configuration

To set up a function effect, open the automation configuration wizard. On the **Effects** page, add a **Function** effect; this will take you to the function effect configuration page. One function will already be added by default and will be displayed as **Unconfigured**.

Starting with this unconfigured function, search and select the function you want to execute. Then, specify the function version. For stable versions (versions 1.0.0 and greater), you can toggle on **Auto upgrade to compatible versions** which will automatically upgrade non-prerelease versions up to the next major version. This allows the automation to use newer compatible function versions as they become available.

After selecting the function, the interface will display the required and optional parameters for the selected function.

To add more functions, select **Add Function**. This will add another tab allowing you to configure a new action.

### Asynchronous execution

Function effects execute asynchronously. When asynchronous execution is supported, the automation submits the function for execution and then polls for the result, rather than waiting synchronously for the function to complete. This can be used for long-running functions that may take significant time to compute. Functions can run up to 4 hours.

Note that function types that do not support asynchronous execution will execute synchronously.

### Error handling

You can configure multiple ways to handle a failed function, including a retry strategy. Available retry strategies include:

* **Constant backoff:** Automatically retry with a fixed wait time between attempts.
* **Exponential backoff:** Wait time increases exponentially between retries.

You can also configure the amount of **jitter**, which is a variation in delay time between retries to prevent simultaneous retries. Jitter can be specified as:

* A factor by which retry delays should be randomly varied. For each retry delay, a randomly selected fraction of the delay is multiplied by the factor and added or subtracted to the delay. For example, given a delay of `100 ms` and a factor of `0.25`, the retry delay would be between `75 ms` and `125 ms`.
* A duration by which retry delays should be randomly varied. For each retry delay, a randomly selected fraction of the duration is added or subtracted to the delay. For example, given a delay of `100 ms` with duration `20 ms`, the retry delay would be between `80 ms` and `120 ms`.

For information about Function effect execution guarantees and how to handle potential duplicate executions, review the [execution guarantees](/docs/foundry/automate/effect-settings/#execution-guarantees) section in the execution settings documentation.

## Permissions

Functions are associated with the owner of an automation. This means that the function will be run on behalf of the owner of the automation. The owner configuring a function must have the necessary permissions to execute that function.

:::callout{theme="warning"}
Since functions run on behalf of a specific user (the owner of an automation), a function will no longer run if the associated user account is disabled or deleted.
:::
