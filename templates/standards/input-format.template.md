---
description: Generalized input-format contract — the inbound-source (email/attachment archive) format spec: filename grammar, file-type inventory, body formats, junk patterns, and duplicate-cleanup status. Mechanism only; the archive location, grammar, junk globs, and extension map are {company-slot}s from the manifest.
references:
  - path: __Framework/tooling/config.schema.json
    type: standard
    note: Slots resolve from company_profile.input_adapters.email (location, filename grammar, body formats, junk patterns) + catalog_profile.ext_classification (file-type inventory).
  - path: __Framework/templates/standards/output-schema.template.md
    type: related
    note: §A of the output schema (forwarded-thread discipline, topmost-message extraction) consumes this input format.
status: current
context: framework-architecture
tags: [framework-meta]
---

# Input-format contract — the inbound-source archive

The format spec for the raw inbound archive (an email/attachment dump) that the ingest + cleanup skills
read. Every location, filename grammar, junk pattern, and extension is a `{company-slot}` from the
manifest's **`{email-adapter}`** (`input_adapters.email`) and **`{ext-map}`** (`catalog_profile.ext_classification`)
— the *spec shape* transfers; the *grammar* is re-derived per instance.

> **Adapter kinds.** `{email-adapter}.kind` selects the shape: a **flat export** (a directory of exported
> body + attachment files, the spec below) or a **mail API** (structured fetch — the grammar/junk sections
> collapse to API field mappings). The framework prefers a mail API; the flat-export spec is the fallback.

---

## Location

**`{archive-location}`** (`{email-adapter}.location`) — a flat directory (no subfolders except a
`cleanup/` staging folder and a derived-summaries folder). Files here are the **raw** source; their derived
`.md` summaries are the curated record.

## Filename grammar

The body-vs-attachment grammar comes from `{email-adapter}.body_filename_grammar` /
`.attachment_filename_grammar`. The generic shape (flat export):

```
{body-grammar}          ← email body — a body-marking token (e.g. double underscore) before the subject
{attachment-grammar}    ← attachment — an attachment-marking token (e.g. single underscore) before the name
```

- The **body-marking token** distinguishes a body file from an attachment file.
- Files sharing the same timestamp prefix belong to the **same** inbound item.
- Strip the source-export timestamp infix on ingest (lifecycle naming convention,
  [lifecycle](lifecycle.template.md) §7).

## File-type inventory

Body files use **`{body-formats}`** (`{email-adapter}.body_formats`); attachments span the document /
image / spreadsheet / presentation / CAD / archive / calendar types classified by **`{ext-map}`**
(`catalog_profile.ext_classification`). Each instance's inventory is read from those two manifest fields —
do not hardcode counts or extensions here.

## Body format

Body files are structured source (HTML-with-headers text, or a JSON envelope with metadata + HTML body) per
`{body-formats}`. The ingest skill parses headers (From / To / CC / Subject / Date) + body, then applies the
forwarded-thread discipline in [output-schema](output-schema.template.md) §A.

## Junk patterns (cleanup reference)

The cleanup skill stages — **never deletes** — files matching **`{junk-patterns}`**
(`{email-adapter}.junk_patterns`). Generic classes:

- **Inline-signature / formatting images** (e.g. `image00*`-style auto-named inline images) — almost always
  signature logos or layout icons.
- **Client-generated inline artifacts** (e.g. `Outlook-*`, `ATT0*`) — mostly 0-byte or tiny icons.
- **Zero-byte placeholders** — extraction artifacts with no data.
- **Real attachments** have descriptive names — keep them.

Cleanup moves matches to the `cleanup/` staging folder (a Tier-2 restructure, [lifecycle](lifecycle.template.md)
§8 — announce the moves); permanent deletion from the raw archive is forbidden. Numbered-asset suffixes
(`-1`, `-N`) are **not** conflicts — never dedupe them.

## Duplicate-cleanup status

Record the archive's de-duplication state as a dated note: when analysis ran, confirmed duplicates (with the
keep-vs-stage decision), the zero-byte-placeholder count, and the resulting unique fraction. This is an
instance-specific record (a worked output), not part of the reusable spec — keep it in the instance's own
copy, regenerated when the archive is re-analysed.

---

## Provenance note

The raw archive lives under **`{raw-archive-roots}`** (`raw_archive_roots`). A dead `{provenance-edge}` (a
document-flow `source`-class) reference whose target is under this root is **intentionally-removed-source
provenance, not drift** — the drift auditor reclassifies it to a low-severity finding rather than a broken
edge (see [drift-detection](../drift-detection/SPEC.md) §3 and [graph-wiring](graph-wiring.template.md) §3).
