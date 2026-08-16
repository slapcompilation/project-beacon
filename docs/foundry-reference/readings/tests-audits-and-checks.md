---
verify: strict
---

# Reading — three kinds of thing that were all called "checks"

Not a new page. This is the taxonomy that came out of the operator's question —
*are these the correct way for an ontology architecture to have?* — and the
restructure it forced. The answer to the question as asked was **no**, and the
reason is that one word was covering three different mechanisms.

Read, and nothing below quotes them — this reading is a taxonomy of our own
vocabulary, and the pages fixed the boundary rather than supplying sentences:
- `mirror/superrepo/core-concepts.md` (Ontology linting; the embedded Ontology
  for integration tests)
- `mirror/ontology-sdk/overview.md` (types generated from the Ontology)
- `mirror/object-link-types/create-object-type.md` (the `❗4 errors` badge)

---

## The distinction

| | builds a fixture? | reads | answers |
|---|---|---|---|
| **test** | yes, and rolls it back | its own fixture | *does the code work?* |
| **audit** | **no** | the system you actually have | *is it in a bad state right now?* |
| **reference check** | no | source text | *does this name exist on the other side?* |

The three are not degrees of the same thing. A test proves an algorithm against
a fixture; the failures an audit catches are precisely the ones that **arrive
with real data, after the code that produced them was already proven correct**.
A reference check is neither — it is a type error found at the wrong time.

`check:datasets` had all three in one 443-line file, which is why renaming it
`check:platform` was slop: it made the label fit a container whose contents were
never one thing.

## Where each went

**37 tests → `packages/platform/`.** Vitest, run by `pnpm turbo test` alongside
the 135 ontology tests. Foundry endorses the shape: *"The CLI ships with the
embedded Ontology, so you can write **integration tests** that span the breadth
of your workflow."* Two suites — `datasets.test.ts` (the published five-step view
example, time travel, branching, the commit rules, what `dataset_materialize`
generates) and `security.test.ts` (the tenant boundary, markings, scoped
sessions, list/detail agreement). Roughly 200 of the 443 lines were a hand-rolled
runner — a `check()` helper, pg connection boilerplate, savepoint juggling —
which vitest already supplies and which is now deleted rather than moved.

**2 audits → SQL, then `audit.test.ts`.** `ontology_violations()` existed
already; `rls_violations()` is migration 411. Both are functions rather than
script bodies, and that is the substantive change: **an audit that is a query can
be rendered**. Foundry shows `❗4 errors` on an object type because the platform
knows, not because a script ran overnight. CI now reads the same function the UI
would.

**2 reference checks → unchanged, pending generation.** `check:rpcs` and
`check:surfaces` stay for now. They are not fixed by moving them; they are
deleted by removing the untyped boundary each one guards, and that is the client.

## What the restructure found

**A skipped audit passes.** The suite ran 28 tests and skipped all 28, silently
green: `db-url.mjs` looked for `.env.local` in `process.cwd()`, which used to be
the repo root and is now the package. It walks up now. This is the failure an
audit cannot afford, so it is guarded in three places — the migration refuses to
apply if fewer than 20 RLS-guarded tables are found, `audit.test.ts` asserts the
same, and both would have caught a probe that quietly covered nothing.

**Turbo would have cached the skip.** `test` is a cached task, and turbo hashes
file inputs, not credentials — so a run with no `SUPABASE_DB_URL` (everything
skips, green) could be replayed as a pass on a machine that *has* the credential.
`@beacon/platform#test` is `"cache": false` with `SUPABASE_DB_URL` in `env`.

**The probe could have handed out privilege.** `rls_violations()` switches to
`authenticated` and back. Resetting to a hardcoded `'none'` would return a caller
who had reached `authenticated` *via* `SET ROLE` to their **login** role instead —
an escalation on the way out. It captures `current_setting('role')` on entry and
restores that.

**And the audit has to report, not merely survive.** Migration 411 creates a
table whose policy selects from itself, asserts `rls_violations()` names it, and
drops it. Without that, "zero violations" proves nothing.

## Decisions taken

- `scripts/check-platform.mjs` **deleted**, not renamed.
- New workspace package `@beacon/platform` — what the database guarantees.
- `rls_violations()` beside `ontology_violations()`; audits are queries.
- `db-url.mjs` walks up for `.env.local`; still one definition of "how to
  connect", now usable from a package.

## Open questions

1. **The audits are not on a surface yet.** They are functions and CI reads them;
   nothing in the app does. `object_type_problems()` already backs the per-type
   badge — the org-wide view has no home until there is an admin surface for it.
2. **`check:surfaces` after generation.** Generated object surfaces remove the
   two `@surface-orphan-ok` exemptions, but a handful of pages (login, account,
   the shell) are not ontology resources. Whether the residue justifies keeping a
   walker is a judgment to make when the residue is visible, not now.
3. **Test isolation against a live database.** Every suite rolls back, but they
   run against the real project. A disposable branch database would be better and
   Supabase supports it; not worth building until it bites.
