---
description: Generalized nested per-folder rule-file body template — Purpose / dated current-position / disambiguation-or-guardrails / navigation-to-summary / folder-map / child-index / lifecycle footer. The section skeleton is mechanism; every value is a {company-slot} drawn from the manifest's context_registry + the folder's own contents. No company values.
references:
  - path: __Framework/templates/instruction/root-AGENT.template.md
    type: related
    note: The root hub whose "Focused folder work" / "Targeted edit" rows route the agent into a file built from this template.
  - path: __Framework/tooling/config.schema.json
    type: standard
    note: Slots bind to context_registry (disambiguation), frontmatter_schema (TL;DR + avoid-read), and vocab (status enum, edge types).
  - path: __Projects/Aquisition/20250627 Bosch/CLAUDE.md
    type: describes
    note: A worked MOT instance this template was generalized from (entity-level rule file with a disambiguation guardrail).
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Nested rule-file body template

> **This is a template.** A nested rule file (`{rule-filename}`, the per-folder companion to the root hub)
> is **navigation + behavioral guardrails for one folder** — never the folder's *data*, which lives in its
> `{overview-filename}`. Every `{curly-brace}` is a manifest field or a fact about *this folder*; the section
> skeleton transfers verbatim. **Omit any section that does not apply** — a leaf folder needs only Purpose +
> Navigation; only an ambiguity-prone or active-development folder needs the guardrail / current-position blocks.

**Required frontmatter** (per `{required-fields}` + lifecycle fields):

```yaml
---
description: "Navigation + rules for {this-folder}. Folder data lives in {overview-filename}."
references:
  - path: {this-folder}/{overview-filename}
    type: describes          # {edge-vocab}: this rule file describes the folder's overview
  - path: {sibling-or-related-folder}
    type: {edge-vocab-type}  # genuine cross-tree link only — NEVER an ancestor/containment-line dir
status: {status-enum}        # current | exploratory | superseded | legacy | draft
context: {context-tag}       # the context_registry tag this folder owns, if any
---
```

> Slots: `{this-folder}` = the folder's root-relative path; `{overview-filename}` / `{rule-filename}` =
> instance conventions; `{edge-vocab}` = `company_profile.vocab.edge_types.valid`; `{context-tag}` =
> the `context_registry[].tag` whose `owner` is this folder; `{status-enum}` = `vocab.status_enum`.

---

## Section skeleton (use the ones that apply, in this order)

### 1. Purpose  *(always)*

One short paragraph: what this folder is, the entity/workstream it serves, the kind of artifacts it holds.
No status, no dates — those belong in the current-position block or the `{overview-filename}` TL;DR.

> `{purpose}` — derived from the folder + its `{overview-filename}`; not a manifest value.

### 2. Current Position  *(only when the folder is under active development / has a live working state)*

A **dated, machine-anchored** block stating where the work *actually* stands now — so a superseded section
further down is never mistaken for current. Anchor it with an HTML comment for tooling:

```md
<!-- current-position: {context-tag} | updated: {YYYY-MM-DD} -->
## Current Position

{one paragraph: the current direction / decision, what changed, what is now dropped or superseded}.

→ Rationale + scope: [{decision-record-link}]. {Sources / open items, if any.}
```

> Slots: `{context-tag}` = the owning `context_registry` tag; `{YYYY-MM-DD}` = ISO edit date (the
> `{tldr-keys}.date_anchored_key` convention — keep it ISO so the drift auditor can read it);
> `{decision-record-link}` = the `decisions/` entry that justifies the position. Pair this block with a
> `⚠️` banner re-labeling any now-historical section below as **superseded** (status moves to `{legacy}`).

### 3. Disambiguation / Guardrails  *(only when this folder is confusable with a sibling)*

The **anti-confusion contract.** Use when two engagements/workstreams share vocabulary and must be kept
strictly apart. Build it **directly from the manifest's `context_registry`** — do not invent the distinctions:

- A **contrast table** — one column per confusable sibling, rows for the discriminating attributes (product,
  metric, key spec/number, document IDs, named contacts).
- A short **numbered rule list** of the form *"Never reference `{term-X}` in `{this-context}` — those belong
  to `{sibling-context}`,"* plus a closing *"after any edit, verify no `{sibling}`-specific terms leaked in."*

> Slots: the sibling set + every discriminating term come from `context_registry[{this-context-tag}].related[]`
> (each entry's `tag` + `difference`). `{this-context}`/`{sibling-context}` = `context_registry[].tag`. This
> section is **generated from the registry, never hand-authored from memory** — that is what keeps siblings apart.

### 4. Navigation (to the summary + sources of truth)  *(always)*

Where to go for real content — point outward, never restate it:

- **Full state / contacts / specs / commercial status:** `{overview-filename}` — read the TL;DR
  (`Read --limit 30`) first; the full file may be flagged `{avoid-read-marker}`.
- **Source-of-truth artifacts:** the authoritative spec/quote/data files, by path, each labeled as *the*
  source (working copies elsewhere are annotations, not authoritative).
- **Sibling rule files / context owners:** the `{rule-filename}` or `{overview-filename}` of related folders.

### 5. Folder map  *(when the folder has non-obvious subfolders)*

A small table: each immediate child folder + its one-line purpose. Distinguish **entity** subfolders from
**`{non-card-subfolders}`** working zones (the latter never become dashboard tiles even inside an
`entity_card:true` tier).

> `{non-card-subfolders}` = `company_profile.taxonomy.non_card_subfolders`.

### 6. Child rule-file index  *(when child folders carry their own `{rule-filename}`)*

A flat list of every child `{rule-filename}` + the one-line scope it governs. This is the containment spine
the agent walks down — it is **free** (containment), so these children are **not** repeated as `references`
edges in the frontmatter.

### 7. Lifecycle footer  *(always)*

A single trailing italic line recording last-updated + the nature of the last lifecycle touch — so a reader
knows whether content was *re-verified* or merely *annotated*:

```md
*Last updated: {YYYY-MM-DD} · {lifecycle-note: e.g. "Current Position block added and the historical section
relabeled; the analytical content itself was not re-verified."}*
```

> Keep the distinction honest: an autonomy-**tier-1** annotation (added a banner / current-position block) is
> not the same as re-verifying the substance — say which one happened.

---

## What NOT to put in a nested rule file

- **The folder's data.** Specs, status, contacts, commercial state → the `{overview-filename}`, not here.
- **Mutable narrative state.** "Current status" prose → `{state-file}` / the TL;DR, never narrated here.
- **Ancestor/containment `references`.** The parent edge is already drawn — referencing it is redundant noise.
- **Invented people or distinctions.** People come from `entity_registry`; sibling distinctions come from
  `context_registry`. If it is not in the manifest, do not assert it as a guardrail.
- **Anything in a `{superseded-folder}` treated as current.** Relabel it with a banner + `status: {legacy}`.
