---
description: Operator runbook for standing up a knowledge-OS on a NEAR-EMPTY (greenfield) Drive — a concrete step-by-step checklist mapping SETUP_SEQUENCE phases to the artifact to create, the tool/command to run, and the gate (if any). Greenfield skips Phase 4 (no migration: content arrives correctly placed) and exploits its one advantage — design-first with zero legacy debt.
references:
  - path: __Framework/bootstrap/SETUP_SEQUENCE.md
    type: builds-on
    note: The phased pipeline + bifurcations this runbook operationalizes for the GREENFIELD branch (skip Phase 4). SETUP_SEQUENCE owns the edge up to ARCHITECTURE.
  - path: __Framework/tooling/config.schema.json
    type: standard
    note: The manifest schema every artifact below fills; the validate step checks against it.
  - path: __Framework/templates/README.md
    type: related
    note: The mechanism library each step copies a template from; {company-slot} markers resolve from the manifest.
  - path: __Framework/migration/README.md
    type: related
    note: The Phase 4 migration kit this runbook deliberately SKIPS — named so an operator confirms it is not needed on a greenfield Drive.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Greenfield runbook — standing up a near-empty Drive

The operator checklist for the **GREENFIELD** branch of
[SETUP_SEQUENCE.md](SETUP_SEQUENCE.md) (`starting state? → greenfield`). It maps each phase to **the
artifact to create**, **the tool/command**, and **the gate**. Run it top to bottom.

> **Greenfield's one advantage: design-first with no legacy debt.** There is no content to inventory,
> no rename map, no `_superseded/` sink, no ~170 broken refs to fix after a reorg (the scars cited
> throughout this runbook come from **MetaOptics — the reference instance ("Instance Zero")** this
> framework was extracted from; "the original" below means that instance, not a constraint on yours).
> You author the
> manifest + Standards + tooling against an *empty* tree, then **content arrives already correct**
> through the Phase 6 skills. So **Phase 4 (migration) is skipped entirely** — its absence is the whole
> point of choosing this branch. Spend the time you save making the Phase 1 taxonomy gate right, because
> everything downstream binds to it and nothing will retro-fix it.

**Entry bifurcations (set once, before Phase 0).** Answer the four SETUP_SEQUENCE entry questions and
record them — they pick which adapter ships first and which guards turn on:
`who` (teammate seeded from company-invariants / new company re-derived) · `starting state` =
**greenfield** · `dominant input` (email-heavy / meeting-heavy / doc-dump → first ingest adapter) ·
`storage` (synced-cloud → `storage_profile.churn_guards`+`lock_guards` ON / local-git → OFF).

All commands run from the Drive root with Node ≥ 18. `MANIFEST=path/to/manifest.json` below is the
instance manifest you build in Phase 1–2 (schema: `__Framework/tooling/config.schema.json`; the worked
reference is `__Framework/tooling/manifest.mot.json`).

---

## Phase 0 — Discovery & inventory *(trivial: the Drive is empty)*

- **Artifact:** none. A greenfield Drive has nothing to walk.
- **Tool:** none. (For brownfield you would run `migration/inventory.mjs` → `inventory.json`; on
  greenfield there is nothing to inventory — this is precisely what makes it greenfield.)
- **Gate:** none.
- **Do:** confirm the classification is genuinely greenfield (near-empty: no legacy content, no
  duplicate-folder debt). If real content already exists, stop — you are on the **brownfield** branch and
  must run Phase 4; use the migration kit instead.

---

## Phase 1 — Taxonomy & registry design *(decide-first; the load-bearing gate)*

Author the placement contract and **seed the two registries before any content lands** — they design out
the two recurring scars (no entity SOT → people tangles; unregistered lookalike workstreams → the
Bosch/STMicro confusion).

| # | Artifact (template) | Where it goes | Tool / command |
|---|---|---|---|
| 1.1 | **company_profile** of the manifest — taxonomy (`project_tiers`, `category_rules`, `subfolder_convention`, `non_card_subfolders`), `vocab` (tier_scale, phase_enum, verticals, edge_types, node_kinds, status_enum), `excludes`, `catalog_profile`, `brand`, `cadence`, `storage_profile`. Author from the Standards templates — fill the values, don't restate the rule shapes. | `manifest.json` → `company_profile` | hand-author against `__Framework/tooling/config.schema.json`; copy structure from `__Framework/tooling/manifest.mot.json` |
| 1.2 | **entity registry** (people→roles seed; companies derivable from folder names) | `manifest.json` → `company_profile.entity_registry` | fill `__Framework/templates/registries/entity-registry.template.json`, drop the `_examples` key, paste in |
| 1.3 | **context registry** (every confusable workstream: tag + owner + reciprocal `difference` note on each sibling) | `manifest.json` → `company_profile.context_registry` | fill `__Framework/templates/registries/context-registry.template.json`, drop `x-examples`, paste in |
| 1.4 | **person_profile** — for a teammate instance, copy `company_profile` verbatim as the shared seed, then run the focus-detector to fill `person_profile.focus`; for a new company, fill the identity block by hand | `manifest.json` → `person_profile` | `node __Framework/tooling/kb-focus.mjs manifest.json graph-index.json` (teammate only; the manifest-driven detector — reads what dominates the person's Drive) |

- **GATE (A — the single most important gate):** **approve the proposed taxonomy + both registries.**
  Everything downstream is built on this. Greenfield has no legacy content to validate the taxonomy
  against, so over-invest here: walk the company's real business lanes into `verticals`/`project_tiers`,
  and register **every** confusable workstream pair now — registering later means a fork already landed
  unlabelled (exactly the drift the Phase 9 sensor catches).
- **Note:** the registries are seeded **first** on purpose — every later reasoning module needs a
  resolved entity space and a confusable map to check against. Companies need only a row when the folder
  name can't carry the fact (an alias, a role, the canonical `Overview.md` path).

---

## Phase 2 — Data-model bootstrap

Lock the frontmatter node/edge schema + the freshness axis so the B-tools have a stable target.

| # | Artifact (template) | Tool / command |
|---|---|---|
| 2.1 | **frontmatter_schema** in the manifest — `required_fields` (`description`, `references`), `optional_fields` (tier/phase/vertical/node_kind/supply_chain_role/status/context/valid_as_of/agent_read…), `tldr_keys.canonical` + `date_anchored_key`, `avoid_read_marker` | fill `manifest.json` → `company_profile.frontmatter_schema`, guided by `__Framework/templates/data-model/frontmatter-fields.template.md` (the field-by-field table) + `data-model.template.md` |
| 2.2 | **graph-wiring + lifecycle + quality Standards** — the written contracts the schema enforces (typed `references[]` vocab, define-once, containment-free; status/freshness; TL;DR-card) | copy `__Framework/templates/standards/{graph-wiring,lifecycle,quality}.template.md` into the instance governance folder; resolve every `{company-slot}` from the manifest |
| 2.3 | **validate the manifest** against the schema | validate `manifest.json` against `__Framework/tooling/config.schema.json` (any JSON-Schema 2020-12 validator) — **must pass before Phase 3** |

- **Gate:** none if templates are filled mechanically from the manifest. Escalate to **A** only for a
  *genuinely novel* schema choice (a new axis the eight Standards templates don't cover).

---

## Phase 3 — Tooling stand-up *(before any content — pointed at the manifest)*

Stand up the B-library against the empty Drive so the very first file is validated and every index
regenerates from day one. Each tool is a **pure function of the manifest** — wiring is passing
`manifest.json`, not editing code.

| # | B-tool | Command (greenfield: runs clean against the empty tree) | Produces |
|---|---|---|---|
| 3.1 | **kb-index** — frontmatter graph indexer | `node __Framework/tooling/kb-index.mjs "$MANIFEST" --out graph-index.json` | `graph-index.json` (nodes + containment + references + counts) |
| 3.2 | **kb-walk** — per-folder `_catalog.md` generator (generalized `mot-walker`) | `node __Framework/tooling/kb-walk.mjs "$MANIFEST"` | catalogs (validation-mode here; writes live catalogs once content lands via the sync skill) |
| 3.3 | **kb-extract** — TL;DR entity-card extractor | `node __Framework/tooling/kb-extract.mjs "$MANIFEST" --out data/projects.json` | `projects.json` (empty until Overviews exist — expected) |
| 3.4 | **kb-entities** — entity-registry generator (people SOT + folder-derived companies) | `node __Framework/tooling/kb-entities.mjs "$MANIFEST" --graph graph-index.json` | `entities.json` (people from the seed; companies fill in as folders appear) |
| 3.5 | **kb-audit** — drift auditor / ref validator | `node __Framework/tooling/kb-audit.mjs "$MANIFEST" --out data/drift.json --json` | `drift.json` — **must be clean** on the empty Drive |

- **Gate:** none.
- **Greenfield advantage made concrete:** the validator + indexer + walker exist **before** the first
  content load — inverting the original's mistake of writing the ref-validator only *after* a reorg broke
  ~170 refs. On greenfield there is no debt for them to find; their job is to keep it that way.
- Run `kb-index → kb-audit` once now and confirm a clean, empty graph. That clean baseline is the
  setpoint the Phase 9 loop reconciles against.

---

## Phase 4 — Content migration *(SKIPPED — greenfield has no legacy content)*

- **Do nothing.** There is no messy tree to migrate, no `rename_map.json`, no `_superseded/` parking, no
  two-gate move procedure. The migration kit (`__Framework/migration/`) is the brownfield tool and is not
  invoked here.
- **Instead, content enters correctly placed** through the Phase 6 skills: the ingest adapter + the
  periodic-sync orchestrator port every new file to its `{placement-rules}` destination with frontmatter
  already attached. *Correct-by-construction replaces migrate-then-clean-up.*
- **Operator check:** confirm you are not silently sitting on a pile of pre-existing files. If you are,
  you mis-classified at Phase 0 — switch to the brownfield runbook and run the gated migration.

---

## Phase 5 — Instruction layer

Write the static root agent file + nested per-folder rule files now that the structure is settled.

| # | Artifact (template) | Tool / command | Gate |
|---|---|---|---|
| 5.1 | **root `AGENT.md`** — classify-before-reading routing table + three autonomy tiers + avoid-read + superseded/legacy conventions; index/people/CLI/triggers are `{company-slot}` | render `__Framework/templates/instruction/root-AGENT.template.md`, binding each `{slot}` to its manifest field (project index + people table emitted by kb-extract/kb-entities, not hand-kept) | — |
| 5.2 | **nested rule file per folder that needs one** — leaf folders get Purpose + Navigation only; an ambiguity-prone / active folder adds the guardrail + dated current-position blocks (disambiguation **generated from `context_registry`**, never from memory) | render `__Framework/templates/instruction/nested-rule-file.template.md` per folder | — |
| 5.3 | **validate parentage** — every nested file encodes parentage **once** (a frontmatter edge, not a prose "Parent:" line) and registers in the graph | `node __Framework/tooling/kb-index.mjs "$MANIFEST"` then `node __Framework/tooling/kb-audit.mjs "$MANIFEST"` — green | A only if a violation is structural |

- **Idealization (apply from day one — greenfield can't inherit the scar):** do **not** overload one
  filename across genres. Keep the router, operating-manuals, template how-tos, and status cards as
  distinct, clearly-named files. The original collapsed all of these into one `CLAUDE.md`; a greenfield
  Drive has no reason to repeat it.

---

## Phase 6 — Skills / workflows *(the actuators that keep content correct-by-construction)*

Build the periodic-sync orchestrator + its ingest adapter, thin over the Standards. The Phase-0
`dominant input` answer picks which ingest adapter ships **first**.

| # | Artifact (template) | Generalizes | Notes |
|---|---|---|---|
| 6.1 | **periodic-sync orchestrator** — ingest → per-thread/meeting summaries → port by placement rules → refresh per-entity overviews → two-audience roll-up + QA → to-dos → **regenerate every derived index** | `mot-sync` | `__Framework/templates/skills/periodic-sync.template.md`; ends by re-running kb-walk + kb-index + kb-extract + kb-entities + kb-audit |
| 6.2 | **ingest adapter (ship first per dominant-input)** — email (flat-export or mail-API), or meeting-ingest (transcript+frames → speaker-ID'd summary). Source paths/URLs/junk-globs come from `input_adapters`, never hardcoded | `email-cleanup` / `video-process` | `__Framework/templates/skills/{ingest-cleanup,meeting-ingest}.template.md`; **bundle the transcription prerequisite as a real skill** — do not leave it an undocumented external seam |
| 6.3 | **drift-fix actuator** — read-only audit → dry-run → gated tier-1 auto-fix → tier-2/3 decision list → re-audit | `drift-fix` | `__Framework/templates/skills/drift-fix.template.md`; pairs with kb-audit as the Phase 9 sensor/actuator |

- **Gate:** none for instantiating; the actuators carry their own per-run autonomy tiers (annotate
  autonomous · restructure announce · destroy confirm).
- **Idealization:** parameterize everything — source paths, URLs, crop/junk values resolve from the
  manifest; a skill body that hardcodes a path is a bug. Keep skills thin (~1–2 screens); substance lives
  in the Standards they cite by `{standard-…}` slot.
- *(Phase 7 — dashboard — is optional and skipped unless a UI is wanted; agents + CLI consume
  `graph-index.json` directly.)*

---

## Phase 8 — Learnings loop activation

- **Artifact:** the shared, append-only, topic-scoped **Learnings log** (the instance's own
  `Learnings/<topic>.md`), started from day one.
- **Tool / cadence:** set a recurring **promotion review** that graduates stable learnings into Standards;
  surface an **unpromoted-learnings count** as a `STATE.md` attention flag (the generator computes it).
- **Gate:** none. Mechanize the graduation cadence now — the original described the arrow but never ran
  it, so lessons never reached the Standards.

---

## Phase 9 — Steady-state drift loop *(continuous; setup becomes operation here)*

Phases 1–5 run **once**; Phase 6 + 9 run **forever**. The loop reconciles the Drive against its setpoint
(manifest + Standards) without re-running setup.

- **Sensor (B, cheap, first):** `node __Framework/tooling/kb-audit.mjs "$MANIFEST" --out data/drift.json`
  on a schedule — missing frontmatter, unplaced files, stale `valid_as_of`, dead refs, placement-rule and
  enum violations. Escalate to **C** only for genuinely ambiguous drift (a *new* workstream vs a *renamed*
  existing one — the context-registry check).
- **Actuator (B skills):** the **drift-fix** skill on the drifted subtree (gated tier-1 auto-fixes only),
  the periodic sync, frontmatter backfill. Re-invoke the org skill on **just** the drifted subtree, not
  the whole Drive.
- **GATE (A):** only when a reconciliation move is **large *and* low-confidence**.
- A **re-baseline** (new vertical, acquisition, strategy shift) re-enters at **Phase 1**; ordinary drift
  stays inside Phase 9 with no human unless a gate trips.

---

## Acceptance checklist — the Drive is stood up when all pass

Run from the Drive root with the instance `$MANIFEST`:

- [ ] **Manifest validates** against `__Framework/tooling/config.schema.json` (required:
      `manifest_version`, `company_profile`, `person_profile`; `additionalProperties:false` — no stray keys).
- [ ] **Registries seeded:** `company_profile.entity_registry.people` non-empty; every confusable
      workstream has a `context_registry` entry with reciprocal `difference` notes.
- [ ] **kb-index runs clean:** `node __Framework/tooling/kb-index.mjs "$MANIFEST"` → `graph-index.json`
      builds with **0 errors**.
- [ ] **kb-audit clean:** `node __Framework/tooling/kb-audit.mjs "$MANIFEST" --json` reports **no
      high-severity findings** (no missing required frontmatter, no invalid reference type, no invalid
      status enum, no dead references, no placement/enum violations).
- [ ] **kb-entities** resolves the people seed and is ready to pick up folder-derived companies.
- [ ] **Instruction layer:** root `AGENT.md` rendered (no literal company values — all from the manifest);
      every nested rule file encodes parentage exactly once and registers in the graph.
- [ ] **Skills wired:** periodic-sync + the first ingest adapter present, manifest-parameterized, ending
      in a full index regenerate; drift-fix paired with kb-audit.
- [ ] **Loop armed:** kb-audit on a schedule (sensor) + drift-fix available (actuator) + Learnings log
      open with an unpromoted-count `STATE.md` flag.
- [ ] **Phase 4 confirmed N/A:** no legacy content was migrated because none existed — content enters via
      the Phase 6 skills, correct-by-construction.

When every box is checked, initial convergence is done: the manifest is the setpoint, the skills are the
actuators, kb-audit is the sensor, and the Drive runs on the Phase 9 loop.
