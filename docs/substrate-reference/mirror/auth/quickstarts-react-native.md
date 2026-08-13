<!-- source: https://supabase.com/docs/guides/auth/quickstarts/react-native · mirrored 2026-08-13 from Supabase docs -->

# Use Supabase Auth with React Native

Learn how to use Supabase Auth with React Native

## Quickstart

1. **Create a new Supabase project**

[Launch a new project](https://supabase.com/dashboard) in the Supabase Dashboard.

Your new database has a table for storing your users. You can see that this table is currently empty by running some SQL in the [SQL Editor](https://supabase.com/dashboard/project/_/sql).

```sql name=SQL_EDITOR
 select * from auth.users;
```

2. **Create a React app**

Create a React app using the `create-expo-app` command.

```bash name=Terminal
npx create-expo-app -t expo-template-blank-typescript my-app
```

3. **Install the Supabase client library**

Install `supabase-js` and the required dependencies.

```bash name=Terminal
cd my-app && npx expo install @supabase/supabase-js @react-native-async-storage/async-storage @rneui/themed react-native-url-polyfill
```

4. **Set up your login component**

Create a helper file `lib/supabase.ts` that exports a Supabase client using your Project URL and key.

Rename `.env.example` to `.env` and populate with your Supabase connection variables:

### Get API details

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](https://supabase.com/docs/guides/api), authenticating using the Project URL and key from [the project **Connect** dialog](https://supabase.com/dashboard/project/_?showConnect=true\&connectTab=mobiles\&framework=exporeactnative).





Note: [Read the API keys docs](https://supabase.com/docs/guides/getting-started/api-keys) for a full explanation of all key types, their uses, and where to find them.

5. **Create a login component**

Create a React Native component to manage logins and sign ups. The app later uses the [`getClaims`](https://supabase.com/docs/reference/javascript/auth-getclaims) method in `App.tsx` to validate the local JWT before showing the signed-in user.

6. **Add the Auth component to your app**

Add the `Auth` component to your `App.tsx` file. If the user is logged in, print the user id to the screen.

7. **Start the app**

Start the app, and follow the instructions in the terminal.

```bash name=Terminal
npm start
```
