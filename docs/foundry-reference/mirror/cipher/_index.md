<!-- source: https://palantir.com/docs/foundry/cipher/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Cipher

Cipher is a service that allows users to obfuscate data using cryptographic operations (encryption, decryption, or hashing). Cipher manages algorithms and cryptography keys through **Channels** and **Licenses**. These concepts allow for secure management and enable new users (including users who do not code or those without specialized knowledge) to deploy privacy-enhancing tools in legible and reliable ways.

* [Cipher Channels](/docs/foundry/cipher/core-concepts/#channels) reliably manage cryptographic algorithms and keys.
* [Cipher Licenses](/docs/foundry/cipher/core-concepts/#licenses) allow users to control permissions and apply cryptographic operations to workflows (e.g. bulk encrypt columns of a dataset, decrypt individual values in [Object Explorer](/docs/foundry/object-explorer/overview/), and so on).

:::callout{theme="neutral"}
Foundry uses sophisticated encryption at the storage and network levels to secure data in transit and at rest. Cipher provides an additional layer on top of those protections, giving users the tools to configure privacy and governance protections in operational workflows.
:::

![Workflow of a decryption request with Cipher](./images/decryption_request.gif)
