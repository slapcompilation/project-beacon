<!-- source: https://palantir.com/docs/foundry/security/protect-malicious-files/ · mirrored 2026-08-12 from Palantir Foundry docs -->

# Protecting against malicious files

Most IT and Security teams maintain tools and controls to prevent the presence of malicious files on computers. Such controls generally include network-based or endpoint-based scanning and monitoring, and they should ideally cover the entirety of your IT footprint (user workstations, administrative systems, servers, etc.).

When your team begins using Foundry for syncing and storing files, it’s important to also include Foundry as in-scope for protection against malicious files and malware.

## Foundry controls

Foundry is a large-scale data platform with unlimited use cases and potential functionality. As such, Foundry does not place blanket restrictions on uploading of certain potentially risky files or filetypes, such as executables. Rather, Foundry has security measures in place to safely accommodate use cases that may require unrestricted uploading.

Security controls on file uploads in Foundry include:

* Binary execution restrictions on upload endpoints.
* Process isolation for the upload service preventing escalation of privileges or lateral movement.
* File size limits on front-end imports.

## Additional recommendations

Although Foundry’s platform-based file controls serve as effective mitigations against malicious files, Foundry exists as part of a [shared security responsibility model](/docs/foundry/security/shared-security-responsibility-model/), and our Security engineers recommend that Foundry customers maintain additional security controls in their environment(s) to prevent the propagation of malware:

* Customer systems should run reputable, up-to-date antimalware tooling.
* Antimalware tooling should ideally offer periodic scans, and real-time detection.
* Customers should enforce use of the native malware protections present in most major web browsers.

If you’re a Palantir customer with any questions or concerns regarding malicious file controls, feel free to ask your Palantir representative for guidance, and our engineers will be happy to assist.
