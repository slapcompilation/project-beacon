<!-- source: https://supabase.com/docs/guides/database/prisma · mirrored 2026-08-13 from Supabase docs -->

# Prisma

Prisma Quickstart

This guide shows how to connect your Prisma application to Supabase Postgres. If you encounter any problems, reference the [Prisma troubleshooting docs](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting).

Note: If you plan to solely use Prisma instead of the Supabase Data API (PostgREST), turn it off in the [API Settings](https://supabase.com/dashboard/project/_/settings/api).

1. **Create a custom user for Prisma**

- In the [SQL Editor](https://supabase.com/dashboard/project/_/sql/new), create a Prisma DB user with full privileges on the public schema.
- This gives you better control over Prisma's access and makes it easier to monitor using Supabase tools like the [Query Performance Dashboard](https://supabase.com/dashboard/project/_/advisors/query-performance) and [Log Explorer](https://supabase.com/dashboard/project/_/logs/explorer).

Note: For security, consider using a [password generator](https://bitwarden.com/password-generator/) for the Prisma role.

```sql
-- Create custom user
create user "prisma" with password 'custom_password' bypassrls createdb;

-- extend prisma's privileges to postgres (necessary to view changes in Dashboard)
grant "prisma" to "postgres";

-- Grant it necessary permissions over the relevant schemas (public)
grant usage on schema public to prisma;
grant create on schema public to prisma;
grant all on all tables in schema public to prisma;
grant all on all routines in schema public to prisma;
grant all on all sequences in schema public to prisma;
alter default privileges for role postgres in schema public grant all on tables to prisma;
alter default privileges for role postgres in schema public grant all on routines to prisma;
alter default privileges for role postgres in schema public grant all on sequences to prisma;
```

```sql
-- alter prisma password if needed
alter user "prisma" with password 'new_password';
```

2. **Create a Prisma Project**

Create a new Prisma Project on your computer

Create a new directory

```bash Terminal
mkdir hello-prisma
cd hello-prisma
```

Initiate a new Prisma project

**npm**

```bash
npm init -y
npm install prisma tsx @types/pg --save-dev
npm install @prisma/client @prisma/adapter-pg dotenv pg

npx tsc --init

npx prisma init
```

**pnpm**

```bash
pnpm init
pnpm install prisma tsx @types/pg --save-dev
pnpm install @prisma/client @prisma/adapter-pg dotenv pg

pnpx tsc --init

pnpx prisma init
```

**yarn**

```bash
yarn init -y
yarn add prisma tsx @types/pg --save-dev
yarn add @prisma/client @prisma/adapter-pg dotenv pg

npx tsc --init

npx prisma init
```

**bun**

```bash
bun init -y
bun install prisma tsx @types/pg --save-dev
bun install @prisma/client @prisma/adapter-pg dotenv pg

bunx tsc --init

bunx prisma init
```

3. **Add your connection information to your .env file**

- On your project dashboard, click [Connect](https://supabase.com/dashboard/project/_?showConnect=true)
- Find your Supavisor Session pooler string. It should end with 5432. It will be used in your `.env` file.

Note: If you're in an [IPv6 environment](https://github.com/orgs/supabase/discussions/27034) or have the IPv4 Add-On, you can use the direct connection string instead of Supavisor in Session mode.

- If you plan on deploying Prisma to a serverless or auto-scaling environment, you'll also need your Supavisor transaction mode string.
- The string is identical to the session mode string but uses port 6543 at the end.

**server-based deployments**

In your .env file, set the DATABASE\_URL variable to your connection string

```text .env
# Used for Prisma Migrations and within your application
DATABASE_URL="postgres://[DB-USER].[PROJECT-REF]:[PRISMA-PASSWORD]@[DB-REGION].pooler.supabase.com:5432/postgres"
```

Change your string's `[DB-USER]` to `prisma` and add the password you created in step 1

```md
postgres://prisma.[PROJECT-REF]...
```

**serverless deployments**

Assign the connection string for Supavisor Transaction Mode (using port 6543) to the DATABASE\_URL variable in your .env file. Make sure to append "pgbouncer=true" to the end of the string to work with Supavisor.

Next, create a DIRECT\_URL variable in your .env file and assign the connection string that ends with port 5432 to it.

```text .env # Used in your application (use transaction mode)
DATABASE_URL="postgres://[DB-USER].[PROJECT-REF]:[PRISMA-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Used for Prisma Migrations (use session mode or direct connection)
DIRECT_URL="postgres://[DB-USER].[PROJECT-REF]:[PRISMA-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

Change both your strings' `[DB-USER]` to `prisma` and then add the password created in step 1

```md
postgres://prisma.[PROJECT-REF]...
```

4. **Configure prisma.config.ts**

Add `import "dotenv/config"` to the generated `prisma.config.ts`. If you are using a serverless environment, change the data source URL to `DIRECT_URL`.

**server-based deployments**

```ts prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

**serverless deployments**

```ts prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
```

5. **Migrate and generate your Prisma client**

If you have already modified your Supabase database, synchronize it with your migration file. Otherwise create new tables for your database, then generate the Prisma client.

**New Projects**

Create new tables in your prisma.schema file

```ts prisma/schema.prisma
model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String?
  published Boolean @default(false)
  author    User?   @relation(fields: [authorId], references: [id])
  authorId  Int?
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]
}
```

commit your migration

**npm**

```bash
npx prisma migrate dev --name first_prisma_migration
npx prisma generate
```

**pnpm**

```bash
pnpx prisma migrate dev --name first_prisma_migration
pnpx prisma generate
```

**yarn**

```bash
npx prisma migrate dev --name first_prisma_migration
npx prisma generate
```

**bun**

```bash
bunx prisma migrate dev --name first_prisma_migration
bunx prisma generate
```

**Populated Projects**

Synchronize changes from your project:

**npm**

```bash
npx prisma db pull
```

Create a migration file

```bash
mkdir -p prisma/migrations/0_init_supabase
```

Synchronize the migrations

```bash
  npx prisma migrate diff \
  --from-empty \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/0_init_supabase/migration.sql
```

Note: If there are any conflicts, reference [Prisma's official doc](https://www.prisma.io/docs/orm/prisma-migrate/getting-started#work-around-features-not-supported-by-prisma-schema-language) or the [trouble shooting guide](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting) for more details

```bash
npx prisma migrate resolve --applied 0_init_supabase
npx prisma generate
```

**pnpm**

```bash
pnpx prisma db pull
```

Create a migration file

```bash
mkdir -p prisma/migrations/0_init_supabase
```

Synchronize the migrations

```bash
  pnpx prisma migrate diff \
  --from-empty \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/0_init_supabase/migration.sql
```

Note: If there are any conflicts, reference [Prisma's official doc](https://www.prisma.io/docs/orm/prisma-migrate/getting-started#work-around-features-not-supported-by-prisma-schema-language) or the [trouble shooting guide](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting) for more details

```bash
pnpx prisma migrate resolve --applied 0_init_supabase
pnpx prisma generate
```

**yarn**

```bash
npx prisma db pull
```

Create a migration file

```bash
mkdir -p prisma/migrations/0_init_supabase
```

Synchronize the migrations

```bash
  npx prisma migrate diff \
  --from-empty \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/0_init_supabase/migration.sql
```

Note: If there are any conflicts, reference [Prisma's official doc](https://www.prisma.io/docs/orm/prisma-migrate/getting-started#work-around-features-not-supported-by-prisma-schema-language) or the [trouble shooting guide](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting) for more details

```bash
npx prisma migrate resolve --applied 0_init_supabase
npx prisma generate
```

**bun**

```bash
bunx prisma db pull
```

Create a migration file

```bash
mkdir -p prisma/migrations/0_init_supabase
```

Synchronize the migrations

```bash
  bunx prisma migrate diff \
  --from-empty \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/0_init_supabase/migration.sql
```

Note: If there are any conflicts, reference [Prisma's official doc](https://www.prisma.io/docs/orm/prisma-migrate/getting-started#work-around-features-not-supported-by-prisma-schema-language) or the [trouble shooting guide](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting) for more details

```bash
bunx prisma migrate resolve --applied 0_init_supabase
bunx prisma generate
```

6. **Test your API**

Create a index.ts file and run it to test your connection

```ts index.ts
import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

async function main() {
  const val = await prisma.user.findMany({
    take: 10,
  });
  console.log(val);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
```
