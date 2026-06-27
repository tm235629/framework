---
description: The migration/ layer — the reversible, gated, database-first MIGRATION kit. What each tool is, the two-gate procedure, and the safety contract that keeps it read-only on any protected live Drive (the reference instance is MetaOptics). Mechanism only; company values come from the manifest's migration_profile.
references:
  - path: migration/PLAYBOOK.md
    type: long-form
    note: The full phased procedure (inventory → gate 1 → rename_map → gate 2 → execute + verify, dups to _superseded/).
  - path: tooling/config.schema.json
    type: standard
    note: company_profile.migration_profile is the manifest section whose {slots} every tool here reads.
  - path: templates/README.md
    type: sibling
    note: Peer mechanism layer — the migration kit is the move-half; templates carry the static shapes.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# migration/ — the reversible database-first migration kit

> **Reference instance:** MetaOptics (MOT) is the worked *reference instance* ("Instance Zero") here — the
> `__Literature` run cited below is that instance's example, and `OneDrive - MetaOptics` is its
> protected-root marker (read from the manifest), not a framework constant.

Three manifest-driven tools + a playbook that flatten a messy folder tree into a **database-first** store
(content flat, structure in per-file frontmatter, duplicates parked, every move reversible). The
generalized form of the reference instance's one-off `__Literature/_migration` Python run — same
`inventory → rename_map → executed_moves` chain, now a pure function of the manifest so it migrates any Drive.

| File | Rung | What it is |
|---|---|---|
| [`inventory.mjs`](inventory.mjs) | B | **Phase 1, read-only.** Walks `migration_profile.scan_roots`, records path + sha1 + size + type, groups exact + near duplicates → `inventory.json`. The only tool run on the reference instance in the build task (validation sample under `_validation/`). |
| [`plan-renames.mjs`](plan-renames.mjs) | B | **Phase 2.** Proposes `rename_map.json` (`moves[]` + `superseded[]`) from the inventory + manifest taxonomy/filename grammar. Propose-only; moves nothing. |
| [`apply-moves.mjs`](apply-moves.mjs) | B | **Phase 3.** Gated, reversible executor. Default **dry-run**; `--apply` (gate 2) performs moves and logs `executed_moves.json` for exact reverse-replay rollback. |
| [`PLAYBOOK.md`](PLAYBOOK.md) | — | The two-gate phased procedure + the full safety contract. |
| `_validation/` | — | Read-only validation artifacts (the inventory sample run against the reference instance's `__Literature`). Framework-owned, never the live Drive. |

## The contract in one line

`inventory.json` (pre-state + hashes) → **gate 1** (approve target shape) → `rename_map.json` (exact plan)
→ **gate 2** (go/no-go) → `executed_moves.json` (what moved; reverse-replay = rollback). Surplus duplicates
are **moved** to `_superseded/`, never deleted.

## Safety (why this is safe to ship in the live Drive)

- **`apply-moves.mjs` hard-refuses `--apply` on a protected live Drive** (the manifest's
  `storage_profile.protected_root_markers`; the reference instance fills `OneDrive - MetaOptics`) — there
  is no code path that moves a protected live file. A real migration runs against a *different* Drive's manifest.
- **Dry-run is the default**; the first `--apply` is the gate.
- **All JSON artifacts are pinned under `_validation/`** unless an operator explicitly opts a real run out
  (`MIGRATION_REAL_RUN=1`) for a non-protected Drive, and filenames are name-checked so no tool can overwrite a
  content file.

Full guard table + the per-phase commands: [PLAYBOOK.md](PLAYBOOK.md).

## Mechanism only

No company literal appears in the tool logic — scan scope, target folders, filename grammar, and the
metadata-confidence ladder are all `{company-slot}` values read from `company_profile.migration_profile`
(see [`migration_profile.example.json`](migration_profile.example.json) for a filled, non-reference-instance
shape). The tools fall back to documented defaults + the existing `taxonomy`/`catalog_profile` sections when
the section is absent, so they run against the reference instance's manifest unchanged (validation only).
