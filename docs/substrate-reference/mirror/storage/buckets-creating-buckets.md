<!-- source: https://supabase.com/docs/guides/storage/buckets/creating-buckets · mirrored 2026-08-13 from Supabase docs -->

# Creating Buckets

Learn how to create Supabase Storage buckets.

You can create a bucket using the Supabase Dashboard. Since storage is interoperable with your Postgres database, you can also use SQL or our client libraries.
Here we create a bucket called "avatars":

**JavaScript**

```js
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

// ---cut---
// Use the JS library to create a bucket.

const { data, error } = await supabase.storage.createBucket('avatars', {
  public: true, // default: false
})
```

[Reference.](https://supabase.com/docs/reference/javascript/storage-createbucket)

**Dashboard**

1. Go to the [Storage](https://supabase.com/dashboard/project/_/storage/buckets) page in the Dashboard.
2. Click **New Bucket** and enter a name for the bucket.
3. Click **Create Bucket**.

**SQL**

```sql
-- Use Postgres to create a bucket.

insert into storage.buckets
  (id, name, public)
values
  ('avatars', 'avatars', true);
```

**Dart**

```dart
void main() async {
  final supabase = SupabaseClient('supabaseUrl', 'supabaseKey');

  final storageResponse = await supabase
      .storage
      .createBucket('avatars');
}
```

[Reference.](https://pub.dev/documentation/storage_client/latest/storage_client/SupabaseStorageClient/createBucket.html)

**Swift**

```swift
try await supabase.storage.createBucket(
  "avatars",
  options: BucketOptions(public: true)
)
```

[Reference.](https://supabase.com/docs/reference/swift/storage-createbucket)

**Python**

```python
supabase.storage.create_bucket(
  'avatars',
  options={"public": True}
)
```

[Reference.](https://supabase.com/docs/reference/python/storage-createbucket)

**C#**

```c#
var bucket = await supabase.Storage.CreateBucket("avatars", new BucketUpsertOptions { Public = true });
```

[Reference.](https://supabase.com/docs/reference/csharp/create-bucket)

## Restricting uploads

When creating a bucket you can add additional configurations to restrict the type or size of files you want this bucket to contain.

For example, imagine you want to allow your users to upload only images to the `avatars` bucket and the size must not be greater than 1MB. You can achieve the following by providing `allowedMimeTypes` and `maxFileSize`:

```js
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

// ---cut---
// Use the JS library to create a bucket.

const { data, error } = await supabase.storage.createBucket('avatars', {
  public: true,
  allowedMimeTypes: ['image/*'],
  fileSizeLimit: '1MB',
})
```

If an upload request doesn't meet the above restrictions it will be rejected. See [File Limits](https://supabase.com/docs/guides/storage/uploads/file-limits) for more information.
