import React, { useState, useMemo, useCallback, useRef, useLayoutEffect, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import {
  FOLDER_CAT_BY_ID,
  FILE_TYPE_BY_ID,
  FILE_TYPES,
  ASSET_NODE_TYPE_IDS,
  styleForFolderSub,
} from '../config/categories.js';
import { fold, foldTerms, escapeRegExp } from '../config/search.js';
import { resolvePath } from '../utils/paths.js';

// File-type toggles shown in the graph toolbar — the node-able asset types
// (markdown is the always-on backbone, so it isn't listed). Built from config so
// it tracks ASSET_NODE_TYPE_IDS automatically.
const TOGGLEABLE_TYPES = FILE_TYPES.filter(ft => ASSET_NODE_TYPE_IDS.includes(ft.id));

// ============================================================================
// TreeGraph — left-to-right layered "column browser" of the knowledge graph.
//
// Replaces the old force-directed hairball. The folder/file containment tree is
// the backbone: a single ROOT node sits in column 0, its connections fan out in
// column 1, their connections in column 2, and so on (Miller-columns style).
// Selecting a node in column k renders *its* connections in column k+1, so you
// only ever see one node's dependency cone — never the global crosslink mess.
//
// Frontmatter cross-references are attached as extra "children" on the specific
// node they belong to (not as company-to-company links), rendered with a dashed
// style + a direction/type chip. Clicking a cross-link node drills into it just
// like a real subfolder. Double-click (or the info popover's Focus button)
// re-roots the whole view onto that node.
// ============================================================================

const MAX_PER_COL = 400; // hard cap on rendered cards per column (columns scroll)
const SEARCH_LIMIT = 20; // top-N ranked jump-to-node results shown in the dropdown
const ROOT_ID = '.';

function getCSSVar(name, fallback) {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// ---- Colour model: one hue per LAYER, file-type sets the tone --------------
// Each layer (column) gets a single HUE from a cohesive blue→magenta rotation —
// a "theme" per layer, not a full rainbow — so a whole column reads as one
// colour family. Within a layer the file TYPE shifts only the TONE
// (saturation/lightness), never the hue: index docs are the brightest tone,
// folders mid, ordinary files lighter/desaturated, assets the most muted. The
// root hub keeps the brand accent. (Re-rooting re-themes by layer, by design.)

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  const to = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

const INDEX_FILE_RE = /^(Overview|CLAUDE|README|STATE|Timeline)\.md$/i;
function isIndexDoc(node) {
  if (!node || node.type === 'directory') return false;
  const base = node.id.split('/').pop();
  return INDEX_FILE_RE.test(base) || /_Overview\.md$/i.test(base);
}

// Hue per layer: a controlled rotation (blue → indigo → violet → magenta → …),
// a cohesive theme rather than the full spectrum.
const LAYER_HUE_START = 205;
const LAYER_HUE_STEP = 26;
function layerHue(layer) {
  return (LAYER_HUE_START + Math.max(0, layer) * LAYER_HUE_STEP) % 360;
}

// File type → tone (saturation, lightness) within the layer hue. Same hue, the
// type only changes how light/saturated it is so types are distinguishable
// without breaking the per-layer colour family.
function typeTone(node) {
  if (isIndexDoc(node)) return { s: 0.80, l: 0.72 };       // Overview/CLAUDE/… — brightest
  if (node.type === 'directory') return { s: 0.58, l: 0.58 }; // folders — mid, solid
  switch (node.fileType) {
    case 'markdown': return { s: 0.42, l: 0.66 };           // notes — light, soft
    case 'document': return { s: 0.55, l: 0.50 };           // pdf/doc — deep
    case 'presentation': return { s: 0.50, l: 0.58 };       // pptx
    case 'spreadsheet': return { s: 0.52, l: 0.70 };        // xlsx — lightest
    case 'cad': return { s: 0.52, l: 0.46 };                // cad — darkest
    default: return { s: 0.28, l: 0.55 };                   // other assets — muted/greyish
  }
}

function nodeColor(node, layer = 0) {
  if (!node) return '#6b7280';
  if (node.id === ROOT_ID) return getCSSVar('--accent', '#4b7bd4'); // root hub = brand accent
  const { s, l } = typeTone(node);
  return hslToHex(layerHue(layer), s, l);
}

// Human-readable label. Derived from the node id's basename — the server's
// `name` field is unreliable (it carries a multi-segment path for some nodes),
// so we never trust it here. Strips the 8-digit date prefix from project folders.
//
// NOTE: we intentionally do NOT relabel `Overview.md` to its parent folder name.
// In this hierarchical tree the parent folder is already its visible parent, so
// "<Folder>/Overview.md → <Folder>" made every folder look like it contained
// itself (the "reference to itself" report). Files keep their own names.
function nodeLabel(node) {
  if (!node) return '';
  // Root hub: the server sets node.name to the instance display name (from KB_ROOT /
  // the manifest), so trust it here (this is the one node whose name we DO use).
  if (node.id === ROOT_ID) return node.name || 'Hub';
  const base = node.id.split('/').pop();
  if (node.type === 'directory') return base.replace(/^\d{8}\s+/, '');
  if (base === 'Overview.md') return 'Overview';
  if (base.endsWith('_Overview.md')) return base.replace('.md', '');
  if (base === 'Timeline.md') return 'Timeline';
  return base.replace('.md', '').replace('Timeline_', 'TL: ');
}

function categoryLabel(node) {
  if (!node) return '';
  if (node.folderSubCat) return styleForFolderSub(node.folderCat, node.folderSubCat).label;
  if (node.folderCat) return FOLDER_CAT_BY_ID[node.folderCat]?.label || node.folderCat;
  if (node.fileType) return FILE_TYPE_BY_ID[node.fileType]?.label || node.fileType;
  return node.category || 'unknown';
}

export default function TreeGraph({ data, onNodeClick, selectedNodes }) {
  const { openInExplorer, hiddenFileTypes, toggleFileType } = useDashboard();

  const [path, setPath] = useState([ROOT_ID]); // breadcrumb spine: path[0] = root
  const [showRefs, setShowRefs] = useState(true);
  const [showFiles, setShowFiles] = useState(true);
  const [detailId, setDetailId] = useState(null); // node whose details are open in the right panel
  const [search, setSearch] = useState('');
  const [connectors, setConnectors] = useState([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  const [colWidth, setColWidth] = useState(() => {
    const v = Number(typeof localStorage !== 'undefined' && localStorage.getItem('tg-col-width'));
    return v >= 140 && v <= 480 ? v : 240;
  });

  const wrapRef = useRef(null);
  const crumbsRef = useRef(null);
  const cardRefs = useRef(new Map()); // `${col}:${id}` -> element

  // ---- Adjacency maps (built once per graph payload) ----------------------
  const { nodeById, containChildren, outRefs, inRefs, parentOf } = useMemo(() => {
    const nodeById = new Map();
    for (const n of data.nodes) nodeById.set(n.id, n);
    const containChildren = new Map();
    const outRefs = new Map();
    const inRefs = new Map();
    const parentOf = new Map(); // child id → its containment parent id
    const push = (m, k, v) => { const a = m.get(k); if (a) a.push(v); else m.set(k, [v]); };
    for (const e of data.edges) {
      if (e.type === 'contains') {
        push(containChildren, e.source, e.target);
        parentOf.set(e.target, e.source);
      } else {
        const tgt = resolvePath(e.source, e.target);
        push(outRefs, e.source, { target: tgt, type: e.type });
        push(inRefs, tgt, { source: e.source, type: e.type });
      }
    }
    return { nodeById, containChildren, outRefs, inRefs, parentOf };
  }, [data]);

  // Is this file node's TYPE currently toggled off in the toolbar? Directories
  // and markdown (no/own type) are never hidden by this filter.
  const typeHidden = useCallback((n) => n.type === 'file' && n.fileType && hiddenFileTypes.has(n.fileType), [hiddenFileTypes]);

  // Directories that (recursively) contain at least one VISIBLE file given the
  // current type toggles. The server keeps every dir that holds any asset node
  // (so toggling image/script/… on can reveal them), but a dir whose only files
  // are toggled-off types would otherwise show as an empty folder. We prune those
  // client-side — mirroring the server's old "no file descendant → drop" rule, but
  // now reactive to the toggles. `showFiles` is intentionally ignored here: with
  // files hidden you still want to browse the folder skeleton.
  const dirsWithContent = useMemo(() => {
    const keep = new Set();
    for (const n of data.nodes) {
      if (n.type !== 'file' || typeHidden(n)) continue;
      let cur = parentOf.get(n.id);
      while (cur && !keep.has(cur)) { keep.add(cur); cur = parentOf.get(cur); }
    }
    return keep;
  }, [data, typeHidden, parentOf]);

  // Children of a node = containment children (dirs first) + resolved cross-refs.
  const childrenOf = useCallback((id) => {
    const out = [];
    const seen = new Set([id]);
    const contains = [];
    for (const cid of containChildren.get(id) || []) {
      const n = nodeById.get(cid);
      if (!n || seen.has(cid)) continue;
      if (!showFiles && n.type === 'file') continue;
      if (typeHidden(n)) continue;
      if (n.type === 'directory' && !dirsWithContent.has(n.id)) continue; // prune now-empty folders
      seen.add(cid);
      contains.push({ node: n, kind: 'contains' });
    }
    contains.sort((a, b) => {
      const ad = a.node.type === 'directory' ? 0 : 1;
      const bd = b.node.type === 'directory' ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return nodeLabel(a.node).localeCompare(nodeLabel(b.node));
    });
    out.push(...contains);

    // Drop the convention back-link to the node's own containment parent: every
    // .md is required to reference its parent dir, which would otherwise render a
    // redundant column showing the folder you just drilled in from.
    const parent = parentOf.get(id);
    if (parent) seen.add(parent);

    if (showRefs) {
      const refs = [];
      for (const { target, type } of outRefs.get(id) || []) {
        if (seen.has(target)) continue;
        const n = nodeById.get(target);
        if (!n) continue;
        if (!showFiles && n.type === 'file') continue;
        if (typeHidden(n)) continue;
        seen.add(target);
        refs.push({ node: n, kind: 'ref', dir: 'out', type });
      }
      for (const { source, type } of inRefs.get(id) || []) {
        if (seen.has(source)) continue;
        const n = nodeById.get(source);
        if (!n) continue;
        if (!showFiles && n.type === 'file') continue;
        if (typeHidden(n)) continue;
        seen.add(source);
        refs.push({ node: n, kind: 'ref', dir: 'in', type });
      }
      refs.sort((a, b) => nodeLabel(a.node).localeCompare(nodeLabel(b.node)));
      out.push(...refs);
    }
    return out;
  }, [containChildren, outRefs, inRefs, nodeById, parentOf, showRefs, showFiles, typeHidden, dirsWithContent]);

  // ---- Build the columns from the breadcrumb spine ------------------------
  // Cycle elimination (whole-tree): because cross-references are shown in BOTH
  // directions, every edge A→B is otherwise reachable as B-under-A *and*
  // A-under-B — so every reference is a 2-cycle. We enforce a strict tree
  // invariant: a node never appears twice on one path. Any child whose id is
  // already on the spine (an ancestor) is DROPPED, not shown — and counted, so
  // the column can surface "↺ N looped" as feedback without the clutter.
  const visibleChildren = useCallback((parentId, ancestors) => {
    const all = childrenOf(parentId);
    const items = ancestors.size ? all.filter(it => !ancestors.has(it.node.id)) : all;
    return { items, looped: all.length - items.length };
  }, [childrenOf]);

  // How many of a node's direct containment children are hidden by the current
  // type toggles — either a file of a toggled-off type, or a folder pruned because
  // its only descendants are toggled-off types. Surfaced as a column footer so the
  // hiding is discoverable ("you're not missing files, the types are off").
  const hiddenChildCount = useCallback((parentId) => {
    let count = 0;
    for (const cid of containChildren.get(parentId) || []) {
      const n = nodeById.get(cid);
      if (!n) continue;
      if (n.type === 'file' && typeHidden(n)) count++;
      else if (n.type === 'directory' && !dirsWithContent.has(n.id)) count++;
    }
    return count;
  }, [containChildren, nodeById, typeHidden, dirsWithContent]);

  const columns = useMemo(() => {
    const cols = [];
    const root = nodeById.get(path[0]);
    cols.push({ index: 0, parentId: null, items: root ? [{ node: root, kind: 'root' }] : [], looped: 0, hidden: 0 });
    for (let k = 1; k < path.length; k++) {
      const { items, looped } = visibleChildren(path[k - 1], new Set(path.slice(0, k)));
      cols.push({ index: k, parentId: path[k - 1], items, looped, hidden: hiddenChildCount(path[k - 1]) });
    }
    const last = path[path.length - 1];
    const tail = visibleChildren(last, new Set(path.slice(0, path.length)));
    const tailHidden = hiddenChildCount(last);
    if (tail.items.length || tail.looped || tailHidden) cols.push({ index: path.length, parentId: last, items: tail.items, looped: tail.looped, hidden: tailHidden });
    return cols;
  }, [path, visibleChildren, nodeById, hiddenChildCount]);

  // Would expanding `node` (currently rendered in column `colIndex`) reveal any
  // NON-cyclic child? Used to decide whether to show an expand caret — a node
  // whose only links point back to ancestors is a leaf, not expandable.
  const hasVisibleChildren = useCallback((id, colIndex) => {
    const ancestors = new Set(path.slice(0, colIndex));
    return childrenOf(id).some(it => !ancestors.has(it.node.id));
  }, [childrenOf, path]);

  const activeSet = useMemo(() => new Set(path), [path]);

  // ---- Navigation ---------------------------------------------------------
  // Expand a node's direct children into the next column WITHOUT re-rooting.
  // Plain tile clicks land here — purely additive depth, no dialogs.
  const expand = useCallback((colIndex, node) => {
    if (colIndex === 0) return;               // root column: nothing to drill from
    setPath(prev => {
      // Clicking the already-active node in this column collapses everything to its right.
      if (prev[colIndex] === node.id) return prev.slice(0, colIndex + 1);
      // Cycle guard: never push a node that's already an ancestor on the spine.
      if (prev.slice(0, colIndex).includes(node.id)) return prev;
      return [...prev.slice(0, colIndex), node.id];
    });
  }, []);

  // Re-root: the node becomes column 0 and the spine restarts from it.
  const reRoot = useCallback((id) => {
    setPath([id]);
    setTimeout(() => wrapRef.current?.scrollTo({ left: 0, behavior: 'smooth' }), 0);
  }, []);

  // Best file to show in the right-hand details panel for a node. Files open
  // themselves; folders open their Overview.md / README.md (so "Details" on the
  // Bosch folder shows the Bosch overview). Returns null if a folder has no .md.
  const detailsTarget = useCallback((node) => {
    // Every file opens in the right-hand viewer — FileViewer dispatches on the
    // extension (markdown / PDF / HTML / image / JSON / text) and falls back to a
    // metadata card for binaries it can't render (docx/xlsx/pptx/cad).
    if (node.type === 'file') return node.id;
    const kids = containChildren.get(node.id) || [];
    const base = (id) => id.split('/').pop();
    return kids.find(k => /^Overview\.md$/i.test(base(k)))
      || kids.find(k => /_Overview\.md$/i.test(base(k)))
      || kids.find(k => /^README\.md$/i.test(base(k)))
      || kids.find(k => /^CLAUDE\.md$/i.test(base(k)))
      || kids.find(k => base(k).endsWith('.md'))
      || null;
  }, [containChildren]);

  const openDetails = useCallback((colIndex, node) => {
    const target = detailsTarget(node);
    if (!target) return;
    setDetailId(node.id);
    onNodeClick?.({ id: target });
    // The right panel opens and shrinks the graph area — bring the clicked node's
    // LAYER (column) to the right edge so it sits flush beside the reader/viewer
    // instead of being buried under it. Re-run after the panel-open reflow settles
    // (the graph area resizes), so the alignment holds for slow-loading viewers too.
    const align = () => cardRefs.current.get(`${colIndex}:${node.id}`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' });
    setTimeout(align, 60);
    setTimeout(align, 320);
  }, [detailsTarget, onNodeClick]);

  // Persist + apply the column-width preference.
  const handleColWidth = useCallback((w) => {
    setColWidth(w);
    try { localStorage.setItem('tg-col-width', String(w)); } catch { /* ignore */ }
  }, []);

  // ---- SVG connectors -----------------------------------------------------
  // Coordinates are in CONTENT space (offset by scrollLeft/Top), and the SVG is
  // sized to the full scroll extent. That way the overlay scrolls *with* the
  // columns on horizontal scroll instead of staying pinned and drifting.
  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const sx = wrap.scrollLeft, sy = wrap.scrollTop;
    const colorOut = getCSSVar('--graph-edge-references', '#9ca3af');
    const colorContains = '#7c8696'; // brighter than --graph-edge-contains so the backbone reads on the dark bg
    const colorSuper = getCSSVar('--graph-edge-superseded', '#d97706');
    const lines = [];
    for (const col of columns) {
      if (col.index === 0 || !col.parentId) continue;
      const parentEl = cardRefs.current.get(`${col.index - 1}:${col.parentId}`);
      if (!parentEl) continue;
      const pr = parentEl.getBoundingClientRect();
      const x1 = pr.right - wrapRect.left + sx;
      const y1 = pr.top + pr.height / 2 - wrapRect.top + sy;
      for (const item of col.items.slice(0, MAX_PER_COL)) {
        const childEl = cardRefs.current.get(`${col.index}:${item.node.id}`);
        if (!childEl) continue;
        const cr = childEl.getBoundingClientRect();
        // Skip lines whose endpoints are scrolled out of the visible vertical band.
        if (cr.bottom < wrapRect.top || cr.top > wrapRect.bottom) continue;
        const x2 = cr.left - wrapRect.left + sx;
        const y2 = cr.top + cr.height / 2 - wrapRect.top + sy;
        const stale = item.node.status === 'superseded' || item.node.status === 'legacy';
        lines.push({
          x1, y1, x2, y2,
          color: item.kind === 'ref' ? (stale ? colorSuper : colorOut) : colorContains,
          dashed: item.kind === 'ref',
          key: `${col.index}:${item.node.id}`,
        });
      }
    }
    setConnectors(lines);
    // Size the SVG to the COLUMNS' content width, not wrap.scrollWidth — the SVG
    // is position:absolute and so contributes to scrollWidth itself. Reading
    // scrollWidth back into the SVG width creates a feedback loop where the scroll
    // extent only ever grows (never shrinks on collapse), leaving a phantom empty
    // region that the depth auto-scroll then jumps into. The last column's right
    // edge is the true content width.
    const colEls = wrap.querySelectorAll('.tg-col');
    const lastCol = colEls[colEls.length - 1];
    const contentW = lastCol ? lastCol.offsetLeft + lastCol.offsetWidth : wrap.clientWidth;
    setSvgSize({ w: contentW, h: wrap.clientHeight });
  }, [columns]);

  useLayoutEffect(() => { measure(); }, [measure]);
  // Column width changes the layout but not the `columns` array — remeasure.
  useLayoutEffect(() => { measure(); }, [colWidth]);

  // Keep the breadcrumb's horizontal scroll in lockstep with the columns, so the
  // crumb for the layer you're looking at stays in view (it follows the bottom scroll).
  const syncCrumbs = useCallback(() => {
    const wrap = wrapRef.current, c = crumbsRef.current;
    if (!wrap || !c) return;
    const range = c.scrollWidth - c.clientWidth;
    const wrange = wrap.scrollWidth - wrap.clientWidth;
    if (range > 0 && wrange > 0) c.scrollLeft = (wrap.scrollLeft / wrange) * range;
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let raf = null;
    const schedule = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = null; measure(); syncCrumbs(); }); };
    wrap.addEventListener('scroll', schedule, true); // capture → catches per-column scroll
    window.addEventListener('resize', schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(wrap);
    return () => {
      wrap.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [measure, syncCrumbs]);

  // Auto-scroll the columns container (and breadcrumb) right when the spine grows
  // deeper, so the newest layer scrolls into view. Depth is unlimited.
  const depth = path.length;
  const prevDepth = useRef(depth);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (wrap && depth > prevDepth.current) {
      requestAnimationFrame(() => {
        wrap.scrollTo({ left: wrap.scrollWidth, behavior: 'smooth' });
        const c = crumbsRef.current;
        if (c) c.scrollTo({ left: c.scrollWidth, behavior: 'smooth' });
      });
    }
    prevDepth.current = depth;
  }, [depth]);

  // ---- Root search --------------------------------------------------------
  // Folded search index — built once per graph payload, not per keystroke. Each
  // entry caches the display label, basename, full path (all accent-folded), the
  // path depth, and a kind boost so the ranker is a cheap string scan.
  const searchIndex = useMemo(() => data.nodes.map(n => ({
    n,
    label: fold(nodeLabel(n)),
    base: fold(n.id.split('/').pop().replace(/\.md$/i, '')),
    path: fold(n.id),
    depth: n.id.split('/').length,
    boost: (isIndexDoc(n) || n.type === 'directory') ? 15 : 0, // folders/Overviews are the usual jump target
  })), [data]);

  // Relevance-ranked jump-to-node search. The old version pushed the FIRST 14
  // substring hits in raw directory-walk order with no scoring, so typing a
  // project name ("Elsoft") surfaced whatever deep file the walk emitted first
  // and the canonical top-level folder never made the cut. Now we score EVERY
  // match (exact > prefix > word-boundary > label-substring > path-only), boost
  // folders/index-docs and shallower paths, and take the top N. We also respect
  // the Files + Types toggles (per the user's request): with Files off the
  // results are folders-only; type-hidden file nodes never surface.
  const searchResults = useMemo(() => {
    const terms = foldTerms(search);
    if (!terms.length || terms.join('').length < 2) return [];
    const matchers = terms.map(t => ({ t, wb: new RegExp(`(^|[\\s_\\-/\\d])${escapeRegExp(t)}`) }));
    const hits = [];
    for (const e of searchIndex) {
      if (e.n.type === 'file' && !showFiles) continue;
      if (typeHidden(e.n)) continue;
      let score = 0, ok = true;
      for (const { t, wb } of matchers) {
        if (!e.label.includes(t) && !e.path.includes(t)) { ok = false; break; } // every term must hit somewhere
        if (e.label === t || e.base === t) score += 100;
        else if (e.label.startsWith(t) || e.base.startsWith(t)) score += 70;
        else if (wb.test(e.label)) score += 50;
        else if (e.label.includes(t)) score += 30;
        else score += 10; // path-only match
      }
      if (!ok) continue;
      score += e.boost + Math.max(0, 12 - e.depth);
      hits.push({ n: e.n, score });
    }
    hits.sort((a, b) => b.score - a.score || a.n.id.length - b.n.id.length);
    return hits.slice(0, SEARCH_LIMIT).map(h => h.n);
  }, [search, searchIndex, showFiles, typeHidden]);

  return (
    <div className="tg-graph">
      {/* Toolbar: breadcrumb spine + controls */}
      <div className="tg-toolbar">
        <button className="btn btn-sm" onClick={() => reRoot(ROOT_ID)} title="Re-root on the root hub">⌂ Hub</button>
        <div className="tg-crumbs" ref={crumbsRef}>
          {path.map((id, i) => {
            const n = nodeById.get(id);
            return (
              <React.Fragment key={id + i}>
                {i > 0 && <span className="tg-crumb-sep">›</span>}
                <button
                  className={`tg-crumb ${i === path.length - 1 ? 'tg-crumb--active' : ''}`}
                  style={{ '--crumb-color': nodeColor(n, i) }}
                  onClick={() => setPath(prev => prev.slice(0, i + 1))}
                  title={id}
                >
                  {nodeLabel(n) || id}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="tg-toolbar-spacer" />
        <label className={`tg-toggle ${showRefs ? 'tg-toggle--on' : ''}`} title="Show frontmatter cross-references as extra children">
          <input type="checkbox" checked={showRefs} onChange={e => setShowRefs(e.target.checked)} /> Cross-links
        </label>
        <label className={`tg-toggle ${showFiles ? 'tg-toggle--on' : ''}`} title="Show file nodes (off = folders only)">
          <input type="checkbox" checked={showFiles} onChange={e => setShowFiles(e.target.checked)} /> Files
        </label>
        <details className="tg-types" title="Choose which file types appear as nodes">
          <summary className="tg-toggle">
            Types{(() => { const n = TOGGLEABLE_TYPES.filter(ft => !hiddenFileTypes.has(ft.id)).length; return ` (${n})`; })()}
          </summary>
          <div className="tg-types-menu">
            {TOGGLEABLE_TYPES.map(ft => (
              <label key={ft.id} className="tg-types-item">
                <input
                  type="checkbox"
                  checked={!hiddenFileTypes.has(ft.id)}
                  onChange={() => toggleFileType(ft.id)}
                />
                <span className="tg-types-dot" style={{ background: ft.color }} />
                {ft.label}
              </label>
            ))}
          </div>
        </details>
        <label className="tg-width" title="Column width">
          <span>↔</span>
          <input type="range" min={140} max={480} step={10} value={colWidth}
            onChange={e => handleColWidth(Number(e.target.value))} />
        </label>
        <div className="tg-search">
          <input
            type="text"
            placeholder="Jump to node…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && searchResults.length) { reRoot(searchResults[0].id); setSearch(''); }
              else if (e.key === 'Escape') setSearch('');
            }}
          />
          {searchResults.length > 0 && (
            <div className="tg-search-results">
              {searchResults.map(n => {
                const emphasise = n.type === 'directory' || isIndexDoc(n);
                return (
                  <button key={n.id} className="tg-search-hit" onClick={() => { reRoot(n.id); setSearch(''); }} title={n.id}>
                    <span className="tg-dot" style={{ background: nodeColor(n) }} />
                    <span className="tg-search-name" style={emphasise ? { fontWeight: 600 } : undefined}>{nodeLabel(n)}</span>
                    <span className="tg-search-path">{n.id}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Columns + connector overlay */}
      <div className="tg-columns" ref={wrapRef}>
        <svg className="tg-connectors" width={svgSize.w || '100%'} height={svgSize.h || '100%'}>
          {connectors.map(c => (
            <path
              key={c.key}
              d={`M ${c.x1} ${c.y1} C ${c.x1 + 28} ${c.y1}, ${c.x2 - 28} ${c.y2}, ${c.x2} ${c.y2}`}
              fill="none"
              stroke={c.color}
              strokeWidth={1.5}
              strokeDasharray={c.dashed ? '4 3' : undefined}
              opacity={0.8}
            />
          ))}
        </svg>

        {columns.map(col => {
          const hue = col.index === 0 ? null : hslToHex(layerHue(col.index), 0.5, 0.62);
          return (
          <div className="tg-col" key={col.index} style={{ flexBasis: colWidth, width: colWidth }}>
            <div className="tg-col-head" style={hue ? { color: hue, borderBottomColor: hslToHex(layerHue(col.index), 0.5, 0.32) } : undefined}>
              {col.index === 0 ? 'Root' : `Layer ${col.index}`}
              <span className="tg-col-count">{col.items.length}</span>
            </div>
            <div className="tg-col-body">
              {col.items.slice(0, MAX_PER_COL).map(item => {
                const n = item.node;
                const isExpanded = path[col.index] === n.id;       // active in this column
                const isOnPath = activeSet.has(n.id);
                const isDetail = detailId === n.id;
                const stale = n.status === 'superseded' || n.status === 'legacy' || n.archived;
                const color = nodeColor(n, col.index);
                const isRoot = item.kind === 'root';
                // A node is expandable only if it has at least one child that
                // isn't already on the path (a back-edge would be hidden anyway).
                const hasChildren = !isRoot && hasVisibleChildren(n.id, col.index);
                const canDetail = !!detailsTarget(n);
                return (
                  <div
                    key={n.id}
                    ref={el => { if (el) cardRefs.current.set(`${col.index}:${n.id}`, el); else cardRefs.current.delete(`${col.index}:${n.id}`); }}
                    className={`tg-node ${isExpanded ? 'tg-node--expanded' : ''} ${isOnPath ? 'tg-node--path' : ''} ${isDetail ? 'tg-node--detail' : ''} ${item.kind === 'ref' ? 'tg-node--ref' : ''} ${n.isAsset ? 'tg-node--asset' : ''} ${isIndexDoc(n) ? 'tg-node--index' : ''} ${stale ? 'tg-node--stale' : ''}`}
                    style={{ '--node-color': color }}
                    onClick={() => {
                      // Files open in the viewer on a plain click (a "selection
                      // click" — no need to hunt for the ⓘ button). Folders drill
                      // in (expand). A file with cross-ref children keeps the caret
                      // as the way to expand without opening the viewer.
                      if (n.type === 'directory') { if (hasChildren) expand(col.index, n); }
                      else if (canDetail) openDetails(col.index, n);
                    }}
                    onContextMenu={e => { e.preventDefault(); openInExplorer(n.id); }}
                    title={n.id}
                  >
                    <span className="tg-node-dot" style={{ background: color }} />
                    <span className="tg-node-label">{nodeLabel(n)}</span>
                    {item.kind === 'ref' && (
                      <span className="tg-node-chip" title={`${item.dir === 'out' ? 'references' : 'referenced by'} (${item.type})`}>
                        {item.dir === 'out' ? '→' : '←'} {item.type}
                      </span>
                    )}
                    <span className="tg-node-actions">
                      <button
                        className="tg-iconbtn" title="Focus — make this the root"
                        onClick={e => { e.stopPropagation(); reRoot(n.id); }}
                      >⌖</button>
                      {canDetail && (
                        <button
                          className="tg-iconbtn" title="Details — open in the right panel"
                          onClick={e => { e.stopPropagation(); openDetails(col.index, n); }}
                        >ⓘ</button>
                      )}
                    </span>
                    {!isRoot && hasChildren && (
                      <span
                        className={`tg-node-caret ${isExpanded ? 'tg-node-caret--open' : ''}`}
                        title={isExpanded ? 'Collapse' : 'Expand children'}
                        onClick={e => { e.stopPropagation(); expand(col.index, n); }}
                      >›</span>
                    )}
                  </div>
                );
              })}
              {col.items.length > MAX_PER_COL && (
                <div className="tg-col-more">+{col.items.length - MAX_PER_COL} more (filter to narrow)</div>
              )}
              {col.items.length === 0 && col.looped === 0 && !col.hidden && <div className="tg-col-empty">no connections</div>}
              {showFiles && col.hidden > 0 && (
                <div className="tg-col-hidden" title="Files/folders here are file types currently toggled off. Enable them in the Types ▾ menu in the toolbar.">
                  ⊘ {col.hidden} hidden by type filter — see Types ▾
                </div>
              )}
              {col.looped > 0 && (
                <div className="tg-col-loop" title="back-references to nodes already on this path — hidden to keep the tree acyclic">
                  ↺ {col.looped} looped link{col.looped === 1 ? '' : 's'} hidden
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
