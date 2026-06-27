---
description: Generalized graph-wiring contract — the typed references[] cross-link schema: entry format, the define-once + containment-free rules, the controlled edge-type vocabulary, node_kind structural roles, topic hubs, and the validator. Mechanism only; the edge vocab, node_kinds, and required fields are {company-slot}s from the manifest.
references:
  - path: __Framework/tooling/config.schema.json
    type: standard
    note: Slots resolve from company_profile.vocab.{edge_types,node_kinds} + frontmatter_schema.required_fields.
  - path: __Framework/tooling/kb-index.mjs
    type: tool
    note: The frontmatter graph indexer that reads references[] into the graph; the consumer of this contract.
  - path: __Framework/templates/standards/lifecycle.template.md
    type: related
    note: The lifecycle/supersession edge subset is defined + governed there; this contract covers the non-lifecycle vocabulary.
status: current
context: framework-architecture
tags: [framework-meta]
---

# Graph-wiring contract — typed `references[]` cross-links

What a *good* `references[]` entry looks like, what the edge **types** mean, and how to keep the graph free
of dead edges. Companion to the "every `.md` carries `description` + `references`" rule. The edge vocabulary,
node-kind set, and required fields are `{company-slot}`s; the wiring rules are generic.

## TL;DR

- A reference is a **typed, directional cross-link** between two graph nodes (files/folders), declared in the
  **source** file's YAML frontmatter as a list of `{ path, type, note? }` objects.
- The dashboard renders every edge in **both directions**. **Define each edge exactly once** — never a
  reciprocal/mirror entry.
- **Containment is free.** The parent-folder ↔ child relationship is drawn automatically. Never reference an
  ancestor/descendant in your own path, and never restate containment as an edge.
- Curated cross-links live on **human-maintained** files (Overviews, key docs, whitepapers, meeting records,
  standards, timelines). **Auto-generated catalog files** are owned by the walker — do not hand-curate their
  references (overwritten every walk).
- Run the **ref validator** (`{ref-validator}`) after editing to confirm no target is broken.

## 1. Entry format

```yaml
references:
  - path: <root-relative, forward slashes>     # the target node (.md, folder, or binary asset)
    type: <from {edge-vocab}>                   # controlled vocabulary (§3)
    note: "<optional human-only gloss on WHY>"  # ignored by rendering; documents intent
```

- **`path`** (required) — root-relative preferred (unambiguous, survives moves better than `../`).
- **`type`** (required) — the most specific term from `{edge-vocab}`. Reads as **"the *target* plays role
  *type* relative to the *source*."**
- **`note`** (optional) — short free-text gloss; ignored by graph rendering, the place for nuance. (No
  numeric `strength`/`weight` field — nothing consumes it.)

When a file genuinely has no cross-tree link yet, keep `references: None` (or `[]`) rather than deleting the
field — real links accrue over time. *(The drift auditor backfills a truly-absent `references` to `None` as a
safe Tier-1 auto-fix.)*

## 2. Direction & "define once"

Edges are **bidirectional in the view but single in the data** — writing the reverse on the target creates a
duplicate cycle (noise). **Declare the edge on the more specific / dependent / downstream node**, pointing
"up" the value or knowledge chain:

| Declare on (source) | Pointing to (target) | Typical type |
|---|---|---|
| Customer project | the supplier / equipment / platform it uses | `{supplies}`, `{tests-with}`, `{assembles}`, `{integrates-with}` |
| Sold-equipment record | the product/project it came from | `{related}`, `{builds-on}` |
| Whitepaper / brochure | the project/product it describes | `{describes}`, `{related}` |
| Meeting record | the project(s) discussed; the recording | `{related}`/`{describes}`; `{source}` |
| Analysis / derived doc | the data, tool, or source behind it | `{source}`, `{source-data}`, `{tool}` |
| Overview | the Timeline it feeds | `{output}` |
| Any doc | the Standard that governs it | `{standard}` |

## 3. Controlled type vocabulary

The valid set is **`{edge-vocab}.valid`** (`vocab.edge_types.valid`); pick the most specific. The generic
families an instance's vocabulary populates:

| Family | Role | Typical types |
|---|---|---|
| **Supply-chain & commercial** | target is a node in the source's value chain | `{customer}`, `{supplies}`, `{tests-with}`, `{assembles}`, `{integrates-with}`, `{substrate}`, `{pairs-with}` |
| **Collaboration & thematic** | general / research / family relationships | `{related}` (default), `{researches}`, `{sibling}` |
| **Document flow** | how a doc derives from / feeds another | `{source}`, `{source-data}`, `{input}`, `{output}`, `{tracks}`, `{describes}`, `{tool}`, `{asset}` |
| **Governance & process** | the governing standard / convention / trigger | `{standard}`, `{convention}`, `{trigger}` |
| **Lifecycle & version** | supersession + evolution (see [lifecycle](lifecycle.template.md)) | `{superseded_by}`/`{supersedes}`, `{archive}`/`{live}`, `{builds-on}`/`{extends}`/`{follows}` |
| **Fallback** | nothing above fits | `{references}` |

**Avoid going forward:** the deprecation synonyms in **`{edge-vocab}.legacy`** (`vocab.edge_types.legacy`) —
e.g. a singular `reference`, a `relates_to`, a `consumer`, or an ad-hoc `parent`/`child` where containment
already says it. These remain in old files; don't mass-rewrite, just don't add more. *(The drift actuator
auto-repoints only the unambiguous 1:1 legacy mappings; the containment-vs-cross-link cases are gated.)*

## 4. Curated vs. auto-generated references

| File kind | Who maintains `references[]` | Cross-tree links here? |
|---|---|---|
| Overviews, key docs, whitepapers, brochures, meeting records, standards, timelines | human / agent (curated) | **Yes** — the home for meaningful cross-links |
| auto-generated catalog files (`{catalog-name}`) | the walker (auto; lists folder contents; overwritten each walk) | **No** — hand edits are lost |

## 5. Validation & regeneration

```bash
{ref-validator}      # flag every reference whose target does not resolve on disk (dead edges)
{graph-build}        # rebuild the slim graph index consumed by the dashboard + agents
{catalog-walk}       # refresh catalog files after adding/moving files
```

A reference whose target doesn't resolve renders **no edge** (silently dropped). Broken targets are usually
**path drift** after a folder move — fix the path, don't delete the intent. On a folder move: move →
regenerate catalogs (relocation-safe `--force`) → run `{ref-validator}` → repoint the flagged **curated**
cross-references by hand (intent can't be inferred).

## 6. Topic ("artificial") nodes

A relationship that is real but **thematic** (two entities connected only by a shared subject, not a direct
interaction) is not forced into a pairwise edge. Both members instead point at a **topic hub node** — a small
doc carrying `node_kind: {topic}` (one of `{node-kinds}`, `vocab.node_kinds`) and `references: None` — with a
`{topic-edge}` edge. The hub renders as a navigable cluster and avoids spurious direct edges. Meeting records
that don't map cleanly to one project are good topic-link candidates.

## 6a/6b. Structural-role node kinds (`node_kind`)

Project structure (product families, subprojects) and the navigational hub levels are expressed by
**containment + the `node_kind` flag** (one of `{node-kinds}`), **never** by `parent`/`child` reference edges:

- **`{product-parent}`** — a product line with customer-specific / vertical-split builds nested under it
  (derived from containment by the extractor; subprojects are not authored as references). A customer-build
  subproject declares exactly **one** `{customer}` edge → the customer's Overview (the product-parent itself
  carries none — its customers are reachable transitively). Nests to the dashboard's depth cap.
- **`{program-root}`** / **`{vertical-index}`** — the entity hub root and its per-vertical index pages
  ([placement](placement.template.md) Rule 12). **Non-tile, non-parent** navigational labels; only
  `{product-parent}` drives parent/subproject derivation.
- **absent** = an ordinary leaf node.

Full role set = `{node-kinds}`. Mis-flagging a label node as `{product-parent}` is caught by an extractor warning.
