<!-- source: https://palantir.com/docs/foundry/getting-started/file-support-ticket/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# File a support ticket

If you were not able to find an appropriate solution to your issue after reviewing the [available resources](/docs/foundry/getting-help/overview/#2-search-the-issues-application-and-the-developer-community), it is time to file a support ticket.

Filing a ticket ensures your question or request is tracked, prioritized appropriately, and escalated where necessary.

To make the support process more efficient, follow these steps to compile valuable information for filing a support ticket:

<!-- TOC -->

* [1. Create an example](#1-create-an-example)
* [2. Share relevant assets](#2-share-relevant-assets)
* [3. Report the issue](#3-report-the-issue)

<!-- /TOC -->

:::callout{theme="neutral" title="Prerequisite"}
Make sure you have already diagnosed your issue using the steps provided on the [Get help page](/docs/foundry/getting-help/overview/), reviewed the guide on [Debug using Chrome™ DevTools](/docs/foundry/getting-help/debug-using-devtools/) and [HTTP error codes](/docs/foundry/getting-help/http-error-codes/) before following through with the instructions below.
:::

## 1. Create an example

When asking a question about a problem you encounter, providing clear steps that we can use to reproduce the problem will ensure a speedy resolution. These should be:

* **Minimal:** Use as few steps as possible while still producing the problem.
* **Complete:** Provide all parts needed to reproduce the problem.
* **Verifiable:** Test the workflow you are about to provide to make sure it reproduces the problem.

A minimal, complete, and verifiable example helps us reproduce the problem outside your environment and in return, makes it easier to get to the root cause of your problem and reach a faster resolution.

In the Palantir context, such an example can either be a series of steps that reproduces the behavior or a minimal resource that reproduces the issue. Generally, it is useful to include expected behavior versus the observed behavior as part of your example.

### Tips

Here are some tips for creating a minimal, complete, and verifiable example:

* Start by identifying the steps required to reproduce the issue. The more specific and detailed these steps are, the easier it will be for someone else to reproduce the issue.
* Make sure that your example is minimal, meaning that it includes only the bare minimum amount of information needed to reproduce the issue. This will help to narrow down the potential causes of the issue and make it easier to fix.
* Include the expected result of the steps you provided, as well as the actual result. This will help others to understand the problem and determine if they are experiencing the same issue.
* Make sure that your example is complete, meaning that it includes all the information necessary to reproduce the issue. If you leave out any important details, it will be difficult for others to reproduce the issue and help you solve the problem.
* Finally, make sure that your example is verifiable, meaning that others can easily reproduce the issue using the information you provided. If your example is not verifiable, it will be difficult for others to help you fix the problem.

### Example

The following is an historical example of a minimal, complete, and verifiable issue that has been resolved.

Steps to reproduce the problem at the time:

1. Open the Code Repository application.
2. Add the Graphframes library using the sidebar.
3. Run a check on the repository.

Expected behavior: The library should be added to the Code Repository without any errors.

Actual problematic behavior: An error message is displayed, saying "o257.loadClass.: java.lang.ClassNotFoundException:<Class>"

Additional information:

* Here are the other packages in my profile: Python 3.12.\*, etc.
* I have already tried to do x, y, and z.
* There have been no recent changes to this Code Repository other than the addition of this package.
* This appears to affect users of this package.

This example includes only the bare minimum steps needed to reproduce the issue and does not require any proprietary data. The example is considered complete because it includes all the necessary information, such as the expected and actual behavior, as well as additional context like troubleshooting that has already been conducted. It is verifiable because the error message can be reproduced using the same steps. By providing this information, Support will be able to quickly reproduce the problem and work on resolving it.

If you are interested in the fix provided for this issue, [review packages which require both a Conda package and a jar](/docs/foundry/code-workbook/environment-troubleshooting/#packages-which-require-both-a-conda-package-and-a-jar).

## 2. Share relevant assets

With a verifiable example in text, compile the following additional assets for Support:

* Include any findings from your own investigation as performed in step 1.
* Provide the full text of any build errors or error messages displayed.
* Copy and paste the text of any errorID/errorInstanceID to enable us to do a backend review.
* Where possible and appropriate, share all the relevant resources with Palantir Support.
  * The relevant resource(s) (Slate dashboard, Analysis, Code Repository).
  * The datasets underlying the resource(s).
  * Any upstream datasets that the resource(s) depends on.

## 3. Report the issue

To report an issue while in the specified application, navigate to **Support > Report issue** (or **Support > Contact support**) and [follow the wizard](/docs/foundry/getting-help/issues/).

As an alternative approach, you may also request support from other users in the [Palantir Developer Community ↗](https://community.palantir.com/).

When posting on public forums such as the Palantir Developer Community, remember to remove all sensitive data prior to posting.

***

Chrome™ is a trademark of Google Inc.

\[1]: Note: AIP feature availability is subject to change and may differ between customers.
