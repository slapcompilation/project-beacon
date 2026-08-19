<!-- source: https://palantir.com/docs/foundry/api/v2/ontologies-v2-resources/ontologies/get-ontology/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Ontology

`GET /api/v2/ontologies/{ontology}`

Gets a specific ontology for a given Ontology API name or RID.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."

## Response

- `OntologyV2` · object · required
  "Success response."
  - `apiName` · string · required
  - `displayName` · string · required
    "The display name of the entity."
  - `description` · string · required
  - `rid` · string · required
    "The unique Resource Identifier (RID) of the Ontology. To look up your Ontology RID, please use the `List ontologies` endpoint or check the **Ontology Manager**."
