---
description: The gated, reversible, database-first migration procedure — inventory → gate 1 → rename_map → gate 2 → execute + verify, with surplus duplicates parked in _superseded/. Generalizes MOT's __Literature/_migration run into a manifest-driven kit; mechanism only, every company value is a manifest slot.
references:
  - path: __Framework/migration/inventory.mjs
    type: tool
    note: Phase 1 — the read-only manifest-driven inventory (sha1 + size + type + dup groups).
  - path: __Framework/migration/plan-renames.mjs
    type: tool
    note: Phase 2 — proposes rename_map.json (moves[] + superseded[]) from inventory + taxonomy.
  - path: __Framework/migration/apply-moves.mjs
    type: tool
    note: Phase 3 — gated reversible executor; default dry-run; writes executed_moves.json for exact rollback.
  - path: __Framework/tooling/config.schema.json
    type: standard
    note: company_profile.migration_profile is the manifest section whose slots fill this procedure (target_layout, filename_template, metadata ladder).
  - path: __Literature/Papers/_catalog.md
    type: source
    note: The proven worked instance this kit generalizes — the __Literature database-first restructure (459 PDFs → flat Papers/ + sidecars) executed via the original Python _migration scripts.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Migration kit — the gated, reversible, database-first procedure

> **Reference instance:** MetaOptics (MOT) is the worked *reference instance* ("Instance Zero") in this
> playbook — the 459-PDF `__Literature` run cited below is **that instance's** proven worked example, and
> `OneDrive - MetaOptics` is its protected-root marker, not a framework constant. The interlock reads
> markers from the manifest (`storage_profile.protected_root_markers`).

A reusable kit for **flattening a messy folder tree into a database-first store** — content goes flat,
structure moves into per-file frontmatter sidecars, exact duplicates are parked (never deleted), and the
whole run is **replayable in reverse**. It is the generalized form of the reference instance's one-off
`__Literature/_migration` run (459 PDFs → flat `Papers/` + `.md` sidecars), with every instance-specific value
(scan scope, filename grammar, target folders) lifted into the **manifest** so the same three tools
migrate a *different* Drive by swapping `company_profile.migration_profile`.

> **The kit never mutates a protected live Drive.** `apply-moves.mjs` hard-refuses `--apply` when the manifest
> root carries a protected-root marker; `inventory.mjs` writes its artifact only under `migration/_validation/`.
> A real migration runs against a *different* Drive's manifest. See **Safety contract** below.

## The B → A → B → A → B rhythm (two gates)

The kit pushes every mechanical step to a deterministic (B) tool and inserts a human **gate (A)** at
exactly the two points that are hard to reverse: *what the target structure is* (gate 1) and *go/no-go on
the executed plan* (gate 2). Metadata resolution that needs judgement or an external lookup is the **C**
rung — it produces a resolved-metadata sidecar the B planner consumes.

```
Phase 1  inventory.mjs ........ B   read-only walk → inventory.json (sha1, size, type, dup groups)
   └─ GATE 1 (A) ............... approve the proposed target structure + taxonomy + filename grammar
Phase 2a  (C, optional) ....... resolve authoritative per-file metadata (bib/embedded/crossref/first-page)
Phase 2b  plan-renames.mjs .... B   inventory + manifest → rename_map.json (moves[] + superseded[])
   └─ GATE 2 (A) ............... review the EXACT move plan; resolve every clash + needs_review
Phase 3  apply-moves.mjs ...... B   --apply executes; logs executed_moves.json (reverse-replayable)
   └─ verify .................. B   re-inventory; counts reconcile; surplus dups in _superseded/
```

Each artifact is the **input contract** of the next stage — the same chain the literature run proved:
`inventory.json → rename_map.json → executed_moves.json`, where a reverse replay of the last restores the
prior tree exactly.

---

## Phase 1 — inventory (read-only)

```
node __Framework/migration/inventory.mjs <manifest.json> --out <dir>/inventory.json
```

Walks `migration_profile.scan_roots` (the subtree being restructured), honouring `excludes.dirs` and
`catalog_profile.skip_exts`/`skip_exact_names`. For every file it records `{ rel, dir, name, size, sha1,
type, type_label, mtime_ms, path_len }`, then groups:

- **`exact_duplicate_groups`** — identical SHA-1 (the surplus copies that go to `_superseded/`).
- **`same_name_diff_content_groups`** — same normalized basename, different bytes (preprint-vs-published,
  SI-vs-main; *keep both*, disambiguate in Phase 2).

It also reports the **longest path length** (so the rename can be shown to *shorten* paths under the
storage path-limit) and a **type breakdown**.

> **Read-only guarantee.** The tool only ever opens files for hashing and writes a single
> `inventory*.json`, pinned under `migration/_validation/` unless `MIGRATION_REAL_RUN=1` is set (reserved
> for a real run on a non-protected Drive). It moves/renames/deletes nothing.

### GATE 1 — approve the target shape *(human)*

Before any rename grammar is written into hundreds of files, confirm — from the inventory + a short
proposal doc (the literature kit's `Phase1_Inventory_and_Proposal.md` is the model):

1. the **target layout** (`migration_profile.target_layout`: primary flat folder, kind-variant folders,
   the `_superseded/` sink, supplement suffix);
2. the **taxonomy** that becomes each sidecar's `categories[]` (multi-valued — a thing folders never
   allowed);
3. the **filename grammar** (`migration_profile.filename_template`) + its length cap;
4. **duplicate handling** (survivor pick + that surplus copies are *parked, never deleted*).

Resolve the open questions here, not after files have moved.

---

## Phase 2 — propose the rename map

**2a (C, optional but recommended):** resolve authoritative metadata per file along the
`migration_profile.metadata_sources` ladder (bib → embedded → external lookup → first-page read). This is
agent/external-lookup work, not deterministic; its output is a `rel → {title, authors, year, venue,
first_author, last_author, category, kind, source}` sidecar passed to the planner via `--metadata`. A file
left on a source weaker than `min_confident_source` is flagged, not silently guessed.

**2b (B):**

```
node __Framework/migration/plan-renames.mjs <inventory.json> <manifest.json> [--metadata resolved.json] --out rename_map.json
```

Emits `rename_map.json`:

```json
{ "moves":      [ { "old", "new", "kind", "category", "source", "title?" } ],
  "superseded": [ { "old", "new", "reason" } ],
  "needs_review": [ … ], "destination_clashes": [ … ] }
```

It picks the **shortest-path copy** as the survivor per exact-dup group, routes the rest to
`<superseded-sink>/<old path>`, slots a proposed new name from resolved metadata (falling back to a
sanitized existing basename — **never inventing a title**), and flags weak-metadata files + in-plan
destination clashes.

### GATE 2 — review the exact plan *(human)*

`rename_map.json` is the full, reviewable diff. **Block on**: every `destination_clashes` entry (two
sources mapping to one name) and every `needs_review` entry (weak metadata) — resolve before executing.
Spot-check a sample of `old → new` rows. This is the go/no-go gate; nothing has moved yet.

---

## Phase 3 — execute + verify

```
# DRY-RUN (default): pre-flight + change-plan, writes nothing
node __Framework/migration/apply-moves.mjs <rename_map.json> <manifest.json>

# APPLY (gate 2 passed; non-protected Drive): executes + logs executed_moves.json
node __Framework/migration/apply-moves.mjs <rename_map.json> <manifest.json> --apply
```

Pre-flight verifies every source exists and no destination collides or pre-exists; a missing source that
is a *superseded surplus copy* is non-fatal (it may already be parked). On `--apply` it moves each op
(`mkdir -p` dest, **no-clobber**, rename with cross-volume copy+unlink fallback, EBUSY/EPERM retry for
synced cloud) and **appends to `executed_moves.json` as each op completes** — so even an interrupted run is
fully rollback-able.

**Verify (B):** re-run `inventory.mjs` on the new layout; reconcile counts (moved + superseded + skipped =
prior total); confirm surplus duplicates are under `_superseded/` and the primary folder is flat. Then
write the sidecars (the database half — out of this kit's move scope) and refresh catalogs/graph **with
the instance's own walker** (on MOT that is `mot-walker --write --prune`; this kit never runs it).

### Rollback — exact reverse replay

```
node __Framework/migration/apply-moves.mjs --rollback executed_moves.json <manifest.json>
```

Replays the log **new → old in reverse order**, restoring the prior tree exactly. Because surplus copies
were *moved to* `_superseded/` (not deleted), rollback restores them too. This is the kit's whole
risk-reversal story: a database-first migration you can undo to the byte.

---

## Safety contract (non-negotiable)

| Guard | Where | Effect |
|---|---|---|
| **Protected-root interlock** | `apply-moves.mjs` `applyRefusalReason()` | `--apply`/`--rollback` HARD-REFUSED (exit 2) when the manifest root carries a protected-root marker (`storage_profile.protected_root_markers`; the reference instance fills `OneDrive - MetaOptics`). No code path moves a protected live file. Override exists only for a genuinely-non-protected Drive (`MIGRATION_TARGET_IS_NOT_PROTECTED=1` + `--i-understand`). |
| **Dry-run default** | `apply-moves.mjs` | No flag ⇒ plan only, writes nothing. The first `--apply` *is* gate 2. |
| **Validation-pinned artifacts** | all three tools, `assertSafe*()` | inventory/plan/log JSON can only land under `migration/_validation/` unless `MIGRATION_REAL_RUN=1` (real non-protected run). Filenames are name-checked (`inventory*.json`, `rename_map*.json`, `executed_moves*.json`) so a tool can never overwrite a content file. |
| **Never delete** | the whole kit | Surplus duplicates are **moved** to `_superseded/`, never removed — every byte is recoverable by rollback. |
| **No-clobber moves** | `apply-moves.mjs` `doMove()` | refuses to overwrite an existing destination; cross-volume + synced-cloud-lock safe. |
| **Incremental log** | `apply-moves.mjs` | `executed_moves.json` is flushed after every op, so a partial run is still fully reversible. |

## Filling the kit for a new instance

1. Add `company_profile.migration_profile` to that Drive's `manifest.json` (schema:
   [`tooling/config.schema.json`](../tooling/config.schema.json)) — set `scan_roots`, `target_layout`,
   `filename_template`, and the `metadata_sources` ladder for the genre you are migrating.
2. Run Phase 1 → review at gate 1 → (optional C metadata pass) → Phase 2 → review at gate 2 → Phase 3
   `--apply` (the root carries no protected marker, so the interlock permits it).
3. The tools need **no per-instance code edit** — they are pure functions of that manifest, exactly as the
   rest of the B-library is.

> **Worked instance (the reference instance):** the proven run this kit generalizes is the reference
> instance's `__Literature` database-first restructure (2026-06-11): inventory of 459 PDFs, 27 exact-dup
> groups parked, flat `Papers/` + 406 frontmatter sidecars, full `inventory → rename_map → executed_moves`
> audit trail. Re-running `inventory.mjs` over today's `__Literature` reproduces those counts (459 PDFs ·
> 26 exact-dup groups · 4 same-name groups — the small deltas are the 2 duplicates the original run already
> parked), validating the generalization.
