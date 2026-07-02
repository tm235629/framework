// Shared text-search primitives used by every search/filter surface in the
// dashboard (graph "jump to node", file-tree filter, literature). Keeping these
// in one place means accent-folding + multi-term matching behave identically
// across tabs, instead of each surface re-implementing its own substring match.
//
// Originated in LiteratureView (the most capable of the three search boxes);
// lifted here so TreeGraph + FileTree get the same behaviour for free.

// fold: lowercase, strip diacritics, ß→ss — so "Mass" matches "Maß" and
// "Goertek" matches "Goertek" regardless of accent input.
export function fold(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

// Split a query into folded, whitespace-separated terms. Callers require EVERY
// term to match (AND semantics), so "bosch tester" narrows to nodes hitting both.
export function foldTerms(q) {
  return fold(q).split(/\s+/).filter(Boolean);
}

// Escape a string for safe interpolation into a RegExp (used for word-boundary
// scoring in the graph search ranker).
export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
