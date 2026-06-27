---
description: Design spec for the drift-detection actuator — a dry-run-first fixer that consumes drift.json and reconciles drift by autonomy tier, completing the sensor→actuator control loop.
references:
  - path: __Framework/slices/drift-detection/DESIGN.md
    type: sibling
    note: The sensor half; this actuator consumes its drift.json output.
  - path: __Operations/Dashboard/scripts/mot-tools.js
    type: related
    note: The read-only sensor (audit). The actuator's mutating logic deliberately lives elsewhere to keep this read-only.
status: draft
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Slice 1b — Drift actuator (the fix half)

> **Reference instance:** MetaOptics (MOT) is the worked *reference instance* ("Instance Zero") here — the
> `mot-tools.js` / `drift-fix.mjs` / `data/drift.json` / `Reference_Graph_Schema` artifacts named below are
> that instance's, cited as the worked example; this doc is the reusable mechanism.

**Goal:** consume `data/drift.json` and *reconcile* drift, routing each finding by its `fixability` /
`autonomy_tier` — the actuator half of the control loop. The agent decides *what*; a deterministic helper
applies *how*, idempotently, dry-run-first.

> **Architectural rule honored:** `mot-tools.js` is **read-only** (the dashboard depends on that). All
> *mutation* lives in a separate **`__Operations/Dashboard/scripts/drift-fix.mjs`**. The sensor stays pure;
> the fixer is its own tool; a `/drift-fix` skill orchestrates the two.

## Routing (fixability → action)

| Tier | fixability | Action | Examples (MVP) |
|------|-----------|--------|----------------|
| 1 | `auto` | apply unattended, report each | backfill `references: None` (truly-absent); strip prose after a valid `status` enum token; repoint *unambiguous* legacy ref-types |
| 2 | `announce` | do + **list every change** | (MVP: report-only — no auto moves yet) phase↔Archive moves, missing-TL;DR scaffolds |
| 3 | `needs_judgment` | **propose, user confirms** | dead_reference (provenance vs real), missing `description`, ambiguous legacy types, `status: "done"` |

## MVP scope — three SAFE auto-fix classes only

`drift-fix.mjs` applies **only** these (everything else is reported, never auto-applied in the MVP):

1. **`references: None` backfill** — for `missing_required_frontmatter` where `references` is *truly absent*
   but `description` exists. Additive, sanctioned default, fully safe.
2. **`invalid_status_enum` prose-strip** — only when the value *starts with* a valid enum token followed by
   prose (`"draft — for web-designer review"` → `"draft"`). If it doesn't start with a valid token
   (`"done"`), leave for the gate.
3. **`legacy_reference_type` repoint** — only the **unambiguous 1:1** mappings from Reference_Graph_Schema §3's
   deprecation table (e.g. `relates_to`→`related`). Ambiguous ones (`parent`/`child`/`reference`/`consumer`)
   are left for the gate — repointing them needs per-case judgment (is `type: parent` containment-redundant
   or a real cross-link?).

## Fold-in: sensor provenance refinement

Before the actuator, refine the sensor (additive, in `mot-tools.js`): **downgrade/exclude `dead_reference`
findings whose target is under `__temp/` with a provenance-class type** (`source`/`recording`) — these are
provenance to intentionally-removed sources (the 2026-06-16 audit's "non-provenance" exclusion). Reclassify
them as a separate low-severity `provenance_ref_unresolved` (or drop), so the "high" count reflects real drift.

## Safety model (non-negotiable)

- **Dry-run is the default.** `drift-fix.mjs` (no flag / `--dry-run`) prints a **change-plan** (every file,
  field, before→after) and writes nothing. `--apply` executes; the first `--apply` is a **user gate**.
- **Content-equality + atomic writes** (tmp+rename) — OneDrive-safe, no-op if unchanged.
- **Idempotent** — re-running after apply produces an empty plan.
- **Never touch `-1`/`-N` numbered assets**; never full-read `agent_read: avoid` bodies (frontmatter edits
  only); never auto-act on tier-3.
- **Re-audit at the end** (`mot-tools.js audit` + `graph` + `extract`) so the report + dashboard reflect fixes.
- A **change-plan artifact** (`data/drift-fix-plan.json`) is written on dry-run for review/replay.

## The `/drift-fix` skill (orchestrator)

`.claude/commands/drift-fix.md`: (1) run `mot-tools.js audit`; (2) `drift-fix.mjs --dry-run` → show the
change-plan; (3) on approval, `--apply` the tier-1 set; (4) present tier-2 `announce` + tier-3 `needs_judgment`
findings as a decision list for the user; (5) re-audit. Thin procedure; the mechanical work is in the helper.

## What graduates to the framework
- **Mutation lives separate from the read-only indexer** — keep the sensor pure; the fixer is its own tool.
- **Dry-run change-plan + content-hash idempotence** as the universal safe-apply pattern for any actuator.
- **fixability/tier drives routing** — the actuator never re-derives autonomy; it reads it off the finding.
- **Auto-fix only the unambiguous subset; everything else is a gate** — conservative by construction.
