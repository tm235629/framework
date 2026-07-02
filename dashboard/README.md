---
description: The framework dashboard slice — a KB_ROOT-parameterized copy of the reference operations dashboard (graph/tree/files live + Projects/Entities/Drift/Contacts from the kb-* data layer). Prerequisites, install, run, and the acceptance check.
references:
  - path: dashboard/DATA_CONTRACT.md
    note: which tab consumes which JSON and who produces it
  - path: tooling/kb-dashboard-config.mjs
    note: generates this slice's instance.config.json from the manifest
status: current
context: framework-architecture
tags: [framework-meta, dashboard]
---

# Dashboard slice

The **optional plugin layer** promised by DECISIONS O4: a browser dashboard over the
knowledge base. Agents and the CLI read the graph directly, so most instances can
skip this — but when you want a visual graph, a project board, an entity registry
and a drift view, this is a drop-in, parameterized copy of the reference
(MetaOptics) dashboard.

It is fully de-MOT'd: the server resolves its drive from **`KB_ROOT`** (no hardcoded
fallback), the header name / vocab orders / brand come from your manifest via
`tooling/kb-dashboard-config.mjs`, and MOT-schema write-back endpoints degrade to
`501 instance extractor not configured` until you wire a plugin.

## What it is

- **Live tabs** (served by the slice server, straight off `KB_ROOT`): Graph, Tree,
  Files, Literature, Skills.
- **Core data tabs** (from the shipped `kb-*` data layer): Projects (`kb-extract`),
  Entities (`kb-entities`), Drift (`kb-audit`), Contacts (`kb-contacts`).
- **Instance-plugin tabs** (need an instance-supplied extractor): Sync, To-Do,
  Calendar, Assignments.

The full tab-to-JSON-to-producer mapping and the graceful-empty rule are in
[`DATA_CONTRACT.md`](DATA_CONTRACT.md).

## Prerequisites

- **Node** (the same major used by the rest of the framework tooling; the slice
  targets the Vite 8 / React 19 stack in `package.json`).
- **The `kb-*` data layer**, if you want the core data tabs populated: run the
  extractors (`kb-extract`, `kb-entities`, `kb-audit`, `kb-contacts`) so their JSON
  lands in your data dir. Without them the data tabs render their empty state — the
  dashboard still starts and the Graph/Tree/Files tabs work off `KB_ROOT` alone.

## Install

```
cd dashboard
npm install
```

> **OneDrive users:** `node_modules/` inside a synced folder causes heavy sync
> churn. It is git-ignored (`dashboard/node_modules`, `dashboard/dist`); consider
> excluding it from sync, or run the slice from an out-of-OneDrive checkout.

## Configure (optional — brands + tunes the copy)

```
npm run config                 # = node ../tooling/kb-dashboard-config.mjs
# or point at your filled manifest:
node ../tooling/kb-dashboard-config.mjs manifest.json
```

This emits `src/config/instance.config.json` (git-ignored, instance-specific): the
server reads it at boot for `displayName`, the folder-prefix convention, the data
dir, the contact-register path, and plugin script paths, and re-serves the vocab
orders / category rules / brand to the client at `GET /api/config`. The slice ships
sane fallbacks (`src/config/instance-config.js`), so it runs fine before you ever
generate this.

## Run

`KB_ROOT` is **required** — the server exits with a clear message if it is unset.

```
# PowerShell
$env:KB_ROOT = "C:/path/to/your-drive"; npm run dev

# bash
KB_ROOT="/path/to/your-drive" npm run dev
```

`npm run dev` runs the API server (`node server.js`, port `3001` or `$PORT`) and the
Vite dev client (port `5173`, proxying `/api` to the server) together. For the API
alone: `KB_ROOT=… node server.js`.

## Acceptance check

With the server pointed at a populated drive:

1. `GET /api/config` echoes `{ root, displayName, … }` — confirms `KB_ROOT` resolved.
2. `GET /api/graph` returns `{ nodes, edges }` with a non-empty `nodes` array — the
   graph is built live from the folder walk, so this works even with no data JSON.
3. The **Projects** tab renders cards — confirms the `kb-extract` output
   (`projects.json`) is being served and projected.

A production build must also succeed:

```
cd dashboard && npx vite build      # → dist/ (git-ignored)
```
