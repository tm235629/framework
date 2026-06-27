---
description: End-to-end getting-started guide for the knowledge-OS framework — prerequisites, install, the example-vs-real instance model, picking one of the four stand-up paths, building a manifest, running the kb-* tool chain, and the two human gates. The narrated companion to bootstrap/RUN.md.
references:
  - path: ../bootstrap/RUN.md
    type: related
    note: The terse copy-paste launcher this guide narrates.
  - path: ./manifest-reference.md
    type: related
    note: Field-by-field reference for the manifest you build in step 3.
  - path: ./tools.md
    type: related
    note: What each kb-* tool in the step-4 chain does.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Getting started

This walks you from an empty machine to a running knowledge-OS instance. It is the narrated version of the
terse launcher in [`../bootstrap/RUN.md`](../bootstrap/RUN.md).

---

## 0. Prerequisites

- **Node.js ≥ 18** (validated on v24). `node --version` to check.
- **git**, to clone the framework.
- A **target Drive** — the folder tree you want to make agent-navigable. It can be empty (greenfield),
  messy and full (brownfield), or already-organized (a teammate's own Drive).

The B-library has exactly **one runtime dependency** (`gray-matter`, for YAML frontmatter). No build step,
no database, no service.

---

## 1. Get the framework + install

```bash
git clone <your framework remote> framework
cd framework/tooling
npm install            # installs gray-matter into tooling/node_modules
```

If the framework lives **inside** a Drive (as `__Framework/framework/`), it is already excluded from that
Drive's own index — the manifests list `__Framework` in `excludes.dirs`, so it never pollutes the graph.

---

## 2. The example-vs-real model (read this once)

The framework **ships generic mechanism + a synthetic demo**, never anyone's real data:

| Shipped (in git) | You create (gitignored, local) |
|---|---|
| `tooling/manifest.example.json` (the "Acme Optics" demo) | `tooling/manifest.json` — your filled instance |
| `tooling/company-seed.example.json` (Acme's shared seed) | `tooling/company-seed.json` — your company's shared seed |
| `tooling/config.schema.json` (the schema both validate against) | — |

So the **first thing** you do is copy an example to its real name and edit it:

```bash
cp manifest.example.json manifest.json
```

Every tool **defaults to `manifest.example.json`** if you pass no manifest argument, so a fresh clone runs
out-of-the-box against the demo (it will report 0 files, because the demo's `/srv/acme-drive` root doesn't
exist on your machine — that's expected). Once you have a real `manifest.json`, pass it explicitly.

---

## 3. Pick your path and build the manifest

The manifest is the **C→B contract** — one JSON file that fully parameterizes every tool (see
[concepts.md](concepts.md) and [manifest-reference.md](manifest-reference.md)). How you build it depends on
your situation:

| Your situation | Path | What you do in step 3 | Detailed runbook |
|---|---|---|---|
| **Same company, new person** (a teammate gets their own focus-adapted instance) — the common, easy path | **teammate** | Copy the shared `company_profile` **verbatim**; add a `person_profile`. | [`../bootstrap/teammate.md`](../bootstrap/teammate.md) |
| **New company, empty Drive** | greenfield | Design `taxonomy`/`vocab` from scratch using the templates. | [`../bootstrap/greenfield.md`](../bootstrap/greenfield.md) |
| **New company, messy existing Drive** | brownfield | Inventory first, then design taxonomy + restructure. | [`../bootstrap/brownfield.md`](../bootstrap/brownfield.md) |
| **New company, deriving the company profile from scratch** | new-company | Re-derive the whole `company_profile`; only the mechanism transfers. | [`../bootstrap/new-company.md`](../bootstrap/new-company.md) |

**Teammate path (the default).** The `company_profile` is already settled, so you *configure*, you don't
*re-derive*. Copy the shared seed's `company_profile` byte-for-byte, then add the one block a person owns:

```jsonc
{
  "manifest_version": "0.1",
  "company_profile": { /* ← copied verbatim from company-seed.json (the shared seed) */ },
  "person_profile": {
    "person": { "name": "<NAME>", "email": "<EMAIL>", "role": "<ROLE>" },
    "root_override": "<absolute path to THEIR Drive root, forward slashes>",
    "focus": {}                       // ← filled by the focus gate in step 5, not by hand
  }
}
```

`company_profile` is identical for every teammate — never edit it. `person_profile` is the only block they
own. For the other three paths you instead **derive** `company_profile` from the templates in
[`../templates/`](../templates/) (taxonomy, vocab, standards, registries), validating against
`config.schema.json` as you go.

> The minimum a manifest needs to run: `company_profile.storage_profile.root` (or
> `person_profile.root_override`), `company_profile.scan_roots`, and the `taxonomy`/`vocab`/`frontmatter_schema`
> blocks. See [manifest-reference.md](manifest-reference.md) for every field.

---

## 4. Run the tool chain

All commands below are run from the framework root (`cd ..` out of `tooling/`), passing **your**
`manifest.json`. Every tool is read-only on the Drive and writes only where you point `--out` (defaults land
under `tooling/_validation/`, which is gitignored).

```bash
# 1. THE HUB — build the frontmatter graph index. Everything else reads this.
node tooling/kb-index.mjs tooling/manifest.json --out data/graph-index.json

# 2. THE SENSOR — drift audit. 0 high-severity findings == healthy.
node tooling/kb-audit.mjs tooling/manifest.json --json

# 3. (optional) status cards, the entity registry, catalog validation
node tooling/kb-extract.mjs  tooling/manifest.json --index data/graph-index.json --out data/projects.json
node tooling/kb-entities.mjs tooling/manifest.json --graph data/graph-index.json --check
node tooling/kb-walk.mjs     tooling/manifest.json --json        # dry-run; writes NO _catalog.md
```

`kb-index` is the hub; `kb-extract`/`kb-audit`/`kb-entities`/`kb-focus` consume its graph (re-pass it with
`--index`/`--graph` to avoid re-walking). `kb-walk` is a parallel catalog projection and is **dry-run only**.
See [tools.md](tools.md) for each tool's inputs/outputs.

**The instance is "up" when** `kb-index` builds without error and `kb-audit` reports **0 high-severity**
findings (med/low are triaged continuously on the drift loop, not blockers).

---

## 5. The two human gates

The agent runs deterministically between these and **stops** at each (this is the "A" rung — the human gate
fires only when a decision is both low-confidence and hard-to-reverse):

### Gate 1 — approve the focus profile (teammate path)

Detecting *what a person focuses on* is the one genuine reasoning step. Run the focus detector against the
graph you built:

```bash
node tooling/kb-focus.mjs tooling/manifest.json --graph data/graph-index.json --out -
```

It writes a **proposal** (`focus_verticals` / `focus_tiers` / `focus_contexts` / `focus_entities` /
`focus_document_kinds`) inferred from what dominates the Drive. **Review it**, edit as needed, then paste the
agreed subset into `person_profile.focus` and add any `extra_entities` the shared seed lacks (e.g. a CFO's
banks/auditors — these stay local, never go back into the shared seed). The structural proposal is a
*suggestion* — you decide.

### Gate 2 — approve any moves (brownfield only)

Only on a messy Drive that needs restructuring. The migration kit
(`inventory → plan-renames → apply-moves`) is **dry-run by default**; `--apply` requires explicit approval
and is **hard-refused on a protected live Drive** (the `storage_profile.protected_root_markers`). A clean
per-person Drive skips this gate entirely. See [tools.md](tools.md#migration-kit) and
[`../migration/PLAYBOOK.md`](../migration/PLAYBOOK.md).

When both gates pass and `kb-audit` is clean of high-severity findings, you have a **federated,
focus-adapted instance** on the shared mechanisms — no central login, no fresh design pass.

---

## Where to go next

- Filling the manifest: [manifest-reference.md](manifest-reference.md)
- The model behind all this: [concepts.md](concepts.md)
- Something broke: [troubleshooting.md](troubleshooting.md)
