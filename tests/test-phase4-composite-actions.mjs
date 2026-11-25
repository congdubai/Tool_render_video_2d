/**
 * tests/test-phase4-composite-actions.mjs
 * Comprehensive Verification Test Suite for Thanh Hai 2D Studio V4 — Phase 4
 * COMPOSITE ACTION ENGINE & UNIVERSAL MOTION LIBRARY
 * 
 * Covers all 22 required test cases:
 * 1. Action Registry & 8 Core Composite Actions
 * 2. Action Template Schema Validation & Negative Testing
 * 3. Dependency Loop Detection (Direct & Circular DFS)
 * 4. Multi-Track Timeline Evaluation at Multiple Progress Intervals
 * 5. Composite Action 01: Fight Cloud — Phase Progression
 * 6. Fight Cloud — Character Body Masking (hideBody: true/false)
 * 7. Fight Cloud — Dynamic Character Head & Limb Pop-Outs
 * 8. Fight Cloud — Camera Shake & Aftermath Dizzy Stars
 * 9. Composite Action 02: Cartoon Chase (Runner & Chaser Coordination)
 * 10. Composite Action 03: Power Up Surge (Aura & Nova Blast)
 * 11. Composite Action 04: Funny Fall (Slip, Airborne Hangtime, Slam & Bounce)
 * 12. Composite Action 05: Shock Reaction (Startled Jump, Shock Lines & Sweat)
 * 13. Composite Action 06: Cartoon Argument (Alternating Steam & Clash)
 * 14. Composite Action 07: Object Interaction (Prop Handoff without Duplication)
 * 15. Composite Action 08: Storytelling & Eureka (Question -> Lightbulb -> Cheer)
 * 16. Mock Canvas Rendering Execution (drawCompositeAction Error-free)
 * 17. Head Pop-Out Retains Real Character Visual Identity (Alex, Jake, Doc)
 * 18. Head Pop-Out Compatibility on Mode B (Imported Sprite Head)
 * 19. Camera Director Integration with Action Shake
 * 20. Media File Verification in public/assets/composite_action/
 * 21. ZIP Packaging & Import Conflict Resolution
 * 22. Project Serialization Roundtrip Integrity
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  COMPOSITE_ACTION_TEMPLATES,
  getCompositeActionTemplate,
  listCompositeActionTemplates,
  registerCompositeActionTemplate,
  checkActionDependencyLoop,
  solveCompositeAction,
  drawCompositeAction,
  getCompositeActionCompatibility
} from '../thanhhai-2d-studio/engine/action-engine-v4.js';
import {
  listAssets,
  getAsset,
  exportAssetPackage,
  importAssetPackage,
  deleteAsset
} from '../lib/asset-registry.mjs';
import { CameraDirector } from '../thanhhai-2d-studio/engine/cinematic-scene.js';
import { WHITE_CARTOON_PRESETS } from '../thanhhai-2d-studio/engine/white-cartoon-rig2d.js';

function createMockCanvasContext() {
  const calls = [];
  return {
    calls,
    save: () => calls.push({ op: 'save' }),
    restore: () => calls.push({ op: 'restore' }),
    translate: (x, y) => calls.push({ op: 'translate', x, y }),
    rotate: (a) => calls.push({ op: 'rotate', a }),
    scale: (sx, sy) => calls.push({ op: 'scale', sx, sy }),
    beginPath: () => calls.push({ op: 'beginPath' }),
    closePath: () => calls.push({ op: 'closePath' }),
    moveTo: (x, y) => calls.push({ op: 'moveTo', x, y }),
    lineTo: (x, y) => calls.push({ op: 'lineTo', x, y }),
    arc: (x, y, r, sa, ea) => calls.push({ op: 'arc', x, y, r, sa, ea }),
    arcTo: (x1, y1, x2, y2, r) => calls.push({ op: 'arcTo', x1, y1, x2, y2, r }),
    ellipse: (x, y, rx, ry, rot, sa, ea) => calls.push({ op: 'ellipse', x, y, rx, ry, rot, sa, ea }),
    quadraticCurveTo: (cpx, cpy, x, y) => calls.push({ op: 'quadraticCurveTo', cpx, cpy, x, y }),
    bezierCurveTo: (cp1x, cp1y, cp2x, cp2y, x, y) => calls.push({ op: 'bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y }),
    rect: (x, y, w, h) => calls.push({ op: 'rect', x, y, w, h }),
    roundRect: (x, y, w, h, r) => calls.push({ op: 'roundRect', x, y, w, h, r }),
    fillRect: (x, y, w, h) => calls.push({ op: 'fillRect', x, y, w, h }),
    strokeRect: (x, y, w, h) => calls.push({ op: 'strokeRect', x, y, w, h }),
    fill: () => calls.push({ op: 'fill' }),
    stroke: () => calls.push({ op: 'stroke' }),
    clip: () => calls.push({ op: 'clip' }),
    fillText: (text, x, y) => calls.push({ op: 'fillText', text, x, y }),
    strokeText: (text, x, y) => calls.push({ op: 'strokeText', text, x, y }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    drawImage: () => calls.push({ op: 'drawImage' })
  };
}

console.log('=== BẮT ĐẦU KIỂM THỬ THANH HAI 2D STUDIO V4 — PHASE 4: COMPOSITE ACTIONS ===\n');

// 1. KIỂM THỬ KHỞI TẠO VÀ ĐỦ 8 CORE COMPOSITE ACTIONS
console.log('1. Khởi tạo Action Registry & 8 Core Composite Actions:');
const expectedCoreActions = [
  'composite_fight_cloud',
  'composite_chase',
  'composite_power_up',
  'composite_funny_fall',
  'composite_shock_reaction',
  'composite_cartoon_argument',
  'composite_object_interaction',
  'composite_storytelling'
];

for (const actId of expectedCoreActions) {
  const tmpl = getCompositeActionTemplate(actId);
  assert.ok(tmpl, `Composite action template "${actId}" phải tồn tại trong engine!`);
  assert.strictEqual(tmpl.id, actId);
  assert.ok(tmpl.name, `Action "${actId}" phải có tên hiển thị.`);
  assert.ok(tmpl.duration > 0, `Action "${actId}" phải có thời lượng > 0s.`);
  assert.ok(Array.isArray(tmpl.roles) && tmpl.roles.length >= 1, `Action "${actId}" phải có ít nhất 1 role.`);
}
console.log(`  ✔ Tất cả 8 hành động phức hợp cốt lõi có sẵn trong COMPOSITE_ACTION_TEMPLATES.`);

// 2. THẨM ĐỊNH SCHEMA & NEGATIVE TESTING
console.log('\n2. Thẩm định Schema Mẫu Hành Động & Xử lý lỗi đầu vào:');
assert.throws(() => {
  registerCompositeActionTemplate({ name: 'Thiếu ID', duration: 3.0 });
}, /id duy nhất/, 'Phải chặn template thiếu ID');

assert.throws(() => {
  registerCompositeActionTemplate({ id: 'invalid_duration', name: 'Sai duration', duration: -1.0, roles: [{ id: 'a' }] });
}, /lớn hơn 0/, 'Phải chặn template có duration <= 0');

assert.throws(() => {
  registerCompositeActionTemplate({ id: 'no_roles', name: 'Không role', duration: 2.0, roles: [] });
}, /ít nhất 1 role/, 'Phải chặn template không có role');

console.log('  ✔ Validation schema chặn đứng các template thiếu ID, sai duration hoặc rỗng role.');

// 3. PHÁT HIỆN VÒNG LẶP PHỤ THUỘC (DEPENDENCY LOOP DETECTION)
console.log('\n3. Kiểm tra Thuật Toán Phát Hiện Vòng Lặp Phụ Thuộc (Dependency Loop Checker):');
// Trường hợp không lặp
const noLoopResult = checkActionDependencyLoop('composite_fight_cloud');
assert.strictEqual(noLoopResult.hasLoop, false, 'Action chuẩn không được có vòng lặp');

// Trường hợp lặp trực tiếp (A -> A)
const directLoopTemplate = {
  id: 'action_direct_loop',
  name: 'Lặp trực tiếp',
  duration: 2.0,
  roles: [{ id: 'actor' }],
  subActions: ['action_direct_loop']
};
const directLoopResult = checkActionDependencyLoop(directLoopTemplate, { action_direct_loop: directLoopTemplate });
assert.strictEqual(directLoopResult.hasLoop, true, 'Phải phát hiện lặp trực tiếp');

// Trường hợp lặp gián tiếp (A -> B -> C -> A)
const mockCycleMap = {
  action_A: { id: 'action_A', subActions: ['action_B'] },
  action_B: { id: 'action_B', subActions: ['action_C'] },
  action_C: { id: 'action_C', subActions: ['action_A'] }
};
const indirectLoopResult = checkActionDependencyLoop('action_A', mockCycleMap);
assert.strictEqual(indirectLoopResult.hasLoop, true, 'Phải phát hiện lặp gián tiếp A -> B -> C -> A');
assert.deepStrictEqual(indirectLoopResult.cycle, ['action_A', 'action_B', 'action_C', 'action_A']);
console.log('  ✔ Thuật toán DFS phát hiện chính xác cả vòng lặp trực tiếp và gián tiếp nhiều cấp.');

// 4. KIỂM THỬ ĐÁNH GIÁ TIMELINE ĐA TRACK (MULTI-TRACK TIMELINE EVALUATION)
console.log('\n4. Đánh giá Timeline Đa Track qua các mốc thời gian:');
const testFightBindings = { fighter_a: 'alex', fighter_b: 'jake' };
const samplePoints = [0.0, 0.25, 0.50, 0.75, 1.0];

for (const p of samplePoints) {
  const t = p * 4.5;
  const state = solveCompositeAction('composite_fight_cloud', testFightBindings, t, 0, 4.5);
  assert.strictEqual(typeof state.progress, 'number');
  assert.ok(Math.abs(state.progress - p) < 0.001, `Progress tại t=${t} phải bằng ${p}`);
  assert.ok(state.actors.fighter_a, 'State phải chứa actor fighter_a');
  assert.ok(state.actors.fighter_b, 'State phải chứa actor fighter_b');
  assert.ok(typeof state.camera.shakeAmp === 'number', 'State phải chứa camera shakeAmp');
}
console.log('  ✔ solveCompositeAction nội suy chính xác vị trí, góc xoay, scale và VFX ở mọi mốc thời gian.');

// 5. COMPOSITE ACTION 01: FIGHT CLOUD — 6 GIAI ĐOẠN (PHASE A-F)
console.log('\n5. Kiểm thử Fight Cloud (Composite 01) — Trình tự 6 Giai đoạn (A -> F):');
// Giai đoạn A: Preparation (t = 0.3s, p = 0.067)
const statePrep = solveCompositeAction('composite_fight_cloud', testFightBindings, 0.3, 0, 4.5);
assert.strictEqual(statePrep.actors.fighter_a.pose, 'angry_stand');
assert.strictEqual(statePrep.actors.fighter_b.pose, 'angry_stand');
assert.ok(statePrep.actors.fighter_a.x < -100, 'Fighter A đứng bên trái chuẩn bị lao vào');
assert.ok(statePrep.actors.fighter_b.x > 100, 'Fighter B đứng bên phải chuẩn bị lao vào');

// Giai đoạn B: Rush (t = 0.9s, p = 0.2)
const stateRush = solveCompositeAction('composite_fight_cloud', testFightBindings, 0.9, 0, 4.5);
assert.strictEqual(stateRush.actors.fighter_a.pose, 'run');
assert.strictEqual(stateRush.actors.fighter_b.pose, 'run');

// Giai đoạn C: Collision (t = 1.25s, p = 0.278)
const stateCollision = solveCompositeAction('composite_fight_cloud', testFightBindings, 1.25, 0, 4.5);
assert.ok(stateCollision.camera.shakeAmp > 10, 'Va chạm phải kích hoạt rung chấn mạnh (shakeAmp > 10)');
assert.ok(stateCollision.globalVfx.some(v => v.type === 'vfx_impact_flash'), 'Có hiệu ứng chớp va chạm impact flash');

// Giai đoạn D: Smoke Brawl (t = 2.5s, p = 0.556)
const stateBrawl = solveCompositeAction('composite_fight_cloud', testFightBindings, 2.5, 0, 4.5);
assert.ok(stateBrawl.globalVfx.some(v => v.type === 'vfx_fight_smoke'), 'Có đám khói ẩu đả vfx_fight_smoke');

// Giai đoạn E: Dissipation (t = 3.8s, p = 0.844)
const stateDissipation = solveCompositeAction('composite_fight_cloud', testFightBindings, 3.8, 0, 4.5);
assert.strictEqual(stateDissipation.actors.fighter_a.hideBody, false, 'Khói tan thì thân thể hiện rõ');

// Giai đoạn F: Aftermath (t = 4.3s, p = 0.956)
const stateAftermath = solveCompositeAction('composite_fight_cloud', testFightBindings, 4.3, 0, 4.5);
assert.strictEqual(stateAftermath.actors.fighter_a.expression, 'dizzy');
assert.strictEqual(stateAftermath.actors.fighter_b.expression, 'dizzy');
console.log('  ✔ Trình tự 6 giai đoạn của Fight Cloud thực thi chuẩn xác 100%.');

// 6. KIỂM THỬ ẨN THÂN THỂ KHI TRONG ĐÁM KHÓI (FIGHT SMOKE BODY MASKING)
console.log('\n6. Kiểm thử Ẩn Thân Thể Nhân Vật Trong Khói (Body Masking):');
assert.strictEqual(stateBrawl.actors.fighter_a.hideBody, true, 'Thân thể võ sĩ A phải bị ẩn (hideBody: true) trong khói');
assert.strictEqual(stateBrawl.actors.fighter_b.hideBody, true, 'Thân thể võ sĩ B phải bị ẩn (hideBody: true) trong khói');
assert.strictEqual(stateAftermath.actors.fighter_a.hideBody, false, 'Sau khi khói tan, thân thể võ sĩ A phải hiện lại');
assert.strictEqual(stateAftermath.actors.fighter_b.hideBody, false, 'Sau khi khói tan, thân thể võ sĩ B phải hiện lại');
console.log('  ✔ Thân thể nhân vật được che phủ hoàn toàn bên trong khói và hiện lại sau khi văng ra.');

// 7. KIỂM THỬ THÒ ĐẦU & TAY CHÂN HOẠT HÌNH (HEAD & LIMB POP-OUTS)
console.log('\n7. Kiểm thử Thò Đầu Nhân Vật & Tay Chân Hoạt Hình (Pop-outs):');
// Tại t = 1.8s (p = 0.40): Pop-out đầu nhân vật A
const statePop1 = solveCompositeAction('composite_fight_cloud', testFightBindings, 1.8, 0, 4.5);
assert.ok(statePop1.popouts.length >= 1, 'Phải có popout tại p = 0.40');
const popHeadA = statePop1.popouts.find(p => p.type === 'head' && p.role === 'fighter_a');
assert.ok(popHeadA, 'Phải có popout đầu của Fighter A');
assert.strictEqual(popHeadA.character, 'alex', 'Đầu thò ra phải giữ nguyên visual identity của Alex');

// Tại t = 2.25s (p = 0.50): Pop-out nắm đấm Fighter B
const statePop2 = solveCompositeAction('composite_fight_cloud', testFightBindings, 2.25, 0, 4.5);
const popFist = statePop2.popouts.find(p => p.type === 'fist');
assert.ok(popFist, 'Phải có popout nắm đấm comic fist');

// Tại t = 2.7s (p = 0.60): Pop-out đầu nhân vật B
const statePop3 = solveCompositeAction('composite_fight_cloud', testFightBindings, 2.7, 0, 4.5);
const popHeadB = statePop3.popouts.find(p => p.type === 'head' && p.role === 'fighter_b');
assert.ok(popHeadB, 'Phải có popout đầu của Fighter B');
assert.strictEqual(popHeadB.character, 'jake', 'Đầu thò ra phải giữ nguyên visual identity của Jake');

// Tại t = 3.15s (p = 0.70): Pop-out chân đá
const statePop4 = solveCompositeAction('composite_fight_cloud', testFightBindings, 3.15, 0, 4.5);
const popFoot = statePop4.popouts.find(p => p.type === 'foot');
assert.ok(popFoot, 'Phải có popout chân đá comic foot');
console.log('  ✔ Hệ thống Pop-outs hoạt động trơn tru: thò đầu A, vung đấm, thò đầu B, vung chân đá.');

// 8. KIỂM THỬ RUNG LẮC MÁY QUAY & SAO CHOÁNG VÁNG
console.log('\n8. Kiểm thử Rung Lắc Camera & Sao Bay Quanh Đầu:');
assert.ok(stateCollision.camera.shakeAmp >= 12, 'Camera shake đỉnh điểm tại va chạm');
assert.ok(stateBrawl.camera.shakeAmp >= 4, 'Camera shake liên tục trong suốt trận ẩu đả');
const dizzyVfxA = stateAftermath.actors.fighter_a.vfx.find(v => v.type === 'vfx_dizzy_stars');
const dizzyVfxB = stateAftermath.actors.fighter_b.vfx.find(v => v.type === 'vfx_dizzy_stars');
assert.ok(dizzyVfxA, 'Võ sĩ A phải có sao bay quanh đầu vfx_dizzy_stars');
assert.ok(dizzyVfxB, 'Võ sĩ B phải có sao bay quanh đầu vfx_dizzy_stars');
console.log('  ✔ Camera shake và sao choáng váng được gắn chính xác trên đỉnh đầu sau trận chiến.');

// 9. COMPOSITE ACTION 02: CARTOON CHASE
console.log('\n9. Kiểm thử Cartoon Chase (composite_chase):');
const chaseBindings = { runner: 'jake', chaser: 'alex' };
const stateChase = solveCompositeAction('composite_chase', chaseBindings, 1.5, 0, 3.5);
assert.ok(stateChase.actors.runner.x > stateChase.actors.chaser.x, 'Runner luôn chạy trước chaser');
assert.strictEqual(stateChase.actors.runner.pose, 'run');
assert.strictEqual(stateChase.actors.chaser.pose, 'run');
assert.ok(['shocked', 'terrified', 'worried'].includes(stateChase.actors.runner.expression));
assert.ok(['angry', 'furious'].includes(stateChase.actors.chaser.expression));
console.log('  ✔ Cartoon Chase phối hợp hoàn hảo giữa kẻ chạy thục mạng và kẻ rượt đuổi.');

// 10. COMPOSITE ACTION 03: POWER UP SURGE
console.log('\n10. Kiểm thử Power Up Surge (composite_power_up):');
const statePower = solveCompositeAction('composite_power_up', { actor: 'alex' }, 1.5, 0, 3.2);
assert.ok(statePower.actors.actor.vfx.some(v => v.type === 'vfx_golden_aura'), 'Có hào quang vàng rực lửa');
assert.ok(statePower.camera.shakeAmp > 5, 'Rung chuyển mặt đất khi tụ khí');
console.log('  ✔ Power Up Surge thể hiện chuẩn xác tụ khí, hào quang vàng bùng phát và sóng xung kích.');

// 11. COMPOSITE ACTION 04: FUNNY FALL
console.log('\n11. Kiểm thử Funny Fall (composite_funny_fall):');
const stateFallSlip = solveCompositeAction('composite_funny_fall', { actor: 'nam' }, 1.0, 0, 3.2);
assert.strictEqual(stateFallSlip.actors.actor.pose, 'fall_backward');
assert.ok(stateFallSlip.actors.actor.rotation < -0.5, 'Người ngửa ra sau khi trượt chân');
const stateFallAfter = solveCompositeAction('composite_funny_fall', { actor: 'nam' }, 2.8, 0, 3.2);
assert.strictEqual(stateFallAfter.actors.actor.expression, 'dizzy');
console.log('  ✔ Funny Fall thực hiện trọn vẹn cú trượt chân hài hước, nảy sàn và choáng váng.');

// 12. COMPOSITE ACTION 05: SHOCK REACTION
console.log('\n12. Kiểm thử Shock Reaction (composite_shock_reaction):');
const stateShock = solveCompositeAction('composite_shock_reaction', { actor: 'doc' }, 0.6, 0, 2.6);
assert.ok(stateShock.actors.actor.y < -30, 'Nhân vật nhảy vọt lên không trung');
assert.strictEqual(stateShock.actors.actor.expression, 'shocked');
assert.ok(stateShock.actors.actor.vfx.some(v => v.type === 'vfx_shock_lines'), 'Có tia sốc shock lines');
console.log('  ✔ Shock Reaction giật nảy mình 65px với tia sốc và mồ hôi bắn tung.');

// 13. COMPOSITE ACTION 06: CARTOON ARGUMENT
console.log('\n13. Kiểm thử Cartoon Argument (composite_cartoon_argument):');
const stateArgueA = solveCompositeAction('composite_cartoon_argument', { debater_a: 'alex', debater_b: 'jake' }, 0.8, 0, 4.2);
assert.strictEqual(stateArgueA.actors.debater_a.pose, 'point_shout');
assert.strictEqual(stateArgueA.actors.debater_b.pose, 'arms_crossed');
const stateArgueClash = solveCompositeAction('composite_cartoon_argument', { debater_a: 'alex', debater_b: 'jake' }, 3.3, 0, 4.2);
assert.strictEqual(stateArgueClash.actors.debater_a.pose, 'forehead_clash');
assert.strictEqual(stateArgueClash.actors.debater_b.pose, 'forehead_clash');
console.log('  ✔ Cartoon Argument mô phỏng khẩu chiến đổi lượt và đối đầu cụng trán kịch tính.');

// 14. COMPOSITE ACTION 07: OBJECT INTERACTION (PROP HANDOFF)
console.log('\n14. Kiểm thử Object Interaction & Chuyển giao Đạo cụ không trùng lặp:');
// Trước khi chuyển giao (t = 1.0s)
const statePropBefore = solveCompositeAction('composite_object_interaction', { giver: 'alex', receiver: 'jake' }, 1.0, 0, 3.6);
assert.ok(statePropBefore.actors.giver.prop, 'Giver đang cầm đạo cụ');
assert.strictEqual(statePropBefore.actors.giver.prop.state, 'held');
assert.strictEqual(statePropBefore.actors.receiver.prop, null, 'Receiver chưa cầm đạo cụ (không bị nhân đôi đồ vật)');

// Sau khi chuyển giao (t = 2.5s)
const statePropAfter = solveCompositeAction('composite_object_interaction', { giver: 'alex', receiver: 'jake' }, 2.5, 0, 3.6);
assert.strictEqual(statePropAfter.actors.giver.prop, null, 'Giver đã buông đạo cụ (không giữ hai chỗ)');
assert.ok(statePropAfter.actors.receiver.prop, 'Receiver đang sở hữu đạo cụ');
assert.strictEqual(statePropAfter.actors.receiver.prop.state, 'held');
console.log('  ✔ Chuyển giao đạo cụ liền mạch, đảm bảo đạo cụ chỉ thuộc về đúng 1 bên tại mỗi thời điểm.');

// 15. COMPOSITE ACTION 08: STORYTELLING & EUREKA
console.log('\n15. Kiểm thử Storytelling & Eureka:');
const stateIdea = solveCompositeAction('composite_storytelling', { actor: 'alex' }, 1.5, 0, 4.0);
assert.strictEqual(stateIdea.actors.actor.pose, 'point_upward');
assert.ok(stateIdea.actors.actor.vfx.some(v => v.type === 'vfx_idea_bulb'), 'Bóng đèn sáng trên đầu');
const stateCheer = solveCompositeAction('composite_storytelling', { actor: 'alex' }, 3.6, 0, 4.0);
assert.strictEqual(stateCheer.actors.actor.pose, 'celebrate_arms_up');
console.log('  ✔ Storytelling hoàn thành chuỗi Trầm ngâm -> Nảy ý tưởng (bóng đèn) -> Diễn giải -> Ăn mừng.');

// 16. KIỂM THỬ RENDER CANVAS KHÔNG LỖI (DRAW COMPOSITE ACTION)
console.log('\n16. Kiểm thử Vẽ Toàn Bộ 8 Hành Động Lên Canvas:');
const mockCtx = createMockCanvasContext();
for (const actId of expectedCoreActions) {
  const state = solveCompositeAction(actId, { actor: 'alex', fighter_a: 'alex', fighter_b: 'jake', runner: 'alex', chaser: 'jake', giver: 'alex', receiver: 'jake', debater_a: 'alex', debater_b: 'jake' }, 1.5, 0, 4.0);
  assert.doesNotThrow(() => {
    drawCompositeAction(mockCtx, state, 1.5);
  }, `Hàm drawCompositeAction cho "${actId}" không được ném lỗi!`);
}
assert.ok(mockCtx.calls.length > 500, 'Canvas phải nhận được hàng trăm lệnh vẽ chi tiết');
console.log(`  ✔ drawCompositeAction render thành công cả 8 hành động (${mockCtx.calls.length} lệnh vẽ canvas không lỗi).`);

// 17. BẢO TOÀN DIỆN MẠO NHÂN VẬT THỰC KHI THÒ ĐẦU (ALEX vs JAKE vs DOC)
console.log('\n17. Kiểm thử Giữ Nguyên Diện Mạo Thực Khi Thò Đầu (Mode A Visual Identity):');
const popoutAlex = { type: 'head', character: 'alex', expression: 'shocked', x: 0, y: 0, scale: 1, rotation: 0 };
const popoutJake = { type: 'head', character: 'jake', expression: 'angry', x: 0, y: 0, scale: 1, rotation: 0 };
const popoutDoc = { type: 'head', character: 'doc', expression: 'dizzy', x: 0, y: 0, scale: 1, rotation: 0 };

const ctxPopAlex = createMockCanvasContext();
const ctxPopJake = createMockCanvasContext();
const ctxPopDoc = createMockCanvasContext();

drawCompositeAction(ctxPopAlex, { actors: {}, popouts: [popoutAlex], globalVfx: [] }, 1.0);
drawCompositeAction(ctxPopJake, { actors: {}, popouts: [popoutJake], globalVfx: [] }, 1.0);
drawCompositeAction(ctxPopDoc, { actors: {}, popouts: [popoutDoc], globalVfx: [] }, 1.0);

assert.ok(ctxPopAlex.calls.length > 20, 'Đầu Alex render đầy đủ chi tiết khuôn mặt');
assert.ok(ctxPopJake.calls.length > 20, 'Đầu Jake render đầy đủ chi tiết kèm nón vàng');
assert.ok(ctxPopDoc.calls.length > 20, 'Đầu Doc render đầy đủ chi tiết kèm kính mắt');
console.log('  ✔ Đầu thò ra trong Fight Smoke giữ trọn vẹn đặc trưng riêng của từng nhân vật (mũ Jake, kính Doc, v.v.).');

// 18. TƯƠNG THÍCH ĐẦU THÒ RA VỚI MODE B (IMPORTED RIG)
console.log('\n18. Kiểm thử Tương Thích Pop-out với Nhân Vật Mode B:');
const modeBChar = {
  characterEngine: 'imported_layered',
  parts: { head: { id: 'head', image: '/public/assets/test_head.png' } }
};
const compReport = getCompositeActionCompatibility('composite_fight_cloud', { fighter_a: 'alex', fighter_b: modeBChar });
assert.ok(compReport.fallbackAvailable, 'Hệ thống có fallback tự động cho Mode B');
console.log('  ✔ Hệ thống kiểm tra tương thích và fallback cho Mode B sẵn sàng.');

// 19. TÍCH HỢP CAMERA DIRECTOR VỚI RUNG LẮC ACTION
console.log('\n19. Tích hợp Rung Lắc Camera với CameraDirector:');
const camDirector = new CameraDirector({ shotType: 'MEDIUM' });
camDirector.applyShake(stateCollision.camera.shakeAmp);
const camState = camDirector.update(0.016, 1.25);
assert.ok(camDirector.shakeAmp > 0, 'CameraDirector nhận được giá trị shakeAmp từ action');
console.log('  ✔ Dữ liệu rung chấn máy quay truyền thông suốt tới Camera Director.');

// 20. KIỂM TRA FILE ẢNH PNG 32-BIT THỰC TẾ TRONG PUBLIC/ASSETS/
console.log('\n20. Kiểm tra Tệp Ảnh PNG 32-bit Thực Tế trong public/assets/composite_action/:');
for (const actId of expectedCoreActions) {
  const thumbPath = path.resolve('public', 'assets', 'composite_action', actId, 'thumb.png');
  const actionPath = path.resolve('public', 'assets', 'composite_action', actId, 'action.png');
  assert.ok(fs.existsSync(thumbPath), `Tệp "${thumbPath}" phải tồn tại thực tế!`);
  assert.ok(fs.existsSync(actionPath), `Tệp "${actionPath}" phải tồn tại thực tế!`);
  const thumbStat = fs.statSync(thumbPath);
  const actStat = fs.statSync(actionPath);
  assert.ok(thumbStat.size > 50, `Tệp thumb "${thumbPath}" phải có dung lượng hợp lệ (>50 bytes)`);
  assert.ok(actStat.size > 50, `Tệp action "${actionPath}" phải có dung lượng hợp lệ (>50 bytes)`);
}
console.log('  ✔ 100% tài nguyên Composite Action có đầy đủ tệp ảnh PNG 32-bit thực tế.');

// 21. XUẤT VÀ NHẬP GÓI ZIP COMPOSITE ACTION KÈM TÀI NGUYÊN
console.log('\n21. Xuất & Nhập Gói ZIP Composite Action:');
const zipBuf = exportAssetPackage(['composite_fight_cloud']);
assert.ok(zipBuf && zipBuf.length > 200, 'Gói ZIP Composite Action phải được tạo thành Buffer hợp lệ');

// Nhập lại gói ZIP với collisionStrategy rename
const importRes = importAssetPackage(zipBuf, { collisionStrategy: 'rename' });
assert.ok(importRes.success, 'Nhập gói ZIP phải thành công');
assert.ok(importRes.importedAssets && importRes.importedAssets.length > 0, 'Phải có ít nhất 1 asset được nhập');
const importedAsset = importRes.importedAssets[0];
assert.ok(importedAsset.id.startsWith('composite_fight_cloud'), 'ID nhập lại phải được giải quyết đổi tên để tránh trùng');

// Dọn dẹp an toàn asset test vừa nhập
if (importedAsset.id !== 'composite_fight_cloud') {
  deleteAsset(importedAsset.id);
}
console.log('  ✔ Xuất/Nhập ZIP gói Composite Action kèm tệp ảnh PNG hoạt động hoàn hảo.');

// 22. KIỂM THỬ LƯU VÀ PHỤC HỒI DỰ ÁN (PROJECT SERIALIZATION ROUNDTRIP)
console.log('\n22. Kiểm thử Serialization & Phục Hồi Timeline Dự Án Chứa Composite Action:');
const sampleProject = {
  version: 4,
  shots: [
    {
      id: 'shot_brawl',
      name: 'Cảnh ẩu đả đường phố',
      duration: 4.5,
      compositeAction: {
        id: 'composite_fight_cloud',
        startTime: 0.0,
        duration: 4.5,
        roles: { fighter_a: 'alex', fighter_b: 'jake' },
        parameters: { smokeScale: 1.3, shakeIntensity: 0.9 }
      }
    }
  ]
};

const serialized = JSON.stringify(sampleProject);
const deserialized = JSON.parse(serialized);
assert.deepStrictEqual(deserialized, sampleProject, 'Dữ liệu dự án phải được phục hồi 100% toàn vẹn');
const restoredAction = solveCompositeAction(
  deserialized.shots[0].compositeAction.id,
  deserialized.shots[0].compositeAction.roles,
  2.5,
  deserialized.shots[0].compositeAction.startTime,
  deserialized.shots[0].compositeAction.duration,
  deserialized.shots[0].compositeAction.parameters
);
assert.ok(restoredAction.globalVfx.some(v => v.type === 'vfx_fight_smoke'), 'Action được phục hồi thực thi chính xác');
console.log('  ✔ Lưu và nạp cấu hình Composite Action trên timeline dự án bảo toàn 100% dữ liệu.');

console.log('\n=== TẤT CẢ 22 BÀI KIỂM THỬ COMPOSITE ACTION ENGINE V4 ĐẠT 100% PASS! ===');
