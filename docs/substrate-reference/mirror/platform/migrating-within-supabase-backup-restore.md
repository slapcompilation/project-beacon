<!-- source: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore · mirrored 2026-08-13 from Supabase docs -->

# Backup and Restore using the CLI

Learn how to backup and restore projects using the Supabase CLI

## Migrating the database

### Back up database using the CLI

1. **Install the Supabase CLI**

Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

2. **Install Docker Desktop**

Install [Docker Desktop](https://www.docker.com) for your platform.

3. **Get the new database connection string**

On your project dashboard, click [Connect](https://supabase.com/dashboard/project/_?showConnect=true\&method=session).

Note: Use the [Session pooler](https://supabase.com/dashboard/project/_?showConnect=true\&method=session) connection string by default. If your network supports [IPv6](https://test-ipv6.com/) or you have the [IPv4 add-on](https://supabase.com/docs/guides/platform/ipv4-address) enabled, use the direct connection string.

Session pooler connection string:

```bash
  postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

Direct connection string:

```bash
  postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.com:5432/postgres
```

4. **Get the database password**

Reset the password in the [Database Settings](https://supabase.com/dashboard/project/_/database/settings).

Replace `[YOUR-PASSWORD]` in the connection string with the database password.

5. **Backup database**

Run these commands after replacing `[CONNECTION_STRING]` with your connection string from the previous steps:

```bash
supabase db dump --db-url [CONNECTION_STRING] -f roles.sql --role-only
```

```bash
supabase db dump --db-url [CONNECTION_STRING] -f schema.sql
```

```bash
supabase db dump --db-url [CONNECTION_STRING] -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

### Before you begin

**Install Postgres and psql**

**Windows**

1. **Install Postgres**

Download and run the installation file for the latest version from the [Postgres installer download page](https://www.postgresql.org/download/windows/).

2. **Add Postgres to your system PATH**

Add the Postgres binary to your system PATH.

In Control Panel, under the Advanced tab of System Properties, click Environment Variables. Edit the Path variable by adding the path to the SQL binary you installed.

The path will look something like this, though it may differ slightly depending on your installed version:

```
C:\Program Files\PostgreSQL\17\bin
```

3. **Verify that psql is working**

Open your terminal and run the following command:

```sh
psql --version
```

Note: If you get an error that psql is not available or cannot be found, check that you have correctly added the binary to your system PATH. Also try restarting your terminal.

**MacOS**

1. **Install Homebrew**

Install [Homebrew](https://brew.sh/).

2. **Install Postgres**

Install Postgres via Homebrew by running the following command in your terminal:

```sh
brew install postgresql@17
```

3. **Verify that psql is working**

Restart your terminal and run the following command:

```sh
psql --version
```

If you get an error that psql is not available or cannot be found then the PATH variable is likely either not correctly set or you need to restart your terminal.

You can add the Postgres installation path to your PATH variable by running the following command:

```sh
brew info postgresql@17
```

The above command will give an output like this:

```sh
If you need to have postgresql@17 first in your PATH, run:

echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc
```

Run the command mentioned and restart the terminal.

### Restore backup using CLI

Note: These steps cover a manual logical restore (`pg_dump` / `psql`) into a project you create yourself. The [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project) and [Branching](https://supabase.com/docs/guides/deployment/branching) flows copy your encryption root key to the new project automatically, so the key-copy step below does not apply to them.

1. **Create project**

Create a [new project](https://database.new)

2. **Configure newly created project**

In the new project:

- If Webhooks were used in the old database, enable [Database Webhooks](https://supabase.com/dashboard/project/_/database/hooks).
- If any non-default extensions were used in the old database, enable the [Extensions](https://supabase.com/dashboard/project/_/database/extensions).

3. **Get the new database connection string**

Go to [the **Connect** panel](https://supabase.com/dashboard/project/_?showConnect=true\&method=session) for the connection string.

Note: Use the Session pooler connection string by default. If your ISP [supports IPv6](https://test-ipv6.com/), use the direct connection string.

Session pooler connection string:

```bash
  postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

Direct connection string:

```bash
  postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.com:5432/postgres
```

4. **Get the database password**

Replace `[YOUR-PASSWORD]` in the connection string with the database password. If you do not remember your password, you can reset it on [the **Database >  Settings**](https://supabase.com/dashboard/project/_/database/settings) page of the Dashboard.

5. **Restore your Project with PSQL**

**No Vault or column encryption**

Run these commands after replacing `[CONNECTION_STRING]` with your connection string from the previous steps:

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname [CONNECTION_STRING]
```

**Supabase Vault or column encryption**

Caution: Retrieve the root encryption key from the **old** project *before* you pause or delete it. The API below only returns the key for active projects - once the old project is paused or removed, the key (and any data encrypted with it) can no longer be retrieved.

Backup files never contain the root key; they hold only encrypted data. A newly created project is initialized with its own fresh root key, so Vault secrets and encrypted columns restored from the old project cannot be decrypted until you copy the old key across. Overwriting a project's root key makes any data encrypted under a different key inaccessible.

If you use [Supabase Vault](https://supabase.com/docs/guides/database/vault) or [pgsodium](https://supabase.com/docs/guides/database/extensions/pgsodium), copy the root encryption key to your new project using your [Personal Access Token](https://supabase.com/dashboard/account/tokens). Both rely on the same per-project root key.

You can restore the project using both the old and new project ref (the project ref is the value between "https\://" and ".supabase.co" in the URL) instead of the URL.

```bash
export OLD_PROJECT_REF="<old_project_ref>"
export NEW_PROJECT_REF="<new_project_ref>"
export SUPABASE_ACCESS_TOKEN="<personal_access_token>"

curl "https://api.supabase.com/v1/projects/$OLD_PROJECT_REF/pgsodium" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" |
curl "https://api.supabase.com/v1/projects/$NEW_PROJECT_REF/pgsodium" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -X PUT --json @-
```

The endpoint both returns and expects the 64-character hex root key.

6. **Reactivate Database publications**

If replication for Supabase Realtime was used in the old database, enable publication on [the **Database > Publications**](https://supabase.com/dashboard/project/_/database/publications) section of the Dashboard on the tables necessary.

### Special considerations

#### Preserving migration history

If you were using Supabase CLI for managing migrations on your old database and would like to preserve the migration history in your newly restored project, you need to insert the migration records separately using the following commands.

```bash
supabase db dump --db-url "$OLD_DB_URL" -f history_schema.sql --schema supabase_migrations
supabase db dump --db-url "$OLD_DB_URL" -f history_data.sql --use-copy --data-only --schema supabase_migrations
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file history_schema.sql \
  --file history_data.sql \
  --dbname "$NEW_DB_URL"
```

#### Schema changes to `auth` and `storage`

If you have modified the `auth` and `storage` schemas in your old project, such as adding triggers or Row Level Security(RLS) policies, you have to restore them separately. The Supabase CLI can help you diff the changes to these schemas using the following commands.

```bash
supabase link --project-ref "$OLD_PROJECT_REF"
supabase db diff --linked --schema auth,storage > changes.sql
```

### Troubleshooting notes

#### Disabling triggers during restore:

Setting `session_replication_role` to `replica` disables triggers during the migration, preventing columns from being double encrypted.

#### Custom roles require passwords

If you created any [custom roles](https://supabase.com/dashboard/project/_/database/roles) with the `LOGIN` attribute, you must manually set their passwords in the new project. This can be done with the SQL command:

```sql
alter user "YOUR_USER" with password 'SOME_NEW_PASSWORD';
```

#### `supabase_admin` permission errors

If you encounter permission errors related to `supabase_admin` during restore:

- Open `schema.sql`
- Comment out any lines containing:

```sql
  ALTER ... OWNER TO "supabase_admin"
```

#### `cli_login_postgres` role grant error

If you encounter the error:

```sh
ERROR:  permission denied to grant role "postgres"
DETAIL:  Only roles with the ADMIN option on role "postgres" may grant this role.
```

- Open `roles.sql`
- Comment out the line:

```sql
GRANT "postgres" TO "cli_login_postgres" WITH INHERIT FALSE GRANTED BY "supabase_admin";
```

#### `cli_login_postgres` role issues after cloning

The `cli_login_role` must be created by the `supabase_admin` role. If the migration process cloned over the role before the CLI could generate its own version, it may encounter the error:

```sh
"message":"Failed to create login role:
ERROR:  0LP01: role "postgres" is a member of role "cli_login_postgres"
```

To resolve the issue, drop the custom `cli_login_postgres` role. Then the CLI can recreate it with the right privileges:

```sql
DROP ROLE IF EXISTS cli_login_postgres;
```

## Migrating edge functions

### Steps (using the Supabase CLI):

1. **Login to your Supabase Account**

With the Supabase CLI [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), run:

```bash
supabase login
```

2. **List your edge functions**

```bash
supabase functions list --project-ref your_project_ref
```

3. **Download your functions**

You can download an individual function with the following command:

```bash
supabase functions download YOUR_FUNCTION_NAME --project-ref your_project_ref
```

Note: The command will not download [import maps](https://supabase.com/docs/guides/functions/dependencies#using-import-maps-legacy) nor [deno.json](https://supabase.com/docs/guides/functions/dependencies#using-denojson-recommended) files. If your edge functions rely on them for dependency management, you will have to add them back manually.

4. **Deploy the functions**

```bash
supabase functions deploy --project-ref your_target_project_ref
```

This deploys all functions within the `supabase/functions` to the target project. You can confirm by checking your Edge Functions on [the project dashboard](https://supabase.com/dashboard/project/_/functions)

### Steps (using the Supabase Dashboard):

Note: Dependencies defined through [import maps](https://supabase.com/docs/guides/functions/dependencies#using-import-maps-legacy) and [deno.json](https://supabase.com/docs/guides/functions/dependencies#using-denojson-recommended) files will need to be rewritten to rely on their [direct import paths](https://supabase.com/docs/guides/functions/dependencies#importing-dependencies) when using this approach.

1. In the source project, navigate to **Edge Functions** from the side menu

2. Using the `Download` button, download your desired function as zip: ![Download Edge
Function](/docs/img/troubleshooting/download-edge-function-via-dashboard.gif)

3. In the target project, navigate to **Edge Functions** from the side menu

4. Click on the `Deploy a new function` button, select **Via Editor** operation

5. Drag and drop your downloaded function (the zip function from step 2) into the editor

6. Add your function name and click on the `Deploy function` button to deploy the function:
![Upload Edge Function](/docs/img/troubleshooting/upload-edge-function-via-dashboard.gif)

## Migrating storage objects

1. **On your machine, create a javascript repository**

Using your preferred JavaScript package manager, create a new project with the `supabase` client package

**npm**

```bash
npm init -y
npm install @supabase/supabase-js
```

**pnpm**

```bash
pnpm init -y
pnpm install @supabase/supabase-js
```

**yarn**

```bash
yarn init -y
yarn add @supabase/supabase-js
```

**bun**

```bash
bun init -y
bun install @supabase/supabase-js
```

2. **Create an index.js file in your Node.js project**

Add the example script to it.

```js name=index.js
// npm install @supabase/supabase-js@2
const { createClient } = require('@supabase/supabase-js')

const OLD_PROJECT_URL = 'https://xxx.supabase.co'
const OLD_PROJECT_SERVICE_KEY = 'old-project-service-key-xxx'

const NEW_PROJECT_URL = 'https://yyy.supabase.co'
const NEW_PROJECT_SERVICE_KEY = 'new-project-service-key-yyy'

const oldSupabase = createClient(OLD_PROJECT_URL, OLD_PROJECT_SERVICE_KEY)
const newSupabase = createClient(NEW_PROJECT_URL, NEW_PROJECT_SERVICE_KEY)

function createLoadingAnimation(message) {
  const readline = require('readline')
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let i = 0
  let timer
  let stopped = false

  const animate = () => {
    if (stopped) return
    process.stdout.write(`\r${frames[i]} ${message}`)
    i = (i + 1) % frames.length
    timer = setTimeout(animate, 80)
  }

  animate()

  return {
    stop: (finalMessage = '') => {
      stopped = true
      clearTimeout(timer)
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
      process.stdout.write(`✓ ${finalMessage || message}\n`)
    },
  }
}

/**
* Lists all files in a bucket, handling nested folders recursively.
*/
async function listAllFiles(bucket, path = '') {
  const loader = createLoadingAnimation(`Listing files in '${bucket}${path ? '/' + path : ''}'...`)

  try {
    const { data, error } = await oldSupabase.storage.from(bucket).list(path, { limit: 1000 })
    if (error) {
      loader.stop(`Error listing files in '${bucket}${path ? '/' + path : ''}'`)
      throw new Error(`❌ Error listing files in bucket '${bucket}': ${error.message}`)
    }

    if (!data || data.length === 0) {
      loader.stop(`No files found in '${bucket}${path ? '/' + path : ''}'`)
      return []
    }

    let files = []
    for (const item of data) {
      if (!item.metadata) {
        loader.stop(`Found folder '${item.name}' in '${bucket}${path ? '/' + path : ''}'`)
        const subFiles = await listAllFiles(bucket, `${path}${item.name}/`)
        files = files.concat(subFiles)
      } else {
        files.push({ fullPath: `${path}${item.name}`, metadata: item.metadata })
      }
    }

    loader.stop(`Found ${files.length} files in '${bucket}${path ? '/' + path : ''}'`)
    return files
  } catch (error) {
    loader.stop()
    throw error
  }
}

/**
* Creates a bucket in the new Supabase project if it doesn't exist.
*/
async function ensureBucketExists(bucketName, options = {}) {
  const { data: existingBucket, error: getBucketError } =
    await newSupabase.storage.getBucket(bucketName)

  if (getBucketError && !getBucketError.message.includes('not found')) {
    throw new Error(`❌ Error checking if bucket '${bucketName}' exists: ${getBucketError.message}`)
  }

  if (!existingBucket) {
    console.log(`🪣 Creating bucket '${bucketName}' in new project...`)
    const { error } = await newSupabase.storage.createBucket(bucketName, options)
    if (error) throw new Error(`❌ Failed to create bucket '${bucketName}': ${error.message}`)
    console.log(`✅ Created bucket '${bucketName}'`)
  } else {
    console.log(`ℹ️ Bucket '${bucketName}' already exists in new project`)
  }
}

/**
* Migrates a single file from the old project to the new one.
*/
async function migrateFile(sourceBucketName, targetBucketName, file) {
  const loader = createLoadingAnimation(
    `Migrating ${file.fullPath} in bucket '${sourceBucketName}' to '${targetBucketName}'...`
  )

  try {
    const { data, error: downloadError } = await oldSupabase.storage
      .from(sourceBucketName)
      .download(file.fullPath)
    if (downloadError) {
      loader.stop(`Failed to migrate ${file.fullPath}: Download error`)
      throw new Error(`Download failed: ${downloadError.message}`)
    }

    // Preserve all available metadata from the original file
    const uploadOptions = {
      upsert: true,
      contentType: file.metadata?.mimetype,
      cacheControl: file.metadata?.cacheControl,
    }

    const { error: uploadError } = await newSupabase.storage
      .from(targetBucketName)
      .upload(file.fullPath, data, uploadOptions)
    if (uploadError) {
      loader.stop(`Failed to migrate ${file.fullPath}: Upload error`)
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    loader.stop(
      `Migrated ${file.fullPath} in bucket '${sourceBucketName}' to '${targetBucketName}'`
    )
    return { success: true, path: file.fullPath }
  } catch (err) {
    console.error(
      `❌ Error migrating ${file.fullPath} in bucket '${targetBucketName}':`,
      err.message
    )
    return { success: false, path: file.fullPath, error: err.message }
  }
}

function chunkArray(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
* Migrates all buckets and files from the old Supabase project to the new one.
* Processes files in parallel within batches for efficiency.
*/
async function migrateBuckets() {
  console.log('🔄 Starting Supabase Storage migration...')
  console.log(`📦 Source project: ${OLD_PROJECT_URL}`)
  console.log(`📦 Target project: ${NEW_PROJECT_URL}`)

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  console.log(
    '\n⚠️ WARNING: This migration may overwrite files in the target project if they have the same paths.'
  )
  console.log('⚠️ It is recommended to back up your target project before proceeding.')

  const answer = await new Promise((resolve) => {
    readline.question('Do you want to proceed with the migration? (yes/no): ', resolve)
  })

  readline.close()

  if (answer.toLowerCase() !== 'yes') {
    console.log('Migration canceled by user.')
    return { canceled: true }
  }

  console.log('\n📦 Fetching all buckets from old project...')

  const { data: oldBuckets, error: bucketListError } = await oldSupabase.storage.listBuckets()

  if (bucketListError) throw new Error(`❌ Error fetching buckets: ${bucketListError.message}`)
  console.log(`✅ Found ${oldBuckets.length} buckets to migrate.`)

  const { data: existingBuckets, error: existingBucketsError } =
    await newSupabase.storage.listBuckets()
  if (existingBucketsError)
    throw new Error(`❌ Error fetching existing buckets: ${existingBucketsError.message}`)

  const existingBucketNames = existingBuckets.map((b) => b.name)
  const conflictingBuckets = oldBuckets.filter((b) => existingBucketNames.includes(b.name))

  let conflictStrategy = 2

  if (conflictingBuckets.length > 0) {
    console.log('\n⚠️ The following buckets already exist in the target project:')
    conflictingBuckets.forEach((b) => console.log(`  - ${b.name}`))

    const conflictAnswer = await new Promise((resolve) => {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      })
      rl.question(
        '\nHow do you want to handle existing buckets?\n' +
          '1. Skip existing buckets\n' +
          '2. Merge files (may overwrite existing files)\n' +
          '3. Rename buckets in target (add suffix "_migrated")\n' +
          '4. Cancel migration\n' +
          'Enter your choice (1-4): ',
        (answer) => {
          rl.close()
          resolve(answer)
        }
      )
    })

    if (conflictAnswer === '4') {
      console.log('Migration canceled by user.')
      return { canceled: true }
    }

    conflictStrategy = parseInt(conflictAnswer)
    if (isNaN(conflictStrategy) || conflictStrategy < 1 || conflictStrategy > 3) {
      console.log('Invalid choice. Migration canceled.')
      return { canceled: true }
    }
  }

  const migrationStats = {
    totalBuckets: oldBuckets.length,
    processedBuckets: 0,
    skippedBuckets: 0,
    totalFiles: 0,
    successfulFiles: 0,
    failedFiles: 0,
    failedFilesList: [],
  }

  for (const bucket of oldBuckets) {
    const bucketName = bucket.name
    console.log(`\n📁 Processing bucket: ${bucketName}`)

    let targetBucketName = bucketName

    if (existingBucketNames.includes(bucketName)) {
      if (conflictStrategy === 1) {
        console.log(`⏩ Skipping bucket '${bucketName}' as it already exists in target project`)
        migrationStats.skippedBuckets++
        continue
      } else if (conflictStrategy === 3) {
        targetBucketName = `${bucketName}_migrated`
        console.log(`🔄 Renaming bucket to '${targetBucketName}' in target project`)
      } else {
        console.log(`🔄 Merging files into existing bucket '${bucketName}' in target project`)
      }
    }

    // Preserve bucket configuration when creating in the new project
    if (targetBucketName !== bucketName || !existingBucketNames.includes(bucketName)) {
      await ensureBucketExists(targetBucketName, {
        public: bucket.public,
        fileSizeLimit: bucket.file_size_limit,
        allowedMimeTypes: bucket.allowed_mime_types,
      })
    }

    const files = await listAllFiles(bucketName)
    console.log(`✅ Found ${files.length} files in bucket '${bucketName}'.`)
    migrationStats.totalFiles += files.length

    const batches = chunkArray(files, 10)

    for (let i = 0; i < batches.length; i++) {
      console.log(`\n🚀 Processing batch ${i + 1}/${batches.length} (${batches[i].length} files)`)

      const results = await Promise.all(
        batches[i].map((file) => migrateFile(bucketName, targetBucketName, file))
      )

      const batchSuccesses = results.filter((r) => r.success).length
      const batchFailures = results.filter((r) => !r.success)

      migrationStats.successfulFiles += batchSuccesses
      migrationStats.failedFiles += batchFailures.length
      migrationStats.failedFilesList.push(...batchFailures.map((f) => f.path))

      console.log(
        `✅ Completed batch ${i + 1}/${batches.length}: ${batchSuccesses} succeeded, ${batchFailures.length} failed`
      )
    }

    migrationStats.processedBuckets++
    console.log(`✅ Completed bucket '${bucketName}' migration`)
  }

  console.log('\n📊 Migration Summary:')
  console.log(
    `Buckets: ${migrationStats.processedBuckets}/${migrationStats.totalBuckets} processed, ${migrationStats.skippedBuckets} skipped`
  )
  console.log(
    `Files: ${migrationStats.successfulFiles} succeeded, ${migrationStats.failedFiles} failed (${migrationStats.totalFiles} total)`
  )

  if (migrationStats.failedFiles > 0) {
    console.log('\n⚠️ Failed files:')
    migrationStats.failedFilesList.forEach((path) => console.log(`  - ${path}`))
    return migrationStats
  }

  return migrationStats
}

migrateBuckets()
  .then((stats) => {
    if (stats.failedFiles > 0) {
      console.log(`\n⚠️ Migration completed with ${stats.failedFiles} failed files.`)
      process.exit(1)
    } else {
      console.log('\n🎉 Migration completed successfully!')
      process.exit(0)
    }
  })
  .catch((err) => {
    console.error('❌ Fatal error during migration:', err.message)
    process.exit(1)
  })
```

3. **Add the relevant project variables to the script**

Get the [secret keys](https://supabase.com/dashboard/project/_/settings/api-keys) or [service\_role keys](https://supabase.com/dashboard/project/_/settings/api-keys/legacy) for both your new and old projects, then substitute them into the script.
From the [Data API settings](https://supabase.com/dashboard/project/_/integrations/data_api/overview), copy your project URL and add it to the script as well.

```js name='index.js'
//rest of code
...

// add relevant details for old project
const OLD_PROJECT_URL = 'https://xxx.supabase.co'
const OLD_PROJECT_SERVICE_KEY = 'old-project-service-key-xxx'

// add relevant details for new project
const NEW_PROJECT_URL = 'https://yyy.supabase.co'
const NEW_PROJECT_SERVICE_KEY = 'new-project-service-key-yyy'

...
//rest of code
```

4. **Run the script from your command line**



**node**

```bash
node index.js
```

**bun**

```bash
bun index.js
```

### Resources

- [Connecting with PSQL](https://supabase.com/docs/guides/database/psql)
