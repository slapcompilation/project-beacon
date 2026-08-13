<!-- source: https://supabase.com/docs/guides/storage/security/access-control · mirrored 2026-08-13 from Supabase docs -->

# Storage Access Control

Learn how to restrict Supabase file uploads.

Supabase Storage is designed to work perfectly with Postgres [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) (RLS).

You can use RLS to create [Security Access Policies](https://www.postgresql.org/docs/current/sql-createpolicy.html) that are incredibly powerful and flexible, allowing you to restrict access based on your business needs.

## Access policies

By default Storage does not allow any uploads to buckets without RLS policies. You selectively allow certain operations by creating RLS policies on the `storage.objects` table.

You can find the documentation for the storage schema [here](https://supabase.com/docs/guides/storage/schema/design) , and to simplify the process of crafting your policies, you can use these [helper functions](https://supabase.com/docs/guides/storage/schema/helper-functions) .

If you need different `SELECT` policies for different Storage actions, such as listing objects versus reading authenticated objects, use the operation-aware helpers `storage.allow_only_operation()` and `storage.allow_any_operation()` documented in [Storage Helper Functions](https://supabase.com/docs/guides/storage/schema/helper-functions).

Note: The RLS policies required for different operations are documented [here](https://supabase.com/docs/reference/javascript/storage-createbucket)

For example, the only RLS policy required for [uploading](https://supabase.com/docs/reference/javascript/storage-from-upload) objects is to grant the `INSERT` permission to the `storage.objects` table.

To allow overwriting files using the `upsert` functionality you will need to additionally grant `SELECT` and `UPDATE` permissions.

## Policy examples

An easy way to get started would be to create RLS policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE` operations and restrict the policies to meet your security requirements. For example, one can start with the following `INSERT` policy:

```sql
create policy "policy_name"
ON storage.objects
for insert with check (
  true
);
```

and modify it to only allow authenticated users to upload assets to a specific bucket by changing it to:

```sql
create policy "policy_name"
on storage.objects for insert to authenticated with check (
    -- restrict bucket
    bucket_id = 'my_bucket_id'
);
```

This example demonstrates how you would allow authenticated users to upload files to a folder called `private` inside `my_bucket_id`:

```sql
create policy "Allow authenticated uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'my_bucket_id' and
  (storage.foldername(name))[1] = 'private'
);
```

This example demonstrates how you would allow authenticated users to upload files to a folder called with their `users.id` inside `my_bucket_id`:

```sql
create policy "Allow authenticated uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'my_bucket_id' and
  (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
);
```

Allow a user to access a file that was previously uploaded by the same user:

```sql
create policy "Individual user Access"
on storage.objects for select
to authenticated
using ( (select auth.jwt()->>'sub') = owner_id );
```

Allow anyone to access objects in the `avatars` bucket via publishable key. The `allow_any_operation()` filter is critical here as without it users would be able to list the bucket contents.

Note: This is not needed for public buckets, as they are already publicly accessible

```sql
create policy "Avatar images are publicly accessible." on storage.objects
  for select using (bucket_id = 'avatars' and storage.allow_any_operation(array['object.get_authenticated_info', 'object.get_authenticated']));
```

***



## Bypassing access controls

If you exclusively use Storage from trusted clients, such as your own servers, and need to bypass the RLS policies, you can use the `service key` in the `Authorization` header. Service keys entirely bypass RLS policies, granting you unrestricted access to all Storage APIs.

Remember you should not share the service key publicly.
