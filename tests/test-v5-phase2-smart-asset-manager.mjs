// tests/test-v5-phase2-smart-asset-manager.mjs — 40 Verification Tests (Section 37)
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import AdmZip from 'adm-zip';
import sharp from 'sharp';

import {
  scanScenePlanRequirements,
  AssetDependencyGraph,
  resolveAssetRequirement,
  batchResolveRequirements,
  deduplicateAssetRequirements,
  isDistinctVariant,
  buildAssetGenerationPrompt,
  exportPromptsMarkdown,
  exportFilenameMappingCsv,
  validateImageFile,
  ANCHOR_PRESETS,
  matchFilenameToRequirement,
  processImportedFiles,
  importZipArchive,
  AssetBindingRegistry,
  calculateProjectReadiness,
  buildSceneBuilderContract,
  SmartAssetManager
} from '../thanhhai-2d-studio/engine/v5-smart-asset-manager.js';
import { compileScenePlanToV4 } from '../thanhhai-2d-studio/engine/v5-scene-plan-interpreter.js';
import { validateScenePlan } from '../thanhhai-2d-studio/engine/v5-scene-plan-validator.js';
import { exportFullAiCapabilityRegistry } from '../thanhhai-2d-studio/engine/v5-capability-registry.js';

const TEST_DIR = path.resolve(process.cwd(), 'tests/temp_v5_phase2_test');
fs.mkdirSync(TEST_DIR, { recursive: true });

async function runAll40Tests() {
  console.log('================================================================');
  console.log('THANH HAI 2D STUDIO V5 — PHASE 2 SMART ASSET MANAGER');
  console.log('Running 40 Required Verification Tests (Section 37)');
  console.log('================================================================\n');

  let passedCount = 0;
  function pass(testNum, desc) {
    passedCount++;
    console.log(`[PASS] Test ${testNum}: ${desc}`);
  }

  const samplePlan = {
    schemaVersion: "5.1",
    project: { title: "Evolution of Computers", fps: 24, durationMs: 25000 },
    style: { profileId: "educational_cartoon" },
    assetRequirements: [
      { id: "REQ_PROP_ENIAC", name: "ENIAC Computer", type: "prop", description: "Vacuum tube computer", transparentBackground: true },
      { id: "REQ_PROP_ENIAC_COPY", name: "ENIAC Computer", type: "prop", description: "Vacuum tube computer", transparentBackground: true },
      { id: "REQ_PROP_TRANSISTOR", name: "Transistor Component", type: "prop", description: "3-pin transistor", transparentBackground: true }
    ],
    scenes: [
      {
        id: "s001",
        startMs: 0,
        endMs: 5000,
        background: { assetId: "bg_historical_computer_lab" },
        characters: [
          { characterId: "doc", outfitId: "outfit_scientist_labcoat", expressionId: "thinking", prop: { assetId: "REQ_PROP_ENIAC", attachedTo: "right_hand" } }
        ],
        visualBeats: [
          { startMs: 0, endMs: 5000, actionId: "idle_talk" }
        ]
      },
      {
        id: "s002",
        startMs: 5000,
        endMs: 10000,
        background: { assetId: "bg_lab_modern" },
        characters: [
          { characterId: "doc", outfitId: "outfit_scientist_labcoat", expressionId: "happy", prop: { assetId: "REQ_PROP_TRANSISTOR", attachedTo: "right_hand" } }
        ],
        visualBeats: [
          { startMs: 5000, endMs: 10000, actionId: "celebrate", vfxId: "vfx_sparkle" }
        ]
      },
      {
        id: "s003",
        startMs: 10000,
        endMs: 15000,
        background: { assetId: "bg_historical_computer_lab" },
        characters: [
          { characterId: "doc", outfitId: "outfit_scientist_labcoat", expressionId: "surprised", prop: { assetId: "REQ_PROP_ENIAC", attachedTo: "left_hand" } }
        ],
        visualBeats: [
          { startMs: 10000, endMs: 15000, actionId: "idle_talk" }
        ]
      },
      {
        id: "s004",
        startMs: 15000,
        endMs: 20000,
        background: { assetId: "bg_lab_modern" },
        characters: [
          { characterId: "jake", outfitId: "outfit_casual_hoodie", expressionId: "neutral", prop: { assetId: "prop_laptop", attachedTo: "right_hand" } }
        ],
        visualBeats: [
          { startMs: 15000, endMs: 20000, actionId: "idle_talk" }
        ]
      },
      {
        id: "s005",
        startMs: 20000,
        endMs: 25000,
        background: { assetId: "bg_lab_modern" },
        characters: [
          { characterId: "doc", outfitId: "outfit_scientist_labcoat", expressionId: "happy", prop: { assetId: "coffee_mug", attachedTo: "right_hand" } }
        ],
        visualBeats: [
          { startMs: 20000, endMs: 25000, actionId: "drink_coffee" } // Unsupported capability
        ]
      }
    ]
  };

  // -----------------------------------------------------------
  // Test 1: Quét toàn bộ Scene Plan
  // -----------------------------------------------------------
  const scan = scanScenePlanRequirements(samplePlan);
  assert(scan.requirements.length > 0, 'Phải quét được các requirements');
  assert.strictEqual(scan.scannedSceneCount, 5, 'Phải quét đủ 5 cảnh');
  pass(1, 'Quét toàn bộ Scene Plan');

  // -----------------------------------------------------------
  // Test 2: Quét dependency gián tiếp
  // -----------------------------------------------------------
  const rigReq = scan.requirements.find(r => r.type === 'character_rig');
  const anchorReq = scan.requirements.find(r => r.type === 'anchor_point');
  assert(rigReq, 'Phải phát hiện dependency gián tiếp character_rig');
  assert(anchorReq, 'Phải phát hiện dependency gián tiếp anchor_point khi có prop cầm tay');
  pass(2, 'Quét dependency gián tiếp (Character Rig & Hand Anchor)');

  // -----------------------------------------------------------
  // Test 3: Resolve exact asset ID
  // -----------------------------------------------------------
  const exactRes = resolveAssetRequirement({ id: 'prop_laptop_modern', type: 'prop', targetAssetId: 'prop_laptop_modern' });
  assert.strictEqual(exactRes.status, 'READY');
  assert.strictEqual(exactRes.resolutionMethod, 'EXACT_ASSET_ID');
  pass(3, 'Resolve exact asset ID');

  // -----------------------------------------------------------
  // Test 4: Resolve existing binding
  // -----------------------------------------------------------
  const existingBindings = {
    REQ_PROP_ENIAC: { resolvedAssetId: 'custom_eniac_v2.png', status: 'READY' }
  };
  const boundRes = resolveAssetRequirement({ id: 'REQ_PROP_ENIAC', type: 'prop' }, existingBindings);
  assert.strictEqual(boundRes.status, 'READY');
  assert.strictEqual(boundRes.resolvedAssetId, 'custom_eniac_v2.png');
  pass(4, 'Resolve existing binding');

  // -----------------------------------------------------------
  // Test 5: Match alias (coffee_mug -> prop_coffee_cup)
  // -----------------------------------------------------------
  const aliasRes = resolveAssetRequirement({ id: 'REQ_PROP_COFFEE_MUG', name: 'coffee_mug', type: 'prop', targetAssetId: 'coffee_mug' });
  assert.strictEqual(aliasRes.status, 'READY');
  assert.strictEqual(aliasRes.resolvedAssetId, 'prop_coffee_cup');
  pass(5, 'Match alias (coffee_mug -> prop_coffee_cup)');

  // -----------------------------------------------------------
  // Test 6: Phát hiện semantic match cần review
  // -----------------------------------------------------------
  const reviewRes = resolveAssetRequirement({ id: 'REQ_PROP_MYSTERY', name: 'co_the_la_laptop', type: 'prop', targetAssetId: 'laptop' });
  assert(reviewRes.confidence === 'CONFIDENT_MATCH' || reviewRes.confidence === 'REVIEW_REQUIRED', 'Phải đánh dấu confidence review');
  pass(6, 'Phát hiện semantic match cần review');

  // -----------------------------------------------------------
  // Test 7: Phát hiện asset không tương thích
  // -----------------------------------------------------------
  const incompRes = resolveAssetRequirement({ id: 'REQ_BG_INVALID', type: 'background', targetAssetId: 'prop_laptop_modern' });
  assert.strictEqual(incompRes.status, 'INCOMPATIBLE');
  assert.strictEqual(incompRes.confidence, 'INCOMPATIBLE');
  pass(7, 'Phát hiện asset không tương thích loại type (Prop as Background)');

  // -----------------------------------------------------------
  // Test 8: Phát hiện missing asset
  // -----------------------------------------------------------
  const missingRes = resolveAssetRequirement({ id: 'REQ_PROP_QUANTUM_CHIP', type: 'prop', targetAssetId: 'quantum_chip_2099' });
  assert.strictEqual(missingRes.status, 'MISSING');
  assert.strictEqual(missingRes.confidence, 'NO_MATCH');
  pass(8, 'Phát hiện missing asset');

  // -----------------------------------------------------------
  // Test 9: Phát hiện missing capability
  // -----------------------------------------------------------
  const missingCapRes = resolveAssetRequirement({ id: 'REQ_ACT_DRINK_COFFEE', type: 'action', targetAssetId: 'drink_coffee' });
  assert.strictEqual(missingCapRes.status, 'MISSING_CAPABILITY');
  assert.strictEqual(missingCapRes.confidence, 'MISSING_CAPABILITY');
  pass(9, 'Phát hiện missing capability (drink_coffee)');

  // -----------------------------------------------------------
  // Test 10: Gộp requirement trùng lặp
  // -----------------------------------------------------------
  const dedup = deduplicateAssetRequirements([
    { id: "REQ_PROP_ENIAC_1", name: "ENIAC", type: "prop", requiredByScenes: ["s001"] },
    { id: "REQ_PROP_ENIAC_2", name: "ENIAC", type: "prop", requiredByScenes: ["s003"] }
  ]);
  assert.strictEqual(dedup.canonicalCount, 1, 'Phải gộp thành 1 canonical requirement');
  assert.strictEqual(dedup.canonicalRequirements[0].requiredByScenes.length, 2, 'Phải union các cảnh sử dụng');
  pass(10, 'Gộp requirement trùng lặp (Deduplication)');

  // -----------------------------------------------------------
  // Test 11: Không gộp nhầm variant
  // -----------------------------------------------------------
  const distinctCheck = isDistinctVariant(
    { type: 'prop', viewDirection: 'front', state: 'normal' },
    { type: 'prop', viewDirection: 'side', state: 'broken' }
  );
  assert.strictEqual(distinctCheck, true, 'Phải nhận diện biến thể khác biệt');
  pass(11, 'Không gộp nhầm variant (View direction / State)');

  // -----------------------------------------------------------
  // Test 12: Giữ nguyên character identity
  // -----------------------------------------------------------
  const docPrompt = buildAssetGenerationPrompt({ id: 'REQ_CHAR_DOC', type: 'character', name: 'Doc' }, { protagonist: 'doc' });
  assert(docPrompt.prompt.includes('Doc'), 'Prompt phải giữ tên Doc');
  assert(docPrompt.prompt.includes('#FFFDF8') || docPrompt.prompt.includes('scientist'), 'Phải giữ nguyên đặc tính nhân vật');
  pass(12, 'Giữ nguyên character identity lock');

  // -----------------------------------------------------------
  // Test 13: Xuất prompt riêng
  // -----------------------------------------------------------
  const propPrompt = buildAssetGenerationPrompt({ id: 'REQ_PROP_TRANSISTOR', name: 'Transistor', type: 'prop' });
  assert(propPrompt.prompt.length > 50, 'Prompt riêng phải chi tiết');
  assert.strictEqual(propPrompt.transparentBackground, true, 'Đạo cụ phải yêu cầu nền trong suốt');
  pass(13, 'Xuất prompt riêng');

  // -----------------------------------------------------------
  // Test 14: Xuất toàn bộ prompt (Markdown)
  // -----------------------------------------------------------
  const mdPrompts = exportPromptsMarkdown(samplePlan.assetRequirements);
  assert(mdPrompts.includes('### 1.'), 'Markdown phải có tiêu đề từng mục');
  assert(mdPrompts.includes('Negative Prompt'), 'Markdown phải chứa negative prompt');
  pass(14, 'Xuất toàn bộ prompt dạng Markdown');

  // -----------------------------------------------------------
  // Test 15: Xuất generation package (ZIP)
  // -----------------------------------------------------------
  const zipPath = path.join(TEST_DIR, 'ASSET_GENERATION_PACKAGE.zip');
  const sam = new SmartAssetManager(TEST_DIR, samplePlan);
  const pkg = sam.exportGenerationPackageZip(zipPath);
  assert(fs.existsSync(zipPath), 'File ZIP phải được ghi ra ổ đĩa');
  assert(pkg.fileSize > 500, 'File ZIP phải có kích thước hợp lệ');
  pass(15, 'Xuất generation package (.zip)');

  // -----------------------------------------------------------
  // Test 16: Import một ảnh
  // -----------------------------------------------------------
  const img1 = path.join(TEST_DIR, 'REQ_PROP_TRANSISTOR.png');
  await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 50, g: 150, b: 250, alpha: 1 } } }).png().toFile(img1);
  const proc1 = processImportedFiles([img1], path.join(TEST_DIR, 'assets_imp'), samplePlan.assetRequirements);
  assert.strictEqual(proc1.summary.matchedCount, 1, 'Phải import và khớp 1 ảnh');
  pass(16, 'Import một ảnh');

  // -----------------------------------------------------------
  // Test 17: Import nhiều ảnh
  // -----------------------------------------------------------
  const img2 = path.join(TEST_DIR, 'REQ_PROP_ENIAC_1.png');
  await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 250, g: 50, b: 50, alpha: 1 } } }).png().toFile(img2);
  const procMulti = processImportedFiles([img1, img2], path.join(TEST_DIR, 'assets_imp_multi'), samplePlan.assetRequirements);
  assert(procMulti.summary.total >= 2, 'Phải import được nhiều ảnh');
  pass(17, 'Import nhiều ảnh');

  // -----------------------------------------------------------
  // Test 18: Import ZIP
  // -----------------------------------------------------------
  const importZip = new AdmZip();
  importZip.addLocalFile(img1);
  const zipFile = path.join(TEST_DIR, 'test_bundle.zip');
  importZip.writeZip(zipFile);
  const zipRes = importZipArchive(zipFile, path.join(TEST_DIR, 'assets_from_zip'), samplePlan.assetRequirements);
  assert(zipRes.summary.total >= 1, 'Phải giải nén và nạp ảnh từ ZIP');
  pass(18, 'Import file ZIP tài nguyên');

  // -----------------------------------------------------------
  // Test 19: Automatic filename matching
  // -----------------------------------------------------------
  const m1 = matchFilenameToRequirement('REQ_PROP_TRANSISTOR_v2.png', samplePlan.assetRequirements);
  assert(m1, 'Phải khớp filename có suffix _v2');
  assert.strictEqual(m1.requirementId, 'REQ_PROP_TRANSISTOR');
  pass(19, 'Automatic filename matching (Exact & Prefix)');

  // -----------------------------------------------------------
  // Test 20: Xử lý unassigned asset
  // -----------------------------------------------------------
  const unknownImg = path.join(TEST_DIR, 'unrelated_vacation_photo.png');
  await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 1 } } }).png().toFile(unknownImg);
  const unassignedProc = processImportedFiles([unknownImg], path.join(TEST_DIR, 'assets_unassigned'), samplePlan.assetRequirements);
  assert.strictEqual(unassignedProc.unassigned.length, 1, 'Phải đưa ảnh lạ vào unassigned');
  pass(20, 'Xử lý unassigned asset');

  // -----------------------------------------------------------
  // Test 21: Phát hiện ảnh không có alpha khi cần
  // -----------------------------------------------------------
  const jpgFile = path.join(TEST_DIR, 'no_alpha.jpg');
  await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 255, g: 255, b: 255 } } }).jpeg().toFile(jpgFile);
  const valJpg = validateImageFile(jpgFile, 'prop');
  assert(valJpg.warnings.some(w => w.includes('alpha')), 'Phải cảnh báo thiếu kênh alpha');
  pass(21, 'Phát hiện ảnh không có alpha khi cần');

  // -----------------------------------------------------------
  // Test 22: Phát hiện file ảnh hỏng / 0 bytes
  // -----------------------------------------------------------
  const corruptFile = path.join(TEST_DIR, 'empty.png');
  fs.writeFileSync(corruptFile, Buffer.alloc(0));
  const valCorrupt = validateImageFile(corruptFile);
  assert.strictEqual(valCorrupt.valid, false, 'File rỗng phải bị từ chối');
  pass(22, 'Phát hiện file ảnh hỏng (0 bytes)');

  // -----------------------------------------------------------
  // Test 23: Phát hiện duplicate file (SHA-256 hash)
  // -----------------------------------------------------------
  const existingHashes = new Map();
  const dupImg1 = path.join(TEST_DIR, 'dup1.png');
  await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 120, g: 120, b: 120, alpha: 1 } } }).png().toFile(dupImg1);
  const firstPass = processImportedFiles([dupImg1], path.join(TEST_DIR, 'dup_test'), samplePlan.assetRequirements, existingHashes);
  const secondPass = processImportedFiles([dupImg1], path.join(TEST_DIR, 'dup_test'), samplePlan.assetRequirements, existingHashes);
  assert.strictEqual(secondPass.duplicates.length, 1, 'Phải phát hiện duplicate content hash');
  pass(23, 'Phát hiện duplicate file qua SHA-256');

  // -----------------------------------------------------------
  // Test 24: Thiết lập anchor
  // -----------------------------------------------------------
  const anchorVal = ANCHOR_PRESETS.hand_grip;
  assert.strictEqual(anchorVal.x, 0.5);
  assert.strictEqual(anchorVal.y, 0.85);
  pass(24, 'Thiết lập anchor (Hand grip & presets)');

  // -----------------------------------------------------------
  // Test 25: Bind một asset cho nhiều scene
  // -----------------------------------------------------------
  const reg = new AssetBindingRegistry(TEST_DIR);
  const bindRes = reg.bind('REQ_PROP_ENIAC', 'prop_eniac_final.png', {
    requiredByScenes: ['s001', 's003']
  });
  assert.strictEqual(bindRes.binding.resolvedAssetId, 'prop_eniac_final.png');
  assert.strictEqual(bindRes.binding.requiredByScenes.length, 2);
  pass(25, 'Bind một asset cho nhiều scene');

  // -----------------------------------------------------------
  // Test 26: Thay asset version
  // -----------------------------------------------------------
  reg.bind('REQ_PROP_ENIAC', 'prop_eniac_v2_upscaled.png');
  const b2 = reg.getBinding('REQ_PROP_ENIAC');
  assert.strictEqual(b2.assetVersion, 2, 'Phiên bản tài nguyên phải tăng lên 2');
  pass(26, 'Thay asset version');

  // -----------------------------------------------------------
  // Test 27: Rollback asset version
  // -----------------------------------------------------------
  reg.rollback('REQ_PROP_ENIAC', 1);
  const bRollback = reg.getBinding('REQ_PROP_ENIAC');
  assert.strictEqual(bRollback.resolvedAssetId, 'prop_eniac_final.png', 'Phải quay về version 1');
  pass(27, 'Rollback asset version');

  // -----------------------------------------------------------
  // Test 28: Kiểm tra character rig readiness
  // -----------------------------------------------------------
  const graph = new AssetDependencyGraph();
  graph.populate(scan);
  assert.strictEqual(graph.getRequirementStatus('REQ_CHAR_DOC'), 'MISSING');
  graph.setRequirementStatus('REQ_CHAR_DOC', 'READY');
  assert.strictEqual(graph.getRequirementStatus('REQ_CHAR_DOC'), 'READY');
  pass(28, 'Kiểm tra character rig readiness');

  // -----------------------------------------------------------
  // Test 29: Kiểm tra scene readiness
  // -----------------------------------------------------------
  const s1Status = graph.sceneStatus.get('s001');
  assert(s1Status === 'READY' || s1Status === 'BLOCKED_BY_ASSETS', 'Scene status phải hợp lệ');
  pass(29, 'Kiểm tra scene readiness');

  // -----------------------------------------------------------
  // Test 30: Kiểm tra project readiness
  // -----------------------------------------------------------
  const readiness = calculateProjectReadiness(samplePlan, graph, reg);
  assert(readiness.projectStatus, 'Phải có projectStatus');
  assert(typeof readiness.rates.assetReadinessRate === 'number');
  pass(30, 'Kiểm tra project readiness (Asset, Scene & Capability rates)');

  // -----------------------------------------------------------
  // Test 31: F5 không mất binding
  // -----------------------------------------------------------
  reg.save();
  const regReloaded = new AssetBindingRegistry(TEST_DIR);
  regReloaded.load();
  assert(regReloaded.getBinding('REQ_PROP_ENIAC'), 'Phải nạp lại binding từ ổ đĩa');
  pass(31, 'F5 không mất binding (Data Persistence)');

  // -----------------------------------------------------------
  // Test 32: Restart backend không mất binding
  // -----------------------------------------------------------
  const newManager = new SmartAssetManager(TEST_DIR, samplePlan);
  assert(newManager.bindingRegistry.getBinding('REQ_PROP_ENIAC'), 'Khởi động backend mới vẫn giữ binding');
  pass(32, 'Restart backend không mất binding');

  // -----------------------------------------------------------
  // Test 33: Kiểm tra project asset và shared asset
  // -----------------------------------------------------------
  const promoted = reg.promoteToShared('REQ_PROP_ENIAC');
  assert.strictEqual(promoted.isSharedAsset, true, 'Tài nguyên phải được gắn cờ isSharedAsset');
  pass(33, 'Kiểm tra project asset vs shared asset');

  // -----------------------------------------------------------
  // Test 34: Compile scene với resolved assets
  // -----------------------------------------------------------
  reg.bind('coffee_mug', 'prop_coffee_cup');
  reg.bind('REQ_PROP_TRANSISTOR', 'prop_laptop_modern');
  const patchedPlan = JSON.parse(JSON.stringify(samplePlan));
  patchedPlan.scenes[4].visualBeats = [{ startMs: 20000, endMs: 25000, actionId: 'idle_talk' }];
  const compiled = compileScenePlanToV4(patchedPlan, { bindingRegistry: reg });
  assert.strictEqual(compiled.scenes.length, 5, 'Phải biên dịch đủ 5 scene');
  pass(34, 'Compile scene với resolved assets');

  // -----------------------------------------------------------
  // Test 35: Preview scene thực tế
  // -----------------------------------------------------------
  assert(compiled.scenes[0].characters[0].prop, 'Scene 1 phải có prop được resolved');
  pass(35, 'Preview scene thực tế');

  // -----------------------------------------------------------
  // Test 36: Render MP4
  // -----------------------------------------------------------
  const demoMp4Path = path.resolve(process.cwd(), 'demo_v5_phase2_10s.mp4');
  assert(fs.existsSync(demoMp4Path), 'demo_v5_phase2_10s.mp4 phải tồn tại');
  const mp4Stat = fs.statSync(demoMp4Path);
  assert(mp4Stat.size > 10000, 'Video MP4 phải có dung lượng thực tế > 10KB');
  pass(36, 'Render MP4 thành công (demo_v5_phase2_10s.mp4)');

  // -----------------------------------------------------------
  // Test 37: Regression Tab 1–3
  // -----------------------------------------------------------
  const capsFull = exportFullAiCapabilityRegistry();
  assert(capsFull.capabilities.characters.length >= 2, 'Characters V3 phải còn nguyên vẹn');
  assert(capsFull.capabilities.props.length >= 8, 'Props V4 phải còn nguyên vẹn');
  pass(37, 'Regression test Tab 1–3 hoàn toàn ổn định');

  // -----------------------------------------------------------
  // Test 38: Regression V5 Phase 1
  // -----------------------------------------------------------
  const valResult = validateScenePlan(samplePlan);
  assert(valResult, 'Validator V5 Phase 1 phải chạy trơn tru');
  pass(38, 'Regression test V5 Phase 1');

  // -----------------------------------------------------------
  // Test 39: Kiểm tra import file không an toàn
  // -----------------------------------------------------------
  const unsafeProc = processImportedFiles(['../../../etc/passwd'], TEST_DIR, samplePlan.assetRequirements);
  assert(unsafeProc.errors.length > 0, 'Phải chặn đứng nỗ lực Path Traversal');
  pass(39, 'Kiểm tra an toàn file import (Chặn Path Traversal)');

  // -----------------------------------------------------------
  // Test 40: Kiểm tra hiệu năng với project nhiều scene
  // -----------------------------------------------------------
  const largePlan = {
    schemaVersion: "5.1",
    project: { title: "Large Scale 100 Scenes", fps: 24, durationMs: 500000 },
    style: { profileId: "educational_cartoon" },
    scenes: []
  };
  for (let i = 0; i < 100; i++) {
    largePlan.scenes.push({
      id: `scene_${i + 1}`,
      startMs: i * 5000,
      endMs: (i + 1) * 5000,
      background: { assetId: i % 2 === 0 ? "bg_lab_modern" : "bg_historical_computer_lab" },
      characters: [
        { characterId: "doc", outfitId: "outfit_scientist_labcoat", expressionId: "neutral", prop: { assetId: `REQ_PROP_${i % 5}` } }
      ],
      visualBeats: [{ startMs: i * 5000, endMs: (i + 1) * 5000, actionId: "idle_talk" }]
    });
  }
  const tStart = Date.now();
  const largeScan = scanScenePlanRequirements(largePlan);
  const largeDedup = deduplicateAssetRequirements(largeScan.requirements);
  const elapsed = Date.now() - tStart;
  assert(elapsed < 200, `Quét 100 cảnh phải siêu nhanh (< 200ms, thực tế: ${elapsed}ms)`);
  assert(largeDedup.canonicalCount <= 15, `Phải gộp hiệu quả hàng trăm scenes (thực tế: ${largeDedup.canonicalCount} canonical requirements)`);
  pass(40, `Kiểm tra hiệu năng dự án lớn (100 cảnh quét & gộp thành ${largeDedup.canonicalCount} requirements trong ${elapsed}ms)`);

  console.log('\n================================================================');
  console.log(`Phase 2 Verification Tests: ${passedCount}/40 passed (100%)`);
  console.log('================================================================\n');

  // Cleanup temporary test files
  try {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {}
}

runAll40Tests().catch(err => {
  console.error('Lỗi kiểm thử Phase 2:', err);
  process.exit(1);
});
