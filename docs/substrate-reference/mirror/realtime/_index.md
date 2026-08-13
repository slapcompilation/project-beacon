<!-- source: https://supabase.com/docs/guides/realtime · mirrored 2026-08-13 from Supabase docs -->

# Realtime

Send and receive messages to connected clients.

Supabase provides a globally distributed [Realtime](https://github.com/supabase/realtime) service with the following features:

- [Broadcast](https://supabase.com/docs/guides/realtime/broadcast): Send low-latency messages between clients. Perfect for real-time messaging, database changes, cursor tracking, game events, and custom notifications.
- [Presence](https://supabase.com/docs/guides/realtime/presence): Track and synchronize user state across clients. Ideal for showing who's online, or active participants.
- [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes): Listen to database changes in real-time.

## What can you build?

- **Chat applications** - Real-time messaging with typing indicators and online presence
- **Collaborative tools** - Document editing, whiteboards, and shared workspaces
- **Live dashboards** - Real-time data visualization and monitoring
- **Multiplayer games** - Synchronized game state and player interactions
- **Social features** - Live notifications, reactions, and user activity feeds

## Get started

- **[Getting Started](https://supabase.com/docs/guides/realtime/getting_started):** Set up Realtime in your project and send your first message.

## Examples

- **[Multiplayer.dev](https://multiplayer.dev):** Showcase application displaying cursor movements and chat messages using Broadcast.
- **[Chat](https://supabase.com/library/docs/nextjs/realtime-chat):** Supabase Library chat component using Broadcast to send messages between users.
- **[Avatar Stack](https://supabase.com/library/docs/nextjs/realtime-avatar-stack):** Supabase Library avatar stack component using Presence to track connected users.
- **[Realtime Cursor](https://supabase.com/library/docs/nextjs/realtime-cursor):** Supabase Library realtime cursor component using Broadcast to share users' cursors to build collaborative applications.

## Resources

Find the source code and documentation in the Supabase GitHub repository:

- **[Supabase Realtime](https://github.com/supabase/realtime):** View the source code.
- **[Realtime: Multiplayer Edition](https://supabase.com/blog/supabase-realtime-multiplayer-general-availability):** Read more about Supabase Realtime.
