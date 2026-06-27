---
description: The conceptual core of the replication framework — the knowledge-OS pattern generalized, the B/C/A escalation ladder, the manifest contract, and the two libraries (deterministic tools vs reasoning modules).
references: None
status: draft
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Framework Architecture (v0.1 draft)

> **MetaOptics / MOT = the reference instance ("Instance Zero").** Throughout this doc MOT is a
> *cited worked example*, not the subject — the framework is company-agnostic; MOT is simply the
> first Drive it was derived from and validated against.

> Status: design artifact derived from a full analysis of the reference instance, the MetaOptics
> OneDrive (6-layer parallel mapping + synthesis, 2026-06-21). Nothing here is built yet; this is
> the target we build toward. Every claim about the reference instance is sourced from that analysis.

---

## 1. What this framework reproduces

The reference instance (the MetaOptics OneDrive) is an instance of a reusable pattern we'll call a **knowledge-OS**:

> A plain folder tree of markdown, made *agent-navigable* by laying a **typed node/edge graph**
> over it (per-file YAML frontmatter = node records; folder containment = free implicit edges;
> `references[]` = authored-once typed cross-links), then **governed** by three reinforcing
> control systems — an instruction hierarchy, a standards/governance stack, and a tooling layer
> that projects the heavy markdown into small derived state so context-limited agents read
> summaries, never the raw bulk.

The framework's job is to let someone **stand up this pattern on a new Drive** — first for a
**teammate** (same company, mostly shared), then for a **different company** (everything
company-specific re-derived) — and to do it **design-first**, inverting the mistake the original
made (see §7).

---

## 2. The central split: mechanism vs. company-slot

Every part of the reference instance is one of two things. Keeping them apart is the whole game.

- **Mechanism** — the *reusable shape*: a routing table, a frontmatter schema, a placement-rule
  contract, a freshness lifecycle, an ingest→roll-up→regenerate workflow, a catalog walker.
  These transfer verbatim or as templates.
- **Company-slot** — the *filled-in values*: tier/vertical vocabularies, the supply-chain
  edge-type cluster, the people/companies registry, brand theme, the input-format adapter, the
  absolute Drive root. These are re-derived per company.

The framework is the mechanism library. A company instance is the framework with its slots filled.

Within a company the slots split again: **company-invariants** (the verticals, the project-partner
registry, brand, and the Standards *mechanisms*) versus **per-person focus** (which entities, document
types, and cadence dominate one person's work — *for example*, in the reference instance a CFO tracks
banks and compliance bodies while a VP Systems tracks testers and foundry partners). A **teammate gets
their *own* instance**, seeded from the shared
company-invariants but **adapted to their detected focus** — *not* a login to one central source of
truth. Confidential data stays in the instance that owns it. (See §11.)

---

## 3. The load-bearing decision: the B / C / A escalation ladder

The hard problem is not the deterministic tooling — it's **making non-deterministic reasoning
trustworthy enough to run with the human mostly out of the loop.** The framework treats every
decision as routed to the **lowest viable rung** of an escalation ladder:

| Rung | Name | Resolves a decision when… | Cost / reliability |
|------|------|---------------------------|--------------------|
| **B** | Deterministic rule/tool | a rule over the file tree + frontmatter settles it | cheapest, fully reliable, prompt-independent |
| **C** | Managed agent inference | no rule suffices; a *scoped* agent answers one typed question — **then is verified before it is trusted** | expensive, made reliable by decomposition + verification |
| **A** | Human gate | the decision is **both low-confidence and hard-to-reverse** | rarest, most expensive |

**Design intent (set by the user):** push as much as possible down to **B**; make **C** the
project core (it is where the real value and the real risk live); shrink **A** to a *gate*, not a
conversation. "Minimize A" becomes operational: **A fires when the framework's own
confidence-estimate × reversibility crosses a threshold.** The framework decides when it needs you.

This ladder is the same shape as the reference instance's existing **three autonomy tiers**
(annotate → restructure → destroy/rewrite). We reuse that model as the framework's interaction policy.

**Consequence:** *the expensive C inference is amortized into a durable artifact (the manifest, §4),
so day-to-day operation is deterministic and cheap.* But C is **not purely one-shot** — it also
*ships skills* onto the Drive. Some run continuously (ingest/roll-up); some run once at setup
(file-tree organization) and then **only when drift is detected**. That makes the system a
closed-loop controller, not a one-shot installer — see §9.

---

## 4. The manifest — the C → B contract

C cannot hand B a prompt; it must hand B **data**. That data is the **manifest**: a single
declarative description of a target Drive that fully parameterizes every deterministic tool.

```
manifest = {
  root,                       # absolute Drive root (the only path B tools need)
  taxonomy,                   # top-level tiers + their purposes; folder categories
  vocab,                      # tier scale, phase enum, vertical lanes, edge-type cluster, node_kind values
  frontmatter_schema,         # required/optional node fields + the TL;DR-head key set
  entity_registry,            # people → companies → roles (seeded FIRST; the SOT MOT never built)
  context_registry,           # confusable workstreams + mandatory difference notes
  input_adapters,             # inbox/meeting source grammar + junk patterns + transcription backend
  excludes,                   # skip dirs/exts/names for the walker (single source, no hand-mirrored copies)
  brand,                      # theme colors, fonts, PDF footer, QA target URL
  cadence,                    # sync period + freeze/draft boundary
  storage_profile            # synced-cloud (OneDrive) vs local/git → toggles churn/lock guards
}
```

> **The manifest is the seam of the whole architecture.** C's only durable output is a filled
> manifest (+ a change-plan, below). B tools are pure functions of it. On-disk it lives as
> `manifest.json` (validated against `tooling/config.schema.json`).

The manifest is **layered**: a *company profile* (shared invariants — verticals, partner registry,
brand) composed with a *person/instance profile* (focus-specific taxonomy extensions, entities, cadence).
Each instance composes the two **locally**; the company profile is a shared *seed*, never a central live
store (§11).

C also emits a **change-plan** — a reviewable diff of intended moves/edits — which a deterministic
executor applies idempotently with a dry-run preview. *The agent decides **what**; the tool does
**how**.* So even acting on fuzzy decisions stays reversible and inspectable.

---

## 5. Two libraries

Reliability comes from giving **both** layers a library of vetted units — never freshly-improvised prompts.

| | **B-library** (deterministic tools) | **C-library** (reasoning modules) |
|---|---|---|
| Examples | catalog walker, frontmatter graph indexer, markdown→JSON extractor, STATE summarizer, dead-edge validator, PDF renderer, dashboard | taxonomy-inferer, **focus-detector**, owner-vs-location classifier, supersession/duplicate detector, entity-resolver, completeness critic |
| Defined by | code + manifest params | **prompt template + output schema + verification policy + confidence/escalation rule** |
| Reliability from | it is code | decomposition + structured output + adversarial verification |
| Failure handling | path-confinement, content-equality no-op writes, lock-safe tmp-rename | escalate to A on low confidence; refute-by-default verifier panel |

A **reasoning module** is the fuzzy-layer analogue of a deterministic tool: known inputs, a typed
output, a built-in self-check, and a known failure mode. You don't trust an agent — you trust a
*module whose verification step is baked in.* That is how C *manages* reasoning instead of hoping.

The **orchestrator** (the C-pipeline, see SETUP_SEQUENCE) sequences these modules over a messy Drive,
routes each decision down the ladder, **journals every inference** (auditable + re-runs cache the
deterministic prefix), gates only at critical nodes, and emits the manifest + change-plan.

---

## 6. The six generalizable layers

Once instantiated, a company instance has six layers. All six are mechanism; only the slots they
hold are company-specific.

1. **Data-model** — frontmatter node/edge graph + a freshness axis. Every node carries a TL;DR
   digest, importance metadata (tier/phase/vertical), and lifecycle (status/`valid_as_of`/context).
   `node_kind` lets hierarchy be *derived* from containment + a flag. **This is the contract every
   other layer binds to — design it first.**
2. **Standards / governance** — numbered, cross-linking, non-duplicating contracts: placement,
   lifecycle/freshness + a context registry (the guardrail that stops lookalike workstreams
   overwriting each other), content quality, output content-schema + QA gate, input-format spec,
   graph-wiring vocabulary.
3. **Instruction / navigation** — a static root `AGENT.md`/`CLAUDE.md` whose load-bearing element is
   a **classify-before-reading routing table** (request archetype → read-set + *do-not-read-set*),
   plus the autonomy tiers, avoid-read, and superseded conventions. Nested per-folder rule files own
   their subtree on a fixed body template.
4. **Skills / workflows** — a master periodic-sync orchestrator (ingest → summarize → port by
   placement rules → refresh per-entity overviews → two-audience roll-up + QA → to-dos → regenerate
   indexes) plus ingest/cleanup/QA sub-skills. Thin procedure; substance lives in Standards.
5. **Tooling / dashboard** — the B-library materialized: graph indexer, STATE summarizer, catalog
   walker, ref validator, PDF renderer, and an optional dashboard serving the derived JSON with
   exactly one content-keyed write-back overlay. **Markdown is always source of truth; all
   JSON/PDF/catalogs are regenerable.**
6. **Learnings feedback loop** — a shared, append-only, topic-scoped log whose entries *graduate*
   into binding Standards. The mechanism by which both a company instance *and this framework itself*
   self-document and improve. (This framework keeps its own loop at `Learnings/`.)

---

## 7. What we are idealizing (the reference instance's process was not ideal)

The original (the reference instance) was built **content-first, then governed reactively** — two
Drive-wide reorganization waves of rework. Concrete non-ideal patterns the framework must invert
(these are lessons from Instance Zero; the named scars are kept deliberately as load-bearing rationale):

- **Content arrived before the schema.** Frontmatter, placement rules, lifecycle, and the context
  registry were all *retrofitted* onto existing files after incidents (the Bosch/STMicro tester
  confusion is the canonical scar). → **Design data-model + Standards before the first content load.**
- **Tooling came after the moves broke things.** The dead-edge validator was written *after* a reorg
  broke ~170 references. → **Stand up the validator + indexer + walker before the bulk migration.**
- **Migration was heuristic-then-clean-up-twice.** → **Use the proven reversible, gated,
  database-first migration pattern** (inventory → rename_map → executed_moves, two approval gates,
  dups parked in `_superseded/`, replayable JSON for exact rollback).
- **No entity registry ever existed** → recurring people/company tangles. → **Seed a
  people→companies→roles registry as the first artifact.**
- **One filename, six genres.** `CLAUDE.md` is simultaneously a router, an operating manual, a
  template how-to, a status card. → **Split genres into clearly-named files; one parentage encoding.**
- **One fact in up to five places** (status + `valid_as_of` + context + HTML-comment block + banner)
  and three knowledge stores (memory / Learnings / Standards). → **Single source of truth per fact;
  mechanize the Learnings→Standards promotion instead of leaving it manual.**
- **Defensive shims for a flat Outlook export** (boundary re-scan, late-reply checks). → **Prefer a
  proper mail/calendar API adapter; keep flat-export as a fallback adapter, not the default shape.**

---

## 8. How an instance runs, end to end

```
        ┌─────────────────────────── C (runs once / on re-baseline) ───────────────────────────┐
messy   │  discovery → taxonomy inference → entity+context seeding → schema → [GATE: approve]   │   manifest.json
Drive ──▶│  → reasoning modules emit a change-plan ─────────────────── [GATE: approve moves] ───│──▶  + change-plan
        └──────────────────────────────────────────────────────────────────────────────────────┘        │
                                                                                                          ▼
        ┌─────────────────────────── B (runs forever, deterministic) ────────────────────────────────────┐
        │  executor applies change-plan ▸ walker writes catalogs ▸ indexer builds graph-index.json ▸      │
        │  extractor builds data/*.json ▸ STATE summarizer ▸ validator (green) ▸ dashboard serves ▸ PDF    │
        └────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                                          │
        ┌─────────────────────────── Skills (day-to-day operation) ──────────────────────────────────────┐
        │  periodic sync: ingest → summarize → port → refresh overviews → roll-up + QA → to-dos → regen   │
        └────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                                          │
                                              Learnings loop ◀───────────────────────────────────────────┘
                                        (graduate stable lessons → Standards/templates)
```

---

## 9. Steady state: the drift / reconciliation loop

Setup (C's first run) is just the **initial convergence** of the Drive onto its manifest + Standards.
After that, the Drive *drifts*: new files land in the wrong place, frontmatter goes missing,
overviews go stale, a workstream forks without a context entry. An idealized instance therefore runs
a **continuous control loop**, and it is the escalation ladder (§3) applied to operation rather than setup:

| Control role | What it is | Rung |
|---|---|---|
| **Setpoint** | the manifest + Standards (the desired state) | — |
| **Sensor** | **drift auditors** — cheap deterministic checks first (a file with no frontmatter, an unplaced attachment, a `valid_as_of` older than N days, a dead reference, a folder that violates a placement rule); a scoped reasoning module only for drift a rule can't judge (is this *really* a new workstream, or the same one renamed?) | B, then C |
| **Actuator** | **organization / sync skills** — file-tree organization (moves per placement rules), the periodic ops-sync (ingest → roll-up → regenerate), frontmatter backfill | B (skills) |
| **Governor** | escalate to a human **gate** only when the corrective move is large *and* low-confidence | A |

So the operational layer = **sensors (auditors) + actuators (skills) + the manifest as setpoint.**
File-tree organization runs in full at setup, then ideally never again — *unless* an auditor reports
placement drift, which re-invokes just the organization skill on just the drifted subtree. The reference
instance's `mot-sync` is already an actuator of this kind (it keeps derived state converged); what is
missing — in the framework *and in the reference instance today* — is the **sensor half**: standing drift
auditors. Building them is a shared deliverable (§10).

Drift detection is mostly **B** (rules over the graph index are exactly the cheap, reliable checks the
ladder wants at the bottom rung); it escalates to **C** only for genuinely ambiguous drift, and to **A**
only when reconciliation is destructive. This keeps continuous operation overwhelmingly deterministic.

## 10. Co-development with the reference instance (a learning link, not a mandate)

The framework's development is **loosely linked** to the live reference instance (the MetaOptics Drive) so
the two can *learn from each other* — nothing more. The reference instance is a convenient test bed; it is
**not** a commitment to rewrite its working tooling (the walker, the sync skill, the dashboard stay as they are).

- When a *new, additive* capability would help both — e.g. drift auditors, which the reference instance
  lacks today — we build it on the reference instance first: it improves that instance and validates the
  mechanism at the same time. **Additive only; no refactor of what already works.**
- A genuinely general lesson learned while operating the reference instance can **graduate into the
  framework templates**; conversely a framework idea can suggest an additive improvement to the reference
  instance. The link runs both ways but is opportunistic, not obligatory.
- Two learning journals stay separate: the reference instance's operational
  `__Operations/Documentation/Learnings/` feeds its Standards; `Learnings/` feeds the reusable templates.

**Practical rule:** extract abstractions *from* working artifacts rather than speculating ahead of them —
but don't force the reference instance to carry framework experiments it doesn't need.

---

## 11. Federation: decentralized, focus-adaptive instances

Replication is **not centralization.** Teammates have different jobs and different focus, so each runs
**their own instance** that the framework *adapts to their focus* — it does not log them into one shared
source of truth.

- **Company-invariants are shared as a seed, not a live central store.** In the reference instance, for
  example, things like the four verticals and the project-partner registry are stable across people and can
  be seeded from a shared company profile. But a person extends them with focus-specific entities the others
  don't track — a CFO adds banks, lenders, audit/compliance bodies that never existed in the VP-Systems instance.
- **Focus is detected, not hand-configured.** A C reasoning module (the *focus-detector*) infers a
  person's focus from what actually dominates their Drive (entity types, document kinds, cadence) and
  adapts the manifest's person-profile accordingly.
- **Confidentiality is structural.** Financial / HR / legal data that should not be pooled simply stays
  in the instance that owns it. There is no central aggregator by default.
- **Aggregation is a deliberate *later* option, gated on confidentiality** — at most a future read-only
  federation view over selected, shareable slices, never an automatic merge. Until then, instances are
  independent and only the *mechanisms* (plus an optional company-invariant seed) are common.

---

See [bootstrap/SETUP_SEQUENCE.md](bootstrap/SETUP_SEQUENCE.md) for the phased pipeline and its
bifurcations, [DECISIONS.md](DECISIONS.md) for the open architectural choices, and
[Learnings/](Learnings/) for the framework's own learning journal.
