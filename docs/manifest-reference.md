---
description: Human-readable field-by-field reference for the knowledge-OS manifest (the C→B contract) — every company_profile and person_profile block, what it does, which tools read it, and a worked snippet. The narrative companion to the formal JSON Schema in tooling/config.schema.json.
references:
  - path: ../tooling/config.schema.json
    type: standard
    note: The formal JSON Schema (2020-12) this reference narrates; the schema is authoritative on types/required-ness.
  - path: ../tooling/manifest.example.json
    type: source
    note: The synthetic "Acme Optics" manifest every field below is illustrated from.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Manifest reference

The manifest is one JSON file that fully parameterizes the B-library. The formal contract is
[`../tooling/config.schema.json`](../tooling/config.schema.json) (JSON Schema 2020-12) — it is authoritative
on types and required-ness. This page is the **readable narration**: what each block is for and which tools
read it. The running example is the shipped [`../tooling/manifest.example.json`](../tooling/manifest.example.json)
("Acme Optics").

## Top-level shape

```jsonc
{
  "manifest_version": "0.1",
  "company_profile": { /* shared invariants — identical across a company's teammates */ },
  "person_profile":  { /* this instance's owner: focus, root override, local entities */ }
}
```

`config.schema.json` requires all three keys. `company_profile` is the **shared seed**; `person_profile` is
the only block an individual instance owns.

---

## `company_profile`

### `company`
`{ name, domain }`. Identity. `domain` drives internal-vs-external sender classification in the entity layer.

### `taxonomy` — the folder contract
- **`projects_root`** — the top folder projects live under (Acme: `Projects`; MOT: `__Projects`).
- **`project_tiers[]`** — one entry per tier folder: `{ folder, purpose, naming_convention, entity_card }`.
  `entity_card: true` means folders in this tier each become a company card (`kb-entities`, `kb-extract`).
- **`category_rules[]`** — **ordered, first-match** rules mapping a path to a category. Each is
  `{ match, match_kind, scope?, category }` with `match_kind` ∈ `regex` | `exact` | `first_segment` |
  `second_segment_of`. Lifecycle rules (superseded/archive) go **before** location rules. Read by `kb-index`
  (`deriveCategory`) and `kb-audit`.
- **`subfolder_convention[]`** / **`non_card_subfolders[]`** — expected sub-structure inside a project, and
  which subfolders are *not* their own entity card.

### `vocab` — the controlled vocabularies
- **`tier_scale`** `{ min, max, labels }` — the strategic-importance scale.
- **`phase_enum[]`** — engagement states (`engaged`/`acquisition`/`dormant`/`internal`/`archived`).
- **`verticals[]`** — the product lanes; `kb-focus` reports `focus_verticals` from this set.
- **`edge_types`** `{ valid[], legacy[], provenance[] }` — the reference-type vocabulary. `kb-audit` flags
  refs whose `type` is outside `valid` (and specially handles `legacy`/`provenance`).
- **`node_kinds[]`**, **`status_enum[]`**, **`supply_chain_roles[]`** — controlled enums for the matching
  frontmatter fields.
- **`document_kinds[]`** — `{ key, label, path_patterns }` classifying documents by path; `kb-focus` reports
  `focus_document_kinds` from these.

### `frontmatter_schema` — what a node carries
- **`required_fields[]`** / **`optional_fields[]`** — the frontmatter fields lifted onto every graph node.
  Add a field here and it flows onto every node automatically (`kb-index` is manifest-driven). `kb-audit`
  flags nodes missing a required field.
- **`tldr_keys`** `{ canonical[], date_anchored_key }` — the expected keys in a project's `## TL;DR` block;
  `kb-extract` parses them into cards, `kb-audit` checks coverage + that the date-anchored key is ISO.
- **`avoid_read_marker`** `{ flag_field, flag_value, extractor_field }` — how a large file signals
  "summarize me, don't full-read me" (e.g. `agent_read: avoid`).

### `context_registry[]` — the look-alike guardrail
One entry per workstream: `{ tag, what, owner, related:[{ tag, difference }] }`. The **`difference` notes are
load-bearing** — they keep confusable programs (e.g. two customers' tester programs) from bleeding specs into
each other. `kb-audit` flags a context whose `owner` is missing or unresolved.

### `entity_registry`
- **`people[]`** — `{ name, email, role, internal? }`. The people single-source-of-truth; `kb-entities`
  emits it verbatim and the entity-resolver matches senders against it. (A `companies` block is optional and
  largely derived from folder names — see the entity-registry template.)

### `excludes` — what the graph ignores
`{ dirs[], skip_names[], conflict_pattern, exclude_path_patterns[] }`. **Note the per-tool scoping:**
`kb-index` applies *only* `conflict_pattern` (so `_catalog.md` stays indexed); the walker-scoped `skip_names`
applies in `kb-walk`. `dirs` prunes directory traversal everywhere.

### `catalog_profile` — walker knobs (read by `kb-walk`)
`{ skip_exts[], ext_classification{}, default_type, skip_exact_names[], catalog_filename, walker_version,
max_depth }` — the file-type map and skip rules the `_catalog.md` generator mirrors from the native walker.

### `raw_archive_roots[]`
Top-level folders holding raw, intentionally-transient source (e.g. `raw`, `__temp`). A dead *provenance*
reference into one of these is reclassified by `kb-audit` as an intentionally-removed source, not real drift.

### `scan_roots[]`
The roots the tools walk (relative to `storage_profile.root`). `.` means the Drive root.

### `brand`, `input_adapters`, `cadence`
- **`brand`** — accent colors, fonts, `pdf_footer`, `web_qa_target` (used by render/QA tooling).
- **`input_adapters`** — `email` + `transcription` source descriptors (location, filename grammars, junk
  patterns, backend). Declares *where raw material lands*; the ingest skills consume whatever is present.
- **`cadence`** — sync period, publish day, the rolling-prep model, PDF render schedule.

### `storage_profile` — the safety-critical block
`{ kind, platform, root, protected_root_markers[], churn_guards, lock_guards }`.
- **`root`** — the absolute Drive root (forward slashes). The single most important field: every tool resolves
  paths from it.
- **`protected_root_markers[]`** — substrings that mark a **protected live Drive**. The migration
  `apply-moves` tool **hard-refuses `--apply`** on any root matching a marker. For the reference instance this
  is `OneDrive - MetaOptics`.
- **`churn_guards` / `lock_guards`** — synced-cloud no-clobber + EBUSY/EPERM retry behavior for migration.

---

## `person_profile`

### `person`
`{ name, email, role }` — the instance owner.

### `root_override`
An absolute Drive root that **wins over** `company_profile.storage_profile.root` for *this* instance. This is
how a teammate points the shared seed at their own machine without editing the seed.

### `focus` — filled by the focus gate, not by hand
`{ focus_verticals[], focus_tiers[], focus_contexts[], focus_entities[], focus_document_kinds[],
extra_entities[], extra_taxonomy[] }`. `kb-focus` proposes the `focus_*` values from what dominates the Drive;
a human approves them (Gate 1). **`extra_entities`** *adds to, never overwrites,* the shared
`entity_registry` — it's where a person records entities the seed lacks (a CFO's banks/auditors), and they
stay local. **`extra_taxonomy`** holds any tier a person needs that the shared taxonomy can't carry (usually
empty).

### `cadence_override`
Per-person overrides of the company `cadence` (usually empty).

---

## Minimum runnable manifest

The least a tool needs: `storage_profile.root` (or `person_profile.root_override`), `scan_roots`, and the
`taxonomy` / `vocab` / `frontmatter_schema` blocks. Start from
[`../tooling/manifest.example.json`](../tooling/manifest.example.json), point `storage_profile.root` at your
Drive, and edit outward. Validate against `config.schema.json` at every step.
