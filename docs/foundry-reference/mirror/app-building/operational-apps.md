<!-- source: https://palantir.com/docs/foundry/app-building/operational-apps/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# What is an operational application?

At Palantir, we frequently refer to workflows and applications as being "operational." An **operational application** is a user interface designed to improve organizational decision-making. A traditional dashboard or report delivers read-only information and stops there; an operational application enriches this information with simulations and actions to ensure human users can make optimal decisions with ease.

An **operational application** is a user interface designed to improve organizational decision-making. A traditional dashboard or report delivers read-only information and stops there; an operational application enriches this information with simulations and actions to ensure human users can make optimal decisions with ease.
Generally, workflows that drive decision-making are far more likely to gain user adoption and promote organizational outcomes than those that only present information. The guide below describes what makes applications operational and how to use Foundry's application-building capabilities to create them in practice.

## Beyond the dashboard: Elevating an idea into an operational application

Most application ideas begin as something read-only: a chart, a summary table, or a report that a team checks regularly. This is a useful starting point, but it leaves the most valuable step to the user, who must interpret the information, decide what to do, and then take action with another tool. An operational application closes that gap. You can elevate almost any read-only idea by working through the following steps.

### 1. Start with the decision, not the screen

Before building anything, name the decision or decisions the application exists to support. Ask what choice the user is there to make, what information they need to make it well, and what happens once they decide on a course of action. Anchoring on the decision keeps the application focused on organizational outcomes and clarifies downstream design choices.

### 2. Surface the right information at the right time

Once you know the decision, identify what information the user must have to make it. Because operational applications read live from the [Ontology](/docs/foundry/ontology/overview/), you can surface the current state of the world at the moment a decision needs attention rather than a stale snapshot. Show only the objects, links, and properties that matter to the decision, along with context needed to act, and leave other information out. This focus gives the application a clear purpose rather than presenting the entire contents of a source system in an information-dense, hard-to-navigate interface.

### 3. Test the impact of a decision before committing

A true operational application does not only present a decision; it lets users explore the consequences of that decision before they commit to it. Using [scenarios](/docs/foundry/ontology/overview-ontology-scenario/), a user can fork the Ontology, apply one or more [actions](/docs/foundry/action-types/overview/), and see how the world would look under each option without writing anything back to the live system. When a scenario incorporates [models](/docs/foundry/ontology/models/), a simulation can predict complex downstream effects and allow the user to weigh tradeoffs and compare competing plans of action. This approach of combining human expertise with high-quality data and rigorous modeling can achieve better organizational outcomes than acting on intuition or unverified assumptions alone.

### 4. Turn information into action

The defining feature of an operational application is that the user can make a business-critical decision *within that same application* rather than in another tool. In the Ontology, [actions](/docs/foundry/action-types/overview/) are the governed mechanism that makes this possible: they define how users write their decisions back into the system. Action [submission criteria](/docs/foundry/action-types/submission-criteria/) ensure that the Ontology changes only in accordance with your organization's rules. This framework lets users act on a decision the moment they reach it without the friction of navigating multiple interfaces.

### 5. Close the loop

When a user submits an action in Foundry, their decision is committed as an atomic change in the Ontology and is immediately reflected across other applications to every other user. One user's decision is not isolated in a personal spreadsheet or email thread; it immediately becomes part of the shared, real-time view of the world that everyone else uses to make their own decisions. This is one way the Ontology compounds the value of decisions across the organization over time rather than being locked within departmental silos.

When a user makes a decision via an Ontology action, it can also drive downstream effects:

* [Side effects](/docs/foundry/action-types/side-effects-overview/) can send notifications, including by email, or trigger events in external systems. For example, [webhooks](/docs/foundry/action-types/webhooks/) let an action call external APIs or other Foundry APIs, so a decision captured in Foundry can update a system of record, post a message outside the platform, or kick off another process.
* [Function-backed actions](/docs/foundry/action-types/function-actions-overview/) let you define action types of arbitrary complexity, using code to determine how objects should change, whether that logic runs as a serverless function or as a [compute module](/docs/foundry/compute-modules/overview/).
* [Triggering schedule builds](/docs/foundry/action-types/trigger-schedule-build/) allows users to start data integration builds.
* [Automate](/docs/foundry/automate/overview/) turns a captured decision into ongoing business automation, checking conditions continuously or on a schedule and running effects automatically when those conditions are met. [Autopilot](/docs/foundry/autopilot/overview/) then gives teams a control center to visualize, monitor, and troubleshoot these automation workflows at scale.
* Actions can trigger [agents](/docs/foundry/agents/overview/) to carry out follow-on work, or route an agent's proposed changes to a person for approval before they are applied, as described in [Extending the loop with agents](#extending-the-loop-with-agents) below.
* The [action log](/docs/foundry/action-types/action-log/) records every action submission as an object type in the Ontology, turning the history of decisions and their rationale into data you can analyze, audit, and feed into other decision-making workflows.

The Ontology allows decisions in operational applications to become powerful points of leverage, triggering downstream processes and creating a durable, auditable record of organizational choices. When decisions themselves become part of the Ontology, they can inform future choices and compound into a repeating cycle of increasingly better outcomes.

## A real-world example

Consider a logistics coordinator at a company that delivers parts to automotive assembly plants just in time, where a single late shipment can idle a production line and trigger steep penalties. A shipment of transmission components is delayed by a carrier breakdown and is now at risk of missing the plant's delivery window.

### With a traditional dashboard

* The dashboard flags the shipment, but the coordinator must leave it to assemble the picture by hand: a spreadsheet of approved carriers, emails asking about capacity, a separate system for the customer's window and penalty terms, and transit times estimated from memory.
* Under time pressure and with incomplete information, they book a carrier that seems reasonable over the phone.
* The decision lives nowhere others can see: the planning team does not know the route changed, the customer is not notified, and a colleague restarts the same investigation an hour later.
* Nothing is recorded, so the reasoning is lost and cannot be audited or learned from. Tomorrow's process looks exactly like yesterday's process.

### With an operational application

* The application opens on the decision itself and surfaces only what it requires, live from the Ontology: the parts on board, the delivery window and penalty clause, the current carrier, and alternative carriers with real-time capacity, cost, and on-time history.
* The coordinator simulates each candidate carrier in a scenario, where models project arrival time, cost, on-time probability, and knock-on effects to other shipments, then commits to the option with the best overall outcome.
* A single action reassigns the carrier, commits the decision to the Ontology, notifies the customer, and updates the planning pipeline at once, without leaving the application.
* Everyone running a parallel process sees it immediately, each in their own application: customer service has the revised estimate and its reason, finance picks up the new cost and the penalty avoided, and the plant's planner adjusts the build schedule. No one had to be notified.
* Every decision and its rationale becomes durable, auditable data. Teams can compare each scenario's expected outcome against what actually happened and close the gap, so each decision makes the next one better.

## Extending the loop with agents

Operational applications only become more important as you develop automated, agentic processes. Deploying [AI agents](/docs/foundry/agents/overview/) into workflows does not replace the decision-making loop; it allows human users to operate across a broader decision-making plane. Users apply judgment at critical points that require nuanced human expertise and set high-level direction for agents and agent swarms (groups of agents working in parallel) to carry out routine work that can be automated. The operational application remains essential in this framing: it is the interface where human users review, steer, and approve the work delegated to agentic processes, keeping a person accountable for the decisions that matter most.

Return to the logistics example. The accumulated record of past decisions is what makes the workflow ready for agents:

* Because that record captures both the quantitative outcomes and the coordinator's qualitative rationale, an agent can take on a subset of the reassignments itself.
* The coordinator sets the criteria for what the agent may handle, such as lower-value shipments on well-traveled routes where one carrier clearly wins on cost, arrival time, and on-time probability. Anything ambiguous or high-stakes is escalated back to a person.
* The coordinator shifts from making every reassignment to supervising the automated ones, using the same application to monitor performance, watch for drift, and adjust guardrails.
* The coordinator still personally handle the difficult, context-heavy rerouting decisions that depend on experience and judgment, and the record continues to compound.

## Signs you have built a dashboard, not an operational application

Use the following checks to assess whether a user interface is an operational application:

* **No decision is named:** If you cannot state a specific decision users will be making in the application, it is likely still an informational dashboard.
* **Nothing is written back:** If the application only reads data and never captures a decision, it cannot compound value over time. It is using the Ontology like a traditional database, not as a representation of the world.
* **The user has to act somewhere else:** If the user gathers information from the application but then has to trigger decisions in another system, the application is not operational.
* **Alternatives cannot be compared:** If the user cannot simulate different scenarios and weigh the tradeoffs of different decisions before committing to one, the application forces blind decisions.
* **Decisions stay local:** If a captured decision is not reflected back to everyone working with the same data, teams fall out of sync and the decision cannot compound.

## Building operational applications in Foundry

Foundry offers several tools for building operational applications, spanning from no-code options to fully custom processes:

* [Workshop](/docs/foundry/workshop/overview/): The primary no-code tool for building object-oriented operational applications, with interactive layouts, events, and widgets that write decisions back to the Ontology.
* [OSDK React applications](/docs/foundry/ontology-sdk-react-applications/overview/): Fully custom React interfaces powered by the Ontology SDK for custom experiences beyond Foundry's built-in tools. [Pilot](/docs/foundry/pilot/overview/) is a streamlined, AI-powered way to build these OSDK applications from a natural-language prompt.
* [Custom widgets](/docs/foundry/custom-widgets/overview/): Extend Workshop with bespoke frontend React code, such as for tailored visualizations, without building a standalone application. Note that you can embed a single, full-page custom widget within a Workshop module to leverage the capabilities of both tools.
* [Slate](/docs/foundry/slate/overview/): A builder for custom applications and dashboards using HTML and JavaScript on Ontology data.
* [Code Workspaces applications](/docs/foundry/code-workspaces/overview/): Interactive Streamlit, Dash, and Shiny® applications built in your preferred IDE and published on Foundry.
* [REST APIs](/docs/foundry/api/ontology-resources/actions/apply-action/): Build applications against the Ontology entirely outside of Foundry's frameworks.

Get started by building a simple application in [Workshop](/docs/foundry/workshop/overview/) to get familiar with application-building principles with the Ontology.
