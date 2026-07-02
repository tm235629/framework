---
description: TEMPLATE, not data — the shape of a live shared company contact register (one markdown table, one row per person). Every value is a {company-slot} marker binding to company_profile.contact_register in a filled manifest.json; the filled instance copy is the company's live shared SOT (resource class 3), never a per-drive copy.
references:
  - path: tooling/config.schema.json
    type: standard
    note: The manifest schema the {company-slot}s bind to — this template fills company_profile.contact_register.*; storage_profile.shared_root resolves the register path when contact_register.shared is true.
  - path: templates/registries/README.md
    type: related
    note: Seed registries vs live shared registers — this register is resource class 3 (one live shared SOT per company), not a bootstrap-copied seed.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# contact-register — a live shared company register (TEMPLATE)

This template carries the **shape** of a company's contact register: a single markdown table,
**one row per person**, that is the source of truth for the **person axis** of the dashboard
**Contacts tab**. Unlike the two seed registries in this folder (entity + context, which are JSON
copied once at bootstrap), the contact register is **resource class 3 — a live shared register**: when
`contact_register.shared` is true there is **exactly one on-disk SOT per company**, read by every
teammate instance and written only through gated mechanisms (see [README](README.md) →
"Seed registries vs live shared registers"). It is **markdown, not JSON**, because the register *is*
a human-editable table — the JSON seed templates hold structured seed data an instance pastes into a
manifest, whereas this file's filled copy is a living document humans and the rebuild both edit in place.

Every value below is a `{company-slot}` marker naming the manifest field it draws from. Replace each
slot from `company_profile.contact_register.*` (and `storage_profile.shared_root` for the path) when an
instance turns the register on; the "MOT example" column shows the provenance value the reference
instance uses. *(MOT is Instance Zero — its values are provenance only, never defaults to copy.)*

## Register shape — the 11-column table

The filled register is a single `## {contact-register-heading}` markdown table, sorted **Company → Name**,
with the columns declared by `contact_register.schema_columns` in this exact order:

| `{company-slot}` header | Axis | Owner (human vs rebuild) | Meaning |
|---|---|---|---|
| `{col-name}` | person | human + rebuild | Display name `Firstname Lastname`, one person per row. |
| `{col-company}` | link | rebuild | Canonical company name — identical for all of a company's people (unify variants). |
| `{col-title}` | person | human | Job function if known, else `—`. There is no person field called "role". |
| `{col-flag}` | person | **human only** | Manual override from `contact_register.flag_enum`; preserved across every rebuild (see below). |
| `{col-last-contact}` | person | rebuild (+human) | `YYYY-MM-DD` of the most recent real touch; drives the **computed** status. |
| `{col-owner}` | — | **human only** | The person who owns the relationship. Left `—` until a human assigns it — never auto-assigned. |
| `{col-email}` | person | rebuild (+human) | Primary email — the **natural unique key** (one address = one person). |
| `{col-phone}` | person | human | Phone if known, else `—`. |
| `{col-context}` | — | human | How/why this contact entered the register (source, referral, event). |
| `{col-linked-project}` | link | rebuild | Relative path to the contact's company `Overview.md`, else `—`. **Join key for the derived company axes.** |
| `{col-notes}` | — | human | Free-text enrichment / background. |

Filled table skeleton (delete these illustrative rows; keep only the header + separator):

```markdown
## {contact-register-heading}

| Name | Company | Title | Flag | Last contact | Owner | Email | Phone | Context | Linked project | Notes |
|------|---------|-------|------|--------------|-------|-------|-------|---------|----------------|-------|
| {person-name} | {company-name} | {person-title} | — | {YYYY-MM-DD} | — | {person-email} | — | {entry-source} | {overview-path} | {free-text} |
| {person-name} | {company-name} | {person-title} | do-not-contact | — | — | {person-email} | — | {entry-source} | — | {free-text} |
```

## Person-axis-only rule — what is NOT stored here

The register stores **person fields + the manual `Flag`** only. Two whole classes of attribute are
deliberately **absent** and must never be hand-written into a cell:

- **No stored status.** The derived contact status (`vocab.derived_contact_status`:
  `active` / `idle` / `dormant` / `uncontacted`) is **computed at extract, never stored** — from
  `{col-last-contact}` vs the real current date, against `contact_register.status_thresholds`
  (`active` ≤ `active_days`; `idle` ≤ `idle_months`; `dormant` beyond; `uncontacted` = no last-contact
  date). Because it is computed against the current date it stays correct without a rebuild — a stale
  register no longer shows stale statuses.
- **No stored company attributes.** A company's role / vertical / phase / tier are **derived at extract**
  by joining `{col-linked-project}` → that project's `Overview.md` frontmatter. To change a contact's
  company axes, edit the **company's `Overview.md`**, not a row here — it propagates to every contact at
  that company on the next extract. This keeps a person one relationship even when their company runs
  several projects.

## Flag column semantics

`{col-flag}` is the **only manual engagement control**. Its allowed values are exactly
`contact_register.flag_enum` (plus `—` for "no flag"):

| Value | Meaning |
|---|---|
| `—` | No flag — normal contact; whatever status is computed applies. |
| `{flag-enum-1}` (`do-not-contact`) | Competitor / opted-out — **never solicited**; the outreach skill skips the row. |
| `{flag-enum-2}` (`archived`) | Soft-deleted — hidden from the default dashboard view; kept for the record. |

Flag is **set deliberately by a human and survives every rebuild pass** (on a merge, precedence is
`do-not-contact` > `archived`). Everything else about engagement state is computed, so the flag is the
one field a rebuild must never clobber.

## Editing contract — human columns vs rebuild-owned columns

| Concern | Human edits | Rebuild owns |
|---|---|---|
| Identity / enrichment | `Name`, `Title`, `Phone`, `Context`, `Notes` | — |
| Engagement control | `Flag`, `Owner` (assign by hand) | — (preserves `Flag`; never auto-assigns `Owner`) |
| Recency | correct `Last contact` for off-email touches | refreshes `Last contact` from mail history (keeps the freshest of file vs mail) |
| Company binding | — | `Company`, `Linked project` (resolved from email domain / company match) |

Rules: one row per person; **`Email` is the unique key** — merge duplicates, never add a second row.
Never hand-write a status anywhere (it is computed). Role inboxes matching
`contact_register.role_inbox_patterns` (e.g. `info@`, `sales@`, `noreply@`) are filtered at rebuild and
must not be added as people rows.

## Binding table — template slots → manifest fields

Every slot above resolves from `company_profile.contact_register.*` (path from
`storage_profile.shared_root` when `shared` is true, else the instance root):

| Template slot | Manifest field | MOT example (provenance) |
|---|---|---|
| register enabled at all | `contact_register.enabled` | `true` |
| one shared SOT vs per-drive | `contact_register.shared` | `true` |
| register file location | `contact_register.path` (vs `storage_profile.shared_root`) | `__Sales/Contacts/Contacts.md` |
| `{contact-register-heading}` + column headers | `contact_register.schema_columns` | `Name, Company, Title, Flag, Last contact, Owner, Email, Phone, Context, Linked project, Notes` |
| `{col-flag}` allowed values | `contact_register.flag_enum` | `["do-not-contact","archived"]` |
| `active`/`idle`/`dormant` boundaries | `contact_register.status_thresholds` | `{ active_days: 60, idle_months: 6 }` |
| role-inbox filter | `contact_register.role_inbox_patterns` | `["info@","sales@","support@","noreply@"]` |
| who may contribute batches | `contact_register.senders` (→ `entity_registry.people`) | MOT outreach senders |
| mined-source / shortlist / draft dirs | `contact_register.sources_dir` · `shortlists_dir` · `drafts_dir` | `__Sales/Contacts/` sub-dirs |
| status vocabulary (documented, not stored) | `vocab.derived_contact_status` | `["active","idle","dormant","uncontacted"]` |
| outreach cadence + staleness flag | `cadence.outreach.{shortlist_period,staleness_flag_days}` | `{ weekly, 7 }` |

## Turning the register on for a new instance

1. Set `company_profile.contact_register.enabled: true` in the manifest and choose `shared`
   (`true` → one company SOT under `storage_profile.shared_root`; `false` → a private per-drive copy for
   a single-person instance).
2. Fill `path`, `schema_columns`, `flag_enum`, `status_thresholds`, `role_inbox_patterns`, `senders`,
   and the three dirs; validate against `config.schema.json`.
3. Create the register file at the resolved path with the header skeleton above (delete the illustrative
   rows). Write only through the gated rebuild (dry-run default + `--apply` invariant checks + timestamped
   backup + atomic write) or CRUD-through-server — never by ad-hoc bulk edits.
