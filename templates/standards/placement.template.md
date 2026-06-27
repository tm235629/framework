---
description: Generalized placement contract — the folder-tier model + cross-cutting rules (supplier-vs-customer split, location≠owner, duplicate-merge, archive gate, nested-subproject hub) that decide where any file/folder lives. Mechanism only; tiers/verticals are {company-slot}s from the manifest.
references:
  - path: tooling/config.schema.json
    type: standard
    note: Slots resolve from company_profile.taxonomy (project_tiers, category_rules, subfolder_convention) + vocab.{verticals,node_kinds}.
  - path: templates/standards/graph-wiring.template.md
    type: related
    note: Location≠owner (Rule 1D) and nested subprojects (Rule 12) are expressed as typed edges + node_kind defined there.
status: current
context: framework-architecture
tags: [framework-meta]
---

# Placement contract — where a file/folder lives

The canonical placement-rules shape for the project hub. Governs both **human curation** and the
**ingest/port skill** (the attachment-porting step decides destination folders by these rules). Every
tier name, category bucket, subfolder, and vertical here is a `{company-slot}` from the manifest — the
*rule shapes* transfer; the *vocabulary* is re-derived per instance.

---

## 1. Tier model

The top-level tiers of the project hub come from **`{tiers}`** (`taxonomy.project_tiers[]` — each a
`folder` + one-line `purpose`, an optional `naming_convention`, and an `entity_card` flag deciding
whether its folders surface as project tiles). The generic tier *roles* every instance instantiates:

| Tier role | Holds | `entity_card` |
|---|---|---|
| **{relationship-inbound}** | external customer/demand-side engagements; named by a `{naming-convention}` (e.g. date-prefix, one folder per entity) | true |
| **{relationship-internal}** | suppliers + the entity's own internal R&D / product hub (`{product-hub}`); never holds customers | true |
| **{collaboration}** | projects under a signed joint-IP / co-development agreement only — narrow scope | true |
| **{record-of-sale}** | post-transaction record docs only; build artifacts stay in the supplier folder | false |
| **{reference}** | project-spanning reference docs; shared cross-entity refs | false |
| **{archive-tier}** | terminated relationships beyond revival (the `{category-rules}` bucket = `archive`) | true |

> Fill the table directly from `{tiers}`. The number/names of tiers are manifest-driven — an instance
> with no signed-MOU collaborations simply omits that tier.

---

## Cross-cutting placement rules

These are the rules the ingest/port skill and folder-review agents apply. Numbered for cross-reference;
the *mechanism* of each is generic, the named tiers/verticals are slots.

### Rule 1 — Supplier folder vs. customer folder (three-part split)

When a supplier builds equipment/output for a specific customer, classify each artifact by **origin and
ownership**, not by which project it is "about":

- **A. Supplier folder holds the build** (`{relationship-internal}/<Supplier>/`) — design/IP we authored,
  internal R&D, scripts, simulations, derived analysis, manuals — even when the build targets one customer.
- **B. Customer folder holds the relationship** (`{relationship-inbound}/<Customer>/`) — their signed legal
  docs, the specs/data they sent us, inbound mail, our outbound proposals/quotes *to* them.
- **C. Source-of-derivation rule** — a customer's raw data file stays in the **customer** folder; our
  scripts/fits/summaries derived from it go to the **supplier** folder; each side cross-references the other.
- **D. Location ≠ owner.** A folder's **location** follows origin (where it was built); its **owner** (the
  account that commissioned it, or the entity itself) is a typed `customer` edge ([graph-wiring](graph-wiring.template.md)),
  **never** a folder move. A customer-specific build under `{relationship-internal}/<Supplier>/` declares
  exactly one `customer`-typed edge → the customer's `{relationship-inbound}` Overview; the dashboard
  cross-lists it. Symmetrically, an entity-owned program lives in `{product-hub}` even though partners are
  involved — partners are *referenced*, not co-located.

### Rule 2 — Same entity in two relationship tiers → merge to the inbound tier

Customer engagements live in `{relationship-inbound}`. If an entity appears in both, merge its
`{relationship-internal}` content into the matching `{relationship-inbound}` folder and remove the empty
stub. **Exception:** an entity that is genuinely *both* customer and supplier keeps both folders, with the
role split documented in each Overview's TL;DR.

### Rule 3 — Collaboration requires a signed joint-IP / co-development agreement

A folder belongs in `{collaboration}` only with a **signed** joint-IP / co-development agreement. Warm
engagements, joint discussions, or shared deliverables without a formal agreement stay in
`{relationship-inbound}`. The ingest skill defaults to `{relationship-inbound}` when uncertain.

### Rule 4 — Purpose-named subfolders, no raw landing zone

Attachments port **directly** into a purpose-named subfolder from **`{subfolders}`**
(`taxonomy.subfolder_convention[]`). There is no raw `Email_Attachments/`-style landing zone — the port
step picks a purpose-named destination at port time.

### Rule 5 — Duplicate folders for one entity → earliest correct name wins

If two folders exist for one entity, merge the later into the earliest — **unless** the earlier
`{naming-convention}` key (e.g. date prefix) is demonstrably wrong, in which case merge into the
correctly-keyed folder. Never create a new folder for an existing entity; the ingest skill checks for an
existing `* <EntityName>` folder (case-insensitive, ignoring the naming key) before creating one.

### Rule 6 — Canonical spelling

One canonical spelling per entity (its own, as on its letterhead). Merge variant-spelling folders into it;
add a one-line `Prior folder spellings: <variant>` note in the Overview so future searches resolve.

### Rule 7 — Multi-vendor joint projects stay under the joint name

A project involving multiple vendors keeps **one** `{relationship-inbound}` folder under the joint name,
one subfolder per vendor — not split into per-vendor `{relationship-internal}` entries. *(Instance-specific
exception: a historic vendor-screening round that resolved to one owner-entity may be split per-entity —
record it as a placement decision.)*

### Rule 8 — Active customers stay in the inbound tier; never demoted

The `{naming-convention}` key is a **history marker, not a maturity gate**. Customers stay in
`{relationship-inbound}` permanently while active, regardless of engagement evolution.
`{relationship-internal}` never receives customer entities. Terminated customers go to `{archive-tier}`
(Rule 11), not back to the inbound tier.

### Rule 9 — Record-of-sale tier = record docs only

On a sale, **build artifacts stay in the supplier folder** (Rule 1). Only record-of-sale docs (final
signed order, delivery/shipping confirmation, warranty, customer-facing as-built docs) go to
`{record-of-sale}`. The supplier folder's Overview gets a status note pointing at the sale record.

### Rule 10 — Internal-only prototype work → internal tier, not collaboration

Internal prototype work belongs in `{relationship-internal}`. `{collaboration}` is reserved for joint
efforts under a signed agreement (Rule 3).

### Rule 11 — Archive is only for terminated relationships

Four engagement states; only one moves to `{archive-tier}`:

| State | Meaning | Where it lives | Tags |
|---|---|---|---|
| **Active** | live engagement | its active relationship tier | `phase: {phase-active}` |
| **Dormant** | alive, no current activity, revival plausible | **stays** in its active tier | `phase: {phase-dormant}` (keeps its `{tier-scale}` tier) |
| **Closed-in-place** | a finished **subproject** under a still-active parent | **stays** in place | `status: {status-legacy/superseded}` + keep phase + a closure TL;DR line (see [lifecycle](lifecycle.template.md)) |
| **Terminated** | the **whole** relationship is dead beyond revival | move the whole folder to `{archive-tier}/` | `phase: {phase-archived}` (⇔ under `{archive-tier}`) |

> `{phase-*}` are values of `{phase-enum}` (`vocab.phase_enum`); `{status-*}` are values of `{status-enum}`.
> The locked invariant **`phase: {phase-archived}` ⇔ folder under `{archive-tier}`** is enforced by the
> drift auditor. Keep `{archive-tier}/` simple — original content + a one-line termination note in the
> Overview TL;DR. Reactivation moves the folder back to an active tier.

### Rule 12 — Nested subprojects & the product/internal hub

Project structure is **recursive**, expressed by **folder containment + one frontmatter flag**
(`node_kind: {product-parent}`), **never** by `parent`/`child` reference edges (see
[graph-wiring](graph-wiring.template.md)). A folder directly inside a `{product-parent}`'s folder becomes
its subproject, nesting to the dashboard's depth cap.

The entity's own hub (`{product-hub}`, under `{relationship-internal}`) is organised on the company
**`{verticals}`** (`vocab.verticals`):

```
{product-hub}/<Vertical>/<Focus group>/<Project>/<Subproject>/
        Vertical ∈ {verticals}
```

- the hub root Overview is `node_kind: {program-root}` (omit `vertical`); each vertical Overview is
  `node_kind: {vertical-index}` (carries its `vertical`); both are **navigational labels** — non-tile,
  non-parent.
- a focus group that owns projects carries `node_kind: {product-parent}`; a single-leaf / data-asset focus
  group stays an ordinary leaf.
- **Only purely entity-owned work lives in `{product-hub}`.** Supplier- and customer-owned work lives in
  its own folder and is *referenced in* (Rule 1 / location ≠ owner).

Every project Overview carries the dashboard axes — **`tier`** (`{tier-scale}` importance, independent of
activity), **`phase`** (`{phase-enum}`), **`vertical`** (`{verticals}`) — plus **`node_kind`** for
structural role. Tier is importance, **not** structural role: do not retier a project for becoming a
focus-group node or subproject. (`{node-kinds}` = `vocab.node_kinds`.)

---

## When the rules don't decide

Pick the most reasonable tier, place it, and **flag the choice** in your summary — don't stall the batch.
Then add the resolved decision back to this contract as a new rule or worked example so the next case is
unambiguous. For the ingest skill specifically (act and flag, don't block): an email touching multiple
projects ports to the primary destination and flags the cross-reference; a never-seen entity gets a new
`{relationship-inbound}/<key> <Entity>/` folder and a flagged creation. The one case worth a quick question
is a genuine customer-vs-supplier ambiguity — that tier choice is hard to reverse cleanly.
