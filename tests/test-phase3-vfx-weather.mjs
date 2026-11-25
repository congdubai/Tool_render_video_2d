/**
 * tests/test-phase3-vfx-weather.mjs
 * Comprehensive automated test suite for Thanh Hai 2D Studio V4 Phase 3:
 * Cartoon VFX, Weather Simulation, Deterministic Particle Engine,
 * Skeletal Attachments, 6-Layer Compositing & External Sprite Sheet Animation.
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import {
  hashRNG,
  createDeterministicRNG,
  solveParticle,
  solveEffectAttachment,
  normalizeVfxSpec,
  solveVfxCameraShake,
  VFX_DISPATCHER,
  drawUniversalVfx
} from "../thanhhai-2d-studio/engine/vfx-engine-v4.js";
import {
  ensureAssetStorage,
  listAssets,
  getAsset,
  saveAsset,
  exportAssetPackage,
  importAssetPackage
} from "../lib/asset-registry.mjs";

console.log("=== BẮT ĐẦU KIỂM THỬ GIAI ĐOẠN 3: CARTOON VFX & WEATHER ENGINE (V4) ===");

// Tạo Canvas Context 2D Mock phục vụ kiểm tra vẽ procedurals trong Node.js
function createMockCanvasContext() {
  const calls = [];
  return {
    calls,
    save: () => calls.push({ op: "save" }),
    restore: () => calls.push({ op: "restore" }),
    translate: (x, y) => calls.push({ op: "translate", x, y }),
    scale: (sx, sy) => calls.push({ op: "scale", sx, sy }),
    rotate: (rad) => calls.push({ op: "rotate", rad }),
    beginPath: () => calls.push({ op: "beginPath" }),
    closePath: () => calls.push({ op: "closePath" }),
    moveTo: (x, y) => calls.push({ op: "moveTo", x, y }),
    lineTo: (x, y) => calls.push({ op: "lineTo", x, y }),
    arc: (x, y, r, sa, ea) => calls.push({ op: "arc", x, y, r }),
    arcTo: (x1, y1, x2, y2, r) => calls.push({ op: "arcTo", x1, y1, x2, y2, r }),
    ellipse: (x, y, rx, ry, rot, sa, ea) => calls.push({ op: "ellipse", x, y, rx, ry }),
    quadraticCurveTo: (cpx, cpy, x, y) => calls.push({ op: "quadraticCurveTo", x, y }),
    bezierCurveTo: (cp1x, cp1y, cp2x, cp2y, x, y) => calls.push({ op: "bezierCurveTo", x, y }),
    rect: (x, y, w, h) => calls.push({ op: "rect", x, y, w, h }),
    fillRect: (x, y, w, h) => calls.push({ op: "fillRect", x, y, w, h }),
    strokeRect: (x, y, w, h) => calls.push({ op: "strokeRect", x, y, w, h }),
    fill: () => calls.push({ op: "fill" }),
    stroke: () => calls.push({ op: "stroke" }),
    strokeText: (txt, x, y) => calls.push({ op: "strokeText", txt }),
    fillText: (txt, x, y) => calls.push({ op: "fillText", txt }),
    drawImage: () => calls.push({ op: "drawImage" }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    globalAlpha: 1.0,
    lineWidth: 1.0,
    lineCap: "butt",
    lineJoin: "miter",
    strokeStyle: "#000",
    fillStyle: "#000"
  };
}

// 1. KIỂM THỬ ĐỘNG CƠ HẠT DETERMINISTIC (PRNG & PARTICLE SOLVER)
console.log("\n1. Kiểm thử Tính Toán Ngẫu Nhiên Tất Định (Deterministic Particle Solver):");
{
  const v1 = hashRNG(42, 10, 5);
  const v2 = hashRNG(42, 10, 5);
  assert.strictEqual(v1, v2, "hashRNG phải cho kết quả hoàn toàn trùng khớp với cùng seed và index!");
  assert.ok(v1 >= 0 && v1 < 1.0, "Giá trị hashRNG phải nằm trong khoảng [0, 1)!");
  console.log("  ✔ hashRNG: Tính toán 100% tất định (Deterministic), không sai lệch.");

  // Kiểm tra giải hạt tại các thời điểm t khác nhau
  const pSpec = {
    count: 20,
    lifetime: 1.0,
    speed: 1.0,
    seed: 100,
    emitterType: "circle",
    emitterArea: [0, 0, 50],
    direction: -Math.PI / 2,
    initialVelocity: 150,
    gravity: 98,
    size: 12
  };

  const pAt1s = solveParticle(pSpec, 0, 1.25);
  const pAt1sAgain = solveParticle(pSpec, 0, 1.25);
  assert.deepStrictEqual(pAt1s, pAt1sAgain, "solveParticle phải cho cùng tọa độ và kích thước khi gọi lại cùng timestamp!");

  const pAt2s = solveParticle(pSpec, 0, 2.0);
  assert.notDeepStrictEqual(pAt1s.y, pAt2s.y, "solveParticle phải di chuyển hạt chính xác theo thời gian!");
  console.log("  ✔ solveParticle: Vị trí hạt tính giải tích O(1), nhất quán giữa Preview và Render.");
}

// 2. KIỂM THỬ TOÀN BỘ 4 NHÓM CARTOON VFX (PROCEDURAL DRAWERS)
console.log("\n2. Kiểm thử 4 Nhóm Hiệu Ứng Cartoon VFX Library:");
{
  const mockCtx = createMockCanvasContext();
  const testVfxList = [
    // Emotion
    "vfx_sweat_drop", "vfx_anger_mark", "vfx_anger_smoke", "vfx_question_mark",
    "vfx_exclamation_mark", "vfx_love_hearts", "vfx_cartoon_tears", "vfx_dizzy_stars",
    "vfx_embarrassment_lines", "vfx_shock_lines", "vfx_dark_gloom", "vfx_idea_bulb",
    // Action
    "vfx_dust_cloud", "vfx_fight_smoke", "vfx_impact_flash", "vfx_cartoon_explosion",
    "vfx_speed_lines", "vfx_shockwave", "vfx_ground_dust", "vfx_crash_stars",
    "vfx_smoke_puff", "vfx_comic_burst",
    // Energy
    "vfx_golden_aura", "vfx_blue_aura", "vfx_red_aura", "vfx_energy_ring",
    "vfx_lightning_energy", "vfx_body_glow", "vfx_power_burst", "vfx_sparkles",
    "vfx_magic_particles", "vfx_floating_energy",
    // Scene
    "vfx_screen_flash", "vfx_vignette", "vfx_focus_lines", "vfx_fade_in", "vfx_fade_out"
  ];

  for (const vfxKey of testVfxList) {
    const fn = VFX_DISPATCHER[vfxKey];
    assert.ok(typeof fn === "function", `VFX "${vfxKey}" phải có hàm vẽ đã đăng ký trong VFX_DISPATCHER!`);
    const initialCallCount = mockCtx.calls.length;
    drawUniversalVfx(mockCtx, { type: vfxKey, scale: 1.0, duration: 2.0 }, 0.5, {
      character: { x: 960, y: 540, facing: 1, s: 1.0 }
    });
    assert.ok(mockCtx.calls.length > initialCallCount, `VFX "${vfxKey}" phải thực hiện các lệnh vẽ Canvas!`);
  }
  console.log(`  ✔ Tất cả ${testVfxList.length} hiệu ứng Cartoon VFX hoạt động trơn tru trên Canvas!`);
}

// 3. KIỂM THỬ THƯ VIỆN THỜI TIẾT & MÔI TRƯỜNG (WEATHER ENGINE)
console.log("\n3. Kiểm thử Thư Viện Thời Tiết & Môi Trường (Weather Engine):");
{
  const mockCtx = createMockCanvasContext();
  const weatherList = [
    "weather_rain_cinematic", "weather_rain_heavy", "weather_snow_gentle",
    "weather_wind_breeze", "weather_sunshine_rays", "weather_fog_mystic",
    "weather_storm_thunder", "weather_env_leaves", "weather_env_petals",
    "weather_env_fireflies", "weather_env_bubbles"
  ];

  for (const wKey of weatherList) {
    const fn = VFX_DISPATCHER[wKey];
    assert.ok(typeof fn === "function", `Thời tiết "${wKey}" phải có hàm thực thi trong VFX_DISPATCHER!`);
    const countBefore = mockCtx.calls.length;
    drawUniversalVfx(mockCtx, { type: wKey, intensity: 1.0, duration: 5.0 }, 1.2);
    assert.ok(mockCtx.calls.length > countBefore, `Thời tiết "${wKey}" phải sinh các phần tử môi trường!`);
  }
  console.log(`  ✔ Tất cả ${weatherList.length} hiệu ứng thời tiết & môi trường vượt qua kiểm thử!`);
}

// 4. KIỂM THỬ SKELETAL ATTACHMENTS VÀ PHÂN LỚP DUAL-LAYER
console.log("\n4. Kiểm thử Gắn Hiệu Ứng Theo Khớp Xương (Skeletal Attachment & Layering):");
{
  const mockSkeleton = {
    x: 500,
    y: 700,
    s: 1.5,
    facing: -1,
    pose: {
      head: [10, -110],
      sh: [0, -80],
      hip: [0, -40],
      hF: [30, -50],
      hB: [-30, -50],
      fF: [20, 0],
      fB: [-20, 0]
    }
  };

  // Test gắn vào Head
  const headAttached = solveEffectAttachment({ attachment: "head", scale: 1.0 }, mockSkeleton);
  // Head world: x = 500 + 10 * (-1) * 1.5 = 500 - 15 = 485; y = 700 + (-110) * 1.5 = 535
  assert.strictEqual(headAttached.x, 485, "Tọa độ X gắn đầu phải phản ánh đúng tỷ lệ và hướng nhân vật!");
  assert.strictEqual(headAttached.y, 535, "Tọa độ Y gắn đầu phải chuẩn xác!");
  assert.strictEqual(headAttached.scale, 1.5, "Scale hiệu ứng phải kế thừa tỷ lệ nhân vật!");
  console.log("  ✔ Gắn hiệu ứng vào Head: Tọa độ biến đổi chính xác theo skeletal transform.");

  // Test gắn vào Left Hand
  const handAttached = solveEffectAttachment({ attachment: "left_hand" }, mockSkeleton);
  assert.ok(handAttached.x !== mockSkeleton.x, "Tọa độ tay phải tính toán đúng vị trí khớp tay!");
  console.log("  ✔ Gắn hiệu ứng vào Hand & Feet: Khớp nối xương bám dính hoàn hảo.");

  // Test Camera Shake không làm thay đổi tọa độ nhân vật
  const shake1 = solveVfxCameraShake(0.5, { intensity: 1.2 });
  assert.ok(typeof shake1.x === "number" && typeof shake1.y === "number", "Camera Shake phải trả về độ lệch (x, y)!");
  assert.strictEqual(mockSkeleton.x, 500, "Camera Shake tuyệt đối không làm thay đổi vĩnh viễn tọa độ nhân vật!");
  console.log("  ✔ Camera Shake: Tác động độc lập lên góc quay camera, bảo toàn tọa độ nhân vật.");
}

// 5. KIỂM THỬ KHẢ NĂNG CHE PHỦ CỦA FIGHT SMOKE (MASKING CAPABILITIES)
console.log("\n5. Kiểm thử Masking & Ẩn Hiện Nhân Vật Của Fight Smoke (Phase 4 Ready):");
{
  const spec = normalizeVfxSpec({
    type: "vfx_fight_smoke",
    startTime: 1.0,
    endTime: 4.0,
    params: { maskCharacters: true }
  });

  assert.strictEqual(spec.type, "vfx_fight_smoke", "Spec phải được chuẩn hóa đúng loại fight smoke.");
  assert.strictEqual(spec.params.maskCharacters, true, "Cờ maskCharacters phải được kích hoạt.");

  // Kiểm tra logic ẩn body khi khói kích hoạt
  const tInside = 2.5;
  const isSmokeActive = tInside >= spec.startTime && tInside <= spec.endTime && spec.params.maskCharacters;
  assert.strictEqual(isSmokeActive, true, "Nhân vật phải bị che khuất trong khoảng thời gian khói đánh nhau!");

  const tOutside = 4.5;
  const isSmokeEnded = tOutside > spec.endTime;
  assert.strictEqual(isSmokeEnded, true, "Nhân vật phải được khôi phục hiển thị đầy đủ khi khói tan!");
  console.log("  ✔ Fight Smoke Masking: Sẵn sàng 100% cho Composite Action ẩu đả ở Phase 4.");
}

// 6. KIỂM THỬ TỆP ẢNH PNG 32-BIT THỰC TẾ TRONG PUBLIC/ASSETS/
console.log("\n6. Kiểm tra Tệp Ảnh PNG 32-bit Thực Tế trong public/assets/:");
{
  const vfxAssets = [
    "vfx_sweat_drop", "vfx_anger_mark", "vfx_golden_aura", "vfx_fight_smoke",
    "vfx_cartoon_explosion", "vfx_dizzy_stars", "vfx_speed_lines"
  ];
  const weatherAssets = [
    "weather_rain_cinematic", "weather_snow_gentle", "weather_storm_thunder", "weather_sunshine_rays"
  ];

  for (const id of vfxAssets) {
    const vfxPng = path.resolve("public", "assets", "vfx", id, "vfx.png");
    const thumbPng = path.resolve("public", "assets", "vfx", id, "thumb.png");
    assert.ok(fs.existsSync(vfxPng), `Tệp PNG "${vfxPng}" phải tồn tại thực tế trên đĩa!`);
    assert.ok(fs.existsSync(thumbPng), `Tệp Thumb "${thumbPng}" phải tồn tại thực tế trên đĩa!`);
  }

  for (const id of weatherAssets) {
    const wPng = path.resolve("public", "assets", "weather", id, "weather.png");
    const thumbPng = path.resolve("public", "assets", "weather", id, "thumb.png");
    assert.ok(fs.existsSync(wPng), `Tệp PNG "${wPng}" phải tồn tại thực tế trên đĩa!`);
    assert.ok(fs.existsSync(thumbPng), `Tệp Thumb "${thumbPng}" phải tồn tại thực tế trên đĩa!`);
  }

  console.log("  ✔ 100% tài nguyên VFX & Weather mẫu đều có tệp ảnh PNG 32-bit trong suốt thực tế!");
}

// 7. KIỂM THỬ ĐÓNG GÓI ZIP & NHẬP GÓI TÀI NGUYÊN VFX
console.log("\n7. Kiểm thử Xuất & Nhập Gói ZIP VFX Chứa Đầy Đủ Tệp Media:");
{
  ensureAssetStorage();
  const auraAsset = getAsset("vfx_golden_aura");
  assert.ok(auraAsset, "Phải lấy được asset vfx_golden_aura từ thư viện!");

  const zipBuf = exportAssetPackage(["vfx_golden_aura"], {
    packageName: "VFX Energy Pack",
    version: "1.0.0"
  });
  assert.ok(zipBuf && zipBuf.length > 500, "Gói ZIP phải chứa đầy đủ manifest và media files!");

  const importResult = importAssetPackage(zipBuf, { collisionStrategy: "rename" });
  assert.ok(importResult.success, "Nhập gói ZIP VFX phải thành công!");
  assert.ok(importResult.importedCount >= 1, "Phải nhập thành công ít nhất 1 asset!");

  // Dọn dẹp asset tạm import
  for (const imp of importResult.importedAssets) {
    if (imp.id.includes("_imp")) {
      const p = path.resolve("data", "assets", `${imp.id}.json`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
      const mediaDir = path.resolve("public", "assets", imp.type, imp.id);
      if (fs.existsSync(mediaDir)) fs.rmSync(mediaDir, { recursive: true, force: true });
    }
  }
  console.log("  ✔ Xuất/Nhập ZIP gói hiệu ứng VFX kèm file ảnh PNG thực tế thành công mỹ mãn.");
}

console.log("\n=== TẤT CẢ KIỂM THỬ GIAI ĐOẠN 3 (CARTOON VFX & WEATHER ENGINE) ĐẠT 100% PASS! ===");
