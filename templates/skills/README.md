---
description: The WORKFLOW skill templates — generalized from MOT's .claude/commands/ into reusable, manifest-parameterized orchestrator skeletons (periodic-sync, ingest-cleanup, drift-fix). Mechanism only; every company value is a {company-slot} naming its manifest field.
references:
  - path: templates/README.md
    type: sibling
    note: The parent templates layer this skills sub-library belongs to; that doc states the {company-slot}/manifest split these skills obey.
  - path: tooling/config.schema.json
    type: standard
    note: Every {company-slot} in these skills binds to a field of this manifest schema — the single source of filled-in values.
  - path: ARCHITECTURE.md
    type: related
    note: §6 layer 4 (Skills / workflows) is the model these templates materialize — thin procedure over Standards, ending by regenerating derived indexes.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# templates/skills/ — the reusable workflow layer

The framework's **skill (workflow) library** — the generalized form of an instance's
`.claude/commands/`. Each template is the *shape* of one recurring operation, extracted from a proven
MOT skill, with every company-specific value replaced by a `{company-slot}` marker that names the
**manifest field** it draws from. The skill body is **thin procedure**; the substance (placement rules,
content schema, lifecycle) lives in the instance's Standards, which the skill cites by `{standard-…}`
slot — never inlines.

> **Mechanism vs slot (ARCHITECTURE §2):** a skill template that hardcodes a tier name, a folder path,
> an enum value, a person, a cadence, or a tool path is a bug. All of those resolve from `manifest.json`
> (`tooling/config.schema.json`). The template carries the *workflow control-flow*; the manifest carries
> the *values*.

## The four workflow archetypes (and which MOT skill each generalizes)

| Template | Archetype | Generalizes (MOT) | Niche helpers it deliberately excludes |
|---|---|---|---|
| [periodic-sync.template.md](periodic-sync.template.md) | **the periodic-sync orchestrator** — ingest → per-thread/meeting summaries → port by placement rules → refresh per-entity overviews → two-audience roll-up + QA gate → to-dos → regenerate derived indexes (+ a drift sweep) | `mot-sync` | — |
| [ingest-cleanup.template.md](ingest-cleanup.template.md) | **the safe-janitor** — stage adapter junk to a review folder, flag borderline, dedupe recurring assets; never deletes | `email-cleanup` | — |
| [meeting-ingest.template.md](meeting-ingest.template.md) | **the meeting-ingest** — raw transcript+frames → speaker-ID'd, QA'd meeting summary → overview/sync feed (sub-skill of periodic-sync) | `video-process` | `clip` (web-clip cutter) |
| [drift-fix.template.md](drift-fix.template.md) | **the drift-fix actuator** — read-only audit → dry-run → gated tier-1 auto-fix → tier-2/3 decision list → re-audit | `drift-fix` | — |

**Out of the core (named, not built here).** The niche helpers stay instance-local: `clip` (cut
web-efficient looping clips from source video for the website) and `web-qa` (drive the public site in a
browser to walk flows / check responsive). They are company-product utilities, not the reusable
knowledge-OS workflow, so they are **not** generalized into this library.

## The {company-slot} convention (recurring slots these skills use)

Every `{curly-brace}` marker names the manifest path it resolves from. The recurring ones:

| Marker | Manifest path | MOT example |
|---|---|---|
| `{drive-root}` | `storage_profile.root` (or `person_profile.root_override`) | the absolute OneDrive root |
| `{hub-file}` · `{state-file}` | `category_rules` (`hub` / `state`) | `CLAUDE.md` · `STATE.md` |
| `{scan-roots}` | `scan_roots` | `__Projects`, `__Operations/Documentation`, … |
| `{entity-tiers}` | `taxonomy.project_tiers[]` (`entity_card:true`) | Aquisition, Internal, Collaboration, Archive |
| `{placement-rules}` | `{standard-placement}` (cites taxonomy + subfolder_convention) | README_Folder_Guidelines Rules 1–N |
| `{subfolder-convention}` | `taxonomy.subfolder_convention` | `Documentation/Specs`, `Meetings`, … |
| `{archive-tier}` | `category_rules` (`category === 'archive'`) | `__Projects/Archive/` |
| `{required-fields}` · `{edge-vocab}` · `{status-enum}` | `frontmatter_schema.required_fields` · `vocab.edge_types` · `vocab.status_enum` | `description`,`references` · valid/legacy edge types · status enum |
| `{tldr-keys}` | `frontmatter_schema.tldr_keys` | `Status`,`Next milestone`,`Open blockers`,`Last activity` |
| `{email-adapter}` · `{transcription-adapter}` | `input_adapters.email` · `input_adapters.transcription` | flat Outlook export · external transcription pipeline |
| `{raw-archive-roots}` | `raw_archive_roots` | `__temp` |
| `{cadence}` | `cadence` | weekly, publish Tuesday, rolling-prep |
| `{sync-schema}` · `{quality-standard}` · `{style-standard}` · `{lifecycle-standard}` · `{context-registry}` | the instance's Standards stack + `context_registry` | Sync_Content_Schema, Quality_Standards, … |
| `{people-registry}` | `entity_registry.people` | the Key People table |
| `{walker-tool}` · `{indexer-tool}` · `{extractor-tool}` · `{state-tool}` · `{audit-tool}` · `{fixer-tool}` · `{pdf-tool}` | the instance's wired B-library | `mot-walker.exe` · `kb-index` · `kb-extract` · `tracker-status` · `kb-audit` · `drift-fix` · `sync-report-pdf` |

## Filling a skill template for a new instance

1. **No per-instance body edit by default.** The B-tools each skill calls are already pure functions of
   `manifest.json`; "filling" is wiring the skill at the instance's manifest + Standards, not rewriting
   the procedure. Resolve each `{slot}` against the manifest / Standards listed above.
2. **Cite, don't inline.** Substance stays in Standards; the skill body links them by `{standard-…}`
   slot. Keep skills thin (the MOT skills are ~1–2 screens; substance lives in `Standards/`).
3. **Adapter-first.** The `input_adapters` answer (email-heavy / meeting-heavy / doc-dump) picks which
   ingest adapter ships first; the orchestrator is adapter-agnostic above the adapter seam.
4. **End by regenerating every derived index.** Markdown stays source of truth; all JSON / catalogs /
   PDF / STATE are regenerable and must be regenerated at the end of a run.
5. **Exemplify the graph rules** — every `.md` an instance adds via these skills carries
   `{required-fields}` + typed `references` (`{edge-vocab}` valid vocab only; containment is free, never
   `parent`/`child`; define each edge once).

Templates are extracted **from proven MOT skills**, never speculated ahead of one (ARCHITECTURE §10).
