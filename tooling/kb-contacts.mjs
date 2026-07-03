#!/usr/bin/env node
/**
 * kb-contacts — the manifest-driven CONTACTS extractor.
 *
 * Emits the dashboard Contacts tab's data (contacts.json) from a company's LIVE
 * SHARED contact register (resource class 3, S1): the ONE on-disk markdown table
 * that is the single source of truth per company for the deliberately-shareable
 * mutable contact roster. This tool is a READER — each teammate instance reads the
 * register, computes person status LOCALLY at extract, and derives the company
 * axes against ITS OWN graph. Nothing is written back to the register here.
 *
 * PURE FUNCTION OF (manifest + register markdown + graph + entities + drafts):
 *   - The register path, schema columns, flag enum, status thresholds and the
 *     drafts/shortlists/sources dirs all come from company_profile.contact_register
 *     (S2). When shared: true the path resolves against storage_profile.shared_root;
 *     when shared: false it resolves against the instance root. NO contact literal
 *     appears in this file.
 *   - PERSON STATUS (active/idle/dormant/uncontacted) is DERIVED AT EXTRACT from the
 *     Last-contact date vs the REAL current date (never stored in the register):
 *     active ≤ active_days · idle ≤ idle_months · dormant beyond · uncontacted = no
 *     date. Boundary behaviour matches the reference (mot-tools extractContacts).
 *   - The manual Flag column is validated against flag_enum; a not-yet-migrated
 *     table (no Flag column) has its old Status column lifted for flag-like values
 *     (back-compat), everything else dropped (status is computed, never read).
 *   - COMPANY AXES (company_role/vertical/phase/tier) are derived per person from
 *     the Linked-project Overview node in the graph index, with per-field fallback
 *     to a name-matched entities company card (a contact may link a sub-Overview
 *     that carries no company axes of its own). No match anywhere → all four null.
 *   - Current outreach DRAFTS (from drafts_dir) are attached keyed by their `to:`
 *     email — one draft per contact.
 *
 * Output shape (identical to MOT's data/contacts.json):
 *   { generated_at, source, count, linked_count, draft_count,
 *     statuses{}, flags{},               // person axes (flags: unflagged → "none")
 *     company_roles{}, company_verticals{},  // derived company axes
 *     contacts: [ { name, company, title, status, flag, last_contact,
 *                   last_contact_iso, owner, email, phone, context, linked_project,
 *                   notes, draft, logo_slug, company_role, company_vertical,
 *                   company_phase, company_tier } ] }
 *
 * Usage:
 *   node tooling/kb-contacts.mjs                     # build → contacts.kb.json, print summary
 *   node tooling/kb-contacts.mjs --check             # validate only, write nothing
 *   node tooling/kb-contacts.mjs --out -             # print contacts JSON to stdout
 *   [manifestPath] [--graph PATH] [--entities PATH] [--out PATH]
 *     default manifestPath = manifest.example.json (shipped demo; copy to manifest.json and edit for your Drive)
 *     default --graph      = tooling/_validation/graph-index.kb.json (kb-index output; MOT passes its live graph-index.json)
 *     default --entities   = tooling/_validation/entities.kb.json     (kb-entities output; MOT passes its live data/entities.json)
 *     default --out        = tooling/_validation/contacts.kb.json
 *
 * ADDITIVE & read-only on the live tree: by default the ONLY file written is the
 * derived roster under tooling/_validation/contacts.kb.json. Pass --out explicitly to
 * publish beside the other dashboard data JSON. It modifies NOTHING else — least of
 * all the register (which only its gated rebuild/CRUD path may touch, S1).
 */

import fs from 'fs';
import path from 'path';
import url from 'url';
import matter from 'gray-matter';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── markdown table parsing (mirrors mot-tools parseMdTableFull/tableToObjects) ──
// A GitHub-flavoured table under the register's `## <heading>` → array of objects
// keyed by snake_cased header names. Separator row skipped.
function snakeKey(label) {
  return String(label).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function parseMdTableFull(lines) {
  const all = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    if (/^\|[\s:-]+\|/.test(t) && /-{2,}/.test(t)) continue; // separator
    const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    all.push(cells);
  }
  if (all.length === 0) return { headers: [], rows: [] };
  return { headers: all[0], rows: all.slice(1) };
}
function tableToObjects(lines) {
  const { headers, rows } = parseMdTableFull(lines);
  if (!headers.length) return null;
  const keys = headers.map(snakeKey);
  return rows.map(cells => {
    const o = {};
    keys.forEach((k, i) => { o[k] = cells[i] ?? ''; });
    return o;
  });
}

// Company slug for the default avatar (public/logos/<slug>.*) — mirrors mot-tools slugify.
function slugify(s) {
  return String(s || '').toLowerCase().replace(/^\d{6,8}\s+/, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── person status (DERIVED AT EXTRACT, never stored) ──────────────────────────
// Matches the reference boundary behaviour (mot-tools contactStatus) exactly:
//   active ≤ active_days · idle: within idle_months of now · dormant: older ·
//   uncontacted: no/invalid last-contact date. The idle boundary walks calendar
//   months (setMonth), NOT a fixed day count, so it tracks the reference.
function contactStatus(lastContactIso, now, activeDays, idleMonths) {
  if (!lastContactIso) return 'uncontacted';
  const then = new Date(lastContactIso + 'T00:00:00');
  if (isNaN(then.getTime())) return 'uncontacted';
  const days = (now.getTime() - then.getTime()) / 86400000;
  if (days <= activeDays) return 'active';
  const idleFloor = new Date(now.getTime());
  idleFloor.setMonth(idleFloor.getMonth() - idleMonths);
  return then >= idleFloor ? 'idle' : 'dormant';
}

// ── outreach drafts (from drafts_dir), keyed by the draft's `to:` email ────────
// One .md per contact: frontmatter { to, subject, touch_type, generated, ... } + body.
// Files starting with `_` (e.g. a README) are skipped. Mirrors mot-tools loadContactDrafts.
function loadContactDrafts(draftsDir) {
  const map = {};
  let files = [];
  try { files = fs.readdirSync(draftsDir); } catch { return map; }
  for (const f of files) {
    if (!f.endsWith('.md') || f.startsWith('_')) continue;
    let parsed;
    try { parsed = matter(fs.readFileSync(path.join(draftsDir, f), 'utf-8')); } catch { continue; }
    const fm = parsed.data || {};
    if (!fm || Object.keys(fm).length === 0) continue;
    const to = String(fm.to || '').trim().toLowerCase();
    if (!to) continue;
    // Optional related_material — SENDER-REFERENCE items. Normalize to [{path?, note?}].
    const related = (Array.isArray(fm.related_material) ? fm.related_material : [])
      .map(it => {
        if (typeof it === 'string') return it.trim() ? { note: it.trim() } : null;
        if (!it || typeof it !== 'object') return null;
        const p = it.path != null ? String(it.path).replace(/\\/g, '/').trim() : '';
        const note = it.note != null ? String(it.note).trim() : '';
        if (!p && !note) return null;
        return { ...(p && { path: p }), ...(note && { note }) };
      })
      .filter(Boolean);
    map[to] = {
      subject: String(fm.subject || ''),
      body: (parsed.content || '').trim(),
      to,
      touch_type: fm.touch_type || null,
      generated: fm.generated || null,
      ...(fm.sent && { sent: fm.sent instanceof Date ? fm.sent.toISOString().slice(0, 10) : String(fm.sent).trim() }),
      file: relFrom(draftsDir, f),
      ...(related.length && { related_material: related }),
    };
  }
  return map;
}
// Draft file path relative to the register root's parent (mirrors mot-tools relPath's
// forward-slashed, root-relative form for display).
let REL_ROOT = null;
function relFrom(dir, file) {
  const abs = path.join(dir, file);
  const base = REL_ROOT || path.parse(abs).root;
  return path.relative(base, abs).replace(/\\/g, '/');
}

// ── company-axis derivation (NEVER stored per person) ─────────────────────────
// Primary = the contact's linked_project path → graph node (Overview frontmatter);
// per-field fallback = case-insensitive exact company-name match against the
// entities company cards. Mirrors mot-tools companyAxes exactly.
function companyAxesFactory(index, entities) {
  const nodeById = new Map((index && Array.isArray(index.files) ? index.files : []).map(n => [n.id, n]));
  const companyByName = new Map();
  for (const c of (entities && Array.isArray(entities.companies) ? entities.companies : [])) {
    const k = String(c.name || '').toLowerCase();
    if (k && !companyByName.has(k)) companyByName.set(k, c);
  }
  const normTier = t => typeof t === 'number' ? t
    : (t != null && /^[1-4]$/.test(String(t)) ? Number(t) : null);
  return (linkedProject, company) => {
    let card = null;
    if (linkedProject) {
      const p = String(linkedProject).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
      card = nodeById.get(p) || nodeById.get(`${p}/Overview.md`) || null;
    }
    const ent = company ? (companyByName.get(company.toLowerCase()) || null) : null;
    const pick = (a, b) => (a != null && a !== '') ? a : ((b != null && b !== '') ? b : null);
    const cardTier = card ? normTier(card.tier) : null;
    const entTier = ent ? normTier(ent.tier) : null;
    return {
      company_role: pick(card && card.supply_chain_role, ent && ent.supply_chain_role),
      company_vertical: pick(card && card.vertical, ent && ent.vertical),
      company_phase: pick(card && card.phase, ent && ent.phase),
      company_tier: cardTier != null ? cardTier : entTier,
    };
  };
}

// ── build the roster (pure function of register text + graph + entities + drafts) ──
function buildContacts(cfg, registerText, index, entities, drafts, sourceRel) {
  const flagEnum = new Set((cfg.flag_enum || []).map(s => String(s).toLowerCase()));
  const activeDays = cfg.status_thresholds?.active_days ?? 60;
  const idleMonths = cfg.status_thresholds?.idle_months ?? 6;

  const lines = registerText.split(/\r?\n/);
  // Parse the table under the `## Contacts` heading if present, else the whole file.
  const start = lines.findIndex(l => /^##\s+Contacts\s*$/i.test(l));
  const tableLines = (start >= 0 ? lines.slice(start + 1) : lines).filter(l => l.trim().startsWith('|'));
  const objs = tableToObjects(tableLines) || [];

  const norm = s => (s == null ? '' : String(s).trim());
  const clean = s => { const t = norm(s); return (t === '' || t === '—' || t === '-') ? null : t; };
  const companyAxes = companyAxesFactory(index, entities);
  const now = new Date();

  const contacts = objs.map(o => {
    const email = clean(o.email);
    const company = clean(o.company);
    const linked_project = clean(o.linked_project);
    const last_contact = clean(o.last_contact);
    const last_contact_iso = (norm(o.last_contact).match(/\d{4}-\d{2}-\d{2}/) || [])[0] || null;
    // Flag column (manual overrides only). Back-compat: a not-yet-migrated table has
    // no Flag column but kept flag-like values in its old Status column — lift those;
    // every other legacy stored status is dropped (status is computed, never read).
    const rawFlag = clean(o.flag) ?? clean(o.status);
    const flag = (rawFlag && flagEnum.has(rawFlag.toLowerCase())) ? rawFlag.toLowerCase() : null;
    return {
      name: norm(o.name),
      company,
      title: clean(o.title),
      status: contactStatus(last_contact_iso, now, activeDays, idleMonths),
      flag,
      last_contact,
      last_contact_iso,
      owner: clean(o.owner),
      email,
      phone: clean(o.phone),
      context: clean(o.context),
      linked_project,
      notes: clean(o.notes),
      draft: (email && drafts[email.toLowerCase()]) || null,
      logo_slug: company ? slugify(company) : null,
      ...companyAxes(linked_project, company),
    };
  }).filter(c => c.name || c.email);

  const tally = (key, emptyLabel = 'Unspecified') => {
    const m = {};
    for (const c of contacts) { const k = c[key] || emptyLabel; m[k] = (m[k] || 0) + 1; }
    return m;
  };
  return {
    generated_at: new Date().toISOString(),
    source: sourceRel,
    count: contacts.length,
    linked_count: contacts.filter(c => c.linked_project).length,
    draft_count: contacts.filter(c => c.draft).length,
    statuses: tally('status'),
    flags: tally('flag', 'none'),
    company_roles: tally('company_role'),
    company_verticals: tally('company_vertical'),
    contacts,
  };
}

// ── config + path resolution from the manifest ────────────────────────────────
// The register lives under the instance root (shared:false) or the company-shared
// storage_profile.shared_root (shared:true, S2). Returns { cfg, registerAbs, rootAbs,
// draftsAbs, sourceRel } or null when contact_register is disabled/absent.
function resolveConfig(manifestRaw) {
  const cp = manifestRaw.company_profile || {};
  const cfg = cp.contact_register;
  if (!cfg || cfg.enabled !== true) return null;

  const sp = cp.storage_profile || {};
  const instanceRoot = manifestRaw.person_profile?.root_override || sp.root || process.cwd();
  const base = (cfg.shared === true)
    ? (sp.shared_root || instanceRoot)   // shared → resolve against the shared library root
    : instanceRoot;                       // instance-local copy → against the instance root

  const registerAbs = path.resolve(base, cfg.path || '__Sales/Contacts/Contacts.md');
  const rootAbs = path.resolve(base);
  const draftsAbs = cfg.drafts_dir ? path.resolve(base, cfg.drafts_dir) : path.join(path.dirname(registerAbs), 'drafts');
  const sourceRel = path.relative(rootAbs, registerAbs).replace(/\\/g, '/');
  return { cfg, registerAbs, rootAbs, draftsAbs, sourceRel };
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
  const entitiesArg = takeFlag('--entities');

  const manifestArg = args.find(a => !a.startsWith('--'));
  const manifestPath = manifestArg
    ? path.resolve(process.cwd(), manifestArg)
    : path.resolve(__dirname, 'manifest.example.json');
  const graphPath = graphArg
    ? path.resolve(process.cwd(), graphArg)
    : path.resolve(__dirname, '_validation', 'graph-index.kb.json');
  const entitiesPath = entitiesArg
    ? path.resolve(process.cwd(), entitiesArg)
    : path.resolve(__dirname, '_validation', 'entities.kb.json');

  if (!fs.existsSync(manifestPath)) { console.error(`kb-contacts: manifest not found: ${manifestPath}`); return 1; }
  const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  const resolved = resolveConfig(manifestRaw);
  if (!resolved) {
    console.error('kb-contacts: contact_register not enabled in manifest — nothing to extract.');
    return 0;
  }
  const { cfg, registerAbs, rootAbs, draftsAbs, sourceRel } = resolved;
  if (!fs.existsSync(registerAbs)) { console.error(`kb-contacts: register not found: ${registerAbs}`); return 1; }

  // Graph + entities are OPTIONAL joins: absent ones simply leave company axes null.
  const readJsonIf = (p, label) => {
    if (!p || !fs.existsSync(p)) { if (p) console.error(`kb-contacts: ${label} not found (${p}) — company axes will be null`); return null; }
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
    catch { console.error(`kb-contacts: ${label} failed to parse (${p}) — skipping join`); return null; }
  };
  const index = readJsonIf(graphPath, 'graph-index');
  const entities = readJsonIf(entitiesPath, 'entities');

  REL_ROOT = rootAbs;
  const drafts = loadContactDrafts(draftsAbs);
  const registerText = fs.readFileSync(registerAbs, 'utf-8');
  const roster = buildContacts(cfg, registerText, index, entities, drafts, sourceRel);

  // ── summary to stderr (so --out - keeps stdout clean JSON) ──
  console.error(`kb-contacts: count=${roster.count}  linked=${roster.linked_count}  drafts=${roster.draft_count}`);
  console.error(`  statuses: ${Object.entries(roster.statuses).map(([k, v]) => `${k}=${v}`).join('  ')}`);
  console.error(`  flags:    ${Object.entries(roster.flags).map(([k, v]) => `${k}=${v}`).join('  ')}`);
  console.error(`  roles:    ${Object.entries(roster.company_roles).map(([k, v]) => `${k}=${v}`).join('  ')}`);

  if (check) { console.error('kb-contacts: --check (no file written)'); return 0; }

  const outPath = out
    ? (out === '-' ? '-' : path.resolve(process.cwd(), out))
    : path.resolve(__dirname, '_validation', 'contacts.kb.json');

  if (outPath === '-') {
    process.stdout.write(JSON.stringify(roster, null, 2) + '\n');
  } else {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const tmp = outPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(roster, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmp, outPath);
    console.error(`Wrote ${outPath} (contacts: ${roster.count})`);
  }
  return 0;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  process.exit(main());
}
