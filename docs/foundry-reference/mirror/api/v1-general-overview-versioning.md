<!-- source: https://palantir.com/docs/foundry/api/v1/general/overview/versioning/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Versioning

This API uses **semantic versioning with major version numbers only**. Every endpoint is versioned using a version number that appears in the URL path. For example, `v2` endpoints look like this:

```
https://<hostname>/api/v2/...
```

## Version Change Definitions

### Major Version Changes 
Breaking changes that require a new version number (e.g., v1 → v2). These changes are backward-incompatible and include:
- Removing endpoints or fields
- Adding new required request parameters
- Removing fields from response bodies or changing existing field data types

### Non-Breaking Changes 
Updates that do not require a version change and are deployed transparently. These include:
- Adding new optional request parameters
- Making required request parameters optional
- Adding new fields to response bodies
- Adding new enum values
- Adding new endpoints
- Performance improvements or bug fixes that don't alter functionality

## Forward Compatibility

**We are committed to maintaining backwards compatibility within major versions.** Clients should be designed to handle non-breaking changes gracefully, as these updates are deployed without version changes. This means your integration should:

- Ignore unknown fields in API responses
- Handle new enum values appropriately (e.g., with default cases)
- Not rely on undocumented behavior or implementation details

If you're using an older version of an endpoint, you may continue to use it unless it's deprecated.

## Deprecation

In some cases, we may have to remove a non-preview endpoint or older versions of an endpoint. We might do this, for example, if the platform no longer supports the underlying functionality exposed by the endpoint.

**Communication Channels**

- **Public Announcements**: Official notices published on our [public announcements page](https://www.palantir.com/docs/foundry/announcements/)
- **Upgrade Assistant**: Emails and in-platform notifications sent to affected API users via the [Upgrade Assistant](https://www.palantir.com/docs/foundry/upgrade-assistant/overview/)
- **API Documentation**: Deprecation banners and notices displayed prominently on affected endpoint documentation

### Migration Support

For each deprecated endpoint, we provide comprehensive information to assist you in your migration to new endpoints.
- Side-by-side API comparisons showing old vs. new endpoint structures
- Code examples demonstrating how to update integrations
- Common migration patterns and best practices
- In-platform support channels for migration-specific questions
- [Developer Community](https://community.palantir.com/) with migration guidance and community support

### Deprecation Timeline and Communication

If we have to replace or remove a stable endpoint, we will announce the change at least **twelve months** in advance, and provide continued support and SLA guarantees in the meantime.

**Emergency Changes**: In exceptional circumstances where immediate action is required to address critical security vulnerabilities or system stability issues, we may need to implement breaking changes with shorter notice periods. While we strive to avoid such situations, we reserve the right to prioritize platform security and stability when necessary.

## Public Preview

During the initial phase of an endpoint's development lifecycle, an endpoint may be in "Public Preview" state.  This indicates that the endpoint is in active development and is intended for non-production use only.

To opt in to usage of an endpoint in public preview state, you must also include the `preview=true` query parameter in your request. This is to acknowledge that usage is for experimental/development purposes only and that the endpoint may be changed or removed at any time without notice.

Endpoints that are in Public Preview state will include the following warning in endpoint documentation:

:::callout{theme=warning title=Warning}
This endpoint is in preview and may be modified or removed at any time.
To use this endpoint, add `preview=true` to the request query parameters.
:::
