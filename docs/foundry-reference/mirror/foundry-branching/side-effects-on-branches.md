<!-- source: https://palantir.com/docs/foundry/foundry-branching/side-effects-on-branches/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Branching action types

Ontology actions integrate with Global Branching, enabling you to test action types on a branch without affecting your production environment. You can run actions, validate their configurations, and observe edits in an isolated branch context before merging changes to `main`.

For general information on Global Branching concepts and workflows, refer to the [Global Branching documentation](/docs/foundry/global-branching/overview/).

## Running actions on a branch

You can test actions in a Workshop module on a branch to validate that they have been configured correctly. When all relevant object types are indexed on a branch, you can run the action type and see the resulting edits on the branch.

### Prerequisites

To run an action on a branch, all object types that are edited by the action type must be indexed on that branch. You can index object types through the individual object type page or through the action type page in Ontology Manager.

![Action indexing banner on a branch.](./images/action-indexing-banner.png)

:::callout{theme="neutral"}
Running actions on a branch is intended as a testing mechanism. Action edits on a branch will not be merged back into `main`.
:::

### Working with function-backed actions on a branch

Function-backed actions on a branch behave differently depending on whether they are branch-aware. Branch-aware functions can be modified on the branch and read schemas from it, while non-branch-aware functions only read schemas from `main`. Regardless of branch-awareness, all function-backed actions execute only on the branch and do not write changes back to `main`. See supported function types in the [Global Branching documentation](/docs/foundry/global-branching/integrations/).

## Managing side effects on branches

:::callout{theme="neutral"}
The following information applies specifically to webhooks, functions with external calls, and notifications that are applied **via actions** on branches. Side effects applied through other means will behave as defined by those consumers.
:::

### Webhooks

By default, webhooks do not execute when an action is applied on a branch. This behavior is to prevent accidentally writing to external systems while in a testing environment.

In such cases, you will see a toast notification indicating this behavior.

![A toast notification indicating action applied but webhook not executed.](./images/action-webhook-toast.png)

However, there are some cases where testing a webhook on a branch is desirable, for instance when hitting a READ endpoint.

To override the default behavior, configure the action type's **Security and submission criteria** tab in Ontology Manager to enable webhook executions on branches.

![Enable webhooks on branches setting.](./images/action-webhook-setting.png)

:::callout{theme="neutral"}
If webhooks on branches are enabled, the webhook will run exactly as it would on `main`. Consequently, if the webhook is configured to hit an external production environment, it will continue to do that even if the action is executed on a branch.
:::

### Functions with external calls

By default, function-backed action logic with external calls does not execute when an action is applied on a branch; the action fails entirely. This behavior is to prevent accidentally writing to external systems while in a testing environment.

In such cases, you will see a toast notification indicating failure, with an explanation of the behavior.

<img src="./images/action-function-error-toast.png" alt="External function call blocked the action." width="400">

However, testing on branches is sometimes necessary, for example, when calling READ endpoints. You can override this restriction by enabling functions with external calls on branches in the action type's **Security and submission criteria** tab in Ontology Manager.

![Enable functions with external calls on branches setting.](./images/action-function-setting.png)

:::callout{theme="neutral"}
If functions with external calls on branches are enabled, the function will make the same external calls as it would on `main`. Consequently, if the function is configured to hit an external production environment, it will continue to do that even if the action is executed on a branch.
:::

### Notifications

By default, notifications do not execute when an action is applied on a branch. This behavior is to prevent accidentally notifying recipients while in a testing environment.

In such cases, you will see a toast notification indicating this behavior.

![Toast notification indicating action applied but notification not executed.](./images/action-notification-toast.png)

However, there are some cases where testing notifications on a branch is desirable.

To override the default behavior, you can enable notifications on branches in the action type's **Security and submission criteria** tab in Ontology Manager.

Additionally, you can specify the notification recipients when the action runs on a branch:

* **Branch owner:** Send all notifications to the branch owner.
* **Default recipients:** Notify the recipients configured on the original notifications.

![Enable notifications on branches setting.](./images/action-notification-setting.png)

## Known limitations

* Action edits on a branch are for testing only and will not be merged back into `main`.
* Webhooks and email notifications are not executed by default when an action is run on a branch.
* Functions that make calls to external systems will fail by default when an action is run on a branch.
