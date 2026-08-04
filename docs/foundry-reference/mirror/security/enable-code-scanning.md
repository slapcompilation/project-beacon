<!-- source: https://palantir.com/docs/foundry/security/enable-code-scanning/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Enable code scanning

As an enrollment admin, you can turn scanning on for repositories in your enrollment through Control Panel.

Find the **Code scanning** settings page by following the instructions below:

1. Navigate to **Control Panel** for your enrollment.
2. From the left sidebar, choose **All Settings**.
3. Scroll to **Security & Governance > Code scanning**.

![Code scanning settings.](/docs/resources/foundry/security/code-scanning-settings-page.png)

To enable code scanning for all the repositories in your enrollment, toggle the option on.

![Toggle option to enable code scanning for all the repositories in your enrollment.](/docs/resources/foundry/security/code-scanning-toggle-button.png)

## Repository scanning overrides

If you would rather enable or disable code scanning for a selected number of repositories, add repositories to the **Always scan repositories** or **Never scan repositories** sections.

Repositories included in **Always scan repositories** will be scanned for vulnerabilities, even if code scanning is not enabled for your enrollment. Conversely, repositories listed under **Never scan repositories** will not be scanned for vulnerabilities, regardless of your enrollment’s code scanning status.

![Repository scanning overrides.](/docs/resources/foundry/security/code-scanning-overrides.png)

## Scan modes

Scan modes determine what happens to checks if vulnerabilities are detected after a code scan is completed.

* **Error:** In error mode, checks will fail if vulnerabilities are detected. The user is required to fix the issues and re-run checks.
* **Warn:** In warn mode, checks will proceed, and detected vulnerabilities will be ignored.

![Available scan modes for selection.](/docs/resources/foundry/security/code-scanning-scan-modes.png)
