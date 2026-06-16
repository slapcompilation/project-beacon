# `_shared/`

Shared modules for the edge functions.

## `reality-graph.bundle.mjs` — generated, not committed

The edge runtime (Deno) can't import the `@beacon/reality-graph` workspace
package directly, so it's bundled to a single `.mjs`. That bundle is **build
output**: git-ignored and rebuilt from source, never hand-edited or committed —
so it can't drift from `packages/reality-graph`.

Regenerate it from the repo root:

```bash
pnpm build:edge-bundle
```

You need it present before `supabase functions serve` or a manual
`supabase functions deploy`. CI (`.github/workflows/deploy-edge-functions.yml`)
runs the same script before every deploy, so production is always built from
current source.
