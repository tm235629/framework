---
description: The instruction layer of the templates library — the two reusable agent-instruction shapes (root navigation hub + nested per-folder rule file) with {company-slot} markers, and how a new instance fills them from the manifest.
references:
  - path: templates/README.md
    type: related
    note: The parent templates index this layer is one row of.
  - path: tooling/config.schema.json
    type: standard
    note: The manifest schema both templates' {slots} bind to.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# instruction/ — the agent-instruction layer

The reusable **instruction mechanism**: how an agent is told to *navigate and behave* on a Drive, with zero
company values baked in. Two shapes, generalized from the worked MOT instance (root `CLAUDE.md` + nested
project `CLAUDE.md` files):

| Template | Generalizes | Mechanism it carries |
|---|---|---|
| [root-AGENT.template.md](root-AGENT.template.md) | the root navigation hub | the **classify-before-reading** routing table (generic archetype rows), the **three autonomy tiers**, the **avoid-read** convention, the **superseded/legacy** convention. Index / people / CLI / triggers are `{company-slot}`. |
| [nested-rule-file.template.md](nested-rule-file.template.md) | a per-folder rule file | the body skeleton — **Purpose · dated current-position · disambiguation/guardrails · navigation-to-summary · folder-map · child-index · lifecycle footer**. Every value (esp. the sibling-disambiguation contract) is `{company-slot}`, drawn from `context_registry`. |

## The split

- **Mechanism (transfers verbatim):** the routing logic, the tier boundaries, the two conventions, the section
  skeleton + ordering. A new instance copies these unchanged.
- **`{company-slot}` (re-derived per instance):** every project, person, skill trigger, CLI tool, standard
  citation, and sibling-disambiguation term — all read from `manifest.json`
  (`taxonomy` · `vocab` · `frontmatter_schema` · `entity_registry` · `context_registry`).

> A hub or rule file that names a company's project, person, or tool as a literal is a bug — that belongs in
> the manifest. The disambiguation contract in a nested rule file is **generated from `context_registry`,
> never authored from memory** — that is what keeps confusable siblings apart.

## How a new instance fills them

1. **Fill the manifest** (`tooling/config.schema.json` → `manifest.json`).
2. **Render the root hub** from the template: bind each `{slot}` to its manifest field; the project index +
   people table + CLI table are emitted by the card/extractor tools, not hand-maintained.
3. **Render a nested rule file per folder** that needs one — leaf folders get only Purpose + Navigation; an
   ambiguity-prone or active-development folder adds the guardrail / current-position blocks.
4. **Exemplify the graph rules:** every rendered `.md` carries `description` + typed `references` (valid
   `{edge-vocab}` only; containment is free, never `parent`/`child`; define each edge once).
