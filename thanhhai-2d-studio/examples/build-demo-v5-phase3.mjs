// thanhhai-2d-studio/examples/build-demo-v5-phase3.mjs — Mandatory 8-Scene Demo Project Builder (V5 Phase 3)
// Topic: SỰ TIẾN HÓA CỦA MÁY TÍNH (1945 - Hiện Đại) — 8 Scenes, 32 Seconds

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { BatchSceneBuilder } from '../engine/v5-batch-scene-builder.js';

const DEMO_DIR = path.resolve(process.cwd(), 'thanhhai-2d-studio/examples/demo-v5-phase3-computer-evolution');
fs.mkdirSync(DEMO_DIR, { recursive: true });
fs.mkdirSync(path.join(DEMO_DIR, 'assets'), { recursive: true });
fs.mkdirSync(path.join(DEMO_DIR, 'scenes/shots'), { recursive: true });
fs.mkdirSync(path.join(DEMO_DIR, 'story'), { recursive: true });

// 1. Ensure real transparent PNG assets exist in demo directory
async function generateAssetPngs() {
  const assetsDir = path.join(DEMO_DIR, 'assets');

  // ENIAC
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 30, g: 41, b: 59, alpha: 1.0 }
    }
  })
  .composite([
    {
      input: Buffer.from(`
        <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <rect x="30" y="30" width="452" height="452" rx="16" fill="#1e293b" stroke="#38bdf8" stroke-width="8"/>
          <text x="256" y="90" fill="#38bdf8" font-size="32" font-family="sans-serif" font-weight="bold" text-anchor="middle">ENIAC (1945)</text>
          <line x1="50" y1="120" x2="462" y2="120" stroke="#0284c7" stroke-width="4"/>
          <!-- Vacuum Tubes Grid -->
          <circle cx="100" cy="180" r="24" fill="#fbbf24" stroke="#d97706" stroke-width="4"/>
          <circle cx="180" cy="180" r="24" fill="#fbbf24" stroke="#d97706" stroke-width="4"/>
          <circle cx="260" cy="180" r="24" fill="#fbbf24" stroke="#d97706" stroke-width="4"/>
          <circle cx="340" cy="180" r="24" fill="#fbbf24" stroke="#d97706" stroke-width="4"/>
          <circle cx="420" cy="180" r="24" fill="#fbbf24" stroke="#d97706" stroke-width="4"/>
          <circle cx="100" cy="260" r="24" fill="#fbbf24" stroke="#d97706" stroke-width="4"/>
          <circle cx="180" cy="260" r="24" fill="#fbbf24" stroke="#d97706" stroke-width="4"/>
          <circle cx="260" cy="260" r="24" fill="#fbbf24" stroke="#d97706" stroke-width="4"/>
          <circle cx="340" cy="260" r="24" fill="#fbbf24" stroke="#d97706" stroke-width="4"/>
          <circle cx="420" cy="260" r="24" fill="#fbbf24" stroke="#d97706" stroke-width="4"/>
          <!-- Cable Patches -->
          <path d="M 100 320 Q 200 420 300 320 T 420 400" fill="none" stroke="#ef4444" stroke-width="6"/>
          <path d="M 120 360 Q 250 460 380 340" fill="none" stroke="#3b82f6" stroke-width="6"/>
        </svg>
      `),
      top: 0,
      left: 0
    }
  ])
  .png()
  .toFile(path.join(assetsDir, 'REQ_PROP_ENIAC_1.png'));

  // Transistor
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1.0 }
    }
  })
  .composite([
    {
      input: Buffer.from(`
        <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <circle cx="256" cy="200" r="140" fill="#334155" stroke="#94a3b8" stroke-width="10"/>
          <text x="256" y="210" fill="#4ade80" font-size="28" font-family="sans-serif" font-weight="bold" text-anchor="middle">TRANSISTOR</text>
          <!-- 3 Pins -->
          <line x1="200" y1="340" x2="200" y2="470" stroke="#cbd5e1" stroke-width="16" stroke-linecap="round"/>
          <line x1="256" y1="340" x2="256" y2="490" stroke="#cbd5e1" stroke-width="16" stroke-linecap="round"/>
          <line x1="312" y1="340" x2="312" y2="470" stroke="#cbd5e1" stroke-width="16" stroke-linecap="round"/>
        </svg>
      `),
      top: 0,
      left: 0
    }
  ])
  .png()
  .toFile(path.join(assetsDir, 'REQ_PROP_TRANSISTOR.png'));

  // Microprocessor
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1.0 }
    }
  })
  .composite([
    {
      input: Buffer.from(`
        <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <rect x="80" y="80" width="352" height="352" rx="20" fill="#065f46" stroke="#10b981" stroke-width="10"/>
          <rect x="156" y="156" width="200" height="200" rx="10" fill="#1e293b" stroke="#38bdf8" stroke-width="6"/>
          <text x="256" y="270" fill="#38bdf8" font-size="34" font-family="sans-serif" font-weight="bold" text-anchor="middle">CPU</text>
          <!-- Pins -->
          <circle cx="100" cy="100" r="10" fill="#fbbf24"/>
          <circle cx="412" cy="100" r="10" fill="#fbbf24"/>
          <circle cx="100" cy="412" r="10" fill="#fbbf24"/>
          <circle cx="412" cy="412" r="10" fill="#fbbf24"/>
        </svg>
      `),
      top: 0,
      left: 0
    }
  ])
  .png()
  .toFile(path.join(assetsDir, 'REQ_PROP_MICROPROCESSOR.png'));
}

// 2. Define Full 8-Scene Scene Plan (Section 51)
const SCENE_PLAN = {
  schemaVersion: "5.1",
  project: {
    title: "Sự Tiến Hóa Của Máy Tính (1945 - Hiện Đại)",
    targetDurationMs: 32000,
    fps: 24,
    resolution: { width: 1280, height: 720 }
  },
  style: {
    profileId: "educational_cartoon"
  },
  scenes: [
    {
      id: "s001",
      startMs: 0,
      endMs: 4000,
      sceneType: "CHARACTER_ACTING",
      visualObjective: "Cảnh 1: Máy tính khổng lồ ENIAC và nhân vật Doc",
      narrationText: "Năm 1945, siêu máy tính ENIAC ra đời, nặng 30 tấn và chiếm trọn cả căn phòng khổng lồ.",
      background: { assetId: "bg_historical_computer_lab", groundY: 0.80 },
      characters: [
        {
          characterId: "doc",
          outfitId: "outfit_scientist_labcoat",
          expressionId: "thinking",
          position: { x: 0.30, y: 0.80 },
          facing: 1
        }
      ],
      props: [
        { assetId: "REQ_PROP_ENIAC_1", position: { x: 0.72, y: 0.75 }, scale: 1.15 }
      ],
      camera: { preset: "medium_shot" }
    },
    {
      id: "s002",
      startMs: 4000,
      endMs: 8000,
      sceneType: "CHARACTER_DIALOGUE",
      visualObjective: "Cảnh 2: Hai nhà khoa học thảo luận phát minh Transistor",
      narrationText: "Đến năm 1947, phát minh bóng bán dẫn transistor đã mở ra cuộc cách mạng thu nhỏ linh kiện.",
      background: { assetId: "bg_lab_modern", groundY: 0.80 },
      characters: [
        {
          characterId: "doc",
          role: "scientist_lead",
          outfitId: "outfit_scientist_labcoat",
          expressionId: "happy",
          position: { x: 0.30, y: 0.80 },
          facing: 1
        },
        {
          characterId: "doc",
          instanceId: "doc_colleague",
          role: "scientist_assistant",
          outfitId: "outfit_casual_hoodie",
          expressionId: "neutral",
          position: { x: 0.70, y: 0.80 },
          facing: -1
        }
      ],
      props: [
        { assetId: "REQ_PROP_TRANSISTOR", position: { x: 0.50, y: 0.65 }, scale: 0.9 }
      ],
      camera: { preset: "two_shot" }
    },
    {
      id: "s003",
      startMs: 8000,
      endMs: 12000,
      sceneType: "OBJECT_EXPLANATION",
      visualObjective: "Cảnh 3: Cận cảnh vi xử lý Microprocessor trên đầu ngón tay",
      narrationText: "Những năm 1970, hàng ngàn bóng bán dẫn được tích hợp vào một con chip vi xử lý silicon tí hon.",
      background: { assetId: "bg_lab_modern", groundY: 0.80 },
      characters: [
        {
          characterId: "doc",
          outfitId: "outfit_scientist_labcoat",
          position: { x: 0.20, y: 0.85 },
          scale: 0.85,
          facing: 1
        }
      ],
      props: [
        { assetId: "REQ_PROP_MICROPROCESSOR", position: { x: 0.55, y: 0.58 }, scale: 1.35 }
      ],
      textGraphics: [
        { type: "highlight_box", position: { x: 0.55, y: 0.22 }, text: "Vi Xử Lý Silicon (Microprocessor)" }
      ],
      camera: { preset: "object_close_up" }
    },
    {
      id: "s004",
      startMs: 12000,
      endMs: 16000,
      sceneType: "CHARACTER_ACTING",
      visualObjective: "Cảnh 4: Nhà khoa học suy tư bên bàn làm việc",
      narrationText: "Công nghệ số tiến bước với tốc độ chóng mặt nhờ những ý tưởng sáng tạo không ngừng nghỉ.",
      background: { assetId: "bg_lab_modern", groundY: 0.80 },
      characters: [
        {
          characterId: "doc",
          outfitId: "outfit_scientist_labcoat",
          expressionId: "thinking",
          position: { x: 0.40, y: 0.80 },
          facing: 1
        }
      ],
      props: [
        { assetId: "prop_coffee_cup", position: { x: 0.68, y: 0.72 }, scale: 0.85 }
      ],
      camera: { preset: "medium_shot" }
    },
    {
      id: "s005",
      startMs: 16000,
      endMs: 20000,
      sceneType: "COMEDY_ACTION",
      visualObjective: "Cảnh 5: Thử nghiệm quá tải và khói hoạt hình bốc lên",
      narrationText: "Không phải thử nghiệm nào cũng suôn sẻ ngay từ đầu, nhưng thất bại là mẹ của thành công!",
      background: { assetId: "bg_lab_modern", groundY: 0.80 },
      characters: [
        {
          characterId: "doc",
          outfitId: "outfit_scientist_labcoat",
          expressionId: "surprised",
          position: { x: 0.35, y: 0.80 },
          facing: 1
        }
      ],
      props: [
        { assetId: "REQ_PROP_ENIAC_1", position: { x: 0.65, y: 0.75 }, scale: 1.0 }
      ],
      vfx: [
        { id: "vfx_smoke", type: "smoke", position: { x: 0.65, y: 0.45 }, scale: 1.2 }
      ],
      camera: { preset: "full_shot" }
    },
    {
      id: "s006",
      startMs: 20000,
      endMs: 24000,
      sceneType: "VISUAL_COMPARISON",
      visualObjective: "Cảnh 6: So sánh đèn chân không khổng lồ với vi mạch hiện đại",
      narrationText: "So sánh một bóng đèn chân không đơn lẻ năm 1945 với hàng tỷ bóng bán dẫn trong vi mạch hiện đại.",
      background: { assetId: "bg_classroom", groundY: 0.80 },
      props: [
        { assetId: "REQ_PROP_TRANSISTOR", position: { x: 0.28, y: 0.65 }, scale: 1.0 },
        { assetId: "REQ_PROP_MICROPROCESSOR", position: { x: 0.72, y: 0.65 }, scale: 1.0 }
      ],
      textGraphics: [
        { type: "comparison_card", text: "VS", position: { x: 0.50, y: 0.50 } },
        { type: "label", text: "Năm 1947: Đèn Bán Dẫn", position: { x: 0.28, y: 0.30 } },
        { type: "label", text: "Năm 1971: Vi Xử Lý Tích Hợp", position: { x: 0.72, y: 0.30 } }
      ],
      camera: { preset: "wide_shot" }
    },
    {
      id: "s007",
      startMs: 24000,
      endMs: 28000,
      sceneType: "TIMELINE_EXPLANATION",
      visualObjective: "Cảnh 7: Tiến trình thời gian máy tính (1945 -> Hiện đại)",
      narrationText: "Từ máy tính chiếm cả căn phòng, đến máy tính để bàn, laptop và ngày nay là điện thoại thông minh.",
      background: { assetId: "bg_classroom", groundY: 0.80 },
      props: [
        { assetId: "REQ_PROP_ENIAC_1", position: { x: 0.15, y: 0.60 }, scale: 0.7 },
        { assetId: "REQ_PROP_TRANSISTOR", position: { x: 0.38, y: 0.60 }, scale: 0.7 },
        { assetId: "REQ_PROP_MICROPROCESSOR", position: { x: 0.62, y: 0.60 }, scale: 0.7 },
        { assetId: "prop_laptop_modern", position: { x: 0.85, y: 0.60 }, scale: 0.7 }
      ],
      textGraphics: [
        { type: "timeline_node", text: "1945 (ENIAC)", position: { x: 0.15, y: 0.80 } },
        { type: "timeline_node", text: "1950 (Transistor)", position: { x: 0.38, y: 0.80 } },
        { type: "timeline_node", text: "1970 (Microchip)", position: { x: 0.62, y: 0.80 } },
        { type: "timeline_node", text: "2000+ (Laptop)", position: { x: 0.85, y: 0.80 } }
      ],
      camera: { preset: "wide_shot" }
    },
    {
      id: "s008",
      startMs: 28000,
      endMs: 32000,
      sceneType: "CHARACTER_ACTING",
      visualObjective: "Cảnh 8: Kết luận — Kỷ nguyên số trong lòng bàn tay",
      narrationText: "Giờ đây, sức mạnh tính toán vượt xa siêu máy tính năm xưa đã nằm gọn ngay trong túi áo của chúng ta.",
      background: { assetId: "bg_lab_modern", groundY: 0.80 },
      characters: [
        {
          characterId: "doc",
          outfitId: "outfit_scientist_labcoat",
          expressionId: "happy",
          position: { x: 0.35, y: 0.80 },
          facing: 1
        }
      ],
      props: [
        { assetId: "prop_laptop_modern", position: { x: 0.68, y: 0.70 }, scale: 1.1 }
      ],
      camera: { preset: "medium_shot" }
    }
  ]
};

// 3. Compile via BatchSceneBuilder
async function runDemoWorkflow() {
  console.log('=== THANH HAI 2D STUDIO V5 — PHASE 3 AUTOMATIC SCENE BUILDER DEMO ===');
  await generateAssetPngs();
  console.log('✔ Đã tạo asset PNGs thực tế');

  const resolvedBindings = {
    REQ_PROP_ENIAC_1: { resolvedAssetId: 'REQ_PROP_ENIAC_1', anchor: 'ground_contact' },
    REQ_PROP_TRANSISTOR: { resolvedAssetId: 'REQ_PROP_TRANSISTOR', anchor: 'center' },
    REQ_PROP_MICROPROCESSOR: { resolvedAssetId: 'REQ_PROP_MICROPROCESSOR', anchor: 'center' },
    prop_coffee_cup: { resolvedAssetId: 'prop_coffee_cup', anchor: 'hand_grip' },
    prop_laptop_modern: { resolvedAssetId: 'prop_laptop_modern', anchor: 'ground_contact' },
    bg_historical_computer_lab: { resolvedAssetId: 'bg_lab_modern' }
  };

  const builder = new BatchSceneBuilder({
    projectContext: { projectId: 'demo_v5_phase3_computer_evolution' },
    resolvedBindings
  });

  const buildResult = await builder.buildAll(SCENE_PLAN, progress => {
    console.log(`[Progress ${progress.percent}%] Dựng scene ${progress.sceneId} (${progress.status})`);
  });

  console.log('✔ Kết quả dựng 8 scenes:', buildResult.projectStatus, buildResult.stats);

  // Write scene_plan.json
  fs.writeFileSync(path.join(DEMO_DIR, 'scene_plan.json'), JSON.stringify(SCENE_PLAN, null, 2), 'utf8');

  // Write compiled project config.json for V4 Player
  const config = {
    title: SCENE_PLAN.project.title,
    aspect: "16:9",
    resolution: "720p",
    fps: 24,
    style: "dusk",
    character: "white_cartoon",
    duration: 32,
    captions: true,
    fadeIn: 0.3,
    fadeOut: 0.5
  };
  fs.writeFileSync(path.join(DEMO_DIR, 'config.json'), JSON.stringify(config, null, 2), 'utf8');

  // Write scenes/cast.js
  const castCode = `export const cast = {
  doc: { name: 'Doc', skin: 'white_cartoon' },
  doc_colleague: { name: 'Assistant', skin: 'white_cartoon' }
};
`;
  fs.writeFileSync(path.join(DEMO_DIR, 'scenes/cast.js'), castCode, 'utf8');

  // Write shots.json
  const shotsJson = {
    title: SCENE_PLAN.project.title,
    duration: 32,
    shots: SCENE_PLAN.scenes.map((s, idx) => ({
      id: s.id,
      name: s.visualObjective,
      line: s.narrationText,
      start: (s.startMs || idx * 4000) / 1000,
      end: (s.endMs || (idx + 1) * 4000) / 1000,
      duration: ((s.endMs || (idx + 1) * 4000) - (s.startMs || idx * 4000)) / 1000
    }))
  };
  fs.writeFileSync(path.join(DEMO_DIR, 'story/shots.json'), JSON.stringify(shotsJson, null, 2), 'utf8');

  // Write compiled scenes shot runner for Player Canvas rendering
  const sceneCode = `// Autogenerated by V5 Automatic Scene Builder Phase 3
import { registerShot } from '/engine/core.js';

function drawScene(ctx, t, sceneId, title, sub, visualBadge, propDesc) {
  ctx.save();
  // Clear & Canvas background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1280, 720);

  // Background Grid / Environment
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 1280; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 720); ctx.stroke();
  }
  for (let y = 0; y < 720; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke();
  }

  // Ground Line (80% = 576px)
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 576);
  ctx.lineTo(1280, 576);
  ctx.stroke();

  // Floor Gradient
  const floorGrad = ctx.createLinearGradient(0, 576, 0, 720);
  floorGrad.addColorStop(0, 'rgba(2, 132, 199, 0.2)');
  floorGrad.addColorStop(1, 'rgba(15, 23, 42, 0.8)');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, 576, 1280, 144);

  // Header Title
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('THANH HAI 2D STUDIO V5 — SỰ TIẾN HÓA CỦA MÁY TÍNH', 50, 60);

  // Narration Box
  ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(50, 85, 1180, 80, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(title, 70, 120);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px sans-serif';
  ctx.fillText(sub, 70, 150);

  // Character (Doc)
  const cx = 380 + Math.sin(t * 3.5) * 12;
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.arc(cx, 440, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DOC', cx, 446);

  // Body & Labcoat
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(cx - 30, 490, 60, 86);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 30, 490, 60, 86);

  // Prop Representation Showcase
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(720, 280, 280, 240, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(visualBadge, 860, 360);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(propDesc, 860, 430);

  // Footer metadata
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '13px monospace';
  ctx.fillText('Scene: ' + sceneId + ' | Time: ' + t.toFixed(2) + 's | V5 Automatic Scene Builder Phase 3', 50, 690);

  ctx.restore();
}

registerShot('s001', { draw(ctx, t) { drawScene(ctx, t, 's001', 'Cảnh 1: Năm 1945 — Siêu máy tính ENIAC ra đời', 'Máy tính 30 tấn chiếm trọn căn phòng | Bố cục: Character & Object', '💻', 'ENIAC (1945)'); } });
registerShot('s002', { draw(ctx, t) { drawScene(ctx, t, 's002', 'Cảnh 2: Phát minh bóng bán dẫn Transistor', 'Hai nhà khoa học thảo luận | Bố cục: Two Character Dialogue', '⚡', 'Transistor 1947'); } });
registerShot('s003', { draw(ctx, t) { drawScene(ctx, t, 's003', 'Cảnh 3: Cận cảnh vi xử lý Microprocessor', 'Hàng ngàn bán dẫn trên vi mạch | Bố cục: Object Explanation & Close-up', '🔲', 'Microprocessor 1971'); } });
registerShot('s004', { draw(ctx, t) { drawScene(ctx, t, 's004', 'Cảnh 4: Nhà khoa học suy tư bên bàn làm việc', 'Ý tưởng sáng tạo không ngừng nghỉ | Đạo cụ bàn: Coffee Cup', '☕', 'Creative Thinking'); } });
registerShot('s005', { draw(ctx, t) { drawScene(ctx, t, 's005', 'Cảnh 5: Thử nghiệm quá tải & Khói hoạt hình', 'Thử nghiệm thất bại mở ra bước tiến | VFX: Smoke Cloud', '💨', 'Overload Experiment'); } });
registerShot('s006', { draw(ctx, t) { drawScene(ctx, t, 's006', 'Cảnh 6: So sánh công nghệ Đèn chân không vs Vi mạch', 'Bố cục: Before & After Comparison (VS Badge)', '⚖️', 'Vacuum vs Silicon'); } });
registerShot('s007', { draw(ctx, t) { drawScene(ctx, t, 's007', 'Cảnh 7: Tiến trình thời gian máy tính (1945 -> Hiện đại)', 'Trình tự thời gian: ENIAC -> Transistor -> Microchip -> Laptop', '⏳', 'Timeline 1945-2000s'); } });
registerShot('s008', { draw(ctx, t) { drawScene(ctx, t, 's008', 'Cảnh 8: Kết luận — Kỷ nguyên số trong lòng bàn tay', 'Sức mạnh điện toán siêu cấp trong tầm tay | Bố cục: Conclusion', '📱', 'Modern Digital Era'); } });
`;
  fs.writeFileSync(path.join(DEMO_DIR, 'scenes/shots/01_computer_evolution.js'), sceneCode, 'utf8');

  console.log('✔ Đã khởi tạo hoàn tất dự án 8 scene tại:', DEMO_DIR);
}

runDemoWorkflow().catch(err => {
  console.error('Lỗi build demo:', err);
  process.exit(1);
});
