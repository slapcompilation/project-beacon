<!-- source: https://palantir.com/docs/foundry/api/v2/third-party-applications-v2-resources/versions/upload-version/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Upload Version

`POST /api/v2/thirdPartyApplications/{thirdPartyApplicationRid}/website/versions/upload`

Upload a new version of the Website.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `third-party-application:deploy-application-website`.

Scopes: `third-party-application:deploy-application-website`

## Path parameters

- `thirdPartyApplicationRid` · string · required
  "An RID identifying a third-party application created in Developer Console."

## Query parameters

- `version` · string · required
  "The semantic version of the Website."

## Request

- `body` · string · required
  "The zip file that contains the contents of your application. For more information, refer to the [documentation](/docs/foundry/ontology-sdk/deploy-osdk-application-on-foundry/) user documentation."

## Response

- `Version` · object · required
  - `version` · string · required
    "The semantic version of the Website."

## Errors

- `UploadVersionPermissionDenied` (PERMISSION_DENIED) — "Could not upload the Version."
