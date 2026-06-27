---
description: The field-by-field frontmatter node-record table for the data-model contract — each frontmatter key, whether required, the axis it sits on, the {company-slot} vocabulary that constrains it, and the manifest field that fills it. Mechanism only; vocab values are {company-slot} markers, never literals.
references:
  - path: templates/data-model/data-model.template.md
    type: long-form
    note: The prose contract this table accompanies — §1 (node record), §4 (node_kind), §5 (two-axis freshness), §6 (TL;DR-head) explain each row.
  - path: tooling/config.schema.json
    type: standard
    note: The machine form — the "Fills from (manifest path)" column points into company_profile.* here.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Frontmatter fields — the node-record table

The per-file frontmatter keys the graph reads, by axis. **Req?** = required on every graph-registered
node. Vocab values are `{company-slot}` markers; the last column names the manifest field that supplies
the allowed set. None of these is a literal — fill the manifest, not this table.

## Required — the node minimum
| Field | Req? | What it is | Constraint / sentinel | Fills from (manifest path) |
|---|---|---|---|---|
| `description` | ✅ | One line; what the node *is* | non-empty | `frontmatter_schema.required_fields` |
| `references` | ✅ | Typed cross-links (define-once; valid vocab) | each `type` ∈ `{edge-vocab}.valid`; empty ⇒ `{no-ref-sentinel}`, never omit | `frontmatter_schema.required_fields`; `vocab.edge_types` |

## Importance axis — strategic weight (orthogonal to recency)
| Field | Req? | What it is | Constraint | Fills from |
|---|---|---|---|---|
| `tier` | — | Strategic importance, independent of activity | int in `[{tier-min}..{tier-max}]` | `vocab.tier_scale` |
| `phase` | — | Engagement state | ∈ `{phase-enum}` | `vocab.phase_enum` |
| `vertical` | — | Product lane | ∈ `{verticals}` | `vocab.verticals` |

## Lifecycle / freshness axis — the two-axis model (data-model §5)
| Field | Req? | What it is | Constraint | Fills from |
|---|---|---|---|---|
| `status` | — | Lifecycle: where in its life (absent ⇒ `{status-current}`) | ∈ `{status-enum}` | `vocab.status_enum` |
| `valid_as_of` | — | Freshness: as-of date last known-good | ISO `YYYY-MM-DD` | — (date, not vocab) |
| `context` | — | Workstream tag; scopes supersession + confusable guardrail | ∈ `{context-registry}` tags | `context_registry[].tag` |
| `decision_ref` | — | Link to the decision/supersession record | path/ref | — |

## Structure / handling axis
| Field | Req? | What it is | Constraint | Fills from |
|---|---|---|---|---|
| `node_kind` | — | Derived-hierarchy role (absent ⇒ leaf) | ∈ `{node-kinds}` | `vocab.node_kinds` |
| `supply_chain_role` | — | Supply-chain position of the entity | ∈ `{supply-chain-roles}` | `vocab.supply_chain_roles` |
| `{avoid-read-flag-field}` | — | "Do not full-read this body" flag | = `{avoid-read-flag-value}` | `frontmatter_schema.avoid_read_marker` |
| `{avoid-read-extractor-field}` | — | Names the small derived artifact to read instead | path/extractor | `frontmatter_schema.avoid_read_marker` |
| `tags` | — | Free labels | — | — |

## TL;DR-head bullets — the dual-purpose digest (data-model §6)
Not frontmatter — the bold-key bullets opening an entity Overview. The extractor parses **every**
`**Key:** value` bullet generically; the table below is only the *required/validated* subset.

| Bullet key set | Role | Constraint | Fills from |
|---|---|---|---|
| `{tldr-canonical-keys}` | Required canonical keys, in order; the fields cards are guaranteed | present, ordered | `frontmatter_schema.tldr_keys.canonical` |
| `{date-anchor-key}` | The one canonical key whose value leads with an ISO date (freshness dot) | value starts with `YYYY-MM-DD` | `frontmatter_schema.tldr_keys.date_anchored_key` |
| `{date-anchor-synonyms}` | Alternate labels carrying the same date-anchored value | treated as equivalent | `frontmatter_schema.tldr_keys.date_anchored_synonyms` |

> **Read-budget note (data-model §7).** Any *other* bold-key bullet is still extracted — this is a
> required-minimum, **not an allow-list**. Freshness is keyed off this authored date, never filesystem
> `mtime` (unreliable on synced-cloud storage).
