---
description: Entry point for the knowledge-OS replication framework — what it is, the B/C/A model, how this folder is organized, and how it is co-developed with the MetaOptics Drive (Instance Zero).
references:
  - path: ARCHITECTURE.md
    type: related
    note: The conceptual core.
  - path: CLAUDE.md
    type: related
    note: Generalizes — the MOT root navigation hub is the worked instance of the instruction layer this framework templatizes.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: program-root
---

# __Framework — a replication framework for the knowledge-OS

> **MetaOptics / MOT = the reference instance ("Instance Zero").** It is the worked example this
> framework was derived from and is validated against — a cited reference, not the subject. The
> mechanism is company-agnostic.

This folder is a **reusable system for standing up a knowledge-OS-style agent-navigable Drive** on a
new Drive — first for a **teammate** (same company — their *own* instance, adapted to that person's
focus), then for a **different company** (everything company-specific re-derived). It is also the place
where we **document the learning process** and feed it back into the framework.

It is deliberately a **top-level `__`-prefixed folder**, a peer of `__Projects` / `__Operations` /
`__shared`, so it stays lifted-out-able and never tangles the reusable mechanism with MOT's filled-in
content. (MOT's own `__Operations/Documentation/Standards/` is the *worked instance* of what this
folder templatizes — keeping them separate is the point.)

## The model in one breath

Three "products" hide in "replicate this system." We are building **B + C, with C as the core, and A
shrunk to a gate** (decided with the user, 2026-06-21):

- **A — human in the loop.** Minimized to a *gate*: fires only when a decision is both low-confidence
  and hard-to-reverse.
- **B — deterministic tools.** Parameterized by a **manifest**; same code runs on any Drive; outcomes
  you can count on, independent of any prompt. *Runs forever.*
- **C — the meta-framework (core).** Agent reasoning that confronts a messy Drive, infers structure,
  and **emits the manifest** that B consumes. *Runs at setup and on re-baseline — and ships the
  recurring + drift-triggered skills the Drive runs day to day.*

> The **manifest** is the seam: C produces it, B consumes it. The framework's whole reliability story
> is pushing every decision to the **lowest viable rung** of the B→C→A ladder. See
> [ARCHITECTURE.md](ARCHITECTURE.md) §3–§5.

## Learning link with MOT (not a rewrite)

The framework is *loosely* linked to this Drive so the two can learn from each other — it is **not** a
plan to rewrite MOT's working tooling. When a new, *additive* capability would help both — like drift
auditors, which MOT lacks today — we build it on MOT first; it improves MOT and validates the mechanism.

**Teammates are not centralized:** each gets their own focus-adapted instance, sharing only
company-invariants (verticals, partners) as a seed. Confidential data stays local. See
[ARCHITECTURE.md](ARCHITECTURE.md) §9–§11.

## Folder map

```
framework/               ← the repo root (in the MetaOptics Drive: __Framework/framework/)
├── README.md            ← you are here
├── CLAUDE.md            ← agent guide for working in this folder
├── ARCHITECTURE.md      ← the six layers, the B/C/A ladder, the manifest, the drift loop, federation
├── DECISIONS.md         ← living log of architectural choices + their resolutions
├── bootstrap/
│   ├── SETUP_SEQUENCE.md   ← the idealized phased pipeline + bifurcation tree
│   └── greenfield / brownfield / teammate / new-company .md ← per-path operator runbooks
├── templates/           ← the reusable MECHANISM ({company-slot} markers → manifest fields)
│   ├── instruction/   ← root-AGENT + nested-rule-file body template
│   ├── standards/     ← 8 governance contracts (placement, lifecycle, quality, …)
│   ├── data-model/    ← frontmatter node/edge graph + freshness axis
│   ├── skills/        ← periodic-sync orchestrator + ingest/cleanup/drift-fix
│   ├── registries/    ← entity + context registry seeds
│   └── drift-detection/ ← the drift slice as a parameterized template
├── tooling/             ← the manifest + the B-library (all manifest-driven, validated vs MOT)
│   ├── config.schema.json   ← the manifest schema (C→B contract)
│   ├── manifest.example.json + company-seed.example.json ← synthetic demo instance (copy → manifest.json, edit for your Drive)
│   ├── TOOLS.md             ← the B-library operator reference (all 6 tools + migration kit)
│   └── kb-index / kb-extract / kb-walk / kb-audit / kb-entities / kb-focus .mjs
├── migration/           ← reversible database-first kit (inventory → rename_map → executed_moves + PLAYBOOK)
├── slices/              ← build increments: drift-detection (design + actuator) + focus-detector (validation)
├── docs/                ← how-to-use guide (getting-started, concepts, manifest reference, troubleshooting)
└── Learnings/           ← the framework's own learning journal
```

## Status

**Foundation complete & validated (2026-06-22).** Every layer was built *additively* and validated against
MOT (Instance Zero): the manifest reproduces MOT's graph / extract / catalog / drift tools from itself alone;
the drift control-loop (sensor + actuator, wired into mot-sync), the focus-detector, the full `templates/`,
and the `migration/` kit are in place. **MOT is a clean reference instance** — all 6 replication-blockers
closed (tracked in the reference instance's private gap-analysis, not shipped with the framework core).

**Not yet done:** the first real **federated teammate dry-run** (the four per-path bootstrap runbooks and the
B-library tools index are now in place — see [bootstrap/](bootstrap/) and [tooling/TOOLS.md](tooling/TOOLS.md)).
Live state + open follow-ups in [DECISIONS.md](DECISIONS.md).
