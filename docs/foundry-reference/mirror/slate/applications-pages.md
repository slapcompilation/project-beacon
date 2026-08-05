<!-- source: https://palantir.com/docs/foundry/slate/applications-pages/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Applications pages

Pages offer application builders the ability to split application UI, logic, and resources (for example, [queries](/docs/foundry/slate/concepts-queries/), [variables](/docs/foundry/slate/concepts-variables/), [functions](/docs/foundry/slate/concepts-functions/), and [events](/docs/foundry/slate/concepts-events/)) into different pages within a single application, providing isolated scope for each page that loads separately.

Splitting up the logic of a complex Slate application into pages not only simplifies refactoring but also enhances stability, maintainability, and performance. By using pages and shared variables effectively, developers can create well-organized, efficient applications that elevate both performance and user experience.

## Create a new page

To add a page to a Slate application:

1. Select the **+** option in the **Pages** panel.
2. Enter the page name.

<img src="./media/page-add.png" alt="Add page to a Slate app." width="450">

:::callout{theme="neutral"}
You can share a link directly to a specific page within a Slate application by using a page's name in the URL.
:::

<img src="./media/link-to-page.png" alt="Link to a specific page in the URL." width="650">

## Delete a page

To delete a page from a Slate application, open the **...** dropdown menu in-line with the specific page in the **Pages** panel, then select **Delete**.

<img src="./media/page-delete.png" alt="Delete a page from a Slate app." width="450">

## Navigate between pages

The [onNavigate\[page\_name\]](/docs/foundry/slate/concepts-events-and-actions-index/#slateonnavigatepage_name) event and [navigateTo\[page\_name\]](/docs/foundry/slate/concepts-events-and-actions-index/#slatenavigatetopage_name) action allow for simple navigation between pages within the same application.

The URL updates accordingly when navigating between pages.

## State sharing between pages

"Application state" refers to the condition or status of an application at any given moment. It encompasses all the variables, user inputs, settings, and configurations that can influence the behavior and output of the application.

For instance, in a shopping app, the application state might include the items a user has added to their cart, the user's preferences, whether the user is logged in or not, and so on.

Sharing application state between pages is done using [shared variables](/docs/foundry/slate/concepts-variables/#creating-a-variable) which can be referenced from any page across the entire application.

For example, a function or user interaction on one page can set or modify the value of a shared variable, while another page can read from and use that value to allow for cross-page communication.

<img src="./media/shared-variable.png" alt="Add a shared variable to share state across pages." width="450">

Use the [user storage](/docs/foundry/slate/concepts-variables/#user-storage-variable) variable to store application state information for individual users that needs to persist across application loads, such as user preferences for a specific application. The user storage variable is also accessible from any page across the application.
