<!-- source: https://palantir.com/docs/foundry/api/v2/third-party-applications-v2-resources/versions/get-version/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Version

`GET /api/v2/thirdPartyApplications/{thirdPartyApplicationRid}/website/versions/{versionVersion}`

Get the Version with the specified version.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `third-party-application:deploy-application-website`.

Scopes: `third-party-application:deploy-application-website`

## Path parameters

- `thirdPartyApplicationRid` · string · required
  "An RID identifying a third-party application created in Developer Console."
- `versionVersion` · string · required
  "The semantic version of the Website."

## Response

- `Version` · object · required
  - `version` · string · required
    "The semantic version of the Website."

## Errors

- `VersionNotFound` (NOT_FOUND) — "The given Version could not be found."
