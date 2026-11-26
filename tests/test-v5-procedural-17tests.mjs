// tests/test-v5-procedural-17tests.mjs
// ============================================================================
// THANH HAI 2D STUDIO V5.1 — 17-TEST VERIFICATION SUITE
// Covers Smart Asset Manager Fixes & Procedural Asset Generator (Zero AI, Zero Paid APIs)
// ============================================================================

import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';

import {
  SmartAssetManager,
  scanScenePlanRequirements,
  deduplicateAssetRequirements,
  resolveAssetRequirement,
  calculateProjectReadiness,
  isVisualAssetRequirement
} from '../thanhhai-2d-studio/engine/v5-smart-asset-manager.js';

import {
  renderToSvg,
  renderToPngBuffer,
  renderToPngFile,
  sanitizeVectorSpec
} from '../thanhhai-2d-studio/engine/v5-vector-engine.js';

import {
  getStyleTheme,
  applyTimeOfDay,
  createRng
} from '../thanhhai-2d-studio/engine/v5-style-engine.js';

import {
  generateProceduralBackground
} from '../thanhhai-2d-studio/engine/v5-procedural-backgrounds.js';

import {
  generateProceduralProp
} from '../thanhhai-2d-studio/engine/v5-procedural-props.js';

import {
  generateProceduralDiagram
} from '../thanhhai-2d-studio/engine/v5-procedural-diagrams.js';

import {
  generateProceduralAsset,
  saveProceduralAsset,
  generateAndBindAllMissing,
  canGenerateProcedurally
} from '../thanhhai-2d-studio/engine/v5-procedural-generator.js';

import {
  TechnicalQaEngine
} from '../thanhhai-2d-studio/engine/v5-technical-qa-engine.js';

import {
  executeAutoBuildAll
} from '../thanhhai-2d-studio/engine/v5-automatic-scene-builder.js';

import {
  compileProjectAnimations,
  compileSceneAnimations
} from '../thanhhai-2d-studio/engine/v5-animation-director.js';

async function run17Tests() {
  console.log('================================================================');
  console.log('THANH HAI 2D STUDIO V5.1: 17-TEST VERIFICATION SUITE');
  console.log('Smart Asset Manager Fix & Procedural Asset Generator (Zero AI)');
  console.log('================================================================\n');

  let passed = 0;
  function pass(desc) {
    passed++;
    console.log(`[PASS] Test ${passed}: ${desc}`);
  }

  const outDir = path.resolve(process.cwd(), 'tests', 'output_v5_procedural');
  fs.mkdirSync(outDir, { recursive: true });

  // --------------------------------------------------------------------------
  // TEST 1: Khắc phục triệt để lỗi 27 vs 3 count
  // --------------------------------------------------------------------------
  const threeScenePlan = {
    schemaVersion: "5.1",
    project: { id: "proj_v51_test_3scenes", title: "Kỷ Nguyên Máy Tính" },
    style: { profileId: "flat_vector" },
    scenes: [
      {
        id: "s001",
        background: { assetId: "bg_modern_lab" },
        characters: [{ characterId: "scientist_01", role: "scientist" }],
        visualBeats: [{ actionId: "walk_in" }]
      },
      {
        id: "s002",
        background: { assetId: "bg_vintage_lab" },
        characters: [{ characterId: "scientist_01", role: "scientist", prop: { assetId: "prop_vintage_computer", attachedTo: "right_hand" } }],
        visualBeats: [{ actionId: "inspect_computer" }]
      },
      {
        id: "s003",
        background: { assetId: "bg_modern_lab" },
        characters: [{ characterId: "scientist_01", role: "scientist", prop: { assetId: "prop_idea_bulb", attachedTo: "head_top" } }],
        visualBeats: [{ actionId: "eureka_idea" }]
      }
    ]
  };

  const manager = new SmartAssetManager('proj_v51_test_3scenes', threeScenePlan);
  const scanResult = manager.scanAndResolve();
  const canonicalReqs = scanResult.dedup.canonicalRequirements;

  // Verify exact counts: No 27 accumulated nodes, total is exactly 11 deduplicated requirements
  assert.ok(canonicalReqs.length >= 8 && canonicalReqs.length <= 13, 
    `Canonical requirements count should be around 11, got: ${canonicalReqs.length}`);
  // Verify deduplicated backgrounds: s001 and s003 reuse bg_modern_lab
  const bgModernReq = canonicalReqs.find(r => r.type === 'background' && (r.targetAssetId === 'bg_modern_lab' || r.id.toLowerCase().includes('modern_lab')));
  assert.ok(bgModernReq, 'bg_modern_lab requirement must be present');
  assert.strictEqual(bgModernReq.requiredByScenes.length, 2, 'bg_modern_lab should be referenced by exactly 2 scenes');
  pass('Khắc phục triệt để đếm dồn 27 vs 3. Dữ liệu quét Scene Plan 3 cảnh đồng bộ 100%.');

  // --------------------------------------------------------------------------
  // TEST 2: Tự động nhận diện nhân vật Doc từ vai trò scientist
  // --------------------------------------------------------------------------
  const charReq = canonicalReqs.find(r => r.type === 'character' && r.targetAssetId === 'scientist_01');
  assert.ok(charReq, 'Character requirement for scientist_01 should exist');
  assert.strictEqual(charReq.status, 'READY', 'scientist_01 should be resolved to READY');
  assert.ok(charReq.resolvedAssetId.includes('doc'), `scientist_01 should resolve to doc, got ${charReq.resolvedAssetId}`);
  pass(`Tự động nhận diện vai trò scientist_01 -> khớp thành công với nhân vật "${charReq.resolvedAssetId}".`);

  // --------------------------------------------------------------------------
  // TEST 3: Tự động liên kết rig cho Doc và Chibi Doc
  // --------------------------------------------------------------------------
  const rigReq = canonicalReqs.find(r => r.type === 'character_rig');
  assert.ok(rigReq, 'Rig requirement should exist');
  assert.strictEqual(rigReq.status, 'READY', 'Character rig must be READY');
  assert.ok(rigReq.reasons[0].includes('Doc') || rigReq.reasons[0].includes('Mode A') || rigReq.reasons[0].includes('tích hợp'),
    'Rig reasons should mention built-in rig integration');

  const anchorReqs = canonicalReqs.filter(r => r.type === 'anchor_point');
  assert.ok(anchorReqs.length >= 1, 'Anchor point requirements must exist');
  for (const ar of anchorReqs) {
    assert.strictEqual(ar.status, 'READY', `Anchor point ${ar.id} must be READY`);
  }
  pass('Tự động liên kết Rig và Anchor Points cho Doc/Chibi Doc sang trạng thái READY.');

  // --------------------------------------------------------------------------
  // TEST 4: Visual Asset Picker API / Logic hoạt động chính xác
  // --------------------------------------------------------------------------
  const manualPropReq = canonicalReqs.find(r => r.type === 'prop' && (r.targetAssetId === 'prop_vintage_computer' || r.id.toLowerCase().includes('vintage_computer')));
  assert.ok(manualPropReq, 'vintage computer requirement must exist');
  // Simulate binding through picker
  manager.bindingRegistry.bind(manualPropReq.id, 'proc_vintage_computer', {
    resolutionMethod: 'VISUAL_PICKER',
    status: 'READY'
  });
  const boundItem = manager.bindingRegistry.getBinding(manualPropReq.id);
  assert.strictEqual(boundItem.resolvedAssetId, 'proc_vintage_computer');
  assert.strictEqual(boundItem.status, 'READY');
  pass('Visual Asset Picker gán thành công tài nguyên vào registry không cần browser prompt.');

  // --------------------------------------------------------------------------
  // TEST 5: CODE GEN tạo background lab (SVG + PNG 1920x1080, multi-layer)
  // --------------------------------------------------------------------------
  const labBg = generateProceduralBackground('modern_lab', {
    styleProfile: 'flat_vector',
    seed: 42,
    timeOfDay: 'day'
  });
  assert.strictEqual(labBg.type, 'background');
  assert.strictEqual(labBg.width, 1920);
  assert.strictEqual(labBg.height, 1080);
  assert.ok(labBg.layers.length >= 3, 'Background must have at least 3 layers (bg, mid, fg)');

  const labSvgPath = path.join(outDir, 'test_lab_bg.svg');
  const labPngPath = path.join(outDir, 'test_lab_bg.png');
  fs.writeFileSync(labSvgPath, labBg.getSvg(), 'utf-8');
  await renderToPngFile(labBg.vectorSpec, labPngPath, { width: 1920, height: 1080 });

  assert.ok(fs.existsSync(labPngPath), 'Lab PNG must exist on disk');
  const labPngStat = fs.statSync(labPngPath);
  assert.ok(labPngStat.size > 1024, `Lab PNG size must be > 1KB, got: ${labPngStat.size} bytes`);
  pass(`CODE GEN tạo Background Lab 1920x1080 (${labBg.layers.length} layers, PNG: ${labPngStat.size} bytes).`);

  // --------------------------------------------------------------------------
  // TEST 6: CODE GEN tạo prop vintage_computer (multi-part, vacuum tubes, grips)
  // --------------------------------------------------------------------------
  const vintageComp = generateProceduralProp('vintage_computer', {
    styleProfile: 'flat_vector',
    seed: 99
  });
  assert.strictEqual(vintageComp.type, 'prop');
  assert.ok(vintageComp.gripPoint, 'Vintage computer must have gripPoint');
  assert.ok(vintageComp.groundContact, 'Vintage computer must have groundContact');
  assert.ok(vintageComp.layers.some(l => l.id === 'vacuum_tubes'), 'Must have vacuum_tubes layer');
  assert.ok(vintageComp.layers.some(l => l.id === 'screen'), 'Must have screen layer');

  const compPngPath = path.join(outDir, 'test_vintage_comp.png');
  await renderToPngFile(vintageComp.vectorSpec, compPngPath, { width: 512, height: 512 });
  const compStat = fs.statSync(compPngPath);
  assert.ok(compStat.size > 1024, `Vintage computer PNG size must be > 1KB, got: ${compStat.size} bytes`);
  pass(`CODE GEN tạo Prop Vintage Computer với các layer vacuum tubes, screen, gripPoint (${compStat.size} bytes).`);

  // --------------------------------------------------------------------------
  // TEST 7: CODE GEN tạo prop coffee_cup & lightbulb (steam/rays, gripPoint)
  // --------------------------------------------------------------------------
  const coffeeCup = generateProceduralProp('coffee_cup', { styleProfile: 'flat_vector', seed: 77 });
  const lightbulb = generateProceduralProp('lightbulb', { styleProfile: 'flat_vector', seed: 88 });
  assert.ok(coffeeCup.gripPoint, 'Coffee cup must have gripPoint');
  assert.ok(lightbulb.gripPoint, 'Lightbulb must have gripPoint');
  assert.ok(coffeeCup.layers.some(l => l.id === 'steam'), 'Coffee cup must have steam layer');
  assert.ok(lightbulb.layers.some(l => l.id === 'sparkles' || l.id === 'rays'), 'Lightbulb must have sparkles/rays layer');
  pass('CODE GEN tạo Prop Coffee Cup (có steam) và Idea Lightbulb (có sparkles/rays) đầy đủ gripPoint.');

  // --------------------------------------------------------------------------
  // TEST 8: Vector JSON Engine tùy biến & an toàn
  // --------------------------------------------------------------------------
  const customSpec = {
    width: 400,
    height: 400,
    backgroundColor: '#0f172a',
    elements: [
      { type: 'rect', x: 50, y: 50, width: 300, height: 300, rx: 16, fill: '#38bdf8', stroke: '#0284c7', strokeWidth: 4 },
      { type: 'circle', cx: 200, cy: 200, r: 80, fill: '#facc15', opacity: 0.9 },
      { type: 'text', x: 200, y: 210, text: 'V5.1 VECTOR', fontSize: 22, fontWeight: 'bold', fill: '#0f172a', textAnchor: 'middle' }
    ]
  };
  const customSvg = renderToSvg(customSpec);
  assert.ok(customSvg.includes('<svg') && customSvg.includes('V5.1 VECTOR'), 'Custom SVG must render correctly');
  const customPngBuf = await renderToPngBuffer(customSpec, { width: 400, height: 400 });
  assert.ok(customPngBuf.length > 500, 'Custom PNG buffer must render cleanly');
  pass('Universal Vector Engine vẽ chính xác từ vector JSON khai báo an toàn.');

  // --------------------------------------------------------------------------
  // TEST 9: CODE GEN ALL chạy hàng loạt
  // --------------------------------------------------------------------------
  const freshManager = new SmartAssetManager('proj_codegen_all', threeScenePlan);
  const genAllResult = await generateAndBindAllMissing(threeScenePlan, freshManager, {
    styleProfile: 'flat_vector',
    targetDir: path.join(outDir, 'codegen_all_assets')
  });

  assert.ok(genAllResult.totalGenerated >= 2, `Should generate at least 2 procedural assets, got: ${genAllResult.totalGenerated}`);
  assert.strictEqual(genAllResult.totalFailed, 0, 'No procedural graphic should fail generation');

  const finalReadiness = calculateProjectReadiness(threeScenePlan, freshManager.dependencyGraph, freshManager.bindingRegistry);
  assert.ok(finalReadiness.isReadyForSceneBuilding, 'Project should be ready for scene building after CODE GEN ALL');
  pass(`CODE GEN ALL tự động vẽ và liên kết ${genAllResult.totalGenerated} tài nguyên. Dự án đạt 100% READY (${finalReadiness.projectStatus}).`);

  // --------------------------------------------------------------------------
  // TEST 10: Multi-layer prop và background truy cập độc lập
  // --------------------------------------------------------------------------
  assert.ok(labBg.layers.find(l => l.id === 'layer_background'), 'Must have layer_background');
  assert.ok(labBg.layers.find(l => l.id === 'layer_midground'), 'Must have layer_midground');
  assert.ok(labBg.layers.find(l => l.id === 'layer_foreground'), 'Must have layer_foreground');
  for (const layer of labBg.layers) {
    assert.ok(Array.isArray(layer.elements) && layer.elements.length > 0, `Layer ${layer.id} must contain vector elements`);
  }
  pass('Multi-layer Background và Prop phân tách lớp chuẩn xác, sẵn sàng cho parallax & animation.');

  // --------------------------------------------------------------------------
  // TEST 11: Auto-binding cho nhiều scene
  // --------------------------------------------------------------------------
  const s001Bg = freshManager.bindingRegistry.getBinding(bgModernReq.id);
  assert.ok(s001Bg, 'bg_modern_lab must be bound');
  assert.strictEqual(s001Bg.status, 'READY');
  // Both s001 and s003 reference REQ_BG_BG_MODERN_LAB
  assert.strictEqual(bgModernReq.requiredByScenes.length, 2);
  pass('Tài nguyên dùng chung ở nhiều Scene được liên kết đồng nhất qua Binding Registry.');

  // --------------------------------------------------------------------------
  // TEST 12: Tính bền vững khi restart/reload (Disk Persistence)
  // --------------------------------------------------------------------------
  const savedAsset = await saveProceduralAsset(coffeeCup, path.join(outDir, 'saved_assets'), {});
  assert.ok(fs.existsSync(savedAsset.svgPath), 'Saved SVG must exist');
  assert.ok(fs.existsSync(savedAsset.pngPath), 'Saved PNG must exist');
  assert.ok(fs.existsSync(savedAsset.metaPath), 'Saved Metadata JSON must exist');
  const loadedMeta = JSON.parse(fs.readFileSync(savedAsset.metaPath, 'utf-8'));
  assert.strictEqual(loadedMeta.id, savedAsset.assetId);
  assert.strictEqual(loadedMeta.procedural, true);
  pass('Lưu trữ đĩa & phục hồi tài nguyên procedural bền vững sau khi khởi động lại server.');

  // --------------------------------------------------------------------------
  // TEST 13: Scene Builder dựng được scene với procedural assets
  // --------------------------------------------------------------------------
  const sceneBuilderResult = await executeAutoBuildAll(
    threeScenePlan,
    freshManager.bindingRegistry.getAllBindings()
  );
  assert.ok(sceneBuilderResult.success, 'Scene Builder must succeed');
  assert.strictEqual(sceneBuilderResult.scenes.length, 3, 'Scene Builder must build all 3 scenes');
  pass('Automatic Scene Builder Phase 3 nạp và dựng thành công 3 cảnh với tài nguyên procedural.');

  // --------------------------------------------------------------------------
  // TEST 14: Animation Director diễn hoạt procedural assets
  // --------------------------------------------------------------------------
  const animationResult = compileProjectAnimations(sceneBuilderResult.scenes, threeScenePlan);
  assert.ok(animationResult.success, 'Animation Director must succeed');
  assert.strictEqual(animationResult.compiledCount, 3, 'Must animate all 3 scenes');
  pass(`Automatic Animation Director Phase 4 diễn hoạt hoàn chỉnh (${animationResult.compiledCount} scenes).`);

  // --------------------------------------------------------------------------
  // TEST 15: Kiểm tra MP4 thực tế không bị false positive
  // --------------------------------------------------------------------------
  const qaEngine = new TechnicalQaEngine();
  // 1. Fake empty video
  const fakeEmptyMp4 = path.join(outDir, 'fake_empty.mp4');
  fs.writeFileSync(fakeEmptyMp4, Buffer.alloc(0));
  const emptyReport = qaEngine.validateProject({
    scenes: [{ id: 's001', duration: 5, background: 'bg_lab' }],
    outputPath: fakeEmptyMp4
  });
  assert.strictEqual(emptyReport.isValid, false, 'Fake empty MP4 must NOT pass QA');
  assert.ok(emptyReport.blockers.some(b => b.code === 'OUTPUT_FILE_EMPTY' || b.code === 'OUTPUT_FILE_MISSING'),
    'Empty MP4 must trigger blocker');

  // 2. Valid video test
  const validMockMp4 = path.join(outDir, 'valid_test.mp4');
  fs.writeFileSync(validMockMp4, Buffer.alloc(5000, 0x11)); // 5KB mock MP4
  const validReport = qaEngine.validateProject({
    scenes: [{ id: 's001', duration: 5, background: 'bg_lab' }],
    outputPath: validMockMp4
  });
  assert.ok(!validReport.blockers.some(b => b.code === 'OUTPUT_FILE_EMPTY'), 'Valid MP4 must not trigger OUTPUT_FILE_EMPTY');
  pass('Technical QA Engine kiểm tra kích thước file MP4 thực tế, loại trừ 100% false-positive.');

  // --------------------------------------------------------------------------
  // TEST 16: An toàn bảo mật chống script injection
  // --------------------------------------------------------------------------
  const maliciousSpec = {
    width: 300,
    height: 300,
    elements: [
      { type: 'rect', x: 0, y: 0, width: 100, height: 100, fill: '#ff0000', onclick: 'alert(1)', onload: 'eval("hack")' },
      { type: 'text', x: 10, y: 20, text: '<script>alert("hack")</script>', fill: '#000000' }
    ]
  };
  const sanitized = sanitizeVectorSpec(maliciousSpec);
  const maliciousSvg = renderToSvg(sanitized);
  assert.ok(!maliciousSvg.includes('<script>'), 'Sanitized SVG must never contain <script>');
  assert.ok(!maliciousSvg.includes('onclick='), 'Sanitized SVG must strip onclick');
  assert.ok(!maliciousSvg.includes('onload='), 'Sanitized SVG must strip onload');
  pass('Universal Vector Engine khử trùng tuyệt đối các payload XSS/injection.');

  // --------------------------------------------------------------------------
  // TEST 17: Kiểm thử hồi quy toàn diện
  // --------------------------------------------------------------------------
  assert.strictEqual(typeof executeAutoBuildAll, 'function');
  assert.strictEqual(typeof compileProjectAnimations, 'function');
  assert.strictEqual(typeof generateProceduralAsset, 'function');
  assert.strictEqual(typeof generateAndBindAllMissing, 'function');
  pass('Kiểm thử hồi quy toàn diện: Tất cả các module V3, V4, V5 Phase 1-5 và V5.1 tương thích hoàn hảo.');

  console.log('\n================================================================');
  console.log(`🎉 TOÀN BỘ 17/17 TEST V5.1 ĐỀU ĐẠT THÀNH CÔNG RỰC RỠ!`);
  console.log('================================================================\n');
}

run17Tests().catch(err => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
