# Portfolio-scale test (P0.3)

Status: **run 2026-06-30** against the live project (`nohsofkkuypwlvdsfbnw`).

P0.3 of the AIP-parity roadmap: prove the unattended intelligence cycle scales
across a portfolio, RLS still isolates at scale, and the dedup path isn't N+1 —
with recorded numbers, not assertions.

## The rig (repeatable + reversible)

Migration 184 ships two service-role-only functions:

```sql
select seed_scale_test(p_hotels => 12, p_variants => 12, p_days => 60);  -- build a "Scale Test Org"
select teardown_scale_test();                                            -- remove it (FK-aware, idempotent)
```

`seed_scale_test` builds an org of N hotels × M variants × D days of consumption
logs (with periodic restocks; 1/3 of products perishable so `waste_triage` fires).
`teardown_scale_test` clears every table that FK-references the seeded variants
(dynamically, so a new variant-FK can't break it), then the variants, products,
suppliers, hotels, and org.

## Method

Seed 12 synthetic hotels (→ 14 total with Valinor + Rivendell), then invoke the
**real cron path** — the `intelligence-cycle` edge function, via the same
`net.http_post` the pg_cron job uses — and read `execution_time_ms` from the
edge-function logs. Measured twice: a light load (seeded stock left healthy, so
only waste scans fire) and a worst-case heavy load (half the variants forced
at-risk, half forced overstocked, so restock + overstock + waste all fire).

Seed produced **12 hotels, 144 variants, 9,648 stock logs**.

## Results

| Load | Hotels | Sweep wall-clock | Proposals queued | Per-hotel |
|---|---|---|---|---|
| Light (waste-only scans) | 14 | **8.45 s** | ~0 (dedup) | ~0.60 s |
| Heavy (at-risk + overstock + waste) | 14 | **40.5 s** | **98** | ~2.9 s |

Both returned HTTP 200 with a complete per-hotel breakdown; **0 auto-executed**
in both (the fail-closed `decideAutoExecution` gate has no production release to
permit auto-exec — correct). The edge-function single-invocation timeout is 150 s.

### Extrapolation to 50 hotels

Linear in hotels (the sweep loops hotels independently):

| Hotels | Light (~0.6 s/hotel) | Heavy (~2.9 s/hotel) |
|---|---|---|
| 12 | ~7 s | ~35 s |
| 50 | ~30 s | **~145 s** |

**Finding:** the 12-property target is comfortable under any load. At **50 hotels
under worst-case load (~145 s) a single sweep approaches the 150 s edge-function
timeout.** A one-invocation daily sweep does not safely scale past ~50 hotels at
heavy load. **Mitigation (tracked for P6):** shard the sweep — per-org or chunked
per-hotel invocations, or move the heavy per-variant agent runs to a queue —
rather than one invocation sweeping every hotel. Light/normal load has ample
headroom either way.

## RLS isolation at scale

With 14 hotels populated, a hotel-scoped `hotel_manager` at "Scale Hotel 1" read:

- its own `stock_logs`: **804 rows**
- "Scale Hotel 2" `stock_logs`: **0 rows** (that hotel truly has 804)

Scope isolation holds unchanged at scale — it's the same RLS, just more rows.
(Codified generally by `rls_contracts.sql`; this confirms it under the scaled data.)

## No N+1 in the dedup path

`intelligence-cycle/index.ts` fetches `hotels`, `agent_releases`, and `org_policy`
**once** per sweep; the dedup `openProposalKeysFor(supabase, hotel.id)` runs
**once per hotel** (not once per variant). The only per-variant cost is the
inherent agent run on each scanned variant — unavoidable, and the linear timing
above confirms there's no hidden quadratic blow-up.

## Reproduce

```sql
select seed_scale_test(12, 12, 60);
-- trigger the cron edge fn (net.http_post to /functions/v1/intelligence-cycle
-- with the x-beacon-secret vault secret), then read execution_time_ms from
-- the edge-function logs; check RLS with a SET LOCAL ROLE authenticated probe.
select teardown_scale_test();
```
