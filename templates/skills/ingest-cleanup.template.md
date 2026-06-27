---
description: The safe-janitor skill skeleton — the generalized form of MOT's email-cleanup. Stages adapter junk (zero-byte placeholders, signature/icon images, generic inline images) to a review folder, flags borderline cases, and deduplicates recurring assets against a known-signatures reference. Never deletes. Parameterized by the inbox adapter's junk patterns and the raw-archive root; every company value is a {company-slot} naming its manifest field.
references:
  - path: templates/skills/periodic-sync.template.md
    type: trigger
    note: The orchestrator that invokes this janitor after each ingest pass (Step 1 light-mode cleanup + the after-run cleanup).
  - path: tooling/config.schema.json
    type: standard
    note: The junk patterns ({email-adapter.junk_patterns}), the archive location, and the raw-archive root all come from this manifest schema (input_adapters.email, raw_archive_roots).
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Ingest-Cleanup (safe-janitor) — template

> **Mechanism only.** Every `{slot}` names a `manifest.json` field. Junk patterns, the archive location,
> and thresholds are NOT hardcoded — they come from `{email-adapter}` (manifest `input_adapters.email`).
> This generalizes MOT's `email-cleanup`.

## Preamble

You already have `{hub-file}` and `{state-file}` in context. Read `{archive-format-standard}` before
starting (the instance's filename-convention + junk-pattern Standard). Consult `{state-file}` for the last
cleanup-run date. Do **not** preload the cleanup log — only append to it at the end.

Scope trigger *(instance-named)*: the cleanup verbs for this instance — e.g. "ingest cleanup", "archive
cleanup". Also runs as the final sub-step of the periodic-sync orchestrator.

**Key principle: NEVER permanently delete.** All junk is **moved** to the review/staging folder for a human
to confirm. The janitor stages; the human disposes.

---

## Locations (all from the manifest)

- **Source archive:** `{email-adapter.location}` (manifest `input_adapters.email.location`) — a flat
  directory holding the raw inbound.
- **Staging folder:** `{archive-location}/{staging-subfolder}` — create if missing. Junk lands here, never
  in a delete.
- **Known-signatures reference:** `{archive-location}/{known-signatures-subfolder}` — one canonical copy of
  each recurring logo/signature block.

## Step 1 — Move junk to staging

Auto-move only files matching the adapter's **junk patterns** (`{email-adapter.junk_patterns}`, manifest
`input_adapters.email.junk_patterns`) under their size thresholds. The pattern *classes* generalize; the
exact globs + thresholds are the instance's adapter values:

| Class | Identify by | Source slot |
|---|---|---|
| Zero-byte placeholders | size = 0 | the adapter's zero-byte placeholder glob |
| Small icons / logos | adapter-named, under the small-image threshold, hash-like name | the adapter's icon glob + threshold |
| Generic inline images | generic name, under the small-image threshold, non-zero | the adapter's inline-image glob + threshold |
| Duplicate artifacts | identical size + content at a different timestamp | per tracker |

## Step 2 — Borderline cases (do NOT auto-move)

Flag for human review, leave in place — the band the adapter marks ambiguous (e.g. mid-size inline images
that could be small diagrams *or* signature blocks; descriptively-named non-zero files that might carry
useful contact info). When in doubt, leave it: a janitor that stages a real diagram is worse than one that
leaves junk for the next pass.

## Step 3 — Signature deduplication

Recurring company signatures appear dozens of times; dedupe against the reference instead of staging each:
1. Check `{known-signatures-subfolder}` for an existing reference copy.
2. No reference + the image is a useful logo/signature → copy ONE instance to the reference with a
   descriptive name, then stage ALL other copies.
3. Reference exists → compare: match → stage the incoming copy; genuinely updated → replace the reference,
   stage the old copies.

---

## Never move to staging

- Primary-record body files (`{email-adapter.body_formats}`) — the record itself.
- Meaningful artifacts: documents, CAD, archives, calendar files.
- Images with descriptive (non-generic) filenames.
- Any file over the keep-threshold with a descriptive name.

## After cleanup

- Append a row to the cleanup log: date, files-moved count, classes, borderline decisions.
- Run `{state-tool}` (write-state mode) so `{state-file}` picks up the new run count.

## Schedule

Runs after each ingest batch on the window just processed (driven by the periodic-sync orchestrator). A
periodic full-archive sweep when the user requests one.

> **Synced-cloud / numbered-asset traps (from `storage_profile` + `excludes`):** on a synced-cloud
> instance, move with lock-safe retries; never stage `-N` numbered assets (they are sequence members, not
> conflicts) — the only conflict pattern is `excludes.conflict_pattern`.
