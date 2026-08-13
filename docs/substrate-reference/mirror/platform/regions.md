<!-- source: https://supabase.com/docs/guides/platform/regions · mirrored 2026-08-13 from Supabase docs -->

# Available regions

Each Supabase project is deployed to one primary region. Choose the location closest to your users for the best performance.

## Data residency

The region you choose also determines where your primary project data is stored. If your data residency requirements call for data to stay within a specific jurisdiction, choose a [specific region](#specific-regions) rather than a general region grouping.

General regions deploy to *an* available AWS region within that broader area, which may not match a specific jurisdiction. For example, the "Europe" general region includes London and Zurich, which are not EU member states. Region selection is a data-location control, not proof of regulatory compliance. For GDPR considerations, see the [GDPR compliance guide](https://supabase.com/docs/guides/security/gdpr-compliance).

## General regions

For most projects, we recommend choosing a general region. Supabase will deploy your project to an available AWS region within that area based on current infrastructure capacity.

- Americas, `East US (North Virginia)`
- Europe, `Central EU (Frankfurt)`
- APAC, `Southeast Asia (Singapore)`

Note: General regions aren’t yet supported for read replicas or management via the API.

## Specific regions

If you prefer, you can choose an exact AWS region for your project.

- West US (North California), `us-west-1`
- West US (Oregon), `us-west-2`
- East US (North Virginia), `us-east-1`
- East US (Ohio), `us-east-2`
- Canada (Central), `ca-central-1`
- West EU (Ireland), `eu-west-1`
- West Europe (London), `eu-west-2`
- West EU (Paris), `eu-west-3`
- Central EU (Frankfurt), `eu-central-1`
- Central Europe (Zurich), `eu-central-2`
- North EU (Stockholm), `eu-north-1`
- South Asia (Mumbai), `ap-south-1`
- Southeast Asia (Singapore), `ap-southeast-1`
- Northeast Asia (Tokyo), `ap-northeast-1`
- Northeast Asia (Seoul), `ap-northeast-2`
- Oceania (Sydney), `ap-southeast-2`
- South America (São Paulo), `sa-east-1`
