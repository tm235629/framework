#!/usr/bin/env node
/**
 * kb-dashboard-config — the manifest-driven DASHBOARD-CONFIG generator.
 *
 * Emits the single config module the dashboard slice reads to learn its instance
 * identity: display name, category rules, the controlled vocab ORDERS its facets
 * sort by (tier scale / phase enum / vertical enum), the brand accent + fonts, the
 * top-level folder-prefix convention, the data-layer dir, and which instance-plugin
 * extractor scripts exist. Both halves of the slice consume the output:
 *   - server.js reads dashboard/src/config/instance.config.json at boot (display
 *     name, rootFolderPrefix, dataDir, literatureDir, contactRegister, pluginScripts,
 *     and re-serves vocab/categoryRules/brand at GET /api/config).
 *   - the client reads the same JSON via src/config/instance-config.js (a tiny loader
 *     with baked-in fallbacks) for the DataViews vocab-order facets and category rules.
 *
 * PURE FUNCTION OF (manifest). Dependency-free (Node stdlib only). There are NO
 * company / vocab literals in this file — every emitted value comes from a manifest
 * slot, with a DOCUMENTED default only where the manifest omits an optional block:
 *   - displayName        ← company_profile.company.name
 *   - categoryRules      ← taxonomy.category_rules            (else [])
 *   - vocab.tier_scale   ← vocab.tier_scale                   (min/max/labels)
 *   - vocab.phase_enum   ← vocab.phase_enum                   (facet + sort order)
 *   - vocab.verticals    ← vocab.verticals                    (facet + sort order)
 *   - brand.accent/fonts ← brand.accent, brand.accent_variants, brand.fonts
 *   - rootFolderPrefix   ← DEFAULT "__" (MOT's top-level convention; no manifest slot yet)
 *   - dataDir            ← DEFAULT "__Operations/Dashboard/data"
 *   - literatureDir      ← DEFAULT "__Literature"
 *   - contactRegister    ← company_profile.contact_register {enabled, path}
 *   - pluginScripts      ← DEFAULT {} (instance wires extract / syncPdf script paths here)
 *
 * The slice ships sane fallbacks in src/config/instance-config.js, so the dashboard
 * runs BEFORE this generator is ever invoked; running it just brands + tunes the copy.
 *
 * Usage:
 *   node tooling/kb-dashboard-config.mjs                 # build → dashboard/src/config/instance.config.json
 *   node tooling/kb-dashboard-config.mjs --check          # validate only, write nothing
 *   node tooling/kb-dashboard-config.mjs --out -          # print config JSON to stdout
 *   [manifestPath] [--out PATH]
 *     default manifestPath = manifest.example.json (shipped demo; copy to manifest.json for your instance)
 *     default --out        = ../dashboard/src/config/instance.config.json
 *
 * ADDITIVE & read-only on the live tree: the ONLY file this writes is the config
 * module under the dashboard slice. It modifies NOTHING else.
 */

import fs from 'fs';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Documented defaults for slots the manifest doesn't (yet) carry. Kept here as the
// single source of the fallback shape — mirrored by src/config/instance-config.js.
const DEFAULTS = {
  rootFolderPrefix: '__',
  dataDir: '__Operations/Dashboard/data',
  literatureDir: '__Literature',
};

// ── build the config object from the manifest ────────────────────────────────
export function buildDashboardConfig(manifestRaw) {
  const cp = manifestRaw.company_profile || {};
  const vocab = cp.vocab || {};
  const brand = cp.brand || {};
  const taxonomy = cp.taxonomy || {};
  const contact = cp.contact_register || {};

  return {
    // left null by contract — this is derived config, not a timestamped artifact
    generated_at: null,
    displayName: (cp.company && cp.company.name) || DEFAULTS.rootFolderPrefix,
    // controlled vocab ORDERS the DataViews facets sort by (not just the sets —
    // the array order IS the sort order for phase/vertical chips)
    vocab: {
      tier_scale: vocab.tier_scale || { min: 1, max: 4, labels: {} },
      phase_enum: Array.isArray(vocab.phase_enum) ? vocab.phase_enum : [],
      // the manifest key is `verticals`; the client facet calls it vertical order
      verticals: Array.isArray(vocab.verticals) ? vocab.verticals : [],
    },
    categoryRules: Array.isArray(taxonomy.category_rules) ? taxonomy.category_rules : [],
    brand: {
      accent: brand.accent || null,
      accent_variants: brand.accent_variants || {},
      fonts: Array.isArray(brand.fonts) ? brand.fonts : [],
    },
    // folder / path conventions the SERVER resolves against (documented defaults)
    rootFolderPrefix: DEFAULTS.rootFolderPrefix,
    dataDir: DEFAULTS.dataDir,
    literatureDir: DEFAULTS.literatureDir,
    contactRegister: {
      enabled: contact.enabled === true,
      path: contact.path || null,
    },
    // instance-plugin extractor script paths (root-relative). Empty by default:
    // the Sync-to-PDF + contacts re-extract endpoints 501 / skip until wired.
    // e.g. { extract: "__Operations/Dashboard/scripts/mot-tools.js",
    //        syncPdf: "__Operations/Dashboard/scripts/sync-report-pdf.js" }
    pluginScripts: cp.dashboard_plugin_scripts || {},
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);

  const takeFlag = (name) => {
    const i = args.findIndex(a => a === name);
    if (i >= 0) { const v = args[i + 1]; args.splice(i, 2); return v; }
    const inline = args.find(a => a.startsWith(name + '='));
    if (inline) { args.splice(args.indexOf(inline), 1); return inline.slice(name.length + 1); }
    return null;
  };
  const check = args.includes('--check');
  if (check) args.splice(args.indexOf('--check'), 1);
  const out = takeFlag('--out');

  const manifestArg = args.find(a => !a.startsWith('--'));
  const manifestPath = manifestArg
    ? path.resolve(process.cwd(), manifestArg)
    : path.resolve(__dirname, 'manifest.example.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`kb-dashboard-config: manifest not found: ${manifestPath}`);
    return 1;
  }

  const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const config = buildDashboardConfig(manifestRaw);

  // ── summary to stderr (so --out - keeps stdout clean JSON) ──
  console.error(`kb-dashboard-config: displayName="${config.displayName}"`);
  console.error(`  vocab: phases=[${config.vocab.phase_enum.join(', ')}]  verticals=[${config.vocab.verticals.join(', ')}]`);
  console.error(`  brand.accent=${config.brand.accent ?? '—'}  categoryRules=${config.categoryRules.length}`);
  console.error(`  contactRegister.enabled=${config.contactRegister.enabled}  pluginScripts=${Object.keys(config.pluginScripts).length}`);

  if (check) { console.error('kb-dashboard-config: --check (no file written)'); return 0; }

  const outPath = out
    ? (out === '-' ? '-' : path.resolve(process.cwd(), out))
    : path.resolve(__dirname, '..', 'dashboard', 'src', 'config', 'instance.config.json');

  if (outPath === '-') {
    process.stdout.write(JSON.stringify(config, null, 2) + '\n');
  } else {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const tmp = outPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmp, outPath);
    console.error(`Wrote ${outPath}`);
  }
  return 0;
}

// Run the CLI only when invoked directly, NOT when imported.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  process.exit(main());
}
