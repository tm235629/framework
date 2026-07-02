---
description: Generalized contact-register contract — the three-axis model (person stored · status computed at extract · company axes derived via the linked-project graph join), editing rules, the gated-rebuild safety model (dry-run default + invariant gates + timestamped backup + atomic write), and the consumption map. Mechanism only; the register path, columns, flag enum, status thresholds, and role-inbox patterns are {company-slot}s from the manifest.
references:
  - path: tooling/config.schema.json
    type: standard
    note: Slots resolve from company_profile.contact_register.{path,schema_columns,flag_enum,status_thresholds,role_inbox_patterns,sources_dir,shortlists_dir,drafts_dir}, storage_profile.shared_root, and vocab.derived_contact_status.
  - path: templates/standards/contact-selection.template.md
    type: related
    note: The weekly-shortlist scorer that reads this register (the person axis) plus the derived company/status axes; §5's consumption map hands off to it.
  - path: templates/standards/outreach-framework.template.md
    type: related
    note: The drafting-side framework the register feeds; do-not-contact flags and per-send bookkeeping (Last-contact + Notes) are shared with it.
status: current
context: framework-architecture
tags: [framework-meta]
---

# Contact-register contract — the live shared address book

The register is a **resource class 3 "live shared company register"** (ARCHITECTURE / manifest
`company_profile.contact_register`): exactly **one on-disk source of truth per company** for a
deliberately-shareable mutable register — the first instance is the contact/address book. It is opt-in
(`contact_register.enabled`); a single-person instance keeps `shared: false` and the register lives in its own
Drive, while a team resolves `shared: true` against `{shared-root}` so every teammate reads and writes the
**same** file. Every path, column, enum, and threshold below is a `{company-slot}` from the manifest; the
*model* is generic.

> **Why one shared copy, not per-drive copies.** Per-drive copies fork `Last contact` dates, break the pooled
> multi-sender shortlist (two senders unknowingly mail the same person — double-contact risk), and fracture
> the `{flag-do-not-contact}` flags. The single SOT is written only through the gated mechanisms in §3; each
> teammate instance *reads* it (computing status locally, deriving company axes against its own graph) and
> *contributes* per-instance batches that a merge step folds back in.

---

## 1. The three-axis model

The register stores exactly **one axis** — the person. The other two are computed/derived at extract and are
**never stored** in the register file.

| Axis | Source of truth | Where it surfaces |
|------|-----------------|-------------------|
| **Person** (name, company, title, `{flag-column}`, last contact, owner, email, phone, context, linked project, notes) | the register file — `{register-path}` | `{contacts-json}` passthrough |
| **Company** (`supply_chain_role`, `vertical`, `phase`, `tier`) | the company's `Overview.md` frontmatter | `{entities-json}`; **joined** onto each contact at extract as `company_role` / `company_vertical` / `company_phase` / `company_tier` |
| **Status** (relationship recency) | **computed at extract** from `Last contact` vs the real current date | `{contacts-json}` `status` field |

- **Person axis — stored.** One row per person, keyed on **Email** (the natural unique key). The column set is
  `{schema-columns}` (`contact_register.schema_columns`), in order. The only manual engagement control is the
  **`{flag-column}`** column, whose allowed values are `{flag-enum}` (`contact_register.flag_enum`, e.g.
  `{flag-do-not-contact}` / `{flag-archived}`); everything else about engagement state is computed.
- **Status axis — computed at extract, never stored.** The extractor (`{extract-tool}`) derives each row's
  status from `Last contact` vs the current date, using `{status-thresholds}`
  (`contact_register.status_thresholds`). The value space is **`{contact-status-enum}`**
  (`vocab.derived_contact_status`):

  | status | rule |
  |--------|------|
  | `active` | last contact ≤ `{active-days}` days ago |
  | `idle` | `{active-days}` days < last contact ≤ `{idle-months}` months |
  | `dormant` | last contact beyond `{idle-months}` months → re-engage batch |
  | `uncontacted` | no last-contact date (e.g. a fresh inbound lead) → first-touch batch |

  Because status is computed against the current date, it stays correct **without rebuilds** — a stale
  register never shows stale statuses. Never hand-write a status anywhere.
- **Company axes — derived at extract.** For each contact the extractor joins **Linked project** → the
  project's `Overview.md` frontmatter (fallback: case-insensitive company-name match against the entity
  registry / entity card) and emits `company_role` (canonical `supply_chain_role`), `company_vertical`,
  `company_phase`, `company_tier`. All four are `null` for a contact whose company has no project yet and fill
  in automatically once the company becomes a project. **To change a contact's company role/vertical, edit the
  company's `Overview.md` frontmatter** — it propagates to every contact at that company on the next extract.

Keeping the axes separate resolves the multi-project problem: a person at a supplier is **one** relationship
even when that supplier has both an active and a dormant project.

## 2. Editing rules

- **One row per person; Email is the unique key** — merge duplicates rather than adding a second row. A merge
  that would drop a person's second address preserves it (e.g. as `alt-email:` in Notes).
- **Company follows the canonical company name** — keep it identical across all of a company's people (unify
  variants); company role/vertical live in the company's `Overview.md`, not here.
- **Never assign Owner automatically** — leave the neutral `—` until a human claims the contact.
- **Last contact is recency data** — a rebuild refreshes it from the source history (keeping the freshest of
  file vs source); update it by hand when a real touch happens outside the tracked channel.
- **`{flag-column}` is the only manual engagement field** — set a `{flag-enum}` value deliberately; rebuilds
  preserve it across every pass.

## 3. Rebuild safety model

The register is regenerated by a gated rebuild script — the SOT can never be silently corrupted. Two write
mechanisms are permitted (S1): the **invariant-checked rebuild** below, or a **CRUD-through-server** path that
re-derives immediately. The rebuild:

- **A plain run is a dry-run** — writes a candidate file + a change report (added / removed / company- or
  link-changed rows) and leaves the register **untouched**.
- **`--apply` is required to write**, and first checks these **hard invariants** (any failure ⇒ abort, register
  untouched):

  | Gate | Invariant |
  |------|-----------|
  | Input completeness | source inputs visible above a floor (≥ N source items, ≥ M projects) — guards the files-on-demand / not-yet-synced failure mode |
  | Schema header | the register header equals the `{schema-columns}` set, in order |
  | No lost emails | no register **Email** disappears unless merged / role-stripped / excluded — each accounted for |
  | No lost flags | no manual `{flag-column}` value is dropped (precedence on merge, e.g. `{flag-do-not-contact}` > `{flag-archived}`) |
  | Shrink floor | row count does not fall below ~3% of the current register (`--allow-shrink` override, only after human review) |
  | No duplicate emails | one address = one person after all passes |

- **Every apply takes an automatic timestamped backup** (last N kept) and **writes atomically** (tmp file +
  rename, so an interrupted write never leaves a half-file).
- **Role inboxes are filtered** at rebuild using `{role-inbox-patterns}` (`contact_register.role_inbox_patterns`,
  e.g. `info@` / `sales@` / `noreply@`) — a rebuild never adds a shared/role mailbox as a person.
- **Per-instance contribution + merge.** Each teammate instance contributes source batches to
  `{sources-dir}` (`contact_register.sources_dir`); a **merge step** folds them into the SOT before the
  rebuild reads them. Merge, then rebuild dry-run, then `--apply`, then extract.
- **A path-override env var** points the script at a scratch copy for testing, so the real register is never a
  test target.

Normal cycle (weekly, no manual involvement needed once reviewed):

```
<merge step>                      # only when new source batches exist
<rebuild>                         # dry-run: candidate + change report
# review the report (invariants PASS, diff sane), then:
<rebuild> --apply                 # timestamped backup + atomic write
<extract>                         # refresh {contacts-json} for the dashboard
```

## 4. Consumption map

```
{register-path}  (person axis, stored)
   └─ Overview.md frontmatter (company axes)      ── join ──►  {extract-tool}
   └─ Last contact vs current date (status)       ── compute ─►      │
                                                                     ▼
                                            {contacts-json}  (person + status + company_*)
                                                                     │
                     ┌───────────────────────────────┬──────────────┴────────────────┐
                     ▼                                ▼                                ▼
        Dashboard Contacts tab            {selection-skill}                {outreach-skill}
        (filter by vertical /             (weekly shortlist —              (drafts per contact;
         company role / status /           suggests, never assigns;         never drafts to
         company / owner)                  writes to {shortlists-dir})      {flag-do-not-contact})
```

- **Dashboard Contacts tab** — renders `{contacts-json}` filterable by vertical, company role, status,
  company, and owner. `{flag-archived}` rows hidden by default; `{flag-do-not-contact}` rows muted. Present
  only when `contact_register.enabled`; otherwise the tab shows its "no data source configured" empty state.
- **`{selection-skill}`** (weekly shortlist) — scores this register into
  `{shortlists-dir}` (`contact_register.shortlists_dir`); suggests-only, never writes back. Model:
  [contact-selection.template.md](contact-selection.template.md).
- **`{outreach-skill}`** — resolves rows here, reads `status` / `{flag-column}` from `{contacts-json}`, pulls the
  Linked project `Overview.md` for context; drafts land in `{drafts-dir}` (`contact_register.drafts_dir`);
  never drafts to `{flag-do-not-contact}` / `{flag-archived}`.

---

## Slot bindings

| Slot | Manifest path | MOT example |
|------|---------------|-------------|
| `{register-path}` | `company_profile.contact_register.path` | `__Sales/Contacts/Contacts.md` |
| `{shared-root}` | `company_profile.storage_profile.shared_root` | *(null — MOT's register is `shared: false`, lives in its own Drive)* |
| `{schema-columns}` | `company_profile.contact_register.schema_columns` | Name · Company · Title · Flag · Last contact · Owner · Email · Phone · Context · Linked project · Notes |
| `{flag-column}` | the `{schema-columns}` flag column | `Flag` |
| `{flag-enum}` | `company_profile.contact_register.flag_enum` | `do-not-contact` · `archived` |
| `{flag-do-not-contact}` / `{flag-archived}` | the two `{flag-enum}` values | `do-not-contact` / `archived` |
| `{status-thresholds}` | `company_profile.contact_register.status_thresholds` | `active_days: 60`, `idle_months: 6` |
| `{active-days}` / `{idle-months}` | `status_thresholds.active_days` / `.idle_months` | 60 / 6 |
| `{contact-status-enum}` | `company_profile.vocab.derived_contact_status` | `active` · `idle` · `dormant` · `uncontacted` |
| `{role-inbox-patterns}` | `company_profile.contact_register.role_inbox_patterns` | `info@` · `sales@` · `support@` · `noreply@` |
| `{sources-dir}` | `company_profile.contact_register.sources_dir` | `__Sales/Contacts/sources/` (lead-source batches) |
| `{shortlists-dir}` | `company_profile.contact_register.shortlists_dir` | `__Sales/Contacts/shortlists/` |
| `{drafts-dir}` | `company_profile.contact_register.drafts_dir` | `__Sales/Contacts/drafts/` |
| `{extract-tool}` | the instance-plugin contacts extractor | `mot-tools.js extractContacts` |
| `{contacts-json}` / `{entities-json}` | the dashboard data files | `contacts.json` / `entities.json` |
| `{selection-skill}` / `{outreach-skill}` | the two skills | `/select-contacts` / `/draft-outreach` |

## Adoption notes

- **Opt-in.** Leave `contact_register.enabled: false` until the register exists; the Contacts tab and the
  contacts extractor both no-op cleanly (empty state, no crash).
- **Single-person vs team.** A solo instance keeps `shared: false` (register in its own Drive). A team sets
  `shared: true` + a real `storage_profile.shared_root`; only then does the merge/contribution loop apply.
- **Fill the slots from the manifest, then wire the two skills.** The rebuild script and the extractor read the
  manifest, so a filled template documents the wired contract — it is not a second source of values.
- MOT's `mot-tools.js extractContacts` + `rebuild_contacts.py` (dry-run default, six invariant gates,
  timestamped backups, atomic write) + `merge_summaries.py` are the validated embryo of this contract.

Extracted from MOT's proven `__Sales/Contacts/README.md` — never speculated ahead of the worked instance
(ARCHITECTURE §10).
