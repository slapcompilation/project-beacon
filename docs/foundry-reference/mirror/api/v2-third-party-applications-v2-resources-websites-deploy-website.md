<!-- source: https://palantir.com/docs/foundry/api/v2/third-party-applications-v2-resources/websites/deploy-website/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Deploy Website

`POST /api/v2/thirdPartyApplications/{thirdPartyApplicationRid}/website/deploy`

Deploy a version of the Website.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `third-party-application:deploy-application-website`.

Scopes: `third-party-application:deploy-application-website`

## Path parameters

- `thirdPartyApplicationRid` · string · required
  "An RID identifying a third-party application created in Developer Console."

## Request

- `DeployWebsiteRequest` · object · required
  - `version` · string · required
    "The semantic version of the Website."

## Response

- `Website` · object · required
  - `deployedVersion` · string
    "The version of the Website that is currently deployed."
  - `subdomains` · list
    "The subdomains from which the Website is currently served."
    - `Subdomain` · string · required
      "A subdomain from which a website is served."

## Errors

- `DeployWebsitePermissionDenied` (PERMISSION_DENIED) — "Could not deploy the Website."
