---
description: Agent guide for the __Framework project — a reusable system to replicate the MetaOptics knowledge-OS for teammates then other companies. Concise hub; routes to the detailed docs.
references: None
status: current
context: framework-architecture
tags: [framework-meta]
---

# __Framework — agent guide

> **MetaOptics / MOT = the reference instance ("Instance Zero").** A cited worked example, not the
> subject — the mechanism here is company-agnostic.

A reusable system for standing up a knowledge-OS-style, agent-navigable Drive on a **new** Drive —
first a **teammate** (their own focus-adapted instance), later a **different company**. This folder is
the reusable **mechanism**; the reference instance's own `__Operations/Documentation/Standards/`,
`__Projects/`, etc. are the worked **instance**. Keep the two apart — never copy the reference instance's
filled-in content in here.

## Core model (one breath)
- **B + C, with C as the core and A a gate.** Determinism-first: route every decision to the lowest viable
  rung — **B** deterministic manifest-driven tools · **C** managed agent reasoning · **A** human gate (fires
  only when a decision is both low-confidence *and* hard-to-reverse).
- **The manifest** (`tooling/config.schema.json` → a filled `manifest.json`) is the **C→B contract**: C infers
  it from a messy Drive; B tools are pure functions of it.
- **Federated, not centralized:** each teammate runs their own instance, seeded from shared company-invariants
  and adapted to their focus. Confidential data stays local.
- **Closed control loop:** setpoint = manifest + Standards · sensors = drift auditors · actuators = org/sync skills.

## Read this for…
| You're doing… | Read |
|---|---|
| Orientation / the B/C/A model | [README.md](README.md) |
| The architecture (6 layers, the B→C→A ladder, the manifest, drift loop, federation) | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **Live state + decisions — read FIRST when resuming** | [DECISIONS.md](DECISIONS.md) |
| The idealized setup pipeline + bifurcations | [bootstrap/SETUP_SEQUENCE.md](bootstrap/SETUP_SEQUENCE.md) |
| **Stand up a NEW instance — the ENTRY POINT, pick the path** | [bootstrap/teammate.md](bootstrap/teammate.md) (same-company) · [greenfield](bootstrap/greenfield.md) · [brownfield](bootstrap/brownfield.md) · [new-company](bootstrap/new-company.md) |
| Run / reference the B-library tools | [tooling/TOOLS.md](tooling/TOOLS.md) |
| The manifest (C→B contract) + a worked example | [tooling/config.schema.json](tooling/config.schema.json) · [tooling/manifest.example.json](tooling/manifest.example.json) |
| A concrete build increment | [slices/](slices/) — `drift-detection/` = sensor + actuator, built on the reference instance |
| Framework-level lessons (graduate into templates) | [Learnings/](Learnings/) |

## Status (2026-06-23)
**Foundation complete & validated against the reference instance (MetaOptics / MOT = Instance Zero).** The
manifest + full B-library (`tooling/`), the templates, the drift control-loop, the migration kit, and the
per-path runbooks (`bootstrap/`) are all built; the reference instance is clean. **Not yet done:** the first
real federated *teammate dry-run*. Live state in [DECISIONS.md](DECISIONS.md).

## Working here
- **Mechanism vs instance:** put reusable templates/tools here; extract abstractions *from* working
  reference-instance artifacts, don't speculate ahead of one.
- **Co-development with the reference instance is a learning link, not a mandate** — additive only; do
  **not** rewrite its working tooling (the walker, the sync skill, the dashboard).
- **Exemplify the graph rules these docs preach:** every `.md` carries `description` + typed `references` (valid
  vocab only — never `parent`/`child`, containment is free; define each edge once).
- File changes follow the reference instance's three autonomy tiers; record decisions in `DECISIONS.md`, lessons in `Learnings/`.
