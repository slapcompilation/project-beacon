<!-- source: https://palantir.com/docs/foundry/data-connection/listeners-email-security/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Email listener security

Email listeners apply multiple layers of security validation to incoming emails before processing them.

## Email authentication

All incoming emails must pass the following AWS SES authentication checks before they are accepted.

| Check | Description |
|-------|-------------|
| **SPF** (Sender policy framework) | Verifies that the sending server is authorized to send on behalf of the sender's domain. |
| **DKIM** (DomainKeys identified mail) | Verifies that the email has not been tampered with in transit using cryptographic signatures. |
| **DMARC** (Domain-based message authentication) | Verifies that the email aligns with the sender domain's published authentication policy. |
| **Spam detection** | Scans the email for known spam indicators. |
| **Virus scanning** | Scans email content and attachments for malware. |

If any of these checks fail, the email is rejected and is not forwarded for processing.

## Sender allowlist

Each email listener must be configured with a sender allowlist that controls which senders can deliver email to the listener. You can restrict access to the following:

* **Specific email addresses:** Only emails from the listed addresses are accepted.
* **Entire domains:** All emails from a given domain are accepted.

:::callout{theme="warning" title="Security"}
By default, email listeners do not accept email from any sender. You must explicitly configure which senders are permitted before the listener will process any incoming email.
:::

## Attachment restrictions

To prevent the delivery of potentially malicious content, email listeners block certain MIME types by default. Blocked types include executable and script formats, such as:

* Application executables (for example, `.exe`, `.msi`)
* Shell scripts (for example, `.sh`, `.bat`)
* JavaScript files

## Size limits

Individual email messages, including all attachments, are limited to 40 MB. Emails exceeding this limit are rejected.
