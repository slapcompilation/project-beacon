<!-- source: https://palantir.com/docs/foundry/api/v2/ontologies-v2-resources/cipher-text-properties/decrypt/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Decrypt

`GET /api/v2/ontologies/{ontology}/objects/{objectType}/{primaryKey}/ciphertexts/{property}/decrypt`

Decrypt the value of a ciphertext property.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."
- `objectType` · string · required
  "The API name of the object type. To find the API name, use the **List object types** endpoint or check the **Ontology Manager**."
- `primaryKey` · string · required
  "The primary key of the object with the CipherText property."
- `property` · string · required
  "The API name of the CipherText property. To find the API name for your CipherText property, check the **Ontology Manager** or use the **Get object type** endpoint."

## Query parameters

- `branch` · string
  "The Foundry branch to read from. If not specified, the default branch will be used."

## Response

- `DecryptionResult` · object · required
  "Success response."
  - `plaintext` · string · required
