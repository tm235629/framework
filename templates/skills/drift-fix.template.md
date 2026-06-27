---
description: The drift-fix actuator skill skeleton — the generalized form of MOT's drift-fix. Runs the read-only manifest-driven drift audit (kb-audit.mjs), dry-runs the fixer, and on explicit user approval applies ONLY the three safe tier-1 auto-fix classes; tier-2 announce + tier-3 needs_judgment findings are presented as a decision list, never auto-acted on. Dry-run + approval always precede any apply. Every company value is a {company-slot} naming its manifest field.
references:
  - path: tooling/kb-audit.mjs
    type: tool
    note: The read-only SENSOR this actuator consumes — the manifest-driven drift auditor; pure function of manifest.json, emits the drift report.
  - path: templates/drift-detection/SPEC.md
    type: standard
    note: The design spec this skill implements (the actuator half of the sensor+actuator control loop) — the three safe auto-fix classes, the autonomy-tier routing, and the safety model.
  - path: templates/skills/periodic-sync.template.md
    type: related
    note: The orchestrator's Step 7 runs the SENSOR only; this gated ACTUATOR is deliberately separate so the sync never auto-fixes beyond tier-1/2 supersession annotations.
  - path: tooling/config.schema.json
    type: standard
    note: The fixer's vocab targets (edge_types.legacy → valid repoint, status_enum, required_fields) and the manifest path it audits against all come from this schema.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Drift-Fix Actuator — template

> **Mechanism only.** Every `{slot}` names a `manifest.json` field. The fix classes target manifest
> vocabularies (`vocab.edge_types`, `vocab.status_enum`, `frontmatter_schema.required_fields`), never
> hardcoded enums. This generalizes MOT's `drift-fix`.

## Preamble

This skill closes the drift control loop: the **sensor** (`{audit-tool}` = `kb-audit.mjs`, read-only)
detects where the Drive diverged from its own manifest + Standards; the **actuator** (`{fixer-tool}`,
mutating) reconciles the safe subset. The two are deliberately **separate tools** — the sensor stays
read-only so the dashboard can depend on it.

**Safety contract (non-negotiable):**
- **Dry-run is the default and always runs first.** `{fixer-tool}` with no flag (or `--dry-run`) prints a
  change-plan and writes the plan artifact — it changes **no source files**.
- **`--apply` is a USER GATE.** Never run `--apply` without showing the dry-run plan and getting explicit
  approval **in this session**. The first apply is the user's call, not the agent's.
- **Only three safe auto classes are ever auto-applied** (tier 1). Everything else — tier-2 `announce` and
  tier-3 `needs_judgment` — is **presented as a decision list**, never auto-acted on.
- **Tier 3 is always user-confirmed, per case.**

Scope trigger *(instance-named)*: the drift verbs for this instance — e.g. "drift fix", "reconcile drift",
"run the drift actuator".

The actuator's three safe auto classes (all frontmatter-only, surgical line edits; all targeting manifest
vocab):

| Class | From signal | What it does | Manifest target |
|---|---|---|---|
| `references_none_backfill` | `missing_required_frontmatter` | insert `references: None` when `references` is truly absent but `description` exists (both absent → tier-3 gate) | `frontmatter_schema.required_fields` |
| `status_prose_strip` | `invalid_status_enum` | strip trailing prose after a valid leading enum token (`draft — for review` → `draft`); value not starting with a valid token → gate | `vocab.status_enum` |
| `legacy_ref_type_repoint` | `legacy_reference_type` | repoint only the unambiguous 1:1 legacy→valid mappings; ambiguous (containment-vs-cross-link) legacy types → gate | `vocab.edge_types.legacy` → `.valid` |

---

## Step 1 — Refresh the sensor

Run the read-only audit so the plan is computed against current state:

```bash
node {audit-tool} {manifest-path}
```

(`{audit-tool}` = `tooling/kb-audit.mjs`; `{manifest-path}` = the instance's `manifest.json`.)
Note the headline counts (high / med / low; fixable / needs_judgment). This writes the drift report (the
actuator's input). **Nothing is mutated.**

## Step 2 — Dry-run the fixer, show the change-plan

```bash
node {fixer-tool} --dry-run
```

This writes the change-plan artifact and prints a per-file plan (field, before → after) grouped by the
three classes, plus the in-class **skipped** list (gated cases, with reasons). **No source files change.**

Present to the user:
- Counts per fix class.
- A few representative before → after samples.
- The notable gated/skipped items (e.g. `status` not starting with a valid token, ambiguous legacy types)
  so they know what is being deferred.

## Step 3 — GATE: apply the tier-1 set (only on explicit approval)

**Stop and ask for approval. Do not proceed without it.** On a clear yes:

```bash
node {fixer-tool} --apply
```

This executes the planned edits with atomic tmp+rename and a content-equality no-op guard (synced-cloud
safe per `storage_profile.churn_guards`/`lock_guards`). It is **idempotent** — re-running yields an empty
plan. Report the `written` / `no-op` counts. If the user does not approve, **stop here** — the dry-run plan
remains on disk and nothing changed.

## Step 4 — Present tier-2 + tier-3 findings as a decision list (do NOT auto-act)

From the drift report, surface the findings the actuator did **not** touch:
- **Tier 2 (`announce`)** — e.g. `phase_archived_location_mismatch`, `overview_missing_tldr`. These imply
  moves/scaffolds the actuator does not auto-do. List each; an approved move is separate hands-on work
  (then refresh catalogs with `{walker-tool}`).
- **Tier 3 (`needs_judgment`)** — e.g. `dead_reference` (real path drift), `provenance_ref_unresolved`
  (usually leave as-is), `missing_required_frontmatter` where `description` is also absent, ambiguous
  legacy types, `invalid_status_enum` not starting with a valid token, `suspected_stale_sibling`.

For each tier-3 item, **propose** a specific resolution and let the user confirm **per case**. Never
batch-apply tier 3.

## Step 5 — Re-audit so the report + dashboard reflect the fixes

After any apply, regenerate the sensor output and the derived layer:

```bash
node {audit-tool} {manifest-path}
node {indexer-tool}
node {extractor-tool}
```

Confirm the new counts (tier-1 classes cleared) and that `{fixer-tool} --dry-run` now yields an empty plan
for the applied classes (idempotence check).

---

## Guards (the actuator enforces; restate when reviewing the plan)

- **Frontmatter-only edits.** Never touches the body; never full-reads an `{avoid-read-marker}` body —
  frontmatter editing is fine.
- **Numbered assets are NOT conflicts.** The only conflict pattern is `excludes.conflict_pattern`; those
  files are never edited.
- **Skip files that don't parse** (cloud-unhydrated / no frontmatter block) — reported as skipped, never
  guessed at.
- **Surgical line edits**, not a YAML re-serialize, so unrelated frontmatter is never churned.
- **The gate lives on the finding, not the fixer's discretion** — the actuator routes on the sensor's
  `fixability` / `autonomy_tier` data, which is what makes "minimize the human gate" operational.
