// Resolve a (possibly relative) reference target against the source file's
// directory. Frontmatter `references[]` mix absolute drive-relative paths with
// `../` relatives — normalising here is what makes cross-links resolve. Shared
// by TreeGraph (graph cross-ref children) and FileViewer (reference badges) so
// both navigate identically.
export function resolvePath(fromId, target) {
  if (!target) return target;
  target = target.replace(/\\/g, '/').replace(/\/+$/, '');
  if (!target.startsWith('.')) return target;
  const baseDir = fromId.includes('/') ? fromId.slice(0, fromId.lastIndexOf('/')) : '';
  const stack = baseDir ? baseDir.split('/') : [];
  for (const seg of target.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') stack.pop();
    else stack.push(seg);
  }
  return stack.join('/');
}

// --- Instance root config (fetched once from /api/config) -------------------
// The server owns the on-disk root (resolved from KB_ROOT); the client needs its
// native path prefix only to build a "copy full path" string / tooltip. We fetch
// it once and cache the promise. The server is authoritative and always answers,
// so the fallback below is a last resort only (config fetch failed) — it carries
// NO instance value, just an empty root so path strings degrade to relative.
const FALLBACK_ROOT = '';

let _configPromise = null;
export function fetchConfig() {
  if (!_configPromise) {
    _configPromise = fetch('/api/config')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('config fetch failed'))))
      .catch(() => ({ root: FALLBACK_ROOT, displayName: 'Dashboard', sep: '\\' }));
  }
  return _configPromise;
}

// Build the absolute native path prefix (root + trailing separator) from a
// config object. Empty root (fetch failed) → empty prefix (paths stay relative).
export function rootPrefix(config) {
  const root = config?.root || FALLBACK_ROOT;
  const sep = config?.sep || '\\';
  if (!root) return '';
  return root.endsWith(sep) ? root : root + sep;
}

// Convert a drive-relative forward-slash path into a native absolute path,
// using the fetched config (empty prefix when config is unavailable).
export function toNativePath(relPath, config) {
  const sep = config?.sep || '\\';
  return rootPrefix(config) + relPath.replace(/\//g, sep);
}
