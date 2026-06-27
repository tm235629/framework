---
description: Living decision log for the replication framework — what's been decided, what's open, and the recommended default for each open choice. This is where the design's learning process is recorded.
references:
  - path: __Framework/ARCHITECTURE.md
    type: related
    note: Decisions refine the architecture.
status: draft
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Framework Decision Log

> **Note:** entries below cite the reference instance ("Instance Zero" = MetaOptics / MOT) by its real
> names and artifacts — the *decisions* themselves are general. The named artifacts (Bosch/STMicro,
> check-refs, I2R/MetaAI, mot-sync, broken-refs history) are kept verbatim as load-bearing provenance.

Append-only-ish: when an OPEN item is resolved, mark it DECIDED with the date and rationale; don't delete
the history. Each open item carries a **recommended default** so the framework can proceed even without a
ruling (minimize-A applies to our own process too).

## Decided

| # | Decision | Resolution | Date |
|---|----------|------------|------|
| D1 | Which "product" do we build? | **B + C, with C as the core; A shrunk to a gate.** Determinism-first: push every decision to the lowest viable rung (B→C→A). | 2026-06-21 |
| D2 | Where does the framework live? | New **top-level `__Framework/`** folder, peer of `__Projects`/`__Operations`/`__shared`. Kept separate from MOT's `Standards/` instance so mechanism ≠ filled-in content. | 2026-06-21 |
| D3 | The C→B contract | A **manifest** (`manifest.json`, validated by `tooling/config.schema.json`). C's durable output is the manifest + a reviewable change-plan; B tools are pure functions of the manifest. | 2026-06-21 |
| D4 | Is C one-shot? | **No.** C also ships recurring + drift-triggered skills. The system is a closed-loop controller (setpoint = manifest+Standards, sensors = drift auditors, actuators = org/sync skills). | 2026-06-21 |
| D5 | Build posture | **Loose learning link with MOT** — when a *new, additive* capability helps both, build it on MOT first (improving it), then extract to templates. Learn both ways, but **do not rewrite MOT's working tooling**; extract abstractions from working artifacts, don't speculate ahead of them. | 2026-06-21 |

## Decided (session 2, 2026-06-21)

| # | Decision | Resolution |
|---|----------|------------|
| O1 | First build slice | **Drift detection for MOT** — standing drift auditors + a file-tree organization skill. Additive to MOT (no rewrite of existing tools); the *sensor* half of the control loop MOT lacks today. **Sensor MVP built & verified 2026-06-21** (`mot-tools.js audit` → `data/drift.json` + `drift_report.md`; 550 findings first run); actuator fix-skill pending. |
| O2 | Distribution / versioning | **Hybrid:** `__Framework/` lives in the Drive for co-dev, **mirrored to a git repo** for versioned export/pull. The Drive itself stays non-git. |
| O3 | Teammate / instance model | **Federated, NOT centralized.** Each teammate runs their *own* focus-adapted instance. Company-invariants (verticals, project partners, brand, Standards mechanisms) are a shared *seed*; person-specific entities (e.g. a CFO's banks/compliance bodies) are detected and added per-instance via a *focus-detector* C module. No central source of truth; confidential data stays local. Cross-instance aggregation is a possible *later*, confidentiality-gated option — not a goal. |

## Open — defaulted for now (raise only if you disagree)

| # | Question | Recommended default |
|---|----------|---------------------|
| O4 | Dashboard: required or optional? | **Optional plugin.** Agents + CLI read `graph-index.json` directly; ship the dashboard as a layer most new instances can skip. |
| O5 | Entity-registry format & authority | **Seed people→companies→roles as the first artifact**, advisory at first, validator-enforced later. (Schema TBD when we build it on MOT.) |
| O6 | Learnings→Standards promotion cadence | **Monthly review**, plus an *unpromoted-learnings count* as a STATE.md attention flag so it can't drift the way MOT's did. |
| O7 | Niche tooling (clip, web-qa) | **Out of the core.** Keep as optional `templates/skills/examples/`; they are single-company production helpers, not knowledge-OS layers. |
| O8 | OS / storage posture | **Windows + OneDrive-first now** (matches MOT/teammates); abstract the storage_profile (churn/lock guards) so cross-platform is a later toggle, not a rewrite. |
| O9 | Input-source posture | **Adapter interface**; ship the flat-export adapter first (it's what MOT has) but design for a clean mail/calendar API so new companies skip the defensive boundary-rescan shims. |

## Notes / parking lot
- MOT-specific improvement surfaced during design: MOT has **no standing drift auditors** today. Building
  them (O1 option a) is the first co-development deliverable — improves MOT and seeds the framework's Phase 9.
- Watch for the MOT anti-patterns the framework must not reproduce: one filename across six genres; one fact
  in five places; three parallel knowledge stores (memory/Learnings/Standards); content-before-schema.
- **Federation (later, optional):** at most a read-only aggregation view over *selected shareable slices* of
  multiple instances, explicitly gated on confidentiality. Not a default; many slices (financial/HR/legal)
  should never be pooled. Revisit only once multiple instances exist.
- **Manifest built 2026-06-21** — `__Framework/tooling/{config.schema.json, manifest.mot.json}` (the C→B
  contract; MOT = Instance Zero, company/person split). Reference artifact; **not yet wired** to live B-tools
  (we don't rewrite working tooling). Next: parameterize one B-tool to read it (e.g. a single excludes source).
- **Single-source-of-truth risks surfaced by the manifest extraction** (the manifest should collapse these):
  (1) excludes triplicated across `excludes.json` + `server.js` + the C++ walker `SKIP_DIRS`; (2)
  `supply_chain_role` uncontrolled (11+ free-form values) — needs an enum; (3) `phase` enum has stray values
  (`target`, `Design`) — candidate drift-audit signal; (4) `skip_exts` lives only in the C++ walker.
- **First B-library tool built 2026-06-22** — `__Framework/tooling/kb-index.mjs`, a manifest-driven graph
  indexer. PROVED the manifest fully parameterizes a deterministic tool: reproduces MOT's graph 100% on
  comparable nodes + reference edges, 99.88% category, 81/81 field spot-check (incl. the Bosch/STMicro pair).
  Validation: `tooling/_validation/REPORT.md`. Additive; MOT's live graph untouched.
- **GAP-2 fixed** — added `__Projects`/`__Operations` `first_segment` catch-all category rules to
  manifest.mot.json (mirrors `deriveCategory`'s two fallback branches).
- **GAP-1 (resolves SSOT-risk #1) — TODO:** excludes need **per-tool scoping**. `skip_names`/`skip_exts` are
  walker/server-scoped; the graph indexer excludes ONLY a conflict-file pattern and *indexes* `_catalog.md`.
  Next: add `conflict_pattern` to `excludes`, mark `skip_names` walker-scoped, have kb-index use
  `conflict_pattern` (then it reproduces MOT including `_catalog.md`). **DONE 2026-06-22** (GAP-1 applied).
- **B-library built & validated 2026-06-22** (workflow, all pure functions of the manifest, additive,
  MOT live tree untouched): `kb-index` (GAP-1: `conflict_pattern` + per-tool exclude scoping) · `kb-extract`
  (TL;DR→entity cards, **100%** vs `data/projects.json`) · `kb-walk` (catalog generator, **dry-run only**,
  49/50 byte-identical — the 1 miss is a stale live file) · `kb-audit` (generic drift, **99.8%** vs
  `data/drift.json`; misses = OneDrive `mtime` tiebreak + concurrent validation files, not logic). Outputs in
  `tooling/_validation/`.
- **New manifest-expressiveness gaps** (refine `config.schema.json`; several tools already read them when present):
  - **`catalog_profile`** (kb-walk) — add `skip_exts` + `ext_classification` + `skip_exact_names` (today only in
    `mot-walker.cpp`); closes SSOT-risk #4, makes kb-walk 100% pure. *High-value quick win (needs the C++ constants).*
  - **`tldr_keys`** (kb-extract) — `canonical` is the **required/validated subset, NOT an allow-list** (MOT parses
    all bold-key bullets generically, ~70 keys); add `date_anchored_synonyms: ["Last engagement"]` (trivial);
    per-tier `entity_card: true|false` flag; `non_card_subfolders` list.
  - **`supply_chain_roles`** — enum present but doesn't cover live values (`none`, `software_platform`,
    `research-partner`) and doesn't de-dupe synonyms (researcher/research, supplier/vendor).
  - **`raw_archive_roots`** (kb-audit) — explicit field instead of deriving `__temp/` from `input_adapters`.
  - Minor: exclude `__Framework/tooling/_validation/` from the framework's own indexing/audit (its sample files show as drift).
- **Templates layer started** — `__Framework/templates/{README.md, drift-detection/SPEC.md}` (generalized
  drift-detection mechanism with `{company-slot}` markers, pointing at `kb-audit.mjs`). Next templates:
  instruction (routing-table), standards, data-model, skills, registries; plus the `migration/` reversible kit.
