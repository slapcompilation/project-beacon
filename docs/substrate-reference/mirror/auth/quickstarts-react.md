<!-- source: https://supabase.com/docs/guides/auth/quickstarts/react · mirrored 2026-08-13 from Supabase docs -->

# Use Supabase Auth with React

Learn how to use Supabase Auth with React.js.

## Quickstart

1. **Create a new Supabase project**

[Launch a new project](https://supabase.com/dashboard) in the Supabase Dashboard.

Your new database has a table for storing your users. You can see that this table is currently empty by running some SQL in the [SQL Editor](https://supabase.com/dashboard/project/_/sql).

```sql name=SQL_EDITOR
 select * from auth.users;
```

2. **Create a React app**

Create a React app using a [Vite](https://vitejs.dev/guide/) template.

```bash name=Terminal
npm create vite@latest my-app -- --template react
```

3. **Install the Supabase client library**

Navigate to the React app and install the Supabase libraries.

```bash name=Terminal
cd my-app && npm install @supabase/supabase-js
```

4. **Declare Supabase Environment Variables**

Rename `.env.example` to `.env.local` and populate with your Supabase connection variables:

### Get API details

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](https://supabase.com/docs/guides/api), authenticating using the Project URL and key from [the project **Connect** dialog](https://supabase.com/dashboard/project/_?showConnect=true\&connectTab=frameworks\&framework=react).





Note: [Read the API keys docs](https://supabase.com/docs/guides/getting-started/api-keys) for a full explanation of all key types, their uses, and where to find them.

5. **Set up your login component**

Note: UI components built on shadcn/ui that connect to Supabase via a single command.

Explore Components

In `App.jsx`, create a Supabase client using your Project URL and key.

The code uses the [`getClaims`](https://supabase.com/docs/reference/javascript/auth-getclaims) method in `App.jsx` to validate the local JWT before showing the signed-in user.

6. **Customize email template**

Before proceeding, change the email template to support a server-side authentication flow that sends a token hash:

- Go to the [Auth templates](https://supabase.com/dashboard/project/_/auth/templates) page in your dashboard.
- Select the Confirm sign up template.
- Change `{{ .ConfirmationURL }}` to `{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=email`.
- Change your [Site URL](https://supabase.com/dashboard/project/_/auth/url-configuration) to `https://localhost:5173`

7. **Start the app**

Start the app, go to [http://localhost:5173](http://localhost:5173) in a browser, and open the browser console and you should be able to register and log in.

```bash name=Terminal
npm run dev
```
