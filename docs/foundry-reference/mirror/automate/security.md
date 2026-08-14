<!-- source: https://palantir.com/docs/foundry/automate/security/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Security

Automate provides comprehensive security and permissions controls to ensure automations execute safely and that users only see information they are authorized to access.

## Key security concepts

Automate is governed by the same security and permissions model as the rest of the platform. Users can only see and interact with the automations to which they have access. This ensures condition evaluation and effects always reflect the appropriate data access at the time when the automation is evaluated.

### Execution permissions

Understanding who has permission to see what is critical for secure automation design:

* **Condition evaluation:** Uses automation owner's permissions
* **Action and Logic effects:** Execute as the automation owner
* **Notification effects:** Use each recipient's individual permissions

Learn more about how permissions work for different effect types in our Automate [permissions](/docs/foundry/automate/permissions/) documentation.

### Automation scoping

Automations can be configured with different scoping options that determine who can access the run history for action, Logic, and function executions:

* **User-scoped automations:** Only the automation's owner has access to run history.
* **Project-scoped automations:** Enable team collaboration by sharing run history with all users who satisfy the markings on a run.

Learn more about scoping options in our [history visibility and scope](/docs/foundry/automate/history-visibility-and-scope/) documentation.

### History and activity tracking

Automate tracks execution history and activity to provide visibility into automation behavior while respecting security boundaries:

* **Activity tracking:** View all automation-related activity for your user in the Automate application.
* **Automation history:** See condition triggers, failures, and metadata changes for individual automations.
* **Shared history events:** Optionally enable shared history to make execution events visible to other users (while keeping execution details private).

Learn more about execution events and retention in our [Automation history](/docs/foundry/automate/history/) documentation.
