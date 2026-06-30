# Data-layer contract tests

Self-apply guards for the data layer — we sell scoped access + immutable audit, so
our own RPCs are tested against the same bar. Both files are pure SQL, raise on
violation (pass/fail), and resolve or skip their own fixtures, so they're safe to
run against any environment.

| File | Guards | Needs |
|---|---|---|
| `security_invariants.sql` | Catalog invariants over every public `SECURITY DEFINER` function: (1) not anon-executable, (2) pins `search_path`, (3) **no tenant-key arg (`hotel_id`/`org_id`) without a scope gate** — the cross-tenant leak class behind migrations 180–181. | any connection |
| `rls_contracts.sql` | Behavioral scope (C1–C9): a tenant only reads its own hotel; an explicit `p_hotel_id` can't beat RLS; anon can't call scoped reads; non-admins can't `promote_agent`; prod promotion needs staging; `get_overstock_candidates` + `ingest_pos_sale` are service-role-only; `get_hotel_graph` reads/`create_relationship_edge` writes are scope-gated. | a role that can `SET ROLE anon/authenticated` (service role / local superuser) |

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

Wired via `.github/workflows/db-contracts.yml`, which runs both guards with `psql`
whenever `supabase/migrations/**` or `supabase/tests/**` changes. Like the
edge-deploy workflow it's **dormant until the `SUPABASE_DB_URL` repo secret is
set** — the step no-ops with a warning when it's absent, so it never blocks a
merge. Set the secret to the project's `postgres` connection string (a role that
can `SET ROLE anon/authenticated`, e.g. the Session-pooler URI) to activate it.

A RAISE EXCEPTION in either guard aborts under `psql -v ON_ERROR_STOP=1`, failing
the job. Until the secret is set, keep running them on demand / post-migration.

The workflow also runs a **`get_advisors` gate** that fails on any ERROR-level
security lint (WARN/INFO are advisory — the live project's findings are all WARN).
It's independently dormant until `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`
are set. The SQL guards remain the precise instrument for the tenant-param leak
class; the advisor catches the broader catalog (RLS-disabled tables, definer views).
