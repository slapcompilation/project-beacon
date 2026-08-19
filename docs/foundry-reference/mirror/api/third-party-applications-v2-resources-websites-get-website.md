<!-- source: https://palantir.com/docs/foundry/api/third-party-applications-v2-resources/websites/get-website/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Website

`GET /api/v2/thirdPartyApplications/{thirdPartyApplicationRid}/website`

Get the Website.

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

- `WebsiteNotFound` (NOT_FOUND) — "The given Website could not be found."
