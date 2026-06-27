---
description: The generalized DATA-MODEL contract — the human-facing spec that config.schema.json formalizes. The frontmatter node record, the typed node/edge graph (containment-is-free, define-once, controlled edge vocab), node_kind for derived hierarchy, the TL;DR-head dual-purpose digest, the two-axis freshness model, and the large-mutable→small-derived read-budget convention. Mechanism only; every company-specific vocabulary/enum/field is a {company-slot} drawn from the manifest.
references:
  - path: __Framework/tooling/config.schema.json
    type: standard
    note: The machine form of this contract. Every {company-slot} here resolves to a field under company_profile.{frontmatter_schema,vocab,taxonomy,raw_archive_roots} — this doc is the spec, that schema is its validator.
  - path: __Framework/ARCHITECTURE.md
    type: related
    note: §6 layer 1 ("Data-model — the contract every other layer binds to; design it first") is the layer this template materializes; §1 defines the knowledge-OS graph it formalizes.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Data-model — the node/edge graph contract

The **first** of the six layers (ARCHITECTURE §6) and the one every other layer binds to: a plain
folder tree of markdown is made *agent-navigable* by laying a **typed node/edge graph** over it. This
is the human-facing contract; [`config.schema.json`](../../tooling/config.schema.json) is its machine
form. **Design it before the first content load** — content-before-schema was the original's canonical
mistake (ARCHITECTURE §7).

It is mechanism only. Every company-specific vocabulary, enum, field name, or path below is a
`{company-slot}` naming the manifest field that fills it — never a literal. The companion
[`frontmatter-fields.template.md`](frontmatter-fields.template.md) is the field-by-field table.

---

## 1. The node record — per-file frontmatter

Every graph-registered `.md` is a **node**; its YAML frontmatter is the node record. The contract has
exactly two required fields and a set of recognised optional **axis fields**.

**Required** (`{required-fields}` ← `frontmatter_schema.required_fields`):

- **`description`** — one line; what the node *is*. Drives search, the graph tooltip, and the catalog
  summary. A node with no `description` is effectively invisible.
- **`references`** — the node's typed cross-links (§2). When a node has no genuine cross-link yet, the
  field is kept and set to the empty sentinel `{no-ref-sentinel}` (← the `references: None` convention)
  — *never omitted*, so "no edges yet" is distinguishable from "field forgotten."

**Optional axis fields** (`{optional-fields}` ← `frontmatter_schema.optional_fields`) cluster on three
independent axes the tooling reads. None is required on a leaf; each is required only where the layer
that consumes it applies:

| Axis | Fields | What it expresses | Vocab slot |
|---|---|---|---|
| **Importance** | `tier`, `phase`, `vertical` | strategic weight, engagement state, product lane — *independent of recency* | `{tier-scale}`, `{phase-enum}`, `{verticals}` |
| **Lifecycle / freshness** | `status`, `valid_as_of`, `context` (§5) | where the doc is in its life, and as-of when | `{status-enum}` |
| **Structure / handling** | `node_kind` (§4), `supply_chain_role`, the avoid-read pair (§6) | derived-hierarchy role, supply-chain position, read-budget handling | `{node-kinds}`, `{supply-chain-roles}`, `{avoid-read-marker}` |

> **One fact, one place (ARCHITECTURE §7).** Each axis field is the *single* home of its fact. Do not
> restate a node's status in prose, a banner, *and* `status:` — pick the field. The original kept one
> fact in up to five places; the contract collapses each to one.

---

## 2. The typed node/edge graph

Three edge sources, in increasing authoring cost — **use the cheapest that carries the relationship**:

### 2a. Containment is free
The parent-folder ↔ child relationship is drawn **automatically** from the tree. You never author it.
The load-bearing rule: **never write a `references` edge that restates containment** — never reference
an ancestor or descendant directory, or any directory on your own containment line. That edge already
exists; an authored copy is redundant noise the validator flags.

### 2b. `references[]` — authored, typed, define-once
A `references` edge is for a **genuine cross-tree link only**: another location in the Drive the node is
meaningfully related to but is *not* its parent/child. Each edge carries:

```yaml
references:
  - path: {forward-slash relative path to the target node}
    type: {one value from the controlled edge vocab}     # see 2c
    note: {optional — why the link exists / the load-bearing difference}
```

- **Define once.** An edge is authored on **one** side; the graph renders it bidirectionally. Authoring
  it on both sides is a duplicate, not a reinforcement — pick the owning side (the schema's direction
  rule decides which) and define it there only.
- **Curated, not catalog.** `references` is for human-meaningful links. Mechanical folder-contents
  listings are the walker's job (the catalog files), never hand-authored references.

### 2c. The controlled edge-type vocabulary
`type` must be one value from `{edge-vocab}.valid` (← `vocab.edge_types.valid`). The full controlled
set is the manifest's; the **classes** of edge are mechanism and generalize:

| Edge class | What it links | MOT-instance values (`{edge-vocab}` slots) |
|---|---|---|
| relationship | entity ↔ entity in a supply/work relation | `{relationship-edges}` |
| document-flow | doc → its source / output / what it describes | `{docflow-edges}` |
| governance | doc ↔ the standard/convention/topic that governs it | `{governance-edges}` |
| lifecycle | version ↔ version across a supersession | `{lifecycle-edges}` |

Two sub-sets matter to the tooling and are their own slots:

- **`{edge-vocab}.legacy`** (← `vocab.edge_types.legacy`) — discouraged synonyms still present in old
  files (`{legacy-edges}`). The validator reports them low-severity, **not** invalid; never add more.
  This explicitly includes the ad-hoc `parent`/`child` edges that containment (2a) already draws.
- **`{edge-vocab}.provenance`** (← `vocab.edge_types.provenance`) — document-flow types
  (`{provenance-edges}`) whose dead target under a `{raw-archive-roots}` location (← `raw_archive_roots`)
  is **intentionally-archived source**, not drift (see §6 and the drift template's provenance carve-out).

---

## 3. Why "containment-free + define-once" is the whole trick

The graph is cheap to author *because* the structural backbone (containment) is implicit and every
cross-link is stated exactly once. This is what makes a flat markdown tree behave like a database
without a database: the expensive part (parentage) is free, and the authored part (cross-links) has no
duplication to keep consistent. **Mis-encoding parentage as a `parent`/`child` reference breaks this** —
it duplicates the free edge and drifts. That mistake is what `node_kind` (§4) exists to prevent.

---

## 4. `node_kind` — derived hierarchy, not authored

When a set of nodes forms a **hierarchy** (a product line with customer-specific builds nested under
it; a navigational index over a vertical), the hierarchy is **derived from containment + one flag** —
never from `parent`/`child` reference edges.

- A node carries `node_kind: {hierarchy-flag}` (a value from `{node-kinds}` ← `vocab.node_kinds`).
- The grouping (which nodes are its children/subprojects) is **read off containment** by the extractor —
  the direct-child relationship the tree already encodes — and surfaced in the derived JSON. It is *not*
  authored as references.
- Absent `node_kind` = an ordinary leaf node.

The `{node-kinds}` slot's values split into two roles (mechanism; MOT fills them as `{node-kind-roles}`):
a **family-parent** role (`{family-parent-kind}`) that *does* drive derived parent/subproject grouping
off containment, and **navigational-label** roles (`{label-kinds}`) that only mark the upper, purely
structural levels of a hub tree. Mis-flagging a label node as a family-parent is a derivation bug the
extractor warns on — so the flag's role is load-bearing, not cosmetic.

> **The rule in one line:** hierarchy is *containment + a flag the extractor reads*, never a hand-drawn
> edge. This is the §2a/§3 trick applied to multi-level structure.

---

## 5. The two-axis freshness model

"Is this current?" is **two independent questions**, and the contract keeps them as two fields so a
reader (human or agent) can answer both at a glance:

| Axis | Field | Answers | Vocab |
|---|---|---|---|
| **Lifecycle** — *where in its life* | `status` | Is this the in-force version, a never-adopted option, a replaced one, or background? | `{status-enum}` (← `vocab.status_enum`) |
| **Freshness** — *as-of when* | `valid_as_of` (frontmatter) and the TL;DR date-anchored key (§7) | When was this last known-good? | ISO date |

- **Independence.** A doc can be `status: {status-current}` yet stale (old `valid_as_of`), or recently
  touched yet `status: {status-superseded}`. Neither axis implies the other. Importance (`tier`) is a
  *third*, fully orthogonal axis — a dormant marquee account keeps its high tier.
- **`status` absent ⇒ treat as `{status-current}`**, *unless* a same-`context` sibling with a newer
  `valid_as_of` covers the same topic — then it is flagged for review (it may be silently superseded).
- **`context` scopes supersession (§5a).** Two docs only ever compete for supersession **within the
  same `context`**. Supersession is *never* evaluated across context boundaries.

### 5a. `context` — the confusable-workstream guardrail
`context` groups the docs of **one workstream**, drawn from the manifest's `{context-registry}` (←
`context_registry`). Its purpose is to stop parallel-but-distinct workstreams that **share vocabulary**
from silently overwriting each other (the canonical scar: two tester programs that reuse terms but must
never bleed). Each registry entry names its owning current-position file and its related-but-different
siblings *with a mandatory difference note* — that note is the load-bearing part. A workstream's docs
carry its registered `context` tag; if the tag doesn't exist yet, it is added to the registry first.

---

## 6. The TL;DR-head — a dual-purpose digest

Each entity Overview opens with a `## TL;DR` block of bold-key bullets. It is **two artifacts in one**:

1. **A human/agent digest.** Reading just the head (`Read --limit ~30`) yields status, next milestone,
   blockers, and recency — without loading the body. This is the read-budget convention's payoff (§7).
2. **The card's structured source.** The extractor parses **every** `**Key:** value` bullet generically
   into the entity card's fields. So the head is simultaneously prose *and* a parseable record.

The contract pins a **canonical required subset** (`{tldr-keys}.canonical` ← `frontmatter_schema.tldr_keys.canonical`)
that every Overview must carry, in order — the keys cards are guaranteed (`{tldr-canonical-keys}`). This
is **not an allow-list**: any *other* bold-key bullet is still extracted generically; the canonical set
is only the required/validated minimum.

- **One canonical key is the freshness anchor** (`{tldr-keys}.date_anchored_key` ←
  `frontmatter_schema.tldr_keys.date_anchored_key`, MOT = `{date-anchor-key}`): its value must **lead
  with an ISO date**, which drives the dashboard freshness dot. Alternate labels carrying the same
  date-anchored value live in `{tldr-keys}.date_anchored_synonyms` (`{date-anchor-synonyms}`) so an
  Overview need not be forced onto one label.
- Why a TL;DR date *and* `valid_as_of`: `mtime` is unreliable on synced-cloud storage, so freshness is
  keyed off an **authored** date, not the filesystem.

---

## 7. The read-budget convention — large-mutable → small-derived

Context-limited agents must read **summaries, not raw bulk** (ARCHITECTURE §1). The contract enforces
this with two mechanisms:

### 7a. The avoid-read marker
A large, high-churn file flags itself with the avoid-read pair (`{avoid-read-marker}` ←
`frontmatter_schema.avoid_read_marker`):

- `{avoid-read-flag-field}: {avoid-read-flag-value}` — "do not full-read this body."
- `{avoid-read-extractor-field}: {extractor-or-state-file}` — names the small derived artifact (a
  STATE roll-up, a JSON extract, or the file's own TL;DR head) to read **instead**.

The convention is **advisory, not a block**: targeted access (offset/limit read, grep, the extractor's
output) is always fine; a *full* read of a flagged body is what it discourages. Override when the
extractor doesn't surface what's needed — and note that you bypassed it.

### 7b. Derived state is regenerable; markdown is the source of truth
The heavy markdown is projected into **small derived state** — per-folder catalogs, a graph index,
extracted card/state JSON — that agents read in place of the bulk. **Markdown is always the source of
truth; every JSON/catalog/PDF is regenerable** and must never be hand-edited (the walker/extractor
overwrites it). This is why catalog files are excluded from the node-record rules of §1: their
`references` are folder contents the walker owns, not human graph registration.

---

## 8. Filling this contract for a new instance

There is **no per-instance edit of this document** — it is the mechanism. To instantiate:

1. **Fill the manifest**, not this file. Every `{company-slot}` above resolves from
   `company_profile.{frontmatter_schema, vocab, taxonomy, raw_archive_roots}` in a filled `manifest.json`
   (validated against `config.schema.json`). See [`frontmatter-fields.template.md`](frontmatter-fields.template.md)
   for the field→slot map.
2. **The B-tools are already pure functions of those slots** — the indexer, validator, extractor, and
   walker branch on the manifest's vocab/schema, so "instantiating the data-model" is just pointing them
   at the instance's manifest. No code edit per instance.
3. **Exemplify the rules.** Every `.md` the instance adds carries `description` + typed `references`
   (valid vocab only; containment free; define-once) — the contract preaches what its own files practice.
