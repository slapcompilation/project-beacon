<!-- source: https://palantir.com/docs/foundry/api/third-party-applications-v2-resources/websites/undeploy-website/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Undeploy Website

`POST /api/v2/thirdPartyApplications/{thirdPartyApplicationRid}/website/undeploy`

Remove the currently deployed version of the Website.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `third-party-application:deploy-application-website`.

Scopes: `third-party-application:deploy-application-website`

## Path parameters

- `thirdPartyApplicationRid` · string · required
  "An RID identifying a third-party application created in Developer Console."

## Response

- `Website` · object · required
  - `deployedVersion` · string
    "The version of the Website that is currently deployed."
  - `subdomains` · list
    "The subdomains from which the Website is currently served."
    - `Subdomain` · string · required
      "A subdomain from which a website is served."

## Errors

- `UndeployWebsitePermissionDenied` (PERMISSION_DENIED) — "Could not undeploy the Website."
