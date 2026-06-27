#!/usr/bin/env node
/**
 * kb-extract — the manifest-driven entity / TL;DR-card extractor.
 *
 * The GENERALIZABLE part of `mot-tools.js extract`: it turns every project
 * Overview's `## TL;DR` block into a status card, driven entirely by the manifest
 * (the C→B contract, ARCHITECTURE.md §4 — "B tools are pure functions of it").
 * Where mot-tools.js `extractProjects` hardcodes the scan roots, the category
 * meaning of "a project Overview", the tier scale, and the date-anchored TL;DR
 * key as JS constants, this reads ALL of that from the manifest:
 *
 *   - which files are entity cards   ← category_rules → category in {aquisition,
 *                                       internal, collaboration} (manifest-named,
 *                                       no __Projects/ literal in the logic)
 *   - the canonical TL;DR keys + the  ← frontmatter_schema.tldr_keys.canonical
 *     date-anchored key (freshness)     + .date_anchored_key
 *   - the tier scale (min/max)         ← vocab.tier_scale
 *   - scan roots / excludes / root     ← scan_roots, excludes, storage_profile.root
 *
 * SCOPE — generalizable only. This builds the entity/TL;DR-card extractor that
 * transfers to any instance. It deliberately does NOT build:
 *   - extractSync / extractTodos / extractEvents — those parse the MOT *weekly
 *     sync grammar* (## SALES/OPERATIONS sections, "**Topic**|Content|Date"
 *     tables, "Action Items & To-Do", Events.md). That grammar is MOT-specific;
 *     in the framework model those are COMPANY-SPECIFIC ADAPTERS that live beside
 *     the manifest, not in the generic B-library. (manifest.input_adapters already
 *     names the email/transcription adapters by the same logic.)
 *   - the MOT product-family graph wiring (product-parent / parent_id /
 *     subproject_ids / customer cross-listing / logo_slug). That is MOT's
 *     Reference_Graph_Schema §6a containment model, not a generic card field. The
 *     generic card carries the raw axes it would be derived FROM (node_kind,
 *     customer_refs) so a company adapter can build the family graph on top.
 *
 * Usage:
 *   node tooling/kb-extract.mjs [manifestPath] [--out PATH] [--index PATH]
 *   default manifestPath = manifest.example.json (shipped demo; copy to manifest.json and edit for your Drive)
 *   default --out        = tooling/_validation/projects.kb.json
 *   --index PATH         = reuse a prebuilt kb-index graph json instead of walking
 *                          (default: build the index in-process via kb-index.mjs)
 *
 * Frontmatter parsing reuses kb-index.mjs's gray-matter, declared in this
 * package's package.json and installed standalone via `npm install` in tooling/.
 * The B-library has no dependency on any sibling instance's node_modules.
 *
 * READ-ONLY on the live Drive. Writes ONLY under tooling/_validation/.
 */

import fs from 'fs';
import path from 'path';
import url from 'url';

import { buildIndex, loadManifest } from './kb-index.mjs';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── manifest-derived card config (the ONLY source of meaning) ─────────────
// Everything the extractor needs to decide WHAT is a card and HOW to read its
// TL;DR comes out of company_profile.frontmatter_schema + .vocab. No company
// path literal or hardcoded key appears below.
function cardConfig(manifestRaw) {
  const cp = manifestRaw.company_profile || {};
  const fs_ = cp.frontmatter_schema || {};
  const tldrKeys = fs_.tldr_keys || {};
  const vocab = cp.vocab || {};
  // Which derived categories denote an entity/engagement Overview. The manifest's
  // category_rules already map paths → these category names; we name the SET of
  // card-bearing categories rather than a path. The engagement-bearing project
  // tiers are Aquisition / Internal / Collaboration / Archive (a terminated
  // relationship keeps its Overview card — MOT emits MDesign as an `archive` card).
  // Sales (record-of-sale) and Documentation (cross-project reference) are NOT
  // entity cards; reference/tool/temp/hub/state/superseded never are. We intersect
  // the manifest's project_tiers with that engagement set so the source of truth
  // stays the manifest, not a hardcoded list. NB: `superseded` is deliberately
  // excluded — a superseded Overview is a dead version, not a live card (matches
  // category_rules ordering: _superseded/legacy → 'superseded' before any tier).
  const ENGAGEMENT_TIERS = ['aquisition', 'internal', 'collaboration', 'archive'];
  const cardCategories = new Set(
    (cp.taxonomy?.project_tiers || [])
      .map(t => (t.folder || '').toLowerCase())
      .filter(f => ENGAGEMENT_TIERS.includes(f))
  );
  // Fallback if a manifest omits project_tiers: the canonical engagement set.
  if (cardCategories.size === 0) ENGAGEMENT_TIERS.forEach(c => cardCategories.add(c));
  return {
    cardCategories,
    canonicalKeys: tldrKeys.canonical || [],
    // The key whose value carries the lead ISO date → freshness anchor.
    dateAnchoredKey: tldrKeys.date_anchored_key || 'Last activity',
    // node_kinds that are navigational labels, not entity cards (program-root =
    // R&D hub, vertical-index = the vertical Overviews). Derived from vocab:
    // node_kinds minus the ones that ARE cards (topic/product-parent are real).
    labelNodeKinds: new Set(
      (vocab.node_kinds || []).filter(k => k === 'program-root' || k === 'vertical-index')
    ),
    tierScale: vocab.tier_scale || { min: 1, max: 4 },
  };
}

// ── snake_case a TL;DR bold-key label → object key (mirrors mot-tools.js) ──
function snakeKey(label) {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// ── TL;DR block extractor (byte-identical regex to mot-tools.js extractTldr) ─
// Find "## TL;DR" up to the next "---", next "## " heading, or EOF. The EOF
// branch `$(?![\s\S])` matters for stub Overviews whose TL;DR runs to end-of-file.
function extractTldr(absPath) {
  const text = fs.readFileSync(absPath, 'utf-8');
  const fmStripped = text.replace(/^---\n.*?\n---\n/s, '');
  const m = /^## TL;DR\s*$([\s\S]*?)(?=^---\s*$|^## |$(?![\s\S]))/m.exec(fmStripped);
  if (!m) return null;
  return m[1].trim();
}

// ── parse the TL;DR block into a generic { snake_key: value } map ──────────
// GENERIC bullet parse: every "- **Key:** value" line becomes a field. This is
// faithful to mot-tools.js, which parses ALL bold-key bullets (not only the
// canonical four) so new TL;DR fields flow through without code changes. The
// manifest's canonical list is used for VALIDATION/coverage reporting + to drive
// the freshness anchor, NOT to filter which bullets are kept — see VALIDATION note
// and REPORT GAP (the manifest under-lists the keys MOT actually parses).
function parseTldrBlock(tldrText) {
  const tldr = {};
  if (!tldrText) return tldr;
  for (const line of tldrText.split('\n')) {
    const m = /^- \*\*([^:*]+):\*\*\s*(.*)$/.exec(line.trim());
    if (m) tldr[snakeKey(m[1])] = m[2].trim();
  }
  return tldr;
}

// ── date normalisation (subset of mot-tools.js toIsoDate, anchor-free) ────
// extractProjects calls toIsoDate(value, null) — refIso is null, so ONLY a strict
// embedded YYYY-MM-DD resolves; year-less forms ("Apr 17") yield null. We mirror
// exactly that path so last_activity_iso reproduces 1:1.
function leadIsoDate(raw) {
  if (!raw) return null;
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(raw).trim());
  return m ? m[0] : null;
}

// Is this node an engagement-entity card? Manifest-driven: its derived category is
// in the card-category set, AND its basename is an Overview (the manifest's
// frontmatter is the schema; "Overview.md" / "*_Overview.md" is the entity-doc
// filename convention — taxonomy.project_tiers describe per-company folders each
// holding one Overview). We do not hardcode a path; category already encodes tier.
function isEntityCard(node, cfg) {
  if (!cfg.cardCategories.has(node.category)) return false;
  return /(?:^|\/)[A-Za-z0-9.()_-]*Overview\.md$/.test(node.id);
}

// Deep technical/working overviews (Development/Analysis/Measurement-setup
// subtrees) are engineering docs, not entity cards. mot-tools.js excludes these so
// e.g. ".../Development/STMicro_WaferLevelTester_Overview.md" is not a tile.
// NOTE: this folder-name list is one of the few MOT-shaped constants; in a fuller
// manifest it would live under taxonomy (subfolder_convention already enumerates
// Development/Analysis-style working subfolders). Flagged as a manifest gap in REPORT.
function isDeepTechnicalOverview(id) {
  return /(?:^|\/)(Development|Analysis|Measurement setup)\//i.test(id);
}

// ── the extractor ─────────────────────────────────────────────────────────
function extractCards(index, manifestRaw) {
  const cfg = cardConfig(manifestRaw);
  const root = index.root;

  const cards = [];
  // Track which canonical keys each card actually carried, for coverage reporting.
  const canonicalSnake = cfg.canonicalKeys.map(snakeKey);
  const dateAnchorSnake = snakeKey(cfg.dateAnchoredKey);
  // Secondary date-anchor synonyms MOT folds in (tldr.last_activity || last_engagement).
  // Kept generic: the date anchor + a known synonym. A manifest could list synonyms.
  const dateAnchorSynonyms = [dateAnchorSnake, 'last_engagement'];

  const seenKeys = {};   // snake_key → count, across all cards (coverage analytics)

  for (const node of index.files) {
    if (!isEntityCard(node, cfg)) continue;

    const abs = path.join(root, node.id);
    const tldrText = (() => { try { return extractTldr(abs); } catch { return null; } })();
    const tldr = parseTldrBlock(tldrText);
    for (const k of Object.keys(tldr)) seenKeys[k] = (seenKeys[k] || 0) + 1;

    const isDeep = isDeepTechnicalOverview(node.id);
    const isLabel = cfg.labelNodeKinds.has(node.node_kind);

    const folder = path.dirname(node.id).split('/').pop();
    // Strip a leading 6- OR 8-digit date prefix from the folder → display name.
    const name = folder.replace(/^\d{6,8}\s+/, '');

    // Tier: frontmatter tier (within the manifest's tier_scale) wins; else parse a
    // "Tier N" out of the TL;DR `tier` bullet (legacy Overviews carry it in prose).
    const { min, max } = cfg.tierScale;
    const fmTierNum = (typeof node.tier === 'number') ? node.tier
      : (node.tier != null && new RegExp(`^[${min}-${max}]$`).test(String(node.tier)))
        ? Number(node.tier) : null;
    const tierMatch = /tier\s*(\d)/i.exec(tldr.tier || '');
    const tier = fmTierNum != null ? fmTierNum : (tierMatch ? Number(tierMatch[1]) : null);

    // Freshness: lead ISO date from the date-anchored key (or its synonym).
    const dateRaw = dateAnchorSynonyms.map(k => tldr[k]).find(Boolean) || null;
    const lastActivityIso = leadIsoDate(dateRaw);

    cards.push({
      id: node.id,
      name,
      folder,
      category: node.category,
      description: node.description || '',
      // engagement axes lifted straight off the manifest-driven node
      tier,
      vertical: node.vertical || null,
      phase: node.phase || null,
      supply_chain_role: node.supply_chain_role || null,
      lifecycle_status: node.status || null,   // status frontmatter (current/legacy/…)
      context: node.context || null,
      node_kind: node.node_kind || null,
      // TL;DR-derived
      status: tldr.status || null,             // canonical "Status" → card headline
      next_milestone: tldr.next_milestone || tldr.next || null,
      open_blockers: tldr.open_blockers || null,
      last_activity: dateRaw,
      last_activity_iso: lastActivityIso,
      // the FULL generic TL;DR map (every bold-key bullet) — same as MOT's `tldr`
      tldr,
      // raw axes a company adapter builds the family graph from (NOT resolved here)
      customer_refs: Array.isArray(node.customer_refs) ? node.customer_refs : [],
      // classification flags (kept so a consumer can see why a card is/ isn't a tile)
      is_deep_technical: isDeep,
      is_label_node: isLabel,
      mtime: node.mtime,
    });
  }

  // Tiles = cards minus deep-technical + navigational-label nodes (mot-tools.js
  // emits only tiles into projects.json). We emit BOTH: `cards` (everything that
  // parsed) and the tile view, so validation can compare against MOT's tile count.
  const tiles = cards.filter(c => !c.is_deep_technical && !c.is_label_node);
  tiles.sort((a, b) => (a.tier || 9) - (b.tier || 9) || a.name.localeCompare(b.name));

  // Coverage: canonical keys vs. keys actually seen (drives the manifest-gap report).
  const canonicalCoverage = canonicalSnake.map(k => ({ key: k, cards_with: seenKeys[k] || 0 }));
  const nonCanonicalKeys = Object.entries(seenKeys)
    .filter(([k]) => !canonicalSnake.includes(k) && k !== 'next')
    .sort((a, b) => b[1] - a[1])
    .map(([key, cards_with]) => ({ key, cards_with }));

  return {
    generated_at: new Date().toISOString(),
    root,
    manifest: index.manifest || null,
    count: tiles.length,
    card_total: cards.length,
    projects: tiles,
    // analytics block — not a card field; feeds REPORT manifest-gap section.
    tldr_key_coverage: {
      canonical_keys: cfg.canonicalKeys,
      date_anchored_key: cfg.dateAnchoredKey,
      canonical_coverage: canonicalCoverage,
      non_canonical_keys_parsed: nonCanonicalKeys,
    },
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);

  const takeFlag = (name) => {
    const i = args.findIndex(a => a === name);
    if (i >= 0) { const v = args[i + 1]; args.splice(i, 2); return v; }
    const inline = args.find(a => a.startsWith(name + '='));
    if (inline) { args.splice(args.indexOf(inline), 1); return inline.slice(name.length + 1); }
    return null;
  };
  const out = takeFlag('--out');
  const indexPath = takeFlag('--index');

  const manifestArg = args.find(a => !a.startsWith('--'));
  const manifestPath = manifestArg
    ? path.resolve(process.cwd(), manifestArg)
    : path.resolve(__dirname, 'manifest.example.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`kb-extract: manifest not found: ${manifestPath}`);
    return 1;
  }

  // The manifest is the single source of truth: build (or load) the graph index
  // from it, then read the same manifest for the card config. Pure function of it.
  const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  let index;
  if (indexPath) {
    index = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), indexPath), 'utf-8'));
  } else {
    index = buildIndex(manifestPath);
  }

  const result = extractCards(index, manifestRaw);

  const outPath = out
    ? (out === '-' ? '-' : path.resolve(process.cwd(), out))
    : path.resolve(__dirname, '_validation', 'projects.kb.json');

  if (outPath === '-') {
    process.stdout.write(JSON.stringify(result, null, 2));
  } else {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const tmp = outPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(result, null, 2), 'utf-8');
    fs.renameSync(tmp, outPath);
    console.error(`Wrote ${outPath} (tiles: ${result.count}, cards: ${result.card_total}, non-canonical TL;DR keys parsed: ${result.tldr_key_coverage.non_canonical_keys_parsed.length})`);
  }
  return 0;
}

// Run the CLI only when invoked directly (`node kb-extract.mjs`), NOT when imported.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  process.exit(main());
}
