/**
 * Single source of truth for graph categorization.
 *
 * Two independent axes:
 *   1. FOLDER axis — where the file lives. Hierarchical: top-level (`mot`, `projects`, ...)
 *      plus an auto-derived depth-2 sub-category (e.g. `Aquisition` under `projects`).
 *   2. FILE-TYPE axis — what the file is, by extension family (`markdown`, `document`,
 *      `script`, `image`, ...). Flat.
 *
 * A node is hidden iff its folder cat, its folder sub-cat, OR its file type is hidden.
 *
 * Importable from both Node (server.js) and the browser (Vite) — keep this file
 * dependency-free and side-effect-free.
 */

// ============================================================================
// Folder categories — match the top-level __X folders + MOT (root + .claude).
// ----------------------------------------------------------------------------
// Each entry: { id, label, color, visible (default), matchTop(name), deriveSub(relPath, segments), subStyles }
// `matchTop` runs against the depth-1 segment (`'__Projects'`, `'.claude'`, `''` for root).
// `deriveSub` returns the depth-2 segment id (e.g. `'Aquisition'`). Return null to skip sub-grouping.
// `subStyles` provides optional label + color overrides for known sub-ids. Unknown
// sub-ids inherit the parent color and get the raw segment name as label.
// ============================================================================

export const FOLDER_CATEGORIES = [
  {
    // The root + .claude hub. Label/color are neutral in the slice; an instance
    // may rebrand via its manifest. (Color mirrors the theme --accent placeholder.)
    id: 'hub', label: 'Hub', color: '#4b7bd4', visible: true,
    matchTop: (top) => top === '' || top === '.claude',
    deriveSub: (relPath, segs) => {
      if (segs[0] === '.claude' && segs[1] === 'commands') return 'skill';
      return 'hub';
    },
    subStyles: {
      hub:   { label: 'Hub',    color: '#4b7bd4' },
      skill: { label: 'Skills', color: '#3b82f6' },
    },
  },
  {
    id: 'projects', label: 'Projects', color: '#e2a030', visible: true,
    matchTop: (top) => top === '__Projects',
    deriveSub: (_relPath, segs) => segs[1] || null,
    subStyles: {
      Aquisition:    { label: 'Aquisition',    color: '#f472b6' },
      Internal:      { label: 'Internal',      color: '#14b8a6' },
      Collaboration: { label: 'Collaboration', color: '#a78bfa' },
      Documentation: { label: 'Documentation', color: '#facc15' },
      Ongoing:       { label: 'Ongoing',       color: '#14b8a6' },
      Sales:         { label: 'Sales',         color: '#fb923c' },
      Archive:       { label: 'Archive',       color: '#6b7280', visible: false },
    },
  },
  {
    id: 'operations', label: 'Operations', color: '#10b981', visible: false,
    matchTop: (top) => top === '__Operations',
    deriveSub: (_relPath, segs) => segs[1] || null,
    subStyles: {
      Dashboard:     { label: 'Dashboard',     color: '#38bdf8' },
      Documentation: { label: 'Documentation', color: '#84cc16' },
      Scripts:       { label: 'Scripts',       color: '#a78bfa' },
      Stockcount:    { label: 'Stockcount',    color: '#fb923c' },
    },
  },
  {
    id: 'documents', label: 'Documents', color: '#84cc16', visible: false,
    matchTop: (top) => top === '__Documents',
    deriveSub: (_relPath, segs) => segs[1] || null,
    // Example sub-folder styling for a __Documents tree. Unknown sub-folders auto-
    // inherit the parent color + their raw name as label, so an instance can leave
    // this as-is or map its own doc sub-folders here.
    subStyles: {
      Events:    { label: 'Events',    color: '#f472b6' },
      Legal:     { label: 'Legal',     color: '#ef4444' },
      PO:        { label: 'POs',       color: '#22c55e' },
      PR:        { label: 'PR',        color: '#fb923c' },
      Templates: { label: 'Templates', color: '#a3a3a3' },
      images:    { label: 'Images',    color: '#38bdf8' },
    },
  },
  {
    id: 'literature', label: 'Literature', color: '#a3a3a3', visible: false,
    matchTop: (top) => top === '__Literature',
    deriveSub: (_relPath, segs) => segs[1] || null,
    // Topic folders auto-styled (inherit parent color, raw label).
  },
  {
    id: 'organisation', label: 'Organisation', color: '#7c7c7c', visible: false,
    matchTop: (top) => top === '__Organisation',
    deriveSub: (_relPath, segs) => segs[1] || null,
  },
  {
    id: 'sales', label: 'Sales', color: '#fb923c', visible: false,
    matchTop: (top) => top === '__Sales',
    deriveSub: (_relPath, segs) => segs[1] || null,
  },
  {
    id: 'shared', label: 'Shared', color: '#9ca3af', visible: false,
    matchTop: (top) => top === '__shared',
    deriveSub: (_relPath, segs) => segs[1] || null,
  },
  {
    id: 'temp', label: 'Temp', color: '#64748b', visible: false,
    matchTop: (top) => top === '__temp',
    deriveSub: (_relPath, segs) => segs[1] || null,
    subStyles: {
      mails:      { label: 'Mails',      color: '#06b6d4' },
      recordings: { label: 'Recordings', color: '#a78bfa' },
      Junk:       { label: 'Junk',       color: '#737373' },
    },
  },
];

// ============================================================================
// File-type categories — flat, by extension family.
// ----------------------------------------------------------------------------
// Order matters: the first entry whose `exts` includes the file's extension wins.
// `markdown` is listed first so .md beats `data` (which also captures generic txt).
// ============================================================================

export const FILE_TYPES = [
  { id: 'markdown',     label: 'Markdown',      color: '#d1d5db', visible: true,  exts: ['.md'] },
  { id: 'document',     label: 'Documents',     color: '#ef4444', visible: true,  exts: ['.pdf', '.docx', '.doc'] },
  { id: 'spreadsheet',  label: 'Spreadsheets',  color: '#22c55e', visible: true,  exts: ['.xlsx', '.xls', '.csv'] },
  { id: 'presentation', label: 'Presentations', color: '#fb923c', visible: true,  exts: ['.pptx', '.ppt'] },
  { id: 'web',          label: 'Web/HTML',      color: '#e34f26', visible: false, exts: ['.html', '.htm'] },
  { id: 'image',        label: 'Images',        color: '#38bdf8', visible: false, exts: ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.tif', '.tiff', '.bmp', '.webp', '.ico', '.avif'] },
  { id: 'script',       label: 'Scripts',       color: '#a78bfa', visible: false, exts: ['.py', '.pyx', '.js', '.ts', '.jsx', '.tsx', '.ipynb', '.m', '.sh', '.bat', '.ps1'] },
  { id: 'cad',          label: 'CAD',           color: '#f59e0b', visible: true,  exts: ['.step', '.iges', '.fcstd', '.x_t', '.oas', '.zar', '.zda', '.zmx'] },
  { id: 'media',        label: 'Media',         color: '#06b6d4', visible: false, exts: ['.mp4', '.mkv', '.avi', '.wav', '.mp3'] },
  { id: 'archive',      label: 'Archives',      color: '#737373', visible: false, exts: ['.zip', '.7z', '.rar'] },
  { id: 'data',         label: 'Data',          color: '#64748b', visible: false, exts: ['.json', '.txt', '.log', '.dat', '.bin'] },
];

// File-type ids that become clickable nodes in the graph/tree (markdown is always
// included as the backbone; these are the extra "asset" types). Single source of
// truth for server.js `ASSET_NODE_TYPES` and the TreeGraph type-toggle list. New
// types (web/image/script/data) default to hidden via their `visible:false` flag
// above — they exist as nodes but the graph filters them out until toggled on.
export const ASSET_NODE_TYPE_IDS = [
  'document', 'spreadsheet', 'presentation', 'cad', 'web', 'image', 'script', 'data',
];

// ============================================================================
// Helpers — used identically by server (categorizing nodes during graph build)
//           and frontend (filter checks, legend rendering, color lookups).
// ============================================================================

/**
 * Decide whether the walker should descend into a depth-1 root entry.
 * Skips anything that isn't a `<prefix>X` folder, `.claude/`, or a root-level .md.
 *
 * `prefix` is the top-level folder-prefix convention (MOT uses `__`). The
 * framework slice server passes the manifest-configured value so a differently
 * named convention still resolves; defaults to `__` for back-compat.
 */
export function isTopLevelIncluded(name, prefix = '__') {
  if (name === '') return true;                       // root itself
  if (prefix && name.startsWith(prefix)) return true; // __Projects, __Operations, ...
  if (name === '.claude') return true;
  if (name.endsWith('.md')) return true;              // CLAUDE.md, STATE.md at root
  return false;
}

// ============================================================================
// Path-based exclusions — applied AFTER the top-level filter.
// Use for subtrees that hold raw artifacts (email archive, raw transcripts,
// staging junk) which we don't want as graph nodes or tree entries.
// Prefixes must be forward-slash relative paths (no leading `/`).
// ============================================================================
export const EXCLUDE_PATH_PREFIXES = [
  '__temp/Junk',                  // staged-for-deletion artifacts
  '__temp/data',                  // ad-hoc local data dumps
  // NOTE: __temp/mails/ stays in scope — it holds authored mail *summaries*
  // wired into the graph via frontmatter. Meeting summaries moved to
  // __Operations/Documentation/Meeting_Records/ (2026-06-11); __temp/recordings/
  // now only holds raw artifacts + the tracker/QA docs.
];

// Pattern-based path exclusions. Use for sibling raw artifacts that share a
// suffix (e.g. `*_transcript`, `*_frames` folders next to meeting_summaries/).
export const EXCLUDE_PATH_PATTERNS = [
  /^__temp\/recordings\/[^/]+_(?:transcript|frames)(?:\/|$)/,
];

export function isPathExcluded(relPath) {
  if (!relPath) return false;
  for (const prefix of EXCLUDE_PATH_PREFIXES) {
    if (relPath === prefix) return true;
    if (relPath.startsWith(prefix + '/')) return true;
  }
  for (const re of EXCLUDE_PATH_PATTERNS) {
    if (re.test(relPath)) return true;
  }
  return false;
}

/**
 * Resolve a relPath to its (folderCat, folderSubCat) pair. Either may be null
 * if no folder category matches (which shouldn't happen once `isTopLevelIncluded`
 * has filtered the walk).
 */
export function categorizeFolder(relPath) {
  const segs = relPath ? relPath.split('/') : [''];
  const top = segs[0] ?? '';
  for (const cat of FOLDER_CATEGORIES) {
    if (cat.matchTop(top)) {
      const sub = cat.deriveSub ? cat.deriveSub(relPath, segs) : null;
      return { folderCat: cat.id, folderSubCat: sub };
    }
  }
  return { folderCat: null, folderSubCat: null };
}

/** Map a filename to a file-type id (or null if unknown). */
export function categorizeFile(filename) {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = filename.slice(dot).toLowerCase();
  for (const ft of FILE_TYPES) {
    if (ft.exts.includes(ext)) return ft.id;
  }
  return null;
}

/** Quick lookups built from the config. */
export const FOLDER_CAT_BY_ID = Object.fromEntries(FOLDER_CATEGORIES.map(c => [c.id, c]));
export const FILE_TYPE_BY_ID = Object.fromEntries(FILE_TYPES.map(ft => [ft.id, ft]));

/** Resolve display label + color for a (folderCat, folderSubCat) pair. */
export function styleForFolderSub(folderCat, folderSubCat) {
  const cat = FOLDER_CAT_BY_ID[folderCat];
  if (!cat) return { label: folderSubCat || 'unknown', color: '#6b7280' };
  if (!folderSubCat) return { label: cat.label, color: cat.color };
  const override = cat.subStyles?.[folderSubCat];
  return {
    label: override?.label ?? folderSubCat,
    color: override?.color ?? cat.color,
  };
}

/** Sub-cat id used by hidden-sets to disambiguate between top-levels. */
export const subKey = (folderCat, folderSubCat) =>
  folderSubCat ? `${folderCat}.${folderSubCat}` : null;

/** Initial hidden file-type set, derived from the `visible` flags in config. */
export function initialHiddenFileTypes() {
  const out = new Set();
  for (const ft of FILE_TYPES) if (!ft.visible) out.add(ft.id);
  return out;
}
