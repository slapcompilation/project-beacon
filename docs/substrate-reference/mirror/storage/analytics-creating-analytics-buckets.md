<!-- source: https://supabase.com/docs/guides/storage/analytics/creating-analytics-buckets · mirrored 2026-08-13 from Supabase docs -->

# Creating Analytics Buckets

Set up your first analytics bucket using the SDK or dashboard.

Caution: This feature is in **Private Alpha**. API stability and backward compatibility are not guaranteed at this stage. Request access through this [form](https://forms.supabase.com/analytics-buckets).

Analytics buckets use [Apache Iceberg](https://iceberg.apache.org/), an open-table format for efficient management of large analytical datasets. You can interact with analytics buckets using tools such as [PyIceberg](https://py.iceberg.apache.org/), [Apache Spark](https://spark.apache.org/), or any client supporting the [Iceberg REST Catalog API](https://editor-next.swagger.io/?url=https://raw.githubusercontent.com/apache/iceberg/main/open-api/rest-catalog-open-api.yaml).

Note: Analytics Buckets are still available, but replication into Analytics Buckets via Supabase Pipelines is no longer supported. If you want to use Analytics Buckets, bring your own ingestion pipeline.

## Creating an Analytics bucket

You can create an analytics bucket using either the Supabase SDK or the Supabase Dashboard.

### Using the Supabase SDK

**JavaScript**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://your-project-id.supabase.co', 'your-service-key')

const { data, error } = await supabase.storage.analytics.createBucket('analytics-data')

if (error) {
  console.error('Failed to create analytics bucket:', error)
} else {
  console.log('Analytics bucket created:', data)
}
```

**Python**

```python
from supabase import create_client

supabase = create_client('https://your-project-id.supabase.co', 'your-service-key')

response = supabase.storage.analytics().create('analytics-data')

print('Analytics bucket created:', response)
```

### Using the Supabase Dashboard

1. Navigate to the **Storage** section in the Supabase Dashboard.
2. Click **Create Bucket**.
3. Enter a name for your bucket (e.g., `my-analytics-bucket`).
4. Select **Analytics Bucket** as the bucket type.
5. Click **Create**.

![Create Analytics Bucket in Dashboard](https://supabase.com/docs/img/storage/iceberg-bucket.png)

## Next steps

Once you've created your analytics bucket, you can:

- [Connect with Iceberg clients](https://supabase.com/docs/guides/storage/analytics/connecting-to-analytics-bucket) like PyIceberg or Apache Spark
- [Query data with Postgres](https://supabase.com/docs/guides/storage/analytics/query-with-postgres) using the Iceberg Foreign Data Wrapper
