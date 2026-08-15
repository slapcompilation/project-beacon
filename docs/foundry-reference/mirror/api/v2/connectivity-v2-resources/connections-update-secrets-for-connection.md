<!-- source: https://palantir.com/docs/foundry/api/v2/connectivity-v2-resources/connections/update-secrets-for-connection/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Update Secrets For Connection

`POST /api/v2/connectivity/connections/{connectionRid}/updateSecrets`

Updates the secrets on the connection to the specified secret values.
Secrets that are currently configured on the connection but are omitted in the request will remain unchanged.

Secrets are transmitted over the network encrypted using TLS. Once the secrets reach Foundry's servers, 
they will be temporarily decrypted and remain in plaintext in memory to be processed as needed. 
They will stay in plaintext in memory until the garbage collection process cleans up the memory. 
The secrets are always stored encrypted on our servers.

By using this endpoint, you acknowledge and accept any potential risks associated with the temporary 
in-memory handling of secrets. If you do not want your secrets to be temporarily decrypted, you should 
use the Foundry UI instead.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:connectivity-connection-write`.

Scopes: `api:connectivity-connection-write`

## Path parameters

- `connectionRid` · string · required
  "The Resource Identifier (RID) of a Connection (also known as a source)."

## Request

- `UpdateSecretsForConnectionRequest` · object · required
  - `secrets` · map
    "The secrets to be updated. The specified secret names must already be configured on the connection."
    - `SecretName` · string · required
    - `PlaintextValue` · string · required

## Errors

- `SecretNamesDoNotExist` (INVALID_ARGUMENT) — "The secret names provided do not exist on the connection."
- `UpdateSecretsForConnectionPermissionDenied` (PERMISSION_DENIED) — "Could not updateSecrets the Connection."
- `ConnectionNotFound` (NOT_FOUND) — "The given Connection could not be found."
