# Deep Dive 9 — Data Protection Tools in Foundry (capture)

> Captured 2026-07-19 from source PDFs (`source/09-data-protection/`, 23 lessons). Condensed record
> in our words with short quotes; Beacon mapping at the bottom. Unknowns `OPEN:`.

## 0. Course frame

- Companion to session 6: governance = security tools (access controls, markings — session 6) +
  **data protection tools**, which are three Foundry apps under the **Security & governance**
  category: **Checkpoints** (purpose justification), **Sensitive Data Scanner** (find unsecured
  sensitive data), **Cipher** (obfuscation/encryption). Data Governance Officer role required.
- Stated functions: purpose justification for sensitive access; scans so nothing sensitive is "left
  unsecured"; **data minimization** ("data can be encrypted without inhibiting critical analysis");
  transparency for admins/compliance over sensitive actions.
- Data: notional `employee_data.csv`. The use-case lesson's two rationales are worth keeping:
  employee **names** obfuscated so analytics can run "while ensuring employee data protection"; and
  **marital status as a quasi-identifier** — not highly sensitive alone, but "when combined with
  other data points, it can significantly enhance the chance of identifying an individual."

## 1. Checkpoints (justification-gated actions)

- A checkpoint = "a prompt that asks users to provide a **justification** when taking an action in
  Foundry," reviewable afterwards for policy adherence; users can also review their own history.
- Configuration (Checkpoints app → Configuration → Configure new checkpoint):
  1. **Checkpoint type**: the gated action — course uses **Compass Export** (dataset export).
     (OPEN: the full checkpoint-type catalog.)
  2. **Scope**: a namespace; **additional conditions** narrow further (course: "User submitting
     checkpoint" = self only, explicitly to avoid disrupting colleagues — production would target
     all users or a group).
  3. User-facing **Title / Prompt / Description** (description renders "in lighter text between the
     checkpoint prompt and justification").
  4. **Justification type**: course uses **Acknowledgment** with custom text (an "I acknowledge the
     risk of downloading data to my local drive" statement). **Frequency** tab left at defaults
     (OPEN: options).
  5. Admin-only configuration title → Create.
- Test: open the dataset → All actions → **Download as CSV** → the checkpoint modal appears → check
  the acknowledgment → Submit → **the download proceeds** (gate = friction + record, not denial).
  The Checkpoints **Review tab** then shows the logged event — "where admins would review downloaded
  items and action any review needed."

## 2. Sensitive Data Scanner (detection at scale)

- Purpose: scan projects to "identify and flag sensitive information that may be at risk of
  exposure." Their own editorial, twice: one dataset could be eyeballed, but orgs run "hundreds, if
  not thousands, of datasets … with new data entering Foundry daily" — the scanner is the
  scale answer.
- Scan setup: pick namespace → **+ Create new scan** → included datasets/folders → **schedule**
  (one-time here; recurring exists) → **match conditions** → **match actions** → review → run.
- **Match condition authoring** (the interesting part): create custom — internal name, condition
  type **Regular Expression**, a regex matching marital-status vocabulary, then public name +
  description. An AI assist exists: "**Generate Regex with AI**" (instance-dependent).
- **Match actions** (declined in training, "advised … in production"): automatic responses to
  positive matches — "creating an issue ticket for further review or **applying a marking**."
  (The session-6 connection: the scanner *discovers* sensitivity; markings then *propagate* it.)
- Run → summary page with a matches-found bar → hovering the match condition reveals the flagged
  column (`MaritalDesc`).

## 3. Cipher (column obfuscation inside the pipeline)

- Cipher = "obfuscation of sensitive data … without hindering essential analysis" — the data-
  minimization tool. Two prerequisite resources, both created as *files in the project*:
  1. **Cipher channel**: choose a **cryptosystem** (course: "Probabilistic encryption", first
     option) + **Key Derivation** → create.
  2. **Cipher license**: scope **Dataset operations**; toggles for **encryption and decryption**
     (both on); option "Enable owners of this license to move it to other projects."
- Application happens **in Pipeline Builder as a transform**: new batch pipeline over
  `employee_data` → Transform → search "**Cipher encrypt**" → Expression = the `Employee_Name`
  column + the **Cipher license rid** → Apply. Output-table preview shows `CIPHER` values replacing
  names (Input/Output tabs to compare). Add output → new dataset → Save → Deploy.
- Verification: open the built dataset → column stats on Employee_Name → **Distinct = 300** — each
  name became "a unique, encrypted identifier," so grouping/joining analytics still work "without
  the risk of users seeing the true employee name values."
- Conclusion pointers: more checkpoints for other action types; encrypt more datasets; **encrypt
  media sets via visual obfuscation to protect images** (OPEN — named only); recurring scans across
  more projects.

## OPEN items

- OPEN: checkpoint-type catalog + Frequency options; justification types beyond Acknowledgment
  (the intro implies free-text justifications exist).
- OPEN: match-action mechanics (ticket creation, auto-marking); recurring scan cadences.
- OPEN: Cipher cryptosystem options beyond probabilistic; decryption workflow/permissions; media-set
  visual obfuscation.

---

## Beacon mapping (analysis — separate from the record)

**All three tools are instances of patterns we already run — with one new UX primitive worth
naming.**

1. **Checkpoints = "act, but justify and log" as config-as-data.** Our actions hardcode reason
   fields per type (`wasteReason`, `revertReason`) and our auto-executed actions land in a review
   feed for retroactive sampling — same philosophy (friction + record, not denial). What Checkpoints
   adds is the *configurable* version: an org-policy knob attaching a justification prompt to any
   action type + scope + audience, with an admin review queue. That's the AIP-native shape — a
   tunable, not a feature. Demand-gated candidate for org_policy when export/bulk-action governance
   becomes a real ask (chain customers will ask).
2. **Sensitive Data Scanner = our detector/monitor grammar, applied to data governance.** Match
   condition (metric) + cadence (trigger) + match action (typed consequence: ticket or marking) is
   exactly the monitors metric/trigger pattern plus the detector→proposal loop. The
   Beacon-relevant instance ties to session 6's parked flag: a **PII match-condition pass over
   ingested document chunks** is how a sensitivity flag would get *populated* (scanner discovers →
   flag propagates). Same parking spot: a P8-time design question, not spec'd unilaterally.
3. **Cipher = column-level obfuscation that preserves analyzability.** Each value maps to a stable
   encrypted identifier (distinct count preserved), so group-bys and joins survive while the
   plaintext is gone. We use no column encryption today; when real hotels onboard with guest data,
   name/email obfuscation-with-joinability is the likely compliance ask (and pgcrypto/derived-key
   approaches are our native route). Also connects backward: session 2's column menu already showed
   "Mark as policy column / Encrypt column" — this course is where those verbs live.
4. **The quasi-identifier lesson** (low-sensitivity fields combine into re-identification risk) is
   doctrine worth keeping verbatim for hospitality data reviews — room number + arrival date +
   nationality is our version of "marital status."

**No impact on** P5/P6 or Track 1 beyond reinforcing the session-6 sensitivity parking.
