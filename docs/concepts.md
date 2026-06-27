---
description: The mental model behind the knowledge-OS framework, condensed for users — what a knowledge-OS is, the B/C/A escalation ladder, the manifest as the C→B seam, the two libraries, the six layers, the steady-state drift loop, and the federated-teammate model. The user-facing condensation of ARCHITECTURE.md.
references:
  - path: ../ARCHITECTURE.md
    type: builds-on
    note: The full conceptual core; this is its user-facing condensation.
  - path: manifest-reference.md
    type: related
    note: The concrete shape of the C→B seam described here.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Core concepts

The one-paragraph version: a **knowledge-OS** is a plain folder tree of Markdown made *agent-navigable* by
laying a typed graph over it (per-file YAML frontmatter = node records, folder containment = implicit edges,
authored `references[]` = typed cross-links), then governing it with an instruction hierarchy, a standards
stack, and tooling that projects heavy Markdown into small derived JSON so context-limited agents read
summaries, not raw bulk. This framework is the **reusable system for standing that pattern up on a new
Drive** — design-first, instead of the content-first/governed-reactively way most Drives grow.

---

## The B/C/A ladder (the load-bearing decision)

The hard problem is making non-deterministic reasoning trustworthy enough to run with the human mostly out of
the loop. Every decision is routed to the **lowest viable rung**:

- **B — Deterministic tools.** A rule over the file tree + frontmatter settles it. Cheap, fully reliable,
  prompt-independent. Parameterized by a manifest; the same code runs on any Drive. *Runs forever.*
- **C — Managed agent reasoning (the core).** No rule suffices, so a *scoped* agent answers one typed
  question and is **verified before it is trusted**. Expensive; made reliable by decomposition + structured
  output + adversarial verification. C confronts a messy Drive, infers structure, **emits the manifest**, and
  ships the recurring + drift-triggered skills. *Runs at setup and on re-baseline.*
- **A — Human gate.** Shrunk to a *gate*, not a conversation: fires only when a decision is **both
  low-confidence and hard-to-reverse**. The framework decides when it needs you.

This is the same shape as the reference instance's three autonomy tiers (annotate → restructure →
destroy/rewrite), reused as the framework's interaction policy.

---

## The manifest — the C→B seam

C cannot hand B a prompt; it must hand B **data**. That data is the **manifest**: a single declarative
description of a Drive that fully parameterizes every deterministic tool. On disk it is `manifest.json`,
validated against [`../tooling/config.schema.json`](../tooling/config.schema.json).

It is **layered**: a `company_profile` (shared invariants — taxonomy, vocabulary, partner registry, brand)
composed with a `person_profile` (focus, root override, person-local entities). The company profile is a
shared *seed*, never a central live store. C's only durable outputs are the filled manifest plus a reviewable
change-plan — the agent decides *what*, a deterministic tool does *how*, so acting on fuzzy decisions stays
reversible. Field-by-field: [manifest-reference.md](manifest-reference.md).

---

## Two libraries

- **B-library** (deterministic, in [`../tooling/`](../tooling/)): the six `kb-*` tools (graph indexer, card
  extractor, catalog walker, drift auditor, entity registry, focus detector) + the migration kit. Reliable
  because they are code that is a pure function of the manifest.
- **C-library** (reasoning modules): taxonomy-inferer, focus-detector, owner-vs-location classifier,
  supersession/duplicate detector, entity-resolver, completeness critic. Each is a prompt template + output
  schema + verification policy + confidence/escalation rule. You don't trust an agent — you trust a *module
  whose verification step is baked in*. (`kb-focus` is the deterministic half of the focus-detector module.)

---

## The six layers of an instance

Once stood up, an instance has six mechanism layers; only their *slots* are company-specific (the
[`../templates/`](../templates/) directory holds all six as fill-in templates):

1. **Data model** — the frontmatter node/edge graph + a freshness axis. Designed first.
2. **Standards / governance** — numbered placement/lifecycle/quality/output-schema/input-format/graph-wiring
   contracts + a **context registry** that stops look-alike workstreams from overwriting each other.
3. **Instruction / navigation** — a static root `AGENT.md`/`CLAUDE.md` whose load-bearing element is a
   *classify-before-reading* routing table (request type → read-set + do-not-read-set).
4. **Skills / workflows** — a master periodic-sync orchestrator + ingest/cleanup/QA sub-skills.
5. **Tooling / dashboard** — the B-library materialized; Markdown is always the source of truth, JSON is
   derived.
6. **Learnings loop** — an append-only, topic-scoped log whose entries *graduate* into binding
   Standards/templates.

---

## Steady state — the drift loop

Setup is just the *initial convergence* of a Drive onto its manifest + Standards. After that the Drive
drifts, so an instance runs a continuous control loop = the escalation ladder applied to operation:

- **setpoint** = manifest + Standards
- **sensor** = drift auditors (`kb-audit` — cheap deterministic checks first, a scoped reasoning module only
  for genuinely ambiguous drift)
- **actuator** = organization / sync skills (and the gated `drift-fix` actuator)
- **governor** = escalate to a human gate only when a corrective move is large *and* low-confidence

A concrete build increment of this loop lives in [`../slices/drift-detection/`](../slices/drift-detection/)
(design + actuator).

---

## Federation — teammates are not centralized

Replication is **not** centralization. Teammates have different jobs and focus, so each runs **their own
focus-adapted instance** against **their own** Drive — not a login to one shared source of truth.
Company-invariants (verticals, partner registry, brand, the Standards mechanisms) are shared as a *seed*; a
person extends them with focus-specific entities others don't track (a CFO adds banks/auditors). **Focus is
detected, not hand-configured** (`kb-focus`). Confidentiality is structural — financial/HR/legal data stays
in the instance that owns it; there is no central aggregator by default. Cross-instance aggregation is a
deliberate *later*, confidentiality-gated, read-only option over selected shareable slices — never an
automatic merge.

For the full treatment (anti-patterns the framework inverts, the end-to-end run, the co-development link with
the reference instance), read [`../ARCHITECTURE.md`](../ARCHITECTURE.md).
