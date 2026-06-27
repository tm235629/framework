---
description: Troubleshooting + FAQ for the knowledge-OS framework — the common failures (manifest not found, 0 files, jq on Windows, migration safety refusals, dead links on a fresh clone) and what each one means. Symptom → cause → fix.
references:
  - path: getting-started.md
    type: related
    note: The happy path these symptoms deviate from.
  - path: tools.md
    type: related
    note: The tools whose flags/behavior these entries explain.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Troubleshooting & FAQ

Symptom → cause → fix.

## `kb-*: manifest not found: .../manifest.json`
**Cause:** you ran a tool with no manifest argument and there is no `manifest.json` yet. The default is
`manifest.example.json` (which *does* ship), so a bare `node tooling/kb-index.mjs` works — but if a doc/script
passes `manifest.json` explicitly, you must create it first.
**Fix:** `cp tooling/manifest.example.json tooling/manifest.json`, then edit it for your Drive (see
[getting-started.md](getting-started.md#2-the-example-vs-real-model-read-this-once)).

## `kb-index` reports `files: 0` (or `kb-focus`/`kb-extract` find nothing)
**Cause:** the manifest's `storage_profile.root` (or `person_profile.root_override`) doesn't point at a real
directory on this machine, or `scan_roots` are wrong, so every scan root is skipped. The shipped
`manifest.example.json` deliberately points at `/srv/acme-drive` (which won't exist on your box) — running it
unedited is *expected* to report 0 files.
**Fix:** set `storage_profile.root` to your absolute Drive root (**forward slashes**, e.g.
`C:/Users/you/OneDrive - YourCo`) and confirm `scan_roots` name real subfolders.

## `--out -` wrote a file literally named `-`
**Cause:** an **old** build of the tool (this was a bug in kb-index/kb-extract where `-` was path-resolved
before the stdout check). Fixed — `--out -` now prints to stdout.
**Fix:** pull the current tools. To clean up a stray file, delete the one named `-` in the directory you ran
from.

<a id="paths"></a>
## A copied command can't find a file under `__Framework/tooling/...`
**Cause:** some `bootstrap/` runbooks still use the **pre-reorg absolute prefix** `__Framework/tooling/...`.
After the framework was split into `__Framework/framework/` (the shippable core) + `__Framework/_instance/`
(private data), the correct in-Drive path is `__Framework/framework/tooling/...`; in a standalone `git clone`
there is no `__Framework` prefix at all — paths are relative to the repo root (`tooling/...`).
**Fix:** run commands **from the framework repo root** and use repo-root-relative paths (`node
tooling/kb-index.mjs ...`), as this `docs/` guide does. (Normalizing the older runbooks to this convention is a
tracked follow-up.)

## A command references `manifest.mot.json` or `company-seed.json` and the file isn't there
**Cause:** those are the **reference instance's filled, private** files — gitignored and **not shipped**. Only
the synthetic `*.example.json` versions ship.
**Fix:** use the example: `cp tooling/manifest.example.json tooling/manifest.json` (and likewise
`company-seed.example.json` → `company-seed.json`), then fill with your real values. In a real same-company
deployment, `company-seed.json` is your company's shared seed.

## `jq: command not found` (teammate runbook, Step 1)
**Cause:** `bootstrap/teammate.md` shows a `jq` one-liner to lift the shared seed; `jq` isn't installed by
default on Windows (the documented target platform).
**Fix:** either install `jq`, or do the copy in Node — `node -e "const s=require('./tooling/company-seed.json');
require('fs').writeFileSync('manifest.json', JSON.stringify({manifest_version:s.manifest_version,
company_profile:s.company_profile, person_profile:{}}, null, 2))"` — or just copy/paste the `company_profile`
block by hand (it is verbatim).

## `SAFETY: inventory out must be named inventory*.json` / `inventory out escapes _validation/`
**Cause:** this is the migration kit's safety interlock **working correctly** — `inventory.mjs` refuses an
output name that isn't `inventory*.json` and refuses to write outside `_validation/` without
`MIGRATION_REAL_RUN=1`.
**Fix:** for a validation run, omit `--out` (it writes to the sandboxed default) or name it `inventory*.json`.
For a real brownfield migration, set the documented env opt-ins (see [tools.md](tools.md#migration-kit)).

## `apply-moves` refuses `--apply`
**Cause:** the target Drive's root matches a `storage_profile.protected_root_markers` entry. `--apply` is
**hard-refused** on a protected live Drive by design — there is no override that mutates a protected root.
**Fix:** run migrations against a *different*, non-protected Drive's manifest, with the documented opt-in env
vars. Never point a real migration at the protected reference Drive.

---

## FAQ

**Do I need a database or a server?** No. The tools are plain Node scripts; Markdown is the source of truth,
JSON is derived. The dashboard (in the reference instance) is optional.

**Is it safe to run the tools against my live Drive?** Yes — all six `kb-*` tools are read-only on the Drive
(they write only to `--out`/`_validation`), except `kb-entities` which additively writes one `entities.json`,
and the migration `apply-moves` which is dry-run-by-default and gated. `kb-walk` never writes a `_catalog.md`.

**What Node version?** ≥ 18; validated on v24.

**How do I know my instance is healthy?** `kb-index` builds without error and `kb-audit` reports **0
high-severity** findings. Med/low findings are triaged continuously on the drift loop, not blockers.

**Where do teammates' confidential entities live?** Only in that person's `person_profile.focus.extra_entities`
— local to their instance, never written back to the shared seed.
