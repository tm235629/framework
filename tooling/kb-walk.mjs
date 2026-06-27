#!/usr/bin/env node
/**
 * kb-walk — the manifest-driven catalog GENERATOR (generalized mot-walker).
 *
 * A GENERIC per-folder `_catalog.md` generator that is a PURE FUNCTION OF THE
 * MANIFEST. It is the generalized form of the C++ `mot-walker` (tools/mot-walker.cpp):
 * where mot-walker hardcodes SCAN_DIRS, SKIP_DIRS, SKIP_EXTS, SKIP_NAMES, the
 * EXT_MAP classifier, and the catalog template as C++ constants, this reads every
 * path / exclude / classification from the manifest (the C→B contract,
 * ARCHITECTURE.md §4 — "B tools are pure functions of it"). No __Projects /
 * __Operations literals appear in the logic below.
 *
 * kb-walk is the WALKER, so unlike the INDEXER (kb-index.mjs) it DOES apply
 * excludes.skip_names AND excludes.skip_exts — the per-tool exclude-scoping
 * point the kb-index REPORT flagged as GAP-1. The indexer indexes _catalog.md;
 * the walker skips it (and skips the data/binary/junk extensions a catalog of
 * "real" content shouldn't list).
 *
 * ── CRITICAL SAFETY: DRY-RUN / VALIDATION MODE ONLY ──────────────────────────
 * kb-walk NEVER writes a `_catalog.md` anywhere in the live Drive. There is NO
 * code path in this file that writes a file named `_catalog.md`. It:
 *   1. walks the tree (in memory, read-only) and BUILDS catalog content as strings;
 *   2. for a SAMPLE of folders that already have a live `_catalog.md`, writes the
 *      GENERATED text to tooling/_validation/catalogs-sample/<safe>.md
 *      (a NON-_catalog filename, under the framework's own tooling tree);
 *   3. reads each live `_catalog.md` read-only and reports reproduction fidelity.
 * The single output directory is hard-pinned under tooling/. The only
 * basename this script ever passes to fs.writeFileSync ends in `.sample.md`, never
 * `_catalog.md` — see assertSafeOut().
 *
 * Usage:
 *   node tooling/kb-walk.mjs [manifestPath] [options]
 *     --sample N         number of live-catalog folders to validate (default 10)
 *     --seed S           deterministic sample selection seed (default 0)
 *     --out-dir DIR      where to write generated samples + REPORT data
 *                        (default tooling/_validation/catalogs-sample)
 *     --json             print the validation summary as JSON to stdout
 *   default manifestPath = manifest.example.json (shipped demo; copy to manifest.json and edit for your Drive)
 *
 * Frontmatter parsing uses gray-matter, declared in this package's package.json
 * and installed standalone via `npm install` in tooling/. The B-library has no
 * dependency on any sibling instance's node_modules. (kb-walk only needs it to READ existing
 * catalog frontmatter for comparison; the GENERATOR half emits YAML by hand,
 * byte-matching the C++ walker.)
 */

import fs from 'fs';
import path from 'path';
import url from 'url';
import matter from 'gray-matter';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── gray-matter resolved from tooling/node_modules (bare import) ──
// Standalone: `npm install` in tooling/ installs gray-matter here.

// ── Manifest load (the ONLY source of paths/rules/classification) ────────────
function loadManifest(manifestPath) {
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  const m = JSON.parse(raw);
  const cp = m.company_profile;
  if (!cp) throw new Error('manifest has no company_profile');
  const storageRoot = cp.storage_profile && cp.storage_profile.root;
  const personOverride = m.person_profile && m.person_profile.root_override;
  const root = personOverride || storageRoot;
  if (!root) throw new Error('manifest has no storage_profile.root');

  const excludes = cp.excludes || {};
  // catalog_profile is the NEW manifest section kb-walk needs but the current
  // manifest does NOT yet carry (the GAP this validation surfaces — see REPORT).
  // When absent we fall back to the BUILTIN_* mirror of mot-walker.cpp and the
  // validation report records that the manifest under-specifies the walker.
  const catalog = cp.catalog_profile || {};

  return {
    raw: m,
    root: root.replace(/\\/g, '/'),
    scanRoots: cp.scan_roots || [],
    excludeDirs: new Set(excludes.dirs || []),
    // WALKER-scoped name exclusions (the per-tool point of GAP-1): the literal
    // "_catalog.md" plus glob-ish names like "*-METAOPTICS*.md" / "*-HOST.md".
    skipNames: excludes.skip_names || [],
    // skip_exts: manifest-carried if present, else the documented builtin mirror.
    skipExts: catalog.skip_exts || null,           // null ⇒ gap, use BUILTIN
    extClassification: catalog.ext_classification || null, // null ⇒ gap, use BUILTIN
    skipExactNames: catalog.skip_exact_names || null,      // null ⇒ gap, use BUILTIN
    catalogFilename: catalog.catalog_filename || '_catalog.md',
    walkerVersion: (catalog.walker_version != null) ? catalog.walker_version : 1,
    maxDepth: (catalog.max_depth != null) ? catalog.max_depth : 8,
  };
}

// ── BUILTIN fallbacks — a faithful mirror of mot-walker.cpp (the GAP) ────────
// These constants live ONLY in the C++ walker today (the manifest does not carry
// skip_exts or the ext→type classifier — see README single-source-of-truth risk
// #4 and the validation REPORT). kb-walk mirrors them verbatim so its output
// byte-matches the live catalogs, and the report names this as a manifest gap:
// a manifest-pure walker REQUIRES a catalog_profile.{skip_exts,ext_classification}.
const BUILTIN_SKIP_EXTS = new Set([
  '.json', '.txt', '.log', '.dat', '.bin', '.raw',
  '.exe', '.dll', '.so', '.dylib', '.lib', '.a',
  '.bat', '.sh', '.jar', '.apk', '.class',
  '.lock', '.cache', '.pyc', '.pyo', '.o', '.obj',
  '.tmp', '.bak', '.swp', '.iso', '.dmg',
  '.crdownload', '.part',
]);

const BUILTIN_SKIP_EXACT_NAMES = new Set([
  '.DS_Store', 'Thumbs.db', 'desktop.ini',
  '.gitkeep', '.gitignore',
]);

// ext → [type (machine key), type_label (human)] — verbatim from mot-walker EXT_MAP.
const BUILTIN_EXT_MAP = {
  '.md': ['markdown', 'Markdown'],
  '.pdf': ['document', 'PDF'],
  '.docx': ['document', 'Word'],
  '.doc': ['document', 'Word'],
  '.dotx': ['document', 'Word template'],
  '.txt': ['document', 'Text'],
  '.xlsx': ['spreadsheet', 'Excel'],
  '.xls': ['spreadsheet', 'Excel'],
  '.csv': ['spreadsheet', 'CSV'],
  '.pptx': ['presentation', 'PowerPoint'],
  '.ppt': ['presentation', 'PowerPoint'],
  '.png': ['image', 'PNG'],
  '.jpg': ['image', 'JPEG'],
  '.jpeg': ['image', 'JPEG'],
  '.svg': ['image', 'SVG'],
  '.gif': ['image', 'GIF'],
  '.bmp': ['image', 'BMP'],
  '.tiff': ['image', 'TIFF'],
  '.py': ['code', 'Python'],
  '.js': ['code', 'JavaScript'],
  '.m': ['code', 'MATLAB'],
  '.ipynb': ['code', 'Notebook'],
  '.step': ['cad', 'STEP'],
  '.iges': ['cad', 'IGES'],
  '.fcstd': ['cad', 'FreeCAD'],
  '.x_t': ['cad', 'Parasolid'],
  '.oas': ['cad', 'OASIS'],
  '.zar': ['cad', 'Zemax archive'],
  '.zda': ['cad', 'Zemax'],
  '.zbb': ['cad', 'Zemax'],
  '.zmx': ['cad', 'Zemax'],
  '.zip': ['archive', 'ZIP'],
  '.7z': ['archive', '7-Zip'],
  '.rar': ['archive', 'RAR'],
  '.mkv': ['media', 'Video'],
  '.avi': ['media', 'Video'],
  '.mp4': ['media', 'Video'],
  '.wav': ['media', 'Audio'],
  '.mp3': ['media', 'Audio'],
  '.json': ['data', 'JSON'],
};
const BUILTIN_DEFAULT_TYPE = ['document', 'File'];

// ── name-glob matcher for skip_names ("*-METAOPTICS*.md", "_catalog.md") ─────
function compileNameGlobs(names) {
  return names.map(n => {
    const esc = n.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + esc + '$', 'i');
  });
}

// ── size formatting — verbatim from mot-walker formatSize ────────────────────
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.floor(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 ** 3)).toFixed(1)} GB`;
}

// ── YAML scalar escaping — verbatim port of mot-walker yamlEscape ────────────
// (so generated frontmatter byte-matches the C++ walker's quoting decisions).
function yamlEscape(s) {
  s = String(s);
  let needsQuote = s.length === 0;
  const special = ':#\'"\\\n{}[],&*?|>!%@`';
  if (!needsQuote) {
    for (const c of s) { if (special.includes(c)) { needsQuote = true; break; } }
  }
  if (!needsQuote && s.length && (s[0] === ' ' || s[s.length - 1] === ' ')) needsQuote = true;
  if (!needsQuote && s.length && (s[0] === '-' || s[0] === '.' || /[0-9]/.test(s[0]))) needsQuote = true;
  if (!needsQuote) return s;
  let out = '"';
  for (const c of s) {
    if (c === '"') out += '\\"';
    else if (c === '\\') out += '\\\\';
    else if (c === '\n') out += '\\n';
    else out += c;
  }
  return out + '"';
}

// ── recursive file count (mirror of countFilesRecursive) ─────────────────────
function countFilesRecursive(dir) {
  let count = 0;
  let stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); }
    catch { continue; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile()) count++;
    }
  }
  return count;
}

// ── classify one file by extension (manifest ext_classification or builtin) ──
function classify(ext, M) {
  if (M.extClassification && M.extClassification[ext]) {
    const v = M.extClassification[ext];
    return Array.isArray(v) ? v : [v.type, v.type_label];
  }
  return BUILTIN_EXT_MAP[ext] || BUILTIN_DEFAULT_TYPE;
}

// ── Build catalog model for ONE directory (immediate children only) ──────────
// Returns { rel, folderName, subdirs:[{name,path,file_count}], files:[{name,size,type,type_label}] }
// or null when there is nothing worth cataloging (mirrors walkAndCatalog's
// "files.empty() && subdirs.empty()" skip).
function buildFolderModel(absDir, M, nameGlobs) {
  const skipExts = M.skipExts ? new Set(M.skipExts) : BUILTIN_SKIP_EXTS;
  const skipExact = M.skipExactNames ? new Set(M.skipExactNames) : BUILTIN_SKIP_EXACT_NAMES;
  const relDirRaw = path.relative(M.root, absDir).replace(/\\/g, '/');
  const relDir = relDirRaw === '.' ? '' : relDirRaw;

  let entries;
  try { entries = fs.readdirSync(absDir, { withFileTypes: true }); }
  catch { return null; }

  const subdirs = [];
  const files = [];

  for (const e of entries) {
    const name = e.name;
    if (e.isDirectory()) {
      if (M.excludeDirs.has(name)) continue;
      if (name.startsWith('.') && name !== '.claude') continue;
      const fileCount = countFilesRecursive(path.join(absDir, name));
      const subdirRel = relDir ? `${relDir}/${name}` : name;
      subdirs.push({ name, path: `${subdirRel}/${M.catalogFilename}`, file_count: fileCount });
    } else if (e.isFile()) {
      if (name === M.catalogFilename) continue;          // skip self
      if (skipExact.has(name)) continue;                  // skip OS/system junk
      // skip_names globs (walker-scoped): _catalog.md (already handled), conflicts, host files
      if (nameGlobs.some(re => re.test(name))) continue;
      const ext = path.extname(name).toLowerCase();
      if (skipExts.has(ext)) continue;                    // skip data/binary exts
      let size = 0;
      try { size = fs.statSync(path.join(absDir, name)).size; } catch {}
      const [type, type_label] = classify(ext, M);
      files.push({ name, size, type, type_label });
    }
  }

  subdirs.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  files.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  if (files.length === 0 && subdirs.length === 0) return null;

  let folderName = path.basename(absDir);
  if (!folderName) folderName = relDir;

  return { rel: relDir, folderName, subdirs, files };
}

// ── Render the _catalog.md TEXT for a folder model (verbatim mot-walker template).
// summaryMeta: optional map name -> {summary,status} preserved from an existing
// catalog (the walker re-attaches human/agent lifecycle metadata on regen).
function renderCatalog(model, M, summaryMeta = {}) {
  const { folderName, subdirs, files } = model;

  // Attach preserved summary/status (mirror of the merge block in walkAndCatalog).
  const filesWithMeta = files.map(f => {
    const meta = summaryMeta[f.name];
    return { ...f, summary: (meta && meta.summary) || '', status: (meta && meta.status) || '' };
  });
  const anySummary = filesWithMeta.some(f => f.summary);

  // description: "<folder> — N folder(s), M file(s): Type, Type"
  // The C++ walker collects type labels in a std::map<string,int>, which iterates
  // in SORTED key order — so the label list is ALPHABETICAL (e.g. "File, PDF"),
  // not file order. Mirror that with a sorted unique set.
  const typeLabels = [...new Set(files.filter(f => f.type !== 'markdown').map(f => f.type_label))]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  let desc = folderName;
  if (subdirs.length || files.length) {
    desc += ' — '; // em-dash
    let first = true;
    if (subdirs.length) { desc += `${subdirs.length} folder(s)`; first = false; }
    if (files.length) {
      if (!first) desc += ', ';
      desc += `${files.length} file(s)`;
      if (typeLabels.length) desc += ': ' + typeLabels.join(', ');
    }
  }

  let buf = '';
  buf += '---\n';
  buf += `description: ${yamlEscape(desc)}\n`;
  buf += `walker_version: ${M.walkerVersion}\n`;

  if (subdirs.length) {
    buf += 'subdirs:\n';
    for (const sd of subdirs) {
      buf += `  - name: ${yamlEscape(sd.name)}\n`;
      buf += `    path: ${yamlEscape(sd.path)}\n`;
      buf += `    file_count: ${sd.file_count}\n`;
    }
  }
  if (filesWithMeta.length) {
    buf += 'files:\n';
    for (const f of filesWithMeta) {
      buf += `  - name: ${yamlEscape(f.name)}\n`;
      buf += `    size: ${f.size}\n`;
      buf += `    type: ${f.type}\n`;
      if (f.summary) buf += `    summary: ${yamlEscape(f.summary)}\n`;
      if (f.status) buf += `    status: ${yamlEscape(f.status)}\n`;
    }
  }
  buf += '---\n\n';

  buf += `# ${folderName}\n\n`;

  if (subdirs.length) {
    buf += '## Folders\n\n';
    buf += '| Folder | Files |\n';
    buf += '|--------|-------|\n';
    for (const sd of subdirs) buf += `| ${sd.name}/ | ${sd.file_count} |\n`;
    buf += '\n';
  }
  if (filesWithMeta.length) {
    buf += '## Files\n\n';
    if (anySummary) {
      buf += '| File | Type | Size | Summary |\n';
      buf += '|------|------|------|---------|\n';
      for (const f of filesWithMeta)
        buf += `| ${f.name} | ${f.type_label} | ${formatSize(f.size)} | ${f.summary} |\n`;
    } else {
      buf += '| File | Type | Size |\n';
      buf += '|------|------|------|\n';
      for (const f of filesWithMeta)
        buf += `| ${f.name} | ${f.type_label} | ${formatSize(f.size)} |\n`;
    }
    buf += '\n';
  }
  return buf;
}

// ── Read existing catalog's summary/status block (mirror readExistingCatalogMeta)
function readExistingCatalogMeta(catalogText) {
  const out = {};
  const lines = catalogText.split(/\r?\n/);
  let inFiles = false, curName = null, started = false;
  for (const line of lines) {
    if (line === '---') { if (started && inFiles) break; started = true; continue; }
    if (!started) continue;
    if (line.length && line[0] !== ' ' && line[0] !== '-') {
      inFiles = line.startsWith('files:');
      curName = null;
      continue;
    }
    if (!inFiles) continue;
    let m;
    if ((m = /^  - name:\s*(.*)$/.exec(line))) { curName = unquote(m[1]); out[curName] = out[curName] || {}; }
    else if (curName && (m = /^    summary:\s*(.*)$/.exec(line))) { out[curName].summary = unquote(m[1]); }
    else if (curName && (m = /^    status:\s*(.*)$/.exec(line))) { out[curName].status = unquote(m[1]); }
  }
  return out;
}
function unquote(v) {
  v = v.replace(/[\r\s]+$/, '');
  if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') {
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
  }
  return v;
}

// ── Walk to collect ALL directories under the scan roots (in memory) ─────────
function* walkDirs(absDir, M, depth = 0) {
  if (depth > M.maxDepth) return;
  yield absDir;
  let entries;
  try { entries = fs.readdirSync(absDir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (M.excludeDirs.has(e.name)) continue;
    if (e.name.startsWith('.') && e.name !== '.claude') continue;
    yield* walkDirs(path.join(absDir, e.name), M, depth + 1);
  }
}

// ── Deterministic sample picker — folders that ALREADY have a live _catalog.md.
// We hash the relative path so the sample is stable across runs (no mtime/order
// dependence) and spread across the tree.
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ── Compare generated vs live catalog — structural + entry-level diff ────────
function diffCatalog(generated, live) {
  const g = matter(generated), l = matter(live);
  const gd = g.data || {}, ld = l.data || {};
  const result = {
    frontmatter_keys_generated: Object.keys(gd).sort(),
    frontmatter_keys_live: Object.keys(ld).sort(),
    description_match: gd.description === ld.description,
    subdir_count_generated: (gd.subdirs || []).length,
    subdir_count_live: (ld.subdirs || []).length,
    file_count_generated: (gd.files || []).length,
    file_count_live: (ld.files || []).length,
  };
  // Entry-name sets (the load-bearing comparison: same children listed?).
  const gFiles = new Set((gd.files || []).map(f => f.name));
  const lFiles = new Set((ld.files || []).map(f => f.name));
  const gSubs = new Set((gd.subdirs || []).map(s => s.name));
  const lSubs = new Set((ld.subdirs || []).map(s => s.name));
  result.files_only_in_generated = [...gFiles].filter(x => !lFiles.has(x)).sort();
  result.files_only_in_live = [...lFiles].filter(x => !gFiles.has(x)).sort();
  result.subdirs_only_in_generated = [...gSubs].filter(x => !lSubs.has(x)).sort();
  result.subdirs_only_in_live = [...lSubs].filter(x => !gSubs.has(x)).sort();
  // Size agreement on common files.
  const lSizeByName = new Map((ld.files || []).map(f => [f.name, f.size]));
  let sizeMatches = 0, sizeChecked = 0;
  for (const f of (gd.files || [])) {
    if (lSizeByName.has(f.name)) { sizeChecked++; if (lSizeByName.get(f.name) === f.size) sizeMatches++; }
  }
  result.size_matches = sizeMatches;
  result.size_checked = sizeChecked;
  // Body table presence.
  result.body_has_folders_table = /## Folders/.test(generated) === /## Folders/.test(live);
  result.body_has_files_table = /## Files/.test(generated) === /## Files/.test(live);
  // Exact byte match (the strongest signal).
  result.byte_identical = generated === live;
  // Entry reproduction %.
  const totalLiveEntries = lFiles.size + lSubs.size;
  const reproducedEntries =
    [...lFiles].filter(x => gFiles.has(x)).length +
    [...lSubs].filter(x => gSubs.has(x)).length;
  result.entry_reproduction = totalLiveEntries
    ? +(100 * reproducedEntries / totalLiveEntries).toFixed(1)
    : 100;
  return result;
}

// ── SAFETY: the ONLY filesystem-write guard. Asserts every write target is
// (a) under the pinned out-dir and (b) NOT named _catalog.md. Throws otherwise.
function assertSafeOut(outDir, targetPath, M) {
  const normOut = path.resolve(outDir);
  const normTarget = path.resolve(targetPath);
  if (!normTarget.startsWith(normOut + path.sep) && normTarget !== normOut) {
    throw new Error(`SAFETY: write target escapes out-dir: ${normTarget}`);
  }
  const base = path.basename(normTarget);
  if (base === M.catalogFilename || base === '_catalog.md') {
    throw new Error(`SAFETY: refusing to write a catalog filename: ${base}`);
  }
}

function safeName(rel) {
  // Make a flat, filesystem-safe sample filename from a relative folder path.
  return (rel || 'ROOT').replace(/[\\/]/g, '__').replace(/[^A-Za-z0-9._ -]/g, '_') + '.sample.md';
}

function main() {
  const args = process.argv.slice(2);
  const getOpt = (flag, def) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : def;
  };
  const sampleN = parseInt(getOpt('--sample', '10'), 10);
  const seed = parseInt(getOpt('--seed', '0'), 10);
  const asJson = args.includes('--json');
  const manifestArg = args.find(a => !a.startsWith('--') &&
    args[args.indexOf(a) - 1] !== '--sample' &&
    args[args.indexOf(a) - 1] !== '--seed' &&
    args[args.indexOf(a) - 1] !== '--out-dir');
  const manifestPath = manifestArg
    ? path.resolve(process.cwd(), manifestArg)
    : path.resolve(__dirname, 'manifest.example.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`kb-walk: manifest not found: ${manifestPath}`);
    return 1;
  }

  const M = loadManifest(manifestPath);
  const outDir = path.resolve(process.cwd(),
    getOpt('--out-dir', path.resolve(__dirname, '_validation', 'catalogs-sample')));
  const nameGlobs = compileNameGlobs(M.skipNames);

  // Record whether the manifest carried the walker-only knobs or we fell back.
  const manifestGaps = [];
  if (!M.skipExts) manifestGaps.push('company_profile.catalog_profile.skip_exts (absent — using BUILTIN mirror of mot-walker.cpp SKIP_EXTS)');
  if (!M.extClassification) manifestGaps.push('company_profile.catalog_profile.ext_classification (absent — using BUILTIN mirror of mot-walker.cpp EXT_MAP)');
  if (!M.skipExactNames) manifestGaps.push('company_profile.catalog_profile.skip_exact_names (absent — using BUILTIN mirror of mot-walker.cpp SKIP_NAMES)');

  // ── 1. Find folders that ALREADY have a live _catalog.md (read-only scan) ──
  const candidates = [];
  for (const scanRoot of M.scanRoots) {
    const abs = path.resolve(M.root, scanRoot);
    if (!fs.existsSync(abs)) continue;
    for (const dir of walkDirs(abs, M)) {
      const catalogPath = path.join(dir, M.catalogFilename);
      if (fs.existsSync(catalogPath)) {
        const rel = path.relative(M.root, dir).replace(/\\/g, '/') || '.';
        candidates.push({ dir, catalogPath, rel });
      }
    }
  }
  // De-dup (scan roots can overlap) + deterministic spread by hash.
  const seenRel = new Set();
  const uniq = candidates.filter(c => (seenRel.has(c.rel) ? false : (seenRel.add(c.rel), true)));
  uniq.sort((a, b) => hashStr(a.rel + ':' + seed) - hashStr(b.rel + ':' + seed));
  const sample = uniq.slice(0, sampleN);

  // ── 2. Generate each sample IN MEMORY, write to the SAFE out-dir, diff ──────
  fs.mkdirSync(outDir, { recursive: true });
  const results = [];
  for (const c of sample) {
    let liveText;
    try { liveText = fs.readFileSync(c.catalogPath, 'utf-8'); } catch { continue; }

    const model = buildFolderModel(c.dir, M, nameGlobs);
    if (!model) {
      results.push({ rel: c.rel, note: 'generator produced no catalog (folder filters to empty)', live_present: true });
      continue;
    }
    // Re-attach any human-authored summary/status from the LIVE catalog, exactly
    // as the walker does on regen (so we compare like-for-like, not wipe).
    const meta = readExistingCatalogMeta(liveText);
    const generated = renderCatalog(model, M, meta);

    // SAFE write: a *.sample.md file under the pinned out-dir. NEVER _catalog.md.
    const outPath = path.join(outDir, safeName(c.rel));
    assertSafeOut(outDir, outPath, M);
    fs.writeFileSync(outPath, generated, 'utf-8');

    const diff = diffCatalog(generated, liveText);
    results.push({ rel: c.rel, sample_file: path.relative(M.root, outPath).replace(/\\/g, '/'), ...diff });
  }

  // ── 3. Aggregate + write a machine-readable summary (NOT a _catalog.md) ────
  const scored = results.filter(r => r.entry_reproduction != null);
  const summary = {
    generated_at: new Date().toISOString(),
    manifest: path.relative(M.root, manifestPath).replace(/\\/g, '/'),
    root: M.root,
    live_catalogs_found: uniq.length,
    sampled: sample.length,
    out_dir: path.relative(M.root, outDir).replace(/\\/g, '/'),
    manifest_gaps: manifestGaps,
    aggregate: {
      byte_identical: scored.filter(r => r.byte_identical).length,
      description_match: scored.filter(r => r.description_match).length,
      mean_entry_reproduction: scored.length
        ? +(scored.reduce((s, r) => s + r.entry_reproduction, 0) / scored.length).toFixed(1)
        : null,
      folders_with_only_in_live_entries: scored.filter(r =>
        (r.files_only_in_live || []).length || (r.subdirs_only_in_live || []).length).length,
      folders_with_only_in_generated_entries: scored.filter(r =>
        (r.files_only_in_generated || []).length || (r.subdirs_only_in_generated || []).length).length,
    },
    results,
  };

  const summaryPath = path.join(outDir, 'validation-summary.json');
  assertSafeOut(outDir, summaryPath, M);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  if (asJson) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  } else {
    console.error(`kb-walk (DRY-RUN / validation only — wrote NO _catalog.md to the Drive)`);
    console.error(`  live catalogs found : ${summary.live_catalogs_found}`);
    console.error(`  sampled             : ${summary.sampled}`);
    console.error(`  byte-identical      : ${summary.aggregate.byte_identical}/${scored.length}`);
    console.error(`  mean entry reprod.  : ${summary.aggregate.mean_entry_reproduction}%`);
    console.error(`  manifest gaps       : ${manifestGaps.length}`);
    console.error(`  samples + summary   : ${summary.out_dir}/`);
  }
  return 0;
}

// Run the CLI only when invoked directly (`node kb-walk.mjs`), NOT when imported.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  process.exit(main());
}
