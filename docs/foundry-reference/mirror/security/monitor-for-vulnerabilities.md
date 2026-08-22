<!-- source: https://palantir.com/docs/foundry/security/monitor-for-vulnerabilities/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Monitoring for vulnerabilities

## Vulnerability Management

Palantir maintains an aggressive vulnerability management program and corresponding service level agreements (SLAs) for patching. This program includes vulnerabilities in our software products and in underlying infrastructure.

## Palantir Security Bulletins

Palantir maintains and [publicly releases security bulletins ↗](https://palantir.safebase.us/) related to security issues we have identified in our supported software products. Where possible, common vulnerabilities and disclosures (CVEs) are also issued.

These security bulletins include a summary of the issue, background context including scope and impact, remediation steps, and a timeline.

We endeavor to publicly disclose issues no more than 30 days after an issue has been identified, fixed, and communicated to our customers. We reserve the right to delay this disclosure deadline as needed for information security or other purposes.

If you are a Palantir customer, you will be provided private, embargoed security bulletins as part of our vulnerability management process. These may be forwarded to you via automated means, or by your Palantir representative.

We encourage all customers to subscribe to our [Safebase site ↗](https://palantir.safebase.us/) to be alerted when new security bulletins are made public.

## Vulnerabilities in User-authored Code

One of the features of Palantir Foundry is for users to author arbitrary code. This code can import or rely on software packages, including those that may contain known security vulnerabilities.

Palantir will provide patched and updated versions of common software packages and bundles. However, automatically migrating user-authored code to these newer versions may break pipelines or integrations. Additionally, we cannot account for updating and managing all versions of all software used by Foundry users.

As such, it is a customer responsibility to manage the software versions present in dependencies and packages that are used in the authoring by your users. In extreme circumstances, Palantir may push breaking package upgrades to mitigate critical security issues (e.g. log4j) without notice or warning.
