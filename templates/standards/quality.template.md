---
description: Generalized quality contract — the TL;DR dashboard-card contract + content/freshness requirements for project Overview files. Mechanism only; the canonical TL;DR keys, freshness anchor, and phase enum are {company-slot}s from the manifest.
references:
  - path: tooling/config.schema.json
    type: standard
    note: Slots resolve from company_profile.frontmatter_schema.tldr_keys (canonical + date_anchored_key) and vocab.phase_enum.
  - path: tooling/kb-extract.mjs
    type: tool
    note: The card extractor that parses the TL;DR block into dashboard project cards — the consumer of this contract.
status: current
context: framework-architecture
tags: [framework-meta]
---

# Quality contract — Overview content & the dashboard-card TL;DR

Content, freshness, and attachment-integration rules for project `Overview.md` files. Applies whenever an
Overview is updated (during the periodic sync or a direct update request). The TL;DR keys and freshness
anchor are `{company-slot}`s; the *requirements* are generic.

---

## TL;DR block (dashboard card contract)

Every project `Overview.md` opens (right after the `# Title`) with a `## TL;DR` block of the **canonical
bullets `{tldr-keys}`** (`frontmatter_schema.tldr_keys.canonical`), in order. The card extractor
(`kb-extract`) parses them into the dashboard project card; the freshness dot keys off the
**`{date-anchored-key}`** bullet (`tldr_keys.date_anchored_key`), which must lead with an ISO date.

```markdown
## TL;DR
- **{tldr-key-1 (status)}:** <one line — current phase + what is happening now>
- **{tldr-key-2 (next milestone)}:** <the next concrete step + date if known>
- **{tldr-key-3 (open blockers)}:** <what is blocking, or omit the bullet entirely if none>
- **{date-anchored-key}:** YYYY-MM-DD — <what happened>
```

Rules:
- Use the **exact** bold keys from `{tldr-keys}` (the parser keys on `- **Key:**`). The `{date-anchored-key}`
  bullet must lead with an ISO date so the freshness dot works.
- Omit the "open blockers" bullet when there are none — the card hides the slot rather than showing "none".
- This block is the card's source of truth; keep it in sync with the body's current-state section. A missing
  slot falls back (description first sentence / file mtime) but reads as second-class — author the keys.
- **Extra descriptive bullets are allowed** after the canonical ones (e.g. a `{product-parent}` line may add a
  product / headline-specs bullet). The parser keys each bullet independently; extras are surfaced where
  relevant and ignored by the card slots — just keep the canonical set present.

---

## Content requirements

- **Cite specific source items** by date + subject when referencing decisions, quotes, or commitments
  (e.g. "Per email YYYY-MM-DD, <entity> confirmed <fact>").
- **Include concrete data** from attachments: specs, measurements, pricing, part numbers, dimensions,
  tolerances. Put the actual numbers in — do not summarize vaguely.
- **Embed or reference attachment content directly.** A spec PDF → include the key tables + reference the
  path. A design/measurement image → save a copy into the project folder (e.g. `<project>/figures/`) and
  reference it with `![description](figures/filename.png)`.
- **Quote exact specifications** verbatim from source documents — part numbers, dimensions, tolerances,
  pricing, lead times — never paraphrased.
- **Timeline entries must have dates** — every milestone/delivery/event has an actual date, not "recently"
  or "soon".

## Currency & freshness requirements

- **Every Overview has a "Current State" section** near the top reflecting the latest status as of the most
  recent source item — updated every time new information arrives. It contains: current `{phase-enum}` phase
  in one line · what is actively happening now · key open items + next milestones with dates · last
  engagement date and what it was.
- **Contacts table reflects current participants.** A person off the project moves to a "Historical Contacts"
  subsection or carries a `(no longer on project as of <date>)` note — never a stale contact in the primary
  table without annotation.
- **The "Last Updated" header date matches reality** — it is the date of the most recent information added.
- **Status fields are updated, not left at original values** — a passed milestone line is rewritten to what
  actually happened and what the current next milestone is.
- **Action items are current** — completed items removed/marked; no months-old items without a status.
- **Commercial status leads with the current approach**, not the original quote, when the proposition evolved.
- **Risk assessment reflects current risks**, not initial-phase risks.

## What to avoid

- Generic "discussions are ongoing" without specifics · vague "technical details were shared" (state which) ·
  placeholder "various topics discussed" (list them) · omitting attachment specs/data · stale passed-milestone
  dates · unannotated departed contacts · a current-state section that is a months-old snapshot.

## Attachment integration

- **PDFs with specs/drawings** — extract key data inline; reference the path for full detail.
- **Images** (photos, screenshots, diagrams) — save important ones into the project folder with descriptive
  names; reference in the Overview.
- **Spreadsheets** — extract the relevant tables inline.
- **Presentations** — summarize key slides with specific content, not "a presentation was shared".
