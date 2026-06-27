---
description: Operator runbook for standing up a SAME-COMPANY teammate instance (the federated path) — a CONFIGURATION of the shared company-invariants, not a new instance. Concrete checklist — seed company_profile verbatim, focus-detect the person_profile, plug the input adapter, point the root override, register confusable workstreams, run kb-index/kb-audit. Worked example — the CFO (different focus from VP-Systems).
references:
  - path: bootstrap/SETUP_SEQUENCE.md
    type: builds-on
    note: This is the TEAMMATE branch of the top-level bifurcation — Phases 1-4 collapse to near-no-ops because the company_profile is seeded, not re-derived.
  - path: tooling/manifest.example.json
    type: source
    note: The shipped synthetic manifest — the company_profile shape this runbook copies verbatim as the shared seed, and the person_profile shape the focus-detector fills (the reference instance's filled manifest is not shipped).
  - path: tooling/config.schema.json
    type: standard
    note: The manifest schema every step validates against; the company_profile/person_profile split is the structural basis of the whole runbook.
  - path: slices/focus-detector/VALIDATION.md
    type: related
    note: What the v1 focus-detector recovers from structure alone, and the shared-drive caveat (Step 2 cites its findings + limits).
  - path: templates/registries/README.md
    type: related
    note: The register-before-use rule and extra_entities-extends-never-overwrites contract that Steps 2 and 5 enforce.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Teammate runbook — the federated path (CONFIGURE, don't re-derive)

Standing up a **same-company teammate** is the framework's first real target and its easiest one: it is a
**configuration of the shared company-invariants, not a new instance.** You do **not** re-run the design
phases. You copy the settled `company_profile` verbatim, detect *this person's* focus, plug whatever source
is unique to them, and point the tools at their Drive.

> **No central source of truth.** Each teammate runs **their own** focus-adapted instance against **their
> own** Drive. Confidential data (the CFO's banks, lender term sheets, audit findings, payroll) stays local
> to the instance that owns it. There is no aggregator, no shared live store — only a shared *seed* (the
> `company_profile`) plus the common *mechanisms* (the `kb-*` tools, the templates). Aggregation, if ever,
> is a deliberate later read-only federation view over selected shareable slices — never an automatic merge.

**Where this sits in the pipeline.** This is the **TEAMMATE** branch of SETUP_SEQUENCE's top-level
bifurcation. Because the `company_profile` is *seeded* rather than re-derived, **Phases 1-4 collapse to
near-no-ops:** Phase 1 (taxonomy/registry design) is a verbatim copy; Phase 2 (data-model) is inherited;
Phase 3 (tooling) is already-built `kb-*` tools just re-pointed; Phase 4 (migration) usually doesn't run at
all — a per-person Drive that is already organized needs no restructure. The only genuinely new work is
**Phase 1's focus-detection sub-step** (`person_profile.focus`) and **Phase 6's input adapter**.

The worked example throughout is a generic **CFO at "Acme Optics"** — deliberately the teammate whose focus
diverges *most* from a VP-Systems seed, so every "the seed lacks X" case is concrete. (The framework's own
reference instance, **MetaOptics — "Instance Zero"**, is the VP-Systems instance the seed was extracted from;
"Acme Optics" stands in for *your* company so the JSON below is safe to copy without pasting a real person or
domain. Re-derive every angle-bracket placeholder for your own instance.)

---

## The 6 steps at a glance

| # | Step | Phase it maps to | New work? |
|---|------|------------------|-----------|
| 1 | **SEED** — copy `company_profile` verbatim from the shared manifest | Phases 1-3 | No (copy) |
| 2 | **DETECT FOCUS** — run focus-detector → `person_profile.focus`; add `extra_entities` | Phase 1 sub-step | **Yes** |
| 3 | **INPUT ADAPTER** — plug any mailbox/source unique to them | Phase 6 | **Yes (if new source)** |
| 4 | **ROOT OVERRIDE** — point the env-var/root at their Drive | Phase 3 | No (one value) |
| 5 | **REGISTER WORKSTREAMS** — confirm their contexts are in the shared registry | Phase 1 | Only if a new fork |
| 6 | **VERIFY** — run `kb-index` + `kb-audit` on their instance | Phase 3 + 9 | No (run) |

---

## Step 1 — SEED: copy the company_profile verbatim

The entire `company_profile` block of `manifest.mot.json` is the **shared seed**. Copy it **byte-for-byte**
into the teammate's `manifest.json`. Do **not** re-derive, re-infer, or "improve" any of it — these are
company-invariants, identical for every teammate:

- `taxonomy` (project_tiers, category_rules, subfolder_convention, non_card_subfolders)
- `vocab` (tier_scale, phase_enum, **verticals**, **edge_types** — the valid/legacy/provenance vocabulary,
  node_kinds, status_enum, supply_chain_roles)
- `frontmatter_schema` (required/optional fields, tldr_keys, avoid_read_marker)
- `context_registry` (the confusable-workstream guardrail)
- `entity_registry.people` (the company-staff seed)
- `excludes`, `catalog_profile`, `raw_archive_roots`, `scan_roots`
- `brand`, `cadence`, `storage_profile`, `input_adapters`

```bash
# the only "Phase 1-3" work for a teammate: lift the shared seed.
# (jq shown for clarity; copy/paste is equally valid — it is verbatim.)
jq '{manifest_version, company_profile}' \
  "tooling/manifest.mot.json" > "<teammate-drive>/manifest.json"
```

Then append a fresh `person_profile` shell (filled in Steps 2-4). The result must validate against
`config.schema.json` (`required: ["manifest_version","company_profile","person_profile"]`).

**What is NOT copied:** the whole `person_profile` block — `person`, `root_override`, `focus`,
`cadence_override`. That is the only company-slot a teammate owns locally.

**CFO note:** the company seed already contains the CFO in `entity_registry.people`
(`role: "CFO, finance, compliance"`) — that row is *who they are to the company*, and it is shared. It does
**not** yet contain their banks or auditors; those arrive as `extra_entities` in Step 2.

---

## Step 2 — DETECT FOCUS: fill person_profile.focus, then extend entities

This is the one piece of genuine **C (reasoning)** work. Run the **focus-detector** (`focus-detect.mjs`,
the **v1 distribution** variant) over the teammate's own `graph-index` (Step 6 produces it; for a first run
use a frozen metadata-only snapshot exactly as the sandbox did) + the seeded `company_profile`. It fills
`person_profile.focus`:

- `focus_verticals` — the subset of `vocab.verticals` this person concentrates on
- `focus_tiers` — the tier numbers they actively work
- `focus_contexts` — the subset of `context_registry` tags central to them
- `focus_entities` — the Overview paths (accounts/partners) that dominate their Drive
- `focus_document_kinds` — the document genres they produce/consume most

**What v1 actually delivers (and its one caveat) — see
[`slices/focus-detector/VALIDATION.md`](../slices/focus-detector/VALIDATION.md):** on a **per-person
federated Drive — which is exactly this deployment — v1 distribution is the canonical, validated base.**
There "the whole Drive *is* the person," so simple work-depth + reference-centrality distribution recovers
the dominant focus with high agreement (on Instance Zero it reproduced verticals, tiers, the tester
contexts and the work-kind exactly). The **caveat is the *shared*-drive case only**: on a drive shared
across people, depth/centrality measure *company* centrality, not *person* attribution (it surfaced
`mot-camera-modules`, `__MOT`, `ASTAR` — big, but not the VP's focus), which needs a person-attribution
channel (authorship / edit-recency / email+meeting participation). **For a teammate's own Drive you are in
the validated regime; do not apply the v2/v3 hard-exclude heuristics — VALIDATION.md keeps them as negative
results precisely because each backfired** (v2 dropped Bosch; v3 dropped Elsoft and collapsed Equipment).
Treat structural signals as soft ensemble votes, never single-signal vetoes.

### extra_entities — the focus-specific entities the seed lacks

The shared `entity_registry` is a company invariant; a person's instance **never edits it**. The
focus-detector instead writes focus-specific entities to **`person_profile.focus.extra_entities`**, which
**adds to, never overwrites,** the shared seed. This is where a teammate whose work is unlike the
VP-Systems seed gets their world.

**CFO worked example.** A VP-Systems seed has `extra_entities: []` — their instrument vendors are
already company partners under `__Projects/`. The **CFO's `extra_entities` is the opposite — it is large**,
because finance/compliance entities never existed in the seed. The block below is an **illustration**: the
project paths and the named banks/regulators are *reference-instance / Singapore-jurisdiction examples — do
not transfer*; substitute your own customer Overviews and your own jurisdiction's finance entities.

```json
"focus": {
  "focus_verticals": [],                       // CFO work is cross-vertical / non-vertical — finance touches all lanes
  "focus_tiers": [1, 2],                        // follows the revenue accounts, but by $ not by engineering depth
  "focus_contexts": [],                         // no tester/optical context is central to finance
  "focus_document_kinds": [
    "invoices / POs", "bank statements", "audit working papers",
    "board / investor finance decks", "payroll & EP filings", "tax & GST filings"
  ],
  "focus_entities": [                           // the customer Overviews that drive revenue recognition
    "__Projects/Aquisition/20250627 Bosch/Overview.md",
    "__Projects/Aquisition/20260124 STMicroelectronics/Overview.md"
  ],
  "extra_entities": [                           // ← the seed has NONE of these; CFO-local, confidential
    { "name": "DBS Bank",            "role": "primary corporate bank",        "email": "" },
    { "name": "OCBC",                "role": "lender / trade finance",        "email": "" },
    { "name": "<Audit firm>",        "role": "external auditor",              "email": "" },
    { "name": "ACRA",                "role": "regulator (statutory filings)", "email": "" },
    { "name": "IRAS",                "role": "tax authority (GST/corp tax)",  "email": "" },
    { "name": "MOM",                 "role": "EP / work-pass authority",      "email": "" }
  ]
}
```

These stay **local to the CFO's instance**. The VP-Systems instance never sees them; there is no central
merge. (If the CFO's role needs categories the shared tiers can't hold — e.g. a `Finance/` working tree —
record them in `focus.extra_taxonomy`; usually empty for a person whose work still files under the shared
`__Projects/` tiers.)

---

## Step 3 — INPUT ADAPTER: plug any source unique to them

The seed's `input_adapters` (the `outlook_flat_export` mailbox at `__temp/mails`, the `MOTorga`
transcription backend) covers the common case. **Plug only what is genuinely new for this person:**

- A **separate mailbox** (the CFO almost certainly has a finance/AP inbox the VP never sees) → add it as a
  second `input_adapters.email` entry on the **person-profile side**: same adapter `kind`
  (`outlook_flat_export` or, preferably, `mail_api`), the person's `location`, and any finance-specific
  `junk_patterns`. Keep it in the teammate's `manifest.json`, never back in the shared seed.
- A **non-mail source** the role needs (an accounting-system export, a bank-statement drop folder) → it
  rides the same input-adapter pattern; the periodic-sync skill's ingest step consumes whatever adapter is
  present. SETUP_SEQUENCE's "dominant input?" bifurcation still applies — ship the matching adapter first.
- If the person has **no unique source** (their mail already lands in the shared archive), this step is a
  **no-op** — the seeded adapter covers them.

Do not re-author the transcription or cleanup mechanism; those are seeded mechanisms. You are only declaring
*where this person's raw material lands*.

---

## Step 4 — ROOT OVERRIDE: point the tools at their Drive

Every `kb-*` tool is a pure function of the manifest and reads the Drive root from
`storage_profile.root`. For a teammate on a different machine, set **`person_profile.root_override`** to
their absolute Drive root; the instance composes person-over-company, so the override wins.

```json
"person_profile": {
  "person": { "name": "<CFO name>", "email": "<cfo>@<your-company-domain>", "role": "CFO, finance, compliance" },
  "root_override": "<their drive root>",
  ...
}
```
*(Placeholders only — fill with the teammate's real name, email at your own domain, and absolute Drive root.
Do not paste the reference instance's values.)*

The B-tools take the **manifest path as their first positional argument** (default
`tooling/manifest.mot.json`), so "pointing at their Drive" is simply passing **their**
`manifest.json`:

```bash
node tooling/kb-index.mjs "<teammate-drive>/manifest.json" --out "<teammate-drive>/data/graph-index.json"
```

Keep the override **in the person profile**, not the shared `storage_profile.root` — that field stays the
company reference value so the seed remains copyable to the next teammate unchanged.

---

## Step 5 — REGISTER WORKSTREAMS: confirm contexts (with difference notes) if confusable

The `context_registry` came over verbatim in Step 1, so the teammate already has the full confusable-
workstream guardrail (Bosch vs STMicro testers, the Elsoft instances, etc.). You only act here if the
teammate's focus introduces a **new** workstream that is *confusable with an existing one*:

- **Register before content lands.** Per the register-before-use rule
  ([`templates/registries/README.md`](../templates/registries/README.md)), a workstream that **forks** from
  an existing one gets a new `tag` + a **reciprocal `difference` note on the sibling** *before* any file is
  written into it. An unregistered fork is exactly what the Step 6 drift auditor flags.
- A context entry that is shared-relevant (could confuse *any* teammate) belongs back in the **shared
  `context_registry`** so every instance inherits it. A context entry that is purely this person's and
  confidential stays local.
- **CFO note:** finance workstreams are rarely confusable with the tester contexts, so this step is usually
  a **no-op for the CFO** — `focus_contexts: []`. It bites for teammates whose work *does* fork an existing
  technical workstream (e.g. an engineer spinning a customer-specific tester variant), where the
  beam-path/metric/customer difference note is load-bearing.

---

## Step 6 — VERIFY: run kb-index then kb-audit on their instance

Build the instance's graph index, then run the drift auditor against it — both against the teammate's
**own** manifest, writing to the teammate's **own** Drive:

```bash
# 1. graph index — the derived state every other tool reads
node tooling/kb-index.mjs   "<teammate-drive>/manifest.json"  --out "<teammate-drive>/data/graph-index.json"

# 2. drift audit — the Phase-9 sensor; structurally identical audit, different manifest → different findings
node tooling/kb-audit.mjs   "<teammate-drive>/manifest.json"  --json
```

`kb-audit` is the standing drift sensor: missing frontmatter, unplaced files, stale `valid_as_of`, dead
refs, placement violations, plus the manifest-driven signals (off-enum `phase`/`supply_chain_role`,
context-owner gaps). A different person's manifest yields a different — but structurally identical — audit.
Optionally also run:

- **`kb-walk.mjs`** — refresh the per-folder `_catalog.md` listings on the teammate's Drive (the generalized
  walker; 100% manifest-driven via `catalog_profile`).
- **`kb-extract.mjs`** — build the card/TL;DR/sync data layer if the teammate wants the dashboard projection.
- **`kb-entities.mjs`** — generate the entity registry view; for a teammate it surfaces the seed people
  **plus** this person's `extra_entities`, all local.
- **Migration kit (`migration/inventory.mjs` → `plan-renames.mjs` → `apply-moves.mjs`)** — **only if** the
  teammate's Drive is a *messy brownfield* needing a restructure (Phase 4). A per-person Drive that is
  already organized **skips this entirely**. Note `apply-moves.mjs` hard-refuses `--apply` on the protected
  MOT root, so a real run requires the teammate's own non-MOT root + the documented opt-out.

---

## Acceptance checklist

A teammate instance is stood up when **all** of these hold:

- [ ] `manifest.json` **validates** against `config.schema.json`.
- [ ] `company_profile` is **byte-identical** to the shared seed (no per-person edits leaked into it —
      taxonomy, vocab, edge_types, context_registry, entity_registry.people, excludes, brand, cadence).
- [ ] `person_profile.person` identifies the teammate; `root_override` points at **their** Drive root.
- [ ] `person_profile.focus` is **filled by the focus-detector** (not hand-typed defaults): focus_verticals,
      focus_tiers, focus_contexts, focus_entities, focus_document_kinds all populated or deliberately empty
      with a reason (the CFO's empty `focus_verticals`/`focus_contexts` is a *deliberate* finance state).
- [ ] `focus.extra_entities` holds the **focus-specific entities the seed lacks** (the CFO's
      banks/lenders/auditors/regulators), and the shared `entity_registry` was **not** edited to add them.
- [ ] Any **source unique to this person** (finance mailbox, statement drop) is declared as a person-side
      `input_adapters` entry; otherwise the seeded adapter is confirmed sufficient.
- [ ] Any **new confusable workstream** is registered (tag + reciprocal difference note) **before** content;
      otherwise confirmed none (CFO: none).
- [ ] `kb-index` builds a `graph-index.json` on the teammate's Drive **without error**.
- [ ] `kb-audit` runs clean of **high-severity** findings (med/low triaged); the instance is now on the
      Phase-9 drift loop.
- [ ] **Confidentiality confirmed:** all financial/HR/legal entities and sources live **only** in this
      instance — nothing was written to the shared seed or any central store.

When every box is checked, the teammate has a **federated, focus-adapted instance** on the common mechanisms
— not a login to a central system, and not a fresh design pass.
