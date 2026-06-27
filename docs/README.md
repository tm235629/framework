---
description: Index for the knowledge-OS framework's how-to-use documentation — getting-started, core concepts, the manifest field reference, the B-library tools, and troubleshooting. Start here if you want to USE the framework (stand up an instance); read the top-level README/ARCHITECTURE if you want to understand its design.
references:
  - path: ../README.md
    type: related
    note: The framework's top-level entry point (what it is, the B/C/A model, the folder map).
  - path: ../ARCHITECTURE.md
    type: related
    note: The conceptual core that concepts.md condenses for users.
  - path: ../bootstrap/RUN.md
    type: related
    note: The one-page copy-paste launcher; getting-started.md is the narrated companion.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Using the knowledge-OS framework

This `docs/` directory is the **how-to-use guide**: everything you need to stand up and run a
knowledge-OS instance on a Drive. It complements — does not duplicate — the design docs at the repo root
(`README.md`, `ARCHITECTURE.md`, `DECISIONS.md`) and the operator references (`bootstrap/`, `tooling/TOOLS.md`).

> **Reference instance.** MetaOptics ("MOT" / "Instance Zero") is the worked example this framework was
> extracted from and validated against. Its filled manifest (`manifest.mot.json`), shared seed
> (`company-seed.json`) and gap analysis are **not shipped** with the core (they are private and gitignored).
> What ships is the generic mechanism plus a synthetic demo instance, **Acme Optics**
> (`tooling/manifest.example.json` + `tooling/company-seed.example.json`).

## Read in this order

| # | Doc | Read it when… |
|---|-----|---------------|
| 1 | [getting-started.md](getting-started.md) | You want to install the tools and stand up your first instance, start to finish. |
| 2 | [concepts.md](concepts.md) | You want the mental model — B/C/A, the manifest seam, federation, the drift loop — without the full ARCHITECTURE. |
| 3 | [manifest-reference.md](manifest-reference.md) | You're filling a `manifest.json` and need to know what every field does. |
| 4 | [tools.md](tools.md) | You need a quick reference for the six `kb-*` tools and the migration kit (deep reference: [`../tooling/TOOLS.md`](../tooling/TOOLS.md)). |
| 5 | [troubleshooting.md](troubleshooting.md) | A command failed, produced 0 results, or refused to run, and you want to know why. |

## The shortest possible path

```bash
# from the framework repo root
cd tooling && npm install                     # installs gray-matter (the only dependency)
cp manifest.example.json manifest.json        # start from the synthetic demo, then edit it for your Drive
node kb-index.mjs manifest.json --out -        # build the graph; --out - prints it to stdout
node kb-audit.mjs manifest.json --json         # the drift sensor; 0 high-severity findings == healthy
```

Everything else — what to put in `manifest.json`, which of the four stand-up paths fits you, and what the two
human gates are — is in [getting-started.md](getting-started.md).

> **A note on paths.** Commands in this guide are written **relative to the framework repo root** (the folder
> you get from `git clone`, containing `tooling/`, `bootstrap/`, etc.). Inside the MetaOptics Drive that root
> is `__Framework/framework/`. Some older runbooks under `bootstrap/` still use an absolute `__Framework/...`
> prefix — see [troubleshooting.md](troubleshooting.md#paths) if a copied command can't find a file.
