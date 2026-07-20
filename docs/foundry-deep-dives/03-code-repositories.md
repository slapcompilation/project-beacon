# Deep Dive 3 — Transforming Your Data with Code Repositories (capture)

> Captured 2026-07-19 from source PDFs (`source/03-code-repositories/`, 18 lessons; citations are
> `lesson.pdf p.N`). Verbatim record first; Beacon mapping at the bottom. Unknowns marked `OPEN:`.

## 0. Course frame (Introduction.pdf)

- Code Repositories = "a web-based integrated development environment (IDE) for writing and
  collaborating on **production-ready code** in Foundry"; for data engineers creating "efficient
  pipelines in bulk."
- **When to choose it over Pipeline Builder** (their own fit criteria): (1) "a daily pipeline at high
  data scale which requires **incremental compute**"; (2) "a high-visibility pipeline with strict
  **governance** requirements — revert to previous versions of historical code, or **gate code
  changes on unit tests passing**."
- Course outcome: a PySpark Transform (cast + filter), joins + aggregations, collaboration via
  Branching, interaction with Data Lineage and Job Tracker. 60 minutes.
- Scenario (Data Transformation Introduction.pdf): claims handler at a global insurer; present annual
  results per line of business to the CFO. Two datasets: `claims_raw.csv` (2023–24 claims),
  `policies_raw.csv` (policies + line of business).

## 1. Setup differences worth noting

- Project creation here (Create a Foundry Learning Project.pdf) shows a **newer wizard** than session
  2's: organization *space* dropdown, **Default Template**, optional **Portfolio**, and an
  **Advanced** section where the default grant to others is **Editor** — the course has you downgrade
  to **Viewer**. (Session 2's wizard had Namespace + Default role "Discoverer" — the two courses
  captured different vintages of the same dialog.)
- Folder discipline (Create a Course-Specific Training Folder.pdf): `Code Repo Training/` with
  `data/raw`, `data/prepared`, and later a `logic/` folder for the repository — **inputs, outputs, and
  code get separate folders by stage**.
- Marketplace bundle installs the two raw datasets into `data/raw` (Install the Marketplace
  Bundle.pdf).

## 2. Create the repository (Create a New Repository.pdf)

1. In `logic/` → **New > Code Repository** → choose **Pipelines** → choose **Python** → name
   `Claims Transforms (Python)` → **Initialize repository**.
2. Possible detour: a **Code Workspaces** screen may appear — click "Code Repositories" then **"Open
   without syncing"** (OPEN: Code Workspaces itself is never explained).
3. "Skip and start with a blank repository."

## 3. First transform (Create Your First Transform.pdf)

- File tree: `transforms-python/datasets/` → three-dots → **New File** → `claims` with the **Python
  Transformation (*.py)** ending. The template file is generated with an example input/output.
- The transform shape (their template, condensed):
  ```python
  from transforms.api import transform_df, Input, Output

  @transform_df(
      Output("<path-or-RID of output dataset>"),
      claims_raw=Input("<path-or-RID of input dataset>"),
  )
  def compute(claims_raw):
      return claims_raw
  ```
- Inputs/outputs are declared **by dataset path or RID**; you paste the dataset's Location and Foundry
  offers **"Replace paths with RIDs"** (the before/after snippets show paths become
  `ri.foundry.main.dataset.<uuid>`). Output path = `data/prepared/claims`.
- **Preview** ("&gt;&gt; Preview" button): "produces a sample output **without committing changes,
  running checks, or materializing** any datasets."
- Planted data-quality issue: the `date` column values are wrapped in `###` so they can't be a date
  type yet.

## 4. Clean (Clean Your Dataset.pdf)

- Cast: `F.regexp_replace("date", "###", "").cast(T.DateType())` via `withColumn`; filter:
  `F.col("is_accepted") == True`. Verify in Preview (column type now Date; View stats on
  `is_accepted` shows only True).
- **Commit** ("cast and filter claims"): "Commits will trigger **checks** which help us keep your code
  correct and performant." Checks tab shows per-check logs.
- The three-level vocabulary (Build Your Dataset.pdf, p.1 — verbatim substance):
  - **Preview** — sample output; no commit, no checks, no materialization.
  - **Commit** — saves work and triggers Checks; does **not** build outputs.
  - **Build** — materializes the declared output dataset(s), committing latest changes and running
    checks as part of it.
- Build → progress in the bottom Build tab (view from **Job Tracker**) → dataset preview appears →
  open the `claims` dataset → it now exists in `prepared/`.

## 5. Join (Join in Another Dataset.pdf)

- Second input: `policies_raw=Input(...)` + second parameter on `compute`; left join on `policy_id`
  (`claims.join(policies_raw, on="policy_id", how="left")`) to pull in `line_of_business`.
- **Preview sampling caveat (their warning, important):** "When using preview on larger datasets, it
  will typically **sample a subset of the rows**. If desired, the sampling strategy can be specified…
  This is of **critical importance when using joins** to ensure both samples have matching rows based
  on the join criteria." (p.4)

## 6. Branching & the pull request (the collaboration module)

- Framing (Collaboration via Branching Introduction.pdf): "Foundry branching implements an
  **industry-standard Git-like version control paradigm**." Note: the course explicitly distinguishes
  **Code Repositories branches vs Foundry branches** and defers the latter to docs (OPEN).
- **Protect master** (Protecting Master Branch.pdf): Settings → Branches → add `master` to Protected
  branches — "Protected branches can only be modified via pull requests." (Needs Owner permission;
  skippable.)
- **Feature branch** (Performing a Transform on Your Branch.pdf): `+` next to the Branch dropdown →
  "Select Code Repositories branch, if presented" → naming pattern
  `<username>-aggregate-claims-per-line-of-business`. On the branch: replace the return with a
  groupBy aggregation — `claims.groupBy("line_of_business").agg(F.avg("claim_value").alias("avg_…"))`
  → Preview (2-column table) → Commit on the branch → Checks green.
- **Pull request** (Merge Your Branch into Master.pdf; screen verified from rendered page):
  - Branches → **Propose changes** on the feature branch → **New pull request**: title autofilled,
    description encouraged ("helps your colleagues understand the need and the specifics"), merge
    direction `master ← <feature branch>`, a **"Merge when ready"** checkbox, and a side-by-side
    red/green diff of the changed file.
  - PR summary tabs: **Overview | Files changed | Import snippets | Pipeline review | Security
    changes | Commits | Conversation**. "Pipeline review" = a graph of the raw → prepared datasets
    the PR affects. (A security-impact tab as a *standard PR tab* — noteworthy.)
  - **Warnings panel**: "some of the datasets have not yet been built with the latest code changes" +
    **Configure and build** → "Build N affected dataset(s)" on the branch before merging — "Normally,
    it's a good practice to build the dataset on a branch first."
  - Reviewers: "No code approval required" + Add/remove reviewers; checks status line
    ("Checks passed…").
  - **Squash and merge** (their definition, condensed): squash = one combined commit, cleaner
    history; Merge = preserve individual commits, more cluttered log. After merge: PR count → 0;
    Code tab shows "A new commit has been made to this branch" → **Update to most recent version**.
- Repo top nav (observed on rendered screens): Code | Branches | Checks | Pull requests | Tags |
  Settings, plus **"VS Code"** and **"Data lineage"** buttons in the toolbar (OPEN: the VS Code
  integration is never covered).

## 7. Finish (Collaboration via Branching Build Your Dataset.pdf)

- Build the final dataset **on master** → open `claims` → **Explore Pipeline > Explore data lineage**
  → the graph shows two inputs joining into the output (expand ancestors via the little arrow).

## OPEN items

- OPEN: **Foundry branches vs Code Repositories branches** — the distinction is stated and deferred.
- OPEN: Code Workspaces (the "open without syncing" screen) and the **VS Code** toolbar button.
- OPEN: incremental compute mechanics (named as the fit criterion, never shown).
- OPEN: Job Tracker beyond the build-progress embed.
- OPEN: "Import snippets" and "Security changes" PR tabs — visible, unexplained.
- Note: `_error`/`_file`-style unit tests, and the "gate on unit tests" governance claim from the
  intro, are never actually demonstrated — checks in this course are the built-in ones.

---

## Beacon mapping (analysis — separate from the record)

**The headline: their pro-code path is a web re-implementation of the workflow we already live in.**
Git-like branches, protected master, PRs with review + checks, squash-and-merge, build-on-branch
before merge, lineage from code — that is our native git + CI + PR flow, minus local tooling. The
playbook's verdict (§3.5 "HAVE-as-code"; ontology-manager row "we use real git") is **confirmed with
no downgrade**: we run the real thing with a richer harness (local IDE, strict TS, eval suites,
contract tests). Nothing in this course shows a capability our stack lacks.

**Their own positioning validates the split we assumed:** Pipeline Builder for accessibility, Code
Repositories when you need *governance* (revert history, gate merges on tests) and *scale*
(incremental compute). Beacon's equivalent of "the governed path" is the default and only path —
which is the code-as-ontology advantage, not a gap.

**Two genuinely good ideas to note (demand-gated, not build-now):**
1. **PR tabs for Pipeline review + Security changes.** Their PR surfaces *which datasets the change
   affects* (as a graph) and *security-relevant changes* as first-class review tabs. Our PRs don't
   automatically surface "which reality-graph surfaces (tools/actions/edges/cycles) this diff
   touches." A CI comment that renders that impact list would be the Beacon-native analog — cheap,
   high-leverage for review quality. Candidate for the self-apply backlog.
2. **Build-affected-on-branch before merge, as a warning panel.** The PR *knows* which outputs are
   stale relative to the branch code and offers a one-click branch build. Our analog is
   preview-deploy + web-smoke; the delta is the explicit "N affected outputs not yet built" callout.
   Same family as the A9 smoke gates — no action needed now.

**Confirms for the doc-ingestion arc:** the Preview/Commit/Build vocabulary (sample → checked save →
materialized build) is another instance of staged, checked progression — consistent with P4b's
fail-closed stage gates. The **preview-sampling-breaks-joins** caveat is the same grain lesson as
session 2's bad join: samples that don't overlap on the join key silently lie. Our D-phase proofs run
on full real documents, not samples — keep it that way.

**Does not touch:** P5/P6 forks, Vertex, RAG — as expected for this course.
