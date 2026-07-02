---
description: The outreach-draft skill skeleton — the generalized form of MOT's draft-outreach. Resolve a contact from the live register, read the extract-computed status + derived company axes from the contacts JSON, ground the hook in the linked project's overview/roll-up (real-hook + claim-backing rules), compose in the sender's voice profile, and write a copy-paste-ready draft with archive-on-supersede rotation. Every company value is a {company-slot} naming its manifest field.
references:
  - path: templates/skills/contact-select.template.md
    type: trigger
    note: The upstream shortlist skill that hands accepted picks here (contact, touch type, hook family, segment block).
  - path: tooling/config.schema.json
    type: standard
    note: Every {company-slot} binds to a field of this manifest schema — company_profile.contact_register (register + drafts_dir), person_profile.voice_profile / outreach_sender, and the vocab.derived_contact_status enum for status_at_draft.
  - path: ARCHITECTURE.md
    type: related
    note: §6 layer 4 (Skills / workflows) — thin procedure over the instance's style + selection Standards; grounds every claim in a project overview rather than inventing it.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Outreach-Draft Skill — template

> **Mechanism only.** Every `{slot}` names a `manifest.json` field (see `skills/README.md` slot table) or
> an instance Standard. The **hooks, the voice, and the claim-backing artifacts** are the instance's —
> deferred to `{outreach-standard}`, the segment→hook map, and the sender's `{voice-profile}`. This
> generalizes MOT's `draft-outreach` — keep the SHAPE, fill the values.

## Preamble

Generate a personalised, **non-salesy** outreach / reconnect email for a contact (or batch), ready to paste
into the mail client. The voice is **peer-to-peer, specific, curious — never a generic sales pitch**. Every
email pairs a *real* capability (grounded in a project overview) with a soft, sender-voiced offer to
connect. Runs only when `{contact-register}.enabled`.

Scope trigger *(instance-named)*: the drafting verbs for this instance — e.g. "outreach draft", "draft
outreach", "prospecting email", "reconnect email for <contact/company>".

## Inputs (any of)

- A **single contact** — by name, email, or company.
- A **batch** — a segment or filter (a vertical, a lead cohort, named contacts inside an existing account).
- If nothing is specified, ask which contact/segment (don't guess a whole-list blast).

## Steps

1. **Resolve the contact(s)** from the register table in `{contact-register}.path` (grep by
   name/company/segment). Pull the register columns (`{contact-register}.schema_columns`). **Status is not
   in the register** — read the extract-computed `status` and the derived `company_role` /
   `company_vertical` from the contact's record in `{contacts-json}` (`contacts.json` ← `{contacts-tool}`;
   run it first if stale).
2. **Hard-skip `{contact-register}.flag_enum` rows** (e.g. do-not-contact / archived) — never draft for
   those; note that you skipped them.
3. **Pick the touch type from the computed `status` + `company_role`** — the mapping lives in
   `{outreach-standard}`; the general shape:
   - `uncontacted` → **first-touch** (reference how they entered the register per the lead-source rule;
     introduce briefly; lead with the hook).
   - `dormant` → **re-engage** ("it's been a while — here's what's new").
   - `idle` → **follow-up** (reference the prior thread + a fresh development + the next step).
   - `active` → **check-in** (a live thread — light "what's new + shall we line up the next step").
   - `company_role: supplier` / `research-partner` (any status) → **relationship touch** (a collaboration
     update or ask, never a pitch).
4. **Choose a REAL hook** matched to the contact's segment via `{outreach-standard}`'s segment→hook map.
   Pull the concrete, current capability from the relevant project `Overview` TL;DR or the latest roll-up —
   **do not invent results** (real-hook policy). If nothing current fits, use an **honest exploratory
   question**, not a fabricated claim.
5. **Compose** subject + body:
   - **Subject:** specific + curiosity-driven; tied to their field or the hook (never a boilerplate
     "Partnership Opportunity").
   - **Body:** short (per `{style-standard}` length rule). Open warm; reference their register-entry action
     (first-touch) or the prior thread (follow-up). One concrete hook framed as a genuine update or a
     question. Personalise from title/company/notes. Close per the **sender's voice profile**.
   - **Sender voice is a mandatory style input.** Resolve the sender's `{voice-profile}`
     (`person_profile.voice_profile`); it governs greeting/sign-off, the call proposal, hedging, numbers
     discipline, and the phrasebook — write the body, then pass every sentence through its filter ("would
     this sender type this sentence?"). The sending person must have `person_profile.outreach_sender: true`.
     Until a per-sender profile exists, fall back to the framework's sender-voice gate in
     `{outreach-standard}`. Do **not** use this skill's own suggested copy as phrasing.
   - Follow `{style-standard}` tone — human, not hype; no "I hope this email finds you well."
6. **Output** each email as a copy-paste block:
   ```
   To: <email>
   Subject: <subject>

   <body>
   ```
   For a batch, one block per contact under a `### <Name> — <Company>` heading. These are **drafts for the
   user to review and paste** — do not send (offer to create mail-client drafts via the mail adapter only
   if the user explicitly asks).
6b. **Archive any existing draft, then save the new one.** Slug = the recipient email with every
   non-alphanumeric char replaced by `_`.
   - **If `{contact-register}.drafts_dir/<slug>.md` already exists, archive it first:** move it to
     `{contact-register}.drafts_dir/_archive/<its `generated` date>_<slug>.md`. **On a same-day supersede
     collision** (an archive file with that exact `<date>_<slug>.md` already exists), append a counter:
     `<date>_<slug>_2.md`, then `_3.md`, … — **never overwrite an existing archive entry.** The extractor
     ignores `_archive/`, so the dashboard shows exactly the current draft while history is preserved.
   - **Then write** `{contact-register}.drafts_dir/<slug>.md`:
   ```yaml
   ---
   description: "Outreach draft — <name> (<company>), <touch_type>"   # graph frontmatter
   references: None
   to: <recipient email>          # REQUIRED — matches the register row
   contact: <name>
   company: <company>
   subject: "<subject>"
   status_at_draft: <contacts.json `status`, verbatim — one of {derived-status-enum}: active | idle | dormant | uncontacted; the extract-computed enum, NOT a scorer label>
   touch_type: first-touch | follow-up | check-in | re-engage | relationship touch
   generated: <today YYYY-MM-DD>       # ALWAYS today — drives staleness + archiving
   related_material:                   # OPTIONAL — 2-4 sender-reference items
     - path: <drive-relative path, forward slashes>   # OPTIONAL per item — MUST exist on disk
       note: "one line: why this grounds the hook (≤110 chars)"
     - note: "Suggestion: run <specific sim> to produce <artifact> for this hook"   # text-only entry
   ---
   <email body>
   ```
   - **Curate 2-4 `related_material` items** from the linked project folder that ground the hook, or a
     text-only `Suggestion:` entry; verify each `path` exists; sender-reference only. This is where the
     **claim-backing rule** is enforced.
   - Run `{extractor-tool}` so the Contacts tab picks up the draft.
7. **After drafting**, remind the user: once an email is actually sent, update that contact's register row
   (`Last contact` → today, add a one-line `Notes` entry — status recomputes at the next extract) — offer
   to make those edits. **Owner assignment stays with the team** — don't auto-assign an owner.

## Guardrails

- **Never fabricate a result or a shipped capability.** Ground every claim in a project overview / roll-up,
  or phrase it as an exploratory question.
- **Lead-source rule (first-touch).** Anchor on the recipient's *own* action + the register-entry source;
  you may name the **venue**, but **never** frame a *person* as having handed over a reader/contact list
  without that person's explicit consent (it spends their credibility and reads as a privacy leak).
- **Claim-backing ("something to present if they take the bait").** Every capability claim must map to a
  presentable artifact listed in `related_material`; if none exists, downgrade to an honest question or
  change the hook. A `Suggestion:` text-only entry marks **preparation debt** — it does not back a claim by
  itself.
- **Respect `{contact-register}.flag_enum` rows** — skip them and surface why.
- **Named contacts inside existing accounts** (rows with a `Linked project`): read that project's Overview
  first so the email reflects the *actual* live relationship; frame warmly ("we're already working together
  on X, and separately thought Y might interest you"), not as a cold intro.
- **One email = one hook.** Don't stuff the whole capability list.

> **Instance-Zero provenance:** generalized from MOT's proven `draft-outreach` (voice profile + real-hook +
> claim-backing + archive-on-supersede), extracted 2026-07-02.
