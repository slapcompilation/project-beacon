<!-- source: https://palantir.com/docs/foundry/autopilot/integrations/ · mirrored 2026-08-09 from Palantir Foundry docs -->

# Integrations

Autopilot integrates with other Foundry applications to provide a comprehensive view of your automation workflows and enable seamless collaboration across teams.

## Automate

You can create an Autopilot workbench directly from an automation overview. On the overview page for an automation, select **Open in Autopilot** in the **Actions** menu.

When you open Autopilot from an automation, Autopilot automatically generates a workbench with the selected automation and suggested related automations.

## Pro-code agents, OSDK applications, and Compute modules

Autopilot can discover agentic workflows implemented via third-party applications. Recent edits from third-party applications will be shown alongside human-driven workflows.

## Workshop

Autopilot integrates with [Workshop](/docs/foundry/workshop/overview/) to show human-driven components of your workflow alongside automated processes.

### Human-in-the-loop visualization in Autopilot

Workshop applications appear as nodes on the dependency graph, allowing you to view the following:

* Where human actions are required in your workflow
* The relationship between human actions and automation triggers
* Which state transitions are driven by human decisions rather than automations

### Embed Autopilot in Workshop

Autopilot resources can be embedded into Workshop applications using an iframe. To embed Autopilot follow the steps below:

1. Copy the URL of your Autopilot workbench.
2. Append the query parameter `?embedded=true` to the URL. If the URL already contains a `?`, use `&embedded=true` instead.
3. Use the modified URL in a Workshop iframe widget.

You can embed the Kanban board (`?viewMode=Kanban`), graph (`?viewMode=Graph`), or split view (`?viewMode=SplitView`). Append the query parameter `&readonly=true` for read-only mode, which disables the ability to run automations from the workbench.

## Ontology Manager

Autopilot uses the following configurations from [Ontology Manager](/docs/foundry/ontology/overview/) to customize object displays and enable rich object interactions:

* **Object card properties:** Define which properties appear on Kanban cards using the prominent property configuration.
* **Conditional formatting:** Set up conditional formatting rules that will apply to object cards in Autopilot.
* **Object previews:** Customize the panel object view, which Autopilot will render in the sidebar when you select an object.
