<!-- source: https://palantir.com/docs/foundry/security/protect-tokens-api-keys/ · mirrored 2026-08-12 from Palantir Foundry docs -->

# Protecting tokens and API keys

It is important for Foundry users to protect their tokens, API keys, and other authentication material. If tokens are spilled externally (unintentionally exposed) or are compromised by a malicious actor, an unauthorized third-party may be able to access Foundry under the user context of the compromised token.

## Tokens

Foundry uses several different types of tokens:

* [User-generated tokens](#user-generated-tokens)
* [Session token](#session-token)
* [Data connector coordinator token](#data-connector-coordinator-token)

### User-generated tokens

A user-generated token (or personal access token) is an API key that grants user-level access to all applications in the platform. Users may specify a time-to-live (TTL) for a token on creation. The TTL is the maximum time that the access token will be valid for use. Once the TTL expires, the token is revoked.

One security property of user-generated tokens is that they are unable to generate other user-generated tokens. Only a session token can be used to create a new user-generated token. [Learn how to generate this kind of token.](/docs/foundry/platform-security-third-party/user-generated-tokens/#generation)

### Session token

A session token is an ephemeral, time-bound token stored in your browser as a cookie (PALANTIR\_TOKEN). When a session token is generated, the token is automatically assigned a time-to-live (TTL). The default TTL is 16 hours. Once the TTL expires, the token is revoked.

### Data connector coordinator token

A data connector coordinator token is used to authenticate a data connector agent with a Foundry installation. By default, this token is stored in `{BOOTVISOR_DIRECTORY}/var/data/coordinator-token.json`. The data connector coordinator token grants agent-specific access to the platform.

When a new data connector is created, a time-bound token is dynamically inserted into the deployment tarball. This tarball should be treated as sensitive as it contains authentication material within it.

If a data connector agent is configured with credentials to other data sources (such as a SQL database), additional credential material may be cached or stored locally within the agent.

## Best practices for tokens

To prevent your tokens and API keys from being compromised or abused, we recommend the following best practices and behaviors:

1. Never give tokens to another user or post tokens publicly.
2. Ideally use environment variables when locally working with tokens.
3. If you choose to use dotfiles for token storage, ensure that the dotfiles are excluded from version control.
4. Do not put tokens into command line arguments.
5. Do not hardcode tokens in scripts or software.
6. Revoke unused or unnecessary tokens.
7. Apply reasonable time-to-live values for user-generated tokens.
8. Do not use browser-based cookie synchronization technologies for other devices.
9. Minimize the number of browser extensions you use.

## Token spills

A token is “spilled” if the token is exposed or made accessible on an unauthorized system, such as being accidentally published to a publicly-available repository. Any spill of a token should be treated as an information security incident. You should take immediate action to disable the token, and then notify your information security team of the issue. Steps for disabling different types of tokens are available below.

### Revoke user-generated tokens

You can revoke user-generated tokens in the Foundry user interface. Learn how in the [user-generated token](/docs/foundry/platform-security-third-party/user-generated-tokens/#revoke) documentation.

### Revoke session tokens

To revoke a session token, simply log out of the Foundry instance.

## GitHub token revocation service

Palantir’s Information Security team runs an automated service that will attempt to identify and revoke spilled tokens in source control on [Github.com ↗](https://github.com/). If a token is leaked into a public repository on GitHub, the GitHub token revocation service will be notified and will automatically attempt to revoke the token on your behalf.

The GitHub token revocation service is unable to notify you if this revocation occurs. Additionally, if your Foundry installation is not network-accessible from the service, the service will be unable to automatically revoke the token for you.
