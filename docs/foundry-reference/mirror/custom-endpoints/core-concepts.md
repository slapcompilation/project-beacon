<!-- source: https://palantir.com/docs/foundry/custom-endpoints/core-concepts/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Core concepts

## Endpoint definitions

An endpoint definition defines an API endpoint that consumes header, query, path, and body parameters to call Foundry [functions](/docs/foundry/functions/overview/) or [actions](/docs/foundry/action-types/overview/) with those parameters. Endpoint definitions belong to a single endpoint set.

## Endpoint sets

An endpoint set is a Compass resource for grouping related endpoints. This resource manages permissions for developers to view, edit, publish, and deploy endpoint definitions. You can interact with an endpoint set's endpoint definitions in the **Configuration** tab.

## Subdomains

A subdomain must be registered and approved through Control Panel before endpoints can be served. Subdomains provide custom domains for accessing deployed endpoint releases.

When you create a new endpoint set, you will be prompted to [register a subdomain](/docs/foundry/custom-endpoints/create-endpoint-set/#register-a-subdomain-to-host-your-endpoints). You must register a subdomain for each endpoint set in order to link that subdomain to your endpoint definitions. Standalone subdomains created manually through Control Panel are not supported by Custom Endpoints.

## Endpoint set publishing and releases

You must first publish an endpoint set to create a versioned snapshot of it. Publishing an endpoint set creates an immutable release tied to a semantic version, and is similar to using Git. Publishing captures the current state much like `git commit`, and assigns it a semantic version tag similarly to `git tag`. Each endpoint set release is immutable, but can be deleted.

## Deploy endpoint set releases

Endpoints become accessible only after deploying an endpoint set release to a subdomain. Multiple releases can be deployed simultaneously. Requests use the version specified in the `endpoint-api-version` header, defaulting to the latest deployed version when unspecified.
