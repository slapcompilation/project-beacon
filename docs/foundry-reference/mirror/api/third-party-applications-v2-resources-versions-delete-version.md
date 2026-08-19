<!-- source: https://palantir.com/docs/foundry/api/third-party-applications-v2-resources/versions/delete-version/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Delete Version

`DELETE /api/v2/thirdPartyApplications/{thirdPartyApplicationRid}/website/versions/{versionVersion}`

Delete the Version with the specified version.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `third-party-application:deploy-application-website`.

Scopes: `third-party-application:deploy-application-website`

## Path parameters

- `thirdPartyApplicationRid` · string · required
  "An RID identifying a third-party application created in Developer Console."
- `versionVersion` · string · required
  "The semantic version of the Website."

## Errors

- `DeleteVersionPermissionDenied` (PERMISSION_DENIED) — "Could not delete the Version."
