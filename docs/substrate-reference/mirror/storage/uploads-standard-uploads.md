<!-- source: https://supabase.com/docs/guides/storage/uploads/standard-uploads · mirrored 2026-08-13 from Supabase docs -->

# Standard Uploads

Learn how to upload files to Supabase Storage.

## Uploading

The standard file upload method is ideal for small files that are not larger than 6MB.

You implement file uploads with the supabase-js SDK using the traditional `multipart/form-data` format. Here's an example of how to upload a file using the standard upload method:

Note: Though you can upload up to 5GB files using the standard upload method, we recommend using [TUS Resumable Upload](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) for uploading files greater than 6MB in size for better reliability.

**JavaScript**

```javascript
// @noImplicitAny: false

// ---cut---
import { createClient } from '@supabase/supabase-js'

// Create Supabase client
const supabase = createClient('your_project_url', 'your_supabase_api_key')

// Upload file using standard upload
async function uploadFile(file) {
  const { data, error } = await supabase.storage.from('bucket_name').upload('file_path', file)
  if (error) {
    // Handle error
  } else {
    // Handle success
  }
}
```

**Dart**

```dart
// Upload file using standard upload
Future<void> uploadFile(File file) async {
  await supabase.storage.from('bucket_name').upload('file_path', file);
}
```

**Swift**

```swift
import Supabase

// Create Supabase client
let supabase = SupabaseClient(supabaseURL: URL(string: "your_project_url")!, supabaseKey: "your_supabase_api_key")

try await supabase.storage.from("bucket_name").upload(path: "file_path", file: file)
```

**Kotlin**

```kotlin
supabase.storage.from("bucket_name").upload("file_path", bytes)

//Or on JVM/Android: (This will stream the data from the file to supabase)
supabase.storage.from("bucket_name").upload("file_path", file)
```

**Python**

```python
response = supabase.storage.from_('bucket_name').upload('file_path', file)
```

**C#**

```c#
await supabase.Storage.From("bucket_name").Upload("local_file_path", "file_path");
```

**cURL**

```bash
curl -X POST "https://{your_project_ref}.supabase.co/storage/v1/object/{bucket_name}/{file_path}" \
  -H "apikey: {your_anon_key}" \
  -H "Authorization: Bearer {your_jwt_token}" \
  --data-binary "@/local/path/to/your/file.ext"
```

## Overwriting files

When uploading a file to a path that already exists, the default behavior is to return a `400 Asset Already Exists` error.
If you want to overwrite a file on a specific path you can set the `upsert` options to `true` or using the `x-upsert` header.

**JavaScript**

```javascript
import { createClient } from '@supabase/supabase-js'

const file = new Blob()

// ---cut---
// Create Supabase client
const supabase = createClient('your_project_url', 'your_supabase_api_key')

await supabase.storage.from('bucket_name').upload('file_path', file, {
  upsert: true,
})
```

**Dart**

```dart
await supabase.storage.from('bucket_name').upload(
      'file_path',
      file,
      fileOptions: const FileOptions(upsert: true),
    );
```

**Swift**

```swift
import Supabase

// Create Supabase client
let supabase = SupabaseClient(supabaseURL: URL(string: "your_project_url")!, supabaseKey: "your_supabase_api_key")

try await supabase.storage.from("bucket_name")
  .upload(
    path: "file_path",
    file: file,
    options: FileOptions(
      upsert: true
    )
  )
```

**Kotlin**

```kotlin
supabase.storage.from("bucket_name").upload("file_path", bytes) {
    upsert = true
}
```

**Python**

```python
response = supabase.storage.from_('bucket_name').upload('file_path', file, {
  'upsert': 'true',
})
```

**C#**

```c#
await supabase.Storage
  .From("bucket_name")
  .Upload("local_file_path", "file_path", new FileOptions { Upsert = true });
```

**cURL**

```bash
curl -X POST "https://{your_project_ref}.supabase.co/storage/v1/object/{bucket_name}/{file_path}" \
  -H "apikey: {your_anon_key}" \
  -H "Authorization: Bearer {your_jwt_token}" \
  -H "x-upsert: true" \
  --data-binary "@/local/path/to/your/file.ext"
```

We do advise against overwriting files when possible, as our Content Delivery Network will take sometime to propagate the changes to all the edge nodes leading to stale content.
Uploading a file to a new path is the recommended way to avoid propagation delays and stale content.

## Content type

By default, Storage will assume the content type of an asset from the file extension. If you want to specify the content type for your asset, pass the `contentType` option during upload.

**JavaScript**

```javascript
import { createClient } from '@supabase/supabase-js'

const file = new Blob()

// ---cut---
// Create Supabase client
const supabase = createClient('your_project_url', 'your_supabase_api_key')

await supabase.storage.from('bucket_name').upload('file_path', file, {
  contentType: 'image/jpeg',
})
```

**Dart**

```dart
await supabase.storage.from('bucket_name').upload(
      'file_path',
      file,
      fileOptions: const FileOptions(contentType: 'image/jpeg'),
    );
```

**Swift**

```swift
import Supabase

// Create Supabase client
let supabase = SupabaseClient(supabaseURL: URL(string: "your_project_url")!, supabaseKey: "your_supabase_api_key")

try await supabase.storage.from("bucket_name")
  .upload(
    path: "file_path",
    file: file,
    options: FileOptions(
      contentType: "image/jpeg"
    )
  )
```

**Kotlin**

```kotlin
supabase.storage.from("bucket_name").upload("file_path", bytes) {
    contentType = ContentType.Image.JPEG
}
```

**Python**

```python
response = supabase.storage.from_('bucket_name').upload('file_path', file, {
  'content-type': 'image/jpeg',
})
```

**C#**

```c#
await supabase.Storage
  .From("bucket_name")
  .Upload(
    "local_file_path",
    "file_path",
    new FileOptions { ContentType = "image/jpeg" },
    inferContentType: false);
```

**cURL**

```bash
curl -X POST "https://{your_project_ref}.supabase.co/storage/v1/object/{bucket_name}/{file_path}" \
  -H "apikey: {your_anon_key}" \
  -H "Authorization: Bearer {your_jwt_token}" \
  -H "Content-Type: {Content-Type}" \
  --data-binary "@/local/path/to/your/file.ext"
```

## Concurrency

When two or more clients upload a file to the same path, the first client to complete the upload will succeed and the other clients will receive a `400 Asset Already Exists` error.
If you provide the `x-upsert` header the last client to complete the upload will succeed instead.
