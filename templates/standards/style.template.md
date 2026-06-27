---
description: Generalized writing-style contract — emphasis, formatting, tone, and document-specific rules for all generated content (syncs, overviews, timelines, to-do lists, summaries). Mechanism only; staff names and section vocabulary are {company-slot}s from the manifest.
references:
  - path: __Framework/tooling/config.schema.json
    type: standard
    note: Slots resolve from company_profile.entity_registry.people (staff names to keep out of public copy) + brand.
  - path: __Framework/templates/standards/output-schema.template.md
    type: related
    note: The periodic report's anonymisation + voice rules elaborate the public-vs-private staff-naming rule this contract states.
status: current
context: framework-architecture
tags: [framework-meta]
---

# Style contract — formatting, tone, emphasis for all generated content

Applies to **all** generated content: periodic syncs, project overviews, timelines, to-do lists,
conversation/meeting summaries. The rules are generic; the staff names and section labels are
`{company-slot}`s from the manifest.

---

## Emphasis and formatting

- **No ALL CAPS for emphasis** (not "COMPLETED" / "ACTIVE" / "NEW") — write normal case.
- **No bold (`**text**`) for emphasis in body text.** Bold is reserved only for:
  - Section headers (e.g. `## **{SECTION}**`)
  - Entity (company / partner / vendor) name labels — on their own line, or the bolded first cell of a
    category table (`**{Entity}**<br>*descriptor*`)
  - An optional single `**keyword**` flag in a status cell
  - Priority labels in to-do tables (the one table-cell exception)
- **Never bold** dates, filenames, amounts, or key facts inside bullets/paragraphs.
- Emphasis comes from **placement, structure, and action items** — not visual formatting. Leave visual
  emphasis for the human to apply manually.

## Tone and language

- Concise, factual prose: what happened, the status, what needs to happen next.
- **No dramatic / urgent language** ("critical bottleneck!!" → "bottleneck: …").
- **No filler** ("importantly", "notably", "significantly", "it should be noted that").
- Plain dates ("Mar 3", "Feb 27") — add the weekday only when the day-of-week is relevant.
- Short sentences; one fact per bullet where possible.
- **Never use direct quotes** from emails or people — rephrase quoted content as plain factual statements.
  (`Mark: "get an NDA in place"` → `<Steerer> asks the team to get an NDA in place`.) Quotes add drama where
  the goal is neutral reporting. The only exception is formal document titles (e.g. press-release titles),
  quoted for identification.

## Events table formatting

- Events in **chronological order** (earliest first).
- Every date includes the correct weekday, **verified programmatically** (e.g.
  `python3 -c "from datetime import datetime; print(datetime(YYYY,M,D).strftime('%a'))"`).
- Format: `| 13 Mar (Fri) |` or `| Mon 23 Mar – Sat 04 Apr |` — always include the weekday.
- TBD / undated items sort to the bottom, after all dated items. Same rule for the to-do list's key-dates table.

---

## Staff-naming rule (public vs internal)

Generated content distributed across the company names **no internal staff** (`{staff}` =
`entity_registry.people` where `internal:true`) in action items or status wording; per-person assignment is
not its job. The internal/working copy preserves named owners as the source states. **`{exec}` is never named
anywhere** (neither public nor internal) — executive-level involvement is implicit. External-party names are
always kept (they flag where a dependency lives). The full mechanism (rewrite examples, anonymisation pivot)
is in [output-schema](output-schema.template.md) §A/§E.

## Document-specific rules

### Periodic sync
- Each section is **self-contained** — a reader understands the current state without last period's doc.
- **Public sync is category-first** (the [output-schema](output-schema.template.md) §J layout): product-category
  `###` groups, entities as rows; **no `>` action-item blockquotes** (those live in the internal sync + to-do
  list). The **internal** sync stays entity-first.
- Action items (`>` blockquotes, concise one-line imperatives) appear only in the internal sync + the to-do list.
- **Remove fully-resolved items** — no "DONE" rows linger in the sync (those belong to the to-do list history).
- Images use `<img>` tags with italic captions below; keep tables compact, drop irrelevant rows.

### Sub-project overviews
- Reference documents that **accumulate** over time; source citations with dates; concrete numbers/specs/pricing,
  never vague; timeline sections have actual dates.

### Timelines
- Week-by-week matrix: short entries (5–15 words/cell) + a detailed-notes section below; status in normal case.

### To-do lists
- Status column in normal case ("carried fwd", "new", "in progress", "done").
- **No strikethrough** for completed items — **remove** them entirely to keep the list clean.
- Priority labels are the one exception where bold is used in table cells.
