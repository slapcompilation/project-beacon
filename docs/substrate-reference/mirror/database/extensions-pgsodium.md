<!-- source: https://supabase.com/docs/guides/database/extensions/pgsodium · mirrored 2026-08-13 from Supabase docs -->

# pgsodium (pending deprecation): Encryption Features

Encryption library for Postgres

Supabase **does not recommend** the usage of [pgsodium](https://github.com/michelp/pgsodium) as it will be deprecated. Use [Supabase Vault](https://supabase.com/docs/guides/database/vault) instead.

We will reach out to owners of impacted projects to assist with migrations away from [pgsodium](https://github.com/michelp/pgsodium) once the deprecation process begins.

Vault and `pgsodium` are **separate** extensions. Vault doesn't depend on `pgsodium` and **is not** affected by this deprecation.

Note: Vault is self-contained and doesn't depend on `pgsodium`. It shares the same per-project [root key](https://supabase.com/docs/guides/database/vault#encryption-key-location) (same format and location) but exposes its own interface - the `vault.secrets` table and `decrypted_secrets` view - so switching to Vault does not change how your key is managed.

[`pgsodium`](https://github.com/michelp/pgsodium) is a Postgres extension which provides SQL access to [`libsodium`'s](https://doc.libsodium.org/) high-level cryptographic algorithms.

Supabase previously documented two features derived from pgsodium. Namely [Server Key Management](https://github.com/michelp/pgsodium#server-key-management) and [Transparent Column Encryption](https://github.com/michelp/pgsodium#transparent-column-encryption). At this time, we do not recommend using either on the Supabase platform due to their high level of operational complexity and misconfiguration risk.

Note that Supabase projects are encrypted at rest by default which likely is sufficient for your compliance needs e.g. SOC2 & HIPAA.

## Get the root encryption key for your Supabase project

Encryption requires keys. Keeping the keys in the same database as the encrypted data would be unsafe. Supabase Vault and `pgsodium` share the same per-project root encryption key; for more information about managing it see **[encryption key location](https://supabase.com/docs/guides/database/vault#encryption-key-location)**. This key is required to decrypt values stored in [Supabase Vault](https://supabase.com/docs/guides/database/vault) and data encrypted with Transparent Column Encryption.

## Resources

- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- Read more about Supabase Vault in the [blog post](https://supabase.com/blog/vault-now-in-beta)
- [Supabase Vault on GitHub](https://github.com/supabase/vault)
- Official [`pgsodium` documentation](https://github.com/michelp/pgsodium)
