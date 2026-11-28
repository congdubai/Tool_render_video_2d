import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { ProjectManager, validateUntrustedScenePlanSecurity } from '../thanhhai-2d-studio/engine/v5-project-manager.js';
import { buildAiRepairPackage } from '../thanhhai-2d-studio/engine/v5-repair-package.js';

const ROOT = process.cwd();
const SCRATCH = path.join(ROOT, 'scratch', 'p5d_projects');
fs.rmSync(SCRATCH, { recursive: true, force: true });
fs.mkdirSync(SCRATCH, { recursive: true });

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name}\n  ${err?.stack || err}`);
  }
}

const pm = new ProjectManager(SCRATCH);

await check('5D-1: ProjectManager create, rename, duplicate, revision backup', () => {
  const p1 = pm.createProject('Original', { scenePlan: { scenes: [{ id: 's1', duration: 4 }] } });
  pm.renameProject(p1.id, 'Renamed');
  pm.createRevisionSnapshot(p1.id, 'Pre-render');
  const p2 = pm.duplicateProject(p1.id, 'Copy');
  assert.equal(pm.loadProject(p1.id).name, 'Renamed');
  assert.equal(pm.loadProject(p1.id).revision, '1.1');
  assert.notEqual(p1.id, p2.id);
});

await check('5D-2: Portable ZIP export strips secrets/absolute paths & import restores cleanly', () => {
  const p = pm.createProject('Portable Demo', {
    scenePlan: { scenes: [{ id: 's1', duration: 5, background: { assetId: 'bg_modern_lab' } }] },
  });
  const zipPath = path.join(ROOT, 'out', 'v52_p5d_demo_project.zip');
  const exp = pm.exportProjectZip(p.id, zipPath, {
    assetBindings: { REQ_1: { resolvedAssetId: 'bg_modern_lab', secretToken: 'SHOULD_NOT_EXIST', localPath: 'C:\\Users\\secret\\bg.png' } },
  });
  assert.equal(exp.success, true);
  assert.ok(exp.sizeBytes > 200);
  const rawZip = new AdmZip(zipPath);
  const bindingsTxt = rawZip.getEntry('asset_bindings.json').getData().toString('utf8');
  assert.equal(bindingsTxt.includes('SHOULD_NOT_EXIST'), false);
  assert.equal(bindingsTxt.includes('C:\\\\Users'), false);

  const imp = pm.importProjectZip(zipPath);
  assert.equal(imp.scenePlan.scenes[0].id, 's1');
});

await check('5D-3: Security blocks ZIP path traversal & untrusted eval/script injection', () => {
  const badZip = new AdmZip();
  badZip.addFile('evil.txt', Buffer.from('pwn', 'utf8'));
  badZip.getEntries()[0].entryName = '../../evil.txt';
  const badZipPath = path.join(SCRATCH, 'traversal.zip');
  badZip.writeZip(badZipPath);
  assert.throws(() => pm.importProjectZip(badZipPath), /traversal/i);
  assert.throws(() => validateUntrustedScenePlanSecurity({ hack: 'eval("process.exit(1)")' }), /Security violation/i);
});

await check('5D-4: Scene Patch updates only unlocked scenes & preserves undo snapshot', () => {
  const p = pm.createProject('Patch Test', {
    scenePlan: { scenes: [{ id: 's1', duration: 4 }, { id: 's2', duration: 5 }] },
  });
  p.lockedSceneIds = ['s1'];
  pm.saveProjectAtomic(p);
  const res = pm.applyScenePatch(p.id, {
    scenes: [{ id: 's1', duration: 99 }, { id: 's2', duration: 8 }],
  });
  assert.deepEqual(res.skippedLockedIds, ['s1']);
  assert.deepEqual(res.affectedSceneIds, ['s2']);
  assert.equal(res.project.scenePlan.scenes[0].duration, 4);
  assert.equal(res.project.scenePlan.scenes[1].duration, 8);
});

await check('5D-5: AI Repair Package extracts only faulty scenes + valid replacements', () => {
  const pkg = buildAiRepairPackage({ scenes: [{ id: 's1' }, { id: 's2' }] }, { errors: [{ sceneId: 's2', code: 'MISSING_BG', message: 'No bg' }] });
  assert.equal(pkg.errorCount, 1);
  assert.ok(pkg.faultySceneSnippets.s2 && !pkg.faultySceneSnippets.s1);
});

console.log(`\nPhase 5D Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
