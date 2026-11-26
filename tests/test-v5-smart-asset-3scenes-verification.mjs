// tests/test-v5-smart-asset-3scenes-verification.mjs
// Verifies fix for Smart Asset Manager 27 vs 3 count bug, status merging,
// Mode A rig/anchor auto-linking, action engine resolution, and non-image prompt exclusion.

import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';

import {
  SmartAssetManager,
  scanScenePlanRequirements,
  deduplicateAssetRequirements,
  resolveAssetRequirement,
  batchResolveRequirements,
  exportPromptsMarkdown,
  exportFilenameMappingCsv,
  calculateProjectReadiness,
  isVisualAssetRequirement
} from '../thanhhai-2d-studio/engine/v5-smart-asset-manager.js';

async function runTests() {
  console.log('================================================================');
  console.log('TEST V5 SMART ASSET MANAGER: 3-SCENE PLAN & RESOLUTION FIXES');
  console.log('================================================================\n');

  let passed = 0;
  function pass(desc) {
    passed++;
    console.log(`[PASS] ${passed}. ${desc}`);
  }

  // --- Test 1: 5-scene demo plan followed by 3-scene plan does NOT accumulate nodes (Bug 27 vs 3) ---
  const demoPlan = {
    schemaVersion: "5.1",
    project: { id: "demo_5_scenes", title: "Evolution of Computers" },
    style: { profileId: "educational_cartoon" },
    scenes: [
      { id: "s001", background: { assetId: "bg_historical_computer_lab" }, characters: [{ characterId: "doc", prop: { assetId: "prop_eniac" } }] },
      { id: "s002", background: { assetId: "bg_lab_modern" }, characters: [{ characterId: "doc", prop: { assetId: "prop_transistor" } }] },
      { id: "s003", background: { assetId: "bg_historical_computer_lab" }, characters: [{ characterId: "doc" }] },
      { id: "s004", background: { assetId: "bg_lab_modern" }, characters: [{ characterId: "jake", prop: { assetId: "prop_laptop" } }] },
      { id: "s005", background: { assetId: "bg_historical_computer_lab" }, characters: [{ characterId: "doc" }] }
    ]
  };

  const threeScenePlan = {
    schemaVersion: "5.1",
    project: { id: "proj_real_3scenes", title: "Phim Hoạt Hình 3 Cảnh Thực Tế" },
    style: { profileId: "educational_cartoon" },
    scenes: [
      {
        id: "s001",
        background: { assetId: "bg_cafe_cozy" },
        characters: [{ characterId: "doc", outfitId: "outfit_casual_hoodie", expressionId: "happy", prop: { assetId: "prop_coffee_cup", attachedTo: "right_hand" } }],
        visualBeats: [{ actionId: "idle_talk" }]
      },
      {
        id: "s002",
        background: { assetId: "bg_street_night" },
        characters: [{ characterId: "doc", outfitId: "outfit_casual_hoodie", expressionId: "thinking" }],
        visualBeats: [{ actionId: "walk_cycle" }]
      },
      {
        id: "s003",
        background: { assetId: "bg_cafe_cozy" },
        characters: [{ characterId: "doc", outfitId: "outfit_casual_hoodie", expressionId: "happy" }],
        visualBeats: [{ actionId: "celebrate" }]
      }
    ]
  };

  const mgr = new SmartAssetManager(null, demoPlan);
  const res1 = mgr.scanAndResolve();
  assert.ok(res1.dedup.canonicalRequirements.length > 0, 'Demo plan should produce canonical requirements');

  // Now scan the 3-scene plan on the same manager instance
  mgr.scenePlan = threeScenePlan;
  const res2 = mgr.scanAndResolve();

  assert.strictEqual(
    res2.dedup.canonicalRequirements.length,
    res2.readiness.counts.totalAssets,
    `Single Source of Truth: Canonical requirements (${res2.dedup.canonicalRequirements.length}) must strictly equal readiness totalAssets (${res2.readiness.counts.totalAssets})`
  );
  assert.ok(
    res2.readiness.counts.totalAssets < 20,
    `Total assets should be strictly for 3 scenes (~12), NOT accumulated from demo (got ${res2.readiness.counts.totalAssets})`
  );
  pass('Graph node accumulation bug resolved: 3-scene scan does not retain 5-scene ghost requirements');

  // --- Test 2: Statuses, reasons, and resolvedAssetId are merged into canonicalRequirements ---
  for (const req of res2.dedup.canonicalRequirements) {
    assert.ok(req.status, `Requirement ${req.id} must have a defined status`);
    assert.ok(Array.isArray(req.reasons), `Requirement ${req.id} must have reasons array`);
    assert.ok(req.reasons.length > 0, `Requirement ${req.id} must have at least one explanation reason`);
  }
  pass('All canonical requirements have defined status and detailed explanation reasons');

  // --- Test 3: Mode A Character Rig & Anchor Points are automatically resolved to READY ---
  const rigReq = res2.dedup.canonicalRequirements.find(r => r.type === 'character_rig');
  assert.ok(rigReq, 'Should have a character_rig requirement for Doc');
  assert.strictEqual(rigReq.status, 'READY', 'Doc character rig must be READY');
  assert.strictEqual(rigReq.resolutionMethod, 'BUILTIN_RIG', 'Resolution method should be BUILTIN_RIG');

  const anchorReq = res2.dedup.canonicalRequirements.find(r => r.type === 'anchor_point');
  assert.ok(anchorReq, 'Should have an anchor_point requirement for Doc right hand');
  assert.strictEqual(anchorReq.status, 'READY', 'Doc hand anchor must be READY');
  assert.strictEqual(anchorReq.resolutionMethod, 'BUILTIN_RIG_ANCHOR', 'Resolution method should be BUILTIN_RIG_ANCHOR');
  pass('Mode A character (Doc) automatically links built-in rig and hand anchors to READY');

  // --- Test 4: Procedural actions (idle_talk, walk_cycle, celebrate) resolve to READY ---
  const actionReqs = res2.dedup.canonicalRequirements.filter(r => r.type === 'action');
  assert.strictEqual(actionReqs.length, 3, 'Should have 3 action requirements');
  for (const act of actionReqs) {
    assert.strictEqual(act.status, 'READY', `Action ${act.id} should be READY, not MISSING_CAPABILITY`);
  }
  pass('Standard procedural actions (idle_talk, walk_cycle, celebrate) resolved to READY');

  // --- Test 5: Entire 3-scene plan with library assets resolves to ASSETS_READY ---
  assert.strictEqual(res2.readiness.projectStatus, 'ASSETS_READY', 'All 3 scenes should be ASSETS_READY');
  assert.strictEqual(res2.readiness.counts.missingAssetCount, 0, 'Missing assets should be 0');
  assert.strictEqual(res2.readiness.counts.missingCapabilityCount, 0, 'Missing capability should be 0');
  pass('Complete 3-scene plan is fully resolved with ASSETS_READY status');

  // --- Test 6: Truly missing asset & truly unsupported capability are correctly blocked ---
  const planWithBlockers = {
    schemaVersion: "5.1",
    scenes: [
      {
        id: "s001",
        characters: [{ characterId: "doc", prop: { assetId: "prop_non_existent_laser_cannon_xyz" } }],
        visualBeats: [{ actionId: "do_quantum_time_warp_flip_impossible" }]
      }
    ]
  };

  const mgrBlocker = new SmartAssetManager(null, planWithBlockers);
  const resBlocker = mgrBlocker.scanAndResolve();
  assert.strictEqual(resBlocker.readiness.projectStatus, 'BLOCKED', 'Plan with unsupported action must be BLOCKED');
  assert.strictEqual(resBlocker.readiness.counts.missingAssetCount, 1, 'Should report 1 missing asset');
  assert.strictEqual(resBlocker.readiness.counts.missingCapabilityCount, 1, 'Should report 1 missing capability');

  const blockedAct = resBlocker.dedup.canonicalRequirements.find(r => r.id.includes('QUANTUM_TIME_WARP'));
  assert.strictEqual(blockedAct.status, 'MISSING_CAPABILITY', 'Unsupported action must have status MISSING_CAPABILITY');
  assert.ok(blockedAct.reasons[0].includes('chưa hỗ trợ'), 'Reason must explain unsupported action');
  pass('Authentic missing asset and unsupported capability are accurately blocked with explanation');

  // --- Test 7: Non-image assets are excluded from image generation prompts ---
  const md = exportPromptsMarkdown(res2.dedup.canonicalRequirements);
  assert.ok(!md.includes('ANCHOR_POINT'), 'Prompts markdown must not contain ANCHOR_POINT');
  assert.ok(!md.includes('CHARACTER_RIG'), 'Prompts markdown must not contain CHARACTER_RIG');
  assert.ok(!md.includes('[ACTION]'), 'Prompts markdown must not contain [ACTION]');

  const csv = exportFilenameMappingCsv(res2.dedup.canonicalRequirements);
  assert.ok(!csv.includes('anchor_point'), 'CSV must not contain anchor_point');
  assert.ok(!csv.includes('character_rig'), 'CSV must not contain character_rig');
  assert.ok(!csv.includes('action'), 'CSV must not contain action');
  pass('Non-image assets are cleanly excluded from generation package prompts and CSV');

  console.log(`\n================================================================`);
  console.log(`ALL ${passed} VERIFICATION TESTS PASSED SUCCESSFULLY (100%)!`);
  console.log(`================================================================\n`);
}

runTests().catch(err => {
  console.error('[FAIL] Test threw unexpected error:', err);
  process.exit(1);
});

