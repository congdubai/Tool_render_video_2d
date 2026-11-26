// tests/test-v5-step4-orchestrator-e2e.mjs
// End-to-end verification of Step 4 Production Orchestrator, QA Engine, and Asset Binding Sync

import assert from 'assert';
import fs from 'fs';
import path from 'path';

import { defaultOrchestrator, PRODUCTION_MODES, PRODUCTION_STATES } from '../thanhhai-2d-studio/engine/v5-production-orchestrator.js';
import { defaultQaEngine, QA_SEVERITY } from '../thanhhai-2d-studio/engine/v5-technical-qa-engine.js';
import { resolveAssetRequirements } from '../thanhhai-2d-studio/engine/v5-smart-asset-manager.js';
import { defaultFfmpegAssembler } from '../thanhhai-2d-studio/engine/v5-ffmpeg-assembler.js';

console.log('================================================================');
console.log('TEST SUITE: V5.1 STEP 4 PRODUCTION ORCHESTRATOR & QA SYNC');
console.log('================================================================\n');

async function run() {
  const fixturePath = path.resolve(process.cwd(), 'tests', 'fixtures', 'v5_test_scene_plan.json');
  const testScenePlan = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  // TEST 1: Missing assets detection & diagnostic reporting
  console.log('1. Kiểm tra phát hiện tài nguyên thiếu khi chưa liên kết background...');
  const resMissing = await defaultOrchestrator.produceVideo({
    id: 'test_missing_proj',
    revision: '1.0',
    scenePlan: testScenePlan,
    bindings: {} // No background bound
  }, PRODUCTION_MODES.MODE_B_FULL_AUTO);

  assert.strictEqual(resMissing.success, false, 'Phải dừng lại khi còn thiếu tài nguyên');
  assert.strictEqual(resMissing.status, PRODUCTION_STATES.WAITING_FOR_ASSETS, 'Trạng thái phải là WAITING_FOR_ASSETS');
  assert.ok(Array.isArray(resMissing.missingAssets), 'Phải có danh sách missingAssets');
  assert.ok(resMissing.missingAssets.length > 0, 'Phải có ít nhất 1 tài nguyên thiếu');

  const bgMissing = resMissing.missingAssets.find(m => m.id === 'REQ_BG_background_laboratory');
  assert.ok(bgMissing, 'Phải tìm thấy REQ_BG_background_laboratory trong danh sách thiếu');
  assert.ok(bgMissing.name, 'Tài nguyên thiếu phải có tên');
  assert.ok(bgMissing.type, 'Tài nguyên thiếu phải có loại');
  assert.ok(bgMissing.scenes.length > 0, 'Tài nguyên thiếu phải có danh sách cảnh sử dụng');
  assert.ok(bgMissing.reasons.length > 0, 'Tài nguyên thiếu phải có nguyên nhân chi tiết');
  console.log(`  ✔ Báo cáo chính xác tài nguyên thiếu: ${bgMissing.name} (${bgMissing.id}), cảnh: ${bgMissing.scenes.join(', ')}`);

  // TEST 2: Technical QA must report BLOCKERS when assets are missing
  console.log('\n2. Kiểm tra Technical QA đồng bộ với trạng thái thiếu tài nguyên...');
  const qaWithMissing = defaultQaEngine.validateProject({
    scenes: testScenePlan.scenes,
    missingAssets: resMissing.missingAssets
  });
  assert.strictEqual(qaWithMissing.isValid, false, 'Technical QA không được báo hợp lệ khi thiếu tài nguyên');
  assert.ok(qaWithMissing.blockers.length > 0, 'Technical QA phải có ít nhất 1 Blocker');
  const blocker = qaWithMissing.blockers.find(b => b.code === 'MISSING_REQUIRED_ASSET');
  assert.ok(blocker, 'Phải có blocker MISSING_REQUIRED_ASSET');
  console.log(`  ✔ Technical QA báo chính xác ${qaWithMissing.blockers.length} Blockers, mô tả: "${blocker.description}"`);

  // TEST 3: Full-pipeline execution with active bindings (Doc + Rig + Procedural Lab BG)
  console.log('\n3. Kiểm tra sản xuất hoàn chỉnh 15s với tài nguyên đã liên kết đầy đủ...');
  const activeBindings = {
    'REQ_BG_background_laboratory': {
      resolvedAssetId: 'proc_req_bg_background_laboratory',
      status: 'READY'
    },
    'REQ_CHAR_SCIENTIST_01': {
      resolvedAssetId: 'doc',
      status: 'READY'
    },
    'REQ_RIG_SCIENTIST_01': {
      resolvedAssetId: 'doc',
      status: 'READY'
    }
  };

  const resFull = await defaultOrchestrator.produceVideo({
    id: 'demo_v5_procedural_15s',
    revision: '1.0',
    scenePlan: testScenePlan,
    bindings: activeBindings,
    duration: 15.0
  }, PRODUCTION_MODES.MODE_B_FULL_AUTO);

  assert.strictEqual(resFull.success, true, `Sản xuất phải thành công: ${resFull.error || ''}`);
  assert.strictEqual(resFull.status, PRODUCTION_STATES.COMPLETED, 'Trạng thái phải là COMPLETED');
  assert.ok(resFull.finalOutput, 'Phải có finalOutput');
  assert.strictEqual(resFull.finalOutput.verified, true, 'finalOutput phải có cờ verified: true');
  assert.strictEqual(resFull.finalOutput.duration, 15.0, 'Thời lượng phải là 15.0s');
  assert.ok(resFull.finalOutput.fileSize > 1024, `Dung lượng video phải > 1024 bytes (thực tế: ${resFull.finalOutput.fileSize})`);
  console.log(`  ✔ Sản xuất thành công! File: ${resFull.finalOutput.outputPath}`);
  console.log(`  ✔ Thông số: ${resFull.finalOutput.resolution}, ${resFull.finalOutput.fps} fps, ${(resFull.finalOutput.fileSize / 1024 / 1024).toFixed(2)} MB`);

  // TEST 4: FFprobe verification of rendered MP4
  console.log('\n4. Kiểm tra MP4 thực tế bằng FFprobe...');
  const probeVerif = await defaultFfmpegAssembler.verifyFinalOutput(resFull.finalOutput.outputPath);
  assert.strictEqual(probeVerif.isValid, true, 'FFprobe phải kiểm định video hợp lệ');
  assert.strictEqual(probeVerif.checks.hasVideo, true, 'File phải có video stream');
  assert.strictEqual(probeVerif.checks.durationValid, true, 'Thời lượng video phải > 0');
  assert.strictEqual(probeVerif.checks.resolutionValid, true, 'Độ phân giải phải hợp lệ');
  console.log(`  ✔ FFprobe kiểm định hợp lệ 100%: Codec ${probeVerif.videoCodec}, ${probeVerif.resolution}, ${probeVerif.duration}s`);

  // TEST 5: Orchestrator Mode A Preview vs Mode B Full Auto
  console.log('\n5. Kiểm tra Mode A Preview vs Mode B Full Auto...');
  const resModeA = await defaultOrchestrator.produceVideo({
    id: 'demo_v5_procedural_15s',
    revision: '1.0',
    scenePlan: testScenePlan,
    bindings: activeBindings
  }, PRODUCTION_MODES.MODE_A_PREVIEW);

  assert.strictEqual(resModeA.success, true, 'Mode A phải thành công');
  assert.strictEqual(resModeA.status, PRODUCTION_STATES.PREVIEW_READY, 'Mode A status phải là PREVIEW_READY');
  assert.ok(resModeA.compiledScenes.length === 3, 'Phải có 3 compiledScenes');
  assert.ok(Object.keys(resModeA.animations).length === 3, 'Phải có 3 scene animations');
  console.log('  ✔ Mode A hoàn tất tại PREVIEW_READY với 3 compiled scenes và animations!');

  console.log('\n================================================================');
  console.log('🎉 TOÀN BỘ 5 BÀI KIỂM THỬ STEP 4 PRODUCTION ORCHESTRATOR ĐÃ ĐẠT!');
  console.log('================================================================');
}

run().catch(err => {
  console.error('\n❌ Thất bại:', err);
  process.exit(1);
});
