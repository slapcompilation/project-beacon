<!-- source: https://palantir.com/docs/foundry/functions/configure-notifications/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Configure notifications

Functions can be used to flexibly configure notifications that should be sent in the platform, including notifications that are sent externally to a user's email address.

Configuring a notification in a function makes use of the `Principal` (representing a `User` or `Group`) and `notification` types. These references may be useful while working through this section:

* Reference for [Principal, User, and Group types](/docs/foundry/functions/types-reference/#users-groups-and-principals)
* Reference for [notification types](/docs/foundry/functions/types-reference/#notification)

### Define a custom notification

Suppose that the ontology includes an `Issue` object that can be assigned to a `User`. You can create a function that defines the notification that should be sent to the given `User` with details about the `Issue`.

```typescript tab="TypeScript v1"
import { EmailNotificationContent, Function, Notification, ShortNotification, User } from "@foundry/functions-api";
import { Issue } from "@foundry/ontology-api";

export class NotificationFunctions {
    @Function()
    public createIssueNotification(issue: Issue, user: User): Notification {
        // Create a short notification that will be shown within the platform
        const shortNotification = ShortNotification.builder()
            .heading("New issue")
            .content("A new issue has been assigned to you.")
            // Link to the Issue object in the platform
            .addObjectLink("Issue", issue)
            .build();

        // Define the email body. The email body may contain headless HTML, such as tables of data
        // Note that you can access properties of both the user and the issue in the content
        const emailBody = `Hello, ${user.firstName},

A new issue has been assigned to you: ${issue.description}.`;

        const emailNotificationContent = EmailNotificationContent.builder()
            .subject("New issue")
            .body(emailBody)
            .addObjectLink("Issue", issue)
            .build();

        return Notification.builder()
            .shortNotification(shortNotification)
            .emailNotificationContent(emailNotificationContent)
            .build();
    }
}
```

```typescript tab="TypeScript v2"
import { NotificationLink, Notification, User } from "@osdk/functions";
import { Issue } from "@ontology/sdk";
import { type Osdk } from "@osdk/client";

export default function createIssueNotification(issue: Osdk.Instance<Issue>): Notification {
    // Link to the Issue object in the platform
    const links: NotificationLink[] = [
        {
            label: "Issue",
            linkTarget: {
                type: "object",
                object: issue
            }
        }
    ]

    const platformNotification = {
        heading: "New issue",
        content: "A new issue has been assigned to you.",
        links: links
    }

    // Define the email body. The email body may contain headless HTML, such as tables of data
    const emailBody = `Hello,

A new issue has been assigned to you: ${issue.description}.`;

    const emailNotification = {
        subject: "New issue",
        body: emailBody,
        links: links
    }

    return {
        platformNotification: platformNotification,
        emailNotification: emailNotification
    }
}
```

```python tab="Python"
from functions.api import function, Notification, PlatformNotification, NotificationObjectLink, EmailNotification
from ontology_sdk.ontology.objects import Issue

@function()
def createIssueNotification(issue: Issue) -> Notification[Issue]:
# If configuring a notification with an object link, you must declare the object type as part of the return type

    # Link to the Issue object in the platform
    links = [
        NotificationObjectLink(label="Issue", objectTarget=issue)
    ]

    #Create a short notification that will be shown within the platform
    platform_notification = PlatformNotification(
        heading="New issue",
        content="A new issue has been assigned to you.",
        links=links
    )

    # Define the email body. The email body may contain headless HTML, such as tables of data
    emailBody = f"Hello, \n A new issue has been assigned to you: {issue.description}."

    email_notification = EmailNotification(
            subject="New issue",
            body=emailBody,
            links=links
        )

    return Notification(platform_notification, email_notification)
```

### Retrieve users and groups

In addition to having a `User` passed into the function, you may retrieve a `User` or `Group` on demand. Suppose that the `Issue` object has an `assignee` field that contains a user ID. In the example below, the function returns a notification that reminds the user about the issue:

```typescript tab="TypeScript v1"
import { EmailNotificationContent, Function, Notification, ShortNotification, User, UserFacingError, Users } from "@foundry/functions-api";
import { Issue } from "@foundry/ontology-api";

export class NotificationFunctions {
    @Function()
    public async createIssueReminderNotification(issue: Issue): Promise<Notification> {
        if (!issue.assignee) {
            throw new UserFacingError("Cannot create notification for issue without an assignee.");
        }

        const user = await Users.getUserByIdAsync(issue.assignee);

        const emailBody = `Hello, ${user.firstName},

This is a reminder to investigate the following issue: ${issue.description}`;

        // You can also use this structure to build the entire notification inline
        return Notification.builder()
            .shortNotification(ShortNotification.builder()
                .heading("Issue reminder")
                .content("Investigate this issue.")
                .addObjectLink("Issue", issue)
                .build())
            .emailNotificationContent(EmailNotificationContent.builder()
                .subject("New issue")
                .body(emailBody)
                .addObjectLink("Issue", issue)
                .build())
            .build();
    }
}
```

```typescript tab="TypeScript v2"
import { NotificationLink, Notification } from "@osdk/functions";
import { Users } from "@osdk/foundry.admin";
import { Issue } from "@ontology/sdk";
import { Client } from "@osdk/client";

export default async function createIssueReminderNotification(client: Client, issue: Issue): Promise<Notification> {
    const user = await Users.get(client, issue.assignee);

    const emailBody = `Hello, ${user.firstName},

This is a reminder to investigate the following issue: ${issue.description}`;

    // You can also use this structure to build the entire notification inline
    const links: NotificationLink[] = [
        {
            label: "Issue",
            linkTarget: {
                type: "object",
                object: issue
            }
        }
    ]

    // You can also use this structure to build the entire notification inline
    return {
        platformNotification: {
            heading: "Issue reminder",
            content: "Investigate this issue.",
            links:  links
        },
        emailNotification: {
            subject: "New issue",
            body: emailBody,
            links: links
        }
    }
}
```

```python tab="Python"
from functions.api import function, Notification, PlatformNotification, NotificationObjectLink, EmailNotification
from ontology_sdk.ontology.objects import Issue
from foundry_sdk import FoundryClient
import foundry_sdk

@function()
def createIssueReminderNotification(issue: Issue) -> Notification[Issue]:
    client = FoundryClient(auth=foundry_sdk.UserTokenAuth(...), hostname="example.palantirfoundry.com")

    user = client.admin.User.get(issue.assignee)

    # Link to the Issue object in the platform
    links = [
        NotificationObjectLink(label="Issue", objectTarget=issue)
    ]

    #Create a short notification that will be shown within the platform
    platform_notification = PlatformNotification(
        heading="Issue reminder",
        content="Investigate this issue.",
        links=links
    )

    # Define the email body. The email body may contain headless HTML, such as tables of data
    # Note that you can access properties of both the user and the issue in the content
    emailBody = f"Hello, {user.firstName}, \n A new issue has been assigned to you: {issue.description}."

    email_notification = EmailNotification(
            subject="Issue reminder",
            body=emailBody,
            links=links
        )

    return Notification(platform_notification, email_notification)

```

### Return recipients

The `Notification` API documented above allows you to return custom notification content. Another way you can use functions to configure notifications is by returning a list of recipients for the notification. To do so, create a function that returns one or more `Principal` objects, such as `User` or `Group` objects.

In the example below, the function returns both the user who reported the issue and the user who is currently assigned to the issue:

```typescript tab="TypeScript v1"
import { Function, User, Users } from "@foundry/functions-api";
import { Issue } from "@foundry/ontology-api";

export class NotificationFunctions {
    /**
     * Given an Issue, returns users representing the current assignee for the Issue and the user
     * who originally reported the issue.
     */
    @Function()
    public async getIssueAssigneeAndReporter(issue: Issue): Promise<User[]> {
        if (!issue.assignee || !issue.reporter) {
            throw new UserFacingError("Cannot create notification for issue without an assignee or reporter.");
        }

        const user = await Users.getUserByIdAsync(issue.assignee);
        const issueReporter = await Users.getUserByIdAsync(issue.reporter);

        return [user, issueReporter];
    }
}
```

```typescript tab="TypeScript v2"
import { UserId, Principal } from "@osdk/functions";
import { Users, Groups } from "@osdk/foundry.admin";
import { Issue } from "ontology_sdk";
import { Client } from "@osdk/client";

/**
 * Given an Issue, returns users representing the current assignee for the Issue and the user
 * who originally reported the issue.
 */
async function getIssueAssigneeAndReporter(client: Client, issue: Issue): Promise<UserId[]> {
    const user = await Users.get(client, issue.assignee);
    const issueReporter = await Users.get(client, issue.reporter);

    return [user.id, issueReporter.id];
}

/**
 * Given an Issue, returns the user who is the current assignee of the issue and the group that issue belongs to.
 */
async function getIssueAssigneeAndGroups(client: Client, issue: Issue): Promise<Principal[]> {
    // To return both groups and users, return the Principal type.

    const user = await Users.get(client, issue.assignee);
    const group = await Groups.get(client, issue.group);

    return [{type: "user", id: user.id}, {type: "group", id: group.id}];
}
```

```python tab="Python"
from functions.api import Array, function, Principal, UserId
from ontology_sdk.ontology.objects import Issue
from foundry_sdk import FoundryClient
import foundry_sdk

# Given an Issue, returns users representing the current assignee for the Issue and the user
# who originally reported the issue.
@function()
def getIssueAssigneeAndReporter(issue: Issue) -> Array[UserId]:
    client = FoundryClient(auth=foundry_sdk.UserTokenAuth(...), hostname="example.palantirfoundry.com")

    user = client.admin.User.get(issue.assignee)
    issueReporter = client.admin.User.get(issue.reporter)

    return [user.id, issueReporter.id]

# Given an Issue, returns the user who is the current assignee of the issue and the group that issue belongs to.
@function()
def getIssueAssigneeAndGroup(issue: Issue) -> Array[Principal]:
    # To return both groups and users, return the Principal type.
    client = FoundryClient(auth=foundry_sdk.UserTokenAuth(...), hostname="example.palantirfoundry.com")

    user = client.admin.User.get(issue.assignee)
    group = client.admin.Group.get(issue.group)

    return [Principal.user(user.id), Principal.group(group.id)]

```
