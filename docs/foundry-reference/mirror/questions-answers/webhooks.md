<!-- source: https://palantir.com/docs/foundry/questions-answers/webhooks/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Webhooks

### What causes the `CannotUseSynchronousWebhookOutputFromOptionalWebhook` error, and how can it be resolved?

The error is caused by the function that generates input for the webhook having an optional return type, which means it could return undefined. If the function returns undefined, the webhook will not run. The resolution is to ensure that the function does not return an undefined value, thus making the webhook non-optional.

*Timestamp:* April 16, 2024

### Is it possible to save a PDF from a webhook call into a dataset or media set?

No, it is not currently possible to save a PDF from a webhook call into a dataset or a media set.

*Timestamp:* May 19, 2024

### Is it possible to execute a webhook without `Editor` permissions on the associated Source?

Yes, this is possible; to do so, set up a [custom role](/docs/foundry/platform-security-management/manage-roles/) for executing webhooks, which allows users to execute a webhook without requiring `Editor` permissions on the webhook source.

*Timestamp:* July 26, 2024

### How can I perform two API calls with different domains?

You can add multiple domains to the source to perform API calls with different domains.

*Timestamp:* July 26, 2024
