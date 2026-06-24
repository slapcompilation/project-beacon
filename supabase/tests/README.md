# Data-layer contract tests

Self-apply guards for the data layer — we sell scoped access + immutable audit, so
our own RPCs are tested against the same bar. Both files are pure SQL, raise on
violation (pass/fail), and resolve or skip their own fixtures, so they're safe to
run against any environment.

| File | Guards | Needs |
|---|---|---|
| `security_invariants.sql` | No public `SECURITY DEFINER` function is anon-executable or missing a pinned `search_path` (the leak class behind migrations 175–177). | any connection |
| `rls_contracts.sql` | Behavioral scope: a tenant only reads its own hotel; an explicit `p_hotel_id` can't beat RLS; anon can't call scoped reads; non-admins can't `promote_agent`. | a role that can `SET ROLE anon/authenticated` (service role / local superuser) |

## Run

```bash
supabase db execute -f supabase/tests/security_invariants.sql --linked
supabase db execute -f supabase/tests/rls_contracts.sql --linked
```

Or paste either file into the SQL editor / run via the Supabase MCP `execute_sql`.
Run them after any migration that adds or changes a function, alongside
`get_advisors` — same discipline, codified.

A clean run prints a `NOTICE … OK`; any violation aborts with the failing
contract id (e.g. `C2a CROSS-HOTEL LEAK …`).

## CI

Not yet wired into GitHub Actions — that needs a job with DB access (a Supabase
local stack via `supabase db reset`, or the linked project's connection string as
a secret). Until then these run on demand / post-migration. Wiring this is the
next self-apply step.
