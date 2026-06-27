---
description: Generalized output-schema contract for the periodic report — the public (category-first) vs internal (entity-first) layouts, source-extraction rules, the anonymisation pivot, the carryover/age-out gate, and the pre-publication QA checklist. Mechanism only; verticals, staff, cadence, and tier scale are {company-slot}s from the manifest.
references:
  - path: __Framework/tooling/config.schema.json
    type: standard
    note: Slots resolve from company_profile.cadence, vocab.{verticals,tier_scale}, entity_registry.people.
  - path: __Framework/templates/standards/info-distribution.template.md
    type: related
    note: This is View 2's full content schema; info-distribution gives the higher-level three-view structure.
  - path: __Framework/templates/standards/input-format.template.md
    type: related
    note: §A's source-extraction rules consume the email/meeting input format that contract specs.
status: current
context: framework-architecture
tags: [framework-meta]
---

# Output-schema contract — the periodic report

What goes **into** a periodic-sync entry, how it is extracted from sources, how owners are anonymised, how
stale rows age out, and the QA gate run before publication. The report ships as **two files** — an
entity-first **internal** working file (built first) and a category-first **public** file (the only one
circulated). Verticals, staff, cadence, and tier scale are `{company-slot}`s; the schema is generic.

> **Colleague-facing, not a notebook.** The public report carries **no** source citations and **no** internal
> staff names — provenance lives in each row's `Date` column and is reconstructed from source when needed.

---

## A. Source extraction

- **Forwarded-thread discipline.** A `Re:`/`Fwd:` message carries embedded older messages. Extract **only the
  topmost message** as new content; the `Date` column uses the topmost message's date. A row from older
  quoted content is added only if still relevant *and* not already captured in a prior period. A
  non-substantive topmost message (auto-reply, "see below", signature-only) is tagged `[needs review]`, not
  invented.
- **Meeting-summary relevance filter.** Port a point only if it is a **decision**, an **assigned action**, a
  **commercial commitment** (NDA/MOU/quote/order/pricing/schedule), a **data point that updates project
  state**, or a **risk/blocker** affecting another workstream. Other technical detail belongs in the Overview.
- **No citations in the rendered report** — no `(email …)` / `(meeting …)` parentheticals; the `Date` column
  carries freshness.
- **Speaker attribution** for a named assignment must come from the meeting summary's verified speaker mapping
  at ≥ medium confidence; low-confidence speakers are not named — rephrase impersonally.

### Owner-anonymisation rule (public report)

- **Public report — fully neutral.** No internal-staff (`{staff}`) names in action items or status wording,
  **even when the source explicitly assigns** to a named staffer. Every action item is verb-first impersonal.
- **Internal report — named owners preserved** as the source states.
- **`{exec}` is never named anywhere** — neither public nor internal.
- **External-party callouts kept in both** — `> - <Org>: <verb phrase>` (a bracketed external person is OK).
  An external name flags where a dependency lives; it is not an own-company assignment.
- **Forbidden lead verbs (both files):** "Await", "Continue", "Ongoing", "TBD" → rewrite to a forward action.
- **Don't "chase" relationship-side partners** — use "Follow up with" / "Re-engage" / "Check back with".
  "Chase" stays only for clearly-transactional vendor follow-ups (and even there, "follow up" is safer).

---

## B/C. Internal layout — entity-first (built first)

Each partner (sales) / workstream → sub-vendor (operations) is a sub-section with a vertical
`Topic | Content | Date | Source` table. Generic shape:

```
### <Entity name>
*<one-line: WHO they are — a Wikipedia first line, NOT the engagement>*

| Topic | Content | Date | Source |
|-------|---------|------|--------|
| Last engagement | <person> (<org>) <verb> <content> | <date> | <src> |
| {commitment-baseline-1 (e.g. NDA)} | <state + term> | <date or —> | … |
| Context | <what we are discussing> | since YYYY-MM | … |
| Project phase | <current stage + key context> | since YYYY-MM | … |
| <activity rows…> | <one factual sentence each> | <date> | … |

> - <impersonal action item — internal file may name owners; {exec} never named>
> - <External org: their action>
```

Rules: **Last engagement is the first row** (not a separate line above the table). The italic descriptor says
*who*, never the engagement. **Baseline rows** (the commitment/Context/Project-phase rows) travel verbatim
from the master template and **do not age out**. **No-redundant-rows:** an activity row must add information
beyond the baseline. **Prefer fewer rows** — group related facts as `<br>• ` bullets inside one Content cell
rather than spawning rows. An entity with nothing new this period renders with only its baseline rows
(status-board mode). **Backlog:** idle entities carry a `<!-- backlog -->` marker and render as one compact
row in a backlog table at the end of their section, not as a full sub-block.

---

## E. Voice rules for action items

Verb-first impersonal in the public voice (no `{staff}` names, no subject); internal preserves owners
(`{exec}` never). One action per bullet; a deadline only when the source states one; external-party actions
stay named (`> - <Org>: <verb phrase>`). No "Await/Continue/Ongoing/TBD" lead verb.

---

## H. Carryover & age-out

Each period the report is **rebuilt from the master template** (not copied from last period), with a
carry-over budget applied to last period's **activity** rows (baseline rows are exempt):

| Row age | Refreshed by a new source this period? | Decision |
|---|---|---|
| new this period | n/a | **Keep**. |
| 1 period old | yes | **Keep**, refresh wording. |
| 1 period | no, but it is a future-dated commitment / unresolved active blocker | **Keep**, condense to one line. |
| 1 period | no, no forward commitment | **Drop**. |
| 2+ periods | yes | **Keep** (fresh source resets the counter). |
| 2+ periods | no | **Drop by default** — override only for an unfulfilled future-dated commitment; condense + log it. |

A row is **not** refreshed by a forwarded email re-quoting old content. **Events table:** forward-looking
only; default for an advertisement/invitation is **not participating** (an event earns a row only after the
own-company side confirms attendance); undated-but-confirmed events use `TBD` and persist. Mirror every
events change into the calendar/state source. **Strategy/direction items** are long-running and exempt from
the age-out (reviewed for relevance once a period-cycle, never silently dropped).

---

## J. Public layout — category-first (the pivot)

The public file pivots the internal file from entity-first to **category-first**: SALES + OPERATIONS are
organised by **product category** (aligned to `{verticals}` and their focus groups), each a `###` group with
**one horizontal table**, one row per entity.

```
### {VERTICAL} — {focus-group}

| Company | Status | Last engagement | Date |
|---------|--------|-----------------|------|
| **{Entity}**<br>*short descriptor* | <terse, comma/semicolon points: what + current stage + key facts> | <person> (<org>) <verb> <content> | <date> |
```

- **List ALL canonical categories every period, in order** (the `{verticals}` × focus-group taxonomy); an
  empty category shows its `###` header + a one-line `*NA …*` disclaimer (not an omitted section), so the
  reader sees the full product map and where the gaps are.
- **Customer-vs-operations classification:** a row is on the **sales** side only if the entity is an external
  customer/prospect **buying** a product, design/NRE, or equipment. Suppliers, fab/design vendors, component
  sources, analyst/PR firms, and algorithm partners go on the **operations** side. An entity whose engagement
  genuinely **spans** categories is listed in **each** relevant category, the row tailored to that slice.
- **Column set — exactly four**, looked up by header name: `Company`/`Vendor` · `Status` · `Last engagement` ·
  `Date`. First cell `**Name**<br>*descriptor*` (one `<br>`; descriptor = who they are). `Status` merges the
  internal `Context` + `Project phase` into terse points (not full sentences).
- **Dropped from public:** the commitment-baseline (e.g. NDA) row, the `Source` column, all standalone
  activity rows (folded into Status), all `>` action items (→ the to-do list). Idle entities → a backlog table.

### Generation order (internal → public)

Build the internal file first, then: (1) classify each entity into one category group; (2) merge
`Context` + `Project phase` → `Status`; (3) carry `Last engagement` + its `Date`; (4) drop the baseline row,
`Source` column, activity rows, and action blockquotes; (5) **neutralise** — strip `{staff}` names and
confidence/owner flags; (6) run the QA gate (§G) on the public output only.

---

## G. Pre-publication QA gate

Run on the **public** file before declaring the period done; any fail = fix + re-check:

1. **Taxonomy completeness** — all canonical categories present, in order; an empty one shows header + `*NA …*`.
   No per-entity `###`/`####` sub-blocks remain (public is category-first).
2. **Classification** — sales side holds only external customers/prospects buying something; suppliers /
   vendors / component sources / analyst-PR / algorithm partners are on the operations side.
3. **Column contract** — every group table is exactly `Company`/`Vendor` · `Status` · `Last engagement` ·
   `Date`; first cell is `**Name**<br>*descriptor*` (descriptor = who, not the engagement).
4. **Status quality** — terse comma/semicolon points, not full sentences; merges context + current phase.
5. **No dropped fields leaked** — no commitment-baseline row/column, no `Source` column, no `>` action item
   anywhere in the public file.
6. **No source citations** — no `(email …)` / `(meeting …)` parentheticals.
7. **No internal-staff names** (`{staff}`/`{exec}`) in Status / Last-engagement wording; external orgs fine.
8. **Date/weekday consistency** — every dated reference carries the correct weekday where shown (verify
   programmatically).
9. **Direction de-duplication** — no direction bullet duplicates a category-row's content.
10. **Carryover audit** — each Status reflects current truth; aged-out detail is not resurrected; a
    genuinely cross-category entity appears in each relevant category.
11. **Backlog** — idle entities sit in the backlog table, not the main category tables.
12. **Brand header present** — the report opens with the brand logo/header line; the relative path resolves.

QA report format (readable in chat): `QA gate: <pass | N issues>` + one line per issue
(`<group/entity>: <issue> → <fix or [needs review]>`) + a carryover summary (customers/vendors counts,
reclassifications, backlog moves, new entities). Any `[needs review]` is surfaced to the user before
proceeding. The master template ([info-distribution](info-distribution.template.md)) is the agent's
scaffolding — never published; edited only when an entity is added (real first contact) or removed (terminated).
