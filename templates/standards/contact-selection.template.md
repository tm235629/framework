---
description: Generalized contact-selection contract — the weekly outreach-shortlist model (register mapping → hard filters F1-Fn → filter/score → constraint & diversity rules → emit), the suggests-never-assigns invariant, and the output contract (dated shortlist file + archive rotation + staleness flag). Mechanism only; the scoring weights, verticals, events, and thresholds are {company-slot}s the instance fills.
references:
  - path: tooling/config.schema.json
    type: standard
    note: Slots resolve from company_profile.contact_register.{shortlists_dir,senders}, cadence.outreach.{shortlist_period,staleness_flag_days}, vocab.{verticals,tier_scale,derived_contact_status}.
  - path: templates/standards/contact-register-contract.template.md
    type: related
    note: The register + derived company/status axes this scorer reads; §2's register mapping consumes that three-axis model.
  - path: templates/standards/outreach-framework.template.md
    type: related
    note: The drafting-side framework each accepted pick hands off to; the cadence/staleness windows are owned there and read here.
status: current
context: framework-architecture
tags: [framework-meta]
---

# Contact-selection contract — the weekly outreach shortlist

The deterministic, explainable model that replaces "somewhat random" weekly picks:
**filter → score → constrain → emit** `{shortlist-size}` **suggested contacts per sender per period**, each
carrying the reason it was picked. The **system suggests; the team assigns** — who contacts whom stays with a
human. This template carries the *structure* only; every weight, vertical, event source, and threshold is a
`{company-slot}` the instance fills.

> **The invariant that shapes the whole output: suggests-never-assigns.** The emitted list is pooled, ranked,
> and **unassigned** — no Owner column, no per-sender pre-split. A human distributes the picks. Any design that
> writes an owner or writes back to the register violates this contract.

---

## 1. Register mapping (the scorer's inputs)

The register stores only the person axis; status and company axes are derived at extract (see
[contact-register-contract.template.md](contact-register-contract.template.md)). Where this model names a
status/role/vertical, read it off the derived layer, not a stored column:

| Model term | Read from |
|------------|-----------|
| `{flag-do-not-contact}` / archived | the register `{flag-column}` |
| role / vertical | the derived `company_role` / `company_vertical` in `{contacts-json}` (null ⇒ fall back to `Title` / `Context` heuristics) |
| engagement status | the effective status computed in §3 (never stored); the extractor's `{contact-status-enum}` is the coarser dashboard view |
| tier / phase | the linked project's `tier` / `phase` from `{projects-json}` via `Linked project` |
| triggers / events | the `{events-source}` rows (booked events, recent meetings, milestones) |

## 2. Hard filters (gate 0 — before any scoring)

Filters run first and log every skip, so the team can audit the model. Instances define the concrete rule per
slot; the *shape* is fixed:

| # | Filter (mechanism) | Slot the instance fills |
|---|--------------------|-------------------------|
| **F1** | **do-not-contact** — `{flag-column} ∈ {flag-block-set}` → hard skip, log it | `{flag-block-set}` |
| **F2** | **operational suppliers** — a `supplier` role on a project past the prospecting phase is an ops thread, not outreach → out of scope (define the exception phases) | supplier-scope rule |
| **F3** | **engaged customers** — a customer whose project is past the PO gate is serviced through the deal thread, not prospected | phase gate = `{engaged-phase}` |
| **F4** | **live-thread guard** — an `active` two-way thread within `{live-thread-days}` → suppress (event-override lifts it) | `{live-thread-days}`, event-override window |
| **F5** | **live-decision guard** — a dated commercial milestone within `±{decision-window-days}` → the deal thread owns the period | `{decision-window-days}` |
| **F6** | **no email on file** → route to a "needs data" list, not the shortlist | — |
| **Fn** | *(instance-added filters, e.g. service vendors, culture warm-anchor gate)* | as needed |

## 3. Scoring skeleton

Score is a small composite over named factors; the **weights are `{company-slot}`s** (`{score-weights}`) —
hypotheses until a few cycles of evidence tune them. Keep the driver list (which factors fired) per row so the
rationale is explainable.

```
Score = A × B + C + D + E          # example composition; instance may reshape
```

| Factor | What it measures | Weight slots | Source |
|--------|------------------|--------------|--------|
| **A — sequence-state urgency** | base points per effective status (follow-up-due beats new cold) | `{weight-A}` per `{contact-status-enum}` value | computed status + `Last contact` |
| **B — staleness-window multiplier** | too-early ×low / in-window ×1.0 / decayed ×mid, per status | `{weight-B}` window bounds | `Last contact` vs run date; windows owned by the outreach framework |
| **C — strategic weight** | linked-project tier + phase modifier + PO-proximity | `{weight-C}` per `{tier-scale}` / `{phase-enum}` | `{projects-json}` |
| **D — trigger boosts** (capped) | booked event ≤ window · recent meeting · fresh inbound signal · milestone · trend hook | `{weight-D}` per trigger, `{trigger-cap}` | `{events-source}`, `Context`, latest sync |
| **E — path quality** | proven-yield cell bonus + anti-pattern penalties + culture-channel rule | `{weight-E}` cells & penalties | derived role/vertical + `Title` / `Context` |

- **Status computed first** (never stored): map `Last contact` + correspondence evidence onto the effective
  status the scorer uses; a sent-awaiting-reply trace re-surfaces when the framework's follow-up floor is
  reached.
- **Tie-breaks**, in order (instance may adjust): PO-proximity → higher tier → technical persona over
  BD/procurement persona → older last-contact.

## 4. Constraint & diversity rules (after scoring, before emit)

Run in rank order so a high score can't produce a bad batch:

1. **Per-company cap** — `{company-cap}` picks per company per period (2 only for genuinely separate
   workstreams); normalise company-name variants first.
2. **Per-thread cap** — never two picks from the same project thread.
3. **Vertical spread** — ≤ `{vertical-spread-max}` of any sender's picks from one `{verticals}` lane.
4. **Cold rate-limit** — ≤ `{cold-cap}` pure-cold first-touches per sender per period; the rest are
   follow-ups / re-warms.
5. **Contact cooldown** — a picked-and-mailed contact is ineligible for a *new* pick until its follow-up window
   opens (it re-enters via the sent-awaiting-reply state).
6. **Pool sizing** — emit `senders × {shortlist-size}` as one pooled, ranked, **unassigned** list.

## 5. Output contract

```markdown
## Weekly outreach shortlist — <YYYY-MM-DD> (pooled, unassigned — team distributes)

| # | Contact | Company | Score | Why now (drivers) | Touch | Hook family | Channel | Culture |
|---|---------|---------|------:|-------------------|-------|-------------|---------|---------|
| 1 | <name> | <company> | 51 | <drivers in words> | follow-up | <hook family> | <channel> | <region> |

Suppressed: <name — rule>, … · Skipped (do-not-contact): <name>, …
Data gaps this run: <notes>
```

- **Rationale is mandatory** — the "Why now" column is the same factor drivers in words; no black-box picks.
- **`Touch`** ∈ the outreach framework's touch-type vocabulary; **`Hook family`** names a hook *family* only
  (the claim itself is verified at draft time — real-hook policy). **`Culture`** = the region overlay to apply
  at draft time.
- **File + archive rotation** — the shortlist is written to `{shortlists-dir}` (`contact_register.shortlists_dir`)
  as `<YYYYMMDD>.md` with frontmatter (`description`, `references` to the register (input) + this standard, a
  `generated:` date); the previous shortlist moves to a sibling `_archive/`. **No writes to the register.**
- **Staleness flag** — a shortlist older than `{staleness-flag-days}` (`cadence.outreach.staleness_flag_days`)
  is flagged (e.g. by the sync as an attention line), so a stale batch is never sent as fresh. Regeneration
  cadence is `{shortlist-period}` (`cadence.outreach.shortlist_period`).
- **Handoff** — each accepted pick hands off to `{outreach-skill}` with contact + touch type + hook family +
  culture block; the drafting skill verifies the hook against the Overview/sync and applies the culture
  overlay. Suggests-only: no owner is ever written.

---

## Slot bindings

| Slot | Manifest path (or instance content) | MOT example |
|------|--------------------------------------|-------------|
| `{shortlist-size}` | instance content (per-sender budget) | 3-5 |
| `{shortlist-period}` | `company_profile.cadence.outreach.shortlist_period` | `weekly` |
| `{staleness-flag-days}` | `company_profile.cadence.outreach.staleness_flag_days` | 7 |
| `{shortlists-dir}` | `company_profile.contact_register.shortlists_dir` | `__Sales/Contacts/shortlists/` |
| `{senders}` | `company_profile.contact_register.senders` | the MOT outreach senders (entity_registry) |
| `{flag-column}` / `{flag-block-set}` / `{flag-do-not-contact}` | register flag column + block set | `Flag`; block = `do-not-contact` + `archived` |
| `{contact-status-enum}` | `company_profile.vocab.derived_contact_status` | `active` · `idle` · `dormant` · `uncontacted` |
| `{tier-scale}` / `{phase-enum}` / `{engaged-phase}` | `company_profile.vocab.tier_scale` / `phase_enum` | tiers 1-4; phases incl. `engaged` (= customer PO) |
| `{verticals}` / `{vertical-spread-max}` | `company_profile.vocab.verticals`; instance content | Equipment · Foundry · Products · AI; ≤ 50% |
| `{score-weights}` = `{weight-A..E}`, `{trigger-cap}` | **instance content** (the model's weights) | A: contacted 40 / warm 26 / …; D cap +20; etc. |
| `{live-thread-days}` / `{decision-window-days}` / `{company-cap}` / `{cold-cap}` | instance content (filter/constraint thresholds) | 14 d / ±7 d / 1 per company / ≤2 cold |
| `{events-source}` | the events/milestones data the instance supplies | `__Operations/Documentation/Events.md` |
| `{projects-json}` / `{contacts-json}` | dashboard data files | `projects.json` / `contacts.json` |
| `{outreach-skill}` | the drafting skill | `/draft-outreach` |

## Adoption notes

- **Structure is fixed; weights are the instance's hypotheses.** Fill `{score-weights}` and the thresholds,
  run it, then tune from reply/ignore metrics after a few cycles — this doc stays the single source of the
  model (a later dashboard port reads the emitted file, never re-implements the logic).
- **Present only when `contact_register.enabled`.** With no register there is nothing to score.
- **Guardrails restated:** do-not-contact is a hard skip; no Owner assignment ever; hook *families* only
  (claims verified at draft time); a project past the PO gate is never prospected as a fresh lead.

Extracted from MOT's proven `Contact_Selection_Strategy.md` (structure of §§2-5) — never speculated ahead of
the worked instance (ARCHITECTURE §10). MOT's `/select-contacts` skill is the reference implementation.
