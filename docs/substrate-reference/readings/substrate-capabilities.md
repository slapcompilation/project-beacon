# What Foundry does, and what we have to do it with

One row per Foundry mechanism we have built or plan to. **Source** says where
the claim comes from: `doc` (a mirrored page), `probe` (measured against our
own project), or `doc+probe` (both). Anything load-bearing must reach
`doc+probe` before it is believed.

## Execution

| Foundry | Substrate | Source | Note |
|---|---|---|---|
| "executed on the server side in an isolated environment" | QuickJS compiled to WebAssembly, one isolate per execution | doc+probe | `functions/wasm.md`: "Edge Functions supports running WebAssembly (Wasm) modules". Probed: a module compiled, instantiated and ran; `npm:quickjs-emscripten` imports |
| serverless execution mode (recommended) | an isolate per request inside one deployed edge function | doc+probe | matches Foundry's "different versions … executed on demand"; no per-function deployment needed |
| deployed mode (long-lived container) | not used | doc | possible via the Management API, but Foundry recommends against it and it caps us at one version live |
| nested isolate / `Worker` | **unavailable** | doc+probe | `functions/limits.md`: "Web Worker API (or Node `vm` API) are not available." The probe agreed. This is the sentence that would have saved a design cycle |
| in-database JS (plv8) | **unavailable** | probe | absent from `pg_available_extensions` |
| 60s default run time | 60s wall clock, but **2s CPU** is the platform ceiling | doc | `functions/limits.md`: "Maximum CPU Time: 2s … does not include async I/O". Compute-heavy guest code dies there whatever we set. I/O-bound functions are unaffected |
| 1024 MiB serverless memory | **256MB for the whole worker**; the isolate gets 128MB | doc | corrected in `function-run` after this mirror landed — it had been set to 1 GiB from memory, four times what the platform allows |
| live preview (280s) | not built | doc | the request idle timeout is 150s, so a preview would need the background-task shape |

## Orchestration

| Foundry | Substrate | Source | Note |
|---|---|---|---|
| schedules running builds on triggers | `pg_cron` heartbeat every minute + our trigger grammar | doc+probe | `cron/_index.md`: "a Postgres Module that simplifies scheduling recurring Jobs with cron syntax"; live since migration 495 |
| a build's jobs, run to completion | synchronous inside one transaction | probe | fine while jobs are SQL; a job that outgrows 2s CPU or the idle timeout needs the queue below |
| long-running / asynchronous work | `EdgeRuntime.waitUntil(promise)`, and Supabase Queues (pgmq) | doc | `functions/background-tasks.md`; `queues/_index.md`: "durable Message Queue system with guaranteed delivery". **Not built** — the honest home for builds that outgrow the request |
| Automate's 4-hour function effects | not reachable in one request | doc | 400s wall clock on paid plans; would have to be queue + worker |

## Data and access

| Foundry | Substrate | Source | Note |
|---|---|---|---|
| "the permissions of the end user running the function determine which objects are loaded" | the host performs every read with the caller's JWT; RLS decides | doc+probe | probed: an undeclared type was refused to a caller who *could* read it |
| object storage (OSv2) | tables in the `objects` schema, no grants | probe | the index tables built by 442 |
| datasource → objects | `datasets` schema + `dataset_materialize` | probe | 393/401 |
| media sets | Supabase Storage | doc | `storage/` mirrored; **not built** |
| search | OpenSearch (Aiven) + Postgres fallback | probe | live since 478 |
| streaming functions | Realtime | doc | `realtime/` mirrored; **not built** |

## Where we cannot copy Foundry one-for-one

1. **CPU-bound logic.** Foundry gives a function 60 seconds of run time; this
   platform gives 2 seconds of CPU. Anything heavier must become either a SQL
   transform (which runs in the database, where the time belongs to Postgres)
   or queued work. Recorded, not worked around.
2. **A code repository.** Foundry authors functions in a repository with
   branches, checks and a tag-release. We have an artifact table with
   immutable versions and the documented breaking-change checks; branches and
   pull requests are a product we do not have.
3. **Two languages.** Foundry supports TypeScript and Python. The isolate runs
   JavaScript; Python would need a second WASM engine, and CLAUDE.md already
   reserves Python for modelling behind an adapter seam.
4. **Deployed-mode capabilities** — GPU allocation, local caching across
   requests, third-party clients for external calls — follow from a long-lived
   container we do not run.

## Open

- Whether the 2s CPU ceiling is per request or per worker across a burst
  (`limits.md` says "per request"); worth a probe before anything CPU-shaped
  is promised.
- Queue-backed builds: the shape is documented and unbuilt, and it is the
  first thing the pipeline layer will want when a transform outgrows a
  request.
