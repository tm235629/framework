---
description: Generalized lifecycle contract — the status enum, the context-registry guardrail, supersession edges, current-position blocks, decision records, naming/archive conventions, and the autonomy tiers. Mechanism only; status values + context tags + edge types are {company-slot}s from the manifest.
references:
  - path: tooling/config.schema.json
    type: standard
    note: Slots resolve from company_profile.vocab.{status_enum,edge_types}, company_profile.context_registry, taxonomy.category_rules.
  - path: templates/standards/graph-wiring.template.md
    type: related
    note: The supersession edge is one of the typed reference edges whose vocabulary that contract governs.
  - path: templates/standards/placement.template.md
    type: related
    note: Rule 11 (closed-in-place vs terminated) consumes §9's status-vs-phase split and the archive gate.
status: current
context: framework-architecture
tags: [framework-meta]
---

# Lifecycle contract — marking whether a document is current

How to mark a document's lifecycle so any reader (human or agent) can tell at a glance whether it is
current, and how parallel-but-confusable workstreams are kept from silently overwriting each other. Every
status value, context tag, and edge type is a `{company-slot}` from the manifest.

---

## 1. `status` — the lifecycle of a document

Add `status:` to any substantive content doc. The allowed values are **`{status-enum}`**
(`vocab.status_enum`); the generic semantics each value carries:

| value role | use when | reader should |
|---|---|---|
| **`{status-current}`** | canonical, in-force version | trust it |
| **`{status-exploratory}`** | an option/analysis **considered but never adopted** | treat as candidate, not the plan |
| **`{status-superseded}`** | **was** canonical, has been **replaced** | read only for history; follow `{decision-ref}` |
| **`{status-legacy}`** | old, kept for reference, no single named successor | treat as background |
| **`{status-draft}`** | in progress, not yet canonical | do not cite as settled |

`{status-exploratory}` ≠ `{status-superseded}`: the first never won; the second won then lost. Absent
`status` ⇒ treat as `{status-current}` **unless** a same-`context` sibling with a newer freshness anchor
covers the same topic — then flag it for the freshness pass.

## 2. `context` — which workstream this belongs to

A **`context:`** tag groups documents describing **one workstream**. Two docs only ever compete for
supersession **within the same context** — supersession is never evaluated across context boundaries. This
is the guardrail against cross-project confusion: parallel-but-distinct workstreams that share vocabulary
can never silently supersede each other.

Set `context:` to a tag registered in **`{context-registry}`** (`company_profile.context_registry`) — the
controlled-vocabulary registry where each context names its **owning current-position file** (`owner`) and
its **related-but-different siblings** with a mandatory `difference` note. If the right tag doesn't exist,
add it to the registry first.

> The `difference` notes are load-bearing — they are the literal statements of *why this sibling must never
> bleed into this context*. The registry is the single source the drift auditor and the writing skills
> read to keep confusable workstreams apart.

## 3. The supersession edge

Express it as a **typed reference** so the graph picks it up with no parser change — using the
`{supersede-edge}` types from `{edge-vocab}` (`vocab.edge_types.valid`):

```yaml
# in the OLD (superseded) doc:
status: {status-superseded}
references:
  - path: "<path to the new doc>"
    type: {supersede-edge}            # e.g. superseded_by
decision_ref: "<path to the decisions/ entry>"   # if a decision governs it
```

Optionally add the reciprocal `{supersedes-edge}` on the new doc (drives the dashboard arrow; not required —
edges define once, see [graph-wiring](graph-wiring.template.md)).

## 4. Current-position block

The one authoritative statement of where a context stands **now**. Overwrite it; never append history.

```markdown
<!-- current-position: <context-tag> | updated: YYYY-MM-DD -->
## Current Position
<1–4 lines: what is currently true. What was set aside, if relevant.>
→ <relative path to the governing decisions/ entry>
```

- **Find it by the HTML-comment anchor, not the filename.**
- **Where it lives:** the project `Overview.md` (project-level context) · a sub-folder `CLAUDE.md`
  (workstream-level) · a dedicated `CURRENT_<context>.md` only when a context spans folders with no single
  owner. The registry's `owner` field names it.

## 5. Banner (for non-current docs)

First line after the frontmatter, so it survives a `Read --limit 30` / context-grep:

```markdown
> ⚠️ **{STATUS-BANNER} YYYY-MM-DD** — <one line: what replaced it>.
> → <relative path to decisions/ entry>
```

**Frozen folders** (any tree declaring its files immutable): the freeze protects analysis content. The one
allowed exception is a single **additive** lifecycle annotation — the banner block + lifecycle frontmatter
(`status`, `{supersede-edge}`, `decision_ref`). Nothing else changes. Record the same supersession at the
navigation layer (current-position block + decision record). If even the additive banner is unwanted, fall
back to navigation-layer-only.

## 6. Decision records (token-bounded)

- **One file per decision:** `decisions/YYYY-MM_<context>-<slug>.md`, ~15 lines. Sections:
  **Decision · Why · Supersedes · Still valid from prior work**. Written once, not edited later.
- **One index:** `decisions/README.md`, one line per decision (newest first).
- Frontmatter carries `context: <tag>`, `date:`, `status: {status-current}`, and a `{governs-edge}` edge to
  the owning nav file.

## 7. Naming + archive

- **Name:** `YYYYMMDD_<Topic>_<Descriptor>[_v<n>].<ext>`. Strip source-export timestamp infixes on ingest;
  make the descriptor mean something.
- **Version chains** (quotes, decks, specs): when a new version lands, **move** the predecessor to a sibling
  `_superseded/` and leave the latest alone — the working folder holds exactly one live copy.
- **Reasoning/analysis docs:** **tag in place** (`status`), don't move.
- **Whole dead workstreams:** the `{archive-tier}` (the `{category-rules}` bucket = `archive`).
- `_superseded/` always carries a catalog noting which live file each archived file preceded — never a global dump.

## 8. Autonomy tiers (how much to do without asking)

| Tier | Examples | Rule |
|---|---|---|
| **1 — Annotate / curate** | `status`, supersession edge, banner, decision entry, catalog/summary, current-position block | **Just do it**, note in your summary |
| **2 — Restructure** | move to `_superseded/`, rename to convention, archive a superseded version | **Do it, but list every move** |
| **3 — Destroy / rewrite** | delete, overwrite substance, modify content you did not create | **Confirm with the user first** |

Lifecycle marking is Tier 1: conclude staleness, mark it, move on — do not interrupt the user for it.
*(The drift actuator routes each finding by exactly these tiers — see [drift-detection](../drift-detection/SPEC.md) §2.)*

## 9. Closed / completed projects (`status` vs `phase`)

A **finished** project is marked on **two independent axes** — there is deliberately no dedicated "closed"
value:

- **Lifecycle** (`status`, §1): a delivered project whose methodology/modules live on but has no single named
  successor → `{status-legacy}`. One fully replaced by a single named successor → `{status-superseded}` + a
  `{supersede-edge}` edge.
- **Engagement** (`phase`, the `{phase-enum}` dashboard enum): **do not** set `{phase-archived}` on a project
  that stays in place. The locked equivalence: **`{phase-archived}` ⇔ the folder lives under `{archive-tier}`**
  (a whole dead relationship). A closed-but-in-place project keeps its existing phase.

So a closed internal subproject under an active line is `{status-legacy}` + `phase` unchanged + a closure
TL;DR line (`**Status:** Closed YYYY-MM — <where the work lives on>.`). It is **not** moved to the archive tier
(see [placement](placement.template.md) Rule 11). Express lineage with a `{builds-on-edge}` edge to where the
work continues — a cross-tree target, never the node's own containment parent.
