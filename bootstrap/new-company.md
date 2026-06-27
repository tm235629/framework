---
description: The operator runbook for standing up a knowledge-OS on a DIFFERENT COMPANY — a full re-derivation of every company-slot from the templates, run as a concrete checklist over SETUP_SEQUENCE's phases. Only the mechanism transfers; the index/people/vocab the mechanism points into are re-derived.
references:
  - path: __Framework/bootstrap/SETUP_SEQUENCE.md
    type: builds-on
    note: This is the operator instantiation of that phased pipeline — same Phase 0–9 order, NEW-COMPANY branch (run all phases, re-derive every slot).
  - path: __Framework/ARCHITECTURE.md
    type: related
    note: §2 (mechanism vs company-slot) and §11 (federation) are the line this runbook draws between verbatim-reusable and re-derived.
  - path: __Framework/tooling/config.schema.json
    type: standard
    note: The manifest schema this runbook fills from scratch (company_profile fully re-authored; person_profile per the first operator).
  - path: __Framework/templates/README.md
    type: related
    note: The {company-slot} marker library every step here renders against the new company's manifest.
  - path: __Framework/migration/PLAYBOOK.md
    type: long-form
    note: Phase 4 (brownfield) executes this gated reversible kit; greenfield skips it.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Runbook — stand up a DIFFERENT COMPANY (full re-derivation)

You are pointing the framework at a company that is **not MetaOptics** — **the reference instance
("Instance Zero")** this framework was extracted from. The entry bifurcation (SETUP_SEQUENCE "Top-level
bifurcations") is **NEW COMPANY**: run *all* phases, and **re-derive every company-slot**. Nothing about
the reference instance's business — its verticals, its supply-chain vocabulary, its partner list, its
brand — carries over. What carries over is the **shape**: the routing logic, the B/C/A ladder,
the data-model contract, and the B-tool code. This runbook is the concrete checklist for that.

> **The one rule that governs the whole run:** *mechanism transfers; company-slot is re-derived.* If you
> find yourself copying a reference-instance **value** (a vertical name, an edge type like
> `tests-with`/`substrate` *(reference-instance examples — do not transfer)*, a person, a context tag, a
> folder tier) into the new company, stop — that is a slot to re-derive, not a mechanism to reuse. The
> supply-chain words are reference-instance-only. (ARCHITECTURE §2.)

This is the **NEW COMPANY** path, distinct from the **TEAMMATE** path (same company → copy
`company_profile` verbatim, only run the focus-detector for `person_profile`). Here you author
`company_profile` from a blank sheet.

---

## What is verbatim-reusable vs re-derived

Decide this once, up front — it tells you what to *copy* and what to *re-author*.

| Layer | **Verbatim-reusable (mechanism)** | **Re-derived (the slots it points into)** |
|---|---|---|
| **Instruction / routing** | the routing-table **rows** (request archetype → read-set + do-not-read-set), the **three autonomy tiers**, the avoid-read + superseded/legacy conventions, the section skeleton of a nested rule file | the index/people/CLI/skill-trigger tables the rows point *into*; every project, person, standard citation, context-disambiguation term |
| **Data-model** | the frontmatter node/edge **contract** (required `description`+`references`, containment-is-free, define-each-edge-once, TL;DR-head digest, freshness axis) | the **edge-type vocabulary**, `status_enum`, `node_kinds`, the tier/phase/vertical enums, the TL;DR canonical keys |
| **Tooling (B-library)** | **all of `tooling/kb-*.mjs` and the `migration/*.mjs` kit, unchanged** — they are pure functions of the manifest; no per-instance code edit | only `manifest.json` (the values they read) |
| **Skills / workflows** | the orchestrator control-flow (`templates/skills/*`): ingest→summarize→port→refresh→roll-up+QA→to-dos→regen; the safe-janitor; the drift-fix tiers | every `{company-slot}`: placement rules, content schema, cadence, adapters, tool wiring |
| **Standards** | the *numbered, cross-linking, non-duplicating* structure of each `templates/standards/*` doc | every clause body — placement tiers, lifecycle states, quality bars, the sync content schema |

**Net:** you re-author **`company_profile` end-to-end**, you **reuse all tool code**, and you **render**
the templates (instruction / standards / skills) against the new manifest. The expensive part is C
inference into the manifest; once the manifest is filled, the B-tools just run.

---

## Phase 0 — Discovery & inventory *(read-only)*

- [ ] Confirm the new Drive's **absolute root** and **`storage_profile.kind`** — *synced_cloud* (OneDrive/
      Dropbox/SharePoint) vs *local/git*. **This decision toggles the churn/lock guards** in every B-tool:
      `synced_cloud` ⇒ `churn_guards`/`lock_guards` **on** (incremental + content-equality no-op writes,
      tmp-rename swaps, EBUSY/EPERM retry); `local`/`git` ⇒ those guards off (clean atomic writes). Set
      `storage_profile.{kind,platform,root,churn_guards,lock_guards}` accordingly.
- [ ] Walk the tree to `inventory.json` (path + sha1 + size + type) — for a messy Drive run the kit's
      **`migration/inventory.mjs`** (read-only; it writes only under `_validation/` until a real run).
- [ ] **Classify the corpus** (C): greenfield (near-empty → skip Phase 4) vs brownfield (messy → Phase 4),
      and the **dominant input** (email-heavy / meeting-heavy / doc-dump → picks which ingest adapter ships
      first in Phase 6).
- [ ] No gate (read-only).

## Phase 1 — Taxonomy & registry design *(decide-first; the load-bearing gate)*

Re-author the **company slots** — *do not* reuse MOT's. Fill these manifest sections:

- [ ] **`company`** — `name`, `domain` (the domain is how ingest tells internal vs external senders).
- [ ] **`taxonomy.project_tiers`** — the new company's *own* top-level folder tiers + purpose + which bear
      an **entity card** (`entity_card:true`). MOT's Aquisition/Internal/Collaboration/Sales/Documentation/
      Archive split is one company's answer; a different business may have e.g. Clients/Programs/Vendors/
      Archive. Re-derive from *their* real business lanes.
- [ ] **`taxonomy.category_rules`** — ordered first-match path→category rules (lifecycle folders
      `_superseded/legacy/Archive` match *before* location). Include the trailing first-segment catch-alls
      for the project/operations roots (the kb-index validation REPORT GAP-2 — add them or one node
      mis-categorizes).
- [ ] **`taxonomy.subfolder_convention`** + **`non_card_subfolders`** — their canonical attachment
      destinations and their deep-technical working folders (so kb-extract doesn't card an Overview inside
      a working subtree).
- [ ] **`vocab`** — the heart of the re-derivation:
  - `tier_scale` (min/max + labels), `phase_enum`, `verticals` — **their product lanes, not MOT's
    Equipment/Foundry/Products/AI.**
  - **`edge_types.valid`** — a **new domain edge-type cluster**. The relationship verbs are
    company-specific: the reference instance's `customer/supplies/tests-with/assembles/integrates-with/
    substrate/pairs-with/researches` *(reference-instance examples — do not transfer)* describe an optics
    supply chain and **do not transfer**. Keep only the *structural*,
    domain-neutral edges the mechanism needs (`related`, `sibling`, `references`, `superseded_by`/
    `supersedes`, `builds-on`, `tool`, `source`, `topic`, `governs`, `standard`, `convention`) and
    **re-derive the domain cluster** from the new company's relationships. List discouraged synonyms under
    `edge_types.legacy`, and document-flow types under `edge_types.provenance`.
  - `node_kinds`, `status_enum`, `supply_chain_roles` — re-derive (the role enum especially is MOT-shaped;
    a new domain may have no "fabricator"/"substrate" at all).
- [ ] **`frontmatter_schema`** — `required_fields` (keep `description`+`references` — that *is* mechanism),
      `optional_fields`, and **`tldr_keys.canonical`** + `date_anchored_key` (their TL;DR card slots), plus
      the `avoid_read_marker` convention.
- [ ] **Seed `entity_registry.people`** — the first artifact, the SOT MOT never built standalone. People →
      email → role, `internal:true` for own-company staff. Companies derive from the project folders, so
      only the people seed is mandatory.
- [ ] **Seed `context_registry`** — confusable-workstream guardrails for *their* lookalike projects
      (each: `tag`, `what`, `owner` or `owner:null`+`owner_note`, and `related[]` with the load-bearing
      `difference` note). MOT's Bosch/STMicro/Elsoft-tester entries are examples of the *shape*, not
      content — re-derive from the new company's real confusables.
- [ ] **GATE (A) — approve the proposed taxonomy + registries.** This is the single most important gate;
      everything downstream binds to it. Do not proceed until the operator signs off the vocab, tiers, and
      both registries.

## Phase 2 — Data-model bootstrap

- [ ] **Render the Standards** from `templates/standards/*` against the approved manifest — fill
      `placement`, `lifecycle`, `quality`, `style`, `info-distribution`, `input-format`, `output-schema`,
      `graph-wiring` with **only the company slots**. The *numbered, cross-linking, non-duplicating
      structure* is mechanism; every clause body is re-derived.
- [ ] Confirm the frontmatter schema + TL;DR-head key set are emitted into the manifest (Phase 1 did this);
      `tooling/config.schema.json` validates it.
- [ ] Gate only on a genuinely novel schema choice (e.g. a new `node_kind` the templates don't anticipate).

## Phase 3 — Tooling stand-up *(BEFORE any bulk migration)*

Stand the B-library up against the new manifest **first**, so moves are validated and indexes regenerate
from day one (inverting MOT's "validator written only after a reorg broke ~170 refs").

- [ ] **Vendor the parser** — the `kb-*.mjs` tools currently borrow gray-matter from MOT's
      `Dashboard/node_modules`. For a real deployment, vendor gray-matter (or a small YAML parser) into the
      new instance's `tooling/` so the B-library has **no dependency on MOT's tree**. (Header note in
      `kb-index.mjs`.)
- [ ] Point each tool at the **new `manifest.json`** (every `kb-*.mjs` takes `[manifestPath]` as its first
      arg; default is MOT's — override it). No code edits.
  - `kb-index.mjs` → `graph-index.json` (frontmatter graph; pure function of the manifest).
  - `kb-walk.mjs` → per-folder `_catalog.md` generator (the generalized mot-walker; applies
    `excludes.skip_names`/`skip_exts`).
  - `kb-extract.mjs` → entity / TL;DR-card JSON (the project tiles).
  - `kb-audit.mjs` → `drift.json` (the standing drift sensor — Phase 9).
  - `kb-entities.mjs` → `entities.json` (people + company registry from the manifest + graph).
- [ ] **Verify against the empty/early Drive** — run `kb-index` + `kb-audit` and confirm they execute
      cleanly on the new manifest before any content lands. Wire the **excludes as a single source** the
      tools read (don't re-create MOT's triplicated excludes drift).

## Phase 4 — Content migration *(brownfield ONLY — greenfield skips this entire phase)*

> **Branch here on Phase 0's classification.** *Greenfield* (near-empty Drive): **skip Phase 4 entirely** —
> content arrives correctly placed via the Phase 6 ingest skills, no migration needed. *Brownfield* (messy
> existing Drive): run the gated reversible kit below.

- [ ] Add **`company_profile.migration_profile`** to the manifest — `scan_roots` (the subtree being
      restructured), `target_layout`, `filename_template`, `metadata_sources` ladder. (Optional section;
      tools fall back to `taxonomy`/`catalog_profile` defaults if absent.)
- [ ] **Phase 1 — `migration/inventory.mjs`** → `inventory.json` (sha1 + size + type + exact/near-dup
      groups). Read-only.
- [ ] **GATE 1 (A)** — approve the target shape (layout, taxonomy→`categories[]`, filename grammar,
      duplicate handling: survivors kept, surplus *parked* never deleted).
- [ ] (C, optional) resolve authoritative per-file metadata along the `metadata_sources` ladder →
      `--metadata` sidecar.
- [ ] **Phase 2 — `migration/plan-renames.mjs`** → `rename_map.json` (`moves[]` + `superseded[]` +
      `needs_review` + `destination_clashes`). Propose-only.
- [ ] **GATE 2 (A)** — review the exact plan; block on every clash + every `needs_review`.
- [ ] **Phase 3 — `migration/apply-moves.mjs --apply`** → `executed_moves.json` (reverse-replayable
      rollback). The **MOT-root interlock** in `apply-moves.mjs` hard-refuses `--apply` on the MOT marker —
      a non-MOT Drive passes the interlock (set `MIGRATION_TARGET_IS_NOT_MOT=1` + `--i-understand` per the
      Safety contract). Default is dry-run.
- [ ] **Verify** — re-inventory; counts reconcile; surplus dups under `_superseded/`; then write sidecars
      and refresh catalogs/graph with the **instance's own** `kb-walk` + `kb-index`.

## Phase 5 — Instruction layer

- [ ] **Render the root `AGENT.md`** from `templates/instruction/root-AGENT.template.md` — the **routing
      table ROWS are verbatim-reusable**; the **index / people / CLI / skill-trigger tables they point into
      are re-derived** (emitted by `kb-extract` + `kb-entities`, not hand-maintained). Copy the three
      autonomy tiers and the avoid-read + superseded/legacy conventions unchanged.
- [ ] **Render a nested rule file per folder** that needs one from `nested-rule-file.template.md` — leaf
      folders get Purpose + Navigation only; ambiguity-prone or active-development folders add the
      **disambiguation block generated from `context_registry`** (never authored from memory) and a dated
      current-position block.
- [ ] **Validate** every nested file has *one* parentage encoding (a frontmatter edge, not a prose
      "Parent:" line) and registers in the graph. **Do not overload one filename across genres** — split
      router / operating-manual / template-how-to / status-card into clearly-named files (the MOT
      `CLAUDE.md`-is-six-things scar).

## Phase 6 — Skills / workflows

- [ ] **Render the periodic-sync orchestrator** from `templates/skills/periodic-sync.template.md` — wire
      every `{company-slot}` to the new manifest + Standards; **do not edit the control-flow**.
- [ ] **Wire the input adapter** Phase 0 selected first (`input_adapters.email` or `.transcription`). Prefer
      a proper mail/calendar API adapter over a flat export; **bundle the transcription prerequisite as a
      real skill** if meeting-heavy (MOT left it an undocumented external seam).
- [ ] Render `ingest-cleanup`, `meeting-ingest`, `drift-fix` from the skill templates. Keep them thin;
      substance stays in Standards (cite, don't inline). End every skill by **regenerating every derived
      index** (markdown stays source of truth).
- [ ] **Drop or rewrite the niche helpers.** `clip` (cut web-efficient looping clips from MOT source video
      for the website) and `web-qa` (drive `metaoptics.sg` in a browser) are **MOT company-product
      utilities, not knowledge-OS mechanism** — they are *not* in the reusable skill library. For the new
      company: **drop them** unless that company has the same need, in which case **rewrite from scratch**
      against its own product/site (new target URL in `brand.web_qa_target`, new source-media conventions).
      Do not port the MOT versions.

## Phase 7 — Dashboard *(optional projection UI)*

- [ ] **Skip entirely if no UI is wanted** — agents + CLI consume `graph-index.json` directly. If wanted:
      re-theme from **`brand`** (`accent`, `accent_variants`, `fonts`, `pdf_footer`, `web_qa_target`),
      re-point the root, regenerate categorization config. Markdown stays SOT; all JSON/PDF/catalogs are
      regenerable.

## Phase 8 — Learnings loop activation

- [ ] Start the instance's own append-only, topic-scoped Learnings log (separate from
      `__Framework/Learnings/`). Set a recurring **promotion review** that graduates stable learnings into
      Standards, and surface an **unpromoted-learnings count** as a STATE attention flag (MOT described the
      graduation arrow but never mechanized the cadence).

## Phase 9 — Steady-state drift loop *(continuous — setup becomes operation)*

- [ ] Turn on the **drift sensors**: schedule `kb-audit.mjs` → `drift.json` (missing frontmatter, unplaced
      files, stale `valid_as_of`, dead refs, placement-rule violations).
- [ ] Wire the **actuator**: the `drift-fix` skill (read-only audit → dry-run → gated tier-1 auto-fix →
      tier-2/3 decision list → re-audit) + the periodic sync.
- [ ] Confirm Phases 1–5 are now **one-time** (re-run only on a re-baseline: acquisition, new vertical,
      major strategy shift → re-enter at Phase 1). Phases 6 + 9 run **forever**.

---

## Acceptance checklist (the run is done when…)

- [ ] `company_profile` is **fully re-authored** — zero MOT values survive (no MOT vertical, no MOT
      supply-chain edge type, no MOT person, no MOT context tag, no MOT folder tier).
- [ ] `manifest.json` **validates** against `tooling/config.schema.json`.
- [ ] **Both registries seeded**: `entity_registry.people` and `context_registry` reflect the new company.
- [ ] `storage_profile.kind` is set and the **churn/lock guards match it** (synced_cloud → on; local/git →
      off).
- [ ] **All `kb-*.mjs` tools run against the new manifest with no code edits** and a vendored parser (no
      dependency on MOT's `node_modules`).
- [ ] **Greenfield:** Phase 4 was skipped. **Brownfield:** the migration ran through both gates and
      `executed_moves.json` exists (rollback-able); surplus dups are in `_superseded/`, nothing deleted.
- [ ] Root `AGENT.md` rendered with **reused routing rows + autonomy tiers** over **re-derived** index/
      people/CLI tables; nested rule files each have one parentage encoding and a `context_registry`-
      generated disambiguation block where needed.
- [ ] Periodic-sync + ingest/cleanup/QA skills wired to the new manifest; **`clip`/`web-qa` dropped or
      rewritten**, not ported.
- [ ] `kb-audit` runs green (or its findings are triaged); the drift loop (sensor + actuator) is scheduled.
- [ ] Learnings log live with a promotion cadence; an unpromoted-learnings flag surfaces in STATE.
- [ ] Every `.md` authored in the run carries `description` + typed `references` (the **new** company's
      valid edge vocab only; containment is free, never `parent`/`child`; define each edge once).
