---
description: The contact-select orchestrator skeleton — the generalized form of MOT's select-contacts. Load the live shared contact register + derived contacts JSON + projects JSON + events → sweep events first → filter → score → constrain per the instance's contact-selection Standard (the model is deferred to that Standard, never defined here) → emit a pooled, unassigned per-sender shortlist with _archive rotation. Bookkeeping is last-contact + notes only; status recomputes at extract. Every company value is a {company-slot} naming its manifest field.
references:
  - path: templates/skills/outreach-draft.template.md
    type: trigger
    note: The downstream drafting skill each accepted pick hands off to (Step 6); it verifies the hook claim and applies the sender voice.
  - path: tooling/config.schema.json
    type: standard
    note: Every {company-slot} below binds to a field of this manifest schema — company_profile.contact_register (register path, senders, dirs, flag_enum, status_thresholds), cadence.outreach, and the vocab.derived_contact_status enum.
  - path: ARCHITECTURE.md
    type: related
    note: §6 layer 4 (Skills / workflows) — thin procedure over a Standard, ending by handing accepted picks downstream; the register is the "live shared company register" resource class.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Contact-Select Orchestrator — template

> **Mechanism only.** Every `{slot}` names a `manifest.json` field (see `skills/README.md` slot table) or
> an instance Standard. **The selection model is NOT defined here** — filters, scoring weights, diversity
> constraints, and the output format all live in `{selection-standard}`, read fresh every run so tuning is
> picked up automatically. This generalizes MOT's `select-contacts` — keep the SHAPE, fill the values.

## Preamble

Produce this period's **N suggested outreach contacts per sender** from the live contact register —
deterministic, explainable, **pooled and unassigned** (the team distributes; the skill never assigns an
owner). This runs only when `{contact-register}.enabled` (manifest `company_profile.contact_register`); a
single-person instance with `shared: false` still runs it against its own drive copy.

Scope trigger *(instance-named)*: the shortlist verbs for this instance — e.g. "contact select", "weekly
shortlist", "who should we contact", "select contacts for outreach".

**The model is deferred, exactly like MOT's skill.** Read `{selection-standard}` fully at the start of
every run — the filters, the scoring formula, status normalisation, the diversity constraints, and the
output format are the single source of truth there. Apply the weights **as written** (they are tuned after
evidence reviews; this skill must pick up changes without a body edit).

## Cadence

Runs on `{cadence.outreach.shortlist_period}` (manifest `cadence.outreach.shortlist_period`, default
`weekly`). The staleness flag on an unactioned shortlist is `{cadence.outreach.staleness_flag_days}`.

## Parameters (any of, all optional)

- **senders** — how many people will send this period (default from the register / `{cadence.outreach}`);
  the pool size is `senders × picks-per-sender` per `{selection-standard}`.
- **run date** (default today).
- A **vertical/segment filter** (e.g. one product lane, or a named lead cohort).

## Steps

1. **Load inputs.** All from the manifest / derived layer:
   - The register table in `{contact-register}.path` (resolved against `{shared-root}` when
     `{contact-register}.shared`, else the instance root). It carries `{contact-register}.schema_columns`;
     **status is never a column** — `{contact-register}.flag_enum` values (e.g. do-not-contact / archived)
     live in the `Flag` column, and status is computed at extract (§ derived-status below).
   - `{contacts-json}` (`contacts.json` ← `{contacts-tool}` = `kb-contacts`) — the extract-derived
     per-contact `status` + derived company axes (`company_role` / `company_vertical` / `company_phase` /
     `company_tier`). Run `{contacts-tool}` first if it is stale.
   - `{projects-json}` (`projects.json` ← `{extractor-tool}`), the events source (`{events-file}`), and the
     latest period roll-up in `{period-folder}`.
   - `{selection-standard}` (the model).
2. **Events sweep FIRST.** Scan `{events-file}` for booked visits/meetings within the near-horizon window
   and meetings in the recent-past window defined by `{selection-standard}`. These produce **event-driven
   picks that enter ABOVE the scored table** (event-logistics / event-follow-up touches — triggered by a
   date, not a staleness score). **Never trust the ranked list without this sweep** (the failure mode
   `{selection-standard}` records).
3. **Run the algorithm** exactly as `{selection-standard}` specifies: normalise (days-since-last-contact,
   company-name variants, effective status) → filter (log every `{contact-register}.flag_enum` skip and
   every needs-data row) → score the surviving rows keeping the driver list → apply the constraints in rank
   order → rank.
4. **Emit in chat** using the Standard's output format: event-driven picks first, then the pooled ranked
   table (`senders × picks` rows), then Suppressed (with the suppressing rule — the audit trail), Skipped
   (flag-enum), needs-data / needs-intro lists, and data-gap notes.
5. **Write the shortlist file** `{contact-register}.shortlists_dir/<YYYYMMDD>.md`:
   - If a previous shortlist exists there, **move it to `{contact-register}.shortlists_dir/_archive/` first**
     (mirrors the drafts rotation).
   - Frontmatter: `description` (one line — date + pick count + "unassigned"); `references:` the register
     (`type: input`) + `{selection-standard}` (`type: standard`); `generated: <date>`.
   - Body = the same block emitted in chat.
   - **No writes to the register.** Bookkeeping (`Last contact` + one-line `Notes` send entry — status
     recomputes at extract) happens at send time via `outreach-draft`, by the sender — never here.
6. **Hand off.** Offer to run `outreach-draft` for accepted picks, passing per pick: contact, touch type,
   hook family, culture/segment block. The drafting skill verifies the actual hook claim against the
   Overview/roll-up (real-hook policy) and applies the sender-voice overlay.
7. **Measurement note.** Remind the team to record replied / ignored per pick (the Standard's measurement
   loop); after the Standard's review cadence the weights get their first evidence review.

## Derived status (never stored)

`status` is one of `{derived-status-enum}` (`vocab.derived_contact_status`:
`active | idle | dormant | uncontacted`), **DERIVED AT EXTRACT, NEVER STORED** in the register: `active`
≤ `{contact-register}.status_thresholds.active_days` since last contact; `idle` ≤
`{contact-register}.status_thresholds.idle_months`; `dormant` beyond; `uncontacted` = no last-contact date.
Read it from `{contacts-json}`, never from a register column.

## Guardrails

- **Flag-enum rows are hard-skipped, always logged, never drafted for** (`{contact-register}.flag_enum` —
  e.g. do-not-contact / archived).
- **No Owner assignment, no per-sender pre-split.** The output is pooled and unassigned; the team
  distributes.
- **Hook families only** in the shortlist — never a concrete claim; claims are verified at draft time by
  `outreach-draft`.
- **Phase accuracy:** never describe a pre-PO account as an `engaged`/PO customer (`engaged` ⟺ customer PO,
  per `{lifecycle-standard}`).
- **Cold-with-no-warm-anchor** picks (per the Standard's channel rule) route to the needs-intro list, not
  the email pool.
- Re-running mid-period is safe: the model is **stateless** over the current register + calendar.

> **Instance-Zero provenance:** generalized from MOT's proven `select-contacts` (register + strategy doc +
> weekly shortlist), extracted 2026-07-02.
