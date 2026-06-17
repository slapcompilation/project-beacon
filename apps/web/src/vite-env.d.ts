/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Comma-separated OAuth providers to show on the login page, e.g. "google,azure".
   *  Each must also be enabled in the Supabase dashboard. Unset = no OAuth buttons. */
  readonly VITE_OAUTH_PROVIDERS?: string
}
