---
description: Quick reference for the knowledge-OS B-library — the six kb-* tools and the migration kit, with one-line purpose, the run command, and key flags. The deep per-tool reference (manifest fields read, output shape, validated fidelity) is tooling/TOOLS.md.
references:
  - path: ../tooling/TOOLS.md
    type: long-form
    note: The full operator reference this page summarizes (inputs/outputs/fidelity per tool).
  - path: ../migration/PLAYBOOK.md
    type: related
    note: The two-gate procedure the migration kit executes.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Tools — quick reference

Six deterministic (B-rung) tools plus a migration kit. **Every one is a pure function of the manifest** — no
Drive-specific path appears in any tool's logic. Deep reference (manifest fields read, output shape, validated
fidelity vs the reference instance): [`../tooling/TOOLS.md`](../tooling/TOOLS.md).

All run as `node tooling/<tool>.mjs [manifest] [flags]` from the framework root. The manifest argument
**defaults to `manifest.example.json`** if omitted. All six are **read-only on the Drive**, writing only under
`tooling/_validation/` (gitignored) unless you point `--out` elsewhere — the two exceptions are noted below.

## The B-library (`tooling/`)

| Tool | Purpose | Run |
|------|---------|-----|
| **kb-index** | The hub. Walks the scan roots and emits the typed node/edge graph (`files[]` + `containment[]` + `references[]`) from YAML frontmatter. Everything else reads this. | `node tooling/kb-index.mjs <m> --out data/graph-index.json` |
| **kb-extract** | Turns each project Overview's `## TL;DR` into a status card (tier/phase/vertical/milestone). | `node tooling/kb-extract.mjs <m> --index data/graph-index.json` |
| **kb-audit** | **The drift sensor.** Computes findings (missing frontmatter, invalid/legacy ref types, off-enum status, archive/location mismatch, dead refs, stale siblings) with severity + autonomy tier. | `node tooling/kb-audit.mjs <m> --json` |
| **kb-entities** | Emits the entity registry — people (from the manifest) + one card per company folder. **Writes `entities.json` outside `_validation/`** (additive); `--check` validates without writing. | `node tooling/kb-entities.mjs <m> --graph data/graph-index.json --check` |
| **kb-walk** | Generates `_catalog.md` content and validates byte-fidelity against live catalogs. **Dry-run only** — contains no code path that writes a file named `_catalog.md`. | `node tooling/kb-walk.mjs <m> --json` |
| **kb-focus** | Proposes a `person_profile.focus` block from what dominates a Drive (verticals/tiers/contexts/entities/doc-kinds). A **proposal** for Gate 1, never auto-applied. | `node tooling/kb-focus.mjs <m> --graph data/graph-index.json --out -` |

### Common flags
- **`--out PATH`** — where to write (most tools). **`--out -`** prints JSON to **stdout** (kb-index,
  kb-extract, kb-entities, kb-focus). Summaries always go to stderr, so `--out -` keeps stdout clean.
- **`--index PATH`** (kb-extract) / **`--graph PATH`** (kb-audit\*, kb-entities, kb-focus) — reuse a prebuilt
  `kb-index` graph instead of re-walking the Drive. (\*kb-audit rebuilds the graph in-process.)
- **`--check`** (kb-entities) — validate counts without writing.
- **`--json`** (kb-audit, kb-walk) — print the machine-readable result to stdout.

### How they chain
```
manifest.json
   ├─► kb-walk        (catalog projection — dry-run)
   └─► kb-index ──► graph-index.json ──┬─► kb-extract  ──► status cards
                                       ├─► kb-audit    ──► drift findings (SENSOR)
                                       ├─► kb-entities ──► entities.json
                                       └─► kb-focus    ──► person_profile.focus PROPOSAL ─[Gate 1]
```

## Migration kit (`migration/`)

Reversible, database-first, **two-gate**. Only for a *messy brownfield* Drive (never a clean teammate Drive).

| Tool | Purpose | Run |
|------|---------|-----|
| **inventory** | Phase 1, read-only. Records `{rel,dir,name,size,sha1,type,mtime}` per file; groups exact + near-duplicates. | `node migration/inventory.mjs <m>` |
| **plan-renames** | Phase 2, propose-only. Proposes a `rename_map.json` (canonical survivor per dup group, `_superseded/` sink, `needs_review` flags). Moves nothing. | `node migration/plan-renames.mjs <inventory.json> <m>` |
| **apply-moves** | Phase 3, gated executor. **Dry-run by default**; logs every op for reverse-replay rollback. | `node migration/apply-moves.mjs <rename_map.json> <m>` → `--apply` \| `--rollback FILE` |

### Migration safety model (non-negotiable)
- **Dry-run is the default** for `apply-moves` and the planner; they print a change-plan and write nothing to
  the Drive.
- **`--apply` is hard-refused** on a Drive whose root matches `storage_profile.protected_root_markers`. There
  is no code path that mutates a protected live file.
- Artifacts are **pinned under `_validation/`**; writing a real run elsewhere requires explicit env opt-ins
  (`MIGRATION_REAL_RUN=1`, and `MIGRATION_TARGET_IS_NOT_PROTECTED=1` + `--i-understand` for a non-protected
  target). `inventory` also enforces an `inventory*.json` output-name check.
- `apply-moves` writes `executed_moves.json` — **reverse-replay it to roll back** any applied migration.

Full procedure: [`../migration/PLAYBOOK.md`](../migration/PLAYBOOK.md).
