<!-- source: https://palantir.com/docs/foundry/functions/debug/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Debug functions

:::callout{theme="warning"}
The following documentation is specific to TypeScript v1 functions. For more [robust capabilities](/docs/foundry/functions/language-feature-support/#typescript-v1-vs-typescript-v2), including support for Ontology SDK and configurable resource requests, we recommend [migrating to TypeScript v2](/docs/foundry/functions/typescript-v2-migration/).
:::

As you write functions, you will likely need to inspect the state of your execution to fix issues with code correctness or performance. Below are features you can use to do this. Note that these debugging steps also apply to [unit tests](/docs/foundry/functions/unit-test-getting-started/).

## Authoring debugger

Use the debugger tool in Code Repositories to examine the behavior of your unit test while it runs. Set breakpoints to pause the execution of the unit test in order to examine variables, and understand functions and libraries.

![Debugger overview panel.](/docs/resources/foundry/functions/debugger-overview.png)

## Set breakpoints

To use the debugger, you need to set breakpoints. These breakpoints indicate the specific points where the debugger should pause the code execution, enabling you to interact with variables.

Set a breakpoint by selecting the faded red dot in the margins of each line of code. The debugger suspends the execution *before* the marked line runs. You can set multiple breakpoints across several files, if needed.

![Debugger breakpoints.](/docs/resources/foundry/functions/debugger-breakpoint.png)

## Run the debugger

### During live preview

After adding breakpoints in your code, select **Run and debug**, located in the functions panel.

![Live preview debugger layout.](/docs/resources/foundry/functions/live-preview-debugger-run.png)

### During testing

After adding breakpoints in your code, select **Run test**, located next to the unit test in the code editor.

![Test debugger layout.](/docs/resources/foundry/functions/test-debugger-run.png)

## Use the debugger

Once the debugger has started, the debugger panel will open and pause on the first breakpoint it encounters. The left bar of the debugger allows you to navigate the code, remove breakpoints, and finish or stop the debugging session.

As you navigate the code, the editor highlights the line of code to be executed next. Use the following buttons to advance the debugger:

![Debugger controls.](/docs/resources/foundry/functions/debugger-controls.png)

1. **Resume execution:** Continue execution until completion or until paused by the next breakpoint.
2. **Step over:** Execute the line of code without stepping into internal functions.
3. **Step into:** Navigate into internal functions if they exist in that line of code.
4. **Step out:** Navigate out of an internal function and advance the debugger.
5. **Stop execution:** Stop the debugger completely.
6. **Remove breakpoints:** Remove all breakpoints from the repository and run the unit test without pausing the execution.
7. **Settings:** Toggle the debugger on/off (without clearing the breakpoints).
8. **Documentation:** Open the documentation for additional details.

## Examine variables

While the debugger is running, you can examine the variables and data at the exact point of code execution.

### Frames

Frames represent the functions in which the debugger is active or in which breakpoints exist. Each frame indicates the name of the function followed by the name of the file and the line number in which the function is written.

Select a frame to examine the variables within that frame and run console commands against it.

### Variables

The variables section displays the values stored in both local and global variables while the transform is executed.

![Debugger variables.](/docs/resources/foundry/functions/debugger-variables.png)

### Console

The console allows you to interact with your data using JavaScript console commands while running the debugger.

:::callout{theme="neutral"}
Note that the console operates within the context of the selected frame. Attempting to execute commands on variables local to a different frame will lead to an error.
:::

![Debugger console.](/docs/resources/foundry/functions/debugger-console.png)

## Console logging

Functions supports emitting console logs during execution for debugging purposes. To do so, simply use the `console.log` command to emit logs. For example:

```typescript
    @Function()
    public testConsoleLogging(n: Integer): Integer {
        for (let i = 0; i < n; i++) {
            console.log(`Iteration ${i}`);
        }
        return n;
    }
```

Using console logs in this way can be useful for debugging correctness issues. You can also add console logs to identify performance bottlenecks in your code. See the guide for [optimizing performance](/docs/foundry/functions/optimize-performance/) for more information on how to improve the performance of link traversal logic.

### During testing

When you run a function using the **Tests** helper in **Authoring**, console logs will be captured and displayed below:

![Console logging tests.](/docs/resources/foundry/functions/console-logging-tests.png)

### During live preview

When you run a function using the **Functions** helper in **Authoring**, console logs will be captured and displayed below, along with timestamps:

![Console logging live preview.](/docs/resources/foundry/functions/console-logging-live-preview.png)
