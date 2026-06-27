---
description: Validation of the focus-detector — detected person-focus (from structure alone) vs the hand-written person_profile in manifest.mot.json. Sandbox slice, read-only on a frozen snapshot.
references: None
status: current
context: framework-architecture
tags: [framework-meta]
---

# Focus-detector validation (sandbox, read-only)

> **Reference instance:** MetaOptics (MOT) is the worked *reference instance* ("Instance Zero") for this
> validation — `manifest.mot.json`, the named accounts (Bosch/STMicro/Elsoft/Disco/4Jet/MMI/AMAT), the
> VP-Systems person, and the detected snapshot are all that instance's, cited as the worked example. The
> detector itself is company-agnostic (a pure function of any instance's graph + manifest).

**What ran:** `focus-detect.mjs` over a *frozen* `graph-index.snapshot.json` (metadata only, no doc bodies) +
`manifest.mot.json` company_profile → `focus_signals.json`; then a read-only interpretation →
`person_profile.detected.json`. **Zero writes outside this folder.**

## Detected vs manual (manifest.mot.json `person_profile.focus`)

| Field | Manual | Detected | Verdict |
|-------|--------|----------|---------|
| **focus_verticals** | Equipment, Foundry | **Equipment, Foundry** | ✅ exact (Equipment = Elsoft 152 files concentrated; Foundry = Disco/4Jet/Ultimems/Samsung/Google breadth) |
| **focus_tiers** | 1, 2 | **1, 2** | ✅ exact (tier 2 = 320 files, tier 1 = 120; tiers 3–4 shallow) |
| **focus_contexts** | bosch, stmicro, elsoft, elsoft-stmicro, dlw | bosch, elsoft, elsoft-stmicro, stmicro | ⚠️ 4/5 — missed `dlw-programme` (no owner file → unmeasurable); surfaced `mot-camera-modules` as a company-central extra (flagged, not promoted) |
| **focus_entities** | Elsoft, Bosch, STMicro, Disco, 4Jet, **MMI, AMAT** | Elsoft, Bosch, STMicro, Disco, 4Jet | ⚠️ 5/7 — missed MMI, AMAT (thin file-depth DLW partners) |
| **focus_document_kinds** | tester analysis, wafer-level test, meeting records, Overviews, sync | testing_analysis (98), meeting records (93), Overviews (98), wafer-level | ✅ strong match |

**Bottom line:** the detector independently reproduces the *core* focus (verticals, tiers, the tester
contexts, the work-kind) from pure structure — **strong validation of the mechanism.** The divergences are
all explainable and point at exactly one improvement.

## The key finding (predicted, now confirmed)

**On a shared *company* drive, work-depth + reference-centrality measure company centrality, not person
attribution.** That's why the detector surfaces `mot-camera-modules` (#1 context by files, in-degree 31),
`__MOT` (202 files), and `ASTAR` (in-degree 20) — all genuinely big, none in the VP-Systems manual focus.
Separating "what the company invests in" from "what *this person* works on" needs a **person-attribution
signal** (authorship / who-edited / email + meeting participation). On a *per-person* federated Drive (the
real deployment) this is moot — the whole Drive *is* the person — but the signal is still worth fusing in.

## Two concrete data gaps it exposed
1. **`dlw-programme` context has `owner: null`** — no owner file, so it's structurally invisible (and it's a
   drift signal in its own right: a registered context should have an owner). The manual profile knew about
   DLW; structure couldn't see it.
2. **File-depth misses thin-but-important relationships** — MMI/AMAT (DLW partners) carry few files yet
   matter. A reference/relationship signal catches them; file-depth alone does not.

## Improvements for the framework focus-detector
- **Fuse multiple signals**, don't rank on file-depth alone: work-depth + reference-centrality +
  document-kind + **person-attribution**. Use centrality to *discount* company hubs, not inflate them.
- **Add a person-attribution channel** (authorship/edit-recency/email-meeting participation) for shared
  drives; skip it for per-person instances.
- **Require context-registry owner files** (the dlw gap) — fold into the drift auditor.

## v2 / v3 hardening — the real lesson (negative results kept on purpose)

We then tried to "harden" v1 by hard-excluding hubs. Both attempts made the *core* worse:

- **v2 (referrer-diversity hard-exclude):** fixed the camera-modules leak but **dropped Bosch** — a tier-1
  focus that is merely *widely referenced*, not a company hub. The seed got polluted by `__MOT` structural
  hubs, so propagation amplified AI/research (Princeton, Meta AI, I2R) instead of testers.
- **v3 (node_kind structural exclude):** cleanly removed `__MOT`/`vertical-index` hubs — but `node_kind:
  product-parent` **also tags Elsoft** (the #1 focus) and the Elsoft testers, so it **dropped Elsoft and
  collapsed the Equipment vertical** (463 → 84). The seed even pulled in `MDesign` (archived, tier 4).

**Conclusion: no single structural heuristic separates person-focus from company structure on a shared
drive.** Each hard-exclude has a failure mode — file-depth → hubs leak; referrer-diversity → drops marquee
accounts; node_kind → drops `product-parent` focuses. `product-parent` is *both* a structural hub *and* a
primary focus (Elsoft); a high reference count is *both* noise (camera-modules) *and* signal (Bosch).

## The hardened design (what graduates to the framework)
1. **Per-person federated drive = the real deployment.** There the whole drive *is* the person, so simple
   v1-style distribution is accurate and the shared-drive ambiguity does not exist. This is the primary mode.
2. **Shared drive needs a person-attribution channel** (authorship / edit-recency / meeting + email
   participation) — the *only* thing that distinguishes ASTAR-the-company-engagement from Tobias-the-tester.
3. **Structural signals are SOFT ensemble features, never single-signal vetoes.** node_kind, referrer-
   diversity, work-depth and reference-propagation each contribute a weighted vote; none excludes alone.
4. **v1 (distribution) is the canonical base**; `v2`/`v3` are retained here as the instructive negative
   results that justify (3).

## Net
The focus-detector is **validated for its real (federated) deployment** — structure alone recovers the
dominant focus with high agreement. The hardening experiment proved the harder shared-drive case needs
person-attribution and an ensemble (no hard vetoes), and that over-aggressive single heuristics backfire.
Nothing in the Drive was modified — entire exercise confined to this sandbox folder.
