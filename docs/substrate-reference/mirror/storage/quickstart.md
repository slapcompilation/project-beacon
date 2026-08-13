<!-- source: https://supabase.com/docs/guides/storage/quickstart · mirrored 2026-08-13 from Supabase docs -->

# Storage Quickstart

Learn how to use Supabase to store and serve files.

This guide shows the basic functionality of Supabase Storage. Find a full [example application on GitHub](https://github.com/supabase/supabase/tree/master/examples/user-management/nextjs-user-management).

## Concepts

Supabase Storage consists of Files, Folders, and Buckets.

### Files

Files can be any sort of media file. This includes images, GIFs, and videos. It is best practice to store files outside of your database because of their sizes. For security, HTML files are returned as plain text.

### Folders

Folders are a way to organize your files (like on your computer). There is no right or wrong way to organize your files. You can store them in whichever folder structure suits your project.

### Buckets

Buckets are distinct containers for files and folders. You can think of them like "super folders". Generally you would create distinct buckets for different Security and Access Rules. For example, you might keep all video files in a "video" bucket, and profile pictures in an "avatar" bucket.

Note: File, Folder, and Bucket names **must follow** [AWS object key naming guidelines](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html) and avoid use of any other characters.

## Create a bucket

You can create a bucket using the Supabase Dashboard. Since the storage is interoperable with your Postgres database, you can also use SQL or our client libraries. Here we create a bucket called "avatars":

**Dashboard**

1. Go to the [Storage](https://supabase.com/dashboard/project/_/storage/buckets) page in the Dashboard.
2. Click **New Bucket** and enter a name for the bucket.
3. Click **Create Bucket**.

**SQL**

```sql
-- Use Postgres to create a bucket.

insert into storage.buckets
  (id, name)
values
  ('avatars', 'avatars');
```

**JavaScript**

```js
// Use the JS library to create a bucket.

const { data, error } = await supabase.storage.createBucket('avatars')
```

[Reference.](https://supabase.com/docs/reference/javascript/storage-createbucket)

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
try await supabase.storage.createBucket("avatars")
```

[Reference.](https://supabase.com/docs/reference/swift/storage-createbucket)

**Python**

```python
response = supabase.storage.create_bucket('avatars')
```

[Reference.](https://supabase.com/docs/reference/python/storage-createbucket)

**C#**

```c#
var bucket = await supabase.Storage.CreateBucket("avatars");
```

[Reference.](https://supabase.com/docs/reference/csharp/create-bucket)

## Upload a file

You can upload a file from the Dashboard, or within a browser using our JS libraries.

**Dashboard**

1. Go to the [Storage](https://supabase.com/dashboard/project/_/storage/buckets) page in the Dashboard.
2. Select the bucket you want to upload the file to.
3. Click **Upload File**.
4. Select the file you want to upload.

**JavaScript**

```js
const avatarFile = event.target.files[0]
const { data, error } = await supabase.storage
  .from('avatars')
  .upload('public/avatar1.png', avatarFile)
```

[Reference.](https://supabase.com/docs/reference/javascript/storage-from-upload)

**Dart**

```dart
void main() async {
  final supabase = SupabaseClient('supabaseUrl', 'supabaseKey');

  // Create file `example.txt` and upload it in `public` bucket
  final file = File('example.txt');
  file.writeAsStringSync('File content');
  final storageResponse = await supabase
      .storage
      .from('public')
      .upload('example.txt', file);
}
```

[Reference.](https://pub.dev/documentation/storage_client/latest/storage_client/SupabaseStorageClient/createBucket.html)

**C#**

```c#
var imagePath = Path.Combine("Assets", "avatar1.png");

await supabase.Storage
  .From("avatars")
  .Upload(imagePath, "public/avatar1.png");
```

[Reference.](https://supabase.com/docs/reference/csharp/from-upload)

## Download a file

You can download a file from the Dashboard, or within a browser using our JS libraries.

**Dashboard**

1. Go to the [Storage](https://supabase.com/dashboard/project/_/storage/buckets) page in the Dashboard.
2. Select the bucket that contains the file.
3. Select the file that you want to download.
4. Click **Download**.

**JavaScript**

```js
// Use the JS library to download a file.

const { data, error } = await supabase.storage.from('avatars').download('public/avatar1.png')
```

[Reference.](https://supabase.com/docs/reference/javascript/storage-from-download)

**Dart**

```dart
void main() async {
  final supabase = SupabaseClient('supabaseUrl', 'supabaseKey');

  final storageResponse = await supabase
      .storage
      .from('public')
      .download('example.txt');
}
```

[Reference.](https://supabase.com/docs/reference/dart/storage-from-download)

**Swift**

```swift
let response = try await supabase.storage.from("avatars").download(path: "public/avatar1.png")
```

[Reference.](https://supabase.com/docs/reference/swift/storage-from-download)

**Python**

```python
response = supabase.storage.from_('avatars').download('public/avatar1.png')
```

[Reference.](https://supabase.com/docs/reference/python/storage-from-download)

**C#**

```c#
var bytes = await supabase.Storage.From("avatars").Download("public/avatar1.png");
```

[Reference.](https://supabase.com/docs/reference/csharp/from-download)

## Add security rules

To restrict access to your files you can use either the Dashboard or SQL.

**Dashboard**

1. Go to the [Storage](https://supabase.com/dashboard/project/_/storage/buckets) page in the Dashboard.
2. Click **Policies** in the sidebar.
3. Click **Add Policies** in the `OBJECTS` table to add policies for Files. You can also create policies for Buckets.
4. Choose whether you want the policy to apply to downloads (SELECT), uploads (INSERT), updates (UPDATE), or deletes (DELETE).
5. Give your policy a unique name.
6. Write the policy using SQL.

**SQL**

```sql
-- Use SQL to create a policy.

create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'public' );
```

***

