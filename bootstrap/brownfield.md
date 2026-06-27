---
description: Operator runbook for standing up the knowledge-OS on a MESSY EXISTING (brownfield) Drive — the hardest SETUP_SEQUENCE path. A concrete phase-by-phase checklist that adds Phase 0 debt audit + the Phase 4 gated reversible migration to the greenfield phases, naming the real B-tools (kb-* + the migration kit) and manifest fields, and calling out the MOT anti-patterns the order exists to avoid.
references:
  - path: bootstrap/SETUP_SEQUENCE.md
    type: builds-on
    note: This is the brownfield (Phase 0 audit + Phase 4 migration) instantiation of that phased pipeline; SETUP_SEQUENCE owns the edge from architecture.
  - path: migration/PLAYBOOK.md
    type: long-form
    note: Phase 4 is the two-gate inventory → rename_map → executed_moves procedure spelled out in full here.
  - path: tooling/config.schema.json
    type: standard
    note: The manifest schema every phase fills/reads; field names cited in this runbook are its slots.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Brownfield runbook — standing up the knowledge-OS on a messy existing Drive

The hardest path. A brownfield Drive already holds content that arrived **before** any schema — duplicate
folders, orphan stubs, conflict files, naming variants, dead links, no frontmatter. The whole point of the
ordering below is to **design the data-model + Standards + tooling *before* touching that content**, then
migrate it under a gated, reversible plan. This inverts exactly how **MetaOptics — the reference instance
("Instance Zero")** this framework was extracted from — was built (content-first, two reorg waves, validator
written only after a reorg broke ~170 refs — ARCHITECTURE §7). "MOT" below always means that reference
instance, cited as a worked example, never a constraint on the Drive you are standing up.

> **Entry assumption.** You've run the SETUP_SEQUENCE top-level bifurcations and landed on **brownfield**
> (messy, non-empty). Single-company vs teammate and the dominant-input answer are already chosen; this
> runbook adds the two brownfield-only pieces (Phase 0 audit, Phase 4 migration) to the greenfield phases.

> **Golden rule for the whole run:** *the agent decides **what**; a deterministic tool does **how**, with a
> dry-run and a reversible log.* No tool here mutates content until a gate is passed, and every move is
> replayable in reverse.

---

## Phase 0 — Discovery & inventory *(read-only; nothing moves)*

**Goal:** measure the debt before touching anything; rank it by whether it blocks replication.

- [ ] **Set the root.** Confirm the absolute Drive root that becomes `storage_profile.root`. Everything below
      is relative to it.
- [ ] **Run the read-only inventory** with the migration kit's Phase-1 tool against a *draft* manifest (root +
      `migration_profile.scan_roots` are enough to walk):
      ```
      node migration/inventory.mjs <draft-manifest.json> --out <dir>/inventory.json
      ```
      For every file it records `{ rel, dir, name, size, sha1, type, type_label, mtime_ms, path_len }`, plus
      the **longest path length** (so a later rename can be shown to *shorten* under the path limit) and a
      **type breakdown**. It groups:
      - `exact_duplicate_groups` — identical SHA-1 (surplus copies → `_superseded/` later);
      - `same_name_diff_content_groups` — same normalized basename, different bytes (keep both; disambiguate
        in Phase 4).
      It moves/renames/deletes **nothing** and writes only `inventory*.json` (pinned under `migration/_validation/`).
- [ ] **Run the maintenance/debt audit** — rank the debt into a prioritized table sorted by
      **blocks_replication ↓, severity ↓, effort ↑** (the worked shape is
      [`instance-zero/MOT_GAP_ANALYSIS.md`](../instance-zero/MOT_GAP_ANALYSIS.md) §2). Surface at minimum:
      - **Duplicate folders** (two folders for one entity).
      - **Ghost / orphan stubs** — see the detection recipe below; these are the highest-yield brownfield debt.
      - **Conflict files** (sync-merge artifacts, e.g. `*-METAOPTICS<n>.md` / `*-HOST.md`).
      - **Naming variants** (one company, several folder spellings/date-prefix collisions).
      - **Missing-frontmatter count** and **dead-reference count** (cheap proxies for how far the tree is from
        the contract).
- [ ] **Classify the corpus** (C): confirm brownfield, note the dominant input type (email / meeting /
      doc-dump) — it decides which ingest adapter ships first in Phase 6.

### Ghost-stub detection (the single highest-value Phase-0 signal)

A *ghost stub* is a leftover folder/`Overview.md` from an interrupted earlier move: the real content moved,
the stub didn't get deleted, so the dashboard renders a duplicate node and its links are dead. Detect with a
three-part rule — **flag when all three hold**:

1. **`inbound == 0`** in the graph index — nothing references it (the live copy absorbed all inbound edges).
2. **tiny** — file count / subdir count far below a real project (often the `Overview.md` + a `_catalog.md`).
3. **dead outbound refs** — its body cites paths that no longer exist.

Cross-check against the canonical copy (same basename, `inbound > 0`, full subtree). On MOT this caught two
real ghosts (a stale `MOTviewer` stub and a `2024 manual tester` stub left by an unfinished reorg). Deleting a
ghost is a **tier-3 destroy → confirm with the user**; record each as a Phase-4 candidate, do not delete in Phase 0.

**A — gate:** none (read-only). Output of this phase: `inventory.json` + the ranked debt table.

---

## Phase 1 — Taxonomy & registries from the *real* debt + business lanes *(decide-first)*

**Goal:** author the placement contract and seed the registries **before any content moves** — derived from
what the debt audit and the company's actual business lanes demand, not invented in a vacuum.

- [ ] **Infer the candidate taxonomy** (C) from the Phase-0 debt + the real business lanes: propose the
      top-level `taxonomy.project_tiers` (folder + purpose + `naming_convention` + `entity_card`), the ordered
      `taxonomy.category_rules` (lifecycle folders like `_superseded`/`Archive` match *before* location), the
      `subfolder_convention` (allowed ingest destinations — no raw landing zone), and `non_card_subfolders`
      (deep working zones that don't bear entity cards).
- [ ] **Fill the controlled vocabularies** (`vocab`): `tier_scale`, `phase_enum`, `verticals`,
      `edge_types.{valid,legacy,provenance}`, `node_kinds`, `status_enum`, `supply_chain_roles`. **Resolve
      synonym pairs to one canonical token each** now (the reference instance shipped `researcher`/`research`,
      `supplier`/`vendor` *(reference-instance examples — do not transfer; re-derive your own vocab)*
      uncontrolled and pays for it) — keep losers only in an alias/`legacy` list, never as parallel valid tokens.
- [ ] **Seed the entity registry** (`entity_registry`) — people→roles, and a real `companies` key. This is the
      single source of truth **MOT never built**; generate companies from the entity-card folders rather than
      hand-typing them (`tooling/kb-entities.mjs` is the generator). Seed it *first*, so confusable people/
      companies have one home.
- [ ] **Seed the context registry** (`context_registry`) — every pair of confusable workstreams gets a
      `tag` + `what` + `owner` (the current-position file) + `related[].difference` (the mandatory note that
      stops sibling A bleeding into sibling B). This is the guardrail behind the Bosch↔STMicro tester scar.
      Permit `owner: null` only deliberately (sync-owned / not-yet-active), with an `owner_note`.
- [ ] **Focus-detection** (C; teammate instance only): infer the person's focus from what dominates their
      Drive and fill `person_profile.focus`; add `extra_entities` the shared company seed lacks.

**A — GATE (the single most important gate):** *approve the proposed taxonomy + registries.* Everything
downstream is built on this. Do not proceed to schema/tooling until the operator signs off.

- [ ] **B:** write the approved vocabularies + registries into `manifest.json` (validate against
      `tooling/config.schema.json`).

---

## Phase 2 — Data-model bootstrap

**Goal:** lock the frontmatter node/edge schema + freshness axis as written Standards so the tooling has a
stable target.

- [ ] **Fill the Standards templates** (C) with only the company slots — graph-wiring, lifecycle, quality,
      style, info-distribution, input-format, output-schema (under `templates/standards/`).
- [ ] **Emit the frontmatter schema into the manifest** (B): `frontmatter_schema.required_fields` (minimum
      `description` + `references`), `optional_fields` (`tier`/`phase`/`vertical`/`node_kind`/
      `supply_chain_role`/`status`/`context`/`valid_as_of`/`agent_read`/…), and `tldr_keys` (the `canonical`
      required subset + `date_anchored_key` for the freshness dot).
- [ ] **A:** none if templates are filled mechanically; gate only on a genuinely novel schema choice.

---

## Phase 3 — Tooling stand-up *(BEFORE a single content move — the lesson MOT learned the hard way)*

**Goal:** stand up the validator + indexer + walker + extractor + STATE summarizer **first**, pointed at the
manifest, and verify them against the (still-messy) Drive — so that when Phase 4 starts moving things, every
move is validated and every index regenerates from day one. *MOT wrote its dead-edge validator only after a
reorg broke ~170 references; this phase exists to never repeat that.*

- [ ] **Point the B-library at the manifest** (root via the manifest, excludes/categories/vocab from the
      single config — **no hand-mirrored copies** across tools). The real tools, each a pure function of the
      manifest:
      | Tool | Role |
      |---|---|
      | `tooling/kb-index.mjs` | frontmatter graph indexer → `graph-index.json` (nodes + containment + references + counts) |
      | `tooling/kb-audit.mjs` | dead-edge / missing-frontmatter / invalid-enum / stale / placement **validator** |
      | `tooling/kb-walk.mjs` | per-folder `_catalog.md` generator (generalized walker) |
      | `tooling/kb-extract.mjs` | TL;DR-card / entity extractor → `projects.json` |
      | `tooling/kb-entities.mjs` | people + companies entity-registry generator |
- [ ] **Compile/verify each tool against the messy Drive.** Run `kb-index` then `kb-audit` now and **capture
      the baseline finding count** — that number is your migration setpoint (Phase 4 must end below it, ideally
      green for everything the migration touched).
- [ ] **C:** none.

---

## Phase 4 — The gated, reversible migration *(brownfield only; scripted, gated, reversible)*

**Goal:** bring the messy content under the contract via the **database-first reversible pattern** — never
heuristic-port-then-clean-up-twice. Full procedure: [`migration/PLAYBOOK.md`](../migration/PLAYBOOK.md). The
rhythm is **B → A → B → A → B**: two human gates at exactly the two hard-to-reverse points (*what the target
shape is*, and *go/no-go on the exact plan*).

> **Interlock — read before you touch anything.** `apply-moves.mjs` **hard-refuses `--apply`/`--rollback`
> when the manifest root is the protected MOT path** (exit 2). A real migration runs against a *different*
> Drive's manifest. Dry-run is the default; the first `--apply` *is* gate 2; all artifacts are pinned under
> `migration/_validation/` unless an operator explicitly opts a real non-MOT run out (`MIGRATION_REAL_RUN=1`).

### 4.0 — Fill the migration profile
- [ ] Add `company_profile.migration_profile` to the manifest for the subtree being restructured:
      `scan_roots`, optional `include_exts`, the near-dup `normalize_strip`/`tail_drop`, `target_layout`
      (`primary` flat folder · per-kind `variants` · the `_superseded` sink · `supplement_suffix`),
      `filename_template` (ordered `components` + `sep` + `max_filename_len` + `ascii_fold`), the
      `metadata_sources` confidence ladder + `min_confident_source`, and `taxonomy_source`. A filled non-MOT
      example: [`migration/migration_profile.example.json`](../migration/migration_profile.example.json).

### 4.1 — Inventory (B, read-only)
- [ ] Already produced in Phase 0; re-run `inventory.mjs` if the manifest changed. This is the pre-state +
      hashes the rollback reconciles against.

### GATE 1 (A) — approve the target shape
- [ ] From the inventory + a short proposal doc, confirm **before any rename grammar is written into hundreds
      of files**: (1) the `target_layout`; (2) the taxonomy that becomes each sidecar's `categories[]`; (3) the
      `filename_template` + its length cap; (4) **duplicate handling** — survivor pick, and that surplus copies
      are *parked in `_superseded/`, never deleted.* Resolve open questions here, not after files have moved.

### 4.2 — Resolve metadata (C, optional but recommended) → propose the rename map (B)
- [ ] *(C, optional)* Resolve authoritative per-file metadata along the `metadata_sources` ladder; a file left
      on a source weaker than `min_confident_source` is **flagged, not silently guessed**. Output is a sidecar
      passed via `--metadata`.
- [ ] *(B)* Propose the exact plan:
      ```
      node migration/plan-renames.mjs <inventory.json> <manifest.json> [--metadata resolved.json] --out rename_map.json
      ```
      Emits `{ moves[], superseded[], needs_review[], destination_clashes[] }`. It picks the **shortest-path
      copy** as the survivor per exact-dup group, routes the rest to `<superseded-sink>/<old path>`, slots a
      new name from resolved metadata (falling back to a sanitized existing basename — **never inventing a
      title**), and flags weak-metadata files + in-plan destination clashes.

### GATE 2 (A) — review the exact plan (go/no-go; nothing has moved)
- [ ] `rename_map.json` is the full reviewable diff. **Block on** every `destination_clashes` (two sources →
      one name) and every `needs_review` (weak metadata); resolve each before executing. Spot-check a sample of
      `old → new` rows. For a large/multi-tree Drive, gate **per destructiveness tier** — annotate → light →
      heavy — verifying between batches.

### 4.3 — Execute + verify (B; dual interlock)
- [ ] **Dry-run first (default — writes nothing):**
      ```
      node migration/apply-moves.mjs <rename_map.json> <manifest.json>
      ```
      Pre-flight verifies every source exists and no destination collides or pre-exists.
- [ ] **Apply (gate 2 passed; non-MOT Drive only):**
      ```
      node migration/apply-moves.mjs <rename_map.json> <manifest.json> --apply
      ```
      Moves each op (`mkdir -p` dest · **no-clobber** · cross-volume copy+unlink fallback · EBUSY/EPERM retry
      for synced cloud) and **appends to `executed_moves.json` as each op completes** — so even an interrupted
      run is fully rollback-able.
- [ ] **Park duplicates, not delete.** Surplus exact-dup copies are *moved* to `_superseded/` (old relative
      path mirrored under it). Never delete — every byte is recoverable by rollback.
- [ ] **Rewrite refs + regenerate derived state** with the instance's own tools: write the frontmatter
      sidecars (the database half), then regenerate catalogs (`kb-walk` / the instance walker) and the graph
      (`kb-index`). Repoint any references whose targets moved.
- [ ] **Resolve the Phase-0 ghost stubs** here (tier-3 destroys, each user-confirmed): delete the orphan
      stub folder, keep the canonical copy, refresh the graph.
- [ ] **Verify (B):** re-run `inventory.mjs` on the new layout; reconcile counts (**moved + superseded +
      skipped = prior total**); confirm surplus dups are under `_superseded/` and the primary folder is flat.
- [ ] **kb-audit green + adversarial pass.** Re-run `kb-audit` — for everything the migration touched it must
      be **green** (and overall below the Phase-3 baseline). Then run an **adversarial content pass**: spot-read
      a sample of moved files to confirm no confusable-sibling content was cross-ported (the Phase-1 context
      registry is the checklist).

### Rollback — exact reverse replay (if verify fails)
```
node migration/apply-moves.mjs --rollback executed_moves.json <manifest.json>
```
Replays the log **new → old in reverse**, restoring the prior tree to the byte (surplus copies in
`_superseded/` are restored too).

---

## Phases 5–9 — same as greenfield (run once the structure is stable)

These carry over unchanged from the greenfield path; the only brownfield difference is they run *after* the
migration has settled the tree.

- [ ] **Phase 5 — Instruction layer.** Write the static root `AGENT.md` (classify-before-reading routing
      table + autonomy tiers + avoid-read/superseded conventions + project/people indexes) and the nested
      per-folder rule files (`templates/instruction/`). Validate **one parentage encoding per nested file**
      (a frontmatter edge, not a prose `Parent:` line) and that every file registers in the graph. Do **not**
      overload one filename across genres (MOT's `CLAUDE.md`-is-six-things scar).
- [ ] **Phase 6 — Skills / workflows.** Build the periodic-sync orchestrator + ingest/cleanup/QA sub-skills
      (`templates/skills/`), each ending by regenerating every derived index. Wire the input adapter the
      Phase-0 dominant-input answer chose; bundle the transcription prerequisite as a real skill. Parameterize
      paths/URLs/crops from the manifest, never hardcoded.
- [ ] **Phase 7 — Dashboard** *(optional UI)*. Re-theme + re-point root from `brand`; agents + CLI consume
      `graph-index.json` directly without it. Skip entirely if no UI is wanted.
- [ ] **Phase 8 — Learnings loop.** Start the shared Learnings log; set a recurring promotion review that
      graduates stable learnings into Standards; surface an *unpromoted-learnings count* as a STATE flag.
- [ ] **Phase 9 — Steady-state drift loop.** Turn on the standing drift auditors (`kb-audit` over
      `graph-index.json`) as sensors + the org/sync skills as actuators, with the manifest + Standards as the
      setpoint. Phases 1–5 run **once**; 6 + 9 run **forever**. A major re-baseline re-enters at Phase 1.

---

## Anti-patterns this order exists to avoid — lessons from the reference instance

*Each row is a scar from MetaOptics (Instance Zero); the left column is what the reference instance did,
the right is what this runbook does instead.*

| Anti-pattern (how the reference instance did it) | What this runbook does instead |
|---|---|
| **Content-first.** Files arrived before any schema; frontmatter, placement rules, lifecycle, and the context registry were retrofitted after incidents (the Bosch/STMicro tester confusion is the scar). | **Schema + Standards + registries first** (Phases 1–2), gated, before any content moves. |
| **Tooling-after-moves.** The dead-edge validator was written *after* a reorg broke ~170 references. | **Stand up validator + indexer + walker in Phase 3, BEFORE the migration** — and capture a baseline finding count the migration must beat. |
| **Heuristic-then-clean-up-twice migration.** Two Drive-wide reorg waves of rework. | **One gated, reversible, database-first migration** (Phase 4): inventory → gate 1 → rename_map → gate 2 → executed_moves, dups parked in `_superseded/`, replayable rollback. |
| **No entity registry ever existed** → recurring people/company tangles. | **Seed the entity registry first** (Phase 1) — people + a generated `companies` key as one SOT. |
| **Confusable workstreams with no guardrail.** Sibling testers cross-bled. | **Context registry seeded in Phase 1**; an **adversarial content pass** in Phase 4 verifies no cross-port. |
| **Ghost stubs left by interrupted moves** → duplicate dashboard nodes + dead links. | **Ghost-stub detection in Phase 0** (`inbound==0` + tiny + dead refs), resolved as user-confirmed tier-3 destroys in Phase 4. |
| **One fact in up to five places; excludes triplicated across tools.** | **The manifest is the single source**; every B-tool is a pure function of it — no hand-mirrored excludes/vocab. |

---

## Acceptance checklist (the brownfield run is done when…)

- [ ] **Phase 0:** `inventory.json` exists; a ranked debt table (blocks_replication-sorted) names every
      duplicate folder, ghost stub, conflict file, and naming variant; ghost stubs flagged by the
      `inbound==0` + tiny + dead-refs rule.
- [ ] **Phase 1:** taxonomy + all four registries (entity, context, plus vocab + frontmatter slots) approved
      at the gate and written to `manifest.json`; synonym pairs collapsed to one canonical token each;
      `manifest.json` validates against `config.schema.json`.
- [ ] **Phase 2:** Standards filled; `frontmatter_schema` (required/optional/`tldr_keys`) emitted to the manifest.
- [ ] **Phase 3:** `kb-index` + `kb-audit` + `kb-walk` + `kb-extract` run against the (pre-migration) Drive;
      **baseline finding count recorded** — and every tool reads the manifest, with **zero hand-mirrored
      excludes/vocab** across tools.
- [ ] **Phase 4:** `rename_map.json` approved at gate 2 with **zero unresolved `destination_clashes` /
      `needs_review`**; `apply-moves --apply` ran; `executed_moves.json` exists and a dry-run rollback
      reconciles; **moved + superseded + skipped = prior total**; surplus dups are in `_superseded/` (nothing
      deleted); primary folders flat; refs rewritten; ghost stubs removed (user-confirmed).
- [ ] **Phase 4 quality gate:** `kb-audit` is **green for everything the migration touched** and **below the
      Phase-3 baseline overall**; the **adversarial content pass** found no confusable-sibling cross-port.
- [ ] **Phases 5–9:** root `AGENT.md` + nested rule files in place (one parentage encoding each, all graph-
      registered); periodic-sync + ingest skills regenerate every derived index; Learnings loop + promotion
      review active; **drift auditors running** as the steady-state sensor with the manifest as setpoint.
- [ ] **Whole run:** no content was mutated before a gate passed; every move is reversible from
      `executed_moves.json`; the live MOT tree was never modified.
