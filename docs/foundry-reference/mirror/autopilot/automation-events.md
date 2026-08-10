<!-- source: https://palantir.com/docs/foundry/autopilot/automation-events/ · mirrored 2026-08-09 from Palantir Foundry docs -->

# Automation events

The **Automation events** tab provides observability into all automation events across your workbench. Monitor system performance, investigate failures from the automation down to the logic block, and understand how automations are processing objects over time. Each event entry displays the automation name, effect and fallback action (if applicable), event details, outcome (success, failure, or fallback triggered), and triggering objects. Executions are grouped by batches, aligned with the Automate history view, so you can see each execution alongside the individual objects within the run.

You can filter events by the following:

* **Time range:** Scope to a specific period.
* **Outcome:** Filter to successes, failures, fallback actions triggered, or successful events that produced no edits.
* **Retries:** Isolate automations that retried, helping you identify candidates for optimization.
* **Automation:** Focus on events for a specific automation.

![A list of recent automation events for an automation.](./images/autopilot_automation_event_ia.png)

Select any event to drill into per-object trace logs with step-by-step details, inline links to related resources, error messages and stack traces for failures, and timing information to spot performance bottlenecks. Much of this context surfaces directly in Autopilot, so you can investigate without traversing multiple products within the platform.

![A detailed view of an automation event with debugging information.](./images/autopilot_automation_debugging_ia.png)

:::callout{theme="neutral"}
For more granular logs, consider using `console` in your TypeScript functions or `import logging` in your Python functions.
:::

## Troubleshooting tips

Use the following best practices to help you troubleshoot failures in your automations:

1. Filter to failed events to find what broke in the automation path.
2. Select a failed event to read the trace logs and error messages.
3. Navigate to the affected object to view its full history across all automations.
4. Compare failed and successful events of the same automation to spot patterns.
5. Follow inline resource links to the automations, functions, and objects involved.

## Monitor system health

Beyond debugging, the **Automation events** tab provides ongoing visibility into system performance over time. Use it to track how frequently automations run, where failure rates are increasing, which automations are processing the most events, and whether event times are growing. Monitoring these trends helps you identify and address issues before they affect your workflow.
