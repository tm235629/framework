---
description: Validation evidence for the contact-register slice — the 2026-07-02 production dry-run + --apply cycles, the failure-path verification table, and the separately-proven derived layer.
references:
  - path: slices/contact-register/DESIGN.md
    type: sibling
    note: The mechanism this file records the validation evidence for.
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Contact register — validation evidence

> **Reference instance:** MetaOptics (MOT), "Instance Zero." All paths and figures below are that
> instance's, cited as the worked example; the mechanism they validate is the reusable one specified in
> `DESIGN.md`. No customer names appear; MOT path references are the working reference.

The slice is documented as a *validated* mechanism, not a proposal. Evidence lives on the reference
instance and was captured 2026-07-02.

## 1. Production rebuild cycle (2026-07-02)

The real rebuild ran against the production register:
- A **dry-run** (plain invocation) wrote the candidate + change report, invariants **PASS**, register
  untouched.
- An **`--apply`** then rewrote the register through the gate. Timestamped backups from that day exist in
  `__Sales/Contacts/_scripts/_backups/` (e.g. `Contacts_20260702_132717.md`, `Contacts_20260702_132803.md`),
  confirming the backup-before-atomic-write step fired on a real apply.

## 2. Failure-path verification (2026-07-02)

The gate's abort paths were exercised end-to-end via the `MOT_CONTACTS_MD` env override pointed at a
**scratch copy** of the register — the real register was never a target and the mail archive was never
touched. Baseline inputs for the run: 3,613 mail JSONs, `projects.json` OK, 505 register data rows →
rebuild TOTAL 509. Full record: the **"Safety model verification (2026-07-02)"** section appended to
`__Sales/Contacts/README.md`. Summary of its scenario table:

| # | Scenario | Expected | Observed | Result |
|---|----------|----------|----------|--------|
| 1 | Baseline dry-run | Candidate written, invariants PASS, register untouched, exit 0 | `CANDIDATE ONLY (invariants PASS)`, +5/−1 diff, exit 0 | PASS |
| 2 | Baseline `--apply` on copy | Invariants pass, timestamped backup, atomic write, exit 0 | `APPLIED`, backup created, copy rewritten, no `.tmp` leftover, exit 0 | PASS |
| 3 | Header missing a column + `--apply` | Abort at header check, file untouched | `ABORT: register header is [...10 cols...]`, exit 1, hash unchanged | PASS |
| 4 | Lost-email invariant + `--apply` | Abort, register untouched, exit 2 | `INVARIANT FAIL: 1 register emails would be LOST`, `ABORTED --apply`, exit 2, hash unchanged | PASS |
| 5a | Shrink >3% without `--allow-shrink` | Abort, exit 2 | `INVARIANT FAIL: row count would fall 545 → 510 (floor 529)`, exit 2, hash unchanged | PASS |
| 5b | Same shrink with `--allow-shrink` | Proceeds, writes, exit 0 | `APPLIED`, copy rewritten, exit 0 | PASS |

**Method note (scenario 4).** All deterministic email-loss paths in the script are already accounted for
(role-stripped / company-excluded / alt-email), so no *natural* input can trip the LOST gate. Scenario 4
was therefore run against a scratch copy of the script with one exemption (`excl_emails`) removed, feeding a
company-excluded row carrying a unique email — this exercises the gate + `--apply` abort path exactly,
without altering the production script.

## 3. The one guard not safely testable

The **`<100`-mail-JSON completeness guard** (Stage 1) is **not testable safely**: the mail-archive path is
hardcoded, not overridable via env/arg, so reducing the visible JSON count would mean mutating the mail
archive itself. It was **verified by code read only** — it is an unconditional early `sys.exit` that fires
before any project load or write, matching the sibling `≥50 projects` completeness guard. This is the single
guard whose failure path was confirmed structurally rather than executed.

## 4. Derived layer proven separately

The rebuild validates only the **mutable person facts** written into the register. The **derived layer** —
person *status* (`active` / `idle` / `dormant` / `uncontacted`, computed against the real current date and
the `active_days` / `idle_months` thresholds) and the company *axes* (role / vertical / phase / tier,
derived from the linked project's Overview) — is proven **separately**, because it is the *extract's* job,
not the rebuild's. On the reference instance that extractor is **`kb-contacts`** (MOT's
`mot-tools.js extractContacts` → `contacts.json`), the shipped framework tool named in the S3 dashboard data
contract as the Contacts-tab source. Keeping the two proofs apart mirrors the architecture: **the register
stores facts; the extract derives status and axes at read time**, so neither can fork the other.

## Verification summary

| Claim | Evidence |
|-------|----------|
| Dry-run default writes candidate only, never the register | Scenario 1 |
| `--apply` gate passes on clean input, backs up + atomic-writes | Scenario 2 + `_backups/` artifacts |
| Schema-mismatch aborts untouched | Scenario 3 |
| Lost-email invariant aborts untouched | Scenario 4 |
| Row-count floor + `--allow-shrink` override | Scenarios 5a / 5b |
| Mail-completeness guard | Code read (unconditional early exit) |
| Derived status + axes | Separate, via `kb-contacts` (extract-time) |
