<!-- source: https://palantir.com/docs/foundry/api/v1/ontology-resources/ontologies/list-ontologies/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# List Ontologies

`GET /api/v1/ontologies`

Lists the Ontologies visible to the current user.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Response

- `ListOntologiesResponse` · object · required
  "Success response."
  - `data` · list
    "The list of Ontologies the user has access to."
    - `Ontology` · object · required
      "Metadata about an Ontology."
      - `apiName` · string · required
      - `displayName` · string · required
        "The display name of the entity."
      - `description` · string · required
      - `rid` · string · required
        "The unique Resource Identifier (RID) of the Ontology. To look up your Ontology RID, please use the `List ontologies` endpoint or check the **Ontology Manager**."
