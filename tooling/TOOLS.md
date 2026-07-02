---
description: Operator reference for the B-library — the manifest-driven deterministic tools (kb-index/kb-extract/kb-walk/kb-audit/kb-entities/kb-focus) plus the reversible migration kit. Per-tool inputs/outputs/run-command/MOT counterpart/validated fidelity, the chain diagram, and the safety contract.
references:
  - path: tooling/README.md
    type: sibling
    note: The manifest — config.schema.json (mechanism) + manifest.example.json (shipped stand-in; the reference instance's filled manifest is private); these tools are pure functions of it.
  - path: slices/focus-detector/VALIDATION.md
    type: builds-on
    note: kb-focus productionizes the validated v1 focus-detector from this slice (v2/v3 hard-excludes deliberately NOT used — they backfired).
  - path: tooling/manifest.example.json
    type: standard
    note: The shipped synthetic manifest every tool reads; every field named here is a real manifest slot (the reference instance's filled manifest is not shipped).
  - path: migration/PLAYBOOK.md
    type: long-form
    note: The two-gate migration procedure the migration kit executes.
  - path: ARCHITECTURE.md
    type: builds-on
    note: §3 B/C/A ladder, §4 the manifest C→B contract — the model these tools instantiate.
  - path: bootstrap/SETUP_SEQUENCE.md
    type: related
    note: Phase 0 (inventory), Phase 3 (tooling stand-up), Phase 9 (drift loop) place these tools in the pipeline.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# TOOLS.md — the B-library operator reference

> **Reference instance:** MetaOptics (MOT) is the worked *reference instance* ("Instance Zero"), not a
> framework default. `manifest.mot.json` and the `Dashboard/data/…` paths named below are **that instance's**
> filled values — the framework default manifest is generic (`manifest.json`/`manifest.example.json`); a new
> instance supplies its own root, scan roots, and dashboard/data location via its own manifest slots.

Eight deterministic (B-rung) tools. **Every one is a pure function of the manifest**
(`tooling/manifest.example.json` by default, validated by `config.schema.json`) — no `__Projects` /
`__Operations` path literal appears in any tool's logic; every root, exclude, category rule,
vocabulary, and field comes from a manifest slot (ARCHITECTURE §4, the C→B contract). Swap the
manifest and the same code runs against a different Drive.

**All are read-only on the live Drive** and write only under their own `_validation/` tree,
**except** those noted: `kb-entities` and `kb-contacts` additively emit one derived data file each
(`Dashboard/data/entities.json`, `contacts.json`) when `--out` targets the data dir; `kb-dashboard-config`
writes the dashboard slice's `src/config/instance.config.json`; and the migration `apply-moves` mutates a
Drive **only** behind a two-gate interlock that hard-refuses any **protected live Drive** (the markers are
read from the manifest; the reference instance's are `OneDrive - MetaOptics`). `kb-walk` and the migration
planner are dry-run / propose-only by construction.

**Manifest defaults differ by tool family:** the `kb-*` tools default their manifest argument to the shipped
synthetic **`tooling/manifest.example.json`**; the `migration/*` kit defaults to **`tooling/manifest.json`**
(**not shipped** — copy `manifest.example.json` to it, or pass a path explicitly; see the migration
troubleshooting note). Pass a different manifest path as the first positional to retarget. The examples below
pass `manifest.example.json`; the reference instance's filled manifest is private (not shipped).

---

## Core B-library (`tooling/`)

### kb-index.mjs — frontmatter graph indexer
- **Purpose:** walk the scan roots and emit the typed node/edge graph (`files[]` + `containment[]` +
  `references[]`) from per-file YAML frontmatter. The foundation every other tool reuses (imported, not re-spawned).
- **Generalizes:** `mot-tools.js graph` / `buildGraphIndex` — where MOT hardcodes `SCAN_ROOTS`, `SKIP_DIRS`,
  the `deriveCategory` if-ladder, and the field list as JS constants, kb-index reads all of it from the manifest.
- **Reads (manifest):** `storage_profile.root` (+ `person_profile.root_override`), `scan_roots`,
  `excludes.{dirs, conflict_pattern, exclude_path_patterns}`, `taxonomy.category_rules`,
  `frontmatter_schema.{required_fields, optional_fields}`. Note: it applies **only** `conflict_pattern`
  for name exclusion (not `skip_names` — that is walker-scoped; GAP-1 per-tool scoping), so `_catalog.md` is indexed exactly as MOT indexes it.
- **Emits:** `_validation/graph-index.kb.json` — `{generated_at, root, manifest, files[], containment[], references[], counts}`.
- **Run:** `node tooling/kb-index.mjs [manifest] [--out PATH]` (`--out -` → stdout).
- **Fidelity vs MOT:** **100% of comparable nodes** (842/842) and **100% of non-`_catalog` reference edges**
  (1247/1247); category agreement 99.88% (1 miss = GAP-2 catch-all rule, since added); field spot-check **81/81**
  including the Bosch/STMicro confusable pair (correct distinct verticals + phases). See `_validation/REPORT.md`.

### kb-extract.mjs — TL;DR → entity status cards
- **Purpose:** turn every project Overview's `## TL;DR` block into a status card (tier/phase/vertical/next-milestone/
  last-activity), with a tile view and TL;DR-key coverage analytics.
- **Generalizes:** the **generalizable half** of `mot-tools.js extract` (`extractProjects`). It deliberately does
  *not* build `extractSync`/`extractTodos`/`extractEvents` — those parse the MOT-specific weekly-sync grammar and
  belong beside the manifest as company adapters, not in the generic B-library.
- **Reads (manifest):** `taxonomy.project_tiers` (which categories bear a card — the engagement set
  Aquisition/Internal/Collaboration/Archive), `frontmatter_schema.tldr_keys.{canonical, date_anchored_key}`,
  `vocab.{tier_scale, node_kinds}`; reuses the kb-index graph build (or `--index` a prebuilt one).
- **Emits:** `_validation/projects.kb.json` — `{count, card_total, projects[] (tiles), tldr_key_coverage}`.
- **Run:** `node tooling/kb-extract.mjs [manifest] [--out PATH] [--index PATH]`.
- **Fidelity vs MOT:** **100%** vs `Dashboard/data/projects.json` (tile set + per-card axes reproduce 1:1).

### kb-walk.mjs — `_catalog.md` generator (dry-run validator)
- **Purpose:** build per-folder `_catalog.md` content (folder/file tables + frontmatter) as strings and validate
  byte-fidelity against live catalogs — re-attaching any human-authored summary/status on regen.
- **Generalizes:** the C++ `mot-walker` (`mot-walker.cpp`) — `SCAN_DIRS`, `SKIP_DIRS`, `SKIP_EXTS`, `SKIP_NAMES`,
  `EXT_MAP`, and the catalog template, all read from the manifest. Unlike kb-index it **does** apply the
  walker-scoped `excludes.skip_names` + `catalog_profile.skip_exts` (the GAP-1 per-tool-scoping point), so it
  skips `_catalog.md` and data/binary extensions.
- **Reads (manifest):** `scan_roots`, `excludes.{dirs, skip_names}`,
  `catalog_profile.{skip_exts, ext_classification, skip_exact_names, catalog_filename, walker_version, max_depth}`
  (falls back to a documented builtin mirror of `mot-walker.cpp` when a knob is absent, and records the gap).
- **Emits:** generated samples as `*.sample.md` + `validation-summary.json` under
  `_validation/catalogs-sample/`. **It contains no code path that writes a file named `_catalog.md`** — a hard-pinned
  out-dir + an `assertSafeOut()` basename check enforce this.
- **Run:** `node tooling/kb-walk.mjs [manifest] [--sample N] [--seed S] [--out-dir DIR] [--json]`.
- **Fidelity vs MOT:** **49/50 byte-identical** against live catalogs; the single miss is a stale live file, not a
  generator divergence.

### kb-audit.mjs — manifest-driven drift auditor (the sensor)
- **Purpose:** compute the drift findings (missing frontmatter, invalid/legacy ref types, invalid status enum,
  archived↔location mismatch, missing/non-ISO TL;DR, dead refs, suspected stale siblings) with severity / fixability /
  autonomy-tier on each. The Phase-9 sensor half of the control loop.
- **Generalizes:** `mot-tools.js audit` / `computeFindings` — the controlled vocabularies (valid/legacy/provenance
  ref types, status enum), required-field list, and archive literal are all read from the manifest. Reuses kb-index's
  graph build ("the auditor aggregates, never duplicates").
- **Reads (manifest):** `vocab.edge_types.{valid, legacy, provenance}`, `vocab.status_enum`,
  `frontmatter_schema.{required_fields, tldr_keys}`, `taxonomy.category_rules`, `raw_archive_roots`
  (provenance dead-ref reclassification), `frontmatter_schema.avoid_read_marker` (head-only TL;DR read).
- **Emits:** `_validation/drift.kb.json` — `{counts, findings[]}` (same shape as MOT's `data/drift.json`).
- **Run:** `node tooling/kb-audit.mjs [manifest] [--out PATH] [--contacts-json PATH] [--json]`.
- **Fidelity vs MOT:** **99.8%** vs `Dashboard/data/drift.json`; the deltas are OneDrive `mtime` tiebreak +
  concurrent validation files, not logic differences.
- **Contact-register signals (2026-07-02, guarded on `company_profile.contact_register`):** two additional
  drift signals fire **only** when the contact-register block is present and `enabled` — strict no-ops
  otherwise (no finding, no crash). They generalize MOT's `tracker-status.py` shortlist-staleness flag.
  - **`shortlist_staleness`** — resolves `contact_register.shortlists_dir` against `storage_profile.shared_root`
    (when `contact_register.shared`) or the instance root, finds the newest `YYYYMMDD*.md`, and emits a `med`
    finding if none exists or the newest is older than `cadence.outreach.staleness_flag_days` (default 7).
    Requires both `contact_register.enabled` and `cadence.outreach`. A `shared` register with
    `shared_root: null` emits a `low` misconfiguration finding instead of crashing.
  - **`register_vs_derived_drift`** — compares the register file mtime to the derived contacts-JSON mtime
    (path from the `--contacts-json` CLI arg, else the `contact_register.derived_json` manifest hint, else
    skip with a `KB_AUDIT_DEBUG` note). Register newer than JSON → `low` "register changed since last
    extract"; JSON missing → `low` "extract has not run"; register missing on disk → skip.
- **New flag:** `--contacts-json[=]PATH` — the optional derived-contacts-JSON hint for `register_vs_derived_drift`.

### kb-entities.mjs — entity registry (people + companies)
- **Purpose:** emit MOT's single source of truth for entities — closing the replication-blocker that people lived
  only in a hand-duplicated CLAUDE.md table and companies were unindexed `__Projects/` folders. One card per
  top-level company folder; people verbatim from the manifest SOT. No file bodies are read — all company axes are
  lifted off the graph node frontmatter.
- **Generalizes:** there is no single MOT counterpart — it *creates* the registry MOT never built (the
  `entity_registry` SOT from ARCHITECTURE §4 / DECISIONS O5).
- **Reads:** `company_profile.entity_registry.people` (the people SOT) + `taxonomy.project_tiers` where
  `entity_card === true` (which tier folders bear a company card), against a prebuilt graph index (`--graph`,
  default the reference instance's `Dashboard/graph-index.json`).
- **Emits:** `Dashboard/data/entities.json` — `{counts:{people, companies, by_tier}, people[], companies[]}`.
  **This is the one core tool that writes a derived file outside `_validation/`** — additive, beside
  `projects.json`/`sync.json`, served at `/api/data/entities.json`; it modifies nothing else. `--check` validates
  without writing; `--out -` prints to stdout.
- **Run:** `node tooling/kb-entities.mjs [manifest] [--graph PATH] [--out PATH] [--check]`.
- **Fidelity vs MOT:** registry resolves **6 people / 67 companies** from the manifest + graph (the two sources
  that already held the truth).

### kb-contacts.mjs — contacts extractor (reader of the live shared register)
- **Purpose:** emit the dashboard **Contacts** tab data (`contacts.json`) from a company's **live shared
  contact register** — the one on-disk markdown table that is resource class 3's single source of truth
  (ARCHITECTURE §11, S1). It is a **reader**: each teammate instance reads the register, computes person
  status **locally at extract**, and derives the company axes against **its own** graph. Nothing is written
  back to the register.
- **Generalizes:** `mot-tools.js extractContacts()` — the same table parse, extract-time status derivation
  (calendar-month idle boundary), `flag_enum` validation with legacy-`Status` lift, company-axis derivation
  via `linked_project` → graph node with per-field fallback to a name-matched entities card, drafts keyed by
  `to:` email, and facet tallies (unflagged → `flags.none`) — but fully manifest-parameterized.
- **Reads (manifest):** `company_profile.contact_register.{path, schema_columns, flag_enum, status_thresholds,
  sources_dir, shortlists_dir, drafts_dir}`; the register path resolves against `storage_profile.shared_root`
  when `contact_register.shared` else the instance root. Person status
  (active/idle/dormant/uncontacted) is DERIVED here from the Last-contact date vs the real current date and is
  **never stored** in the register (`vocab.derived_contact_status`). Also consumes a prebuilt graph
  (`--graph`) and entity registry (`--entities`) for company-axis derivation, and reads `sources_dir`/drafts.
- **Emits:** `contacts.json` — `{generated_at, source, count, linked_count, draft_count, statuses{}, flags{},
  company_roles{}, company_verticals{}, contacts[]}` (each contact carries the person columns + derived
  `status`, `company_role/vertical/phase/tier`, `logo_slug`, and any matched `draft`). Default output is
  `_validation/contacts.kb.json`; pass `--out` to publish beside the other dashboard data JSON.
- **Run:** `node tooling/kb-contacts.mjs [manifest] [--graph PATH] [--entities PATH] [--out PATH] [--check]`
  (`--check` validates without writing; `--out -` prints to stdout; summary to stderr).
- **Fidelity vs MOT:** **byte-for-byte identical** to the live `data/contacts.json` (**505 contacts**, all
  fields incl. `source` and `draft.file`) except `generated_at` (a permitted timestamp). Exact-fidelity gate
  PASSED. Additive & read-only on the live tree; no write into `__Operations/Dashboard/data/`.
- **Related, named-not-built:** the **register-rebuild** writer (MOT's invariant-checked `rebuild_contacts.py`
  + the per-instance-batch `merge_summaries.py` — the write-gate actuators of resource class 3) is slice-documented
  (`dashboard/DATA_CONTRACT.md`) but not yet ported; kb-contacts ships the *reader* half only (DECISIONS S9).

### kb-dashboard-config.mjs — dashboard slice config generator
- **Purpose:** emit the single config module the dashboard **slice** reads to learn its instance identity —
  display name, category rules, the controlled-vocab **orders** its facets sort by (tier scale / phase enum /
  vertical enum), brand accent + fonts, the top-level folder-prefix convention, the data-layer dir, and which
  instance-plugin extractor scripts exist. Implements S4's "`src/config` generated from the manifest".
- **Generalizes:** the hardcoded `src/config` constants in MOT's live dashboard — every emitted value comes
  from a manifest slot with a documented default only where the manifest omits an optional block.
- **Reads (manifest):** `company_profile.company.name` → `displayName`; `taxonomy.category_rules`;
  `vocab.{tier_scale, phase enum, verticals}` → the facet sort orders; `brand.{accent, fonts}`;
  the top-level folder-prefix convention; `contact_register` (presence → Contacts tab); and the plugin-script list.
- **Emits:** `dashboard/src/config/instance.config.json` — read by `server.js` at boot (display name,
  `rootFolderPrefix`, `dataDir`, `literatureDir`, `contactRegister`, `pluginScripts`) and re-served at
  `GET /api/config`; the client reads the same JSON via `src/config/instance-config.js` (a tiny loader with
  baked-in fallbacks) for the DataViews vocab-order facets + category rules.
- **Run:** `node tooling/kb-dashboard-config.mjs [manifest] [--out PATH] [--check]` (`--check` validates
  without writing; `--out -` prints the config JSON to stdout). Dependency-free (Node stdlib only).
- **Validation:** the emitted JSON parses; every value traces to a manifest slot or a documented default. Feeds
  the [`dashboard/DATA_CONTRACT.md`](../dashboard/DATA_CONTRACT.md) core-vs-plugin tab contract.

### kb-focus.mjs — person-focus detector (the focus-detector C-module's B half)
- **Purpose:** propose a `person_profile.focus` block — which verticals / tiers / contexts / entities /
  document-kinds dominate this person's Drive — so a teammate instance can be focus-adapted at the Step-2 gate.
  Populates exactly the FOCUS-DETECTED slots of `config.schema.json` `person_profile.focus`.
- **Generalizes:** the validated **v1** sandbox slice (`slices/focus-detector/focus-detect.mjs` + `VALIDATION.md`)
  from a frozen snapshot into a manifest-driven CLI reading an EXISTING graph index. Implements the v1 distribution
  ensemble as **soft weighted votes, never single-signal vetoes** — deliberately NOT v2/v3, whose hard-excludes
  backfired (v2 dropped Bosch, v3 dropped Elsoft + collapsed Equipment; see `VALIDATION.md`). Reference-centrality
  *discounts* company hubs softly (flags `__MOT` / camera-modules as company-central); it never excludes a marquee
  account that is merely widely referenced.
- **Reads (manifest):** `storage_profile.root` / `person_profile.root_override`, `taxonomy.project_tiers`
  (`entity_card === true` → entity tiers), `vocab.{verticals, tier_scale}`, `context_registry[].{tag, owner}`;
  against an EXISTING frontmatter graph index (positional or `--graph`, default the reference instance's
  `Dashboard/graph-index.json`). DEPENDENCY-FREE (Node stdlib only) and read-only on the live tree.
- **Emits:** `_validation/person_profile.focus.kb.json` — the proposed `{focus_verticals, focus_tiers,
  focus_contexts, focus_entities, focus_document_kinds, extra_entities:[], _detection_meta:{method, signals_used,
  confidence, shared_drive_caveat}, _flagged_company_central, _signals}`. `--out -` prints the focus block to stdout.
- **Run:** `node tooling/kb-focus.mjs [manifest] [graph-index] [--graph PATH] [--out PATH] [--json]`.
- **Fidelity vs the reference instance:** **reproduces the slice's detected focus block exactly** —
  `focus_verticals` `[Equipment, Foundry]`, `focus_tiers` `[1, 2]`, the tester `focus_contexts` (synthetic
  illustration: partner-a-sensor / partner-b-wafer), and the corresponding partner `focus_entities` — from the
  live graph and the frozen snapshot alike. The real context tags and account names live in the `_instance`
  validation records, not in this shipped doc. The proposal is a PROPOSAL: a human confirms it at the Step-2
  gate before it lands in the teammate's `manifest.json`.

---

## Migration kit (`migration/`) — reversible, two-gate, database-first

Generalizes the reference instance's one-off `__Literature/_migration` Python run (`inventory → rename_map →
executed_moves`) into a manifest-driven kit that flattens any messy tree into a database-first store. All three read
`company_profile.migration_profile` slots (with documented fallbacks to `scan_roots` / `catalog_profile` /
`taxonomy.category_rules` so they run against the reference instance's manifest for validation).

### inventory.mjs — Phase 1, read-only
- **Purpose:** walk the tree, record `{rel, dir, name, size, sha1, type, mtime}` per file, group exact duplicates
  (by content hash) and near-duplicates (by normalized filename, different content).
- **Reads:** `migration_profile.{scan_roots, include_exts, near_dup_*}`, `excludes.dirs`,
  `catalog_profile.{skip_exts, skip_exact_names, ext_classification}`.
- **Emits:** `_validation/inventory.sample.json` (gate-1 input). The **only tool run on the reference instance** in
  the build task (read-only; SHA-1 streams the file, never modifies it). Validation samples: full + PDF-only against
  the reference instance's `__Literature`.
- **Run:** `node migration/inventory.mjs [manifest] [--out FILE] [--limit N] [--no-hash] [--json]`.

### plan-renames.mjs — Phase 2, propose-only
- **Purpose:** propose a `rename_map.json` (`moves[]` + `superseded[]`) from the inventory + manifest taxonomy/
  filename grammar — pick the canonical survivor per dup group (shortest path), route surplus copies to the
  `_superseded/` sink, slot a proposed name, and flag weak-metadata files `needs_review` for the C rung. Writes only
  a plan; moves nothing.
- **Reads:** `migration_profile.{target_layout, filename_template, metadata_sources, min_confident_source}`,
  `taxonomy.category_rules` (path→category fallback).
- **Emits:** `_validation/rename_map.sample.json` (gate-2 review artifact).
- **Run:** `node migration/plan-renames.mjs <inventory.json> [manifest] [--metadata FILE] [--out FILE]`.

### apply-moves.mjs — Phase 3, gated reversible executor
- **Purpose:** execute an approved `rename_map`, logging every op to `executed_moves.json` for exact reverse-replay
  rollback. **Default is dry-run** (prints the change-plan, writes nothing).
- **Reads:** `storage_profile.{root, churn_guards, lock_guards}` (synced-cloud no-clobber + EBUSY/EPERM retry).
- **Emits:** `_validation/executed_moves.sample.json` (apply log; reverse-replayable).
- **Run:** `node migration/apply-moves.mjs <rename_map.json> [manifest]` →
  `--apply` (gate 2) | `--rollback FILE`.
- **Safety:** `--apply` is **hard-refused on a protected live Drive** (the manifest's
  `storage_profile.protected_root_markers`; the reference instance fills `OneDrive - MetaOptics`) — there is no code
  path that mutates a protected live file. A real migration runs against a *different* Drive's manifest
  (override requires `MIGRATION_TARGET_IS_NOT_PROTECTED=1` + `--i-understand`, never on a protected Drive); artifacts
  stay pinned under `_validation/` unless `MIGRATION_REAL_RUN=1`.

---

## How the tools chain

```
                 manifest.json  (C→B contract: root, scan_roots, excludes, taxonomy,
                       │         vocab, frontmatter_schema, entity_registry, …)
                       │
        ┌──────────────┼───────────────────────────────────────────────┐
        │              │                                                │
        ▼              ▼                                                ▼
   kb-walk        kb-index ──► graph-index.json ──┬──► kb-extract  ──► projects (status cards)
   (catalog;          (nodes + containment        ├──► kb-audit    ──► drift findings (SENSOR; +contact-register signals)
    dry-run only)      + reference edges)          ├──► kb-entities ──► entities.json (people+companies)
                                                   ├──► kb-contacts ──► contacts.json (reads the live shared register)
                                                   └──► kb-focus    ──► person_profile.focus PROPOSAL ──[Step-2 gate]

   kb-dashboard-config  manifest ──► dashboard/src/config/instance.config.json  (slice identity; served at /api/config)
   migration kit (own chain, gated, off to the side):
        inventory.mjs ──► inventory.json ──[gate 1]──► plan-renames.mjs ──► rename_map.json
                                            ──[gate 2]──► apply-moves.mjs ──► executed_moves.json
                                                          (reverse-replay = rollback)
```

`kb-index` is the hub: `kb-extract`, `kb-audit`, `kb-entities`, and `kb-focus` consume its graph (imported
in-process or via a prebuilt `--index`/`--graph`). `kb-walk` is a parallel projection (the catalog view, GAP-1's
walker-scoped exclude side). `kb-focus` is the focus-detector C-module's deterministic half — it turns the shared
graph into a per-person `focus` proposal that a human confirms before it lands in a teammate's `person_profile`.
The migration kit is a self-contained `inventory → plan → apply` chain with a human gate before each of the two
destructive steps. In the SETUP_SEQUENCE pipeline: `inventory` = Phase 0, `kb-index`/`kb-walk`/the B-library =
Phase 3 stand-up, the migration kit = Phase 4, `kb-focus` = the teammate Step-2 focus-adaptation, and `kb-audit` =
the Phase 9 steady-state sensor.

---

## Operator checklist (first run on a new manifest)

1. `node tooling/kb-index.mjs <manifest>` — confirm `counts.files` / reference-edge count are sane; this is the graph everything else reads.
2. `node tooling/kb-extract.mjs <manifest>` — check the tile count and TL;DR-key coverage.
3. `node tooling/kb-audit.mjs <manifest> --json` — read `counts.{high, med, low}`; high-severity findings are the first thing to triage.
4. `node tooling/kb-walk.mjs <manifest> --json` — confirm byte-fidelity + that `manifest_gaps` is empty (else fill `catalog_profile`).
5. `node tooling/kb-entities.mjs <manifest> --check` — verify people/company counts before writing `entities.json`.
6. Standing up a teammate? `node tooling/kb-focus.mjs <manifest> --out -` — review the proposed `person_profile.focus` (verticals/tiers/contexts/entities + the `_flagged_company_central` it did NOT promote) at the Step-2 gate, then paste the agreed subset into the teammate's `manifest.json`.
7. Migration only on a **brownfield, non-protected** Drive (not the reference instance): `inventory → [review] → plan-renames → [review rename_map] → apply-moves` (dry-run first, then `--apply`).
