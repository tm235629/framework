#!/usr/bin/env node
/**
 * kb-audit — the manifest-driven drift auditor (framework B-library tool).
 *
 * The GENERIC form of `mot-tools.js audit` / computeFindings. Where mot-tools.js
 * hardcodes the controlled vocabularies (VALID_REF_TYPES, LEGACY_REF_TYPES,
 * VALID_STATUS, PROVENANCE_REF_TYPES), the required-field list, and the
 * archive-location literal as JS constants, THIS reads ALL of that FROM THE
 * MANIFEST (the C→B contract, ARCHITECTURE.md §4 — "B tools are pure functions
 * of it"):
 *
 *   - vocab.edge_types.valid     → the valid reference-type set
 *   - vocab.edge_types.legacy    → discouraged-but-tolerated synonyms
 *   - vocab.edge_types.provenance→ provenance ref types (dead → low, not high)
 *   - vocab.status_enum          → the status lifecycle enum
 *   - frontmatter_schema.required_fields → which fields are mandatory
 *   - frontmatter_schema.tldr_keys       → canonical TL;DR keys + the date-anchored one
 *   - taxonomy.category_rules    → category derivation (archive/superseded/...)
 *
 * No __Projects / __Operations path literals appear in the audit LOGIC: the
 * "is this under Archive?" test is `category === 'archive'` (derived by the
 * manifest's category_rules), the TL;DR date key is the manifest's
 * tldr_keys.date_anchored_key, etc. Swap the manifest and the same code audits a
 * different Drive.
 *
 * It REUSES kb-index.mjs's graph build (imported, not re-implemented) — the
 * "auditor aggregates, never duplicates" principle from
 * __Framework/slices/drift-detection/DESIGN.md.
 *
 * Signal families (identical to MOT's computeFindings):
 *   missing_required_frontmatter, invalid_reference_type / legacy_reference_type,
 *   invalid_status_enum, phase_archived_location_mismatch,
 *   overview_missing_tldr / tldr_last_activity_no_iso,
 *   dead_reference / provenance_ref_unresolved, suspected_stale_sibling.
 *
 * False-positive guards (same as MOT, DESIGN.md §"Risks"):
 *   - _catalog.md never flagged for missing frontmatter (walker-generated refs).
 *   - agent_read: avoid → TL;DR head only (extractTldr stops at the next heading).
 *   - superseded/legacy/exploratory (status OR category) excluded from TL;DR +
 *     suspected-stale (expected drift).
 *   - meta docs (README/CLAUDE/STATE/MEMORY/decisions/Documentation/Framework)
 *     excluded from project-Overview checks.
 *   - cloud-unhydrated / unreadable files → skipped, never reported missing.
 *   - merge-conflict files (excludes.conflict_pattern) never reach the index.
 *
 * READ-ONLY: writes ONLY __Framework/tooling/_validation/drift.kb.json. Touches
 * nothing in the live Drive.
 *
 * Usage:
 *   node __Framework/tooling/kb-audit.mjs [manifestPath] [--out PATH] [--json]
 *   default manifestPath = manifest.example.json (shipped demo; copy to manifest.json and edit for your Drive)
 *   default --out        = __Framework/tooling/_validation/drift.kb.json
 *
 * Frontmatter parsing reuses MOT's gray-matter (via kb-index.mjs's parseFile),
 * so this is apples-to-apples with mot-tools.js. NOTE: a real framework
 * DEPLOYMENT would vendor gray-matter into __Framework/tooling/ so the B-library
 * has no dependency on a sibling instance's node_modules.
 */

import fs from 'fs';
import path from 'path';
import url from 'url';

import {
  loadManifest, buildIndex, parseFile, deriveCategory,
} from './kb-index.mjs';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Manifest → controlled vocabularies (the ONLY source) ──────────────────
// Everything the audit branches on comes from here. A different company's
// manifest yields a different (but structurally identical) audit.
function loadVocab(manifestPath) {
  const M = loadManifest(manifestPath);              // gives us root, categoryRules, requiredFields
  const cp = M.raw.company_profile || {};
  const vocab = cp.vocab || {};
  const edge = vocab.edge_types || {};
  const fmSchema = cp.frontmatter_schema || {};
  const tldrKeys = fmSchema.tldr_keys || {};
  const avoidMarker = fmSchema.avoid_read_marker || {};

  // Raw-archive roots — top-level segment(s) whose dead PROVENANCE refs are
  // intentionally-removed sources, not real drift. Prefer the explicit manifest
  // field company_profile.raw_archive_roots; fall back to deriving the roots from
  // input_adapters locations for manifests that omit it (back-compat).
  const rawRoots = new Set();
  if (Array.isArray(cp.raw_archive_roots) && cp.raw_archive_roots.length) {
    for (const r of cp.raw_archive_roots) {
      if (typeof r === 'string' && r) rawRoots.add(r.replace(/\\/g, '/').split('/')[0]);
    }
  } else {
    const adapters = cp.input_adapters || {};
    for (const a of Object.values(adapters)) {
      for (const k of ['location', 'recordings_location', 'summary_location']) {
        const loc = a && a[k];
        if (typeof loc === 'string' && loc) {
          rawRoots.add(loc.replace(/\\/g, '/').split('/')[0]); // top segment, e.g. "__temp"
        }
      }
    }
  }

  return {
    root: M.root,
    categoryRules: M.categoryRules,
    requiredFields: M.requiredFields,
    // Edge-type vocab — three tiers (valid / legacy-discouraged / provenance).
    validRefTypes: new Set(edge.valid || []),
    legacyRefTypes: new Set(edge.legacy || []),
    provenanceRefTypes: new Set(edge.provenance || []),
    // Status lifecycle enum.
    statusEnum: new Set(vocab.status_enum || []),
    // TL;DR conformance: the date-anchored key (manifest says "Last activity")
    // plus the canonical key list, used to build the activity-line matcher.
    tldrCanonicalKeys: tldrKeys.canonical || [],
    tldrDateAnchoredKey: tldrKeys.date_anchored_key || null,
    // agent_read: avoid marker — drives the head-only TL;DR read.
    avoidFlagField: avoidMarker.flag_field || 'agent_read',
    avoidFlagValue: avoidMarker.flag_value || 'avoid',
    // Raw-archive root segments (provenance dead-ref reclassification).
    rawArchiveRoots: rawRoots,
  };
}

// Is a (forward-slash) target path under one of the manifest's raw-archive roots?
function isUnderRawArchive(target, rawRoots) {
  const seg0 = String(target).replace(/\\/g, '/').split('/')[0];
  return rawRoots.has(seg0);
}

// ── Finding constructor (mirrors mot-tools.js mkFinding) ──────────────────
function mkFinding({ signal, severity, fixability, autonomy_tier, id, detail, suggested_fix, rule }) {
  return { signal, severity, fixability, autonomy_tier, id, detail, suggested_fix, rule };
}

// ── Predicates (generalized from mot-tools.js, manifest-aware) ────────────

// _catalog.md is walker-generated; its `references` are the folder contents,
// rewritten every walk — not human graph registration. Never flag it.
function isAutoCatalog(id) {
  return /(^|\/)_catalog\.md$/i.test(id);
}

// Intentionally superseded/legacy/exploratory content is EXPECTED to drift.
// Keys off the lifecycle status OR the manifest-derived category (superseded /
// archive — these category names come from taxonomy.category_rules, so the
// archive/_superseded folder literals live in the MANIFEST, not here).
function isExpectedDrift(node) {
  const st = node.status;
  if (st === 'superseded' || st === 'legacy' || st === 'exploratory') return true;
  if (node.category === 'superseded' || node.category === 'archive') return true;
  return false;
}

// A project Overview = an Overview.md inside the project tree. "Project tree" is
// expressed generically as a node whose manifest-derived category is one of the
// project-bearing buckets, rather than a "__Projects/" literal. (The MOT
// category_rules map Aquisition/Internal/Collaboration/project under __Projects.)
const PROJECT_CATEGORIES = new Set([
  'aquisition', 'internal', 'collaboration', 'project',
]);
function isProjectOverview(node) {
  return PROJECT_CATEGORIES.has(node.category)
    && /(?:^|\/)[A-Za-z0-9.()_-]*Overview\.md$/.test(node.id);
}

// Meta / non-project docs (decision logs, indexes, nav) aren't project tiles →
// excluded from the project-Overview-specific signals. Same surface mot-tools.js
// screens, plus the framework tree. These are document-KIND patterns (README /
// CLAUDE / STATE / MEMORY / decisions), not company-path literals, so they are
// portable; the one location bucket (reference docs) is a manifest CATEGORY.
function isMetaDoc(node) {
  const id = node.id;
  return /(^|\/)(README|CLAUDE|_catalog|STATE|MEMORY)\.md$/i.test(id)
    || /\/decisions\//.test(id)
    || /^__Framework\//.test(id)            // the framework's own tree (not an instance Overview)
    || node.category === 'reference';        // manifest-derived doc-reference bucket
}

// TL;DR extractor — head-only (stops at the next heading / `---` / EOF), so a
// file flagged agent_read: avoid is never full-read. Identical regex to
// mot-tools.js extractTldr.
function extractTldr(absPath) {
  const text = fs.readFileSync(absPath, 'utf-8');
  const fmStripped = text.replace(/^---\n.*?\n---\n/s, '');
  const m = /^## TL;DR\s*$([\s\S]*?)(?=^---\s*$|^## |$(?![\s\S]))/m.exec(fmStripped);
  if (!m) return null;
  return m[1].trim();
}

// Resolve a reference target the way the dashboard + check-refs.mjs do:
// ./ and ../ are source-relative, everything else is root-relative.
function refTargetResolves(root, sourceId, rawPath) {
  const raw = String(rawPath).replace(/\\/g, '/');
  const srcDir = path.dirname(path.join(root, sourceId));
  const isRel = raw.startsWith('./') || raw.startsWith('../');
  const resolvedAbs = isRel ? path.resolve(srcDir, raw) : path.resolve(root, raw);
  return fs.existsSync(resolvedAbs);
}

// ── suspected_stale_sibling — replicate listStale's heuristic ─────────────
// A current/untagged content doc that shares a `context` with a NEWER sibling
// but carries no superseded/legacy tag. (Generic copy of mot-tools.js listStale,
// suspected_stale branch.)
function suspectedStale(files) {
  const byContext = {};
  for (const f of files) {
    if (!f.context) continue;
    (byContext[f.context] ||= []).push({
      id: f.id, status: f.status || 'current',
      valid_as_of: f.valid_as_of || null, mtime: f.mtime,
    });
  }
  for (const ctx of Object.keys(byContext)) {
    byContext[ctx].sort((a, b) =>
      (b.valid_as_of || '').localeCompare(a.valid_as_of || '') || b.mtime - a.mtime);
  }
  // Meta docs (decision/index/nav) aren't content; don't compare them for staleness.
  const isCtxMeta = (id) => /\/decisions\//.test(id) || /\/(README|CLAUDE)\.md$/i.test(id);
  const suspected = [];
  for (const [ctx, list] of Object.entries(byContext)) {
    const content = list.filter(f => !isCtxMeta(f.id));   // already newest-first
    if (content.length < 2) continue;
    const newest = content[0];
    for (const f of content.slice(1)) {
      if (f.status === 'superseded' || f.status === 'legacy') continue;
      suspected.push({ id: f.id, context: ctx, newer_sibling: newest.id });
    }
  }
  return suspected;
}

// ── Core: compute findings (the generic computeFindings) ──────────────────
function computeFindings(index, V) {
  const findings = [];
  const root = V.root;

  // Build the "Last activity" matcher from the manifest's TL;DR keys. MOT's
  // hardcoded regex is /last (activity|engagement)\s*:/i; we derive the same
  // alternation from tldr_keys.date_anchored_key (+ the legacy "engagement"
  // synonym, kept because historical Overviews used "Last engagement:").
  const dateKey = V.tldrDateAnchoredKey;                 // e.g. "Last activity"
  const activityAlternation = activityKeyRegex(dateKey);

  for (const node of index.files) {
    const id = node.id;

    // Re-read raw frontmatter to distinguish "references field ABSENT" from the
    // sanctioned "references: None / []" (the graph build maps both to []). Also
    // catches cloud-unhydrated/unreadable files → skip (never reported missing).
    const parsed = parseFile(path.join(root, id));
    if (!parsed) continue;
    const fm = parsed;                                    // kb-index.parseFile returns the data object

    // ── Signal 1: missing required frontmatter ──────────────────────────
    // Manifest-driven: requiredFields comes from frontmatter_schema.required_fields.
    // A truly-absent field is the finding; description must also be non-empty.
    if (!isAutoCatalog(id)) {
      const missing = [];
      for (const field of V.requiredFields) {
        const present = Object.prototype.hasOwnProperty.call(fm, field);
        if (!present) { missing.push(field); continue; }
        // `description` (and any required string field) must be non-empty.
        const val = fm[field];
        if (field === 'description' && (val == null || !String(val).trim())) {
          missing.push(field);
        }
      }
      if (missing.length) {
        const descMissing = missing.includes('description');
        findings.push(mkFinding({
          signal: 'missing_required_frontmatter',
          severity: 'high', fixability: 'needs_judgment', autonomy_tier: 3, id,
          detail: `Missing required frontmatter field(s): ${missing.join(', ')}.`,
          suggested_fix: descMissing
            ? 'Author a one-line description (and references: None if no cross-link yet).'
            : 'Add `references: None` (keep the field; real refs get added over time).',
          rule: 'Reference_Graph_Schema Graph-registration',
        }));
      }
    }

    // ── Signal 4: enum validity (reference types + status) ──────────────
    const refs = Array.isArray(fm.references) ? fm.references : [];
    for (const r of refs) {
      if (!r || !r.type) continue;
      const t = String(r.type);
      if (V.validRefTypes.has(t)) continue;
      if (V.legacyRefTypes.has(t)) {
        findings.push(mkFinding({
          signal: 'legacy_reference_type',
          severity: 'low', fixability: 'auto', autonomy_tier: 1, id,
          detail: `Reference to ${r.path || '?'} uses legacy type "${t}".`,
          suggested_fix: 'Replace with the current equivalent per Reference_Graph_Schema §3 ("Avoid going forward").',
          rule: 'Reference_Graph_Schema §3',
        }));
      } else {
        findings.push(mkFinding({
          signal: 'invalid_reference_type',
          severity: 'med', fixability: 'auto', autonomy_tier: 1, id,
          detail: `Reference to ${r.path || '?'} has type "${t}" not in the controlled vocabulary.`,
          suggested_fix: 'Pick the most specific valid type from Reference_Graph_Schema §3.',
          rule: 'Reference_Graph_Schema §3',
        }));
      }
    }
    if (node.status && !V.statusEnum.has(String(node.status))) {
      findings.push(mkFinding({
        signal: 'invalid_status_enum',
        severity: 'med', fixability: 'auto', autonomy_tier: 1, id,
        detail: `status: "${node.status}" is not in the lifecycle enum.`,
        suggested_fix: `Use one of: ${[...V.statusEnum].join(', ')} (Status_Lifecycle §1).`,
        rule: 'Status_Lifecycle §1',
      }));
    }

    // ── Signal 3: archived ⇔ location lock ──────────────────────────────
    // GENERIC: "under archive" = the manifest-derived category is `archive`
    // (taxonomy.category_rules owns the Archive/ folder literal). No path literal here.
    const underArchive = node.category === 'archive';
    if (node.phase === 'archived' && !underArchive) {
      findings.push(mkFinding({
        signal: 'phase_archived_location_mismatch',
        severity: 'high', fixability: 'announce', autonomy_tier: 2, id,
        detail: 'phase: archived but the file is not in the archive tier.',
        suggested_fix: 'Move the whole dead relationship to the Archive tier, or correct the phase if it is still in place.',
        rule: 'Status_Lifecycle §9',
      }));
    } else if (underArchive && node.phase && node.phase !== 'archived') {
      findings.push(mkFinding({
        signal: 'phase_archived_location_mismatch',
        severity: 'high', fixability: 'announce', autonomy_tier: 2, id,
        detail: `File lives in the archive tier but phase is "${node.phase}", not "archived".`,
        suggested_fix: 'Set phase: archived (the equivalence is locked), or move it out of the Archive tier if still active.',
        rule: 'Status_Lifecycle §9',
      }));
    }

    // ── Signal 2: project-Overview TL;DR conformance ────────────────────
    if (isProjectOverview(node) && !isMetaDoc(node) && !isExpectedDrift(node)) {
      // agent_read: avoid → extractTldr reads the head only (never full-reads).
      let tldr = null;
      try { tldr = extractTldr(path.join(root, id)); } catch { tldr = undefined; }
      if (tldr === undefined) {
        // cloud-unhydrated / unreadable → skip silently.
      } else if (tldr === null || tldr === '') {
        findings.push(mkFinding({
          signal: 'overview_missing_tldr',
          severity: 'med', fixability: 'announce', autonomy_tier: 2, id,
          detail: 'Project Overview has no "## TL;DR" block.',
          suggested_fix: 'Add a TL;DR block with the canonical status/contacts/next-milestone bullets.',
          rule: 'Quality_Standards TL;DR',
        }));
      } else if (activityAlternation) {
        const lines = tldr.split('\n');
        let activityLine = null;
        for (const line of lines) {
          if (activityAlternation.test(line)) { activityLine = line; break; }
        }
        if (activityLine) {
          const val = activityLine.replace(activityStripRegex(dateKey), '').trim()
            .replace(/^\*+|\*+$/g, '').trim();
          if (!/^\d{4}-\d{2}-\d{2}/.test(val)) {
            findings.push(mkFinding({
              signal: 'tldr_last_activity_no_iso',
              severity: 'med', fixability: 'auto', autonomy_tier: 1, id,
              detail: `TL;DR "${dateKey}" line does not lead with an ISO date (got "${val.slice(0, 40)}").`,
              suggested_fix: `Lead the ${dateKey} value with a YYYY-MM-DD date.`,
              rule: 'Quality_Standards TL;DR',
            }));
          }
        }
      }
    }
  }

  // ── Signal 5a: dead references (re-export of check-refs logic) ──────────
  // A dead ref whose target is under a manifest RAW-ARCHIVE root (derived from
  // input_adapters, e.g. "__temp") AND whose type is a provenance class
  // (manifest vocab.edge_types.provenance) is intentional-source drift,
  // reclassified to a low-severity provenance_ref_unresolved. Both the
  // raw-archive root and the provenance class come from the manifest — no
  // hardcoded "__temp/" path literal in this branch (MOT hardcodes it).
  for (const ref of index.references) {
    if (!refTargetResolves(root, ref.source, ref.target)) {
      const target = String(ref.target).replace(/\\/g, '/');
      const isProvenanceClass = V.provenanceRefTypes.has(String(ref.type));
      const targetUnderTemp = isUnderRawArchive(target, V.rawArchiveRoots);
      if (isProvenanceClass && targetUnderTemp) {
        findings.push(mkFinding({
          signal: 'provenance_ref_unresolved',
          severity: 'low', fixability: 'needs_judgment', autonomy_tier: 3, id: ref.source,
          detail: `Provenance reference (type ${ref.type}) → ${ref.target} does not resolve — target is an intentionally-removed source under a raw-archive root.`,
          suggested_fix: 'Provenance to a cleaned-up source; leave as-is unless the source should be restored or the edge retired. Not auto-fixable.',
          rule: 'Reference_Graph_Schema §5 (non-provenance exclusion, 2026-06-16 ref audit)',
        }));
      } else {
        findings.push(mkFinding({
          signal: 'dead_reference',
          severity: 'high', fixability: 'needs_judgment', autonomy_tier: 3, id: ref.source,
          detail: `Reference (type ${ref.type}) → ${ref.target} does not resolve on disk.`,
          suggested_fix: 'Repoint the path (usually path drift after a move/rename); do not delete the intent.',
          rule: 'Reference_Graph_Schema §5',
        }));
      }
    }
  }

  // ── Signal 5b: suspected stale siblings (re-export of `stale` logic) ────
  const nodeById = new Map(index.files.map(n => [n.id, n]));
  for (const s of suspectedStale(index.files)) {
    const node = nodeById.get(s.id);
    if (node && isExpectedDrift(node)) continue;
    findings.push(mkFinding({
      signal: 'suspected_stale_sibling',
      severity: 'med', fixability: 'needs_judgment', autonomy_tier: 3, id: s.id,
      detail: `Shares context "${s.context}" with a newer sibling (${s.newer_sibling}) but is untagged.`,
      suggested_fix: 'Confirm whether it is superseded; if so add status + a superseded_by edge, else refresh it.',
      rule: 'Status_Lifecycle §1',
    }));
  }

  return findings;
}

// Build a case-insensitive matcher for the activity TL;DR line from the
// manifest's date-anchored key. MOT matches both "Last activity:" and the legacy
// "Last engagement:" synonym; we generalize: take the key's last word and OR it
// with "engagement" (the documented legacy spelling). E.g. key "Last activity"
// → /last (activity|engagement)\s*:/i.
// "Last activity" → raw regex fragment `Last\s+(activity|engagement)`. The HEAD
// ("Last") is a literal and IS escaped; the (a|b) alternation is regex SYNTAX
// assembled from individually-escaped words, so the whole fragment must NOT be
// re-escaped (re-escaping turned `(activity|engagement)` into a literal and
// silently dropped every TL;DR match).
function keyFragment(dateKey) {
  if (!dateKey) return null;
  const words = String(dateKey).trim().split(/\s+/);
  const last = words.pop();
  const head = words.join(' ');
  const synonyms = [...new Set([last.toLowerCase(), 'engagement'])].map(escapeRe);
  const headLit = head ? `${escapeRe(head)}\\s+` : '';
  return `${headLit}(${synonyms.join('|')})`;
}
function activityKeyRegex(dateKey) {
  const frag = keyFragment(dateKey);
  return frag ? new RegExp(`${frag}\\s*:`, 'i') : null;
}
function activityStripRegex(dateKey) {
  const frag = keyFragment(dateKey);
  return new RegExp(`.*${frag}\\s*:`, 'i');
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ── runAudit — assemble drift.json (mirrors mot-tools.js runAudit shape) ──
function runAudit(manifestPath) {
  const V = loadVocab(manifestPath);
  const index = buildIndex(manifestPath);
  const findings = computeFindings(index, V);

  const counts = { high: 0, med: 0, low: 0, fixable: 0, needs_judgment: 0 };
  for (const f of findings) {
    if (counts[f.severity] != null) counts[f.severity] += 1;
    if (f.fixability === 'auto' || f.fixability === 'announce') counts.fixable += 1;
    if (f.fixability === 'needs_judgment') counts.needs_judgment += 1;
  }

  const sevRank = { high: 0, med: 1, low: 2 };
  findings.sort((a, b) =>
    (sevRank[a.severity] - sevRank[b.severity])
    || a.signal.localeCompare(b.signal)
    || a.id.localeCompare(b.id));

  return {
    generated_at: new Date().toISOString(),
    root: V.root,
    manifest: path.relative(V.root, path.resolve(manifestPath)).replace(/\\/g, '/'),
    counts,
    findings,
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');

  let out = null;
  const outFlagIdx = args.findIndex(a => a === '--out');
  if (outFlagIdx >= 0) { out = args[outFlagIdx + 1]; }
  const inlineOut = args.find(a => a.startsWith('--out='));
  if (inlineOut) out = inlineOut.replace(/^--out=/, '');

  const manifestArg = args.find(a => !a.startsWith('--') && a !== out);
  const manifestPath = manifestArg
    ? path.resolve(process.cwd(), manifestArg)
    : path.resolve(__dirname, 'manifest.example.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`kb-audit: manifest not found: ${manifestPath}`);
    return 1;
  }

  const drift = runAudit(manifestPath);

  // OUTPUT IS WRITE-ONLY UNDER __Framework/tooling/_validation/ — never the live Drive.
  const outPath = out
    ? path.resolve(process.cwd(), out)
    : path.resolve(__dirname, '_validation', 'drift.kb.json');

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const tmp = outPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(drift, null, 2), 'utf-8');
  fs.renameSync(tmp, outPath);

  if (json) {
    process.stdout.write(JSON.stringify(drift, null, 2) + '\n');
  } else {
    const bySignal = {};
    for (const f of drift.findings) bySignal[f.signal] = (bySignal[f.signal] || 0) + 1;
    const L = [];
    L.push(`kb-audit — ${drift.findings.length} finding(s)`);
    L.push(`  high: ${drift.counts.high}   med: ${drift.counts.med}   low: ${drift.counts.low}`);
    L.push(`  fixable: ${drift.counts.fixable}   needs_judgment: ${drift.counts.needs_judgment}`);
    L.push('By signal:');
    for (const sig of Object.keys(bySignal).sort()) L.push(`  ${String(bySignal[sig]).padStart(4)}  ${sig}`);
    L.push(`Wrote ${outPath}`);
    process.stdout.write(L.join('\n') + '\n');
  }
  return 0;
}

export { loadVocab, computeFindings, runAudit };

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  process.exit(main());
}
