<!-- source: https://palantir.com/docs/foundry/authentication/scim-overview/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Overview

:::callout{theme="warning"}
SCIM is in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.
:::

Foundry supports automated user and group provisioning via the System for Cross-domain Identity Management (SCIM) 2.0 protocol. SCIM allows identity providers to synchronize user and group data with Foundry, streamlining onboarding and offboarding and keeping access control up to date continuously, rather than only at login.

The sections below provide step-by-step configuration guidance for **Microsoft Entra ID** (formerly known as Azure AD). However, Foundry is compatible with any identity provider that supports the SCIM 2.0 protocol. See [Use other identity providers](/docs/foundry/authentication/scim-other-idp/) for guidance on configuring providers not covered here.
