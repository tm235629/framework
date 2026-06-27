---
description: The framework's OWN learning journal — meta-lessons about replicating the knowledge-OS, distinct from MOT's operational Learnings. Stable entries graduate into the framework templates.
references:
  - path: __Operations/Documentation/Learnings
    type: related
    note: Generalizes — same contract as MOT's operational Learnings loop, scoped to framework/replication lessons rather than MOT operations.
status: draft
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Framework Learnings

> **Note:** entries below cite the reference instance (MetaOptics / "Instance Zero") in their **What:**
> evidence — the named artifacts (check-refs.mjs, the Bosch/STMicro and I2R/MetaAI tangles, mot-tools.js)
> are that instance's, kept as the load-bearing proof. The **Apply:** line is the general rule that
> transfers to the next instance.

Meta-lessons about **building and replicating the knowledge-OS**, captured as we co-develop with MOT
(Instance Zero). Distinct from `__Operations/Documentation/Learnings/`, which holds MOT's *operational*
lessons. A lesson here is *general* — it should change how the **next instance** is built. When stable, it
**graduates into `__Framework/templates/`**.

## Contract (same shape as MOT's)
- One file per **topic**, not per session. This README seeds the index; topic files are added beside it.
- Each entry ≤3 lines: **date** / **What:** the concrete proof (name the file/command/decision) / **Apply:**
  the action it changes next time.
- Qualification gate: *if it won't change how the next instance is built, it isn't a framework learning.*
- Cap 2–3 per session. Promotion review: monthly (see DECISIONS O6).

## Topics (seeded from the MOT analysis, 2026-06-21)

### replication-order
- 2026-06-21 — **What:** MOT was built content-first, then needed two Drive-wide reorg waves
  (Structural_Review_2026-05, MOT_Internal_Restructure_2026-06) to retrofit schema/placement/lifecycle.
  **Apply:** in the framework, design data-model + Standards + tooling *before* any content load
  (SETUP_SEQUENCE Phases 1–3 precede Phase 4).

### tooling-before-moves
- 2026-06-21 — **What:** MOT wrote the dead-edge validator (`check-refs.mjs`) only *after* a reorg broke
  ~170 references. **Apply:** stand up the validator + indexer + walker in Phase 3, before the gated
  migration in Phase 4, so every move is validated as it happens.

### entity-registry-first
- 2026-06-21 — **What:** MOT never built a people→companies→roles registry; the result was recurring entity
  tangles (Bosch/STMicro confusion, I2R vs MetaAI). **Apply:** make the entity registry the *first* seeded
  artifact (Phase 1), before content references entities.

### single-source-of-truth
- 2026-06-21 — **What:** in MOT one fact lives in up to five places (status + valid_as_of + context +
  HTML-comment block + banner) and three stores (memory / Learnings / Standards), which drift.
  **Apply:** one knowledge home per fact; mechanize Learnings→Standards promotion rather than leaving it manual.

### drift-needs-sensors
- 2026-06-21 — **What:** MOT has actuators (mot-sync keeps derived state converged) but **no standing drift
  sensors** — nothing detects placement/frontmatter/freshness drift. **Apply:** every instance needs the
  sensor half of the control loop (SETUP_SEQUENCE Phase 9); build it on MOT first as the first co-dev slice.
- 2026-06-21 — **What:** built the sensor MVP on MOT (`mot-tools.js audit`); the *aggregation pattern*
  (re-export check-refs + stale into one drift surface) worked, and emitting `drift.json` beside the other
  derived JSON gave a free dashboard/serving path. **Apply:** in the template, always (a) exclude
  auto-generated/derived files (e.g. `_catalog.md`) from frontmatter-registration checks, and (b) give
  provenance refs (to intentionally-removed sources) a non-drift carve-out.

### focus-detection
- 2026-06-22 — **What:** validated the focus-detector on MOT (sandbox, read-only). v1 (file-depth +
  tier/vertical weight + context owner-subtree + reference-centrality + doc-kind) reproduced the manual
  focus exactly on verticals/tiers/doc-kinds, 4/5 contexts, 5/7 entities. **Apply:** ship v1-style
  *distribution* as the canonical detector — it is accurate for the real deployment (a PER-PERSON federated
  drive, where the whole drive IS the person, so company-vs-person ambiguity doesn't exist).
- 2026-06-22 — **What:** "hardening" v1 with single hard-exclude heuristics BACKFIRED: referrer-diversity
  exclude dropped Bosch (a tier-1 focus, merely widely-referenced); node_kind exclude dropped Elsoft
  (`product-parent` is both a hub AND the #1 focus), collapsing the Equipment vertical. **Apply:** never
  hard-exclude on a single structural signal — `product-parent`/high-in-degree are *both* hub-noise and
  focus-signal. Use structural signals as SOFT ensemble votes; the only clean disambiguator on a SHARED
  drive is a person-attribution channel (authorship/edit/meeting-email participation). Keep negative
  results (v2/v3 scripts) as the justification. Also: a registered context with `owner: null`
  (dlw-programme) is invisible to structure AND is itself a drift signal.

### manifest-validation
- 2026-06-22 — **What:** built generic manifest-driven tools (kb-index/extract/walk/audit) and validated each
  by REPRODUCING its hand-coded MOT counterpart from the manifest alone (100% / 100% / 49-50 byte-identical /
  99.8%). Every divergence was a precise manifest-expressiveness GAP, almost never a tool bug (skip_names
  needs per-tool scoping; tldr_keys.canonical is a required-subset not an allow-list; catalog_profile lives
  only in the C++ walker; supply_chain_roles enum doesn't cover live values). **Apply:** make
  "reproduce-the-instance-from-the-manifest-alone" the standard acceptance test for every B-tool — it
  simultaneously proves the manifest is a sufficient C→B contract and discovers exactly where it under/over-
  specifies. Treat each difference as a manifest gap first, a tool bug only after ruling that out.

### migration-kit
- 2026-06-22 — **What:** generalized MOT's one-off `__Literature/_migration` Python run into the
  manifest-driven `__Framework/migration/` kit (inventory.mjs / plan-renames.mjs / apply-moves.mjs +
  PLAYBOOK). Re-running the read-only `inventory.mjs` over today's `__Literature` reproduced the historical
  Phase-1 counts (459 PDFs · 26 exact-dup groups · 4 same-name groups — deltas = the 2 dups the original run
  already parked), validating the generalization the same "reproduce-from-manifest" way the B-library was.
  **Apply:** the migration kit is a B-tool family like the rest — accept it by reproducing the proven run's
  counts from the manifest; lift its one-off constants (scan scope, filename grammar, target layout) into a
  `migration_profile` manifest section, never into the tool logic.
- 2026-06-22 — **What:** for a destructive-capable tool living *inside* the live Drive, a single safety flag
  is not enough — used TWO independent interlocks: (1) a MOT-root marker check that hard-refuses `--apply`
  when the manifest root is the protected Drive, (2) dry-run default + validation-pinned, name-checked output
  artifacts. The planner also *flags* weak-metadata files rather than inventing values, pushing the judgement
  to a gate. **Apply:** any actuator shipped in the live tree needs a root-interlock (not just dry-run) so a
  reused command can't accidentally mutate the wrong Drive; and a planner should mark low-confidence rows
  `needs_review`, never silently guess — the gate consumes the flags.

### instance-readiness
- 2026-06-22 — **What:** before replicating, made MOT a clean reference instance via a read-only gap analysis
  (structural debt + metadata/registry coverage) → 13 gaps, 6 blockers, all closed. Two general lessons:
  (a) a **meta-layer living in the same Drive** (the framework itself) pollutes the *instance's* audit metrics
  and dashboard → exclude it via the instance's `excludes` (the framework audits itself on its OWN manifest);
  (b) the **entity registry was derivable all along** — companies from Overview frontmatter, people from one
  table — so "stand up the SOT" is a *generate*, not a re-author. **Apply:** (1) every instance must exclude the
  framework/meta tooling from its graph; (2) generate the entity registry (companies-from-frontmatter +
  people-from-one-source) rather than hand-building it; (3) treat a registered context with `owner:null` as a
  deliberate *sync-owned/not-yet-active* state (formalize with an `owner_note`), not a broken lookup.

### synced-drive-gotchas
- 2026-06-21 — **What:** on OneDrive, a reorg's catalog `--force` rewrites read as mass deletions; moves render
  as delete+create; B-tools need content-equality no-op writes + lock-safe tmp-rename. **Apply:** gate these
  behaviors on the manifest's `storage_profile = synced-cloud`; they're optional on local/git stores.
