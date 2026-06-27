#!/usr/bin/env node
/**
 * kb-entities — the manifest-driven ENTITY REGISTRY generator.
 *
 * Stands up MetaOptics' single source of truth for ENTITIES (people + companies),
 * closing replication-blocker #4: people existed only as a hand-duplicated table
 * in the root CLAUDE.md (no machine SOT) and companies existed only as unindexed
 * __Projects/ folders (~67 of them). This emits ONE generated registry from the
 * sources that already hold the truth — the manifest (people SOT + the taxonomy
 * that says which folder tiers bear an entity card) and the prebuilt graph index
 * (the project Overview frontmatter) — so companies become queryable and people
 * get a single canonical home.
 *
 * PURE FUNCTION OF (manifest + graph). There are NO hardcoded company or people
 * literals in this file:
 *   - PEOPLE come verbatim from company_profile.entity_registry.people (the SOT).
 *   - WHICH FOLDER TIERS bear a company card come from taxonomy.project_tiers
 *     where entity_card === true (Aquisition / Internal / Collaboration / Archive).
 *   - WHICH FILES are company Overviews come from graph-index.json nodes (their
 *     derived `category` matches the tier's category_rule, and they sit one folder
 *     deep under the tier — one card per top-level company folder).
 *   - ALL company axes (category, tier, phase, vertical, supply_chain_role,
 *     description) are lifted straight off the graph node frontmatter — NO body
 *     reads. The graph already carries the frontmatter, so no file is opened.
 *
 * The category names the tier folders map to are themselves read from the
 * manifest's category_rules (taxonomy), not assumed — so a tier folder named
 * "Aquisition" whose rule emits category "aquisition" stays manifest-driven.
 *
 * Output shape:
 *   { generated_at: null,                  // left null by contract — derived data
 *     counts: { people, companies, by_tier },
 *     people:   [ {name,email,role,internal} ],
 *     companies:[ {name,folder,tier_folder,category,tier,phase,vertical,
 *                  supply_chain_role,description} ] }
 *
 * Usage:
 *   node tooling/kb-entities.mjs            # build → entities.json, print summary
 *   node tooling/kb-entities.mjs --check    # validate only, write nothing
 *   node tooling/kb-entities.mjs --out -    # print registry JSON to stdout
 *   [manifestPath] [--graph PATH] [--out PATH]
 *     default manifestPath = manifest.example.json (shipped demo; copy to manifest.json and edit for your Drive)
 *     default --graph      = tooling/_validation/graph-index.kb.json (kb-index output; pass the live graph-index.json explicitly)
 *     default --out        = tooling/_validation/entities.kb.json
 *
 * ADDITIVE & read-only on the live tree: by default the ONLY file this writes is the
 * derived registry under tooling/_validation/entities.kb.json. To publish
 * into a live dashboard data dir (where it sits beside projects.json / sync.json and is
 * auto-served at /api/data/entities.json), pass --out explicitly. It modifies NOTHING else.
 */

import fs from 'fs';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── manifest-derived config (the ONLY source of meaning) ──────────────────────
// From the manifest we read (a) the people SOT and (b) the set of tier folders
// that bear an entity card, each paired with the derived `category` its
// category_rule emits. No company / person literal appears here.
function entityConfig(manifestRaw) {
  const cp = manifestRaw.company_profile || {};
  const tiers = cp.taxonomy?.project_tiers || [];
  const rules = cp.taxonomy?.category_rules || [];
  // The projects-hub root comes from the manifest (taxonomy.projects_root) — the
  // single top-level folder the tiers live one segment under. NOT a hardcoded
  // '__Projects' literal: a Drive whose hub is named differently still derives.
  const projectsRoot = cp.taxonomy?.projects_root || '__Projects';

  // For a tier folder name, find the category its rule emits. The relevant rules
  // are `second_segment_of <projectsRoot>` (Aquisition/Internal/Collaboration/Documentation)
  // and the `(^|/)Archive(/|$)` regex → 'archive'. We match a rule whose `match`
  // equals the folder name, falling back to the folder name lowercased so a tier
  // with no explicit rule still resolves deterministically.
  const categoryForTier = (folder) => {
    const exact = rules.find(r =>
      (r.match_kind === 'second_segment_of' && r.scope === projectsRoot && r.match === folder) ||
      (r.match_kind === 'exact' && r.match === folder)
    );
    if (exact) return exact.category;
    // Archive is expressed as a regex rule keyed on the folder name.
    const reRule = rules.find(r =>
      r.match_kind === 'regex' && new RegExp(r.match).test(`${projectsRoot}/${folder}/X`)
    );
    if (reRule) return reRule.category;
    return folder.toLowerCase();
  };

  // The card-bearing tiers, in manifest order, each as {folder, category}.
  const cardTiers = tiers
    .filter(t => t.entity_card === true && t.folder)
    .map(t => ({ folder: t.folder, category: categoryForTier(t.folder) }));

  const people = (cp.entity_registry?.people || []).map(p => ({
    name: p.name,
    email: p.email,
    role: p.role,
    internal: p.internal === true,
  }));

  return { cardTiers, people, projectsRoot };
}

// Strip a leading 6- OR 8-digit date prefix from a folder name → display name
// (mirrors the Aquisition "YYYYMMDD CompanyName" convention; folders without a
// prefix, e.g. Internal/Elsoft, pass through unchanged).
function stripDatePrefix(folder) {
  return folder.replace(/^\d{6,8}\s+/, '');
}

// ── company derivation: ONE card per top-level entity folder ──────────────────
// For each card-bearing tier, find graph nodes that are an Overview sitting exactly
// one folder under the tier: __Projects/<tier>/<Company>/Overview.md (the company
// hub). Nested sub-Overviews (deeper than one folder) are skipped — one card per
// top-level company folder. The match is purely structural on the node id plus the
// node's derived category (so a stray Overview wrongly placed but mis-categorised
// is excluded), keeping the source of truth the manifest + graph.
function deriveCompanies(graph, cfg) {
  const companies = [];
  const seen = new Set();
  // projects-hub root, regex-escaped (manifest-driven; not a '__Projects' literal).
  const hub = (cfg.projectsRoot || '__Projects').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const { folder: tierFolder, category } of cfg.cardTiers) {
    // <projectsRoot>/<tierFolder>/<Company>/Overview.md  — exactly one folder deep.
    const tf = tierFolder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${hub}/${tf}/([^/]+)/Overview\\.md$`);
    for (const node of graph.files) {
      const id = node.id || '';
      const m = re.exec(id);
      if (!m) continue;
      // Category cross-check: the node's derived category must be the tier's
      // category (defends against an Overview mislocated under the tier).
      if (category && node.category && node.category !== category) continue;
      const dedupeKey = `${tierFolder}/${m[1]}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const folder = m[1];
      companies.push({
        name: stripDatePrefix(folder),
        folder: path.dirname(id),          // <projectsRoot>/<tier>/<Company>
        tier_folder: tierFolder,            // Aquisition / Internal / ...
        category: node.category || category,
        tier: typeof node.tier === 'number' ? node.tier : (node.tier ?? null),
        phase: node.phase || null,
        vertical: node.vertical || null,
        supply_chain_role: node.supply_chain_role || null,
        description: node.description || '',
      });
    }
  }

  // Stable order: by tier folder (manifest order), then display name.
  const tierOrder = new Map(cfg.cardTiers.map((t, i) => [t.folder, i]));
  companies.sort((a, b) =>
    (tierOrder.get(a.tier_folder) ?? 99) - (tierOrder.get(b.tier_folder) ?? 99) ||
    a.name.localeCompare(b.name));
  return companies;
}

// ── build the registry (pure function of manifest + graph) ────────────────────
function buildRegistry(manifestRaw, graph) {
  const cfg = entityConfig(manifestRaw);
  const people = cfg.people;
  const companies = deriveCompanies(graph, cfg);

  const by_tier = {};
  for (const { folder } of cfg.cardTiers) by_tier[folder] = 0;   // seed every card tier
  for (const c of companies) by_tier[c.tier_folder] = (by_tier[c.tier_folder] || 0) + 1;

  return {
    // Left null by contract — entities.json is a derived artifact; freshness is the
    // generator run, tracked by the pipeline, not a Date.now() baked into the data.
    generated_at: null,
    counts: { people: people.length, companies: companies.length, by_tier },
    people,
    companies,
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
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
  const graphArg = takeFlag('--graph');

  const manifestArg = args.find(a => !a.startsWith('--'));
  const manifestPath = manifestArg
    ? path.resolve(process.cwd(), manifestArg)
    : path.resolve(__dirname, 'manifest.example.json');
  const graphPath = graphArg
    ? path.resolve(process.cwd(), graphArg)
    : path.resolve(__dirname, '_validation', 'graph-index.kb.json');

  for (const [label, p] of [['manifest', manifestPath], ['graph-index', graphPath]]) {
    if (!fs.existsSync(p)) { console.error(`kb-entities: ${label} not found: ${p}`); return 1; }
  }

  const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));

  const registry = buildRegistry(manifestRaw, graph);
  const { people, companies, by_tier } = registry.counts;

  // ── summary to stderr (so --out - keeps stdout clean JSON) ──
  console.error(`kb-entities: people=${people}  companies=${companies}`);
  console.error(`  by_tier: ${Object.entries(by_tier).map(([k, v]) => `${k}=${v}`).join('  ')}`);
  console.error('  sample companies:');
  for (const c of registry.companies.slice(0, 5)) {
    console.error(`    - ${c.name}  [${c.tier_folder} · tier ${c.tier ?? '—'} · ${c.phase ?? '—'} · ${c.vertical ?? '—'}]`);
  }

  if (check) { console.error('kb-entities: --check (no file written)'); return 0; }

  const outPath = out
    ? (out === '-' ? '-' : path.resolve(process.cwd(), out))
    : path.resolve(__dirname, '_validation', 'entities.kb.json');

  if (outPath === '-') {
    process.stdout.write(JSON.stringify(registry, null, 2) + '\n');
  } else {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const tmp = outPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmp, outPath);
    console.error(`Wrote ${outPath} (people: ${people}, companies: ${companies})`);
  }
  return 0;
}

// Run the CLI only when invoked directly (`node kb-entities.mjs`), NOT when imported.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  process.exit(main());
}
