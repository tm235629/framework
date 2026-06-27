#!/usr/bin/env node
/**
 * kb-index — the first framework B-library tool.
 *
 * A GENERIC frontmatter graph indexer that is a PURE FUNCTION OF THE MANIFEST.
 * It is the generalized form of `mot-tools.js graph`: where mot-tools.js hardcodes
 * SCAN_ROOTS, SKIP_DIRS, the deriveCategory if-ladder, and the field list as JS
 * constants, this reads ALL of that from the manifest (the C→B contract,
 * ARCHITECTURE.md §4 — "B tools are pure functions of it"). No __Projects /
 * __Operations literals appear in the logic below; every path, exclude, category
 * rule, and lifted field comes from the manifest.
 *
 * Usage:
 *   node tooling/kb-index.mjs [manifestPath] [--out PATH]
 *   default manifestPath = manifest.example.json (the shipped synthetic demo; copy to manifest.json and edit for your Drive)
 *   default --out        = tooling/_validation/graph-index.kb.json
 *
 * Output shape (mirrors mot-tools.js buildGraphIndex):
 *   { generated_at, root, manifest, files:[{id, ...schema fields, category, size, mtime}],
 *     containment:[{child,parent}], references:[{source,target,type}], counts }
 *
 * Frontmatter parsing uses gray-matter, declared in this package's package.json
 * and installed standalone via `npm install` in tooling/.
 * The B-library has no dependency on any sibling instance's node_modules.
 */

import fs from 'fs';
import path from 'path';
import url from 'url';
import matter from 'gray-matter';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── gray-matter resolved from tooling/node_modules (bare import) ──
// Standalone: `npm install` in tooling/ installs gray-matter here,
// so the B-library no longer depends on MOT's dashboard install.

// ── Manifest load (the ONLY source of paths/rules/fields) ────────────────
function loadManifest(manifestPath) {
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  const m = JSON.parse(raw);
  const cp = m.company_profile;
  if (!cp) throw new Error('manifest has no company_profile');
  const storageRoot = cp.storage_profile && cp.storage_profile.root;
  // person_profile.root_override wins for THIS instance if present (federation §11).
  const personOverride = m.person_profile && m.person_profile.root_override;
  const root = personOverride || storageRoot;
  if (!root) throw new Error('manifest has no storage_profile.root');
  return {
    raw: m,
    root: root.replace(/\\/g, '/'),
    scanRoots: cp.scan_roots || [],
    excludeDirs: new Set((cp.excludes && cp.excludes.dirs) || []),
    // GAP-1 resolution: the INDEXER excludes ONLY conflict-file names (excludes.conflict_pattern),
    // matching mot-tools.js buildGraphIndex (one inline /-METAOPTICS\d+\.md$/i filter). It does NOT
    // apply excludes.skip_names — that list is walker/server-scoped (the C++ walker SKIP_NAMES +
    // dashboard server), so _catalog.md stays INDEXED here exactly as MOT indexes it. See REPORT.md GAP-1.
    conflictPattern: (cp.excludes && cp.excludes.conflict_pattern) || null,
    excludePathPatterns: (cp.excludes && cp.excludes.exclude_path_patterns) || [],
    categoryRules: (cp.taxonomy && cp.taxonomy.category_rules) || [],
    requiredFields: (cp.frontmatter_schema && cp.frontmatter_schema.required_fields) || [],
    optionalFields: (cp.frontmatter_schema && cp.frontmatter_schema.optional_fields) || [],
  };
}

// ── Category derivation — driven entirely by manifest category_rules ─────
// Each rule is { match, match_kind, scope?, category }. Ordered first-match,
// mirroring mot-tools.js deriveCategory (lifecycle folders before location).
// match_kind:
//   regex             — `match` is a regex tested against the root-relative path.
//   exact             — the whole root-relative path equals `match`.
//   first_segment     — the first path segment equals `match`.
//   second_segment_of — first segment === `scope` AND second segment === `match`.
function deriveCategory(rel, rules) {
  const parts = rel.split('/');
  for (const rule of rules) {
    const kind = rule.match_kind || 'regex';
    if (kind === 'regex') {
      // `i` flag matches mot-tools.js (Archive/legacy are matched case-insensitively).
      if (new RegExp(rule.match, 'i').test(rel)) return rule.category;
    } else if (kind === 'exact') {
      if (rel === rule.match) return rule.category;
    } else if (kind === 'first_segment') {
      if (parts[0] === rule.match) return rule.category;
    } else if (kind === 'second_segment_of') {
      if (parts[0] === rule.scope && parts[1] === rule.match) return rule.category;
    }
  }
  // Fallback bucket. mot-tools.js returns 'document' when nothing matches; we keep
  // that literal here as the indexer's own default (it is not a company path, it is
  // the "uncategorized" sentinel). A manifest could later carry a `default_category`.
  return 'document';
}

// ── conflict-file matcher (INDEXER-scoped) ───────────────────────────────
// excludes.conflict_pattern is a raw regex of merge-conflict basenames the graph
// indexer drops — and the ONLY name-based exclusion it applies. This mirrors
// mot-tools.js buildGraphIndex, which tests one inline /-METAOPTICS\d+\.md$/i and
// indexes everything else (including _catalog.md). The walker/server-scoped
// excludes.skip_names list is deliberately NOT compiled here (GAP-1 resolution):
// one name list cannot parameterize two tools with different rules.
function compileConflictPattern(pattern) {
  return pattern ? new RegExp(pattern, 'i') : null;
}

// ── exclude_path_patterns matcher (glob-ish over the whole rel path) ─────
function compilePathPatterns(patterns) {
  return patterns.map(p => {
    const esc = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
    return new RegExp(esc);
  });
}

// ── Walk: yield absolute .md paths under a dir, honouring excludes ───────
function* walkMd(dir, excludeDirs, depth = 0, maxDepth = 8) {
  if (depth > maxDepth) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (excludeDirs.has(e.name)) continue;
    // Hidden dotfiles/dirs are skipped, except `.claude` (a real scan root).
    if (e.name.startsWith('.') && e.name !== '.claude') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walkMd(full, excludeDirs, depth + 1, maxDepth);
    } else if (e.name.endsWith('.md')) {
      yield full;
    }
  }
}

function parseFile(absPath) {
  try {
    const text = fs.readFileSync(absPath, 'utf-8');
    const { data } = matter(text);
    if (!data || Object.keys(data).length === 0) return null;
    return data;
  } catch { return null; }
}

// Lift the manifest's required+optional frontmatter fields onto a node, plus the
// derived/structural fields. Field handling that needs shaping (references-derived
// fields, list defaults) is special-cased; everything else is lifted verbatim with
// a null default. This keeps the field set MANIFEST-DRIVEN: add a field to
// frontmatter_schema.optional_fields and it flows onto every node automatically.
function buildNode(rel, fm, stat, schemaFields, category) {
  const refs = Array.isArray(fm.references) ? fm.references : [];
  const supersededBy = refs
    .filter(r => r && r.path && r.type === 'superseded_by')
    .map(r => r.path.replace(/\\/g, '/'));
  const customerRefs = refs
    .filter(r => r && r.path && r.type === 'customer')
    .map(r => r.path.replace(/\\/g, '/'));

  const node = {
    id: rel,
    name: path.basename(rel),
    category,
  };
  // Lift each schema field. `references` is NOT lifted as a scalar (it is exploded
  // into edges + the derived *_refs fields below), matching mot-tools.js which
  // never stores the raw references array on the node.
  for (const f of schemaFields) {
    if (f === 'references') continue;
    if (f === 'tags') { node.tags = fm.tags || []; continue; }
    if (f === 'tier') {
      node.tier = (fm.tier != null && fm.tier !== '') ? fm.tier : null;
      continue;
    }
    if (f === 'description') { node.description = fm.description || ''; continue; }
    node[f] = (fm[f] != null && fm[f] !== '') ? fm[f] : null;
  }
  // Derived reference-axis fields (mirror mot-tools.js).
  node.customer_refs = customerRefs;
  node.superseded_by = supersededBy.length ? supersededBy : null;
  // Structural fields.
  node.size_bytes = stat.size;
  node.mtime = stat.mtimeMs;
  return node;
}

function buildIndex(manifestPath) {
  const M = loadManifest(manifestPath);
  const conflictRe = compileConflictPattern(M.conflictPattern);
  const pathPatternRes = compilePathPatterns(M.excludePathPatterns);
  const schemaFields = [...M.requiredFields, ...M.optionalFields];

  const files = [];
  const containment = [];
  const references = [];
  const seen = new Set();

  const relPath = (abs) => path.relative(M.root, abs).replace(/\\/g, '/');

  for (const scanRoot of M.scanRoots) {
    const abs = path.resolve(M.root, scanRoot);
    if (!fs.existsSync(abs)) continue;
    for (const filePath of walkMd(abs, M.excludeDirs)) {
      const rel = relPath(filePath);
      if (seen.has(rel)) continue;
      seen.add(rel);

      // INDEXER exclusions: conflict_pattern (merge-conflict files, tested against the
      // root-relative path like mot-tools.js) + exclude_path_patterns (raw-artifact subtrees).
      // skip_names is NOT applied here — it is walker/server-scoped, so _catalog.md is indexed.
      if (conflictRe && conflictRe.test(rel)) continue;
      if (pathPatternRes.some(re => re.test(rel))) continue;

      const fm = parseFile(filePath);
      if (!fm) continue;

      let stat;
      try { stat = fs.statSync(filePath); } catch { continue; }

      const category = deriveCategory(rel, M.categoryRules);
      files.push(buildNode(rel, fm, stat, schemaFields, category));

      // Containment: file ← its parent directory.
      const parent = path.dirname(rel) || '.';
      containment.push({ child: rel, parent });

      // References: typed cross-references from frontmatter.
      const refs = Array.isArray(fm.references) ? fm.references : [];
      for (const r of refs) {
        if (!r || !r.path) continue;
        references.push({
          source: rel,
          target: r.path.replace(/\\/g, '/'),
          type: r.type || 'references',
        });
      }
    }
  }

  files.sort((a, b) => a.id.localeCompare(b.id));
  return {
    generated_at: new Date().toISOString(),
    root: M.root,
    manifest: path.relative(M.root, path.resolve(manifestPath)).replace(/\\/g, '/'),
    files,
    containment,
    references,
    counts: {
      files: files.length,
      containment: containment.length,
      references: references.length,
    },
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const outFlagIdx = args.findIndex(a => a === '--out');
  let out = null;
  if (outFlagIdx >= 0) { out = args[outFlagIdx + 1]; args.splice(outFlagIdx, 2); }
  const inlineOut = args.find(a => a.startsWith('--out='));
  if (inlineOut) { out = inlineOut.replace(/^--out=/, ''); }

  const manifestArg = args.find(a => !a.startsWith('--'));
  const manifestPath = manifestArg
    ? path.resolve(process.cwd(), manifestArg)
    : path.resolve(__dirname, 'manifest.example.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`kb-index: manifest not found: ${manifestPath}`);
    return 1;
  }

  const outPath = out
    ? (out === '-' ? '-' : path.resolve(process.cwd(), out))
    : path.resolve(__dirname, '_validation', 'graph-index.kb.json');

  const idx = buildIndex(manifestPath);

  if (outPath === '-') {
    process.stdout.write(JSON.stringify(idx, null, 2));
  } else {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const tmp = outPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(idx, null, 2), 'utf-8');
    fs.renameSync(tmp, outPath);
    console.error(`Wrote ${outPath} (files: ${idx.counts.files}, containment: ${idx.counts.containment}, references: ${idx.counts.references})`);
  }
  return 0;
}

// ── Exports (so sibling B-tools, e.g. kb-audit.mjs, can REUSE the graph build
// without spawning a child process — DESIGN.md "auditor aggregates, never
// duplicates"). Pure functions; no side effects on import. ──────────────────
export {
  loadManifest, deriveCategory, walkMd, parseFile, buildNode, buildIndex,
  compileConflictPattern, compilePathPatterns,
};

// Run the CLI only when invoked directly (`node kb-index.mjs`), NOT when imported.
// Without this guard, importing the module would execute main() + process.exit().
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  process.exit(main());
}
