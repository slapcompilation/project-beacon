# Running the agents

How to use `.claude/agents/`, and specifically what can and cannot run while you
are asleep.

## The thing to understand first

**An agent definition is inert.** `.claude/agents/foundry-gap.md` is a file. It
does nothing until something invokes it. There is no daemon.

Three different mechanisms can invoke work, and they are not interchangeable:

| mechanism | runs unattended | can it write | what it is |
|---|---|---|---|
| **subagent** (`Agent` tool) | no — only inside a live session | depends on the agent | what I spawn when you ask |
| **GitHub Actions** | yes, on a cron or a push | no — deterministic scripts only | `.github/workflows/*.yml` |
| **scheduled cloud agent** (`/schedule`) | yes, on a cron | yes, and this is the danger | a real Claude session on a timer |

## The rule that governs all of it

From `CLAUDE.md`:

> **Scheduling: observe on a timer, never build on one.**
>
> Nothing that writes a migration runs unattended, and the reason is specific
> rather than caution — **applied migrations are immutable and run once**, so an
> unreviewed one can only be corrected forward, never edited.

So the overnight job is **finding things**, never **fixing** them. You wake up to
a report, and the fix happens in a session with you present.

## Which agent is safe overnight

| agent | writes | overnight | why |
|---|---|---|---|
| **foundry-gap** | nothing | ✅ **yes — the best one for this** | diffs the mirror against the schema, both directions. Pure observation. |
| **foundry-adversary** | nothing | ✅ **yes** | tries to falsify a reading or a migration. Pure observation. |
| **foundry-reader** | `readings/` only | ⚠️ **produces, does not decide** | a reading is safe to *write* overnight; the recitation gate means nothing is built from it until you have read its Decisions block. |
| **surface-owner** | `apps/web` | ❌ **no** | it writes code. Runs with you present. |

Nothing writes a migration. That is deliberate: **one thing touches the database
and it is not an agent** — migrations are ordered and stateful, and parallel
builders would collide on the ledger.

## Setting up the overnight run

```
/schedule
```

Then describe the job. The two worth having:

**Nightly gap check** — the one that would have caught the most this month.

> Every night at 02:00, run the foundry-gap agent over the ontology schema
> against docs/foundry-reference/mirror/. Report both directions: what Foundry
> documents that we have not built, and what we have built that no mirrored page
> describes. Quote the page for every claim. Write nothing — report only.

**Weekly adversary pass** on whatever shipped that week.

> Every Sunday at 03:00, run the foundry-adversary agent against the migrations
> added in the last 7 days (`git log --since='7 days ago' --name-only --
> supabase/migrations/`). For each, try to falsify the citations in its header
> against the mirror. Report only.

Manage them with `/schedule` — it lists, edits and deletes.

### What already runs without any of this

Deterministic, no model involved, and they are the cheapest guards you have:

| workflow | when | asks |
|---|---|---|
| `doc-drift.yml` | Mondays 06:17 | has a page we quoted changed upstream? |
| `db-contracts.yml` | on DB changes + daily | do the RLS contracts still hold? |
| `web-smoke.yml` | on push | does the app still load and sign in? |
| `pnpm turbo lint type-check test` | on push | includes the 76 platform tests |

**`doc-drift.yml` only fires on the default branch.** It is on
`feat/ontology-status` and will not run on its schedule until that merges to
`main`. Until then, trigger it by hand from the Actions tab.

## Invoking one yourself, mid-session

You do not need a schedule to use these. Just ask:

- *"Run foundry-gap on the working state before I build on it"*
- *"Have the adversary check migration 435's citations"*
- *"Get foundry-reader to read object-edits/schema-migrations"*

Give the reader a **section or a page list**, not a question — it reads
exhaustively and ends with **Decisions** and **Questions** blocks. The Questions
block is the point; it is where an invented mechanism has to declare itself.

## What to do with the morning report

1. **Read the Questions first.** A question is cheap; a shape invented to avoid
   asking one is expensive.
2. **Treat every claim as unverified until the quote checks out.** `pnpm
   check:readings` greps every citation in a strict reading back against the
   mirror. Agents get citations wrong — the ontology-manager reading asserted
   that the Migrations tab appears in no page, and it appears in
   `object-edits/schema-migrations`.
3. **Nothing in a report is a mandate.** A gap the agent found may be a gap we
   chose. The build map's irreversibility gate says which ones are worth acting
   on and which get corrected forward.

## The honest state of this, as of 2026-08-09

**One of the four agents has ever run, once.** `foundry-reader` produced
`readings/ontology-manager-save-session.md` and earned its keep — it corrected a
false premise in its own brief rather than working around it, and left twelve
questions instead of guessing.

`foundry-gap`, `foundry-adversary` and `surface-owner` have never run at all.
That is a real gap in how this project is being worked, because the errors that
actually happened were exactly the ones they exist to catch:

- migration 430 over-granted organization claims (an audit found it, one commit late)
- migration 431 had a `jsonb_set` bug (its own successor's assertion found it)
- `save_working_state`'s generic arm was **dead from the day it was written** and
  nothing noticed for four migrations
- `app_metadata.org_id` was asserted as the right tenant binding without a
  citation, and the operator had to ask

Adversary-shaped, gap-shaped, gap-shaped, adversary-shaped.

**The one change worth making: run `foundry-gap` BEFORE starting a phase, not
after.** It is cheap, it writes nothing, and its whole job is the question you
should be asking at the start anyway.
