import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import matter from 'gray-matter';
import { exec } from 'child_process';
import {
  categorizeFolder,
  categorizeFile,
  isTopLevelIncluded,
  isPathExcluded,
  ASSET_NODE_TYPE_IDS,
} from './src/config/categories.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '6mb' })); // base64 contact photos ride in the JSON body

// Root is the instance drive, resolved ONLY from KB_ROOT. This is the framework
// SLICE copy — it carries NO hardcoded fallback (the live MOT dashboard at
// __Operations/Dashboard keeps its fallback). Fail fast with a clear message so a
// misconfigured launch never silently serves the wrong tree or crashes obscurely.
if (!process.env.KB_ROOT) {
  console.error(
    'FATAL: KB_ROOT is not set. The dashboard slice serves the knowledge-base drive\n' +
    'pointed to by KB_ROOT — there is no default. Set it to your instance root, e.g.\n' +
    '  PowerShell:  $env:KB_ROOT = "C:/path/to/your-drive"; node server.js\n' +
    '  bash:        KB_ROOT="/path/to/your-drive" node server.js'
  );
  process.exit(1);
}
const ONEDRIVE_ROOT = path.resolve(process.env.KB_ROOT);
const SKILLS_DIR = path.join(ONEDRIVE_ROOT, '.claude', 'commands');

// Instance config resolved from the manifest-generated module (see
// tooling/kb-dashboard-config.mjs → src/config/instance.config.js). Read with a
// safe default shape so the slice runs before any manifest is wired. This is the
// single place the SERVER learns instance-specific naming (display name, the
// top-level folder-prefix convention, and which instance-plugin scripts exist).
let INSTANCE_CONFIG = {};
try {
  const cfgUrl = new URL('./src/config/instance.config.json', import.meta.url);
  if (fs.existsSync(cfgUrl)) INSTANCE_CONFIG = JSON.parse(fs.readFileSync(cfgUrl, 'utf-8'));
} catch { /* fall back to defaults below */ }
// Top-level folder prefix that marks an "included" root folder (MOT uses "__").
// Config-driven so a differently-named convention still works; "__" is the default.
const ROOT_FOLDER_PREFIX = INSTANCE_CONFIG.rootFolderPrefix || '__';
// Instance-plugin extractor scripts (Sync PDF render, contacts re-extract). Absent
// in a bare slice → the endpoints that would spawn them return 501 (see below).
const PLUGIN_SCRIPTS = INSTANCE_CONFIG.pluginScripts || {};
const DISPLAY_NAME = INSTANCE_CONFIG.displayName || path.basename(ONEDRIVE_ROOT);

// Path-confinement guard. A request path is allowed only if it resolves to the
// root itself or something strictly inside it. A bare startsWith(ONEDRIVE_ROOT)
// also accepts a sibling like "OneDrive - MetaOptics - copy" and misses `..`
// escapes; requiring a separator boundary on the (already path.join-normalised)
// absolute path closes both. One helper replaces five hand-rolled copies.
const ROOT_PREFIX = ONEDRIVE_ROOT + path.sep;
const isInsideRoot = (absPath) => absPath === ONEDRIVE_ROOT || absPath.startsWith(ROOT_PREFIX);

// Directories that should never become graph nodes. Single source of truth:
// src/config/excludes.json (also consumed by scripts/mot-tools.js). The C++
// walker (tools/mot-walker.cpp SKIP_DIRS) keeps a mirrored copy — see the note in the JSON.
const SHARED_EXCLUDED_DIRS = new Set(
  JSON.parse(fs.readFileSync(new URL('./src/config/excludes.json', import.meta.url), 'utf-8')).dirs
);

// Walker configuration — single source of truth, no hardcoded scan lists.
// Root now flows from ONEDRIVE_ROOT (env-configurable via KB_ROOT, see above).
const WALKER_CONFIG = {
  root: ONEDRIVE_ROOT,
  excludes: SHARED_EXCLUDED_DIRS,
  largeThreshold: 200,  // dirs with more direct children than this are collapsed in tree
  maxDepth: 8,          // hard stop to prevent runaway walks
};

// Folder/file-type categorization lives in src/config/categories.js
// (single source of truth, imported by both server.js and the React app).

// Non-markdown file types that become lightweight "asset" nodes in the graph,
// so the tree mirrors the real folder structure (a Specs/ folder full of PDFs is
// no longer pruned to nothing). The list lives in config (ASSET_NODE_TYPE_IDS) so
// the server and the React type-toggle stay in sync. Noisy/voluminous types
// (web / image / script / data) are INCLUDED as nodes but default-hidden via their
// FILE_TYPES `visible:false` flag — the TreeGraph filters them out until toggled on,
// so the graph doesn't balloon with thumbnails/logs by default. Media/archive stay
// out entirely (not renderable, pure noise). Raw __temp archives are skipped
// separately (only their authored .md summaries belong in the graph).
const ASSET_NODE_TYPES = new Set(ASSET_NODE_TYPE_IDS);

// --- Graph + tree cache (watcher-invalidated, stale-while-revalidate) ---
// The old approach re-stat'ed every tracked file on every request, which costs
// 15-60 s on OneDrive Files-On-Demand placeholders. Now: caches are built once
// (async, off the request path), invalidated by a recursive fs.watch, and
// served instantly. If the watcher dies we fall back to a 5-minute TTL with
// background refresh — requests never wait for a rebuild once a cache exists.
let graphCache = null;
let treeCache = null;
let cacheBuiltAt = 0;
let rebuildPromise = null;
let rebuildQueued = false;
let watcherHealthy = false;
const fsp = fs.promises;

async function parseFrontmatter(filePath) {
  try {
    const content = await fsp.readFile(filePath, 'utf-8');
    const { data, content: body } = matter(content);
    // Every readable .md becomes a node — even with no/partial frontmatter.
    // The old gate (require description || references) silently dropped ~75% of
    // .md files and pruned their folders from the graph (e.g. an NDA/ or
    // Documentation/ folder whose only .md is an unframed CLAUDE.md index would
    // vanish entirely). Unframed files just carry an empty description and add no
    // reference edges; containment still places them correctly in the tree.
    return { frontmatter: data || {}, bodyPreview: body.slice(0, 500) };
  } catch {
    return null;
  }
}

function getRelativePath(absPath) {
  return path.relative(ONEDRIVE_ROOT, absPath).replace(/\\/g, '/');
}

function getAssetDescription(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const labels = {
    '.pdf': 'PDF document', '.docx': 'Word document', '.doc': 'Word document',
    '.xlsx': 'Excel spreadsheet', '.xls': 'Excel spreadsheet', '.csv': 'CSV data',
    '.pptx': 'PowerPoint', '.ppt': 'PowerPoint',
    '.png': 'Image (PNG)', '.jpg': 'Image (JPEG)', '.jpeg': 'Image (JPEG)',
    '.svg': 'Vector image (SVG)', '.gif': 'Image (GIF)',
    '.step': 'CAD file (STEP)', '.iges': 'CAD file (IGES)', '.fcstd': 'FreeCAD file',
    '.x_t': 'CAD file (Parasolid)', '.oas': 'OASIS layout',
    '.zip': 'Archive (ZIP)', '.7z': 'Archive (7z)',
  };
  const label = labels[ext] || 'File';
  try {
    const stat = fs.statSync(filePath);
    const size = stat.size;
    const sizeStr = size < 1024 ? `${size} B`
      : size < 1024 * 1024 ? `${(size / 1024).toFixed(0)} KB`
      : `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${label} (${sizeStr})`;
  } catch {
    return label;
  }
}

// Folder + file-type categorization (config-driven). Returns the new two-axis
// shape; we also synthesize a legacy `category` string so older code paths
// (e.g. theme hide lists, useHierarchyData) keep working until they're migrated.
//
// For files we categorize by their *parent directory's* relPath, not the file's
// own. Otherwise the file's basename would leak into folderSubCat
// (e.g. `__Projects/README.md` would yield subCat='README.md' and pollute the
// legend; root-level CLAUDE.md / STATE.md would fail to match MOT entirely).
function tagNode(relPath, { isDirectory = false, filename = null } = {}) {
  const pathForCategory = isDirectory
    ? (relPath || '')
    : (relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '');
  const { folderCat, folderSubCat } = categorizeFolder(pathForCategory);
  const fileType = isDirectory ? null : categorizeFile(filename ?? path.basename(relPath));
  const legacyCategory = folderSubCat || folderCat || fileType || 'unknown';
  return { folderCat, folderSubCat, fileType, category: legacyCategory };
}

// --- Directory walker ---

/**
 * Walk all directories under absRoot.
 * Returns [{ absPath, relPath, depth, parentRelPath }] for every directory found,
 * including the root itself (relPath = '').
 */
async function walkDirectories(absRoot, excludes, maxDepth = 8) {
  const results = [];

  async function walk(absDir, relDir, depth) {
    results.push({ absPath: absDir, relPath: relDir, depth, parentRelPath: relDir.includes('/') ? relDir.split('/').slice(0, -1).join('/') : (relDir ? '' : null) });

    if (depth >= maxDepth) return;

    let entries;
    try {
      entries = await fsp.readdir(absDir, { withFileTypes: true });
    } catch { return; }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (excludes.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.claude') continue;
      // At root (depth 0) only descend into known top-level entries (<prefix>X, .claude)
      // so we don't pull Apps/, Desktop/, Microsoft Teams Chat Files/, etc. into the graph.
      // Prefix is config-driven (ROOT_FOLDER_PREFIX, default "__").
      if (depth === 0 && !isTopLevelIncluded(entry.name, ROOT_FOLDER_PREFIX)) continue;

      const childAbs = path.join(absDir, entry.name);
      const childRel = relDir ? `${relDir}/${entry.name}` : entry.name;
      // Path-based exclusion (raw artifact subtrees — see categories.js).
      if (isPathExcluded(childRel)) continue;
      await walk(childAbs, childRel, depth + 1);
    }
  }

  await walk(absRoot, '', 0);
  return results;
}

// --- Graph build (async — runs in the background, never on the request path) ---
async function buildGraph() {
  const nodes = [];
  const edges = [];

  // 1. Walk all directories from root
  const dirs = await walkDirectories(WALKER_CONFIG.root, WALKER_CONFIG.excludes, WALKER_CONFIG.maxDepth);

  // 2. Create a node per directory + containment edge to parent
  for (const { absPath, relPath, depth, parentRelPath } of dirs) {
    const name = relPath ? path.basename(relPath) : DISPLAY_NAME;
    const displayName = relPath === '' ? DISPLAY_NAME : name;

    nodes.push({
      id: relPath === '' ? '.' : relPath,
      name: displayName,
      ...tagNode(relPath, { isDirectory: true }),
      type: 'directory',
      depth,
    });

    // Containment edge to parent (root has no parent)
    if (parentRelPath !== null) {
      const sourceId = parentRelPath === '' ? '.' : parentRelPath;
      const targetId = relPath === '' ? '.' : relPath;
      edges.push({ source: sourceId, target: targetId, type: 'contains' });
    }

    // 3. Files in this directory become nodes: .md → document nodes (with
    //    frontmatter/edges), other content files → lightweight asset nodes.
    let entries;
    try { entries = await fsp.readdir(absPath, { withFileTypes: true }); } catch { continue; }

    const dirNodeId = relPath === '' ? '.' : relPath;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fileRel = relPath ? `${relPath}/${entry.name}` : entry.name;
      const archived = (/(^|\/)_superseded(\/|$)/.test(fileRel) || /(^|\/)legacy(\/|$)/i.test(fileRel)) || null;

      if (entry.name.endsWith('.md')) {
        // Skip machine-specific artifacts (e.g. _catalog-METAOPTICS10.md)
        if (/-[A-Z0-9]+\.md$/.test(entry.name) &&
            (entry.name.startsWith('_catalog') || entry.name.startsWith('CLAUDE'))) continue;
        // Skip _catalog.md folder indexes — they're generated by mot-walker for browsing,
        // not authored content. Including them inflates the graph with one node per folder
        // and double-counts everything they list as `references`.
        if (entry.name === '_catalog.md') continue;

        const fileAbs = path.join(absPath, entry.name);
        const parsed = await parseFrontmatter(fileAbs);
        if (!parsed) continue;

        // Display name for well-known files
        let fileDisplayName = entry.name;
        if (fileRel === 'CLAUDE.md') fileDisplayName = 'CLAUDE';

        nodes.push({
          id: fileRel,
          name: fileDisplayName,
          description: parsed.frontmatter.description || '',
          ...tagNode(fileRel, { isDirectory: false, filename: entry.name }),
          type: 'file',
          tags: parsed.frontmatter.tags || [],
          // Surface convention flags for agent-friendly index responses.
          // `agent_read: avoid` tells consumers to prefer targeted reads (Read --offset/--limit, Grep)
          // or the named extractor over a full file read. See CLAUDE.md "Avoid-read convention".
          agent_read: parsed.frontmatter.agent_read || null,
          agent_read_extractor: parsed.frontmatter.agent_read_extractor || null,
          supply_chain_role: parsed.frontmatter.supply_chain_role || null,
          // Lifecycle axis (Supersession & Freshness system — Standards/Status_Lifecycle.md).
          // `status`/`context` come from frontmatter; `archived` is derived from a
          // _superseded/ or legacy/ folder segment. The frontend default-hides these
          // and reveals them (greyed) via the History toggle.
          status: parsed.frontmatter.status || null,
          context: parsed.frontmatter.context || null,
          archived,
        });

        edges.push({ source: dirNodeId, target: fileRel, type: 'contains' });

        // Cross-reference edges from frontmatter.references
        const { frontmatter } = parsed;
        if (Array.isArray(frontmatter.references)) {
          for (const ref of frontmatter.references) {
            if (!ref.path) continue;
            const targetPath = ref.path.replace(/\\/g, '/');
            const refType = ref.type || 'references';
            edges.push({ source: fileRel, target: targetPath, type: refType });
          }
        }
      } else {
        // Non-markdown asset (PDF, slides, spec, CAD, …). Only content types are
        // surfaced; the raw __temp archive is excluded (its .md summaries suffice).
        const fileType = categorizeFile(entry.name);
        if (!ASSET_NODE_TYPES.has(fileType)) continue;
        if (fileRel.startsWith('__temp/')) continue;

        nodes.push({
          id: fileRel,
          name: entry.name,
          description: '',
          ...tagNode(fileRel, { isDirectory: false, filename: entry.name }),
          type: 'file',
          isAsset: true,
          tags: [],
          agent_read: null,
          agent_read_extractor: null,
          supply_chain_role: null,
          status: null,
          context: null,
          archived,
        });
        edges.push({ source: dirNodeId, target: fileRel, type: 'contains' });
      }
    }
  }

  // 4. Prune directory nodes with no .md descendants — they carry no information
  // and were the bulk of the node count (empty folder chains under __Projects etc.).
  // A directory survives iff it is an ancestor of at least one file node (or root).
  const fileAncestorDirs = new Set(['.']);
  for (const node of nodes) {
    if (node.type !== 'file') continue;
    const segs = node.id.split('/');
    for (let i = 1; i < segs.length; i++) {
      fileAncestorDirs.add(segs.slice(0, i).join('/'));
    }
  }
  const keptNodes = nodes.filter(n => n.type !== 'directory' || fileAncestorDirs.has(n.id));

  // 5. Remove dangling edges (also drops contains-edges to pruned directories)
  const nodeIds = new Set(keptNodes.map(n => n.id));
  const finalEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  // `node.name` stays the plain basename. (A former "disambiguate duplicate
  // display names by prefixing the parent folder" pass was removed 2026-06-20:
  // the graph's only consumer, TreeGraph, derives labels from the id basename
  // and ignores `name`, while the prefixing silently broke SkillTiles'
  // `name === 'Overview.md'` project filter.)
  return { nodes: keptNodes, edges: finalEdges };
}

// --- Rebuild orchestration ---
// Rebuilds run at most one at a time; a change arriving mid-rebuild queues
// exactly one follow-up. Requests always serve the existing cache immediately.
function startRebuild() {
  if (rebuildPromise) { rebuildQueued = true; return rebuildPromise; }
  rebuildPromise = (async () => {
    try {
      const t0 = Date.now();
      const graph = await buildGraph();
      const graphNodeIds = new Set(graph.nodes.map(n => n.id));
      const tree = await buildTreeNode(WALKER_CONFIG.root, '', graphNodeIds);
      tree.name = DISPLAY_NAME;
      graphCache = graph;
      treeCache = tree;
      cacheBuiltAt = Date.now();
      console.log(`Graph rebuilt: ${graph.nodes.length} nodes, ${graph.edges.length} edges in ${((cacheBuiltAt - t0) / 1000).toFixed(1)}s`);
    } catch (err) {
      console.error('Graph rebuild failed:', err);
    } finally {
      rebuildPromise = null;
      lastRebuildEnd = Date.now();
      if (rebuildQueued) { rebuildQueued = false; scheduleRebuild(); }
    }
  })();
  return rebuildPromise;
}

let rebuildTimer = null;
let lastRebuildEnd = 0;
// Debounce 3 s after the last change, but never start rebuilds more often than
// once per minute — mass file operations (reorganisations, OneDrive sync churn)
// otherwise produce dozens of back-to-back 20 s rebuilds.
const MIN_REBUILD_GAP_MS = 60 * 1000;
function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  const wait = Math.max(3000, MIN_REBUILD_GAP_MS - (Date.now() - lastRebuildEnd));
  rebuildTimer = setTimeout(() => startRebuild(), wait);
}

// Watch the whole drive for relevant changes (md files and directory ops).
// On watcher failure we degrade to a 5-minute stale-while-revalidate TTL.
try {
  const watcher = fs.watch(ONEDRIVE_ROOT, { recursive: true }, (_event, filename) => {
    if (!filename) return scheduleRebuild();
    const rel = filename.replace(/\\/g, '/');
    const segs = rel.split('/');
    if (segs.some(s => SHARED_EXCLUDED_DIRS.has(s))) return;
    if (isPathExcluded(rel)) return;
    const base = segs[segs.length - 1];
    if (base === '_catalog.md') return;
    // md files affect the graph; extension-less names are (likely) directories
    if (base.endsWith('.md') || !base.includes('.')) scheduleRebuild();
  });
  watcher.on('error', () => { watcherHealthy = false; });
  watcherHealthy = true;
} catch {
  watcherHealthy = false;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
function maybeBackgroundRefresh() {
  if (!watcherHealthy && Date.now() - cacheBuiltAt > CACHE_TTL_MS) startRebuild();
}

app.get('/api/graph', async (_req, res) => {
  if (!graphCache) await startRebuild();
  maybeBackgroundRefresh();
  res.json(graphCache);
});

// --- Tree endpoint ---
async function buildTreeNode(absPath, relPath, graphNodeIds) {
  const stat = await fsp.stat(absPath);
  const name = path.basename(absPath) || relPath;

  if (!stat.isDirectory()) {
    const isMd = name.endsWith('.md');
    const hasGraph = graphNodeIds.has(relPath);
    const tags = hasGraph ? tagNode(relPath, { isDirectory: false, filename: name }) : null;
    return {
      name,
      path: relPath,
      type: 'file',
      hasGraph,
      // Legacy `category` field kept for FileTree's color dot until it migrates.
      category: tags ? tags.category : null,
      folderCat: tags?.folderCat ?? null,
      folderSubCat: tags?.folderSubCat ?? null,
      fileType: tags?.fileType ?? null,
      isAsset: hasGraph && !isMd ? true : undefined,
    };
  }

  // Directory — collapse if it has too many direct children
  let dirEntries = null;
  try { dirEntries = await fsp.readdir(absPath, { withFileTypes: true }); } catch { /* ignore */ }
  if (dirEntries && dirEntries.length > WALKER_CONFIG.largeThreshold) {
    return { name, path: relPath, type: 'directory', collapsed: true, fileCount: dirEntries.length, children: [] };
  }

  try {
    const entries = dirEntries || [];
    const children = [];

    for (const entry of entries) {
      // Skip hidden/backup dirs at top level, and non-md files we don't care about
      if (entry.name.startsWith('__backup')) continue;
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      // At the drive root, hide folders outside the top-level prefix convention
      // (Apps/, Desktop/, Pictures/, etc.) so the tree mirrors what the graph
      // walker accepts. Prefix is config-driven (ROOT_FOLDER_PREFIX, default "__").
      if (relPath === '' && !isTopLevelIncluded(entry.name, ROOT_FOLDER_PREFIX)) continue;

      const childAbs = path.join(absPath, entry.name);
      const childRel = relPath ? `${relPath}/${entry.name}` : entry.name;
      // Path-based exclusion — same scope as the graph walker.
      if (isPathExcluded(childRel)) continue;

      if (entry.isDirectory()) {
        children.push(await buildTreeNode(childAbs, childRel, graphNodeIds));
      } else if (entry.name.endsWith('.md')) {
        children.push(await buildTreeNode(childAbs, childRel, graphNodeIds));
      } else if (graphNodeIds.has(childRel)) {
        // Non-.md file referenced in the graph — include as asset
        const tags = tagNode(childRel, { isDirectory: false, filename: entry.name });
        children.push({
          name: entry.name,
          path: childRel,
          type: 'file',
          hasGraph: true,
          category: tags.fileType || tags.category,
          folderCat: tags.folderCat,
          folderSubCat: tags.folderSubCat,
          fileType: tags.fileType,
          isAsset: true,
        });
      }
    }

    // Sort: dirs first, then files alphabetically
    children.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });

    return { name, path: relPath, type: 'directory', children };
  } catch {
    return { name, path: relPath, type: 'directory', children: [] };
  }
}

app.get('/api/tree', async (_req, res) => {
  if (!treeCache) await startRebuild();
  maybeBackgroundRefresh();
  res.json(treeCache);
});

// --- Data layer (Stage A) — derived JSON written by the instance's kb-* extractors ---
// Serves <dataDir>/{projects,entities,drift,contacts,sync,todos,events}.json.
// Core tabs' JSON comes from the shipped kb-* tools (kb-extract/kb-entities/
// kb-audit/kb-contacts); plugin tabs (Sync/To-dos/Events/Assignments) need an
// instance-supplied extractor. Markdown stays the source of truth. If a JSON is
// absent the tab renders a graceful "no data source configured" empty state
// (see DATA_CONTRACT.md) rather than crashing. The data dir is config-driven
// (instance.config dataDir); default is the MOT-style Dashboard/data location.
const DATA_DIR_REL = INSTANCE_CONFIG.dataDir || '__Operations/Dashboard/data';
const DATA_DIR = path.join(ONEDRIVE_ROOT, ...DATA_DIR_REL.split('/'));
app.use('/api/data', express.static(DATA_DIR));

// --- Assignment overlay — durable human edits to to-do tasks ---
// todos.json is a read-only projection of the weekly Action Items markdown
// (the agent's initial assignment). The dashboard lets a human reassign (drag),
// resolve, delete, or create tasks; every such edit is recorded here, keyed by
// the stable task id, NOT written back into todos.json — so it survives the next
// `extract`. Each entry carries propagated:false until the /mot-sync propagation
// step folds it into the source markdown and flips it true.
//
// An entry is a *delta* over the base task: it only exists while it represents a
// real change. Reverting every field back to the base (move back to origin,
// un-resolve, un-delete) prunes the entry, so the overlay never accumulates no-ops.
const ASSIGNMENTS_PATH = path.join(DATA_DIR, 'assignments.json');

// Stable task id from text — MUST match mot-tools.js taskId() so a dashboard-
// created task lines up with its markdown line once propagation writes it out.
function taskId(text) {
  const norm = String(text).toLowerCase().replace(/\s+/g, ' ').trim();
  return 't_' + crypto.createHash('sha1').update(norm).digest('hex').slice(0, 12);
}

// Overlay is WEEK-SCOPED: { version:2, updated_at, weeks: { <YYYYMMDD>: {
//   published:false, edits: { <id>: entry } } } }. Each edit is tagged to the
// week it was made in, so rolling the report forward never disturbs a past
// week's record (done tasks stay green in their own week; they simply aren't
// carried into the next). Removal is publish-gated, not immediate.
function emptyStore() { return { version: 2, updated_at: null, weeks: {} }; }

function readAssignments() {
  try {
    const parsed = JSON.parse(fs.readFileSync(ASSIGNMENTS_PATH, 'utf-8'));
    if (parsed && parsed.weeks) return parsed;        // already v2
    return emptyStore();                              // v1 (only ever empty in practice) → fresh v2
  } catch {
    return emptyStore();
  }
}

function writeAssignments(obj) {
  const dir = path.dirname(ASSIGNMENTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = ASSIGNMENTS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf-8');
  fs.renameSync(tmp, ASSIGNMENTS_PATH);
}

app.get('/api/assignments', (_req, res) => {
  res.json(readAssignments());
});

// Apply one edit (op) to a week's edit map and prune it if it ends up a no-op.
// Body fields: { week (required), id?, text?, from, to, status, created, deleted, dismissed }.
//   - reassign : { week, id, text, from, to }
//   - resolve  : { week, id, text, status:'done' }   (status:'open' to un-resolve)
//   - delete   : { week, id, text, deleted:true }     (deleted:false to restore)
//   - dismiss  : { week, id, text, dismissed:true }   — step-2 confirm: off the current report now
//                (send status:'open', deleted:false, dismissed:false to fully restore)
//   - create   : { week, text, to, created:true }     — server mints the id from text
// `from` is the agent's original owner, kept for the propagation diff. An entry
// is pruned when it carries no change vs. the base (open, not deleted, not
// created, and to===from), so reverting an edit cleanly removes the flag.
function applyOp(edits, op) {
  const id = op.id || (op.created ? taskId(op.text) : null);
  if (!id) return { error: 'id or (created+text) required' };

  const cur = edits[id] || {};
  const merged = {
    id,
    text: op.text ?? cur.text ?? '',
    from: op.from ?? cur.from ?? null,
    to: op.to ?? cur.to ?? null,
    status: op.status ?? cur.status ?? 'open',
    created: op.created ?? cur.created ?? false,
    deleted: op.deleted ?? cur.deleted ?? false,
    dismissed: op.dismissed ?? cur.dismissed ?? false,   // step-2 confirm → off the current report now
    movedAt: new Date().toISOString(),
    propagated: false,                       // any edit re-opens the propagation debt
  };

  // Deleted tasks persist (shown red on the board, dropped at the next publish) —
  // including created ones, so a delete is uniformly reversible until rollover.
  // Dismissed tasks are confirmed off the current report (hidden, recoverable via "show removed").
  const isNoop = !merged.created && !merged.deleted && !merged.dismissed && merged.status === 'open' && merged.to === merged.from;
  if (isNoop) { delete edits[id]; return { id, removed: true }; }

  edits[id] = merged;
  return { id, entry: merged };
}

app.post('/api/assignments', (req, res) => {
  const op = req.body || {};
  if (!op.week) return res.status(400).json({ error: 'week required' });
  if (!op.id && !(op.created && op.text)) {
    return res.status(400).json({ error: 'id, or (created + text), required' });
  }
  const store = readAssignments();
  const bucket = store.weeks[op.week] || (store.weeks[op.week] = { published: false, edits: {} });
  const result = applyOp(bucket.edits, op);
  if (result.error) return res.status(400).json({ error: result.error });
  store.updated_at = new Date().toISOString();
  try {
    writeAssignments(store);
    res.json({ ok: true, id: result.id, store });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Contacts register CRUD (writes the contact register .md, then re-extracts) ---
// The markdown table stays the source of truth — a PERSON-schema table (canonical
// columns: Name, Company, Title, Flag, Last contact, Owner, Email, Phone, Context,
// Linked project, Notes). No Role/Vertical/Status columns: company axes are derived
// and status is computed at extract time. add/edit rewrite the row; archive is a
// SOFT delete (Flag -> archived, row kept). The register path is manifest-driven
// (contact_register.path); default falls back to the canonical location. After every
// write the endpoint re-runs the instance's `extract` plugin script (PLUGIN_SCRIPTS.extract)
// so data/contacts.json refreshes — if no extract plugin is configured the write still
// lands but the re-extract is skipped (documented in the endpoint).
const CONTACTS_REGISTER_REL =
  (INSTANCE_CONFIG.contactRegister && INSTANCE_CONFIG.contactRegister.path) ||
  '__Sales/Contacts/Contacts.md';
const CONTACTS_MD_PATH = path.join(ONEDRIVE_ROOT, ...CONTACTS_REGISTER_REL.split('/'));

function readContactsTable() {
  const raw = fs.readFileSync(CONTACTS_MD_PATH, 'utf-8');
  const lines = raw.split(/\r?\n/); // tolerate CRLF — a stray \r breaks the trailing-pipe strip
  const hidx = lines.findIndex(l => /^##\s+Contacts\s*$/.test(l));
  if (hidx < 0) throw new Error('"## Contacts" heading not found');
  const head = lines.slice(0, hidx + 1).join('\n');
  const tableLines = lines.slice(hidx + 1).filter(l => l.trim().startsWith('|'));
  if (tableLines.length < 2) throw new Error('contacts table not found');
  const cols = tableLines[0].replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
  const rows = tableLines.slice(2).map(l => {
    const vals = l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    const o = {}; cols.forEach((c, i) => { o[c] = vals[i] ?? '—'; }); return o;
  });
  return { head, cols, rows };
}
const contactCell = s => String(s == null ? '' : s).replace(/\r?\n/g, ' ').replace(/\|/g, '/').trim() || '—';
function writeContactsTable(head, cols, rows) {
  const out = [head, '', '| ' + cols.join(' | ') + ' |', '|' + cols.map(() => '------').join('|') + '|'];
  for (const r of rows) out.push('| ' + cols.map(c => r[c] ?? '—').join(' | ') + ' |');
  const tmp = CONTACTS_MD_PATH + '.tmp';
  fs.writeFileSync(tmp, out.join('\n') + '\n', 'utf-8');
  fs.renameSync(tmp, CONTACTS_MD_PATH);
}

// --- Contact photos (optional per-person override of the default company logo) ---
// Stored as <register-dir>/photos/<email-slug>.jpg (already cropped+scaled to a
// square by the client). Upload replaces; DELETE resets to the company logo. The
// photo is NOT in contacts.json — the UI fetches it by email and falls back to the
// company logo (then monogram) on 404, so no re-extract is needed on change.
// Location derives from the manifest-driven register path (its sibling photos/ dir).
const CONTACTS_PHOTO_DIR = path.join(path.dirname(CONTACTS_MD_PATH), 'photos');
const photoSlug = email => String(email || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const photoPath = email => path.join(CONTACTS_PHOTO_DIR, photoSlug(email) + '.jpg');

app.get('/api/contact-photo', (req, res) => {
  const email = String(req.query.email || '');
  if (!email) return res.status(400).end();
  const p = photoPath(email);
  if (!photoSlug(email) || !fs.existsSync(p)) return res.status(404).end();
  res.type('jpeg');
  fs.createReadStream(p).pipe(res);
});

app.post('/api/contact-photo', (req, res) => {
  const { email, dataUrl } = req.body || {};
  if (!email || !dataUrl) return res.status(400).json({ error: 'email + dataUrl required' });
  const m = /^data:image\/(?:png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) return res.status(400).json({ error: 'dataUrl must be a base64 png/jpeg/webp image' });
  try {
    fs.mkdirSync(CONTACTS_PHOTO_DIR, { recursive: true });
    fs.writeFileSync(photoPath(email), Buffer.from(m[1], 'base64')); // overwrite = replace
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.delete('/api/contact-photo', (req, res) => {
  const p = photoPath(String(req.query.email || ''));
  try { if (fs.existsSync(p)) fs.unlinkSync(p); res.json({ ok: true }); } // reset -> company logo
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.post('/api/contacts', (req, res) => {
  const b = req.body || {};
  const op = b.op;
  if (!['add', 'edit', 'archive'].includes(op)) return res.status(400).json({ error: 'op must be add|edit|archive' });
  let table;
  try { table = readContactsTable(); } catch (e) { return res.status(500).json({ error: e.message }); }
  const { head, cols, rows } = table;
  const emailKey = String(b.email || (b.contact && b.contact.Email) || '').trim().toLowerCase();
  const findRow = () => (emailKey ? rows.find(r => (r['Email'] || '').trim().toLowerCase() === emailKey) : null);

  if (op === 'add') {
    const c = b.contact || {};
    if (!c.Name && !c.Email) return res.status(400).json({ error: 'Name or Email required' });
    if (emailKey && findRow()) return res.status(409).json({ error: 'a contact with that email already exists' });
    const row = {}; cols.forEach(col => { row[col] = contactCell(c[col]); });
    rows.push(row);
  } else {
    const row = findRow();
    if (!row) return res.status(404).json({ error: 'contact not found (matched by email)' });
    if (op === 'archive') {
      if (!cols.includes('Flag')) return res.status(500).json({ error: 'contact register has no Flag column — add it to the register header first' });
      row['Flag'] = 'archived';
    } else { const c = b.contact || {}; for (const col of cols) if (c[col] !== undefined) row[col] = contactCell(c[col]); }
  }
  try { writeContactsTable(head, cols, rows); } catch (e) { return res.status(500).json({ error: e.message }); }
  // Re-derive contacts.json via the instance's extract plugin (PLUGIN_SCRIPTS.extract,
  // set by kb-dashboard-config from the manifest). Absent → the write still landed;
  // report ok with a note so the register isn't left un-refreshed silently.
  const extractScript = PLUGIN_SCRIPTS.extract;
  if (!extractScript) {
    scheduleRebuild();
    return res.json({ ok: true, note: 'saved; no extract plugin configured — run your data-layer extractor to refresh contacts.json' });
  }
  const scriptPath = path.join(ONEDRIVE_ROOT, ...String(extractScript).split('/'));
  exec(`node "${scriptPath}" extract`, { cwd: ONEDRIVE_ROOT, windowsHide: true, timeout: 60000 }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ ok: false, error: `saved, but extract failed: ${(stderr || err.message || '').trim()}` });
    scheduleRebuild();
    res.json({ ok: true });
  });
});

// --- Literature database (sidecar .md frontmatter under the literature root) ---
// One JSON payload for the Literature tab: every Papers/ + Patents/ sidecar
// parsed into a flat record (frontmatter + body summary). Cached 60 s; the
// markdown sidecars stay the source of truth. The literature root is config-driven
// (instance.config literatureDir); default "__Literature". Absent → empty payload
// (the tab renders a graceful "no matches" state), never a crash.
const LITERATURE_DIR_REL = INSTANCE_CONFIG.literatureDir || '__Literature';
let litCache = { data: null, builtAt: 0 };
app.get('/api/literature', (req, res) => {
  const now = Date.now();
  if (litCache.data && now - litCache.builtAt < 60_000 && !req.query.refresh) {
    return res.json(litCache.data);
  }
  try {
    const papers = [];
    for (const folder of ['Papers', 'Patents']) {
      const dir = path.join(ONEDRIVE_ROOT, ...LITERATURE_DIR_REL.split('/'), folder);
      if (!fs.existsSync(dir)) continue;
      for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.md') || name === '_catalog.md') continue;
        try {
          const raw = fs.readFileSync(path.join(dir, name), 'utf-8');
          const parsed = matter(raw);
          const fm = parsed.data || {};
          const base = name.replace(/\.md$/, '');
          const pdfRel = `${LITERATURE_DIR_REL}/${folder}/${base}.pdf`;
          papers.push({
            id: `${LITERATURE_DIR_REL}/${folder}/${name}`,
            pdf: fs.existsSync(path.join(dir, `${base}.pdf`)) ? pdfRel : null,
            folder,
            title: fm.title || base,
            authors: fm.authors || [],
            journal: fm.journal || null,
            year: fm.year || null,
            doi: fm.doi || null,
            type: fm.type || (folder === 'Patents' ? 'patent' : 'paper'),
            categories: fm.categories || [],
            tags: fm.tags || [],
            description: fm.description || '',
            summary: (parsed.content || '').trim(),
            supplement_files: fm.supplement_files || [],
            metadata_source: fm.metadata_source || null,
            patent_number: fm.patent_number || null,
            assignee: fm.assignee || null,
          });
        } catch { /* skip unparseable sidecar */ }
      }
    }
    papers.sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title));
    litCache = { data: { generated_at: new Date().toISOString(), count: papers.length, papers }, builtAt: now };
    res.json(litCache.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Asset file serving (images, PDFs, etc.) ---
app.get('/api/asset', (req, res) => {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: 'path required' });
  const absPath = path.join(ONEDRIVE_ROOT, relPath);
  if (!isInsideRoot(absPath)) return res.status(403).json({ error: 'forbidden' });
  if (!fs.existsSync(absPath)) return res.status(404).json({ error: 'not found' });
  res.sendFile(absPath);
});

// --- Explorer integration ---
app.post('/api/explorer', (req, res) => {
  const relPath = req.body.path;
  if (!relPath) return res.status(400).json({ error: 'path required' });

  const absPath = path.join(ONEDRIVE_ROOT, relPath);
  if (!isInsideRoot(absPath)) return res.status(403).json({ error: 'forbidden' });

  exec(`explorer.exe /select,"${absPath}"`, (err) => {
    if (err && err.code !== 1) {
      // explorer.exe returns exit code 1 even on success sometimes
      return res.status(500).json({ error: 'failed to open explorer' });
    }
    res.json({ ok: true });
  });
});

// --- Open in VS Code ---
app.post('/api/vscode', (req, res) => {
  const relPath = req.body.path;
  if (!relPath) return res.status(400).json({ error: 'path required' });

  const absPath = path.join(ONEDRIVE_ROOT, relPath);
  if (!isInsideRoot(absPath)) return res.status(403).json({ error: 'forbidden' });

  // Windows: use code.cmd (code resolves to node in exec), forward slashes for paths
  const fwdPath = absPath.replace(/\\/g, '/');
  exec(`code.cmd "${fwdPath}"`, (err) => {
    if (err) return res.status(500).json({ error: 'failed to open VS Code' });
    res.json({ ok: true });
  });
});

// --- Render weekly operations sync to PDF ---
// PLUGIN endpoint: the Sync-to-PDF renderer is an instance extractor (MOT's
// sync-report-pdf.js). Wired via PLUGIN_SCRIPTS.syncPdf (kb-dashboard-config, from
// the manifest). No plugin configured → 501 "instance extractor not configured".
app.post('/api/render-pdf', (req, res) => {
  const pdfScript = PLUGIN_SCRIPTS.syncPdf;
  if (!pdfScript) {
    return res.status(501).json({
      ok: false,
      error: 'instance extractor not configured: the Sync-to-PDF renderer is an ' +
        'instance plugin. Set company_profile.contact_register/cadence plugin scripts in ' +
        'your manifest (pluginScripts.syncPdf) and regenerate the dashboard config.',
    });
  }
  const week = req.body && req.body.week;
  // Optional week id; must be YYYYMMDD if provided (defaults to latest week in the script)
  if (week != null && !/^\d{8}$/.test(String(week))) {
    return res.status(400).json({ error: 'week must be YYYYMMDD' });
  }
  const scriptPath = path.join(ONEDRIVE_ROOT, ...String(pdfScript).split('/'));
  const cmd = `node "${scriptPath}"${week ? ` ${week}` : ''}`;
  exec(cmd, { cwd: ONEDRIVE_ROOT, windowsHide: true, timeout: 120000 }, (err, stdout, stderr) => {
    const out = `${stdout || ''}${stderr || ''}`.trim();
    if (err) {
      // exit 2 = rendered but target locked (see sync-report-pdf.js); surface the message
      const locked = err.code === 2 || /EBUSY|EPERM|locked/i.test(out);
      return res.status(locked ? 423 : 500).json({ ok: false, locked, message: out || err.message });
    }
    // Surface the rendered PDF's root-relative path so the UI can open it in the
    // right-hand FileViewer. The script prints "Wrote <relpath>.pdf (NN KB)".
    const m = /Wrote\s+(.+?\.pdf)\s*\(/.exec(out);
    const pdfPath = m ? m[1].replace(/\\/g, '/') : null;
    res.json({ ok: true, message: out, pdfPath });
  });
});

// --- File read/write ---
app.get('/api/files', (req, res) => {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: 'path required' });

  const absPath = path.join(ONEDRIVE_ROOT, relPath);
  if (!isInsideRoot(absPath)) return res.status(403).json({ error: 'forbidden' });
  if (!fs.existsSync(absPath)) return res.status(404).json({ error: 'not found' });

  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) return res.status(400).json({ error: 'path is a directory' });

  const content = fs.readFileSync(absPath, 'utf-8');

  // Parse frontmatter for metadata (return all frontmatter, not just description/references)
  let frontmatter = null;
  try {
    const parsed = matter(content);
    if (parsed.data && Object.keys(parsed.data).length > 0) {
      frontmatter = parsed.data;
    }
  } catch { /* ignore */ }

  res.json({ path: relPath, content, modified: stat.mtime, frontmatter });
});

app.put('/api/files', (req, res) => {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: 'path required' });

  const absPath = path.join(ONEDRIVE_ROOT, relPath);
  if (!isInsideRoot(absPath)) return res.status(403).json({ error: 'forbidden' });
  if (fs.existsSync(absPath) && fs.statSync(absPath).isDirectory()) {
    return res.status(400).json({ error: 'path is a directory' });
  }

  fs.writeFileSync(absPath, req.body.content, 'utf-8');
  // Refresh caches in the background (the watcher also catches this — belt & braces)
  scheduleRebuild();
  res.json({ ok: true, path: relPath });
});

// --- Config discovery ---
// The single place the client learns its instance identity: the on-disk root (for
// "copy full path" / tooltips), the display name shown in the header, and the
// manifest-derived vocab orders + category rules the DataViews facets sort by.
// Everything past root/displayName/sep comes from the manifest-generated
// instance.config.json (tooling/kb-dashboard-config.mjs); absent → empty defaults,
// and the client falls back to its own baked-in shape.
app.get('/api/config', (_req, res) => {
  res.json({
    root: ONEDRIVE_ROOT,
    displayName: DISPLAY_NAME,
    sep: path.sep,
    vocab: INSTANCE_CONFIG.vocab || {},
    categoryRules: INSTANCE_CONFIG.categoryRules || [],
    brand: INSTANCE_CONFIG.brand || {},
  });
});

// --- Skills CRUD ---

app.get('/api/skills', (_req, res) => {
  if (!fs.existsSync(SKILLS_DIR)) return res.json([]);

  // Exclude the mot-walker-generated folder index — it's not a skill (same skip the
  // graph builder applies). Underscore-prefixed files are reserved for generated/index docs.
  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md') && !f.startsWith('_'));
  const skills = files.map(file => {
    const absPath = path.join(SKILLS_DIR, file);
    const parsed = parseFrontmatter(absPath);
    return {
      name: file.replace('.md', ''),
      filename: file,
      description: parsed?.frontmatter?.description || '',
      path: getRelativePath(absPath),
    };
  });
  res.json(skills);
});

app.post('/api/skills', (req, res) => {
  const { name, content } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const filename = name.endsWith('.md') ? name : `${name}.md`;
  const absPath = path.join(SKILLS_DIR, filename);

  if (fs.existsSync(absPath)) return res.status(409).json({ error: 'skill already exists' });

  fs.writeFileSync(absPath, content || `---\ndescription: ""\nreferences: []\n---\n\n# ${name}\n\n`, 'utf-8');
  scheduleRebuild();
  res.json({ ok: true, path: getRelativePath(absPath) });
});

// Skill delete / tags / backups+restore endpoints removed 2026-06-21:
// the Skills tab is inventory + open/edit + create only. Deleting or restructuring
// a skill is done with an agent (file ops), not from the dashboard UI.

// Survive transient filesystem races during mass file operations (a watched
// path vanishing mid-walk, OneDrive locks). Log and keep serving the cache.
process.on('uncaughtException', (err) => console.error('Uncaught exception (continuing):', err));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection (continuing):', err));

const PORT = Number(process.env.PORT) || 3001;
const server = app.listen(PORT, () => {
  console.log(`${DISPLAY_NAME} Dashboard API running on http://localhost:${PORT} (KB_ROOT=${ONEDRIVE_ROOT})`);
  startRebuild(); // warm the graph + tree caches so the first request is instant
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use — is another dashboard instance running? Stop it first.`);
    process.exit(1);
  }
  throw err;
});
