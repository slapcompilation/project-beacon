<!-- source: https://supabase.com/docs/guides/realtime/error_codes · mirrored 2026-08-13 from Supabase docs -->

# Operational Error Codes

List of operational codes to help understand your deployment and usage.

| Error code | Description | Action |
| --- | --- | --- |
| `ChannelRateLimitReached` | The number of channels you can create has reached its limit. |  |
| `ChannelShutdown` | The channel was shut down and an error system message was pushed to the client. |  |
| `CheckOidsError` | Error when fetching the publication tables (OIDs) during the periodic check; the existing OIDs, replication slot and subscribers are left untouched. |  |
| `ClientJoinRateLimitReached` | The rate of joins per second from your clients has reached the channel limits. |  |
| `ClientPresenceRateLimitReached` | A single client sent Presence updates too frequently and had its channel closed. This usually means Presence is being used for high-frequency updates it is not designed for. Learn more: [Troubleshooting guide for the ClientPresenceRateLimitReached error](/docs/guides/troubleshooting/realtime-client-presence-rate-limit-reached) | Reserve Presence for slow-changing state and use Broadcast for high-frequency updates such as live cursors, or throttle your track() calls. |
| `ConnectionRateLimitReached` | The number of connected clients has reached its limit. |  |
| `DatabaseConnectionRateLimitReached` | The rate of attempts to connect to the database has reached the limit. |  |
| `DatabaseLackOfConnections` | Realtime was not able to connect to the tenant's database due to not having enough available connections. Learn more: [Connection management guide](/docs/guides/database/connection-management) | Verify your database connection limits. |
| `DropReplicationSlotFailed` | Error when dropping the replication slot after the publication became empty; the poller stops so the temporary slot is released with the connection. |  |
| `ErrorConnectingToWebsocket` | Error when trying to connect to the WebSocket server. | Verify user information on connect. |
| `ErrorExecutingTransaction` | Error executing a database transaction in tenant database. |  |
| `ErrorOnRpcCall` | Error when calling another realtime node. |  |
| `ErrorRunningQuery` | Error when running a query against the tenant database. |  |
| `ErrorStartingPostgresCDC` | Error when starting the Postgres CDC extension which is used for Postgres Changes. |  |
| `HttpClientError` | Phoenix converted an exception into a 4xx HTTP response (for example a request to an unknown route). The log includes the underlying error and status. |  |
| `HttpServerError` | Phoenix converted an unhandled exception into a 5xx HTTP response. The log includes the underlying error and status to explain a server error that request metrics alone would not surface. |  |
| `IncreaseConnectionPool` | The number of connections you have set for Realtime are not enough to handle your current use case. |  |
| `IncreaseSubscriptionConnectionPool` | The subscription connection pool hit too many database timeouts and should be increased. |  |
| `InitializingProjectConnection` | Connection against Tenant database is still starting. |  |
| `InvalidJoinPayload` | The payload provided to Realtime on connect is invalid. |  |
| `InvalidJWTToken` | The JWT provided on connect is expired or is missing required claims (`role` and `exp`). |  |
| `InvalidPresencePayload` | Payload from track event sent to Presence isn't a map. |  |
| `JanitorFailedToDeleteOldMessages` | Scheduled task for realtime.message cleanup was unable to run. |  |
| `JoinsRateLimitReached` | The rate of joins per second from your clients has reached the limit and the connection was refused. |  |
| `JwtSignatureError` | JWT signature was not able to be validated. |  |
| `JwtSignerError` | Failed to generate a JWT signer — check your JWT secret or JWKS configuration. |  |
| `MalformedJWT` | Token received does not comply with the JWT format. |  |
| `MalformedWebSocketMessage` | Received a WebSocket message that is empty, invalid JSON, or missing required fields (`ref`, `topic`, or `event`). The connection is kept alive but the message is dropped. |  |
| `MessagePerSecondRateLimitReached` | The rate of messages per second from your clients has reached the channel limits. |  |
| `MigrationCountMismatch` | The cached `migrations_ran` count did not match the tenant database and is being reconciled. |  |
| `MigrationCountMismatchReconcileFailed` | Failed to reconcile the `migrations_ran` count mismatch between the cache and the tenant database. |  |
| `MigrationsFailedToRun` | Error when running the migrations against the Tenant database that are required by Realtime. |  |
| `MissingAPIKey` | No API key was provided in the `x-api-key` header or `apikey` query parameter. |  |
| `MissingPartition` | Realtime was unable to find the expected messages partition. |  |
| `PartitionCreationFailed` | Error when creating partitions for realtime.messages. |  |
| `PoolingReplicationError` | Error when pooling the replication slot. |  |
| `PoolingReplicationPreparationError` | Error when preparing the replication slot. |  |
| `PresenceRateLimitReached` | Limit of presence events reached globally. |  |
| `PrivateOnly` | The connection was rejected because this project only allows private channels. |  |
| `QueryCanceled` | A database query was canceled, usually due to a statement timeout. |  |
| `RealtimeDisabledForConfiguration` | The configuration provided to Realtime on connect will not be able to provide you any Postgres Changes. | Verify your configuration on channel startup as you might not have your tables properly registered. |
| `RealtimeDisabledForTenant` | Realtime has been disabled for the tenant. Learn more: [Troubleshooting guide for suspended projects](/docs/guides/troubleshooting/realtime-project-suspended-for-exceeding-quotas) | Your project may have been suspended for exceeding usage quotas. Contact support with your project reference ID and a description of your Realtime use case. |
| `RealtimeNodeDisconnected` | Realtime is a distributed application and this means that one the system is unable to communicate with one of the distributed nodes. |  |
| `RealtimeRestarting` | Realtime is currently restarting. |  |
| `ReconnectSubscribeToPostgres` | Postgres changes still waiting to be subscribed. |  |
| `ReplicationConnectionDown` | The replication connection was terminated and a recovery window has been opened. |  |
| `ReplicationConnectionRecoveryFailed` | The database check failed while trying to recover the replication connection. |  |
| `ReplicationConnectionTimeout` | Replication connection timed out during initialization. |  |
| `ReplicationMaxWalSendersReached` | Maximum number of WAL senders reached in tenant database. Learn more: [Configuring max WAL senders](/docs/guides/database/custom-postgres-config#cli-configurable-settings) |  |
| `ReplicationPollerConnectionFailed` | Error when the replication poller process fails to connect to the database on startup. |  |
| `ReplicationPollerMaxRetriesReached` | The replication poller gave up after the maximum number of consecutive retries and stopped the tenant's Postgres Changes workers. |  |
| `ReplicationRecoveryWindowExceeded` | The replication connection recovery window was exceeded and the connection was terminated. |  |
| `ReplicationSlotBeingUsed` | The replication slot is being used by another transaction. |  |
| `ReplicationSlotLagCheckSkipped` | The periodic replication slot lag check could not be completed, typically because the tenant database connection was unavailable. The check is skipped and retried on the next watchdog interval. |  |
| `ReplicationSlotLagTooHigh` | The replication slot WAL lag has exceeded 50% of `max_slot_wal_keep_size`. The replication connection is shut down and will be restarted to prevent the slot from being invalidated by PostgreSQL. |  |
| `RlsPolicyError` | Error on RLS policy used for authorization. |  |
| `RpcError` | Error returned when calling another realtime node over RPC. |  |
| `StartReplicationFailed` | Error when starting the replication and listening of errors for database broadcasting. |  |
| `SubscriptionCleanupFailed` | Error when trying to clean up all subscriptions on subscription manager initialization or OID change. |  |
| `SubscriptionDeletionFailed` | Error when trying to delete a subscription for postgres changes. |  |
| `SubscriptionManagerConnectionFailed` | Error when the subscription manager process fails to connect to the database on startup. |  |
| `SynInitializationError` | Our framework to syncronize processes has failed to properly startup a connection to the database. |  |
| `TenantNotFound` | The tenant you are trying to connect to does not exist. | Verify the tenant name you are trying to connect to exists in the realtime.tenants table. |
| `TimeoutOnRpcCall` | RPC request within the Realtime server has timed out. |  |
| `TopicNameRequired` | You are trying to use Realtime without a topic name set. |  |
| `UnableCheckoutConnection` | Error when trying to checkout a connection from the tenant pool. |  |
| `UnableToBroadcastChanges` | Error when trying to broadcast database changes (realtime.messages) to subscribers. |  |
| `UnableToCheckProcessesOnRemoteNode` | Error when trying to check the processes on a remote node. |  |
| `UnableToConnectToProject` | Unable to connect to Project database. |  |
| `UnableToConnectToTenantDatabase` | Realtime was not able to connect to the tenant's database. |  |
| `UnableToDeleteTenant` | Error when trying to delete a tenant. |  |
| `UnableToEncodeJson` | An error were we are not handling correctly the response to be sent to the end user. |  |
| `UnableToHandleBroadcast` | Error when handling a broadcast message. |  |
| `UnableToHandlePresence` | Error when handling a presence message on a channel. |  |
| `UnableToReplayMessages` | An error while replaying messages. |  |
| `UnableToSetPolicies` | Error when setting up Authorization Policies. |  |
| `UnableToSubscribeToPostgres` | Error when trying to subscribe to Postgres changes. |  |
| `UnableToTrackPresence` | Error when handling track presence for this socket. |  |
| `Unauthorized` | Unauthorized access to Realtime channel. |  |
| `UnexpectedMessageReceived` | An unexpected message was received by the replication connection process. |  |
| `UnhandledProcessMessage` | Unhandled message received by a Realtime process. |  |
| `UnknownError` | An unhandled error occurred. |  |
| `UnknownErrorOnChannel` | An error we are not handling correctly was triggered on a channel. |  |
| `UnknownErrorOnController` | An error we are not handling correctly was triggered on a controller. |  |
| `UnknownErrorOnWebSocketMessage` | An unexpected error occurred while processing an incoming WebSocket message. The connection is kept alive but the message is dropped. |  |
| `UnknownPresenceEvent` | Presence event type not recognized by service. |  |
| `UnprocessableEntity` | Received a HTTP request with a body that was not able to be processed by the endpoint. |  |
| `WarnSendingBroadcastMessage` | Warning when `realtime.send` or `realtime.send_binary` cannot insert the message. Learn more: [Realtime troubleshooting guide](/docs/guides/realtime/troubleshooting) |  |
