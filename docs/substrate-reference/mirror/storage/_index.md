<!-- source: https://supabase.com/docs/guides/storage · mirrored 2026-08-13 from Supabase docs -->

# Storage

Use Supabase to store and serve files.

Supabase Storage is a robust, scalable solution for managing files of any size with fine-grained access controls and optimized delivery. Whether you're storing user-generated content, analytics data, or vector embeddings, Supabase Storage provides specialized bucket types to meet your specific needs.

## Key features

- **Multi Protocol** - S3 compatible Storage, RESTful API, TUS resumable uploads
- **Global CDN** - Serve your assets with lightning-fast performance from over 285 cities worldwide
- **Image Optimization** - Resize, compress, and transform media files on the fly with built-in image processing
- **Fine-grained Access Control** - Manage file permissions with row-level security and custom policies
- **Multiple Bucket Types** - Specialized storage solutions for different use cases

## Get started

Choose the bucket type that fits your use case:

- **[Files buckets](https://supabase.com/docs/guides/storage/quickstart):** Store and serve images, videos, documents, and general-purpose files with direct URL access and row-level security.
- **[Analytics buckets](https://supabase.com/docs/guides/storage/analytics/introduction):** Store data in Apache Iceberg tables for data lakes, logs, and Supabase Pipelines. Query from Postgres via foreign tables with partitioning.
- **[Vector buckets](https://supabase.com/docs/guides/storage/vector/introduction):** Store embeddings and run similarity search for semantic matching, AI, and RAG. Use HNSW indexing, distance metrics, and metadata filtering.

## Examples

Working sample projects for common Storage integration patterns:

- **[Storage templates and examples](https://github.com/supabase/supabase/tree/master/examples/storage):** Sample projects for resumable uploads, signed upload URLs, and serving map tiles from private buckets.
- **[Resumable Uploads with Uppy](https://github.com/supabase/supabase/tree/master/examples/storage/resumable-upload-uppy):** Upload large files with pause-and-resume support using Uppy and the TUS protocol.

## Resources

Source code and REST API reference for the Storage service:

- **[Supabase Storage API](https://github.com/supabase/storage-api):** Amazon S3-compatible object storage service that stores metadata in Postgres.
- **[OpenAPI Spec](https://supabase.github.io/storage/):** Interactive reference for Storage REST endpoints, request parameters, and response schemas.
