---
description: Living decision log for the replication framework — what's been decided, what's open, and the recommended default for each open choice. This is where the design's learning process is recorded.
references:
  - path: ARCHITECTURE.md
    type: related
    note: Decisions refine the architecture.
status: current
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
| O1 | First build slice | **Drift detection for MOT** — standing drift auditors + a file-tree organization skill. Additive to MOT (no rewrite of existing tools); the *sensor* half of the control loop MOT lacks today. **Sensor MVP built & verified 2026-06-21** (`mot-tools.js audit` → `data/drift.json` + `drift_report.md`; 550 findings first run). **DONE 2026-07-02: actuator ships** as the `/drift-fix` skill + `slices/drift-detection/ACTUATOR.md` (read-only audit → dry-run → gated tier-1 auto-fix → tier-2/3 decision list). Full slice (sensor + actuator) closed. |
| O2 | Distribution / versioning | **Hybrid:** `__Framework/` lives in the Drive for co-dev, **mirrored to a git repo** for versioned export/pull. The Drive itself stays non-git. |
| O3 | Teammate / instance model | **Federated, NOT centralized.** Each teammate runs their *own* focus-adapted instance. Company-invariants (verticals, project partners, brand, Standards mechanisms) are a shared *seed*; person-specific entities (e.g. a CFO's banks/compliance bodies) are detected and added per-instance via a *focus-detector* C module. No central source of truth; confidential data stays local. Cross-instance aggregation is a possible *later*, confidentiality-gated option — not a goal. |

## Open — defaulted for now (raise only if you disagree)

| # | Question | Recommended default |
|---|----------|---------------------|
| O4 | Dashboard: required or optional? | **Optional plugin.** Agents + CLI read `graph-index.json` directly; ship the dashboard as a layer most new instances can skip. |
| O5 | Entity-registry format & authority | **Seed people→companies→roles as the first artifact**, advisory at first, validator-enforced later. **DONE 2026-07-02: built on MOT** as `entities.json` (companies auto-derived from `__Projects/` Overview folders; people are the seeded part). Schema = `templates/registries/entity-registry.template.json`, **people-only** — companies are derived from `<projects_root>/` folder names, not listed in the registry. Resolves the "SOT the original never built" scar (ARCHITECTURE §7). |
| O6 | Learnings→Standards promotion cadence | **Monthly review**, plus an *unpromoted-learnings count* as a STATE.md attention flag so it can't drift the way MOT's did. |
| O7 | Niche tooling (clip, web-qa) | **Out of the core.** They are single-company production helpers, not knowledge-OS layers. **RESOLVED 2026-07-02: "named, not built."** Per `templates/skills/README.md`, `clip` and `web-qa` are *listed* as instance-local niche helpers each core skill deliberately excludes, but **no `examples/` folder ships** — the core carries only the four workflow archetypes. |
| O8 | OS / storage posture | **Windows + OneDrive-first now** (matches MOT/teammates); abstract the storage_profile (churn/lock guards) so cross-platform is a later toggle, not a rewrite. |
| O9 | Input-source posture | **Adapter interface**; ship the flat-export adapter first (it's what MOT has) but design for a clean mail/calendar API so new companies skip the defensive boundary-rescan shims. |

*(O1, O5, O7 resolved 2026-07-02; O4 resolved 2026-07-02 — see the session-4 block below (dashboard ships as `framework/dashboard/`); O6, O8, O9 remain defaulted. O10 (resource-class model) decided 2026-07-02 in the session-4 block.)*

## Decided (session 3, 2026-06-23 → 2026-07-02, written 2026-07-02)

The foundation shipped past the 2026-06-22 freeze. What was built in this window:

| # | Decision / deliverable | Resolution |
|---|----------|------------|
| S1 | **All six template families built** | `templates/{instruction, standards, data-model, skills, registries, drift-detection}/` — the full mechanism library (was 1 of 6 at freeze). Each is mechanism-only with `{company-slot}` markers; extracted from proven MOT artifacts. |
| S2 | **Migration kit built** | `migration/{inventory, plan-renames, apply-moves}.mjs` + `PLAYBOOK.md` — the reversible, gated, database-first migration pattern (inventory → rename_map → executed_moves, dry-run-by-default, `apply` hard-refused on a protected root). |
| S3 | **B-library extended** | added `kb-entities.mjs` (people-seeded entity registry → `entities.json`, companies derived) and `kb-focus.mjs` (focus-detector) to `tooling/`, alongside kb-index/extract/walk/audit. |
| S4 | **Bootstrap + docs suite written** | four bootstrap runbooks (`bootstrap/{teammate, greenfield, brownfield, new-company}.md`) + `SETUP_SEQUENCE.md` + `RUN.md`; and the `docs/` suite (`README, getting-started, concepts, manifest-reference, tools, troubleshooting`). |
| S5 | **Generalization remediation executed** | per `_instance/GENERALIZATION_AUDIT.md`: vendor-neutral schema `$id`, the `MIGRATION_TARGET_IS_NOT_PROTECTED` interlock, tools default to `manifest.example.json`; MOT-filled/detected artifacts gitignored and paired with synthetic `*.example.json`. |
| S6 | **Repo exported to git and pushed** | O2's git mirror is live; last commit 2026-06-29. The Drive copy stays non-git for co-dev. |
| S7 | **2026-06-27 reorg: framework/ vs _instance/ split** | `__Framework` split into `framework/` (clean company-agnostic core, the git repo) + `_instance/` (private, gitignored: `manifest.mot.json`, `company-seed.json`, `instance-zero/`, focus-detector snapshots). Mechanism ≠ filled content, now at the folder boundary. |

## Decided (session 4, 2026-07-02 — contacts subsystem + dashboard slice)

Two long-open architectural questions closed, and the contacts/outreach subsystem extracted from MOT.

| # | Decision / deliverable | Resolution |
|---|----------|------------|
| **O10** | **Resource-class model for shared mutable state** | **DECIDED — three resource classes (S1).** (1) *copy-time company seed* — the `company_profile` slots copied at bootstrap (verticals, partner registry, brand, Standards mechanisms), forked-and-owned per instance. (2) *instance-local person data* — `person_profile` + focus config, private to the owning Drive, never pooled. (3) **NEW — live shared company register**: exactly ONE on-disk source of truth *per company* for a deliberately-shareable mutable register (first instance: the contact roster). **Write-gating rule (non-negotiable):** the SOT is written ONLY through gated mechanisms — an invariant-checked rebuild (dry-run default + timestamped backup + atomic write) or a CRUD-through-server that re-derives immediately. Each teammate instance *reads* it (computes status locally at extract, derives company axes against its own graph) and *contributes* per-instance batches (e.g. mail-scan summaries) that a merge step folds into the SOT — MOT's `merge_summaries.py` is the validated embryo of that merge. **Opt-in:** a single-person instance keeps `shared: false` and the register lives in its own Drive. *Rationale (recorded because per-drive copies looked simpler):* per-drive copies fork Last-contact dates, break the pooled multi-sender shortlist (double-contact risk), and fracture do-not-contact flags. Confidentiality stance from §11 is unchanged — this class is a *deliberately-shareable slice*, not federation of everything. |
| **O4** | **Dashboard: required or optional?** *(was defaulted)* | **DECIDED — optional plugin, and the layer now ships.** The dashboard ships as the `framework/dashboard/` slice (the "optional plugin layer" this row promised). **[S3] data contract:** *core tabs* (framework-supported, fed by the shipped `kb-*` tools) = Graph/Tree/Files (live from the slice server), Projects (`projects.json` ← kb-extract), Entities (`entities.json` ← kb-entities), Drift (`drift.json` ← kb-audit), Contacts (`contacts.json` ← kb-contacts, when `contact_register.enabled`); *instance-plugin tabs* (need an instance-supplied extractor — MOT's live in `mot-tools.js`) = Sync/To-dos/Events/Assignments. **UI rule:** every tab renders an explicit "no data source configured" empty state when its JSON is absent — never a crash or blank screen. **[S4] parameterization:** the slice server reads `KB_ROOT` (no MOT fallback in the SLICE copy — fail fast if unset); `GET /api/config` serves `{ root, displayName, vocab orders, category rules }` to the client; `src/config` is generated from the manifest by `tooling/kb-dashboard-config.mjs`. The **MOT instance dashboard** at `__Operations/Dashboard` keeps its current behavior (env override optional, hardcoded fallback stays). |
| S8 | **Contacts subsystem extracted from MOT** | The complete contacts/outreach slice landed as mechanism: (a) the **manifest block** — `company_profile.contact_register` (opt-in, `enabled:false` default, `additionalProperties:false`, NOT in `required`) + `storage_profile.shared_root` + `person_profile.{voice_profile, outreach_sender}` + `cadence.outreach` + the DERIVED-only `vocab.derived_contact_status` enum, in `config.schema.json` + both example manifests + `manifest-reference.md`; (b) **registry + standards + skills templates** — contact-register template, three contact/outreach standards contracts, and two workflow-skill archetypes (contact-select, outreach-draft) + a guarded outreach-cadence step in periodic-sync; (c) **`kb-contacts.mjs`** — the manifest-driven Contacts extractor, byte-for-byte identical to MOT's live `data/contacts.json` (505 contacts) except `generated_at` (exact-fidelity gate PASSED); (d) **two kb-audit drift signals** — `shortlist_staleness` + `register_vs_derived_drift`, guarded on the contact-register block; (e) **slice docs** — DATA_CONTRACT, README, and this ledger. |
| S9 | **Named-not-built: the register-rebuild code port** | The generalized **register-rebuild tool** (MOT's invariant-checked `rebuild_contacts.py` + `merge_summaries.py` — the O10 write-gate actuators) is **documented in the slice but NOT yet ported to `tooling/`**. This is the one remaining named extraction of the contacts subsystem: the framework ships the *reader* (kb-contacts) and the *sensor* signals now; the *gated writer* (dry-run rebuild + timestamped backup + atomic write, and the per-instance-batch merge) is slice-documented and awaits the port. |

## Notes / parking lot
- MOT-specific improvement surfaced during design: MOT has **no standing drift auditors** today. Building
  them (O1 option a) is the first co-development deliverable — improves MOT and seeds the framework's Phase 9.
- Watch for the MOT anti-patterns the framework must not reproduce: one filename across six genres; one fact
  in five places; three parallel knowledge stores (memory/Learnings/Standards); content-before-schema.
- **Federation (later, optional):** at most a read-only aggregation view over *selected shareable slices* of
  multiple instances, explicitly gated on confidentiality. Not a default; many slices (financial/HR/legal)
  should never be pooled. Revisit only once multiple instances exist.
- **Manifest built 2026-06-21** — `tooling/{config.schema.json, manifest.mot.json}` (the C→B
  contract; MOT = Instance Zero, company/person split). Reference artifact; **not yet wired** to live B-tools
  (we don't rewrite working tooling). Next: parameterize one B-tool to read it (e.g. a single excludes source).
- **Single-source-of-truth risks surfaced by the manifest extraction** (the manifest should collapse these):
  (1) excludes triplicated across `excludes.json` + `server.js` + the C++ walker `SKIP_DIRS`; (2)
  `supply_chain_role` uncontrolled (11+ free-form values) — needs an enum; (3) `phase` enum has stray values
  (`target`, `Design`) — candidate drift-audit signal; (4) `skip_exts` lives only in the C++ walker.
- **First B-library tool built 2026-06-22** — `tooling/kb-index.mjs`, a manifest-driven graph
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
  - **`catalog_profile`** (kb-walk) — **LANDED 2026-07-02** in `config.schema.json` (`skip_exts` + `ext_classification`
    + `skip_exact_names`; today's MOT values lifted from `mot-walker.cpp`); closes SSOT-risk #4, makes kb-walk 100% pure.
  - **`tldr_keys`** (kb-extract) — `canonical` is the **required/validated subset, NOT an allow-list** (MOT parses
    all bold-key bullets generically, ~70 keys); add `date_anchored_synonyms: ["Last engagement"]` (trivial);
    per-tier `entity_card: true|false` flag; `non_card_subfolders` list.
  - **`supply_chain_roles`** — **LANDED 2026-07-02** in `config.schema.json` (canonical enum + synonym de-dup:
    researcher/research, supplier/vendor); the uncontrolled free-form values are now a drift-audit signal.
  - **`raw_archive_roots`** (kb-audit) — explicit field instead of deriving `__temp/` from `input_adapters`.
  - Minor: exclude `tooling/_validation/` from the framework's own indexing/audit (its sample files show as drift).
- **Templates layer started** — `templates/{README.md, drift-detection/SPEC.md}` (generalized
  drift-detection mechanism with `{company-slot}` markers, pointing at `kb-audit.mjs`). Next templates:
  instruction (routing-table), standards, data-model, skills, registries; plus the `migration/` reversible kit.
