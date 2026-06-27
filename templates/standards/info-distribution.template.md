---
description: Generalized information-distribution contract — the three-view data model (per-entity overviews · periodic-snapshot sync · longitudinal timelines) and the engagement-tracking rule. Mechanism only; cadence, verticals, and staff are {company-slot}s from the manifest.
references:
  - path: tooling/config.schema.json
    type: standard
    note: Slots resolve from company_profile.cadence, vocab.verticals, entity_registry.
  - path: templates/standards/output-schema.template.md
    type: related
    note: View 2 (the periodic sync) — this contract gives its high-level structure; output-schema gives its full content schema + QA gate.
  - path: templates/standards/quality.template.md
    type: related
    note: View 1 (per-entity overviews) — this contract names them; quality gives their content/freshness contract.
status: current
context: framework-architecture
tags: [framework-meta]
---

# Information-distribution contract — three views on the data

When new inputs (emails, meetings, data) are processed, information is distributed to **three
complementary document types** — not one. Each view answers a different question. Cadence, verticals, and
staff are `{company-slot}`s; the three-view model is generic.

---

## View 1 — Per-entity Overviews (`Overview.md` in project folders)

- **Purpose:** everything about ONE partner/workstream in one place.
- **Location:** each project folder has its own `Overview.md`.
- **Update when:** new emails/meetings/data arrive for that entity.
- **Holds:** full history, specs, contacts, all source citations, timeline, commercial detail.
- **Content/freshness contract:** [quality.template.md](quality.template.md).

## View 2 — Periodic snapshot sync (`{sync-folder}/`)

- **Purpose:** snapshot of ALL active items at one point in time — the "current state" view.
- **Cadence:** **`{cadence}`** (`cadence.sync_period`), published on **`{publish-day}`** (`cadence.publish_day`).
- **Two files** per period (full layout + QA gate in [output-schema.template.md](output-schema.template.md)):
  - **Public** — category-first: sections organised by product category (aligned to `{verticals}`), entities
    as rows. The only file circulated; the only one rendered to dashboard + PDF. No action-item blockquotes.
  - **Private/internal** — entity-first: one entry per partner, with named owners + `>` action items. Built
    first; not shared.
- **Structure (both):** `{section-order}` — a strategy/direction section → events → the category/entity
  sections → a general narrative. Same structure every period.
- **Update when:** feed relevant new information into the **upcoming** period's sync, following the existing
  structure exactly.

### Engagement-tracking rule

Every entity entry (sales side) **and** every workstream/sub-vendor entry (operations side) states the
**last date of engagement**, **who initiated it** (own-company or the partner), and **what the content was**
— an at-a-glance view of recency and momentum.

- Format: `Last engagement: <date>, <person> (<org>) <verb> <content>`.
- "Engagement" = any substantive communication (email, meeting, call, document exchange). Skip automated
  notifications / calendar invites.
- For internal/R&D entries with no external vendor, source the engagement to the most recent internal sync,
  demo, or commit.
- Place it near the top of each entry (the first table row in the per-entity layout).

## View 3 — Timeline evolution documents

- **Purpose:** longitudinal view of ONE major theme across time — the "time evolution" view.
- **Update when:** after updating the periodic sync, also update the corresponding timeline doc(s).
- **Holds:** period-by-period progression, a key-milestones table, status changes over time.
- **Location:** project-specific timelines live in the project folder as `Timeline.md`; cross-cutting themes
  live in a shared `Timelines/` folder as `Timeline_<Theme>.md`. Declare an Overview → Timeline link with a
  `{output-edge}` reference ([graph-wiring](graph-wiring.template.md)).
- **Create one** when a theme becomes significant enough to track across 3+ periods.

---

## How the three views relate

| View | Axis | One question it answers |
|---|---|---|
| **Overviews** | per entity | "Everything about <entity> — where do we stand?" |
| **Sync** | point-in-time, all entities | "What is the state of everything right now?" |
| **Timelines** | per theme, over time | "How did <theme> evolve?" |

The same fact is distributed to all three at the altitude each needs: full detail in the Overview, a terse
current-state row in the sync, a period delta in the timeline. Overviews are the durable source; the sync is
derived/disposable; timelines are the longitudinal index.

## Reference: internal personnel

The roster of own-company staff (names, roles, internal-vs-external) is **`{staff}`**
(`entity_registry.people`) — the single source for correct titles/roles when drafting copy or identifying
contacts in threads. The never-named executive (`{exec}`) and the public-vs-internal naming rule are in
[style.template.md](style.template.md) and [output-schema.template.md](output-schema.template.md) §A.
