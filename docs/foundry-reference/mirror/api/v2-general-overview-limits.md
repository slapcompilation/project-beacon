<!-- source: https://palantir.com/docs/foundry/api/v2/general/overview/limits/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Limits

Foundry APIs enforce both rate limits and concurrency limits to ensure fair resource allocation for all users:

- **Rate limits:** Restrict the number of your requests that Foundry APIs will process per minute.
- **Concurrency limits:** Restrict the number of your requests that Foundry APIs will process concurrently, regardless of rate limits.

|           | Rate limits                | Concurrency limits        |
| --------- | -------------------------- | ------------------------- |
| All users | 10,000 requests per minute | 800 simultaneous requests |

Requests that exceed these limits will be throttled and receive `429` or `503` error responses. Implement retries using exponential backoff in your applications to handle these errors should they occur.

**Note**: The limits specified above are global, per-user limits applied across all Foundry API endpoints. Individual endpoints may enforce additional, stricter limits that can also result in `429` or `503` error responses.

#### Understanding Limits

The effective limits experienced by users may vary from the values given above due to several factors:

- Concurrency limits measure only the active processing time on Foundry API servers, not the total duration of a request. Most of a request’s time is spent in network transit or waiting, not in server processing. For example, you might have 3,000 requests in transit over a slow network, but only 750 actively being processed on the server, remaining within the 800-request concurrency limit.
- Some requests may be throttled by internal services, independent of the API limits described above. For example, requests may be limited due to specific Ontology, function execution, or AIP agent limits designed to prevent abuse of computationally expensive operations. Please check endpoint specific documentation for additional throttling information beyond the limits specified above. If you experience throttling that is disruptive to the functioning of your application, contact Palantir Support.

We recommend performance testing when working with Palantir SDKs, especially for cases where usage is expected to be high-scale or "spiky". If you need help ensuring that your application performs at scale, contact Palantir Support.
