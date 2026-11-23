// engine/action-engine.js — Physical Action Animation Engine for White Cartoon 2D
// Provides kinematic cycles, anticipation, follow-through, and prop interactions.

import { clamp, lerp, seg, circle, ring, alpha, shade, mix, rr, poly, ease } from './core.js';
import { solve2BoneIK } from './white-cartoon-rig2d.js';

/**
 * 1. CHU KỲ BƯỚC ĐI TỰ NHIÊN (Natural Walk Cycle)
 * Có nhún hông (pelvis bounce), chân chạm đất bám sàn, sải tay ngược pha
 */
export function solveWalkCycle(t, o = {}) {
  const speed = o.speed ?? 1.0;
  const cycle = (t * speed * 2.0) % 1.0;
  const rad = cycle * Math.PI * 2;

  // Nhún hông 2 lần mỗi chu kỳ bước (Down trên contact, Up trên passing)
  const hipBob = -Math.abs(Math.sin(rad)) * 7;
  const hipX = Math.sin(rad) * 2;
  const hip = [hipX, -44 + hipBob];

  // Thân trên và vai nghiêng nhẹ ngược chiều hông
  const torsoAngle = Math.sin(rad) * 0.04;
  const sh = [hip[0] + Math.sin(torsoAngle) * 38, hip[1] - 38];
  const head = [sh[0] + Math.sin(torsoAngle) * 44 + 1, sh[1] - 44];

  // Chân gần (Near Leg - F) và Chân xa (Far Leg - B) ngược pha PI
  const stepLen = 24 * (o.stride || 1.0);
  const footLift = 18;

  // Góc vung chân
  const swingF = Math.sin(rad);
  const swingB = Math.sin(rad + Math.PI);

  // Vị trí bàn chân F
  const fFx = hip[0] + swingF * stepLen;
  const fFy = swingF > 0 ? -Math.sin(rad) * footLift : 0; // Khi tiến lên thì nhấc chân khỏi mặt đất
  const fF = [fFx, fFy];

  // Vị trí bàn chân B
  const fBx = hip[0] + swingB * stepLen;
  const fBy = swingB > 0 ? -Math.sin(rad + Math.PI) * footLift : 0;
  const fB = [fBx, fBy];

  // Tính vị trí đầu gối bằng 2-Bone IK
  const legLen = 24;
  const kF = solve2BoneIK(hip, fF, legLen, legLen, 1);
  const kB = solve2BoneIK(hip, fB, legLen, legLen, 1);

  // Tay vung ngược chiều với chân (Arm swing counter-phase to legs)
  const armLen = 20;
  const armSwingF = -swingF * 22;
  const armSwingB = -swingB * 22;

  const hF = [sh[0] + armSwingF, sh[1] + 34];
  const hB = [sh[0] + armSwingB, sh[1] + 34];

  const eF = solve2BoneIK(sh, hF, armLen, armLen, 1);
  const eB = solve2BoneIK(sh, hB, armLen, armLen, -1);

  return {
    isWhiteCartoon: true,
    hip, sh, head,
    eF, hF, eB, hB,
    kF, fF, kB, fB
  };
}

/**
 * 2. CHU KỲ CHẠY (Run Cycle)
 * Nghiêng người về phía trước, co gập gối cao, có pha bay trên không
 */
export function solveRunCycle(t, o = {}) {
  const speed = o.speed ?? 1.3;
  const cycle = (t * speed * 2.8) % 1.0;
  const rad = cycle * Math.PI * 2;

  // Nhún hông và pha bay
  const hipBob = -Math.abs(Math.sin(rad)) * 14 - 8;
  const forwardLean = 0.16; // Nghiêng người lao về phía trước
  const hip = [4, -44 + hipBob];
  const sh = [hip[0] + Math.sin(forwardLean) * 38, hip[1] - Math.cos(forwardLean) * 38];
  const head = [sh[0] + Math.sin(forwardLean) * 44 + 3, sh[1] - Math.cos(forwardLean) * 44];

  const stepLen = 38 * (o.stride || 1.0);
  const footLift = 26;

  const swingF = Math.sin(rad);
  const swingB = Math.sin(rad + Math.PI);

  const fF = [hip[0] + swingF * stepLen, swingF > 0 ? -Math.sin(rad) * footLift : 0];
  const fB = [hip[0] + swingB * stepLen, swingB > 0 ? -Math.sin(rad + Math.PI) * footLift : 0];

  const legLen = 24;
  const kF = solve2BoneIK(hip, fF, legLen, legLen, 1);
  const kB = solve2BoneIK(hip, fB, legLen, legLen, 1);

  // Tay gập góc 90 độ vung mạnh mẽ
  const armLen = 18;
  const hF = [sh[0] - swingF * 30, sh[1] + 16];
  const hB = [sh[0] - swingB * 30, sh[1] + 16];

  const eF = solve2BoneIK(sh, hF, armLen, armLen, 1);
  const eB = solve2BoneIK(sh, hB, armLen, armLen, -1);

  return {
    isWhiteCartoon: true,
    hip, sh, head,
    eF, hF, eB, hB,
    kF, fF, kB, fB
  };
}

/**
 * 3. HÀNH ĐỘNG RÓN RÉN CẦM ĐẠO CỤ (Sneak Walk with Prop)
 * Dáng cúi khom thấp người, bước nhẹ chậm rãi, hai tay cầm chổi hướng về trước
 */
export function solveSneakWalkCycle(t, o = {}) {
  const speed = o.speed ?? 0.6;
  const cycle = (t * speed * 1.5) % 1.0;
  const rad = cycle * Math.PI * 2;

  // Trọng tâm hạ thấp, đầu gối luôn chùng (Crouched Center of Gravity)
  const hipBob = -Math.abs(Math.sin(rad)) * 5;
  const hip = [0, -32 + hipBob]; // Hạ thấp 12px so với đứng thẳng
  const crouchLean = 0.22; // Khom lưng về phía trước
  const sh = [hip[0] + Math.sin(crouchLean) * 36, hip[1] - Math.cos(crouchLean) * 36];
  const head = [sh[0] + Math.sin(crouchLean) * 40 + 2, sh[1] - Math.cos(crouchLean) * 40];

  // Bước chân chậm rãi, cẩn trọng
  const stepLen = 18;
  const swingF = Math.sin(rad);
  const swingB = Math.sin(rad + Math.PI);

  const fF = [hip[0] + swingF * stepLen, swingF > 0 ? -Math.sin(rad) * 12 : 0];
  const fB = [hip[0] + swingB * stepLen, swingB > 0 ? -Math.sin(rad + Math.PI) * 12 : 0];

  const legLen = 24;
  const kF = solve2BoneIK(hip, fF, legLen, legLen, 1);
  const kB = solve2BoneIK(hip, fB, legLen, legLen, 1);

  // Hai tay hướng về phía trước cầm cán chổi (Holding broom ready for defense)
  const hF = [sh[0] + 34, sh[1] + 12];
  const hB = [sh[0] + 20, sh[1] + 16];

  const armLen = 20;
  const eF = solve2BoneIK(sh, hF, armLen, armLen, 1);
  const eB = solve2BoneIK(sh, hB, armLen, armLen, -1);

  return {
    isWhiteCartoon: true,
    hip, sh, head,
    eF, hF, eB, hB,
    kF, fF, kB, fB,
    propHand: hF
  };
}

/**
 * 4. HÀNH ĐỘNG NGÃ NGỬA COMIC (Dramatic Comedic Backward Slip & Fall)
 * Chân trượt về trước bắn lên trời, người ngả ra sau, rơi đập lưng xuống sàn có nảy
 */
export function solveFallBackwardAction(p) {
  const t = clamp(p, 0, 1);

  if (t < 0.2) {
    // Giai đoạn 1: Giật mình hoảng hốt (Anticipation)
    const k = t / 0.2;
    return {
      isWhiteCartoon: true,
      hip: [-4 * k, -44 - 6 * k],
      sh: [-10 * k, -82 - 4 * k],
      head: [-14 * k, -126],
      eF: [22 * k, -100], hF: [28 * k, -135],
      eB: [-15 * k, -100], hB: [-20 * k, -135],
      kF: [12, -22], fF: [14 + 10 * k, 0],
      kB: [-10, -22], fB: [-10, 0]
    };
  } else if (t < 0.6) {
    // Giai đoạn 2: Trượt chân, bay người ra sau, 2 chân vung lên trời
    const k = (t - 0.2) / 0.4;
    const slipAngle = -k * 1.35; // Xoay người ra sau

    const hip = [-18 * k, -35 + 25 * k];
    const sh = [hip[0] + Math.sin(slipAngle) * 38, hip[1] - Math.cos(slipAngle) * 38];
    const head = [sh[0] + Math.sin(slipAngle) * 42, sh[1] - Math.cos(slipAngle) * 42];

    // Chân gần (F) bắn cao lên trời
    const fF = [hip[0] + 35 * k + 10, -32 * k];
    const kF = [hip[0] + 20 * k, -20 * k];

    // Chân xa (B) giãy đạp
    const fB = [hip[0] + 15 * k - 8, -20 * k];
    const kB = [hip[0] + 6 * k, -12 * k];

    // Hai tay vung loạn xạ trong không trung (Flailing arms)
    const hF = [sh[0] + 15, sh[1] - 30 * k];
    const eF = [sh[0] + 25, sh[1] - 10 * k];
    const hB = [sh[0] - 25, sh[1] - 25 * k];
    const eB = [sh[0] - 15, sh[1] - 8 * k];

    return {
      isWhiteCartoon: true,
      hip, sh, head,
      eF, hF, eB, hB,
      kF, fF, kB, fB
    };
  } else {
    // Giai đoạn 3: Rơi đập lưng xuống sàn nảy nhẹ (Floor Impact & Settle)
    const k = (t - 0.6) / 0.4;
    const bounce = Math.sin(k * Math.PI) * 8 * (1 - k);

    // Người nằm bẹp trên sàn
    const hip = [-24, -10 - bounce];
    const sh = [-60, -12 - bounce];
    const head = [-100, -16 - bounce];

    // Chân gác chéo trên sàn
    const kF = [-8, -22 - bounce];
    const fF = [16, -14];
    const kB = [-14, -18 - bounce];
    const fB = [6, -8];

    // Tay buông thõng hai bên
    const eF = [-45, -28 - bounce];
    const hF = [-30, -38 - bounce];
    const eB = [-65, 4];
    const hB = [-45, 6];

    return {
      isWhiteCartoon: true,
      hip, sh, head,
      eF, hF, eB, hB,
      kF, fF, kB, fB,
      isFloorImpact: k < 0.3
    };
  }
}

/**
 * 5. HÀNH ĐỘNG GIẬT MÌNH HOẢNG SỢ (Scared Startle Reaction Jump)
 */
export function solveScaredReactionAction(t, progress = 0) {
  const p = clamp(progress, 0, 1);
  // Nhảy thót lên không trung rồi tiếp đất run rẩy
  const jumpY = -Math.sin(p * Math.PI) * 28;
  const shiver = Math.sin(t * 44) * 2.5;

  const hip = [shiver, -44 + jumpY];
  const sh = [shiver, -82 + jumpY];
  const head = [shiver * 1.2, -128 + jumpY];

  // Hai tay ôm chặt lấy má hoặc đưa lên trời hoảng hốt
  const eF = [26, -112 + jumpY];
  const hF = [22, -148 + jumpY];
  const eB = [-26, -112 + jumpY];
  const hB = [-22, -148 + jumpY];

  // Chân co gập lại khi bị giật mình
  const kF = [18, -26 + jumpY];
  const fF = [14, -10 + jumpY];
  const kB = [-16, -26 + jumpY];
  const fB = [-14, -10 + jumpY];

  return {
    isWhiteCartoon: true,
    hip, sh, head,
    eF, hF, eB, hB,
    kF, fF, kB, fB
  };
}

/**
 * 6. VẼ ĐẠO CỤ CHỔI QUÉT NHÀ (The Household Broom)
 */
export function drawBroom(g, x, y, angle = 0.45, length = 110, inkCol = '#20202A') {
  g.save();
  g.translate(x, y);
  g.rotate(angle);

  // Cán chổi bằng gỗ vàng cam
  g.strokeStyle = '#d97706';
  g.lineWidth = 7.0;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, -length * 0.7);
  g.lineTo(0, length * 0.3);
  g.stroke();

  // Viền cán chổi
  g.strokeStyle = inkCol;
  g.lineWidth = 2.4;
  g.strokeRect(-4, -length * 0.7, 8, length);

  // Phần đầu chổi rơm quét nhà (Straw Broom Head)
  const headY = length * 0.3;
  g.fillStyle = '#fef08a';
  g.strokeStyle = inkCol;
  g.lineWidth = 3.2;

  poly(g, [
    [-12, headY],
    [12, headY],
    [32, headY + 45],
    [-32, headY + 45]
  ], '#fef08a');
  g.stroke();

  // Dây buộc rơm màu đỏ
  g.fillStyle = '#dc2626';
  rr(g, -13, headY + 6, 26, 8, 2);
  g.fill();
  g.stroke();

  // Các sợi rơm chổi
  g.strokeStyle = '#ca8a04';
  g.lineWidth = 2.0;
  for (let s = -22; s <= 22; s += 7) {
    g.beginPath();
    g.moveTo(s * 0.4, headY + 14);
    g.lineTo(s, headY + 43);
    g.stroke();
  }

  g.restore();
}

/**
 * 7. VẼ CHÚ MÈO ĐEN HOẠT HÌNH NHẢY RA (Cartoon Black Cat)
 * Khiến Nam sợ ma ngã ngửa nhưng thực ra chỉ là con mèo đen mắt tròn xoe đáng yêu!
 */
export function drawBlackCat(g, x, y, state = 'leap', t = 0, inkCol = '#20202A') {
  g.save();
  g.translate(x, y);

  const catBlack = '#18181b';

  if (state === 'leap') {
    // Mèo nhảy phóng qua không trung: lưng cong vút, 4 chân duỗi, đuôi vểnh
    g.rotate(-0.25);

    // Thân mèo đen mượt
    g.fillStyle = catBlack;
    g.strokeStyle = inkCol;
    g.lineWidth = 3.2;
    g.beginPath();
    g.ellipse(0, 0, 36, 18, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // Đầu mèo tròn
    circle(g, 34, -10, 16, catBlack);
    ring(g, 34, -10, 16, 3.2, inkCol);

    // 2 tai nhọn vểnh
    poly(g, [[24, -20], [30, -34], [36, -20]], catBlack);
    g.stroke();
    poly(g, [[35, -20], [42, -34], [48, -20]], catBlack);
    g.stroke();
    // Ruột tai hồng
    poly(g, [[26, -20], [30, -30], [34, -20]], '#fda4af');

    // 2 mắt vàng to tròn sáng rực trong bóng đêm (Big Bright Yellow Eyes!)
    circle(g, 32, -10, 5.5, '#fef08a');
    circle(g, 42, -10, 5.5, '#fef08a');
    // Con ngươi mèo
    circle(g, 33, -10, 3.2, inkCol);
    circle(g, 43, -10, 3.2, inkCol);
    // Điểm sáng mắt
    circle(g, 34, -11, 1.2, '#ffffff');
    circle(g, 44, -11, 1.2, '#ffffff');

    // Mũi và râu mèo
    circle(g, 46, -5, 2.0, '#fda4af');
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.6;
    [-4, 0, 4].forEach(ry => {
      g.beginPath();
      g.moveTo(46, -5);
      g.lineTo(58, -5 + ry);
      g.stroke();
    });

    // 2 chân trước duỗi thẳng vồ
    seg(g, [[20, 8], [42, 24]], 9, catBlack);
    seg(g, [[14, 8], [34, 26]], 9, catBlack);

    // 2 chân sau đạp mạnh
    seg(g, [[-20, 4], [-44, 18]], 9, catBlack);
    seg(g, [[-14, 4], [-36, 22]], 9, catBlack);

    // Đuôi mèo cong hình chữ S
    g.strokeStyle = catBlack;
    g.lineWidth = 7.0;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-32, -4);
    g.quadraticCurveTo(-55, -28, -48, -46);
    g.stroke();
  } else {
    // Mèo ngồi liếm lông / chớp mắt dễ thương (Sitting Innocent Cat)
    g.fillStyle = catBlack;
    g.strokeStyle = inkCol;
    g.lineWidth = 3.2;

    // Thân ngồi hình quả lê
    g.beginPath();
    g.ellipse(0, 0, 20, 26, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // Đầu mèo
    circle(g, 0, -28, 16, catBlack);
    ring(g, 0, -28, 16, 3.2, inkCol);

    // Tai nhọn
    poly(g, [[-12, -38], [-8, -50], [-2, -38]], catBlack);
    g.stroke();
    poly(g, [[2, -38], [8, -50], [12, -38]], catBlack);
    g.stroke();

    // Mắt mèo tròn xoe
    circle(g, -6, -28, 5.0, '#fef08a');
    circle(g, 6, -28, 5.0, '#fef08a');
    circle(g, -5, -28, 3.0, inkCol);
    circle(g, 7, -28, 3.0, inkCol);

    // Chân trước khép ngoan ngoãn
    seg(g, [[-6, 10], [-6, 25]], 7, catBlack);
    seg(g, [[6, 10], [6, 25]], 7, catBlack);

    // Đuôi quấn quanh chân
    g.strokeStyle = catBlack;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(0, 22, 22, 0, Math.PI);
    g.stroke();
  }

  g.restore();
}
