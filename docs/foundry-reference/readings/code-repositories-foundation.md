---
verify: strict
---

# Code Repositories, the foundation: repositories, branches, commits, pull requests, checks

The third of the eleven Home applications, and the one with the most to
connect to: a Transforms repository authors the code that builds datasets,
which is what our job specs already are, and a Functions repository authors
the versioned code 501/502 already runs in an isolate. So this is not a new
engine so much as the missing front door to two we have.

**What I read, counted rather than asserted.** The section holds **35
pages**. Read whole: `overview`, `navigation`, `branch-settings`,
`manage-permissions`. **Images: the section has 91; I parsed 1** —
`code-repositories/images/code-view.png`, which annotates the Code tab into
its six areas. The rest are per-button and per-dialog crops belonging to
arcs this one does not build; named as unparsed. 31 pages remain unread,
including the whole artifact-repository family (7 pages), the transform
authoring aids (preview, debug, unit tests, custom checks), and
administration.

## 1. What it is, and its repository types

> "**Code Repositories** provides a web-based integrated development environment (IDE) for writing and collaborating on production-ready code in Foundry. The application provides a user-friendly way to interact with the underlying Git repository"

— `code-repositories/overview.md`

The three types the page names, of which two land on engines we hold:

> "**Transforms** repositories support authoring data transformation logic, and include features to enable previewing and debugging transforms. Supported languages include [Python](/docs/foundry/transforms-python/overview/), [Java](/docs/foundry/transforms-java/overview/), and [SQL](/docs/foundry/transforms-sql/overview/)"

— `code-repositories/overview.md`

> "[**Functions**](/docs/foundry/functions/overview/) repositories enable writing business logic that can be executed with low latency in an operational context, and include native support for accessing data from the Foundry [Ontology](/docs/foundry/ontology/overview/)."

— `code-repositories/overview.md`

plus Model development, which we have no counterpart for.

## 2. Five tabs

> "There are five different tabs that you can select at the top of the Code Repositories interface:"

— `code-repositories/navigation.md`

Code, Branches, Pull requests, Checks, Settings. The capture
(`code-repositories/images/code-view.png`) draws the Code tab as six
annotated areas and enumerates far more than the prose does: a breadcrumb
`authoring › Example Code Repository ☆` over `File` and `Help` menus; the
tab strip with a count on Pull requests; `Explore lineage`, `Clone`, a help
button, a build chip and `Share` at the right. Below that a branch row —
the `master` dropdown with edit and new-branch icons — and the action set
**Preview · Test · Commit · Build · Propose changes · ⋯**. The left panel
is `Files` with a search field and a real tree
(`transforms-python/src/myproject/datasets/…`, `pipeline.py`, `setup.py`,
`transforms-sql`). Across the bottom sit nine helper tabs — **Foundry
Explorer, Problems, Debugger, Preview, Tests, File Changes, Build, Docs,
SQL** — over a status bar reading `Code Assist running`, a problem count,
and `Project scoped · Files saved · Checks started running`.

## 3. Sandbox branches, and the rule that shapes everything

> "To edit code in your repository, you must work in a sandbox branch — protected branches cannot be directly edited."

— `code-repositories/navigation.md`

That single sentence is the product's spine: editing happens on a sandbox
branch, and reaching a protected branch is a pull request. The protection
rules are enumerated on their own page:

> "When there are multiple authors contributing to the same code repository, or when the repository backs critical data assets, you can protect your branch to achieve a greater level of governance and defense against unintentional changes. A protected branch can only be modified via a pull request and must satisfy a pre-defined set of requirements."

— `code-repositories/branch-settings.md`

with the permission split stated exactly:

> "By default, only the Code Repository’s owners can change the branch protection settings, while both Owners and Editors can merge pull requests to protected branches. Regardless of permissions, all code authors need to abide to the protected branch policy."

— `code-repositories/branch-settings.md`

The requirements a protected branch may demand are four: a successful
`ci/foundry-publish`, code reviews, specific reviewers, and security
approval.

**Merge modes are a set the repository chooses from**, and the page
enumerates three — Squash and merge, Merge, and Merge with fast-forward:

> "**Squash and merge** - Squash-and-merge mode will create a single commit to the target branch incorporating all the changes that the pull request introduces."

— `code-repositories/branch-settings.md`

> "**Merge with fast-forward** - When there is a direct path from the target branch to your branch (there are no additional changes on the target branch), merge-with-fast-forward advances the target branch to the front of the development branch and combines their commit history."

— `code-repositories/branch-settings.md`

More than one may be enabled, and if squash is among them it is the main
option offered with the others behind a menu.

## 4. Pull requests, checks and tags

> "A *Pull request* lets users view a history of the changes on your branch and review your code on a line-by-line basis before merging your changes."

— `code-repositories/navigation.md`

Pull requests filter Open/Closed and may require an approving review
depending on repository settings. Checks are per branch:

> "In the **Checks** tab, you can view a summary of running and completed checks on each branch."

— `code-repositories/navigation.md`

And tags are the neat definition:

> "The branches tab also lets you access a list of **tags**, which are like immutable branches. A tag can be used to mark a significant version of the code for future reference by giving it a version number or name."

— `code-repositories/navigation.md`

> "A tag can be created from the current version of a branch, or from any arbitrary commit."

— `code-repositories/navigation.md`

## 5. What our substrate holds, probed

We have the two things a repository would author *into*, and neither has a
front door: `job_specs` pair declared inputs with one SQL SELECT and a
build runs them; `functions` hold versioned TypeScript run in a QuickJS
isolate under the caller's JWT. We also have branches — but
`ontology_branches` are the ONTOLOGY's, a different thing from a code
repository's git branches, and conflating them would be the mistake this
reading exists to avoid. Projects, roles, approvals and checkpoints all
exist and map onto repository permissions, pull-request review and
protected-branch requirements respectively.

## Decisions

1. **`code_repositories`** — a project resource with a `kind` in
   (transforms, functions), the two types we can connect to; model
   development is excluded by name since no model engine exists.
2. **Branches are the repository's own**, `code_branches`, never
   `ontology_branches`. A repository names a default branch, and a branch
   carries `protected`. The rule "protected branches cannot be directly
   edited" is a trigger, not a convention: a commit to a protected branch
   refuses unless it arrives through a merged pull request.
3. **Files live per branch** (`code_files`: branch, path, content), which
   is how an editor reads a tree and how a sandbox diverges from master.
   Content is text; this is not a real git object store, and that is a
   recorded divergence rather than a pretence — commits are rows, not
   SHAs over trees.
4. **`code_commits`** carry a message, an author and a parent, so a branch
   is a chain. **`code_tags`** point at a commit — "like immutable
   branches" — and are refused a move once created.
5. **`code_pull_requests`** from a source branch to a target, with
   `status` in (open, closed, merged), reviews as rows, and a merge that
   refuses when the target's protection is unsatisfied. **Merge modes**
   are the page's three, stored per repository as the set offered.
6. **Checks are per branch and per commit**, reusing the shape health
   checks already have rather than inventing a second one.
7. **The IDE is not built, and the list is long enough to say so
   explicitly**: Code Assist, IntelliSense, the Problems/Debugger/Preview/
   Tests/File Changes/Build/Docs/SQL helper panels, in-app help, the
   command palette, Explore lineage, Clone, and artifact repositories.
   What this arc builds is the *repository* — its branches, files,
   commits, pull requests, checks and tags — and a surface that reads and
   edits them. A web IDE is its own programme.
8. **The transforms connection is recorded, not wired.** A transforms file
   declaring `Output(...)` and `Input(...)` is exactly a job spec, and
   generating one from a committed file is the arc that makes this
   application load-bearing rather than adjacent. Naming it here so the
   next arc has somewhere to start.

## Questions

1. **What is our equivalent of `ci/foundry-publish`?** The named check a
   protected branch may require; we have builds and health checks but no
   publish step. Ours: the requirement is stored, and unsatisfiable until
   something publishes. `blocks: nothing.`
2. **Should a code branch relate to a dataset branch?** Foundry's global
   branches "can contain changes across multiple Palantir applications",
   which hints yes, but that is the global-branching section, unread.
   Ours: unrelated for now. `blocks: nothing.`
3. **Do we store file history per commit, or only per branch?** Real git
   stores trees; we store current content per branch. Ours: content per
   branch, with commits as a message chain — a stated divergence.
   `blocks: nothing.`
