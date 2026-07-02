---
description: Generalized outreach-framework contract — the anti-advertisement pre-send gate skeleton (required-elements + ad-tell lint + sender-voice test), the touch-type ladder concept, the real-hook + claim-backing rules, the venue-not-person lead-source disclosure rule, and the persona/culture/voice research inputs (voice profile bound to person_profile.voice_profile). Mechanism only; hooks, personas, culture overlays, and the sender voice profiles are instance content.
references:
  - path: tooling/config.schema.json
    type: standard
    note: Slots resolve from person_profile.{voice_profile,outreach_sender}, company_profile.contact_register.{drafts_dir,senders}, cadence.outreach, vocab.verticals.
  - path: templates/standards/contact-selection.template.md
    type: related
    note: The selection scorer that feeds this framework; each accepted pick hands off here with touch type + hook family + culture block.
  - path: templates/standards/contact-register-contract.template.md
    type: related
    note: The register this framework reads (do-not-contact hard skips) and writes back to (per-send Last-contact + Notes bookkeeping only).
status: current
context: framework-architecture
tags: [framework-meta]
---

# Outreach-framework contract — deliberate outbound, never advertisement

The operating manual for the periodic outbound touches per person: every touch persona-matched, culture-tuned,
hook-grounded — and never junkable as an advertisement by someone like the recipient. This template carries the
**gates, the ladder, and the disclosure rules** (the mechanism); the hooks, personas, culture overlays, and the
per-sender voice profiles are **instance content** the instance supplies. The register's
`{flag-do-not-contact}` rows are a hard skip everywhere below.

> Who sends to whom is decided by a human. This framework and the companion selection contract **suggest**
> targets and owners; they never assign. Honesty rule: a relationship past the PO gate is the only "customer
> with an order" — pre-PO relationships are "design/evaluation" and no mail may imply a volume win.

---

## 1. The anti-advertisement pre-send gate

A draft ships only if it passes all three parts. **Any failure = rewrite, not send.**

### Gate A — required elements

Every send must carry:

1. **One verifiable recipient-specific fact** — their product, paper, booth, order, download, prior thread.
2. **One concrete artifact on the page** — a spec, whitepaper, or shipped reference, **verified in the drive**
   (real-hook policy: the claim is *true*).
3. **One named, dated, low-friction, preferably non-monetary ask.**

**Claim-backing rule** (extends the real-hook policy from *the claim is true* to *we can show it*): every
capability claim maps to a presentable artifact (deck, datasheet, whitepaper, sample, sim result) that can be
put in front of the recipient if they take the bait. No artifact ⇒ downgrade the claim to an honest
exploratory question or change the hook.

**Lead-source disclosure (venue-not-person).** When the recipient-specific fact came from a broker-supplied
reader list (a whitepaper download, an event list), frame it as the recipient's **own action + the venue**
("you downloaded our <title> from <venue>") — **never** name the individual broker who supplied the list.
Naming the person spends that source's credibility with their own audience, risks the channel, and (for
privacy-regulated recipients) reads as a proactive data-source leak. A named-person warm intro is legitimate
**only** with that person's explicit consent — until then, venue-not-person.

### Gate B — the ad-tell lint

If the draft matches **any** ad-tell, it reads as advertisement to a technical recipient — rewrite. The
instance supplies its own lint rows; the recurring families: template opener / greeting filler · market-size
stat as relevance substitute · catalogue blast (more than one capability, substance behind links) · fake
personalisation · wrong-guess research · manufactured urgency (scarcity/countdown/gift) · belief-nudge
follow-up with no new fact · list-blast chrome (view-online / unsubscribe / CLICK HERE / attachment stack) ·
register mismatch (emoji, hype words) · un-owned automation (typos in names, duplicate sends, rep swap
mid-thread).

### Gate C — the sender-voice test

Read the draft once: **"Would THE SENDER type this sentence?"** — the specific named person whose account it
goes out under, who must stand behind every sentence on a follow-up call. Where a **`{voice-profile}`** exists
for the sender (`person_profile.voice_profile`), that profile is the answer key (greeting/sign-off ladder,
call-proposal phrasing, hedging + numbers discipline, phrasebook); until one exists, apply the generic
peer-shape check. **Peer-shape sub-check:** if the mail needs a standalone sentence to explain who the company
is, it is not yet peer-shaped — fuse the intro into the hook, or get warm first.

## 2. The touch-type ladder

The touch type is chosen from the contact's status + last-contact; each type has a fixed goal, a structure
skeleton, an ask size, and a cadence to the next touch. Five status-driven types map 1:1 onto the drafting
skill; a sixth (event-follow-up) is triggered by a meeting, not a status.

| Type | Trigger | Goal | Ask size | Cadence to next |
|------|---------|------|----------|-----------------|
| **First-touch** | new / cold | earn one reply | one question or a short call | follow-up at `{followup-floor}` |
| **Follow-up** | sent, no reply | add a **new fact**, re-open | smaller than before | max 2, then park ≥ a quarter |
| **Check-in** | live thread | keep momentum to next milestone | next step in the live workstream | milestone-driven |
| **Re-engage** | dormant | re-open with what changed | low — a short call or updated artifact | once per trigger, never on a timer |
| **Relationship touch** | partner / supplier / academic | bank goodwill, **zero ask** | none (that is the point) | ~quarterly, or when genuinely useful |
| **Event-follow-up** | met at an event | convert the conversation | the thing agreed at the booth | **within 24 h** — highest-ROI, protect the window |

**Cadence rule (owned here — the selection contract reads it):** benchmark cadence sets the *ceiling*, the
**new-fact rule** sets the *permission* — **no new fact, no send**, even if the calendar says it is day N. The
follow-up floor is `{followup-floor}`; the staleness window opens on that floor.

## 3. Real-hook & claim-backing (the honesty spine)

- **Real-hook policy** — one hook per mail, verified in the drive before sending; never fabricate a result.
- **Claim-backing** — every claim maps to a showable artifact (Gate A.2); no artifact ⇒ soften the claim.
- **Pre-PO honesty** — say "design/evaluation orders", never imply volume wins; blunt capability limits are
  welcomed by technical readers.
- **Do-not-contact** — `{flag-do-not-contact}` rows are hard-skipped before any drafting.
- **Bookkeeping is the only write-back** — after a send, update the register's `Last contact` + a one-line
  `Notes` send entry (status recomputes at extract; never hand-write a status). Drafts land in `{drafts-dir}`.

## 4. Instance-content inputs (persona / culture / voice research)

The framework is the mechanism; these are the **instance-supplied content layers** it reads at draft time.
They live in the instance's research/ area, not in this template:

| Input | What it supplies | Bound to |
|-------|------------------|----------|
| **Hook library** | the verifiable hooks + trend-timing wrappers, one hook per mail | instance content (governed by the real-hook policy) |
| **Persona playbooks** | one play per persona card (per `{verticals}` lane + cross-vertical), with the "kill" condition | instance content, keyed to `company_role` / `Title` |
| **Culture overlays** | per-region deltas (salutation, directness, warm-anchor gates) that modify the play; some regions gate cold sends entirely | instance content |
| **Sender voice profiles** | the per-sender answer key for Gate C — one profile per outreach sender | **`person_profile.voice_profile`** (per person; `person_profile.outreach_sender` marks who sends) |

---

## Slot bindings

| Slot | Manifest path (or instance content) | MOT example |
|------|--------------------------------------|-------------|
| `{voice-profile}` | `person_profile.voice_profile` | `research/Tobias_Voice_Profile.md` |
| `{outreach-sender}` | `person_profile.outreach_sender` | `true` for the sending teammates |
| `{flag-do-not-contact}` | the register block flag | `do-not-contact` |
| `{drafts-dir}` | `company_profile.contact_register.drafts_dir` | `__Sales/Contacts/drafts/` |
| `{followup-floor}` | instance content (cadence floor; cross-checked against `cadence.outreach`) | +7-10 business days |
| `{verticals}` | `company_profile.vocab.verticals` | Equipment · Foundry · Products · AI |
| hook library / personas / culture overlays | **instance content** (research/ area) | MOT `research/{Brand_Analysis,Personas,Culture_Communication_Notes}.md` |

## Adoption notes

- **Gates + ladder are the fixed mechanism; hooks/personas/culture/voice are instance content.** Do not bake
  MOT hooks or personas into the template body — they belong in the instance's research/ area.
- **One voice profile per sender.** Bind each to `person_profile.voice_profile`; mark senders with
  `person_profile.outreach_sender`. Until a sender's profile exists, Gate C falls back to the generic
  peer-shape check.
- **The cadence floor is owned here** and *read* by the selection contract's staleness windows — change it in
  one place (this framework) and the selector follows.
- **Present only when `contact_register.enabled`** and at least one `outreach_sender` exists.

Extracted from MOT's proven `Engagement_Framework.md` (§§2-4, 7 mechanism) — never speculated ahead of the
worked instance (ARCHITECTURE §10). MOT's `/draft-outreach` skill is the reference implementation.
