/**
 * Instance config loader (client side).
 *
 * The dashboard slice is parameterized: display name, the controlled vocab ORDERS
 * the Projects facets sort by (phase / vertical enums), category rules and brand
 * come from the manifest via tooling/kb-dashboard-config.mjs. That generator emits
 * `instance.config.json` next to this file, and the SERVER re-serves the same shape
 * at GET /api/config.
 *
 * This loader gives the client TWO things:
 *   1. FALLBACK constants (the reference/MOT vocab shape) so the app renders sanely
 *      BEFORE any manifest is wired or the config fetch resolves — nothing here is a
 *      live company value, only the neutral controlled-vocab ordering.
 *   2. `applyInstanceConfig(cfg)` — merges a fetched /api/config payload over the
 *      fallbacks at runtime, so an instance's manifest vocab orders win once loaded.
 *
 * Kept dependency-free and side-effect-free (importable from any component).
 */

// Fallback vocab ORDERS. The ARRAY ORDER is the sort order for the facet chips.
// These are the reference orders; an instance overrides them from its manifest.
export const FALLBACK_VERTICAL_ORDER = ['Equipment', 'Foundry', 'Products', 'AI'];
export const FALLBACK_PHASE_ORDER = ['engaged', 'acquisition', 'placement', 'dormant', 'internal', 'archived'];

// Live, runtime-overridable copies. Components import these and read them lazily
// (at render time), so applyInstanceConfig() before first paint takes effect.
let VERTICAL_ORDER = [...FALLBACK_VERTICAL_ORDER];
let PHASE_ORDER = [...FALLBACK_PHASE_ORDER];
let DISPLAY_NAME = 'Dashboard';
let CATEGORY_RULES = [];
let BRAND = {};

/** Merge a /api/config payload over the fallbacks. Safe to call repeatedly. */
export function applyInstanceConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return;
  if (cfg.displayName) DISPLAY_NAME = cfg.displayName;
  const v = cfg.vocab || {};
  if (Array.isArray(v.verticals) && v.verticals.length) VERTICAL_ORDER = [...v.verticals];
  if (Array.isArray(v.phase_enum) && v.phase_enum.length) PHASE_ORDER = [...v.phase_enum];
  if (Array.isArray(cfg.categoryRules)) CATEGORY_RULES = cfg.categoryRules;
  if (cfg.brand && typeof cfg.brand === 'object') BRAND = cfg.brand;
}

// Accessors — read at call time so a late applyInstanceConfig() is reflected.
export const getVerticalOrder = () => VERTICAL_ORDER;
export const getPhaseOrder = () => PHASE_ORDER;
export const getDisplayName = () => DISPLAY_NAME;
export const getCategoryRules = () => CATEGORY_RULES;
export const getBrand = () => BRAND;
