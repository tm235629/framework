#!/usr/bin/env node
/**
 * inventory.mjs — Phase-1 READ-ONLY inventory for the migration kit.
 *
 * Generalizes MOT's __Literature/_migration/inventory.py into a manifest-driven
 * B-tool: it walks a manifest root over scan_roots / excludes and records, for
 * every file, { rel, dir, name, size, sha1, type, type_label, mtime_ms } plus
 * duplicate groups by content hash and by normalized filename — into an
 * inventory.json (the Phase-1 → gate-1 input PLAYBOOK.md describes).
 *
 * It is a PURE FUNCTION OF THE MANIFEST (the C→B contract, ARCHITECTURE §4):
 *   - root            ← person_profile.root_override || company_profile.storage_profile.root
 *   - scan roots      ← migration_profile.scan_roots (fallback company_profile.scan_roots)
 *   - dir excludes    ← company_profile.excludes.dirs
 *   - name/ext skips  ← migration_profile.include/exclude knobs (see resolveMigration)
 *   - ext → type      ← company_profile.catalog_profile.ext_classification
 * No company literal (__Projects, __Literature, …) appears in the logic; every
 * such value is a {company-slot} read from the manifest.
 *
 * ── CRITICAL SAFETY: READ-ONLY ON THE LIVE DRIVE ────────────────────────────
 * This script READS the Drive and writes EXACTLY ONE artifact: the inventory
 * JSON. By default — and in every mode reachable in this task — that artifact is
 * pinned UNDER migration/_validation/ (a NON-live, framework-owned
 * tree) via assertSafeOut(). It NEVER moves, renames, deletes, or overwrites any
 * Drive content file. SHA-1 is read-only (open 'rb', stream, hash). The ONLY
 * fs.writeFileSync target is the inventory JSON, guarded so it cannot escape the
 * framework tree unless an operator explicitly passes --out OUTSIDE _validation/
 * (which the PLAYBOOK reserves for a real, gated migration on a NON-MOT Drive).
 *
 * Usage (validation — the only mode run in this task):
 *   node migration/inventory.mjs [manifestPath] [options]
 *     --out FILE     inventory path (default _validation/inventory.sample.json)
 *     --limit N      cap files hashed (sample mode; 0 = all). Default 0.
 *     --no-hash      skip sha1 (size+name dedup only) — faster smoke test
 *     --json         print the summary block to stdout as JSON
 *   default manifestPath = tooling/manifest.json (pass manifest.mot.json explicitly for the reference instance)
 */

import fs from 'fs';
import path from 'path';
import url from 'url';
import crypto from 'crypto';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Manifest load — the ONLY source of paths/excludes/classification ─────────
function loadManifest(manifestPath) {
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const cp = m.company_profile;
  if (!cp) throw new Error('manifest has no company_profile');
  const root = (m.person_profile && m.person_profile.root_override) ||
    (cp.storage_profile && cp.storage_profile.root);
  if (!root) throw new Error('manifest has no storage_profile.root');
  return { raw: m, cp, root: root.replace(/\\/g, '/') };
}

// Resolve the migration_profile slots, with documented fallbacks to existing
// company_profile sections (so the tool runs against the current MOT manifest,
// which does not yet carry a migration_profile — the gap config.schema.json adds).
function resolveMigration(cp) {
  const mig = cp.migration_profile || {};
  const cat = cp.catalog_profile || {};
  return {
    scanRoots: mig.scan_roots || cp.scan_roots || ['.'],
    excludeDirs: new Set(cp.excludes ? (cp.excludes.dirs || []) : []),
    // Inventory-scoped: which extensions to INCLUDE. Empty/absent ⇒ all files
    // (the literature kit inventoried only .pdf via include_exts:['.pdf']).
    includeExts: mig.include_exts ? new Set(mig.include_exts.map(e => e.toLowerCase())) : null,
    // Names/exts the inventory should never list (derived artifacts, OS junk).
    skipExts: new Set((cat.skip_exts || []).map(e => e.toLowerCase())),
    skipExactNames: new Set(cat.skip_exact_names || []),
    catalogFilename: cat.catalog_filename || '_catalog.md',
    extClass: cat.ext_classification || {},
    defaultType: cat.default_type || { type: 'document', type_label: 'File' },
    // Filename-normalizer for near-dup detection (literature stripped spaces,
    // separators, and trailing copy/number markers). Manifest-overridable.
    normStrip: mig.near_dup_normalize_strip || "[\\s_\\-.()\\[\\],']+",
    normTailDrop: mig.near_dup_tail_drop || '(copy|kopie|\\d)$',
  };
}

function classify(ext, M) {
  const v = M.extClass[ext];
  if (v) return [v.type, v.type_label];
  return [M.defaultType.type, M.defaultType.type_label];
}

function sha1File(abs) {
  const h = crypto.createHash('sha1');
  const fd = fs.openSync(abs, 'r');
  try {
    const buf = Buffer.allocUnsafe(1 << 20);
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  } finally { fs.closeSync(fd); }
  return h.digest('hex');
}

function normName(name, M) {
  let n = name.replace(/\.[^.]+$/, '').toLowerCase();
  n = n.replace(new RegExp(M.normStrip, 'g'), '');
  n = n.replace(new RegExp(M.normTailDrop), '');
  return n;
}

// ── Recursive walk over scan roots (read-only) ───────────────────────────────
function* walkFiles(absDir, M) {
  let entries;
  try { entries = fs.readdirSync(absDir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const name = e.name;
    const full = path.join(absDir, name);
    if (e.isDirectory()) {
      if (M.excludeDirs.has(name)) continue;
      if (name.startsWith('.') && name !== '.claude') continue;
      yield* walkFiles(full, M);
    } else if (e.isFile()) {
      yield full;
    }
  }
}

// ── SAFETY: the ONLY write guard. The inventory artifact must land under the
// framework's _validation/ tree unless an operator EXPLICITLY opts a real
// migration out via --out (reserved by the PLAYBOOK for a non-MOT Drive). It
// can NEVER overwrite a live-content filename: it must end in inventory*.json. ─
function assertSafeOut(target) {
  const validationDir = path.resolve(__dirname, '_validation');
  const norm = path.resolve(target);
  const base = path.basename(norm);
  if (!/^inventory.*\.json$/i.test(base)) {
    throw new Error(`SAFETY: inventory out must be named inventory*.json, got: ${base}`);
  }
  if (!(norm === validationDir || norm.startsWith(validationDir + path.sep))) {
    // Allow only with the explicit real-run env flag the PLAYBOOK documents.
    if (process.env.MIGRATION_REAL_RUN !== '1') {
      throw new Error(
        `SAFETY: inventory out escapes _validation/ (${norm}). ` +
        `A real migration on a NON-MOT Drive must set MIGRATION_REAL_RUN=1 (PLAYBOOK §gate).`);
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const getOpt = (flag, def) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
  const manifestArg = args.find((a, i) => !a.startsWith('--') &&
    !['--out', '--limit'].includes(args[i - 1]));
  const manifestPath = manifestArg
    ? path.resolve(process.cwd(), manifestArg)
    : path.resolve(__dirname, '..', 'tooling', 'manifest.json');
  if (!fs.existsSync(manifestPath)) { console.error(`inventory: manifest not found: ${manifestPath}`); return 1; }

  const { cp, root } = loadManifest(manifestPath);
  const M = resolveMigration(cp);
  const limit = parseInt(getOpt('--limit', '0'), 10);
  const noHash = args.includes('--no-hash');
  const asJson = args.includes('--json');
  const outPath = path.resolve(process.cwd(),
    getOpt('--out', path.resolve(__dirname, '_validation', 'inventory.sample.json')));
  assertSafeOut(outPath);

  const records = [];
  let scanned = 0, hashed = 0, skippedExt = 0;
  outer:
  for (const scanRoot of M.scanRoots) {
    const abs = path.resolve(root, scanRoot);
    if (!fs.existsSync(abs)) continue;
    for (const full of walkFiles(abs, M)) {
      const name = path.basename(full);
      if (name === M.catalogFilename) continue;
      if (M.skipExactNames.has(name)) continue;
      const ext = path.extname(name).toLowerCase();
      if (M.includeExts && !M.includeExts.has(ext)) continue;
      if (M.skipExts.has(ext)) { skippedExt++; continue; }
      const rel = path.relative(root, full).replace(/\\/g, '/');
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      const [type, type_label] = classify(ext, M);
      const rec = {
        rel,
        dir: path.dirname(rel),
        name,
        size: st.size,
        sha1: null,
        type,
        type_label,
        mtime_ms: Math.round(st.mtimeMs),
        path_len: full.length,
      };
      if (!noHash) {
        try { rec.sha1 = sha1File(full); hashed++; }
        catch (e) { rec.sha1 = null; rec.hash_error = String(e.message || e).slice(0, 120); }
      }
      records.push(rec);
      scanned++;
      if (limit && records.length >= limit) break outer;
    }
  }

  // duplicate groups by content hash
  const byHash = {};
  for (const r of records) if (r.sha1) (byHash[r.sha1] ||= []).push(r.rel);
  const exactDup = Object.fromEntries(Object.entries(byHash).filter(([, v]) => v.length > 1));

  // near-duplicates by normalized filename with DIFFERENT content
  const sha1Of = new Map(records.map(r => [r.rel, r.sha1]));
  const byNorm = {};
  for (const r of records) (byNorm[normName(r.name, M)] ||= []).push(r.rel);
  const nameDup = Object.fromEntries(Object.entries(byNorm).filter(([, v]) =>
    v.length > 1 && new Set(v.map(x => sha1Of.get(x))).size > 1));

  const result = {
    schema: 'migration/inventory@1',
    generated_at: new Date().toISOString(),
    manifest: path.relative(root, manifestPath).replace(/\\/g, '/'),
    root,
    scan_roots: M.scanRoots,
    hashed: !noHash,
    sampled_limit: limit || null,
    total_files: records.length,
    skipped_by_ext: skippedExt,
    exact_duplicate_groups: exactDup,
    exact_duplicate_surplus_files: Object.values(exactDup).reduce((s, v) => s + v.length - 1, 0),
    same_name_diff_content_groups: nameDup,
    type_breakdown: records.reduce((m, r) => ((m[r.type_label] = (m[r.type_label] || 0) + 1), m), {}),
    longest_path_len: records.reduce((mx, r) => Math.max(mx, r.path_len), 0),
    records,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  assertSafeOut(outPath);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 1), 'utf-8');

  const summary = { ...result };
  delete summary.records;
  if (asJson) { process.stdout.write(JSON.stringify(summary, null, 2) + '\n'); }
  else {
    console.error('inventory (READ-ONLY — wrote ONLY the inventory artifact, moved/changed NOTHING)');
    console.error(`  out                 : ${path.relative(root, outPath).replace(/\\/g, '/')}`);
    console.error(`  files inventoried   : ${result.total_files}${limit ? ` (capped at ${limit})` : ''}`);
    console.error(`  hashed              : ${hashed}`);
    console.error(`  exact-dup groups    : ${Object.keys(exactDup).length} (surplus ${result.exact_duplicate_surplus_files})`);
    console.error(`  same-name groups    : ${Object.keys(nameDup).length}`);
    console.error(`  longest path (chars): ${result.longest_path_len}`);
  }
  return 0;
}

process.exit(main());
