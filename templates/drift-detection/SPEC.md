---
description: The generalized drift-detection template — the reusable sensor + actuator pattern (manifest-driven auditor, three safe auto-fix classes, autonomy-tier routing, drift-report artifact) with {company-slot} placeholders. Mechanism only; no company values.
references:
  - path: tooling/kb-audit.mjs
    type: tool
    note: The reusable B-tool this SPEC describes — the manifest-driven sensor. Pure function of manifest.json; swap the manifest, audit a different Drive.
  - path: bootstrap/SETUP_SEQUENCE.md
    type: related
    note: Drift detection is Phase 9 (the steady-state loop) of the idealized setup pipeline this template generalizes.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Drift detection — reusable sensor + actuator template

**Pattern.** A knowledge-OS converges onto its manifest + Standards at setup, then **drifts**: files
land unplaced, frontmatter goes missing, overviews go stale, a workstream forks without a context
entry. This template is the **steady-state control loop's missing half — the sensor — plus the
autonomy-tiered actuator that consumes it.** It is mechanism only: every company-specific vocabulary,
enum, and path is a `{company-slot}` drawn from the manifest, never a literal in here.

| Control role | This template provides | Rung |
|---|---|---|
| **Setpoint** | the manifest + Standards (desired state) | — |
| **Sensor** | a deterministic drift auditor → a machine + human drift report | **B**, escalating to C only for ambiguous drift |
| **Actuator** | a dry-run-first fixer routed by each finding's tier | **B** (skills), gating to A only when destructive + low-confidence |

---

## 1. The sensor — a manifest-driven auditor

**Reusable B-tool:** [`tooling/kb-audit.mjs`](../../tooling/kb-audit.mjs). It reuses the
graph build from the indexer (imported, never re-implemented) and **branches only on values it reads
from the manifest** — `{edge-vocab}`, `{status-enum}`, `{required-fields}`, `{tldr-keys}`,
`{category-rules}`. No `{scan-roots}` path literal appears in the audit *logic*. Run it against an
instance's `manifest.json`; the same code audits a different Drive.

**Signal families** (each emits findings tagged with severity + fixability + autonomy_tier):

| # | Signal(s) | What it catches | Default fixability |
|---|-----------|-----------------|--------------------|
| 1 | `missing_required_frontmatter` | a `{required-fields}` field truly absent → node/edge silently dropped from the graph. Highest blast radius. | needs_judgment |
| 2 | `overview_missing_tldr` · `tldr_last_activity_no_iso` | dashboard card degrades; the `{tldr-keys}` date-anchored key has no ISO date | announce / auto |
| 3 | `phase_archived_location_mismatch` | a locked invariant: `phase: archived` ⇔ lives under `{archive-tier}` | announce |
| 4 | `invalid_reference_type` · `legacy_reference_type` · `invalid_status_enum` | a `type`/`status` outside `{edge-vocab}` / `{status-enum}` (typos that break graph/lifecycle) | auto |
| 5 | `dead_reference` · `provenance_ref_unresolved` · `suspected_stale_sibling` | **re-exported** existing validators — proves *aggregate, don't duplicate* | mixed |

**Output — the drift-report artifact.** One machine artifact (`drift.json`) emitted **beside the other
derived JSON** so a dashboard serves it with no new endpoint, plus an optional human report. Each
finding carries **both** a `severity` (triage order) **and** a `fixability` + `autonomy_tier` — so the
actuator routes on *data*, not discretion:

```json
{ "generated_at": "ISO", "root": "{drive-root}", "manifest": "{manifest-relpath}",
  "counts": { "high": N, "med": N, "low": N, "fixable": N, "needs_judgment": N },
  "findings": [ { "signal": "...", "severity": "high|med|low",
    "fixability": "auto|announce|needs_judgment", "autonomy_tier": 1,
    "id": "{relpath}", "detail": "...", "suggested_fix": "...", "rule": "{standard-citation}" } ] }
```

**Roll-up:** the heavy graph analysis stays in the auditor; the instance's compact state file gets
**one** rolled-up line (`Drift audit: N high / M med — see {drift-json}`), read cheaply from `counts`.
The two sensors stay decoupled and degrade gracefully if one is absent.

---

## 2. The actuator — dry-run-first, tier-routed

A separate fixer tool consumes `drift.json` and reconciles drift, **routing each finding by its
`fixability`/`autonomy_tier`** — it never re-derives autonomy. Mutation lives in its own tool, *not*
in the read-only auditor (the dashboard depends on the auditor staying pure).

| Tier | fixability | Action |
|------|-----------|--------|
| 1 | `auto` | apply unattended, report each |
| 2 | `announce` | do **+ list every change**, then refresh catalogs |
| 3 | `needs_judgment` | **propose; the user confirms** — never auto-acted |

### The three SAFE auto-fix classes (tier 1, the only things auto-applied)

Conservative by construction — everything else is reported, never auto-applied:

1. **`references: None` backfill** — for `missing_required_frontmatter` where `references` is *truly
   absent* but `description` exists. Additive, the sanctioned default, fully safe.
2. **`{status-enum}` prose-strip** — only when the value *starts with* a valid enum token followed by
   prose (`"draft — for review"` → `"draft"`). If it doesn't start with a valid token, leave it for
   the gate.
3. **Unambiguous legacy `{edge-vocab}` repoint** — only the **1:1** mappings from the schema's
   deprecation table (e.g. `relates_to`→`related`). Ambiguous ones (the containment-vs-cross-link
   cases) are left for the gate — repointing them needs per-case judgment.

### Safety model (non-negotiable)

- **Dry-run is the default.** No flag / `--dry-run` prints a **change-plan** (every file, field,
  before→after) and writes nothing; `--apply` executes; the first `--apply` is a **user gate**.
- **Content-hash idempotence + atomic writes** (tmp+rename) — synced-cloud-safe, no-op if unchanged;
  re-running after apply yields an empty plan.
- **Re-audit at the end** so the report + dashboard reflect the fixes.
- A change-plan artifact is written on dry-run for review/replay.

---

## 3. The hard-won lessons (baked into the mechanism)

These are why the pattern is shaped the way it is — carry them, don't relearn them:

- **Aggregate, don't duplicate.** The auditor *re-exports* existing validators (dead-edge checker,
  stale detector) into one unified drift surface rather than rebuilding their checks. Each sensor
  lives where its substrate already is (graph checks in the graph tool; tree checks in the tree-walker)
  — not one monolith.
- **Fixability + autonomy-tier baked into the sensor output.** The gate lives on the *finding*, not on
  the fixer's discretion; the actuator routes on data. This is what makes "minimize A" operational.
- **Provenance carve-out.** A dead reference whose target is under a `{raw-archive-roots}` location
  *and* whose type is a provenance class (`{edge-vocab}.provenance`) is intentionally-removed-source
  drift, not real drift — reclassify it to a low-severity `provenance_ref_unresolved` so the high
  count reflects real problems. (Both the raw-archive root and the provenance class come from the
  manifest — no path literal in this branch.)
- **Exclude derived / auto-generated files.** Never flag auto-catalog files (`{catalog-name}`) for
  missing frontmatter — their `references` are folder contents the walker overwrites every pass, not
  human graph registration. Likewise skip merge-conflict files (`{excludes}.conflict_pattern`) and
  meta/non-project docs from the project-Overview-specific signals.
- **Expected drift is not drift.** Intentionally `superseded`/`legacy`/`exploratory` content (by
  `{status-enum}` value **or** `{category-rules}` bucket) is *expected* to age — exclude it from the
  freshness/stale/TL;DR signals.
- **Numbered-asset & synced-cloud traps.** Never flag `-1`/`-N` numbered assets as conflicts (the only
  conflict pattern is the manifest's `conflict_pattern`); never full-read `agent_read: avoid` bodies
  (frontmatter + TL;DR head only); treat `mtime` as unreliable on synced cloud (key freshness off the
  `{tldr-keys}` date, wide threshold); cloud-unhydrated/unreadable files are *skipped*, never reported
  missing.
- **Dry-run-first + content-hash idempotence** is the universal safe-apply contract for *any*
  actuator, not just this one. Auto-fix only the unambiguous subset; everything else is a gate.

---

## 4. Filling this template for a new instance

1. Point `tooling/kb-audit.mjs` at the instance's `manifest.json` — it is already a pure function of
   the manifest, so there is **no per-instance code edit**. The `{company-slot}` markers above all
   resolve from `company_profile.{vocab,frontmatter_schema,taxonomy,excludes,scan_roots,input_adapters}`.
2. Wire the sensor's one rolled-up line into the instance's compact state file, and (optionally) the
   `drift.json` into a dashboard "Drift" tab — it is already served beside the other derived JSON.
3. Stand up the actuator beside (not inside) the read-only indexer; ship a thin orchestrator skill that
   runs audit → dry-run → gated apply (tier 1 only) → present tier 2/3 as a decision list → re-audit.
4. Cite the instance's own Standards in each finding's `rule` field — those citations are
   `{standard-citation}` slots, filled from the instance's governance stack.
