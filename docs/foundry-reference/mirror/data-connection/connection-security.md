<!-- source: https://palantir.com/docs/foundry/data-connection/connection-security/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Connection security

Data Connection establishes outbound TLS connections to external data sources. Not all cipher suites used in TLS connections are supported throughout the platform.

## Supported suites

Data Connection supports the following cipher suites for outbound connections, provided they are supported by the underlying Java version. Additional cipher suites may be available depending on your environment's configuration and connection origination point.

:::callout{theme="neutral"}
Contact Palantir Support with questions about additional cipher suites that may be available based on your environment's configuration and connection origin point.
:::

### TLS 1.3

| IANA name                      | OpenSSL name                   |
|--------------------------------|--------------------------------|
| `TLS_AES_256_GCM_SHA384`       | `TLS_AES_256_GCM_SHA384`       |
| `TLS_AES_128_GCM_SHA256`       | `TLS_AES_128_GCM_SHA256`       |
| `TLS_CHACHA20_POLY1305_SHA256` | `TLS_CHACHA20_POLY1305_SHA256` |

### TLS 1.2

| IANA name                                       | OpenSSL name                    |
|-------------------------------------------------|---------------------------------|
| `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384`       | `ECDHE-ECDSA-AES256-GCM-SHA384` |
| `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256`       | `ECDHE-ECDSA-AES128-GCM-SHA256` |
| `TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256` | `ECDHE-ECDSA-CHACHA20-POLY1305` |
| `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`         | `ECDHE-RSA-AES256-GCM-SHA384`   |
| `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256`   | `ECDHE-RSA-CHACHA20-POLY1305`   |
| `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`         | `ECDHE-RSA-AES128-GCM-SHA256`   |
| `TLS_DHE_RSA_WITH_AES_256_GCM_SHA384`           | `DHE-RSA-AES256-GCM-SHA384`     |
| `TLS_DHE_RSA_WITH_CHACHA20_POLY1305_SHA256`     | `DHE-RSA-CHACHA20-POLY1305`     |
| `TLS_DHE_DSS_WITH_AES_256_GCM_SHA384`           | `DHE-DSS-AES256-GCM-SHA384`     |
| `TLS_DHE_RSA_WITH_AES_128_GCM_SHA256`           | `DHE-RSA-AES128-GCM-SHA256`     |
| `TLS_DHE_DSS_WITH_AES_128_GCM_SHA256`           | `DHE-DSS-AES128-GCM-SHA256`     |
| `TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA384`       | `ECDHE-ECDSA-AES256-SHA384`     |
| `TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384`         | `ECDHE-RSA-AES256-SHA384`       |
| `TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256`       | `ECDHE-ECDSA-AES128-SHA256`     |
| `TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256`         | `ECDHE-RSA-AES128-SHA256`       |
| `TLS_DHE_RSA_WITH_AES_256_CBC_SHA256`           | `DHE-RSA-AES256-SHA256`         |
| `TLS_DHE_DSS_WITH_AES_256_CBC_SHA256`           | `DHE-DSS-AES256-SHA256`         |
| `TLS_DHE_RSA_WITH_AES_128_CBC_SHA256`           | `DHE-RSA-AES128-SHA256`         |
| `TLS_DHE_DSS_WITH_AES_128_CBC_SHA256`           | `DHE-DSS-AES128-SHA256`         |
| `TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA`          | `ECDHE-ECDSA-AES256-SHA`        |
| `TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA`            | `ECDHE-RSA-AES256-SHA`          |
| `TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA`          | `ECDHE-ECDSA-AES128-SHA`        |
| `TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA`            | `ECDHE-RSA-AES128-SHA`          |
| `TLS_DHE_RSA_WITH_AES_256_CBC_SHA`              | `DHE-RSA-AES256-SHA`            |
| `TLS_DHE_DSS_WITH_AES_256_CBC_SHA`              | `DHE-DSS-AES256-SHA`            |
| `TLS_DHE_RSA_WITH_AES_128_CBC_SHA`              | `DHE-RSA-AES128-SHA`            |
| `TLS_DHE_DSS_WITH_AES_128_CBC_SHA`              | `DHE-DSS-AES128-SHA`            |

### Verify your external system accepts a supported cipher suite

To verify that your external system accepts a supported cipher suite, run `openssl s_client -connect your-system.example.com:<port> -tls1_3 </dev/null` (or `-tls1_2` for TLS 1.2). The negotiated suite appears on the cipher line of the SSL-Session block in the output. To test a specific suite from the supported list, add `-ciphersuites '<cipher_iana_name>'` for TLS 1.3 or `-cipher '<cipher_openssl_name>'` for TLS 1.2. An `SSLHandshakeException` containing `handshake_failure`, `no cipher match`, or `protocol is disabled or cipher suites are inappropriate` indicates a cipher mismatch, so you should update the cipher configuration on your external system to enable one of the supported suites. You can also run `openssl` against the same network path your source uses from the [source terminal](/docs/foundry/data-connection/troubleshooting/#openssl).

## Vulnerability scan findings on agent hosts

A vulnerability scanner running on an agent host may report findings against files that belong to earlier versions of the agent software or connector plugins. In almost all cases these are inactive files that are no longer loaded or run. The agent uses only the current version of each component, so a finding against a superseded file does not mean the agent is running vulnerable code.

These files are left behind by normal upgrades. When an agent upgrades to a new version, the version it replaces is kept on the host for up to 30 days and then deleted automatically. Security fixes, including for known Common Vulnerabilities and Exposures (CVEs), are delivered as new versions, and agents upgrade to the latest available version automatically during their [upgrade window](/docs/foundry/data-connection/agent-configuration-reference/#automatic-upgrade-windows). Configuring an upgrade window for each agent ensures it is running the latest fixes. To learn more about how Palantir identifies, discloses, and patches vulnerabilities, see [Monitoring for vulnerabilities](/docs/foundry/security/monitor-for-vulnerabilities/).

To resolve a finding without waiting for the automatic 30-day cleanup, you can delete the affected backups, caches, and archived plugin versions yourself. See [Backups and caches](/docs/foundry/data-connection/agent-configuration-reference/#backups-and-caches) for instructions, including how to identify which versions are still in use.

:::callout{theme="warning"}
It's important to regularly upgrade versions and check vulnerability scans, remediating any issues promptly.
:::
