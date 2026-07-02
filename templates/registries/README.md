---
description: The registries/ template layer — the two SEED registries (entity + context) a new instance fills FIRST plus the live shared contact register (resource class 3), why the seeds come first, what each {company-slot} binds to in the manifest, and how the focus-detector extends the entity seed per person.
references:
  - path: tooling/config.schema.json
    type: standard
    note: The manifest schema these templates' {company-slot}s bind to — entity-registry → company_profile.entity_registry; context-registry → company_profile.context_registry.
  - path: ARCHITECTURE.md
    type: related
    note: §7 (the entity-registry-first lesson — the SOT the original never built) and §11 (federation; the focus-detector extending a person's entities) are the rationale this layer materializes.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# registries/ — the FIRST artifacts a new instance seeds

Two seed registries an instance fills **before any content load**. They invert the two recurring scars
of the original (ARCHITECTURE [§7](../../ARCHITECTURE.md)): no entity registry ever existed → people /
company tangles; lookalike workstreams overwrote each other → the Bosch/STMicro tester confusion. Seed
them first and both classes of error are designed out instead of patched after an incident.

Templates carry the **shape**; the filled-in **values** live in the manifest
([`tooling/config.schema.json`](../../tooling/config.schema.json) → a filled `manifest.json`). Every
value in these templates is a `{company-slot}` marker naming the manifest field it draws from.

| Template | Fills (manifest field) | What it is |
|---|---|---|
| [entity-registry.template.json](entity-registry.template.json) | `company_profile.entity_registry` | The **people** seed (the only thing this manifest field holds). Companies are **derived from `<projects_root>/` folder names**; company metadata a folder can't carry lives in that company's `Overview.md` frontmatter, not here. |
| [context-registry.template.json](context-registry.template.json) | `company_profile.context_registry` | The confusable-workstream guardrail: each tag = an owner + its related siblings, each sibling carrying a **mandatory difference note**. |
| [contact-register.template.md](contact-register.template.md) | `company_profile.contact_register` | The **live shared contact register** (resource class 3, not a seed): a markdown table, one row per person, the person-axis SOT for the dashboard Contacts tab. Markdown (a living human-edited table), not JSON — and **not bootstrap-copied**; see below. |

## Seed registries vs live shared registers

Not everything in this folder is a bootstrap-copied seed. There are **two distinct resource classes**:

- **Seed registries (entity + context).** JSON shapes an instance fills once and **pastes into its
  manifest at bootstrap** — a copy-time artifact. Each instance owns its filled copy; they are not
  re-shared afterward (the entity seed is a company invariant that the focus-detector *extends*
  per person, but the paste itself happens once).
- **The contact register (resource class 3 — live shared register).** Not copied per drive. When
  `contact_register.shared` is **true** there is **exactly one live on-disk SOT per company**, resolved
  against `storage_profile.shared_root`; every teammate instance **reads** it (computing status locally at
  extract and deriving company axes against its own graph) and **contributes** per-instance batches
  (e.g. mail-scan summaries) that a **merge step** folds back into the SOT. A single-person instance may
  keep `shared: false`, in which case the register lives as a private copy in its own drive.

  It is **write-gated**: writes go only through the invariant-checked rebuild (dry-run default +
  timestamped backup + atomic write) or a CRUD-through-server that re-derives immediately — never ad-hoc
  bulk edits. **Why one SOT, not per-drive copies:** per-drive copies fork Last-contact dates, break the
  pooled multi-sender shortlist (double-contact risk), and fracture do-not-contact flags — the exact
  data-integrity failures a single shared register is designed to prevent.

## Why FIRST (the entity-registry-first lesson)

The original built **content-first, governed reactively** — entities and contexts were retrofitted
*after* incidents. The framework inverts that: the registries are seeded before the schema and the first
file load, so every later reasoning module has a resolved entity space and a confusable-workstream map
to check against. An unresolved person or an unregistered workstream fork is the **root cause** the
registries remove, not a symptom to clean up twice.

## entity-registry — people first, companies derivable

- **People are the irreducible seed** (`required: ["people"]`): own-company staff + recurring external
  contacts, each `{person-name}` / `{person-email}` / `{person-role}`. `internal: true` marks own-company
  staff (matched against `company_profile.company.domain`) for sender classification.
- **Companies are not seeded here** — they are **derived** from `<projects_root>/` folder names. Company
  metadata a folder name can't carry (a role, an alias, the canonical `Overview.md` path) lives in that
  company's `Overview.md` frontmatter, which the resolver folds into the project graph (`config.schema.json`
  accepts only `people` under `entity_registry`).
- The **entity-resolver** C module resolves names/emails seen in email + meetings against this seed.

## context-registry — register before use

Each entry is one confusable workstream: a kebab `<entity>-<workstream>` `tag`, its owning
current-position file (`owner`, or `null` until created), and **every** related-but-different sibling
under `related[]` — each with a **mandatory `difference` note** stating the one fact (beam path, metric,
customer-vs-product-line) that separates them. The note is where the guardrail's whole value lives.

> **Register-before-use rule.** Before writing into a workstream that has any confusable sibling, read
> its entry and the sibling difference notes **first**. A workstream that **forks** from an existing one
> must be **registered** (new tag + reciprocal difference note on the sibling) **before content lands** —
> an unregistered fork is exactly the drift the sensor flags. Define each pairing's difference on **both**
> siblings (the relationship is reciprocal — define-once does not apply, both must carry it to be read
> from either side).

## How the focus-detector extends the entity seed

The entity registry is a **company invariant** — seeded once, shared across every teammate. A person's
instance does not edit it; the **focus-detector** C module (ARCHITECTURE [§11](../../ARCHITECTURE.md))
**extends** it per person by inferring focus-specific entities from what dominates that person's Drive
and writing them to `person_profile.focus.extra_entities` (a CFO's banks/auditors; a VP-Systems'
instrument vendors). `extra_entities` **adds to, never overwrites,** the shared seed — so each instance
sees the company seed *plus* its owner's focus entities, and confidential focus entities stay local to
the instance that owns them.

## Filling these for a new instance

1. **Seed `people`** in the entity registry (mandatory) — copy the shape, replace every `{…}` slot,
   delete the `_examples` key. (Companies are derived from their folders — annotate company metadata in the
   company's `Overview.md` frontmatter, not here.)
2. **Seed `context_registry`** for every workstream with a confusable sibling — tag, owner, and a
   reciprocal difference note on each side. Drop the `x-examples` key.
3. **Paste both** into the instance manifest under `company_profile.{entity_registry,context_registry}`;
   validate against `config.schema.json`. The B-tools and the entity-resolver read them from there.
4. **Let the focus-detector run** to populate `person_profile.focus.extra_entities` — do not hand-edit
   the company seed to add one person's entities.
