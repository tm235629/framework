#!/usr/bin/env node
/**
 * apply-moves.mjs — Phase-3: execute an APPROVED rename_map, reversibly.
 *
 * Generalizes MOT's __Literature/_migration/execute_moves.py into the gated,
 * reversible executor. It consumes a gate-2-approved rename_map.json and, on the
 * explicit --apply gate, performs the moves, logging EVERY operation to
 * executed_moves.json so a reverse replay restores the prior tree EXACTLY.
 * (Same audit-trail chain the literature kit proved:
 *  inventory.json → rename_map.json → executed_moves.json, reverse-replayable.)
 *
 *   DRY-RUN (default, no flag)  → pre-flight + print a change-plan, write NOTHING
 *   --apply                     → perform moves (gate 2), write executed_moves.json
 *   --rollback executed.json    → reverse-replay a prior run (new → old)
 *
 * ── HARD SAFETY: NO PATH MOVES A LIVE PROTECTED FILE IN THIS TASK ────────────
 * Two independent guards make a live-Drive mutation unreachable here:
 *   (1) PROTECTED-ROOT INTERLOCK. If the manifest root resolves to a path
 *       containing a protected live-Drive marker (read from the manifest's
 *       storage_profile.protected_root_markers; the reference instance fills
 *       'OneDrive - MetaOptics'), --apply is HARD-REFUSED unless the operator
 *       sets MIGRATION_TARGET_IS_NOT_PROTECTED=1 AND passes --i-understand.
 *       There is no other code path to a real move on that root. Dry-run is
 *       always allowed (it mutates nothing).
 *   (2) DRY-RUN DEFAULT. With no flag the script only prints the plan; the FIRST
 *       --apply is itself the user gate (PLAYBOOK gate 2). assertWritable() pins
 *       executed_moves.json under _validation/ unless MIGRATION_REAL_RUN=1.
 * The combination means: running this in the reference-instance (MOT) workspace
 * can ONLY dry-run. A real migration runs on a different Drive whose manifest
 * root carries no protected marker — exactly the intended reuse.
 *
 * Atomicity / synced-cloud safety (storage_profile guards):
 *   - per-op: mkdir -p dest dir, refuse if dest exists (no clobber), then rename;
 *     rename falls back to copy+unlink across volumes.
 *   - every op appended to the log as it completes, so an interrupted run is
 *     still fully rollback-able from the partial executed_moves.json.
 *
 * Usage:
 *   node migration/apply-moves.mjs <rename_map.json> [manifestPath] [opts]
 *     (no flag)            DRY-RUN: pre-flight + change-plan, writes nothing
 *     --apply              execute (gate 2). Refused on a protected live Drive (see guard 1)
 *     --rollback FILE      reverse-replay a prior executed_moves.json
 *     --out FILE           executed-log path (default _validation/executed_moves.sample.json)
 *     --json               machine-readable plan/result to stdout
 *   default manifestPath = tooling/manifest.json (pass manifest.mot.json explicitly for the reference instance)
 */

import fs from 'fs';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadManifest(manifestPath) {
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const cp = m.company_profile || {};
  const root = (m.person_profile && m.person_profile.root_override) ||
    (cp.storage_profile && cp.storage_profile.root);
  if (!root) throw new Error('manifest has no storage_profile.root');
  const sp = cp.storage_profile || {};
  return {
    root: root.replace(/\\/g, '/'),
    // Marker substrings that identify a LIVE / protected Drive (the tree this task
    // must never mutate). Read from the manifest — the reference instance fills
    // ['OneDrive - MetaOptics']; an unprotected target Drive leaves it empty.
    protectedRootMarkers: Array.isArray(sp.protected_root_markers) ? sp.protected_root_markers : [],
    churnGuards: sp.churn_guards !== false,
    lockGuards: sp.lock_guards !== false,
  };
}

function isProtectedRoot(root, markers) {
  return (markers || []).some(mk => root.includes(mk));
}

// GUARD 1: the protected-root interlock. Returns null if --apply is permitted, else a
// refusal reason string.
function applyRefusalReason(root, markers) {
  if (!isProtectedRoot(root, markers)) return null;
  const optedOut = process.env.MIGRATION_TARGET_IS_NOT_PROTECTED === '1';
  const understood = process.argv.includes('--i-understand');
  if (optedOut && understood) return null;
  return (
    `--apply refused: manifest root is a protected live Drive (${root}). ` +
    `apply-moves never mutates a protected tree in this kit. Run --apply only against a ` +
    `different Drive's manifest. (Override exists for that case: set ` +
    `MIGRATION_TARGET_IS_NOT_PROTECTED=1 and pass --i-understand — do NOT use on the protected Drive.)`);
}

function assertWritable(target) {
  const validationDir = path.resolve(__dirname, '_validation');
  const norm = path.resolve(target);
  const base = path.basename(norm);
  if (!/^executed_moves.*\.json$/i.test(base)) {
    throw new Error(`SAFETY: log out must be named executed_moves*.json, got: ${base}`);
  }
  if (!(norm === validationDir || norm.startsWith(validationDir + path.sep))) {
    if (process.env.MIGRATION_REAL_RUN !== '1') {
      throw new Error(`SAFETY: log out escapes _validation/ (${norm}); a real migration must set MIGRATION_REAL_RUN=1.`);
    }
  }
}

// ── one reversible move with no-clobber + cross-volume fallback ──────────────
function doMove(absOld, absNew, lockGuards) {
  fs.mkdirSync(path.dirname(absNew), { recursive: true });
  if (fs.existsSync(absNew)) throw new Error(`destination exists (refusing to clobber): ${absNew}`);
  const attempt = () => {
    try { fs.renameSync(absOld, absNew); }
    catch (e) {
      if (e.code === 'EXDEV') { fs.copyFileSync(absOld, absNew); fs.unlinkSync(absOld); }
      else throw e;
    }
  };
  if (!lockGuards) { attempt(); return; }
  // retry-on-EBUSY/EPERM for synced-cloud lock contention
  let lastErr;
  for (let i = 0; i < 5; i++) {
    try { attempt(); return; }
    catch (e) { lastErr = e; if (!['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) throw e; }
  }
  throw lastErr;
}

function flattenOps(plan) {
  const moves = (plan.moves || []).map(m => ({ old: m.old, new: m.new, why: 'move' }));
  const sup = (plan.superseded || []).map(s => ({ old: s.old, new: s.new, why: 'superseded', reason: s.reason }));
  return [...moves, ...sup];
}

function preflight(ops, root, supersededOlds) {
  const missing = [], clashes = [];
  const seenDst = new Set();
  for (const op of ops) {
    if (!fs.existsSync(path.join(root, op.old))) missing.push(op.old);
    const nl = op.new.toLowerCase();
    if (seenDst.has(nl)) clashes.push(`duplicate destination: ${op.new}`);
    seenDst.add(nl);
    if (fs.existsSync(path.join(root, op.new))) clashes.push(`destination already exists: ${op.new}`);
  }
  // a missing source that is a superseded surplus copy is non-fatal (it may have
  // already been parked) — mirrors execute_moves.py's hard_missing carve-out.
  const hardMissing = missing.filter(x => !supersededOlds.has(x));
  return { missing, hardMissing, clashes };
}

function main() {
  const args = process.argv.slice(2);
  const positionals = args.filter((a, i) => !a.startsWith('--') &&
    !['--out', '--rollback'].includes(args[i - 1]));
  const getOpt = (flag, def) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
  const asJson = args.includes('--json');
  const doApply = args.includes('--apply');
  const rollbackFile = getOpt('--rollback', null);

  const manifestPath = positionals[1]
    ? path.resolve(process.cwd(), positionals[1])
    : path.resolve(__dirname, '..', 'tooling', 'manifest.json');
  const M = loadManifest(manifestPath);
  const outPath = path.resolve(process.cwd(),
    getOpt('--out', path.resolve(__dirname, '_validation', 'executed_moves.sample.json')));

  // ── ROLLBACK mode: reverse-replay a prior executed_moves.json (new → old) ──
  if (rollbackFile) {
    const refusal = applyRefusalReason(M.root, M.protectedRootMarkers);   // rollback mutates too → same interlock
    if (refusal) { console.error(refusal.replace('--apply', '--rollback')); return 2; }
    const log = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), rollbackFile), 'utf-8'));
    const done = [];
    for (const op of [...(log.executed || [])].reverse()) {
      doMove(path.join(M.root, op.new), path.join(M.root, op.old), M.lockGuards);
      done.push({ from: op.new, to: op.old });
    }
    console.error(`rollback: restored ${done.length} files (reverse replay)`);
    if (asJson) process.stdout.write(JSON.stringify({ rolled_back: done.length }, null, 2) + '\n');
    return 0;
  }

  // ── normal mode: needs a rename_map ─────────────────────────────────────────
  const mapPath = positionals[0];
  if (!mapPath) { console.error('usage: apply-moves.mjs <rename_map.json> [manifest] [--apply|--rollback f]'); return 1; }
  const plan = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), mapPath), 'utf-8'));
  const ops = flattenOps(plan);
  const supersededOlds = new Set((plan.superseded || []).map(s => s.old));
  const { missing, hardMissing, clashes } = preflight(ops, M.root, supersededOlds);

  const planSummary = {
    schema: 'migration/apply@1',
    mode: doApply ? 'apply' : 'dry-run',
    manifest_root: M.root,
    root_is_protected: isProtectedRoot(M.root, M.protectedRootMarkers),
    ops_total: ops.length,
    missing_sources: missing.length,
    hard_missing: hardMissing.length,
    destination_clashes: clashes.length,
  };

  // print the change-plan (first N) — the human review surface on dry-run
  if (!asJson) {
    console.error(`apply-moves [${planSummary.mode}] — ${ops.length} ops`);
    console.error(`  manifest root        : ${M.root}`);
    console.error(`  root is protected    : ${planSummary.root_is_protected}`);
    console.error(`  missing sources      : ${missing.length} (hard: ${hardMissing.length})`);
    console.error(`  destination clashes  : ${clashes.length}`);
    console.error('  change-plan (first 8):');
    for (const op of ops.slice(0, 8)) console.error(`    ${op.why.padEnd(10)} ${op.old}  →  ${op.new}`);
    for (const c of clashes.slice(0, 5)) console.error(`    CLASH: ${c}`);
  }

  if (!doApply) {
    if (asJson) process.stdout.write(JSON.stringify(planSummary, null, 2) + '\n');
    else console.error('  DRY-RUN: wrote nothing. Re-run with --apply (gate 2) on a NON-PROTECTED Drive to execute.');
    return 0;
  }

  // ── --apply: gate 1 interlock, then gate 2 execution ───────────────────────
  const refusal = applyRefusalReason(M.root, M.protectedRootMarkers);
  if (refusal) { console.error(refusal); return 2; }
  if (hardMissing.length || clashes.length) {
    console.error('ABORT: pre-flight failures (hard-missing sources or destination clashes). Resolve before --apply.');
    return 1;
  }
  assertWritable(outPath);

  const executed = [];
  const skipped = [];
  // write the log incrementally so an interruption is still rollback-able
  const flush = () => fs.writeFileSync(outPath,
    JSON.stringify({ schema: 'migration/executed@1', root: M.root, source_map: path.basename(mapPath),
      generated_at: new Date().toISOString(), executed, skipped }, null, 1), 'utf-8');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  for (const op of ops) {
    const absOld = path.join(M.root, op.old);
    if (!fs.existsSync(absOld)) { skipped.push({ ...op, why_skipped: 'source already gone (likely pre-parked duplicate)' }); continue; }
    doMove(absOld, path.join(M.root, op.new), M.lockGuards);
    executed.push({ old: op.old, new: op.new, why: op.why });
    flush();
  }
  flush();
  console.error(`APPLIED ${executed.length} ops (${skipped.length} skipped). Log → ${outPath}`);
  console.error('  Rollback any time: node apply-moves.mjs --rollback ' + path.basename(outPath));
  if (asJson) process.stdout.write(JSON.stringify({ ...planSummary, executed: executed.length, skipped: skipped.length }, null, 2) + '\n');
  return 0;
}

process.exit(main());
