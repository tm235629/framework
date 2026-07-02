---
description: Design spec for the contact-register slice — the first "live shared company register" (one on-disk source of truth per company for a deliberately-shareable mutable register), its invariant-gated rebuild pipeline, and the multi-instance contribution→merge model.
references:
  - path: slices/drift-detection/DESIGN.md
    type: sibling
    note: Same slice-as-extraction-record form; the auditor slice is the companion mechanism co-developed on the same reference instance.
  - path: tooling/config.schema.json
    type: related
    note: The manifest fields (company_profile.contact_register.*, storage_profile.shared_root, cadence.outreach, vocab.derived_contact_status) a generalized port would consume.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Slice — Contact register (live shared company register)

> **Reference instance:** MetaOptics (MOT) is the worked *reference instance* ("Instance Zero") this slice
> is co-developed on — the named artifacts (`__Sales/Contacts/_scripts/rebuild_contacts.py`,
> `merge_summaries.py`, the `__temp/mails/` archive, `mot-tools.js extractContacts`) are that instance's,
> cited as the worked example. This doc is the reusable mechanism; the code lives in the reference
> instance's tooling. **The generalized code port is NOT yet built** — this slice documents the *validated
> mechanism*; MOT's scripts are the working reference.

**Goal:** introduce a third framework resource class — a **live shared company register**: exactly one
on-disk source of truth per company for a deliberately-shareable *mutable* register (the first such register
is the contact address book). It is distinct from the two existing classes: (1) the **copy-time company
seed** (a `company_profile` copied once at bootstrap, then diverges) and (2) **instance-local person data**
(each teammate's own person profile and focus config). The shared register is neither copied-and-forked nor
private — it is *pooled*: one file every opted-in instance **reads**, and **contributes batches to** through
a gated merge.

## Why a shared register (record the rationale)

Per-drive copies of a contact book fork in three ways that each cause real operational harm:
- **Last-contact dates diverge** — two teammates each hold a stale copy, so the "who is idle" view is wrong
  in both.
- **The pooled multi-sender shortlist breaks** — the weekly outreach shortlist is meant to draw from every
  sender's history at once so two people don't both email the same contact; forked copies reintroduce the
  double-contact risk the pooled view exists to remove.
- **Do-not-contact flags fracture** — a suppression set by one person is invisible to the others, the worst
  possible failure for a compliance flag.

So the register is **opt-in and pooled**: an instance sets `shared: true` and resolves the register against
a company-shared storage location; a lone single-person instance keeps `shared: false` and the register
lives in its own drive with identical mechanics.

## The rebuild pipeline (mechanism extracted from the reference instance)

The register is a plain Markdown table (person-only columns + a manual `Flag`); everything else — person
*status* and company *axes* — is **derived at extract time**, never stored. A rebuild re-derives the mutable
person fields from working artifacts (the D5 extract-from-working-artifacts rule: the mail archive and the
project index are the sources of truth; the table is a projection). Reference implementation:
`__Sales/Contacts/_scripts/rebuild_contacts.py`.

**Stage 1 — mail-adapter scan.** Walk the local mail archive (reference: `__temp/mails/*.JSON`); for every
non-own address seen in `from`/`to`/`cc`, keep the **freshest received date** and a message count. The
freshest-per-address date becomes each contact's **Last contact**. A completeness guard aborts the whole run
if too few mail files are visible (reference floor: `<100` JSONs → files-on-demand / offline → refuse to
rebuild from partial data).

**Stage 2 — domain → project linking.** An email domain resolves to a company/project two ways: an explicit
domain-map override first, then an automatic second-level-domain match against the project index (reject
generic industry words like "optics"/"systems" so a domain SLD doesn't false-match a hub name). A corporate
domain is treated as the employer source of truth (freemail domains are excluded from that inference), which
fixes collaborators being mis-attributed to the company whose thread they appeared in.

**Stage 3 — role-inbox filtering.** Shared/functional inboxes (`info@`, `sales@`, `support@`, `noreply@`,
…) are recognized by a token/prefix test (so surnames like "gonsalves" are never mistaken for "sales"). If
the *name itself* denotes the role inbox, the row is dropped; if a real person is merely writing from a
shared inbox, the person is kept but the shared address is stripped.

**Stage 4 — multi-pass dedup.** The same person arrives from several sources (whitepaper seed, project-
Overview mention, mail net-new, mined summary). Reference passes, in order: dedup by `(name, company)`;
dedup by shared email (one address = one person, merging initials-vs-fullname variants); absorb email-less
rows into an already-assigned address at the same org; and a union-find consolidation of same-name rows at
the same org that **never** unions two rows carrying *distinct* emails (keeps dual affiliations and distinct
same-name people apart). Merges always keep the freshest Last-contact and union the manual flags
(do-not-contact wins).

## Safety model (non-negotiable, validated on the reference instance)

The register is written **only** through the gated mechanism:
- **Dry-run is the default.** A plain run writes a *candidate* file + a change report to stdout and never
  touches the register.
- **`--apply` is an invariant gate.** It writes the register only after **every** invariant passes: input
  completeness, exact schema-column match, no lost emails (a dropped address must be explained as
  role-stripped / company-excluded / an alt-email), a row-count floor (`--allow-shrink` overrides only that
  one), no duplicate output emails, and **no lost manual flags**. Any failure aborts with the register
  untouched.
- **Timestamped backup + atomic write.** `--apply` copies the current register to a timestamped backup
  (reference: `_scripts/_backups/`, pruned to the last N) before an atomic tmp-file rename.
- **Env override for testing.** A single env var repoints the register path (reference: `MOT_CONTACTS_MD`)
  so the full apply cycle can be exercised against a scratch copy without risking the real file. See
  `VALIDATION.md` for the 2026-07-02 evidence.

## Multi-instance model (per the resource-class design)

Each opted-in teammate instance:
- **READS** the shared register (resolves its path against the shared storage root when `shared: true`),
  computes person **status locally at extract** against the real current date, and derives company axes
  against **its own** project graph — so no derived state is ever written back into the shared file.
- **CONTRIBUTES per-instance batches** — the natural unit is a **mail-scan summary** mined from that
  instance's own local mail archive (a teammate can only see their own mailbox). A **merge step** folds
  those per-instance batches into the shared SOT.

The reference instance's `merge_summaries.py` is the **validated embryo of that merge step**: it reads the
per-batch mined-contact JSONs, drops non-persons / MOT-internal / excluded-company / role-inbox mentions,
merges duplicate mentions by `(name, company)` preferring non-empty fields, and emits one consolidated
`summary_contacts.json` — which the rebuild then ingests as a contribution source. Generalizing it means
making "batch" mean "one teammate instance's contribution" and folding several such batches, rather than
several local batch files, before the invariant-gated write.

## Interface sketch — the future generalized port (manifest-driven)

Not yet built. A generalized `kb-contacts-rebuild` would consume these manifest fields (defined in
`tooling/config.schema.json`) instead of the reference instance's hardcoded constants:

| Manifest field | Drives |
|----------------|--------|
| `company_profile.contact_register.enabled` | whether the slice runs at all |
| `company_profile.contact_register.shared` | resolve `path` against `storage_profile.shared_root` (true) or the instance root (false) |
| `company_profile.contact_register.path` | the register file location |
| `company_profile.contact_register.schema_columns` | the exact header the schema-match invariant enforces |
| `company_profile.contact_register.flag_enum` | the manual-flag vocabulary preserved across rebuilds |
| `company_profile.contact_register.status_thresholds` | `active_days` / `idle_months` for the derived status (extract-time only) |
| `company_profile.contact_register.role_inbox_patterns` | the inbox prefixes filtered in Stage 3 |
| `company_profile.contact_register.senders` | which `entity_registry.people` are outreach senders (pooled shortlist scope) |
| `company_profile.contact_register.sources_dir` / `shortlists_dir` / `drafts_dir` | where mined batches, shortlists, and drafts live |
| `storage_profile.shared_root` | the company-shared storage location shared registers resolve against |
| `cadence.outreach.shortlist_period` / `staleness_flag_days` | the pooled-shortlist cadence and staleness flag |
| `vocab.derived_contact_status` | the `[active, idle, dormant, uncontacted]` vocabulary — **DERIVED AT EXTRACT, never stored** |
| `person_profile.voice_profile` / `outreach_sender` | per-person outreach voice + whether they send |

The **derived layer** (status + company axes) is proven separately — it is the extract's job, not the
rebuild's. See `VALIDATION.md`.

## What graduates to the framework (generalizable principles)

- **Three resource classes, not two:** copy-time seed · instance-local data · **live shared register**
  (pooled, opt-in, one SOT per company).
- **Store person facts, derive everything else at extract:** the register never stores status or company
  axes — a projection can't fork what it doesn't hold.
- **Write only through a gate:** dry-run default + invariant-checked `--apply` + timestamped backup +
  atomic write + env-overridable path for safe testing.
- **Contribute batches, merge into the SOT:** each instance can only see its own mailbox, so per-instance
  mail-scan summaries + a merge step is the only sound way to pool — the read-many / contribute-batch /
  gated-merge shape.
