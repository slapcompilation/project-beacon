<!-- source: https://www.palantir.com/docs/foundry/superrepo/foundry-cli/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Foundry CLI

:::callout{theme="neutral" title="Beta"}
SuperRepo is in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.
:::

The Foundry CLI (`foundry`) is a command-line tool for developing SuperRepos from your own machine, whether the repository is hosted inside or outside the Palantir platform. It runs on macOS, Windows, and Linux. Use it to scaffold projects from templates and to build, preview, and deploy your project.

## Installation

You can install the Foundry CLI by following the steps in this section, or through an interactive installation flow in the Palantir platform. To open that flow, append `/workspace/code/superrepo` to your enrollment's root address.

:::callout{theme="neutral" title="Recommended flow"}
Where possible, install through the in-platform flow. It provisions a more restricted token for the installation than the [user-generated token](/docs/foundry/platform-security-third-party/user-generated-tokens/) the steps below require, which makes it the more secure option.
:::

### Step 1: Set your Foundry URL

Set `FOUNDRY_URL` in your terminal session to the root address of your enrollment.

```bash tab="macOS / Linux"
export FOUNDRY_URL="insert_domain_here"
```

```powershell tab="PowerShell (Windows)"
$env:FOUNDRY_URL = "insert_domain_here"
```

### Step 2: Provide a token to the installer

For your Foundry enrollment, [generate a token](/docs/foundry/platform-security-third-party/user-generated-tokens/) and set it in the same terminal session. User-generated tokens have no scope setting, so no particular scope is required.

```bash tab="macOS / Linux"
export TOKEN="insert_token_here"
```

```powershell tab="PowerShell (Windows)"
$env:TOKEN = "insert_token_here"
```

The `FOUNDRY_URL` and `TOKEN` variables are read by the installation command in Step 3, which downloads the CLI from your enrollment. They are not the credentials that the CLI itself uses once installed; you establish those with `foundry login` in the next section. Because this token is only needed to install the CLI, you can delete it once you have signed in, and an installed CLI is unaffected if it expires.

### Step 3: Install the CLI

Run the installation command for your operating system. The CLI is always downloaded from your enrollment; it is not distributed through a package manager or as a standalone download.

On Windows, `install-foundry.bat` is downloaded using the `$env:FOUNDRY_URL` and `$env:TOKEN` values you set in Steps 1 and 2, so run those steps in the same PowerShell session first.

```bash tab="macOS / Linux"
curl -sS "$FOUNDRY_URL/code/api/extension/install-script" -H "Authorization: Bearer $TOKEN" | bash
```

```powershell tab="PowerShell (Windows)"
Invoke-WebRequest -Uri "$env:FOUNDRY_URL/code/api/extension/install-bat" -Headers @{ Authorization = "Bearer $env:TOKEN" } -OutFile "install-foundry.bat"
.\install-foundry.bat
```

## Authenticate with Foundry

Sign in to your Foundry enrollment so the CLI can reach the platform as you develop your SuperRepo project.

```bash
foundry login
```

The command prompts you for your Foundry URL and a token, then stores the credentials that every subsequent CLI command uses, including the local development servers and `foundry deploy`. To sign in without prompts, supply the token in the `FOUNDRY_TOKEN` environment variable and the enrollment URL with the `--foundry-url` option. Use this form in a CI system.

If commands begin failing with an authorization error, the credentials stored by `foundry login` have expired. Re-authorize in your browser with the following command:

```bash
foundry login refresh
```

## Update the CLI

The Foundry CLI can update itself to the latest version.

```bash
foundry update self
```

## Learn more

To find out the full capabilities of the Foundry CLI, you can list the options.

```bash
foundry --help
```

For more information on the workflows the CLI supports, review [Create a SuperRepo](/docs/foundry/superrepo/create-a-superrepo/), [Prepare for your first deployment](/docs/foundry/superrepo/prepare-first-deploy/), and [Advanced workflows](/docs/foundry/superrepo/advanced-workflows/).
