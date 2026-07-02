---
description: The manifest — the C→B contract. The reusable schema plus MetaOptics' filled instance (Instance Zero), and the single-source-of-truth risks the extraction surfaced.
references: None
status: current
context: framework-architecture
tags: [framework-meta]
---

# tooling/ — the manifest (C→B contract)

The **manifest** is the seam of the architecture (ARCHITECTURE §4): C infers it from a messy Drive;
every deterministic (B) tool is a pure function of it.

> **Reference instance:** MetaOptics (MOT) is the worked *reference instance* ("Instance Zero") throughout
> this folder. Its **filled** manifest and seed are **private** — they live at `../_instance/`
> (`manifest.mot.json`, `company-seed.json`), gitignored, not shipped. What ships here are the generic
> stand-ins: `manifest.example.json` and `company-seed.example.json`.

| File | What it is |
|------|------------|
| `config.schema.json` | The reusable manifest **schema** (JSON Schema 2020-12) — the *mechanism*. Splits into a `company_profile` (invariants shared across teammates) and a `person_profile` (focus-specific, partly filled by the focus-detector C module). |
| `manifest.example.json` | The **shipped synthetic** filled manifest — the default every `kb-*` tool reads, and the structure a new instance copies. The reference instance's real values are private (`../_instance/manifest.mot.json`). |
| `company-seed.example.json` | The **shipped synthetic** shared seed (`{ manifest_version, company_profile }`) a teammate copies verbatim. The reference instance's filled seed is private (`../_instance/company-seed.json`). |

## Status: reference artifact, not yet wired
This is a **design artifact**. The live MOT tools (`mot-tools.js`, `mot-walker`, the dashboard) do **not**
read it yet — per the co-development rule we don't rewrite working tooling. Parameterizing a B-tool to
consume the manifest (e.g. one excludes source) is a future slice. For now it (a) proves the
mechanism/instance split concretely, (b) is the template a teammate/new-company instance fills, and
(c) is the spec a focus-detector targets.

## How it's used
- **Validate** any instance against `config.schema.json`.
- **Teammate** (federated): copy `company_profile` verbatim (the shared seed); run the focus-detector to
  fill `person_profile.focus` from what dominates that person's Drive; add `extra_entities` for things the
  seed lacks (a CFO's banks/auditors). No central store.
- **New company**: re-derive `company_profile` from templates; only the *mechanism* transfers.

## Single-source-of-truth risks the extraction surfaced
Building the manifest exposed where MOT keeps one fact in several places (the manifest's job is to collapse these):

1. **Excludes list is triplicated** — `src/config/excludes.json` (read by `server.js` + `mot-tools.js`) **and**
   a hand-mirrored `SKIP_DIRS` in the C++ `mot-walker` (can't read JSON). Contents match today, ordering
   differs — exactly the drift the manifest should end (one source all tools read).
2. **`supply_chain_role` is uncontrolled** — 11+ free-form values in the wild with near-synonyms
   (`researcher`/`research`, `supplier`/`vendor`). Needs an enum before a B-tool can rely on it.
3. **`phase` enum has stray values** — canonical is `engaged/acquisition/dormant/internal/archived`, but
   `phase: target` and `phase: Design` exist in deep frontmatter. A good drift-audit signal to add.
4. **`skip_exts` lives only in the C++ walker** — not in `excludes.json`; lift it into the manifest when
   collapsing risk #1.

These are candidate follow-ups (see [../DECISIONS.md](../DECISIONS.md) parking lot), not blockers.
