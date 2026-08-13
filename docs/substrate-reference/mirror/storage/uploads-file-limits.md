<!-- source: https://supabase.com/docs/guides/storage/uploads/file-limits · mirrored 2026-08-13 from Supabase docs -->

# Limits

Learn how to increase Supabase file limits.

## Global file size

You can set the maximum file size across all your buckets by setting the *Global file size limit* value in your [Storage Settings](https://supabase.com/dashboard/project/_/storage/settings). For Free projects, the limit can't exceed 50 MB. On the Pro Plan and up, you can set this value to up to 500 GB. If you need more than 500 GB, [contact us](https://supabase.com/dashboard/support/new).

| Plan       | Max File Size Limit |
| ---------- | ------------------- |
| Free       | 50 MB               |
| Pro        | 500 GB              |
| Team       | 500 GB              |
| Enterprise | Custom              |

Note: This option is a global limit, which applies to all your buckets.

Additionally, you can specify the maximum file size on a per [bucket level](https://supabase.com/docs/guides/storage/buckets/creating-buckets#restricting-uploads) but it can't be higher than this global limit. As a good practice, the global limit should be set to the highest possible file size that your application accepts, with smaller per-bucket limits set as needed.

## Per bucket restrictions

You can have different restrictions on a per bucket level such as restricting the file types (e.g. `pdf`, `images`, `videos`) or the maximum file size, which should be lower than the global limit. To apply these limits on a bucket level see [Creating Buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets#restricting-uploads).

## File name restrictions

File names can only include the following characters:

- **Alphanumeric**: `A-Z`, `a-z`, `0-9`
- **Punctuation**: `_` (underscore), `-` (hyphen), `.` (dot), `'` (apostrophe), `,` (comma)
- **Special characters**: `!`, `*`, `&`, `$`, `@`, `=`, `;`, `:`, `+`, `?`, `(`, `)`
- **Whitespace**
