---
description: The dashboard slice's data contract — which tab consumes which JSON, which kb-* tool (or instance plugin) produces it, the graceful-empty rule, and how an instance supplies plugin extractors for the Sync/To-dos/Events/Assignments tabs.
references: None
status: current
context: framework-architecture
tags: [framework-meta, dashboard]
---

# Dashboard data contract

The dashboard is a **read-only projection**. Every tab renders a JSON file that a
tool produces from the markdown source of truth; the markdown always wins, the JSON
is derived and regenerable. This file is the seam: it says exactly what each tab
needs, who produces it, and what happens when it is absent.

## Core tabs vs. instance-plugin tabs

**Core tabs** are framework-supported: their JSON comes from the shipped `kb-*`
tools, so any instance gets them for free once the data layer runs.

**Instance-plugin tabs** need an instance-supplied extractor — the framework ships
the *view*, but the *feed* is instance-specific (MOT's live in
`__Operations/Dashboard/scripts/mot-tools.js`). Until an instance wires a producer,
those tabs render the graceful-empty state (below).

| Tab | Kind | Data source (served at) | Produced by | Notes |
|-----|------|--------------------------|-------------|-------|
| Graph | core | `GET /api/graph` (live) | the slice server (walks `KB_ROOT`) | Built live from the folder walk + frontmatter; no JSON file. |
| Tree | core | `GET /api/tree` (live) | the slice server | Live folder tree, same walk as Graph. |
| Files | core | `GET /api/files?path=…` (live) | the slice server | Reads/writes a file under `KB_ROOT`. |
| Projects | core | `/api/data/projects.json` | `kb-extract` | Overview TL;DR cards; facets sort by manifest vocab order. |
| Entities | core | `/api/data/entities.json` | `kb-entities` | People + company registry. |
| Drift | core | `/api/data/drift.json` | `kb-audit` | Frontmatter / reference drift findings. |
| Contacts | core | `/api/data/contacts.json` | `kb-contacts` | Only when `contact_register.enabled`; status DERIVED at extract. |
| Sync | plugin | `/api/data/sync.json` (+ `sync-weeks.json`, `sync/<week>.json`) | instance extractor | Weekly operations sync. |
| To-Do | plugin | `/api/data/todos.json` | instance extractor | Action-items board (+ `assignments.json` overlay via `POST /api/assignments`). |
| Calendar | plugin | `/api/data/events.json` | instance extractor | Events timeline. |
| Literature | core-ish | `GET /api/literature` (live) | the slice server | Reads `<literatureDir>/Papers|Patents` sidecars; empty payload if absent. |
| Skills | core | `GET /api/skills` (live) | the slice server | Lists `.claude/commands/*.md`; empty array if absent. |

`/api/data/*.json` is served statically from the instance's data dir
(`instance.config.json → dataDir`, default `__Operations/Dashboard/data`).

## The graceful-empty rule

**Every tab renders an explicit empty state when its JSON is absent — never a crash
or a blank screen.** In the slice this is implemented in `useData` (see
`src/components/DataViews.jsx`): a `404` on `/api/data/<name>.json` is treated as a
*configuration state*, not an error, and the view renders

> No data source configured for this view (Tab) — see DATA_CONTRACT.md

Any *other* failure (HTTP 500, network, JSON parse) still surfaces as an error with
a retry, so a genuinely broken feed is distinguishable from an unconfigured one.
Live tabs degrade the same way: `/api/literature` and `/api/skills` return an empty
payload when their folders are missing, so those tabs show a plain "no matches"
rather than an error.

## How an instance supplies plugin extractors

1. **Produce the JSON.** Write an extractor (any language) that reads your markdown
   sync / to-do / events sources and emits `sync.json`, `todos.json`, `events.json`
   into your `dataDir`. MOT's reference implementation is `mot-tools.js extract`.
2. **Register spawn-back scripts (optional).** Two write-back endpoints spawn an
   instance script; wire their root-relative paths via the manifest so the slice can
   run them:
   - `POST /api/contacts` re-runs `pluginScripts.extract` after a register edit
     (absent → the edit still saves; contacts.json just isn't auto-refreshed).
   - `POST /api/render-pdf` runs `pluginScripts.syncPdf`; absent → `501 instance
     extractor not configured`.
3. **Regenerate the dashboard config** so the server learns your `dataDir`,
   `displayName`, vocab orders, and plugin script paths:
   `node ../tooling/kb-dashboard-config.mjs manifest.json` →
   `src/config/instance.config.json`. The server reads it at boot and re-serves the
   client-facing parts at `GET /api/config`.

Nothing here is required to *start* the dashboard: with no config and no data JSON,
the Graph/Tree/Files tabs work off `KB_ROOT` alone and the derived tabs show their
empty state.
