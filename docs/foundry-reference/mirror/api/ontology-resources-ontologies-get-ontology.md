<!-- source: https://palantir.com/docs/foundry/api/ontology-resources/ontologies/get-ontology/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Ontology

`GET /api/v1/ontologies/{ontologyRid}`

Gets a specific ontology with the given Ontology RID.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontologyRid` · string · required
  "The unique Resource Identifier (RID) of the Ontology. To look up your Ontology RID, please use the **List ontologies** endpoint or check the **Ontology Manager**."

## Response

- `Ontology` · object · required
  "Success response."
  - `apiName` · string · required
  - `displayName` · string · required
    "The display name of the entity."
  - `description` · string · required
  - `rid` · string · required
    "The unique Resource Identifier (RID) of the Ontology. To look up your Ontology RID, please use the `List ontologies` endpoint or check the **Ontology Manager**."
