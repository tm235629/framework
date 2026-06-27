#!/usr/bin/env node
/**
 * plan-renames.mjs — Phase-2: PROPOSE a rename_map.json from inventory + taxonomy.
 *
 * Generalizes MOT's __Literature/_migration/map_build.py + resolve.py into the
 * manifest-driven planner. It is a PURE PLANNER: it reads the Phase-1
 * inventory.json (produced by inventory.mjs) and the manifest's taxonomy/profile
 * slots, and EMITS a rename_map.json — the gate-2 review artifact — with the
 * exact shape the literature kit proved:
 *
 *   { "moves":      [ { old, new, kind, category, source, title? }, … ],
 *     "superseded": [ { old, new, reason } , … ] }
 *
 * It WRITES ONLY a plan (JSON). It performs NO filesystem moves — that is
 * apply-moves.mjs's job, behind gate 2. It NEVER touches a content file.
 *
 * ── DO NOT RUN ON MOT IN THIS TASK ──────────────────────────────────────────
 * MOT's __Literature is already migrated; re-planning it is pointless and the
 * task forbids it. This file is delivered as a validated TEMPLATE. To exercise
 * it on a NON-MOT Drive, point it at that Drive's inventory.json + manifest.
 * Its only write target is a rename_map*.json, guarded by assertSafeOut() the
 * same way inventory.mjs guards its artifact.
 *
 * Manifest slots it reads (all {company-slot}, no literals in logic):
 *   migration_profile.target_layout        — where survivors/dups/supplements go
 *   migration_profile.filename_template     — the rename grammar + components
 *   migration_profile.taxonomy_source       — which manifest taxonomy drives `category`
 *   migration_profile.metadata_sources      — ordered provenance ladder (bib→embedded→…)
 *   company_profile.taxonomy.category_rules — reused for path→category fallback
 *
 * ── The hard part this file does NOT pretend to do deterministically ─────────
 * Authoritative per-file metadata (title/authors/year/category) is a C-rung
 * (agent / external-lookup) job in the proven kit (Crossref, first-page reads).
 * This planner is the B-rung scaffold: it (a) picks the canonical survivor per
 * exact-dup group, (b) routes surplus copies to the superseded sink, (c) slots a
 * proposed new name per survivor from whatever metadata the inventory/sidecar
 * carries, and (d) flags every file whose metadata_source is weak as
 * `needs_review` so the C rung resolves it before gate 2. It marks confidence,
 * never guesses silently.
 *
 * Usage (against a NON-MOT Drive):
 *   node migration/plan-renames.mjs <inventory.json> [manifestPath] [opts]
 *     --metadata FILE   optional resolved-metadata sidecar (C-rung output:
 *                       rel → {title,authors,year,journal,category,source})
 *     --out FILE        rename map path (default _validation/rename_map.sample.json)
 *     --json            print the plan summary to stdout
 *   default manifestPath = tooling/manifest.json (pass manifest.mot.json explicitly for the reference instance)
 */

import fs from 'fs';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Default migration_profile (the SHAPE; values are manifest-overridable) ───
// This is the generic form of the literature kit's choices, with every literal
// expressed as a slot. A new instance overrides any of these in its manifest.
const DEFAULT_MIGRATION = {
  target_layout: {
    primary: 'Papers',          // flat survivor folder            {primary-folder}
    variants: {},               // kind → folder (e.g. patent→Patents) {variant-folders}
    superseded: '_superseded',  // surplus-copy sink (never deleted) {superseded-sink}
    supplement_suffix: '_SI',   // supplement naming, no own node    {supplement-suffix}
  },
  // The rename grammar. components[] are filename fields drawn IN ORDER from the
  // resolved metadata; joined by `sep`; the title is slugged + word-capped.
  filename_template: {
    components: ['year', 'venue', 'first_author', 'last_author', 'title'],
    sep: '_',
    title_words: 8,
    title_word_sep: '-',
    max_filename_len: 120,
    ascii_fold: true,
  },
  // Which manifest section labels a file's `category` when metadata lacks one.
  taxonomy_source: 'category_rules',
  // Ordered confidence ladder; a file resolved from a source LATER than
  // `min_confident_source` is flagged needs_review (gate-2 must confirm).
  metadata_sources: ['bib', 'pdf-embedded', 'crossref', 'first-page', 'filename', 'unresolved'],
  min_confident_source: 'crossref',
};

function loadManifest(manifestPath) {
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const cp = m.company_profile || {};
  const mig = { ...DEFAULT_MIGRATION, ...(cp.migration_profile || {}) };
  // deep-merge the nested defaults so a partial override doesn't drop siblings
  mig.target_layout = { ...DEFAULT_MIGRATION.target_layout, ...(mig.target_layout || {}) };
  mig.filename_template = { ...DEFAULT_MIGRATION.filename_template, ...(mig.filename_template || {}) };
  return { cp, mig };
}

// ── filename slug helpers (generic; no company strings) ──────────────────────
function asciiFold(s) {
  // strip combining diacritical marks (U+0300–U+036F): é→e, ü→u, ñ→n
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}
function slugTitle(title, ft) {
  let t = ft.ascii_fold ? asciiFold(title) : title;
  const words = t.replace(/[^A-Za-z0-9\s\-]/g, ' ').split(/\s+/).filter(Boolean).slice(0, ft.title_words);
  return words.map(w => w[0].toUpperCase() + w.slice(1)).join(ft.title_word_sep);
}
function sanitizeComponent(s, ft) {
  let v = ft.ascii_fold ? asciiFold(String(s)) : String(s);
  return v.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '');
}
function buildName(meta, ft) {
  const parts = [];
  for (const c of ft.components) {
    if (c === 'title') { if (meta.title) parts.push(slugTitle(meta.title, ft)); continue; }
    if (meta[c]) parts.push(sanitizeComponent(meta[c], ft));
  }
  let name = parts.filter(Boolean).join(ft.sep);
  if (name.length > ft.max_filename_len) name = name.slice(0, ft.max_filename_len).replace(/[-_]+$/, '');
  return name;
}

// path→category fallback using the manifest's category_rules (first-match).
function deriveCategoryFromPath(rel, cp) {
  const rules = (cp.taxonomy && cp.taxonomy.category_rules) || [];
  const segs = rel.split('/');
  for (const r of rules) {
    if (r.match_kind === 'regex' && new RegExp(r.match).test(rel)) return r.category;
    if (r.match_kind === 'exact' && path.basename(rel) === r.match) return r.category;
    if (r.match_kind === 'first_segment' && segs[0] === r.match) return r.category;
    if (r.match_kind === 'second_segment_of' && segs[0] === r.scope && segs[1] === r.match) return r.category;
  }
  return null;
}

function confidenceRank(source, ladder) {
  const i = ladder.indexOf(source);
  return i < 0 ? ladder.length : i;
}

function assertSafeOut(target) {
  const validationDir = path.resolve(__dirname, '_validation');
  const norm = path.resolve(target);
  const base = path.basename(norm);
  if (!/^rename_map.*\.json$/i.test(base)) {
    throw new Error(`SAFETY: plan out must be named rename_map*.json, got: ${base}`);
  }
  if (!(norm === validationDir || norm.startsWith(validationDir + path.sep))) {
    if (process.env.MIGRATION_REAL_RUN !== '1') {
      throw new Error(`SAFETY: plan out escapes _validation/ (${norm}); a real migration must set MIGRATION_REAL_RUN=1.`);
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const positionals = args.filter((a, i) => !a.startsWith('--') &&
    !['--metadata', '--out'].includes(args[i - 1]));
  const invPath = positionals[0];
  if (!invPath) { console.error('usage: plan-renames.mjs <inventory.json> [manifest] [--metadata f] [--out f]'); return 1; }
  const manifestPath = positionals[1]
    ? path.resolve(process.cwd(), positionals[1])
    : path.resolve(__dirname, '..', 'tooling', 'manifest.json');
  const getOpt = (flag, def) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
  const asJson = args.includes('--json');
  const outPath = path.resolve(process.cwd(), getOpt('--out', path.resolve(__dirname, '_validation', 'rename_map.sample.json')));
  assertSafeOut(outPath);

  const inv = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), invPath), 'utf-8'));
  const { cp, mig } = loadManifest(manifestPath);
  const tl = mig.target_layout, ft = mig.filename_template;
  const ladder = mig.metadata_sources;

  // optional C-rung resolved metadata: rel -> {title,authors,year,venue,first_author,last_author,category,source}
  const metaFile = getOpt('--metadata', null);
  const resolved = metaFile ? JSON.parse(fs.readFileSync(path.resolve(process.cwd(), metaFile), 'utf-8')) : {};

  // 1. canonical survivor per exact-dup group: keep the SHORTEST-path copy
  //    (the literature kit's heuristic — usually the curated location), route
  //    the rest to the superseded sink mirrored under their old relative path.
  const supersededOld = new Set();
  const superseded = [];
  for (const [, members] of Object.entries(inv.exact_duplicate_groups || {})) {
    const survivor = [...members].sort((a, b) => a.length - b.length)[0];
    for (const m of members) if (m !== survivor) {
      supersededOld.add(m);
      superseded.push({ old: m, new: `${tl.superseded}/${m}`, reason: 'exact-duplicate surplus copy (byte-identical)' });
    }
  }

  // 2. propose a move per surviving record
  const moves = [];
  const needsReview = [];
  for (const r of inv.records || []) {
    if (supersededOld.has(r.rel)) continue;       // already routed to superseded
    const meta = resolved[r.rel] || {};
    const kind = meta.kind || r.type || 'document';
    const folder = tl.variants[kind] || tl.primary;
    const category = meta.category || deriveCategoryFromPath(r.rel, cp) || null;
    const source = meta.source || 'filename';
    // build new basename: from resolved metadata if present, else fall back to a
    // sanitized form of the existing basename (never silently invents a title).
    let base;
    if (meta.title || meta.year) base = buildName(meta, ft);
    if (!base) base = sanitizeComponent(r.name.replace(/\.[^.]+$/, ''), ft).slice(0, ft.max_filename_len);
    const ext = path.extname(r.name);
    const move = {
      old: r.rel,
      new: `${folder}/${base}${ext}`,
      kind,
      category,
      source,
    };
    if (meta.title) move.title = meta.title;
    moves.push(move);
    if (confidenceRank(source, ladder) > confidenceRank(mig.min_confident_source, ladder)) {
      needsReview.push({ rel: r.rel, source, why: `metadata source '${source}' weaker than '${mig.min_confident_source}'` });
    }
  }

  // 3. detect destination clashes inside the proposed plan (case-insensitive)
  const seen = new Map();
  const clashes = [];
  for (const m of moves) {
    const key = m.new.toLowerCase();
    if (seen.has(key)) clashes.push({ a: seen.get(key), b: m.old, dest: m.new });
    else seen.set(key, m.old);
  }

  const plan = {
    schema: 'migration/rename_map@1',
    generated_at: new Date().toISOString(),
    source_inventory: path.basename(invPath),
    target_layout: tl,
    filename_template: ft,
    counts: {
      moves: moves.length,
      superseded: superseded.length,
      needs_review: needsReview.length,
      destination_clashes: clashes.length,
    },
    moves,
    superseded,
    needs_review: needsReview,
    destination_clashes: clashes,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  assertSafeOut(outPath);
  fs.writeFileSync(outPath, JSON.stringify(plan, null, 1), 'utf-8');

  const summary = { ...plan }; delete summary.moves; delete summary.superseded;
  if (asJson) { process.stdout.write(JSON.stringify(summary, null, 2) + '\n'); }
  else {
    console.error('plan-renames (PROPOSE-ONLY — wrote a rename_map plan, moved NOTHING)');
    console.error(`  out               : ${outPath}`);
    console.error(`  moves proposed    : ${moves.length}`);
    console.error(`  superseded copies : ${superseded.length}`);
    console.error(`  needs C-review    : ${needsReview.length} (weak metadata)`);
    console.error(`  destination clash : ${clashes.length} (MUST resolve before gate 2)`);
  }
  return 0;
}

process.exit(main());
