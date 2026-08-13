<!-- source: https://supabase.com/docs/guides/queues · mirrored 2026-08-13 from Supabase docs -->

# Supabase Queues

Durable Message Queues with Guaranteed Delivery in Postgres

Supabase Queues is a Postgres-native durable Message Queue system with guaranteed delivery built on the [pgmq database extension](https://github.com/tembo-io/pgmq). It offers developers a seamless way to persist and process Messages in the background while improving the resiliency and scalability of their applications and services.

Queues couples the reliability of Postgres with the simplicity Supabase's platform and developer experience, enabling developers to manage Background Tasks with zero configuration.

## Features

- **Postgres Native**

  Built on top of the `pgmq` database extension, create and manage Queues with any Postgres tooling.
- **Guaranteed Message Delivery**

  Messages added to Queues are guaranteed to be delivered to your consumers.
- **Exactly Once Message Delivery** A Message is delivered exactly once to a consumer within a customizable visibility window.
- **Message Durability and Archival**

  Messages are stored in Postgres and you can choose to archive them for analytical or auditing
  purposes.
- **Granular Authorization**

  Control client-side consumer access to Queues with API permissions and Row Level Security (RLS)
  policies.
- **Queue Management and Monitoring**

  Create, manage, and monitor Queues and Messages in the Supabase Dashboard.

## Resources

- [Quickstart](https://supabase.com/docs/guides/queues/quickstart)
- [API Reference](https://supabase.com/docs/guides/queues/api)
- [`pgmq` GitHub Repository](https://github.com/tembo-io/pgmq)
