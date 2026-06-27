---
description: The governance-stack template index — the eight generalized Standards contracts (placement, lifecycle, quality, style, info-distribution, output-schema, input-format, graph-wiring) that any instance fills from its manifest. Mechanism only; values live in the manifest.
references:
  - path: __Framework/tooling/config.schema.json
    type: standard
    note: The manifest schema whose company_profile slots every contract's {company-slot} markers bind to.
  - path: __Framework/templates/README.md
    type: related
    note: The templates layer this standards/ stack sits inside — mechanism vs company-slot split.
  - path: __Framework/templates/drift-detection/SPEC.md
    type: related
    note: The drift auditor is the SENSOR that enforces these contracts at steady state; this stack is its setpoint half.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# standards/ — the generalized GOVERNANCE stack

The eight reusable **contracts** a knowledge-OS runs on, generalized from MOT's worked
`__Operations/Documentation/Standards/` (+ `__Projects/README_Folder_Guidelines.md`). Each is the
generic **rule shape**; every company-specific vocabulary / enum / verticals / staff value is a
`{company-slot}` naming the **manifest field** that fills it (`company_profile.*`). Templates carry
*how*; the manifest carries *what*.

> This stack is the control loop's **setpoint** (desired state). The
> [drift-detection](../drift-detection/SPEC.md) template is the **sensor** that measures deviation from
> it; the org/sync skills are the **actuators**. Fill these eight + the manifest and an instance has its
> governance.

## The eight contracts

| Template | Generalizes (MOT) | The contract it carries | Primary slot sources |
|---|---|---|---|
| [placement.template.md](placement.template.md) | `README_Folder_Guidelines.md` (Rules 1–12) | where a file/folder lives: tiers, supplier-vs-customer split, location≠owner, duplicate-merge, archive gate, nested-subproject hub | `taxonomy.{project_tiers,category_rules,subfolder_convention}`, `vocab.{verticals,node_kinds}` |
| [lifecycle.template.md](lifecycle.template.md) | `Status_Lifecycle.md` | the `status` enum, `context` registry guardrail, supersession edge, current-position block, decision records, autonomy tiers | `vocab.{status_enum,edge_types}`, `context_registry`, `taxonomy.category_rules` |
| [quality.template.md](quality.template.md) | `Quality_Standards.md` | the TL;DR-card contract + Overview content/freshness requirements | `frontmatter_schema.tldr_keys`, `vocab.phase_enum` |
| [style.template.md](style.template.md) | `Writing_Style_Guide.md` | emphasis / tone / formatting rules for all generated content | `entity_registry.people`, `brand` |
| [info-distribution.template.md](info-distribution.template.md) | `Information_Distribution.md` | the three-view data model (Overviews · sync snapshot · timelines) + engagement-tracking rule | `cadence`, `vocab.verticals`, `entity_registry` |
| [output-schema.template.md](output-schema.template.md) | `Sync_Content_Schema.md` | the periodic-report output schema (public/private layouts, extraction rules, anonymisation, QA gate) | `cadence`, `vocab.{verticals,tier_scale}`, `entity_registry.people` |
| [input-format.template.md](input-format.template.md) | `Email_Archive_Format.md` | the inbound-source format spec (filename grammar, file-type inventory, junk patterns) | `input_adapters.email`, `catalog_profile.ext_classification` |
| [graph-wiring.template.md](graph-wiring.template.md) | `Reference_Graph_Schema.md` | the typed-`references[]` cross-link schema, edge vocabulary, define-once + containment-free rules | `vocab.{edge_types,node_kinds}`, `frontmatter_schema.required_fields` |

## The `{company-slot}` convention (recap)

Every `{curly-marker}` below names the manifest path that fills it — a literal in a template is a bug
(it belongs in the manifest). Recurring ones across this stack:

| Marker | Manifest path |
|---|---|
| `{tiers}` | `company_profile.taxonomy.project_tiers[]` (`folder` + `purpose` + `entity_card`) |
| `{archive-tier}` | the `project_tiers[]` entry whose `category_rules` bucket = `archive` |
| `{category-rules}` | `company_profile.taxonomy.category_rules[]` |
| `{subfolders}` | `company_profile.taxonomy.subfolder_convention[]` |
| `{verticals}` | `company_profile.vocab.verticals[]` |
| `{status-enum}` | `company_profile.vocab.status_enum[]` |
| `{phase-enum}` | `company_profile.vocab.phase_enum[]` |
| `{tier-scale}` | `company_profile.vocab.tier_scale` (`min`/`max`/`labels`) |
| `{edge-vocab}` | `company_profile.vocab.edge_types.{valid,legacy,provenance}` |
| `{node-kinds}` | `company_profile.vocab.node_kinds[]` |
| `{required-fields}` | `company_profile.frontmatter_schema.required_fields[]` |
| `{tldr-keys}` / `{date-anchored-key}` | `company_profile.frontmatter_schema.tldr_keys.{canonical,date_anchored_key}` |
| `{context-registry}` | `company_profile.context_registry[]` |
| `{staff}` / `{exec}` | `company_profile.entity_registry.people[]` (`internal:true`; `{exec}` = the never-named one) |
| `{cadence}` / `{publish-day}` | `company_profile.cadence.{sync_period,publish_day}` |
| `{email-adapter}` | `company_profile.input_adapters.email` |

## Filling the stack

1. Compose the manifest (`tooling/config.schema.json` → a filled `manifest.json`) — the only place values live.
2. Copy these eight templates into the instance's governance folder; resolve every `{slot}` from the manifest.
3. The skills + the drift auditor already read the manifest, so a filled template is *documentation of* the
   wired contract — not a second source of values.
4. Keep markdown the source of truth; exemplify the graph rules ([graph-wiring.template.md](graph-wiring.template.md)).

Extracted from proven MOT Standards — never speculated ahead of a worked instance (ARCHITECTURE §10).
