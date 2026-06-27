---
description: The idealized phased pipeline for standing up a knowledge-OS on a messy Drive, expressed as a C-orchestrated decision tree of deterministic tools, reasoning modules, and human gates — plus the steady-state drift loop.
references:
  - path: __Framework/ARCHITECTURE.md
    type: builds-on
    note: Operationalizes the architecture.
status: draft
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Setup Sequence — the idealized pipeline (v0.1 draft)

This is the **C-orchestrated pipeline**: a decision tree that takes a (possibly messy) Drive to a
converged knowledge-OS, then hands off to a steady-state drift loop. It **idealizes** the actual path of
MetaOptics — **the reference instance ("Instance Zero")** this framework was extracted from — which was
content-first with two reorg waves of rework (see ARCHITECTURE §7). The single inversion that
drives every phase: **design the data-model + Standards + tooling *before* touching content.**

Each phase below names its **deterministic steps (B)**, its **reasoning modules (C)**, and its **gate (A)**
if any. The default posture is autonomous; A appears only where a decision is large *and* low-confidence.

## Top-level bifurcations (set once, at entry)

```
                              ┌─ TEAMMATE (same company) ── their OWN instance, SEEDED from shared company-
                              │                              invariants (verticals, partner registry); run
  who is this for? ───────────┤                              focus-detection (Phase 1) to adapt the person-
                              │                              profile; confidential data stays local; NOT a
                              │                              central source of truth.
                              └─ NEW COMPANY ────────────── run all phases; re-derive every company-slot.

                              ┌─ GREENFIELD (near-empty) ── skip Phase 4 (migration); content arrives
  starting state? ───────────┤                              correctly placed via Phase 6 skills.
                              └─ BROWNFIELD (messy) ─────── run Phase 0 audit + Phase 4 gated migration.

  dominant input? ──── email-heavy │ meeting-heavy │ doc-dump ── ship the matching ingest adapter first (Phase 6).
  storage? ─────────── synced-cloud (OneDrive/Dropbox) │ local/git ── toggles churn/lock guards in the B-tools.
```

> For **MOT (Instance Zero)** the path is: *brownfield, single-company, email-heavy, synced-cloud* —
> and most of Phases 1–3 already exist as working artifacts, so our near-term work is **extraction +
> the missing pieces** (notably the drift loop, Phase 9), not a from-scratch run.

---

## Phase 0 — Discovery & inventory  *(read-only)*
- **Goal:** measure before touching; decide greenfield vs brownfield.
- **B:** walk the tree → `inventory.json` (path + sha1 + size + type); a maintenance-audit pass ranks
  debt (duplicate folders, orphan stubs, conflict files, naming variants).
- **C:** classify the corpus (greenfield/brownfield, dominant input type) from the inventory.
- **A:** none (read-only).

## Phase 1 — Taxonomy & registry design  *(decide-first)*
- **Goal:** author the placement contract, the tier/phase/vertical vocabulary, the context registry,
  and **seed the entity registry — before any content moves.** (The registry is the SOT MOT never built.)
- **C:** infer a candidate taxonomy from the debt report + the company's real business lanes; propose
  tiers, verticals, and the domain edge-type cluster; resolve confusable workstreams into context entries.
- **C (focus-detection):** for a teammate/person instance, infer their *focus* from what dominates their
  Drive (entity types, document kinds, cadence) and adapt the manifest's **person-profile** — seeding the
  shared company-invariants but adding focus-specific entities (e.g. a CFO's banks/compliance bodies) the
  shared seed omits. The company-profile is read-only seed; the person-profile is owned locally.
- **A — GATE:** *approve the proposed taxonomy + registries.* This is the single most important gate;
  everything downstream is built on it.
- **B:** write the approved vocabularies into the manifest.

## Phase 2 — Data-model bootstrap
- **Goal:** lock the frontmatter node/edge schema + the freshness axis as written Standards, so tooling
  has a stable target.
- **C:** fill the Standards templates (graph schema, lifecycle, quality, style, info-distribution,
  input-format spec, output content-schema) with only the company slots.
- **B:** emit the frontmatter schema + TL;DR-head key set into the manifest / `config.schema.json`.
- **A:** none if templates are filled mechanically; gate only on genuinely novel schema choices.

## Phase 3 — Tooling stand-up  *(BEFORE bulk migration)*
- **Goal:** stand up the validator + indexer + walker + STATE summarizer *first*, so moves are validated
  and indexes regenerate from day one (the opposite of MOT building the ref-validator only after moves
  broke ~170 refs).
- **B:** point the parameterized B-library at the manifest (root via env var, excludes/categories from the
  single config — no hand-mirrored copies); compile/verify each tool against the empty/early Drive.
- **C:** none.

## Phase 4 — Content migration  *(brownfield only; scripted, gated, reversible)*
- **Goal:** bring messy content under the contract via the database-first reversible pattern, never
  heuristic-port-then-clean-up-twice.
- **C:** propose `rename_map.json` (old→new placement) from `inventory.json` + the taxonomy; flag dups.
- **A — GATE:** *approve the rename_map* (and, for large/multi-tree drives, approve per destructiveness
  tier: annotate → light → heavy, verifying between batches).
- **B:** execute → `executed_moves.json`; write frontmatter sidecars; park dups in `_superseded/`;
  rewrite refs; regenerate catalogs; run the validator (must be green) + an adversarial content pass.

## Phase 5 — Instruction layer
- **Goal:** write the static root `AGENT.md` (classify-before-reading routing table + autonomy tiers +
  avoid-read/superseded conventions + project/people indexes) and the nested per-folder rule files, now
  that the structure is stable.
- **C:** generate the routing rows + nested rule files on the body template from the settled structure.
- **B:** validate every nested file has one parentage encoding (frontmatter edge, not a prose "Parent:"
  line) and registers in the graph.
- **Idealization:** do **not** overload one filename across genres — split operating-manuals / template
  how-tos / status cards into clearly-named files.

## Phase 6 — Skills / workflows
- **Goal:** build the periodic-sync orchestrator + ingest/cleanup/QA sub-skills, thin over Standards, each
  ending by regenerating every derived index.
- **C/B:** instantiate the orchestrator template; wire the input adapter (Phase 0's dominant-input answer
  picks which ships first); **bundle the transcription prerequisite as a real skill** (MOT left it an
  undocumented external seam).
- **Idealization:** parameterize — source paths, URLs, crop values come from the manifest, never hardcoded
  in skill bodies.

## Phase 7 — Dashboard  *(optional projection UI)*
- **Goal:** serve the derived JSON + one content-keyed write-back overlay, only if a visual UI is wanted.
- **B:** re-theme + re-point root + regenerate categorization config; agents + CLI consume
  `graph-index.json` directly without it. Skip entirely if no UI is needed.

## Phase 8 — Learnings loop activation
- **Goal:** turn on self-improvement from day one, with a **concrete promotion cadence** (MOT described
  the graduation arrow but never mechanized it).
- **B/C:** start the shared Learnings log; set a recurring promotion review that graduates stable learnings
  into Standards; surface an *unpromoted-learnings count* as a STATE.md attention flag.

## Phase 9 — Steady-state drift loop  *(continuous; the piece MOT lacks)*
- **Goal:** keep the Drive converged on its setpoint without re-running setup.
- **B (sensors):** standing drift auditors over `graph-index.json` — missing frontmatter, unplaced files,
  stale `valid_as_of`, dead refs, placement-rule violations.
- **C (sensor, escalated):** judge only ambiguous drift (new workstream vs renamed existing one).
- **B (actuators):** re-invoke the file-tree organization skill on the drifted subtree; run the periodic
  sync; backfill frontmatter.
- **A — GATE:** only when a reconciliation move is large *and* low-confidence.
- This phase is where setup becomes operation: Phases 1–5 ideally run **once**; Phase 6/9 run **forever**.

---

## Reading this as a controller, not a checklist

Phases 0–5 are the **initial convergence** (C-heavy, gated). Phases 6 + 9 are **steady-state operation**
(B-heavy, autonomous). The manifest produced in 0–5 is the setpoint the loop in 9 reconciles against. A
*re-baseline* (major strategy shift, acquisition, new vertical) re-enters at Phase 1; ordinary drift is
handled entirely within Phase 9 without a human unless a gate trips.
