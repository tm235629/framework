---
description: Design spec for the first co-development slice — additive drift detection (the sensor half of the control loop) built on the reference instance (MetaOptics/Instance Zero), generalizing into the framework's Phase-9 drift auditors.
references:
  - path: __Framework/bootstrap/SETUP_SEQUENCE.md
    type: related
    note: Implements Phase 9 (steady-state drift loop) on MOT as Instance Zero.
  - path: __Operations/Dashboard/scripts/mot-tools.js
    type: tool
    note: The MOT implementation lands here as a new `audit` subcommand (the instance; this doc is the mechanism).
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Slice 1 — Drift detection (sensor layer)

> **Reference instance:** MetaOptics (MOT) is the worked *reference instance* ("Instance Zero") this slice
> is co-developed on — the named artifacts (`mot-tools.js`, `check-refs.mjs`, the `__Operations/Dashboard`
> paths, the Bosch/STMicro scar) are that instance's, cited as the worked example. This doc is the reusable
> mechanism; the code lands in the reference instance's tooling.

**Goal:** standing drift auditors that detect when the Drive has diverged from its own rules. Additive
to the reference instance — builds on `graph-index.json`, `check-refs.mjs`, `mot-tools.js stale`, and the
STATE.md attention flags; rewrites none of them. The *actuator* (a fix skill) is a later slice that consumes
this slice's output. This is **Phase 9** of SETUP_SEQUENCE, built on the reference instance first (co-dev),
generalized after.

> **Status — MVP BUILT & VERIFIED (2026-06-21).** Implemented as a `mot-tools.js audit` subcommand
> (additive; no existing function changed) emitting `__Operations/Dashboard/data/drift.json` +
> `__Operations/Documentation/drift_report.md`, with one rolled-up flag in STATE.md. First reference-instance
> run: **550 findings — 17 high / 64 med / 469 low.** Known refinement: `dead_reference` does not yet exclude
> *provenance* refs to intentionally-removed sources (meeting summaries → cleaned-up
> `__temp/recordings/*.mkv`), so the high count is inflated — align with check-refs' non-provenance
> handling next. The `/file-organization` actuator (consumes `drift.json`) is the next slice.
>
> **Mechanism vs instance:** this doc is the reusable spec (framework). The code lives in MOT's tooling
> (instance). Keeping them apart is the architecture.

## Existing coverage vs the gap (so we don't duplicate)

Already caught — **aggregate, don't rebuild:**
- `dead_reference` → `check-refs.mjs` (consume its JSON).
- `explicit_superseded` + `suspected_stale_sibling` (by `context`+`valid_as_of`) → `mot-tools.js stale`.
- `tracker_stale`/`bloat`, `onedrive_conflict_file` (`*-METAOPTICS10*`), `orphan_project_folder`,
  parse-confidence → `tracker-status.py` → `STATE.md ## Attention Flags`.
- `label_node_misflagged` → `extractProjects` warns to stderr (detected but not persisted).

The genuine **NEW gap — four families nothing checks today:**
1. **Frontmatter validity** — `buildGraphIndex` silently tolerates missing/invalid frontmatter
   (`description||''`, `status||null`). Invalid frontmatter is what silently drops nodes/edges from the
   graph + dashboard. *Highest blast radius.*
2. **Placement-contract conformance** — Rules 1–12. Mechanical subset (B): company-in-both-tiers (R2),
   duplicate folder (R5), `customer` ref must target Aquisition (R1D), archived↔location lock (§9),
   product-parent-has-children (R12). Judgment subset (C): MOU (R3), build-vs-relationship artifact — flag only.
3. **Freshness / TL;DR-card conformance** — no tool checks whether an Overview's TL;DR has the canonical
   bullets or a valid ISO `Last activity:`; the dashboard card silently degrades when they're missing.
4. **Structural-integrity persistence** — `label_node_misflagged`, `product_parent_no_children`,
   `phase_archived_location_mismatch` — detectable from the graph but stderr-only or unchecked.

## Auditor design

**Form:** a new **`audit` subcommand on `mot-tools.js`** (`node …/mot-tools.js audit [--json] [--write-report]`).
Reuses `buildGraphIndex`, `walkMd`, `extractTldr`, `extractProjects`, `relPath`, `SCAN_ROOTS`, and
`excludes.json` already in the file — zero changes to existing functions; one new `runAudit(index)` +
one dispatch branch + two `const VALID_*` enum sets (mirrored from Reference_Graph_Schema §3 / Status_Lifecycle §1).
Tree-only placement checks (R2/R5) are a fast-follow inside `tracker-status.py scan_projects` (which
already walks the project roots) — *each sensor lives where its data already is.*

**Emits** `__Operations/Dashboard/data/drift.json` (sits beside the other derived JSON → auto-served at
`/api/data/drift.json`, so a future dashboard "Drift" tab needs no new endpoint):

```json
{ "generated_at": "ISO",
  "counts": { "high": N, "med": N, "low": N, "fixable": N, "needs_judgment": N },
  "findings": [ { "signal": "...", "severity": "high|med|low",
    "fixability": "auto|announce|needs_judgment", "autonomy_tier": 1,
    "id": "relpath", "detail": "...", "suggested_fix": "...", "rule": "..." } ] }
```

Each finding carries **both** a `severity` (triage order) **and** a `fixability`/`autonomy_tier` — so the
actuator routes on *data*, not discretion (the dangerous gate stays on the data). `--write-report` also
writes a human `__Operations/Documentation/drift_report.md`.

**Relationship to STATE.md:** keep the heavy graph analysis in the JS tool; have `tracker-status.py`
append **one** rolled-up flag — `Drift audit: N high / M med — see data/drift.json` — read cheaply from
`drift.json`'s `counts` (no graph build in Python). STATE stays the single compact attention surface; the
two sensors stay decoupled and degrade gracefully if the other is absent.

## Actuator hook (later slice, sketch)

A `/file-organization` skill consumes `drift.json` and acts only on the `fixability` subset by autonomy tier:
Tier 1 `auto` (banners, missing supersession edges, safe enum defaults) — unattended; Tier 2 `announce`
(moves/renames, e.g. duplicate resolution after the user picks the winner) — do + list every move, then
`mot-walker --write --prune`; Tier 3 `needs_judgment` (R3 MOU, which-duplicate-wins, un-inferable
`description`) — propose, user confirms. Ends by re-running `audit`+`graph`+`extract`.

## Risks & false-positive guards (mandatory)

- **`-1` asset gotcha (CRITICAL):** `-1`/`-N`-suffixed files are legitimate numbered assets, NOT conflicts.
  Never flag numeric suffixes. The only conflict pattern is `*-METAOPTICS10*` (reuse that exact regex).
- **`agent_read: avoid`:** read frontmatter + the `## TL;DR` head only (via `extractTldr`); never full-read a flagged file.
- **Intentionally-superseded/legacy/exploratory docs:** *expected* drift — exclude from `freshness_stale`,
  `suspected_stale`, `overview_missing_tldr`, `tldr_*` (filter on `category: superseded/archive`).
- **`mtime` unreliable on OneDrive** (sync rewrites it): key `freshness_stale` off the TL;DR ISO
  `Last activity:` date; treat `mtime` as weak fallback only; wide threshold (45–60 d) to avoid sync noise.
- **Cloud-only/unhydrated files** read as empty/error → "skipped, low note," never `missing_frontmatter`.
- **Meta/Documentation/decision/README/CLAUDE docs** aren't project Overviews → exclude from project checks.

## MVP — the concrete first build target

A `mot-tools.js audit` subcommand emitting `data/drift.json`, covering exactly these 5 signals:

| # | Signal(s) | Why first | Fixability |
|---|-----------|-----------|------------|
| 1 | `missing_required_frontmatter` (`description` and/or `references`) | highest blast radius — silently drops graph nodes/edges | needs_judgment |
| 2 | `overview_missing_tldr` + `tldr_last_activity_no_iso` | degrades dashboard cards; parser already reads the block | auto/announce |
| 3 | `phase_archived_location_mismatch` | CRITICAL locked invariant (Status_Lifecycle §9); one string compare | announce |
| 4 | `invalid_reference_type` + `invalid_status_enum` | cheap enum check; catches typos that break graph/lifecycle | auto |
| 5 | `dead_reference` + `suspected_stale_sibling` **re-exported** | proves the **aggregation pattern** (unify existing sensors, don't duplicate) | mixed |

1–4 are the new fully-deterministic checks with the biggest downstream impact; 5 proves the auditor
*unifies* existing sensors. All avoid every false-positive trap above.

## What graduates to the framework (generalizable principles)

Extract these into `__Framework/templates/` once proven on MOT:
- **Sensor-where-the-data-lives:** put each check where its substrate already is (graph checks in the graph
  tool, tree checks in the tree-walker) — not one monolith.
- **Auditor aggregates, never duplicates:** re-export existing validators into one unified drift surface.
- **Fixability + autonomy-tier baked into the sensor output:** the actuator routes on data; the gate lives
  on the finding, not the fixer's discretion.
- **Derived report beside the other derived JSON** → free dashboard/serving; **one rolled-up flag** in the
  compact state file, full detail in the report.
