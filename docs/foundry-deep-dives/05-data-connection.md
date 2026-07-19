# Deep Dive 5 — Creating Your First Data Connection (capture)

> Captured 2026-07-19 from source PDFs (`source/05-data-connection/`, 31 lessons). Condensed record
> in our words with short quotes; Beacon mapping at the bottom. Unknowns `OPEN:`. (Training-sandbox
> URLs/credentials in the lessons are intentionally not recorded here.)

## 0. Course frame

- **Data Connection** = the app that synchronizes data from external systems into Foundry,
  "abstracting the connection complexities into a straightforward frontend interface." Supported
  source families: cloud object stores, file systems, databases, data warehouses; data types
  structured/unstructured/semi-structured; transfer modes **batch, micro-batch, streaming**.
- Modular course, three connector walkthroughs: **Relational DB (Postgres/JDBC, 15m), S3 (15m),
  REST API (20m)** — each stated to generalize (any JDBC database; any S3-compatible store like GCS/
  Azure Blob; any HTTP endpoint).
- Security note up front: sources must live in a **project with correct permissions**, which gates
  who can "access, modify, or remove the sources, synchronizations, and **webhooks**" (OPEN: webhooks
  named, never shown).

## 1. The networking model (Connecting an External System)

- Connections execute in Foundry ("**Foundry Worker**") with networking controlled by **Network
  Egress Policies**. Two network categories:
  - **Public networks** (cloud storage, SaaS REST APIs) → **Direct Connection** egress policies —
    Foundry initiates requests directly; the external system must accept inbound from Foundry.
  - **Private networks** (on-prem DBs, ERPs, custom APIs) → **Agent Proxy** policies with **Data
    Connection Agents**: downloadable programs running inside the private network, managed from
    Foundry, communicating via "encrypted, **unidirectional outbound** requests from the private
    network into Foundry"; the source accepts inbound from the Agent, not from Foundry.
  - Alternative **Agent Worker** (connection logic runs on the agent machine itself) is explicitly
    **discouraged** (software-packaging overhead + hardware limits).
- **Egress policies are role-gated**: creating one requires the **Information Security Officer** role
  on the Enrollment (checked in Control Panel → Network egress). Policies are *shared*: "if there is
  already an existing egress policy … simply import the existing one." A policy = named allowlist
  entry (DNS/address + port).

## 2. The common source-creation grammar (all three connectors)

New source → pick **source type** (search the catalog; REST API sits under "Protocol sources") →
**connection details** → **egress policy** (import existing or create: Direct connection + name +
DNS + port → auto-applied to the source) → **output folder** ("Generate a default output folder",
changeable later) → Export configuration screen (skipped — "covered in a following tutorial") →
optional Code import configuration → name the source + choose project location → **Create source and
continue**.

Per-connector connection details:
- **S3**: bucket URL + region + access key/secret. No certificates needed ("S3 connections are
  secured using AWS's built-in mechanisms").
- **Postgres**: host type/hostname + port 5432 + database name + username/password, **plus
  Certificates**: Create new certificate → **Server certificate bundle** (bundle name, alias, pasted
  PEM content) → attach to source → **SSL mode: require**. Stated purpose: encryption in transit +
  server identity verification against man-in-the-middle.
- **REST API**: domain base URL + port 443 + Authentication **None** ("authentication is going to be
  handled in the logic") + **Additional secrets** (named secret values stored on the source).

## 3. Syncs (S3 + Postgres path)

- From the source summary → **Explore** → **Source Explorer** lists what the connection can see
  (files for S3, tables for Postgres; table contents previewable). Click **+** next to a file/table →
  **Create sync for 1 dataset** → initial import build starts ("in Foundry, any operation that alters
  the contents of datasets is referred to as a dataset **build**") → Open build details → success.
- Result dataset: Actions → Open. For the S3 CSV, an explicit **"Apply a schema"** step converts the
  raw file to tabular. Closing line both times: the dataset "can now be used as an input into
  pipelining and analysis tools, as well as the Ontology."

## 4. REST APIs = code-based ingestion through a governed source

The REST path doesn't use syncs — it pairs the Source with a **Code Repository external transform**:
1. On the source: **"Allow this source to be imported into code repositories"** + assign a unique
   **API name** (camel case).
2. New Code Repository (Pipelines > Python; the wizard offers "Open with Code Repository" vs VS Code
   — "VS Code is the recommended option," course uses the web IDE). Repo initialization asks for the
   transform type (**Distributed transform (Spark)**) and pre-declares the **output dataset**
   (name + folder) before generating the file.
3. Install the **`transforms-external-systems`** library from the repo's library search.
4. Import the source: external-systems (globe) panel → Add → **Existing connections** → pick the
   source.
5. The transform (their shape, condensed): decorate with `@external_systems(rest_api_source=
   Source("<source RID>"))` + `@transform_df(Output("<path>"))`; inside, the source object provides
   `get_https_connection().url`, **`get_secret(...)`** for the stored token, and
   `get_https_connection().get_client()` — "a pre-configured Session object from Python `requests`" —
   then GET + `raise_for_status()` + JSON → `ctx.spark_session.createDataFrame(...)` as the output.
6. Commit → Build → dataset contains the API payload, "ready for downstream use in pipelining tools
   and the Ontology."

Key properties of the pattern: **credentials never appear in code** (secrets live on the Source,
retrieved by name); the HTTP client comes pre-configured from the governed connection; the code can
only reach what the egress policy allowlists.

## 5. Considerations & best practices (their production checklist, condensed)

Questions to answer before production: update frequency (when does the source update? how fresh is
useful? retention?); retrieval restrictions (source load windows? internally inconsistent moments?);
change shape (appends vs modifications? **how is deletion handled?**). Pointers: Scheduling,
Retention, Building Pipelines, **Monitoring** docs.

## OPEN items

- OPEN: **Export configurations** — deliberately deferred ("a following tutorial") in every path;
  presumably Foundry→external writeback.
- OPEN: Agent setup mechanics (doc link only), webhooks, micro-batch/streaming ingestion, media
  syncs.
- OPEN: the "Code import configuration" tab defaults (left untouched).

---

## Beacon mapping (analysis — separate from the record)

**This is the missing chapter of [project_data_integration_parity] — Foundry's ingestion primitives,
named:** **Source** (connection + secrets + certificates + egress policy, a governed object living in
a permissioned project) → **Sync** (per-dataset import job) → **build** → dataset → ontology. Our
current ingestion is bespoke (Supabase client, document upload, seed scripts); we have no first-class
Source/Sync objects. For the hospitality wedge this is the blueprint for the eventual **PMS/POS/
procurement connector story** (Opera/Mews/Lightspeed → Beacon): when a real hotel onboards, the thing
they'll need is exactly a Source registry with per-connector config, sync jobs, and health — and our
pipeline-health monitor (PR #297) is already the *monitoring* end of that arc. Not current backlog;
capture matters for when onboarding demands it.

**Postures we already share (confirmations):**
- Secrets live on the connection object, code retrieves by name, credentials never in code — our
  env/secret discipline (and the VITE_ rule) in their architecture.
- Egress as **explicit, named, role-gated allowlists** — nothing reaches out unless declared. Our
  edge functions have implicit egress; the AIP-native (config-as-data) version would be a small
  `connectors`/allowed-endpoints registry per org. Demand-gated note, not work.
- "Any operation that alters dataset contents is a build" — one verb for all mutations = our
  everything-through-actions/audit stance, applied to ingestion.
- Unidirectional-outbound agents for private networks — worth remembering verbatim for future
  on-prem hotel systems (many PMSs are on-prem): the connector runs *inside* the hotel network and
  dials out; nothing dials in.

**Their production checklist maps onto our monitors pattern** (metric in code + tunable trigger in
org_policy): freshness expectation, retrieval windows, append-vs-mutate shape, deletion handling are
exactly the knobs a per-source health monitor should carry. When we build connectors, these four
questions become the config schema.

**No impact on** P5/P6 forks or the doc-ingestion Track 1 — different subsystem, as expected.
