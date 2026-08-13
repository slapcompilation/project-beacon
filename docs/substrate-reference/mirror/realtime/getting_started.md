<!-- source: https://supabase.com/docs/guides/realtime/getting_started · mirrored 2026-08-13 from Supabase docs -->

# Getting Started with Realtime

Learn how to build real-time applications with Supabase Realtime

## Quick start

### 1. Install the client library

**TypeScript**

```bash
npm install @supabase/supabase-js
```

**Flutter**

```bash
flutter pub add supabase_flutter
```

**Swift**

```swift
let package = Package(
    // ...
    dependencies: [
        // ...
        .package(
            url: "https://github.com/supabase/supabase-swift.git",
            from: "2.0.0"
        ),
    ],
    targets: [
        .target(
            name: "YourTargetName",
            dependencies: [
                .product(
                    name: "Supabase",
                    package: "supabase-swift"
                ),
            ]
        )
    ]
)
```

**Python - PIP**

```bash
pip install supabase
```

**Python - Conda**

```bash
conda install -c conda-forge supabase
```

**C#**

```bash
dotnet add package Supabase
```

### 2. Initialize the client

Get your project URL and key.

### Get API details

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](https://supabase.com/docs/guides/api), authenticating using the Project URL and key from [the project **Connect** dialog](https://supabase.com/dashboard/project/_?showConnect=true\&connectTab=\&framework=).





Note: [Read the API keys docs](https://supabase.com/docs/guides/getting-started/api-keys) for a full explanation of all key types, their uses, and where to find them.

**TypeScript**

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://<project>.supabase.co', '<sb_publishable_key>')
```

**Flutter**

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

void main() async {
  await Supabase.initialize(
    url: 'https://<project>.supabase.co',
    publishableKey: '<sb_publishable_key>',
  );
  runApp(MyApp());
}

final supabase = Supabase.instance.client;
```

**Swift**

```swift
import Supabase

let supabase = SupabaseClient(
  supabaseURL: URL(string: "https://<project>.supabase.co")!,
  supabaseKey: "<sb_publishable_key>"
)
```

**Python**

```python
from supabase import create_client, Client

url: str = "https://<project>.supabase.co"
key: str = "<sb_publishable_key>"
supabase: Client = create_client(url, key)
```

**C#**

```c#
using Supabase;

var supabase = new Client(
  "https://<project>.supabase.co",
  "<sb_publishable_key>"
);
await supabase.InitializeAsync();
```

### 3. Create your first Channel

Channels are the foundation of Realtime. Think of them as rooms where clients can communicate. Each channel is identified by a topic name and if they are public or private.

**TypeScript**

```ts
// Create a channel with a descriptive topic name
const channel = supabase.channel('room:lobby:messages', {
  config: { private: true }, // Recommended for production
})
```

**Flutter**

```dart
// Create a channel with a descriptive topic name
final channel = supabase.channel('room:lobby:messages');
```

**Swift**

```swift
// Create a channel with a descriptive topic name
let channel = supabase.channel("room:lobby:messages") {
  $0.isPrivate = true
}
```

**Python**

```python
# Create a channel with a descriptive topic name
channel = supabase.channel('room:lobby:messages', params={'config': {'private': True }})
```

**C#**

```c#
// Create a channel with a descriptive topic name.
// Note: The C# SDK does not yet support private channel configuration,
// so this connects to a public channel.
var channel = supabase.Realtime.Channel("room:lobby:messages");
```

### 4. Set up authorization

Since we're using a private channel, you need to create a basic RLS policy on the `realtime.messages` table to allow authenticated users to connect. Row Level Security (RLS) policies control who can access your Realtime channels based on user authentication and custom rules:

```sql
-- Allow authenticated users to receive broadcasts
CREATE POLICY "authenticated_users_can_receive" ON realtime.messages
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to send broadcasts
CREATE POLICY "authenticated_users_can_send" ON realtime.messages
  FOR INSERT TO authenticated WITH CHECK (true);
```

### 5. Send and receive messages

There are three main ways to send messages with Realtime:

#### 5.1 using client libraries

Send and receive messages using the Supabase client:

**TypeScript**

```ts
// Listen for messages
channel
  .on('broadcast', { event: 'message_sent' }, (payload: { payload: any }) => {
    console.log('New message:', payload.payload)
  })
  .subscribe()

// Send a message
channel.send({
  type: 'broadcast',
  event: 'message_sent',
  payload: {
    text: 'Hello, world!',
    user: 'john_doe',
    timestamp: new Date().toISOString(),
  },
})
```

**Flutter**

```dart
// Listen for messages
channel.onBroadcast(
  event: 'message_sent',
  callback: (payload) {
    print('New message: ${payload['payload']}');
  },
).subscribe();

// Send a message
channel.sendBroadcastMessage(
  event: 'message_sent',
  payload: {
    'text': 'Hello, world!',
    'user': 'john_doe',
    'timestamp': DateTime.now().toIso8601String(),
  },
);
```

**Swift**

```swift
// Listen for messages
await channel.onBroadcast(event: "message_sent") { message in
  print("New message: \(message.payload)")
}

let status = await channel.subscribe()

// Send a message
await channel.sendBroadcastMessage(
  event: "message_sent",
  payload: [
    "text": "Hello, world!",
    "user": "john_doe",
    "timestamp": ISO8601DateFormatter().string(from: Date())
  ]
)
```

**Python**

```python
# Listen for messages
def message_handler(payload):
    print(f"New message: {payload['payload']}")

channel.on_broadcast(event="message_sent", callback=message_handler).subscribe()

# Send a message
channel.send_broadcast_message(
    event="message_sent",
    payload={
        "text": "Hello, world!",
        "user": "john_doe",
        "timestamp": datetime.now().isoformat()
    }
)
```

**C#**

```c#
class MessageBroadcast : BaseBroadcast
{
    [JsonProperty("text")]
    public string Text { get; set; }

    [JsonProperty("user")]
    public string User { get; set; }

    [JsonProperty("timestamp")]
    public string Timestamp { get; set; }
}

// Listen for messages
var broadcast = channel.Register<MessageBroadcast>();
broadcast.AddBroadcastEventHandler((sender, _) =>
{
    Console.WriteLine($"New message: {broadcast.Current()}");
});

await channel.Subscribe();

// Send a message
await broadcast.Send("message_sent", new MessageBroadcast
{
    Text = "Hello, world!",
    User = "john_doe",
    Timestamp = DateTime.UtcNow.ToString("o")
});
```

#### 5.2 using HTTP/REST API

Send messages via HTTP requests, perfect for server-side applications:

**TypeScript**

```ts
// Send message via REST API
const response = await fetch(`https://<project>.supabase.co/rest/v1/rpc/broadcast`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    -H "apikey: <SECRET_KEY>"
  },
  body: JSON.stringify({
    topic: 'room:lobby:messages',
    event: 'message_sent',
    payload: {
      text: 'Hello from server!',
      user: 'system',
      timestamp: new Date().toISOString(),
    },
    private: true,
  }),
})
```

**Flutter**

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

// Send message via REST API
final response = await http.post(
  Uri.parse('https://<project>.supabase.co/rest/v1/rpc/broadcast'),
  headers: {
    'Content-Type': 'application/json',
    -H "apikey: <SECRET_KEY>"
  },
  body: jsonEncode({
    'topic': 'room:lobby:messages',
    'event': 'message_sent',
    'payload': {
      'text': 'Hello from server!',
      'user': 'system',
      'timestamp': DateTime.now().toIso8601String(),
    },
    'private': true,
  }),
);
```

**Swift**

```swift
import Foundation

// Send message via REST API
let url = URL(string: "https://<project>.supabase.co/rest/v1/rpc/broadcast")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.setValue("<SECRET_KEY>", forHTTPHeaderField: "apikey")

let payload = [
  "topic": "room:lobby:messages",
  "event": "message_sent",
  "payload": [
    "text": "Hello from server!",
    "user": "system",
    "timestamp": ISO8601DateFormatter().string(from: Date())
  ],
  "private": true
] as [String: Any]

request.httpBody = try JSONSerialization.data(withJSONObject: payload)

let (data, response) = try await URLSession.shared.data(for: request)
```

**Python**

```python
import requests
from datetime import datetime

# Send message via REST API
response = requests.post(
    'https://<project>.supabase.co/rest/v1/rpc/broadcast',
    headers={
        'Content-Type': 'application/json',
        'apikey': '<SECRET_KEY>'
    },
    json={
        'topic': 'room:lobby:messages',
        'event': 'message_sent',
        'payload': {
            'text': 'Hello from server!',
            'user': 'system',
            'timestamp': datetime.now().isoformat()
        },
        'private': True
    }
)
```

#### 5.3 using database triggers

Automatically broadcast database changes using triggers. Choose the approach that best fits your needs:

**Using `realtime.broadcast_changes` (Best for mirroring database changes)**

```sql
-- Create a trigger function for broadcasting database changes
CREATE OR REPLACE FUNCTION broadcast_message_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Broadcast to room-specific channel
  PERFORM realtime.broadcast_changes(
    'room:' || NEW.room_id::text || ':messages',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to your messages table
CREATE TRIGGER messages_broadcast_trigger
  AFTER INSERT OR UPDATE OR DELETE ON messages
  FOR EACH ROW EXECUTE FUNCTION broadcast_message_changes();
```

**Using `realtime.send` (Best for custom notifications and filtered data)**

```sql
-- Create a trigger function for custom notifications
CREATE OR REPLACE FUNCTION notify_message_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Send custom notification when new message is created
  IF TG_OP = 'INSERT' THEN
    PERFORM realtime.send(
      jsonb_build_object(
        'message_id', NEW.id,
        'user_id', NEW.user_id,
        'room_id', NEW.room_id,
        'created_at', NEW.created_at
      ),
      'message_created',
      'room:' || NEW.room_id::text || ':notifications',
      true  -- private channel
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to your messages table
CREATE TRIGGER messages_notification_trigger
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_message_activity();
```

- **`realtime.broadcast_changes`** sends the full database change with metadata
- **`realtime.send`** allows you to send custom payloads and control exactly what data is broadcast

## Essential best practices

### Use private channels

Always use private channels for production applications to ensure proper security and authorization:

```ts
const channel = supabase.channel('room:123:messages', {
  config: { private: true },
})
```

### Follow naming conventions

**Channel Topics:** Use the pattern `scope:id:entity`

- `room:123:messages` - Messages in room 123
- `game:456:moves` - Game moves for game 456
- `user:789:notifications` - Notifications for user 789

### Clean up subscriptions

Always unsubscribe when you are done with a channel to ensure you free up resources:

**TypeScript**

```ts
// React example
import { useEffect } from 'react'

useEffect(() => {
  const channel = supabase.channel('room:123:messages')

  return () => {
    supabase.removeChannel(channel)
  }
}, [])
```

**Flutter**

```dart
// Flutter example
class _MyWidgetState extends State<MyWidget> {
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _channel = supabase.channel('room:123:messages');
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    super.dispose();
  }
}
```

**Swift**

```swift
// SwiftUI example
struct ContentView: View {
  @State private var channel: RealtimeChannelV2?

  var body: some View {
    // Your UI here
    .onAppear {
      channel = supabase.realtimeV2.channel("room:123:messages")
    }
    .onDisappear {
      Task {
        await channel?.unsubscribe()
      }
    }
  }
}
```

**Python**

```python
# Python example with context manager
class RealtimeManager:
    def __init__(self):
        self.channel = None

    def __enter__(self):
        self.channel = supabase.channel('room:123:messages')
        return self.channel

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.channel:
            self.channel.unsubscribe()

# Usage
with RealtimeManager() as channel:
    # Use channel here
    pass
```

**C#**

```c#
// Remove the channel when you are done with it to free up resources
supabase.Realtime.Remove(channel);
```

## Choose the right feature

### When to use Broadcast

- Real-time messaging and notifications
- Custom events and game state
- Database change notifications (with triggers)
- High-frequency updates (e.g. Cursor tracking)
- Most use cases

### When to use Presence

- User online/offline status
- Active user counters
- Use minimally due to computational overhead

### When to use Postgres Changes

- Quick testing and development
- Low amount of connected users

## Next steps

Now that you understand the basics, dive deeper into each feature:

### Core features

- **[Broadcast](https://supabase.com/docs/guides/realtime/broadcast)** - Learn about sending messages, database triggers, and REST API usage
- **[Presence](https://supabase.com/docs/guides/realtime/presence)** - Implement user state tracking and online indicators
- **[Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)** - Understanding database change listeners (consider migrating to Broadcast)

### Security & configuration

- **[Authorization](https://supabase.com/docs/guides/realtime/authorization)** - Set up RLS policies for private channels
- **[Settings](https://supabase.com/docs/guides/realtime/settings)** - Configure your Realtime instance for optimal performance

### Advanced topics

- **[Architecture](https://supabase.com/docs/guides/realtime/architecture)** - Understand how Realtime works under the hood
- **[Benchmarks](https://supabase.com/docs/guides/realtime/benchmarks)** - Performance characteristics and scaling considerations
- **[Limits](https://supabase.com/docs/guides/realtime/limits)** - Usage limits and best practices

### Integration guides

- **[Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs)** - Build real-time Next.js applications
- **[User Presence](https://supabase.com/docs/guides/realtime/realtime-user-presence)** - Implement user presence features
- **[Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)** - Listen to database changes

### Framework examples

- **[Flutter Integration](https://supabase.com/docs/guides/realtime/realtime-listening-flutter)** - Build real-time Flutter applications

Ready to build something amazing? Start with the [Broadcast guide](https://supabase.com/docs/guides/realtime/broadcast) to create your first real-time feature!
