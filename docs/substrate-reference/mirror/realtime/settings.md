<!-- source: https://supabase.com/docs/guides/realtime/settings · mirrored 2026-08-13 from Supabase docs -->

# Settings

Realtime Settings that allow you to configure your Realtime usage.

## Settings

Caution: All changes made in this screen will disconnect all your connected clients to ensure Realtime starts with the appropriate settings and all changes are stored in Supabase middleware.

![Usage page navigation bar](https://supabase.com/docs/img/guides/platform/realtime/realtime-settings--dark.png)

You can set the following settings using the Realtime Settings screen in your Dashboard:

- Enable Realtime service: Determines if the Realtime service is enabled or disabled for your project.
- Channel Restrictions: You can toggle this settings to set Realtime to allow public channels or set it to use only private channels with [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization).
- Database connection pool size: Determines the number of connections used for Realtime Authorization RLS checking
- Max concurrent clients: Determines the maximum number of clients that can be connected
- Max events per second: Determines the maximum number of events per second that can be sent
- Max presence events per second: Determines the maximum number of presence events per second that can be sent
- Max payload size in KB: Determines the maximum number of payload size in KB that can be sent
