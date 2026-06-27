---
description: The periodic-sync orchestrator skeleton — the generalized form of MOT's mot-sync. Ingest raw inputs → per-thread/meeting summaries → port artifacts by placement rules → refresh per-entity overviews → two-audience roll-up + QA gate → to-dos → regenerate derived indexes (+ drift sweep). Parameterized by an inbox adapter, placement-rule set, sync schema, and cadence; every company value is a {company-slot} naming its manifest field.
references:
  - path: templates/skills/ingest-cleanup.template.md
    type: trigger
    note: The safe-janitor sub-skill this orchestrator invokes after each ingest pass (Step 1 cleanup, and the after-run cleanup).
  - path: templates/skills/meeting-ingest.template.md
    type: trigger
    note: The meeting-ingest sub-skill Step 5 hands off to when the transcription adapter yields recordings.
  - path: templates/skills/drift-fix.template.md
    type: related
    note: Step 7 runs the read-only drift SENSOR only; the gated drift ACTUATOR is the separate drift-fix skill — never auto-fixed inside the sync.
  - path: tooling/config.schema.json
    type: standard
    note: Every {company-slot} below binds to a field of this manifest schema (input_adapters, taxonomy, vocab, frontmatter_schema, cadence, scan_roots, entity_registry).
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Periodic-Sync Orchestrator — template

> **Mechanism only.** Every `{slot}` names a `manifest.json` field (see `skills/README.md` slot table)
> or an instance Standard. The skill body is thin procedure; substance lives in the cited Standards.
> This generalizes MOT's `mot-sync` — keep the SHAPE, fill the values per instance.

## Preamble

You already have `{hub-file}` and `{state-file}` in context. Do **not** preload Standards or trackers —
each step reads them on demand. Honor the avoid-read convention for files flagged `{avoid-read-marker}`
(manifest `frontmatter_schema.avoid_read_marker`): prefer `{state-file}` or the named extractor; full-read
only when the extractor doesn't surface what you need, or the user explicitly asks.

Scope trigger *(instance-named)*: the sync verbs for this instance — e.g. "periodic sync", "process
inputs", "weekly sync", "run sync". Human companion doc: `{sync-process-doc}`.

## Cadence & modes — light (incremental) vs finalize (publish)

Run against the **rolling-prep model** from `{cadence}` (manifest `cadence.model`): the previous period's
published roll-up is **frozen**; the next period's folder holds an in-prep draft that accumulates through
the period. Pick the mode from context — a mid-period run with a small window is **light**; the
`{cadence.publish_day}` cadence run (or an explicit "finalize"/"publish") is **finalize**.

**Light mode (the always-on subset):** Steps 1–3, then fold material developments into the ongoing-period
**draft** (keep both audiences — see Step 4), run the ingest-cleanup sub-skill on the window just
processed, run the read-only **drift sensor** (Step 7), and regenerate `{state-file}` + the derived data
layer + catalogs. **Skip** the PDF render and the QA gate (finalize-only). Do **not** edit the frozen
published roll-up; do **not** run the index publish-commit mid-period.

**Finalize mode (`{cadence.publish_day}`):** promote the draft to published — build the full roll-up for
**both** audiences, run the QA gate (Step 4b), render the PDF, circulate, then run the publish-commit.

The numbered steps are the **finalize** pipeline; light mode is the subset above.

---

## Step 1 — Ingest → per-thread/meeting summaries

Adapter-driven; the `{email-adapter}` (manifest `input_adapters.email`) supplies location, filename
grammar, and junk patterns. Above the adapter seam this step is source-agnostic.

- Read `{state-file}` for the last-processed date. If it is stale (> threshold past `generated_at`), run
  `{state-tool}` first to refresh.
- Scan `{email-adapter.location}` for new inputs after that date, parsing `{email-adapter.body_formats}`
  by `{email-adapter.body_filename_grammar}`.
- **Boundary re-scan (mandatory for a flat-export adapter):** re-scan the previous batch's last calendar
  day — start the scan from `last_processed_date` **inclusive** — to catch same-day-seam misses. *(A
  proper `mail_api` adapter with monotonic cursors does not need this shim; it is a flat-export fallback.)*
- **Late-reply check:** a status-changing message can land on an already-summarised thread that filename
  reconciliation won't catch. For every thread in the window, confirm the summary's newest cited message
  is not older than the newest matching source timestamp; if a later reply exists, fold it in and move the
  filename date forward.
- Group by conversation thread (normalize subjects per the adapter's reply/forward-prefix + ticket rules).
- Write/update per-thread summaries in the adapter's summary location.

**Frontmatter on every summary (required).** Each `.md` begins with `{required-fields}` frontmatter:

```yaml
---
description: "<one-line gloss — partner + topic, terse>"
references:
  - path: {entity-overview-path}        # per project this thread is about; type from {edge-vocab}
    type: references
  # zero entries is OK for generic admin input
---
```

Resolve `{entity-overview-path}` against the instance's project index — use the indexer/glob, never
hand-author a non-existent path. Optional decision fields (`decision_type`, `decision_value`,
`decision_date`, `contacts`) are filled **only at processing time from what the source explicitly says**;
omit entirely when ambiguous (no "unclear" noise). These feed the derived data layer — a missing field
beats a wrong one.

**Event-advertisement gate.** Expo / conference / booth-offer inputs are summarised like any thread but
do **not** spawn a calendar event or action item unless an own-company confirmation to attend exists
(per `{sync-schema}` events rule). The standing default is "not participating".

## Step 2 — Port artifacts by placement rules

Identify meaningful artifacts (documents, CAD, archives, significant images). Skip adapter junk
(`{email-adapter.junk_patterns}`), zero-byte placeholders, sub-threshold signature images, and duplicates
already ported.

**Placement is governed by `{placement-rules}`** (the instance's placement Standard, which cites
`taxonomy.project_tiers` + `taxonomy.subfolder_convention`). Routing logic, all from the manifest:

- **Tier by entity type, not document type:** customers → the customer `{entity-tier}`; suppliers + internal
  R&D → the supplier `{entity-tier}`; signed-MOU co-dev → the collaboration `{entity-tier}`; post-sale
  records → the sales tier; terminated relationships → `{archive-tier}`.
- **Location ≠ owner:** supplier-built customer equipment is **supplier-centric** — it lives under the
  supplier folder; the customer folder holds only customer-supplied artifacts. Ownership is a
  `type: customer` `references` edge, not a folder move.
- **Purpose-named subfolders only:** port directly into `{subfolder-convention}` destinations. No raw
  landing-zone folder.

**Pre-flight checks before proposing any destination** (all read from the manifest/index):
1. **Existing-folder check** — glob the `{entity-tiers}` for the partner; if a folder exists, use it —
   never create a second folder for one company.
2. **Spelling-variant check** — scan the project index for near-spellings; route to the canonical folder,
   flag the variant.
3. **Multi-entity check** — if the input references more than one project, port to the primary destination
   and flag the cross-reference.
4. **Tier-conflict check** — if the company appears in multiple tiers, route by the default and flag the
   conflict.

**Porting flow (act-and-flag — autonomy tier 2: do it, announce the moves):** copy each artifact to its
rule-determined destination (originals stay in the raw archive); where the rules give a clear answer, just
do it. For genuinely ambiguous items pick the best reasonable destination, port, and flag. Stop to ask only
when no reasonable default exists. After porting, report a table (artifact + source + final path + rule
cited, flagged items at the top) and refresh catalogs with `{walker-tool}` (write mode).

## Step 3 — Refresh per-entity overviews

- Read `{quality-standard}` + `{style-standard}` before editing any entity `Overview`.
- For each input, identify the affected project(s) from the project index.
- Update the entity `Overview` per the quality Standard (concrete data, source citations, current-state
  upkeep). Respect its TL;DR head — update the `{tldr-keys}` bullets when status, next milestone, last
  activity, or blockers change; keep the date-anchored key (`{tldr-keys}.date_anchored_key`) leading with
  an ISO date.
- Cite ported artifact paths from Step 2 when referencing documents.

## Step 4 — Two-audience roll-up

Read the three roll-up Standards before writing: `{distribution-standard}` (formatting/structure),
`{sync-schema}` (extraction, action-item voice, carryover/age-out, the two layouts), and the master
`{sync-template}` (the public skeleton). **Build from the master template, not from last period's roll-up**
— apply the carryover/age-out rules to decide what survives.

Build **two** files in the period folder `{period-folder}`, per `{sync-schema}`:
- **Private / working** — comprehensive **company-first** version (one entry per partner, named owners,
  source column, `>` action items, internal notes OK). Built first.
- **Public / shareable** — pivot the private file into the schema's category-first layout (classify each
  entity into a group; merge context + phase into a terse status; drop owner-source and action items —
  those go to Step 6). **This is what the dashboard surfaces**, so it must stay shareable.

Update the corresponding **timeline** doc(s) per `{distribution-standard}`, and **reconcile the events
file** (the dashboard calendar + `{state-file}` source) with this period's events table — add / re-date /
remove rows so it mirrors the roll-up's forward-looking events (ISO-dated, or `TBD` if confirmed-undated).

**Voice rules (instance memory; restate to keep the public roll-up shareable):** zero own-staff names in
public to-dos; "follow up / re-engage", never "chase"; write topic *state*, not meeting-meta (strip "set
in the <date> sync" wrappers — meeting analysis lives in the meeting summary, not the roll-up); top-level
priorities only in the direction section, workstream initiatives go in operations.

## Step 4b — Roll-up QA gate (finalize only; mandatory)

Run the full pre-publication QA checklist from `{sync-schema}` against the **public** file only. Output the
QA report inline in the schema's report format (including the carryover audit). Fix any fails and re-check
before Step 5. Surface `[needs review]` items to the user.

## Step 5 — Meeting recordings

- Check `{transcription-adapter.recordings_location}` for new recordings after the last-recording date in
  `{state-file}`.
- If transcripts are missing, prompt for the `{transcription-adapter.backend}` pipeline (transcripts must
  pre-exist; the framework bundles this as a real prerequisite skill rather than an undocumented seam).
- Hand off to the **meeting-ingest sub-skill** to produce summaries; feed their insights into the entity
  overviews (Step 3) and the roll-up (Step 4).

## Step 6 — Period to-do list

### 6a — Propagate the board overlay (publish the previous period's edits)
If the instance runs a to-do board with a period-scoped overlay, fold its edits in before building the new
list. Read the plan (`{board-propagate-tool}`): **FINALIZE** resolved tasks fold into the *outgoing*
report as done-this-period lines under their owner (never strikethrough); **CARRY-OVER** open tasks seed
the new period; **DROPPED** deleted tasks are not carried. Apply FINALIZE to the previous period's to-do,
seed the new period from CARRY-OVER, then commit the overlay as published.

### 6b — Build the new period's to-do list
- Start from the carry-over set, then extract ALL *new* action items from the roll-up (`>` items), inputs,
  and meetings.
- Create/update `{period-folder}/<period> Action Items & To-Do`.
- Organize by person (from `{people-registry}`). Do **not** assign a name unless the source makes
  responsibility explicit; do **not** add priority tags — the team prioritizes. Never strikethrough.
- Include external/pending-responses and key-dates sections.

## Step 7 — Freshness / drift sweep (sensor only)

A batched audit so staleness is caught here, not mid-task. Standards: `{lifecycle-standard}` (how to mark)
+ `{context-registry}` (the confusable-workstream registry). Every fix here is autonomy **tier 1
(annotate)** or **tier 2 (announce moves)** — apply and report, don't stop to ask.

1. **Diff what changed** — content docs with mtime after the last-sync date are the candidates.
2. **Per changed/added content doc** (skip raw dumps): ensure it's in the folder catalog with a one-line
   summary; handle **supersession** of a same-`context` sibling (tier 1: set old doc
   `status: superseded`, add a `type: superseded_by` edge, banner, decision-log line, overwrite the
   context's current-position block; version chains move the predecessor to a sibling `_superseded/` — tier
   2, announce); fix any invalidated current-position block or "source of truth = X" pointer.
3. **Naming hygiene** — strip the adapter's export timestamp infix from newly-ported files; ensure the
   descriptor is meaningful (tier 2, announce renames).
4. **Run the read-only drift sensor:** `node {audit-tool} {manifest-path}` — it folds explicit + suspected
   supersession **plus** dead-references, missing/invalid frontmatter, placement, TL;DR, and freshness into
   one drift report. In **this** step apply only its tier-1/2 supersession annotations; **every other
   finding is reported here and reconciled by the separate, gated drift-fix skill — never auto-fixed inside
   the sync.**
5. **Output a "Freshness" section** in the roll-up summary: the sensor's high/med counts, what was marked
   superseded, what moved, which summaries/pointers were updated, and any `suspected_stale` left for the
   user.

---

## After all steps

1. Run the **ingest-cleanup sub-skill** inline on the window just processed.
2. Update the instance's processing/recording trackers.
3. Regenerate `{state-file}`: `{state-tool}` (write-state mode).
4. Regenerate the graph index: `node {indexer-tool}`.
5. Refresh catalogs: `{walker-tool}` (write + prune).
6. Regenerate the derived data layer: `node {extractor-tool}` (parses the new roll-up, to-do, Overview
   TL;DRs, and events into the dashboard JSON). If extract reports parse warnings, fix the **source**
   formatting — the roll-up format is the contract, not the extractor.
7. Render the PDF (finalize only): `node {pdf-tool}`.

`{state-file}` is auto-generated — never hand-edit it, and never write a "Current Status" narrative back
into `{hub-file}`. If the state tool misses something the user needs, add an attention-flag computation to
`{state-tool}` instead.
