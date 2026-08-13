<!-- source: https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth · mirrored 2026-08-13 from Supabase docs -->

# Build a Social Auth App with Expo React Native

Learn how to implement social authentication in an app with Expo React Native and Supabase Database and Auth functionality.

This tutorial demonstrates how to build a React Native app with [Expo](https://expo.dev) that implements social authentication. The app showcases a complete authentication flow with protected navigation using:

- [Supabase Database](https://supabase.com/docs/guides/database/overview) - a Postgres database for storing your user data with [Row Level Security](https://supabase.com/docs/guides/auth#row-level-security) to ensure data is protected and users can only access their own information.
- [Supabase Auth](https://supabase.com/docs/guides/auth) - enables users to log in through social authentication providers (Apple and Google).

![Supabase Social Auth example](/docs/img/supabase-expo-social-auth-login.png)

Note: If you get stuck while working through this guide, refer to the [full example on GitHub](https://github.com/supabase/supabase/tree/master/examples/auth/expo-social-auth).

## Project setup

Before you start building you need to set up the Database and API. You can do this by starting a new Project in Supabase and then creating a "schema" inside the database.

### Create a project

1. [Create a new project](https://supabase.com/dashboard) in the Supabase Dashboard.
2. Enter your project details.
3. Wait for the new database to launch.

### Set up the database schema

Now set up the database schema. You can use the "User Management Starter" quickstart in the SQL Editor, or you can copy/paste the SQL from below and run it.

**Dashboard**

1. Go to the [SQL Editor](https://supabase.com/dashboard/project/_/sql) page in the Dashboard.
2. Click **User Management Starter** under the **Community > Quickstarts** tab.
3. Click **Run**.

Note: You can pull the database schema down to your local project by running the `db pull` command. Read the [local development docs](https://supabase.com/docs/guides/local-development/database-migrations#link-your-project) for detailed instructions.

```bash
supabase link --project-ref <project-id>
# You can get <project-id> from your project's dashboard URL: https://supabase.com/dashboard/project/<project-id>
supabase db pull
```

**SQL**

Note: When working locally you can run the following command to create a new migration file:

```bash
supabase migration new user_management_starter
```

```sql
-- Create a table for public profiles
create table profiles (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  website text,

  constraint username_length check (char_length(username) >= 3)
);

-- Grant the privileges roles need
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/database/postgres/row-level-security for more details.
alter table profiles
  enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check ((select auth.uid()) = id);

create policy "Users can update own profile." on profiles
  for update using ((select auth.uid()) = id);

-- This trigger automatically creates a profile entry when a new user signs up via Supabase Auth.
-- See https://supabase.com/docs/guides/auth/managing-user-data#using-triggers for more details.
create function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Set up Storage!
insert into storage.buckets (id, name)
  values ('avatars', 'avatars');

-- Set up access controls for storage. Allows downloading object with public key
-- See https://supabase.com/docs/guides/storage/security/access-control#policy-examples for more details.
create policy "Avatar images are publicly accessible." on storage.objects
  for select using (bucket_id = 'avatars' and storage.allow_any_operation(array['object.get_authenticated_info', 'object.get_authenticated']));

create policy "Anyone can upload an avatar." on storage.objects
  for insert with check (bucket_id = 'avatars');

create policy "Anyone can update their own avatar." on storage.objects
  for update using ((select auth.uid()) = owner) with check (bucket_id = 'avatars');
```

### Get API details

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](https://supabase.com/docs/guides/api), authenticating using the Project URL and key from [the project **Connect** dialog](https://supabase.com/dashboard/project/_?showConnect=true\&connectTab=mobiles\&framework=exporeactnative).





Note: [Read the API keys docs](https://supabase.com/docs/guides/getting-started/api-keys) for a full explanation of all key types, their uses, and where to find them.

## Building the app

Start by building the React Native app from scratch.

### Initialize a React Native app

Use [Expo](https://docs.expo.dev/get-started/create-a-project/) to initialize an app called `expo-social-auth` with the [standard template](https://docs.expo.dev/more/create-expo/#--template):

```bash
npx create-expo-app@latest

cd expo-social-auth
```

Install the additional dependencies:

- [supabase-js](https://github.com/supabase/supabase-js)
- [@react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage) - A key-value store for React Native.
- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) - Provides a way to securely store key-value pairs locally on the device.
- [expo-splash-screen](https://docs.expo.dev/versions/latest/sdk/splash-screen/) - Provides a way to programmatically manage the splash screen.

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage expo-secure-store expo-splash-screen
```

Now, create a helper file to initialize the Supabase client for both web and React Native platforms using platform-specific [storage adapters](https://docs.expo.dev/develop/user-interface/store-data/): [Expo SecureStore](https://docs.expo.dev/develop/user-interface/store-data/#secure-storage) for mobile and [AsyncStorage](https://docs.expo.dev/develop/user-interface/store-data/#async-storage) for web.

**AsyncStorage**



**SecureStore**

If you want to encrypt the user's session information, use `aes-js` and store the encryption key in [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore). The [`aes-js` library](https://github.com/ricmoo/aes-js) is a reputable JavaScript-only implementation of the AES encryption algorithm in CTR mode. A new 256-bit encryption key is generated using the `react-native-get-random-values` library. This key is stored inside Expo's SecureStore, while the value is encrypted and placed inside AsyncStorage.

Make sure that:

- You keep the `expo-secure-storage`, `aes-js` and `react-native-get-random-values` libraries up-to-date.
- Choose the correct [`SecureStoreOptions`](https://docs.expo.dev/versions/latest/sdk/securestore/#securestoreoptions) for your app's needs. E.g. [`SecureStore.WHEN_UNLOCKED`](https://docs.expo.dev/versions/latest/sdk/securestore/#securestorewhen_unlocked) regulates when the data can be accessed.
- Carefully consider optimizations or other modifications to the above example, as those can lead to introducing subtle security vulnerabilities.

Implement a `ExpoSecureStoreAdapter` to pass in as Auth storage adapter for the `supabase-js` client:

### Set up environment variables

You need the API URL and the `publishable` key copied [earlier](#get-the-api-keys).
These variables are safe to expose in your Expo app since Supabase has [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) enabled on your database.

Create a `.env` file containing these variables:



### Set up protected navigation

Next, you need to protect app navigation to prevent unauthenticated users from accessing protected routes. Use the [Expo `SplashScreen`](https://docs.expo.dev/versions/latest/sdk/splash-screen/) to display a loading screen while fetching the user profile and verifying authentication status.

#### Create the `AuthContext`

Create [a React context](https://react.dev/learn/passing-data-deeply-with-context) to manage the authentication session, making it accessible from any component:



#### Create the `AuthProvider`

Next, create a provider component to manage the authentication session throughout the app:



#### Create the `SplashScreenController`

Create a `SplashScreenController` component to display the [Expo `SplashScreen`](https://docs.expo.dev/versions/latest/sdk/splash-screen/) while the authentication session is loading:



### Create a logout component

Create a logout button component to handle user sign-out:



And add it to the `app/(tabs)/index.tsx` file used to display the user profile data and the logout button:



### Create a login screen

Next, create a basic login screen component:



#### Implement protected routes

Wrap the navigation with the `AuthProvider` and `SplashScreenController`.

Using [Expo Router's protected routes](https://docs.expo.dev/router/advanced/authentication/#using-protected-routes), you can secure navigation:



You can now test the app by running:

```bash
npx expo prebuild
npx expo start --clear
```

Verify that the app works as expected. The splash screen displays while fetching the user profile, and the login page appears even when attempting to navigate to the home screen using the `Link` button.

Note: By default Supabase Auth requires email verification before a session is created for the user. To support email verification you need to [implement deep link handling](https://supabase.com/docs/guides/auth/native-mobile-deep-linking?platform=react-native)!

While testing, you can disable email confirmation in your [project's email auth provider settings](https://supabase.com/dashboard/project/_/auth/providers).

## Integrate social authentication

Now integrate social authentication with Supabase Auth, starting with Apple authentication.
If you only need to implement Google authentication, you can skip to the [Google authentication](#google-authentication) section.

### Apple authentication

Start by adding the button inside the login screen:

```tsx name=app/login.tsx
…
import AppleSignInButton from '@/components/social-auth-buttons/apple/apple-sign-in-button';
…
export default function LoginScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Login' }} />
      <ThemedView style={styles.container}>
        …
        <AppleSignInButton />
        …
      </ThemedView>
    </>
  );
}
…
```

For Apple authentication, you can choose between:

- [Invertase's React Native Apple Authentication library](https://github.com/invertase/react-native-apple-authentication) - that supports iOS, Android
- [react-apple-signin-auth](https://react-apple-signin-auth.ahmedtokyo.com/) - that supports Web, also suggested by Invertase
- [Expo's AppleAuthentication library](https://docs.expo.dev/versions/latest/sdk/apple-authentication/) - that supports iOS only

For either option, you need to obtain a Service ID from the [Apple Developer Console](https://supabase.com/docs/guides/auth/social-login/auth-apple?queryGroups=framework\&framework=nextjs\&queryGroups=platform\&platform=web#configuration-web).

Note: To enable Apple sign-up on Android and Web, you also need to register the tunnelled URL (e.g., `https://arnrer1-anonymous-8081.exp.direct`) obtained by running:

```bash
npx expo start --tunnel
```

And add it to the **Redirect URLs** field in [your Supabase dashboard Authentication configuration](https://supabase.com/dashboard/project/_/auth/url-configuration).

For more information, follow the [Supabase Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple) guide.

**Invertase**

#### Prerequisites

Before proceeding, ensure you have followed the Invertase prerequisites documented in the [Invertase Initial Setup Guide](https://github.com/invertase/react-native-apple-authentication/blob/main/docs/INITIAL_SETUP.md) and the [Invertase Android Setup Guide](https://github.com/invertase/react-native-apple-authentication/blob/main/docs/ANDROID_EXTRA.md).

You need to add two new environment variables to the `.env` file:

```bash
EXPO_PUBLIC_APPLE_AUTH_SERVICE_ID="YOUR_APPLE_AUTH_SERVICE_ID"
EXPO_PUBLIC_APPLE_AUTH_REDIRECT_URI="YOUR_APPLE_AUTH_REDIRECT_URI"
```

#### iOS

Install the `@invertase/react-native-apple-authentication` library:

```bash
npx expo install @invertase/react-native-apple-authentication
```

Then create the iOS specific button component `AppleSignInButton`:



Note: To test functionality on the simulator, remove the `getCredentialStateForUser` check:

```tsx name=components/social-auth-buttons/apple/apple-sign-in-button.ios.tsx
…
const credentialState = await appleAuth.getCredentialStateForUser(appleAuthRequestResponse.user);
…
```

Enable the Apple authentication capability in iOS:

```json name=app.json
{
  "expo": {
    …
    "ios": {
      …
      "usesAppleSignIn": true
      …
    },
    …
  }
}
```

Add the capabilities to the `Info.plist` file by following the [Expo documentation](https://docs.expo.dev/build-reference/ios-capabilities/#xcode).

Note: Before testing the app, if you've already built the iOS app, clean the project artifacts:

```bash
npx react-native-clean-project clean-project-auto
```

If issues persist, try completely cleaning the cache, as reported by many users in this [closed issue](https://github.com/invertase/react-native-apple-authentication/issues/23).

Finally, update the iOS project by installing the Pod library and running the Expo prebuild command:

```bash
cd ios
pod install
cd ..
npx expo prebuild
```

Now test the application on a physical device:

```bash
npx expo run:ios --no-build-cache --device
```

You should see the login screen with the Apple authentication button.

Note: If you get stuck while working through this guide, refer to the [full Invertase example on GitHub](https://github.com/invertase/react-native-apple-authentication?tab=readme-ov-file#react-native-apple-authentication).

#### Android

Install the required libraries:

```bash
npx expo install @invertase/react-native-apple-authentication react-native-get-random-values uuid
```

Next, create the Android-specific `AppleSignInButton` component:



You should now be able to test the authentication by running it on a physical device or simulator:

```bash
npx expo run:android --no-build-cache
```

**Web**

#### Prerequisites

Before proceeding, as per the mobile options you need an Apple Service ID. To obtain it you can follow the [Invertase Initial Setup Guide](https://github.com/invertase/react-native-apple-authentication/blob/main/docs/INITIAL_SETUP.md) and the [Invertase Android Setup Guide](https://github.com/invertase/react-native-apple-authentication/blob/main/docs/ANDROID_EXTRA.md) mentioned in the Invertase tab.

You also need to add two new environment variables to the `.env` file:

```bash
EXPO_PUBLIC_APPLE_AUTH_SERVICE_ID="YOUR_APPLE_AUTH_SERVICE_ID"
EXPO_PUBLIC_APPLE_AUTH_REDIRECT_URI="YOUR_APPLE_AUTH_REDIRECT_URI"
```

#### Web

Install the required libraries:

```bash
npx expo install react-apple-signin-auth
```

Next, create the Web-specific `AppleSignInButton` component:



Test the authentication in your browser using the tunneled HTTPS URL:

```bash
npx expo start --tunnel
```

**Expo**

#### Prerequisites

Before proceeding, ensure you have followed the Expo prerequisites documented in the [Expo Setup Guide](https://docs.expo.dev/versions/latest/sdk/apple-authentication/).

#### iOS

Install the `expo-apple-authentication` library:

```bash
npx expo install expo-apple-authentication
```

Enable the Apple authentication capability in iOS and the plugin in `app.json`:

```json name=app.json
{
  "expo": {
    …
    "ios": {
      …
      "usesAppleSignIn": true
      …
    },
    "plugins": ["expo-apple-authentication"]
    …
  }
}
```

Then create the iOS specific button component `AppleSignInButton`:



Note: The Expo Apple Sign In button does not support the Simulator, so you need to test it on a physical device.

### Google authentication

Start by adding the button to the login screen:

```tsx name=app/login.tsx
…
import GoogleSignInButton from '@/components/social-auth-buttons/google/google-sign-in-button';
…
export default function LoginScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Login' }} />
      <ThemedView style={styles.container}>
        …
        <GoogleSignInButton />
        …
      </ThemedView>
    </>
  );
}
…
```

For Google authentication, you can choose between the following options:

- [GN Google Sign In Premium](https://react-native-google-signin.github.io/docs/install#sponsor-only-version) - that supports iOS, Android, and Web by using the latest Google's One Tap sign-in (but [it requires a subscription](https://universal-sign-in.com/))
- [@react-oauth/google](https://github.com/MomenSherif/react-oauth#googlelogin) - that supports Web (so it's not a good option for mobile, but it works)
- Relying on the [`signInWithOAuth`](https://supabase.com/docs/reference/javascript/auth-signinwithoauth) function of the Supabase Auth - that also supports iOS, Android and Web (useful also to manage any other OAuth provider)

Note: The [GN Google Sign In Free](https://react-native-google-signin.github.io/docs/install#public-version-free) doesn't support iOS or Android, as [it doesn't allow to pass a custom nonce](https://github.com/react-native-google-signin/google-signin/issues/1176) to the sign-in request.

For either option, you need to obtain a Web Client ID from the Google Cloud Engine, as explained in the [Google Sign In](https://supabase.com/docs/guides/auth/social-login/auth-google?queryGroups=platform\&platform=react-native#react-native) guide.

This guide only uses the [@react-oauth/google@latest](https://github.com/MomenSherif/react-oauth#googlelogin) option for the Web, and the [`signInWithOAuth`](https://supabase.com/docs/reference/javascript/auth-signinwithoauth) for the mobile platforms.

Before proceeding, add a new environment variable to the `.env` file:

```bash
EXPO_PUBLIC_GOOGLE_AUTH_WEB_CLIENT_ID="YOUR_GOOGLE_AUTH_WEB_CLIENT_ID"
```

**Mobile**

Create the mobile generic button component `GoogleSignInButton`:



Finally, update the iOS and Android projects by running the Expo prebuild command:

```bash
npx expo prebuild --clean
```

Now test the application on both iOS and Android:

```bash
npx expo run:ios && npx expo run:android
```

You should see the login screen with the Google authentication button.

![Supabase Social Auth example](/docs/img/supabase-expo-social-auth-tabs.png)

**Web**

Install the `@react-oauth/google` library:

```bash
npx expo install @react-oauth/google
```

Enable the `expo-web-browser` plugin in `app.json`:

```json name=app.json
{
  "expo": {
    …
    "plugins": [
      …
      [
        "expo-web-browser",
        {
          "experimentalLauncherActivity": false
        }
      ]
      …
    ],
    …
  }
}
```

Then create the iOS specific button component `GoogleSignInButton`:



Test the authentication in your browser using the tunnelled HTTPS URL:

```bash
npx expo start --tunnel
```

Note: To allow the Google Sign In to work, as you did before for Apple, you need to register the tunnelled URL (e.g., `https://arnrer1-anonymous-8081.exp.direct`) obtained to the Authorized JavaScript origins list of your [Google Cloud Console's OAuth 2.0 Client IDs](https://console.cloud.google.com/auth/clients/) configuration.
