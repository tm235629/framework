---
description: The templates layer — what the reusable mechanisms with {company-slot} markers are, and how a new instance fills them. Templates carry the shape; the manifest carries the values.
references:
  - path: ARCHITECTURE.md
    type: related
    note: §2 (mechanism vs company-slot) and §6 (the six layers) are the model these templates materialize.
  - path: tooling/config.schema.json
    type: standard
    note: The manifest schema whose slots every template's {placeholders} bind to — the single source of filled-in values.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# templates/ — the reusable mechanism layer

This is the framework's **mechanism library**: each template is a *reusable shape* — a pattern, a
contract, a tool-wiring — written once and carried verbatim onto any Drive. The company-specific
**values** are not in here; they live in the **manifest** (`tooling/config.schema.json` → a filled
`manifest.json`). A template is the seam's other side: where the manifest holds *what*, the template
holds *how*.

> **The split (ARCHITECTURE §2):** *mechanism* transfers; *company-slot* is re-derived per instance.
> A template that hardcodes a company's vocabulary, enum, or path is a bug — that belongs in the
> manifest. Templates parameterize everything company-specific behind a marker.

## The `{company-slot}` marker convention

Every place a template would otherwise name a MOT-specific value carries a `{curly-brace}` placeholder
naming the **manifest field** it draws from — not a literal. A few recurring ones:

| Marker | Filled from (manifest path) | MOT example |
|---|---|---|
| `{scan-roots}` | `company_profile.scan_roots` | `__Projects`, `__Operations/Documentation`, … |
| `{excludes}` | `company_profile.excludes` | `node_modules`, `_catalog.md`, conflict pattern |
| `{category-rules}` | `company_profile.taxonomy.category_rules` | `Archive/` → `archive`, `_superseded/` → `superseded` |
| `{edge-vocab}` | `company_profile.vocab.edge_types.{valid,legacy,provenance}` | `customer`, `supplies`, … / `relates_to` / `source` |
| `{status-enum}` | `company_profile.vocab.status_enum` | `current`, `draft`, `superseded`, `legacy`, `exploratory` |
| `{required-fields}` | `company_profile.frontmatter_schema.required_fields` | `description`, `references` |
| `{tldr-keys}` | `company_profile.frontmatter_schema.tldr_keys` | `Last activity` (date-anchored) |
| `{archive-tier}` | derived from `{category-rules}` (`category === 'archive'`) | the `Archive/` tier |
| `{raw-archive-roots}` | derived from `input_adapters` locations | `__temp/` |

## How a new instance fills a template

1. **Fill (or compose) the manifest** — copy the shared `company_profile` seed, run the C modules
   (focus-detector et al.) to fill the `person_profile`. The manifest is the only place values live.
2. **Wire the template's tool** at the manifest, not the values — the B-tool a template points at
   (e.g. `tooling/kb-audit.mjs`) is already a pure function of the manifest, so "filling" is just
   passing the instance's `manifest.json`. No code edit per instance.
3. **Keep markdown the source of truth** — templates emit derived artifacts (JSON reports, catalogs);
   those regenerate. Never hand-edit a derived file a template owns.
4. **Exemplify the graph rules** — each `.md` you add carries `description` + typed `references`
   (valid vocab only; containment is free, never `parent`/`child`; define each edge once).

## What's here

| Template | Mechanism it carries |
|---|---|
| [drift-detection/](drift-detection/) | The standing-sensor pattern: a manifest-driven drift auditor + the autonomy-tiered actuator routing + the drift-report artifact. The reusable B-tool is `tooling/kb-audit.mjs`. |

Templates are extracted **from proven MOT artifacts**, never speculated ahead of one (ARCHITECTURE §10).
A slice graduates here only after it is built and validated on Instance Zero.
