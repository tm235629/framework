---
description: The one-page copy-pasteable LAUNCHER for the __Framework — stand up a focus-adapted instance of the knowledge-OS on a new Drive (MetaOptics is the reference instance the framework was extracted from). Path-picker + concrete stand-up steps + the exact agent prompt + the human gates to expect. Start here.
references:
  - path: __Framework/bootstrap/teammate.md
    type: long-form
    note: The full same-company runbook this launcher front-ends — the default path; RUN.md is its TL;DR + copy-paste entry point.
  - path: __Framework/tooling/company-seed.json
    type: source
    note: The shared { manifest_version, company_profile } a teammate copies verbatim into their manifest.json (Step 3 here).
  - path: __Framework/tooling/TOOLS.md
    type: related
    note: Per-tool operator reference for the kb-* B-library the stand-up steps invoke (kb-index/kb-focus/kb-audit).
  - path: __Framework/bootstrap/SETUP_SEQUENCE.md
    type: builds-on
    note: The full phased pipeline behind the path-picker; greenfield/brownfield/new-company branch from its top-level bifurcation.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# RUN — launch a Framework instance

**What this is:** the one-page launcher to stand up a focus-adapted instance of the knowledge-OS — an agent-navigable Drive — on a new machine. Copy the framework, install the tools, fill a manifest, run the kb-* chain, hand an agent the prompt below. (MetaOptics is **the reference instance ("Instance Zero")** the mechanism was extracted from; nothing below pastes a real reference-instance value.)

---

## 1. Pick your path

| Your situation | Path | Read |
|---|---|---|
| **Same company, new person** (a teammate gets their own focus-adapted instance) — the default, easiest path | **teammate** | [`teammate.md`](teammate.md) |
| **New company, empty Drive** (no content yet — design taxonomy from scratch) | greenfield | [`greenfield.md`](greenfield.md) |
| **New company, messy existing Drive** (content exists, needs inventory + restructure) | brownfield | [`brownfield.md`](brownfield.md) |
| **New company, deriving the company_profile from scratch** (only the *mechanism* transfers) | new-company | [`new-company.md`](new-company.md) |

> Most launches are **teammate**: the `company_profile` is already settled, so you *configure*, you don't *re-derive*. The other three rebuild the seed. Everything below walks the teammate path; the alternates differ only in Step 3 (you derive the `company_profile` instead of copying it).

---

## 2. Stand up an instance (teammate path)

Run on the **target** person's machine. `<DRIVE>` = their Drive root (e.g. `C:/Users/<them>/OneDrive - <Your Company>`). Forward slashes throughout.

**A. Get the framework onto the target machine.** Copy (or `git clone`) the whole `__Framework/` folder to the target — either standalone, or as a `__Framework/` folder inside their Drive. If it lives inside their Drive, it is already excluded from their graph (the manifest's `excludes.dirs` lists `__Framework`), so it never pollutes their index.

**B. Install the tools** (zero MOT coupling — tooling carries its own `package.json`):
```bash
cd __Framework/tooling && npm install
```

**C. Create their `manifest.json`** — copy the shared seed's `company_profile` **verbatim**, then add a `person_profile`:
```bash
# 1. lift the shared invariants (company_profile) byte-for-byte from the seed:
node -e "const s=require('./company-seed.json'); const fs=require('fs'); \
  fs.writeFileSync('<DRIVE>/manifest.json', JSON.stringify({ \
    manifest_version: s.manifest_version, \
    company_profile: s.company_profile, \
    person_profile: { \
      person: { name: '<NAME>', email: '<EMAIL>', role: '<ROLE>' }, \
      root_override: '<DRIVE>', \
      focus: {} \
    } \
  }, null, 2) + '\n');"
```
`company_profile` is **identical for every teammate** — never edit it. `person_profile` is the only block they own (`person`, `root_override`, empty `focus` for now).

**D. Build the graph, then fill `focus`** (Step-2 of teammate.md — the one genuine reasoning step):
```bash
node kb-index.mjs "<DRIVE>/manifest.json" --out "<DRIVE>/data/graph-index.json"
node kb-focus.mjs "<DRIVE>/manifest.json" --graph "<DRIVE>/data/graph-index.json" --out "<DRIVE>/data/focus-proposal.json"
```
`kb-focus` writes a **focus PROPOSAL** (focus_verticals / focus_tiers / focus_contexts / focus_entities from work-depth + reference-centrality). **Review it at the human gate**, then paste the agreed subset into `person_profile.focus` and add any `extra_entities` the seed lacks (e.g. a CFO's banks/auditors — these stay local, never go back into the shared seed).

**E. Verify (dry-run sensor):**
```bash
node kb-audit.mjs "<DRIVE>/manifest.json" --json
```
Instance is up when `kb-index` builds without error and `kb-audit` shows **0 high-severity** findings (med/low are triaged on the standing drift loop). Optional: `kb-walk` (catalogs), `kb-extract` (dashboard cards), `kb-entities` (registry). The migration kit runs **only** on a messy brownfield Drive.

---

## 3. The agent prompt to paste

Hand the target agent exactly this (fill the three angle-bracket slots):

```
Read __Framework/CLAUDE.md, then follow bootstrap/teammate.md to stand up my instance.
My Drive root is <PATH>. I am <NAME> (<ROLE>). Stop at each human gate.
```

---

## 4. Human gates to expect

The agent runs deterministically between these and **stops** at each:

1. **Approve the focus profile** — after `kb-focus`, confirm/edit the proposed `person_profile.focus` (verticals, tiers, contexts, entities) and the `extra_entities` list before it is written into `manifest.json`. This is the one reasoning call; the structural proposal is a *suggestion*, you decide.
2. **Approve any moves** — only on a brownfield Drive that needs restructuring. The migration kit (`inventory → plan-renames → apply-moves`) is **dry-run by default**; `--apply` requires explicit approval and is hard-refused on the protected MOT root. A clean per-person Drive skips this gate entirely.

When both gates pass and `kb-audit` is clean of high-severity findings, the teammate has a federated, focus-adapted instance on the shared mechanisms — no central login, no fresh design pass.
