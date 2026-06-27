#!/usr/bin/env node
/**
 * focus-detect — SANDBOX, READ-ONLY (focus-detector validation slice).
 *
 * Reads ONLY:  ./graph-index.snapshot.json (a FROZEN copy of the metadata; no doc bodies)
 *              ../../tooling/manifest.mot.json (company_profile)
 * Writes ONLY: ./focus_signals.json (inside this sandbox folder)
 *
 * It never reads document bodies, never touches __Projects/ etc., and its output path is
 * resolved strictly within this folder (__dirname). The B (deterministic) half of the
 * focus-detector: it computes distributions; a separate read-only agent interprets them.
 */
import fs from 'fs';
import path from 'path';
import url from 'url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SNAPSHOT = path.join(HERE, 'graph-index.snapshot.json');
const MANIFEST = path.resolve(HERE, '..', '..', 'tooling', 'manifest.mot.json');
const OUT = path.join(HERE, 'focus_signals.json'); // confined to the sandbox

const graph = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const cp = manifest.company_profile;

const files = graph.files || [];
const byId = new Map(files.map(f => [f.id, f]));

// project root for a __Projects/<tier>/<company>/ path
function projectRoot(id) {
  const m = /^(__Projects\/(?:Aquisition|Internal|Collaboration)\/[^/]+)\//.exec(id);
  return m ? m[1] : null;
}
const overviewOf = (pr) => byId.get(pr + '/Overview.md') || null;

// 1. Work concentration per project (file count under each project folder)
const filesPerProject = {};
for (const f of files) {
  const pr = projectRoot(f.id);
  if (pr) filesPerProject[pr] = (filesPerProject[pr] || 0) + 1;
}

// 2. Aggregate per vertical / tier / category / role / phase over project Overviews, weighted by work (files)
const perVertical = {}, perTier = {}, perCategory = {}, perRole = {}, perPhase = {};
const projectTable = [];
for (const pr of Object.keys(filesPerProject)) {
  const ov = overviewOf(pr);
  const work = filesPerProject[pr];
  const v = ov?.vertical || '(none)';
  const t = ov?.tier != null ? String(ov.tier) : '(none)';
  perVertical[v] = perVertical[v] || { projects: 0, files: 0 }; perVertical[v].projects++; perVertical[v].files += work;
  perTier[t] = perTier[t] || { projects: 0, files: 0 }; perTier[t].projects++; perTier[t].files += work;
  perCategory[ov?.category || '(none)'] = (perCategory[ov?.category || '(none)'] || 0) + 1;
  perRole[ov?.supply_chain_role || '(none)'] = (perRole[ov?.supply_chain_role || '(none)'] || 0) + 1;
  perPhase[ov?.phase || '(none)'] = (perPhase[ov?.phase || '(none)'] || 0) + 1;
  projectTable.push({ project: pr, files: work, vertical: v, tier: ov?.tier ?? null, phase: ov?.phase ?? null, valid_as_of: ov?.valid_as_of ?? null });
}
projectTable.sort((a, b) => b.files - a.files);

// 3. Context concentration: registered contexts ranked by files under their owner subtree
const perContextTag = {};
for (const f of files) if (f.context) perContextTag[f.context] = (perContextTag[f.context] || 0) + 1;
const registeredContexts = (cp.context_registry || []).map(c => {
  let ownerSubtreeFiles = 0;
  if (c.owner) {
    const base = c.owner.replace(/\/[^/]+$/, '');
    for (const f of files) if (f.id === c.owner || f.id.startsWith(base + '/')) ownerSubtreeFiles++;
  }
  return { tag: c.tag, nodes_with_tag: perContextTag[c.tag] || 0, owner_subtree_files: ownerSubtreeFiles, owner: c.owner || null };
}).sort((a, b) => b.owner_subtree_files - a.owner_subtree_files);

// 4. Reference in-degree (centrality)
const inDeg = {};
for (const r of (graph.references || [])) inDeg[r.target] = (inDeg[r.target] || 0) + 1;
const topReferenced = Object.entries(inDeg).sort((a, b) => b[1] - a[1]).slice(0, 25)
  .map(([target, count]) => ({ target, count, is_project_overview: /__Projects\/.+\/Overview\.md$/.test(target) }));

// 5. Recency: newest-dated project Overviews
const mostRecentProjects = projectTable.filter(p => p.valid_as_of)
  .sort((a, b) => String(b.valid_as_of).localeCompare(String(a.valid_as_of))).slice(0, 20);

// 6. Document-kind proxy by path pattern
const docKinds = { meeting_records: 0, testing_analysis: 0, overviews: 0, weekly_sync: 0, standards: 0, literature: 0 };
for (const f of files) {
  if (/\/Meeting_Records\//.test(f.id) || /_meeting_summary\.md$/.test(f.id)) docKinds.meeting_records++;
  if (/\/Testing\/|\/analysis\//.test(f.id)) docKinds.testing_analysis++;
  if (/\/Overview\.md$/.test(f.id)) docKinds.overviews++;
  if (/Sales & Operations sync/.test(f.id)) docKinds.weekly_sync++;
  if (/\/Standards\//.test(f.id)) docKinds.standards++;
  if (/^__Literature\//.test(f.id)) docKinds.literature++;
}

const signals = {
  generated_from: 'graph-index.snapshot.json (frozen; read-only)',
  totals: { files: files.length, projects: Object.keys(filesPerProject).length },
  per_vertical: perVertical,
  per_tier: perTier,
  per_category: perCategory,
  per_supply_chain_role: perRole,
  per_phase: perPhase,
  top_projects_by_work: projectTable.slice(0, 20),
  registered_contexts_by_work: registeredContexts,
  top_referenced_entities: topReferenced,
  most_recent_projects: mostRecentProjects,
  document_kinds: docKinds,
  company_vocab: { verticals: cp.vocab.verticals, tier_labels: cp.vocab.tier_scale.labels }
};

fs.writeFileSync(OUT, JSON.stringify(signals, null, 2));
console.log(`Wrote focus_signals.json — ${files.length} files, ${signals.totals.projects} projects`);
console.log('per_vertical:', JSON.stringify(perVertical));
console.log('top 6 projects by work:', projectTable.slice(0, 6).map(p => p.project.split('/').pop() + '=' + p.files).join(', '));
console.log('top contexts by work:', registeredContexts.slice(0, 4).map(c => c.tag + '=' + c.owner_subtree_files).join(', '));
