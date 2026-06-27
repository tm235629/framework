#!/usr/bin/env node
/**
 * kb-focus — the manifest-driven PERSON-FOCUS detector (the focus-detector C-module's
 * deterministic half).
 *
 * Reads an EXISTING frontmatter graph index (the same artifact kb-index emits and the
 * dashboard already maintains) + the manifest, and proposes a `person_profile.focus`
 * block: which verticals, tiers, contexts, entities and document-kinds dominate this
 * person's Drive. It populates exactly the FOCUS-DETECTED slots of config.schema.json's
 * person_profile.focus.
 *
 * PURE FUNCTION OF (graph-index + manifest), DEPENDENCY-FREE (Node stdlib only). There
 * are NO projects-hub / doc-genre path literals in the scoring logic — every root,
 * tier folder, context tag, owner subtree and doc-kind pattern comes from a manifest slot:
 *   - storage_profile.root / person_profile.root_override  → the Drive root (echoed in meta)
 *   - taxonomy.projects_root                                → the projects-hub folder name
 *   - taxonomy.project_tiers (entity_card === true)         → which top-level folders hold entities
 *   - vocab.{verticals, tier_scale}                         → the controlled axes to rank
 *   - vocab.document_kinds                                  → the doc-genre path patterns
 *   - context_registry[].{tag, owner}                       → the contexts + their owner subtrees
 * It NEVER reads a document body and writes ONLY under __Framework/tooling/_validation/.
 *
 * ── THE DETECTION MODEL: v1 distribution ensemble (CANONICAL) ─────────────────────────
 * This implements the *validated v1* signal set from slices/focus-detector (focus-detect.mjs
 * + VALIDATION.md). The v1 signals, fused as SOFT weighted votes (never single-signal
 * vetoes):
 *   1. work-depth          — file count under each project subtree (concentration of effort)
 *   2. tier/vertical weight — that work aggregated onto the project Overview's tier + vertical
 *   3. context owner-subtree— registered contexts ranked by files under their owner file's folder
 *   4. reference-centrality — reference in-degree, used to (a) surface focus entities and
 *                             (b) SOFT-DISCOUNT company hubs (high in-degree + low referrer
 *                             diversity + no ranked vertical → a hub everyone points at,
 *                             not a person workstream)
 *   5. doc-kind            — path-pattern proxy for the genres the person produces/consumes
 *
 * IMPORTANT — v2/v3 are deliberately NOT used. VALIDATION.md proves that "hardening" v1
 * with a single hard-exclude heuristic backfired: v2's referrer-diversity hard-exclude
 * DROPPED Bosch (a tier-1 focus that is merely widely referenced), and v3's node_kind
 * structural exclude DROPPED Elsoft (node_kind:product-parent tags the #1 focus too),
 * collapsing the Equipment vertical. The lesson that graduates here: structural signals
 * are SOFT ensemble features that DISCOUNT, never VETO. A hub's centrality lowers its
 * score; it does not exclude it. So Bosch (central but a real focus) survives, while
 * mot-camera-modules / __MOT (central AND a company hub with vertical (none)/Products that
 * no tester work concentrates in) are FLAGGED company-central, not promoted.
 *
 * ── SHARED-DRIVE CAVEAT ───────────────────────────────────────────────────────────────
 * On a per-person FEDERATED Drive (the real deployment) the whole Drive IS the person, so
 * this distribution is the person's focus directly. On a shared COMPANY Drive (MOT, the
 * validation instance) work-depth + centrality measure company centrality, so company-hub
 * candidates are reported in _detection_meta.shared_drive_caveat + flagged, not silently
 * folded in. A person-attribution channel (authorship / edit-recency / email+meeting
 * participation) is the future fusion that resolves the shared case; it is out of scope for
 * the structural detector and noted as the caveat.
 *
 * Output (the proposed person_profile.focus) → _validation/person_profile.focus.kb.json:
 *   { focus_verticals, focus_tiers, focus_contexts, focus_entities,
 *     focus_document_kinds, extra_entities: [],
 *     _detection_meta: { method, signals_used, confidence, shared_drive_caveat },
 *     _flagged_company_central, _signals }
 *
 * Usage:
 *   node __Framework/tooling/kb-focus.mjs [manifest] [graph-index] [--out PATH] [--json]
 *     default manifest    = manifest.example.json (shipped demo; copy to manifest.json and edit for your Drive)
 *     default graph-index = __Framework/tooling/_validation/graph-index.kb.json (kb-index output; pass the live graph-index.json explicitly)
 *     default --out       = __Framework/tooling/_validation/person_profile.focus.kb.json
 *     --out -             → print the proposed focus JSON to stdout
 *     --json              → print the full result (incl. _signals) to stdout as well
 *
 * The emitted focus block is a PROPOSAL: a human reviews it at the Step-2 gate and pastes
 * the agreed subset into person_profile.focus in the teammate's manifest.json.
 */

import fs from 'fs';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── tunables (all SOFT; documented so a reviewer can see the ensemble weights) ──
const TOP_VERTICAL_GAP = 0.5;   // a vertical is "focus" if its weight ≥ this × the top vertical's weight
const TIER_BAND_COVERAGE = 0.75;// focus tier band = contiguous most-important tiers covering ≥ this share of focus-vertical work
const ENTITY_TOP_N = 14;        // consider this many top projects (by fused score) as focus-entity candidates (the in-focus-vertical + real-engagement predicate filters this set; widening only lets a genuine thin-but-central tester account like 4Jet in, never an off-vertical project)
const ENTITY_MIN_WORK = 30;     // a focus entity qualifies on work-depth alone above this many files…
const ENTITY_MIN_INDEG = 8;     // …OR on reference-centrality at/above this in-degree (the work+centrality fusion)
const HUB_INDEG = 20;           // in-degree at/above which a (none)-vertical node is treated as a structural hub
const HUB_DIVERSITY = 0.6;      // referrer-diversity floor (distinct referrers / total refs) — a SECONDARY hub tell where the graph carries duplicate edges; on a define-once graph diversity is ~1 so the (none)-vertical tell carries it
const CONTEXT_MIN_FILES = 5;    // a context needs ≥ this many owner-subtree files to count as a measured focus context (drops owner:null and trace 1–3-file sub-instances)
const DOC_KIND_MIN = 10;        // a doc-kind must clear this many files to be a focus genre

// ─────────────────────────────────────────────────────────────────────────────────────
// CORE: compute the v1 focus signals from (graph, manifest). Pure; no I/O.
// ─────────────────────────────────────────────────────────────────────────────────────
function detectFocus(graph, manifestRaw) {
  const cp = manifestRaw.company_profile || {};
  const pp = manifestRaw.person_profile || {};
  const vocab = cp.vocab || {};
  const verticalsVocab = vocab.verticals || [];
  const tierLabels = (vocab.tier_scale && vocab.tier_scale.labels) || {};
  // The entity tiers (folders that hold one folder per company) come from the manifest —
  // entity_card === true. NOT a hardcoded Aquisition/Internal/Collaboration literal.
  const tierFolders = (cp.taxonomy?.project_tiers || [])
    .filter(t => t.entity_card === true && t.folder)
    .map(t => t.folder);
  // The projects-hub root comes from the manifest (taxonomy.projects_root) — NOT a
  // hardcoded '__Projects' literal. A Drive whose hub is named differently still scores.
  const projectsRoot = cp.taxonomy?.projects_root || '__Projects';

  const root = pp.root_override || cp.storage_profile?.root || null;
  const files = graph.files || [];
  const refs = graph.references || [];
  const byId = new Map(files.map(f => [f.id, f]));

  // ── project root for a <projectsRoot>/<entity-tier>/<entity>/ path ──
  const hubEsc = projectsRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tierAlt = tierFolders.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const projRe = tierAlt ? new RegExp(`^(${hubEsc}/(?:${tierAlt})/[^/]+)/`) : null;
  const projectRoot = (id) => {
    if (!projRe) return null;
    const m = projRe.exec(id);
    return m ? m[1] : null;
  };
  const overviewOf = (pr) => byId.get(pr + '/Overview.md') || null;

  // ── SIGNAL 1: work concentration (file count under each project subtree) ──
  const filesPerProject = {};
  for (const f of files) {
    const pr = projectRoot(f.id);
    if (pr) filesPerProject[pr] = (filesPerProject[pr] || 0) + 1;
  }

  // ── SIGNAL 4 (part a): reference in-degree + referrer diversity (centrality) ──
  const inDeg = {};
  const referrers = {};
  for (const r of refs) {
    if (!r || !r.target) continue;
    inDeg[r.target] = (inDeg[r.target] || 0) + 1;
    (referrers[r.target] = referrers[r.target] || new Set()).add(r.source);
  }
  const diversityOf = (target) => {
    const total = inDeg[target] || 0;
    if (!total) return 1;
    return (referrers[target]?.size || 0) / total; // distinct referrers / total refs
  };

  // ── per-project table fused over work + centrality, tagged with tier/vertical ──
  // Hub discount is SOFT: a highly-central node with low referrer-diversity AND no
  // ranked vertical (a (none)/structural hub) is marked hub_candidate so it can be
  // flagged — but it is NEVER excluded from the table (the v2/v3 lesson).
  const projectTable = [];
  const perVertical = {}, perTier = {}, perPhase = {};
  for (const pr of Object.keys(filesPerProject)) {
    const ov = overviewOf(pr);
    const work = filesPerProject[pr];
    const v = ov?.vertical || '(none)';
    const t = ov?.tier != null ? String(ov.tier) : '(none)';
    const ovId = pr + '/Overview.md';
    const indeg = inDeg[ovId] || 0;
    const diversity = diversityOf(ovId);
    // A structural company hub. The PRIMARY structural tell is "carries no ranked product
    // vertical" (vertical (none) — the __MOT / vertical-index / unplaced bucket) while being
    // big (high work) or central (high in-degree): such a node is company structure, not a
    // person workstream. Low referrer-diversity is a SECONDARY tell that only bites on a
    // graph with duplicate edges; on MOT's define-once graph diversity ≈ 1, so the
    // (none)-vertical tell carries the discrimination. This is a SOFT discount + flag, NOT a
    // veto — a hub stays in the table (the v2/v3 lesson: never hard-exclude).
    const noVertical = !verticalsVocab.includes(v);
    const hubCandidate = noVertical && (work >= ENTITY_MIN_WORK || indeg >= HUB_INDEG || diversity <= HUB_DIVERSITY);

    perVertical[v] = perVertical[v] || { projects: 0, files: 0 };
    perVertical[v].projects++; perVertical[v].files += work;
    perTier[t] = perTier[t] || { projects: 0, files: 0 };
    perTier[t].projects++; perTier[t].files += work;
    perPhase[ov?.phase || '(none)'] = (perPhase[ov?.phase || '(none)'] || 0) + 1;

    // Fused score: work-depth is the base; reference-centrality adds a bounded boost
    // (genuine focus entities like Bosch ARE widely referenced — centrality is signal,
    // not just noise). The hub discount is applied softly (the boost is damped for hubs).
    const centralityBoost = Math.log2(1 + indeg) * (hubCandidate ? 0.25 : 1);
    const score = work + centralityBoost * 4;

    projectTable.push({
      project: pr, overview: ov ? ovId : null, files: work,
      vertical: v, tier: ov?.tier ?? null, phase: ov?.phase ?? null,
      indeg, diversity: Number(diversity.toFixed(3)), hub_candidate: hubCandidate,
      score: Number(score.toFixed(2)),
    });
  }
  projectTable.sort((a, b) => b.score - a.score);

  // ── SIGNAL 2: focus verticals — controlled vocab only, weighted by work, top-gap ──
  // Exclude the (none) pseudo-vertical (the structural-hub bucket) from ranking; rank only
  // real vocab verticals by total work, keep those within TOP_VERTICAL_GAP of the leader.
  // The SELECTION is set-membership (which verticals are focus); the ORDER then leads with
  // the most CONCENTRATED vertical (largest single-project work) rather than the broadest —
  // Equipment (Elsoft, 152 files in one project) leads Foundry (same total spread over many
  // smaller projects), matching where the dominant work actually piles up.
  const maxWorkInVertical = {};
  for (const p of projectTable) {
    if (p.vertical === '(none)') continue;
    maxWorkInVertical[p.vertical] = Math.max(maxWorkInVertical[p.vertical] || 0, p.files);
  }
  const vWeights = verticalsVocab
    .map(v => ({ vertical: v, files: perVertical[v]?.files || 0, projects: perVertical[v]?.projects || 0, max_project_files: maxWorkInVertical[v] || 0 }))
    .filter(x => x.files > 0)
    .sort((a, b) => b.files - a.files);
  const topV = vWeights[0]?.files || 0;
  const focus_verticals = vWeights
    .filter(x => x.files >= topV * TOP_VERTICAL_GAP)
    .sort((a, b) => b.max_project_files - a.max_project_files) // concentrated leader first
    .map(x => x.vertical);

  // ── SIGNAL 3: focus contexts — registered contexts ranked by owner-subtree files ──
  // A context with owner:null (sync-owned / not-yet-active) is structurally invisible by
  // this method (owner_subtree_files = 0) — recorded as a gap, not promoted.
  const registeredContexts = (cp.context_registry || []).map(c => {
    let ownerSubtreeFiles = 0;
    if (c.owner) {
      const base = c.owner.replace(/\/[^/]+$/, '');
      for (const f of files) if (f.id === c.owner || f.id.startsWith(base + '/')) ownerSubtreeFiles++;
    }
    return { tag: c.tag, owner: c.owner || null, owner_subtree_files: ownerSubtreeFiles };
  }).sort((a, b) => b.owner_subtree_files - a.owner_subtree_files);

  // ── focus entities: the v1 work+centrality fusion over the candidate set ──
  // Step A: the BASE engagement predicate — a real, non-hub project in a focus vertical,
  // not archived, that is a genuine engagement (deep work ≥ ENTITY_MIN_WORK OR central
  // in-degree ≥ ENTITY_MIN_INDEG). This is the fusion VALIDATION.md calls for: work-depth
  // picks up Elsoft/Bosch; centrality pulls in thin-but-referenced tester accounts
  // (STMicro 9 files/in-deg 16, Disco 8/10, 4Jet 7/11), while a dormant low-centrality
  // same-vertical project (Ultimems, 22 files but in-degree 1) is correctly left out.
  const candidateEntities = projectTable.slice(0, ENTITY_TOP_N);
  const baseEngaged = (p) =>
    !!p.overview &&
    !p.hub_candidate &&
    p.vertical !== '(none)' && focus_verticals.includes(p.vertical) &&
    p.phase !== 'archived' &&
    (p.files >= ENTITY_MIN_WORK || p.indeg >= ENTITY_MIN_INDEG);

  // ── SIGNAL 2: focus tiers — the STRATEGIC BAND that holds the bulk of focus-vertical work ──
  // Tier is strategic importance, independent of activity. The focus tier band is the
  // CONTIGUOUS most-important tiers (ascending from the most important) that accumulate the
  // bulk (≥ TIER_BAND_COVERAGE) of work in the FOCUS verticals — not raw global tier work,
  // which the __MOT (none)-tier hub and a deep but shallow-per-project tier-3 research band
  // would skew. Focus-vertical work per tier here: T1=116, T2=221, T3=69, T4=23 → T1+T2 cover
  // 78% ⇒ band {1,2}; tier 3 (research breadth) falls below, so a tier-3 researcher
  // (Princeton) that clears the base engagement predicate is still excluded from
  // focus_entities below. Work is attributed to a tier only via focus-vertical projects, so
  // the band is grounded in the same fusion as the verticals.
  const fvWorkPerTier = {};
  for (const p of projectTable) {
    if (typeof p.tier !== 'number') continue;
    if (p.vertical === '(none)' || !focus_verticals.includes(p.vertical)) continue;
    fvWorkPerTier[p.tier] = (fvWorkPerTier[p.tier] || 0) + p.files;
  }
  const fvTotal = Object.values(fvWorkPerTier).reduce((a, b) => a + b, 0) || 1;
  const focus_tiers = [];
  let acc = 0;
  for (const t of Object.keys(fvWorkPerTier).map(Number).sort((a, b) => a - b)) {
    focus_tiers.push(t);
    acc += fvWorkPerTier[t];
    if (acc / fvTotal >= TIER_BAND_COVERAGE) break;
  }
  const inFocusTierBand = (t) => focus_tiers.length === 0 || (typeof t === 'number' && focus_tiers.includes(t));

  // Step B: a FOCUS ENTITY is a base-engaged project that also sits in the focus tier band.
  const isFocusEntity = (p) => baseEngaged(p) && inFocusTierBand(p.tier);

  const focus_entities = [];
  const focusEntityRoots = new Set();
  const flagged_company_central = [];
  for (const p of candidateEntities) {
    if (isFocusEntity(p)) {
      focus_entities.push(p.overview);
      focusEntityRoots.add(p.project);
      continue;
    }
    // Flag the company-central ones (hubs, or off-focus-vertical but highly central) so the
    // operator sees WHY they were not promoted — soft discount + flag, never a silent veto.
    const offFocusVertical = p.vertical !== '(none)' && !focus_verticals.includes(p.vertical);
    if (p.overview && (p.hub_candidate || (offFocusVertical && p.indeg >= HUB_INDEG))) {
      flagged_company_central.push({
        what: p.overview,
        signal: `files=${p.files}, in-degree=${p.indeg}, diversity=${p.diversity}, vertical=${p.vertical}, tier=${p.tier ?? '—'}`,
        why_excluded: p.hub_candidate
          ? 'Structural company hub (no ranked product vertical + large work/centrality) — company-central, not a person workstream.'
          : `High centrality but vertical (${p.vertical}) is outside the focus verticals — likely a company-central engagement; not promoted without a person-attribution signal.`,
      });
    }
  }

  // ── SIGNAL 3: focus contexts — registered contexts whose owner sits under a focus entity ──
  // Promote a context only when its owner file lives under one of the selected focus-entity
  // subtrees AND it clears the file floor (drops owner:null and 1–3-file trace instances).
  // A measurable context owned OUTSIDE every focus subtree (e.g. the camera-modules Products
  // hub) is FLAGGED company-central, not promoted.
  const ownerUnderFocus = (owner) => {
    if (!owner) return false;
    for (const r of focusEntityRoots) if (owner === r || owner.startsWith(r + '/')) return true;
    return false;
  };
  const focus_contexts = [];
  const flagged_contexts = [];
  for (const c of registeredContexts) {
    const under = ownerUnderFocus(c.owner);
    if (c.owner_subtree_files < CONTEXT_MIN_FILES) continue; // unmeasurable (owner:null / trace)
    if (under) focus_contexts.push(c.tag);
    else flagged_contexts.push({ tag: c.tag, owner_subtree_files: c.owner_subtree_files, owner: c.owner });
  }

  // ── SIGNAL 5: focus document kinds — path-pattern proxy ──
  // The doc-kind genres come from the manifest (vocab.document_kinds) — NOT hardcoded
  // MOT folder names. Each kind carries one or more regex path_patterns; a node matches
  // the kind if ANY pattern matches its id. The `literature` key keeps its special-case
  // (a company-wide archive, excluded from focus genres) by key below.
  const docKindDefs = (vocab.document_kinds || []).map(d => {
    const res = (d.path_patterns || []).map(p => new RegExp(p));
    return { key: d.key, label: d.label, test: (id) => res.some(r => r.test(id)) };
  });
  const docKindCounts = Object.fromEntries(docKindDefs.map(d => [d.key, 0]));
  const focusDocKindCounts = Object.fromEntries(docKindDefs.map(d => [d.key, 0]));
  const inFocusSubtree = (id) => {
    for (const r of focusEntityRoots) if (id.startsWith(r + '/')) return true;
    return false;
  };
  for (const f of files) {
    const inFocus = inFocusSubtree(f.id);
    for (const d of docKindDefs) {
      if (!d.test(f.id)) continue;
      docKindCounts[d.key]++;
      if (inFocus) focusDocKindCounts[d.key]++;
    }
  }
  // Focus doc-kinds clear the floor AND have at least some presence inside the focus
  // subtrees (so __Literature's company-wide archive does not masquerade as personal work).
  const focus_document_kinds = docKindDefs
    .filter(d => d.key !== 'literature' &&
      docKindCounts[d.key] >= DOC_KIND_MIN && focusDocKindCounts[d.key] >= 1)
    .sort((a, b) => docKindCounts[b.key] - docKindCounts[a.key])
    .map(d => `${d.label} (${docKindCounts[d.key]} files)`);

  // ── confidence + caveat ──
  const isSharedDrive = flagged_company_central.length > 0 || flagged_contexts.length > 0;
  const confidence =
    'high on focus_verticals/focus_tiers/focus_document_kinds; medium on focus_contexts/focus_entities ' +
    '(shared-drive breadth + owner:null context gaps — see slices/focus-detector/VALIDATION.md).';
  const shared_drive_caveat = isSharedDrive
    ? 'This graph is a shared COMPANY drive, so work-depth + reference-centrality measure company centrality, ' +
      'not person attribution. Company-central nodes are FLAGGED in _flagged_company_central / flagged_contexts, ' +
      'not silently included. On a per-person federated drive the whole drive is the person and this caveat is moot. ' +
      'Resolving the shared case needs a person-attribution channel (authorship / edit-recency / email+meeting participation), ' +
      'which is out of scope for this structural detector.'
    : 'Per-person (federated) drive: the whole drive is the person, so distribution = person focus directly.';

  const focus = {
    focus_verticals,
    focus_tiers,
    focus_contexts,
    focus_entities,
    focus_document_kinds,
    extra_entities: [],
    _detection_meta: {
      method: 'v1 distribution ensemble (work-depth + tier/vertical weight + context owner-subtree + reference-centrality + doc-kind), soft weighted votes, no hard-exclude vetoes (v2/v3 backfired per VALIDATION.md). Reads an existing frontmatter graph-index + manifest; no document bodies; dependency-free.',
      signals_used: [
        'work-concentration (files per entity-tier project subtree)',
        'per-vertical / per-tier work weight (controlled vocab only)',
        'registered-context owner-subtree file counts',
        'reference in-degree + referrer-diversity (centrality, soft hub discount — never a veto)',
        'document-kind path proxy, scoped to focus-entity subtrees',
      ],
      confidence,
      shared_drive_caveat,
    },
    _flagged_company_central: {
      note: 'High by structural signal but likely company-central (everyone references them), NOT person-specific. Flagged, never promoted, without a person-attribution signal. Soft-discounted in scoring, not vetoed (the v2/v3 lesson).',
      candidates: flagged_company_central,
      contexts: flagged_contexts,
    },
  };

  // per-tier work table (transparency only; focus_tiers is derived from the focus entities,
  // not from this raw weight — see the focus_tiers note above).
  const tierWeights = Object.keys(tierLabels).map(Number).filter(n => !Number.isNaN(n))
    .map(n => ({ tier: n, files: perTier[String(n)]?.files || 0, projects: perTier[String(n)]?.projects || 0 }))
    .filter(x => x.files > 0)
    .sort((a, b) => b.files - a.files);

  const signals = {
    root,
    totals: { files: files.length, projects: Object.keys(filesPerProject).length, references: refs.length },
    per_vertical: perVertical,
    per_tier: perTier,
    per_phase: perPhase,
    vertical_weights: vWeights,
    tier_weights: tierWeights,
    top_projects_by_score: projectTable.slice(0, 12),
    registered_contexts_by_work: registeredContexts,
    doc_kind_counts: docKindCounts,
    doc_kind_counts_in_focus: focusDocKindCounts,
    focus_entity_roots: [...focusEntityRoots],
    tunables: { TOP_VERTICAL_GAP, TIER_BAND_COVERAGE, ENTITY_TOP_N, ENTITY_MIN_WORK, ENTITY_MIN_INDEG, HUB_INDEG, HUB_DIVERSITY, CONTEXT_MIN_FILES, DOC_KIND_MIN },
  };

  return { focus, signals };
}

// ─────────────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────────────
function main() {
  const argv = process.argv.slice(2);
  const takeFlag = (name) => {
    const i = argv.findIndex(a => a === name);
    if (i >= 0) { const v = argv[i + 1]; argv.splice(i, 2); return v; }
    const inline = argv.find(a => a.startsWith(name + '='));
    if (inline) { argv.splice(argv.indexOf(inline), 1); return inline.slice(name.length + 1); }
    return null;
  };
  const json = argv.includes('--json');
  if (json) argv.splice(argv.indexOf('--json'), 1);
  // accept --graph as an alias for the graph-index positional
  const graphFlag = takeFlag('--graph');
  const out = takeFlag('--out');

  // positionals: [manifest] [graph-index]
  const positionals = argv.filter(a => !a.startsWith('--'));
  const manifestPath = positionals[0]
    ? path.resolve(process.cwd(), positionals[0])
    : path.resolve(__dirname, 'manifest.example.json');
  const graphPath = (graphFlag || positionals[1])
    ? path.resolve(process.cwd(), graphFlag || positionals[1])
    : path.resolve(__dirname, '_validation', 'graph-index.kb.json');

  for (const [label, p] of [['manifest', manifestPath], ['graph-index', graphPath]]) {
    if (!fs.existsSync(p)) { console.error(`kb-focus: ${label} not found: ${p}`); return 1; }
  }

  const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));

  const { focus, signals } = detectFocus(graph, manifestRaw);

  // ── summary to stderr (keeps stdout clean for --out -) ──
  console.error(`kb-focus: ${signals.totals.files} files, ${signals.totals.projects} projects, ${signals.totals.references} refs`);
  console.error(`  focus_verticals: ${focus.focus_verticals.join(', ') || '—'}`);
  console.error(`  focus_tiers:     ${focus.focus_tiers.join(', ') || '—'}`);
  console.error(`  focus_contexts:  ${focus.focus_contexts.join(', ') || '—'}`);
  console.error(`  focus_entities:  ${focus.focus_entities.map(e => e.split('/').slice(-2)[0]).join(', ') || '—'}`);
  console.error(`  focus_doc_kinds: ${focus.focus_document_kinds.length}`);
  if (focus._flagged_company_central.candidates.length)
    console.error(`  flagged company-central: ${focus._flagged_company_central.candidates.map(c => c.what.split('/').slice(-2)[0]).join(', ')}`);
  console.error('  → review this PROPOSAL, then paste the agreed subset into person_profile.focus (Step-2 human gate).');

  // The on-disk artifact is the proposed focus block (the person_profile.focus payload),
  // with the raw signals attached under _signals for inspection / re-validation.
  const artifact = { ...focus, _signals: signals };

  if (out === '-') {
    process.stdout.write(JSON.stringify(focus, null, 2) + '\n');
  } else {
    const outPath = out
      ? path.resolve(process.cwd(), out)
      : path.resolve(__dirname, '_validation', 'person_profile.focus.kb.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const tmp = outPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(artifact, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmp, outPath);
    console.error(`Wrote ${outPath}`);
  }
  if (json) process.stdout.write(JSON.stringify(artifact, null, 2) + '\n');
  return 0;
}

// Run the CLI only when invoked directly (`node kb-focus.mjs`), NOT when imported.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  process.exit(main());
}
