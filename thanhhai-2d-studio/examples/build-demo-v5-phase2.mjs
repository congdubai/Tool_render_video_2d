// thanhhai-2d-studio/examples/build-demo-v5-phase2.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { SmartAssetManager } from '../engine/v5-smart-asset-manager.js';
import { compileScenePlanToV4 } from '../engine/v5-scene-plan-interpreter.js';
import { applyScenePatch } from '../engine/v5-storyboard-importer.js';

const DEMO_DIR = path.resolve(process.cwd(), 'thanhhai-2d-studio/examples/demo-v5-phase2-smart-asset-manager');
fs.mkdirSync(DEMO_DIR, { recursive: true });
fs.mkdirSync(path.join(DEMO_DIR, 'assets'), { recursive: true });
fs.mkdirSync(path.join(DEMO_DIR, 'scenes/shots'), { recursive: true });
fs.mkdirSync(path.join(DEMO_DIR, 'story'), { recursive: true });

// 1. Write scene_plan.json
const SCENE_PLAN = {
  schemaVersion: "5.1",
  project: {
    title: "Sự Tiến Hóa Của Máy Tính (1945 - Hiện Đại)",
    targetDurationMs: 25000,
    fps: 24,
    resolution: { width: 1280, height: 720 }
  },
  style: {
    profileId: "educational_cartoon"
  },
  assetRequirements: [
    {
      id: "REQ_PROP_ENIAC_1",
      name: "Máy Tính Khổng Lồ ENIAC (1945)",
      type: "prop",
      description: "Máy tính điện tử đầu tiên với tủ đèn chân không khổng lồ",
      transparentBackground: true,
      recommendedDimensions: { width: 1024, height: 1024 }
    },
    {
      id: "REQ_PROP_TRANSISTOR",
      name: "Linh Kiện Transistor Bán Dẫn (1950s)",
      type: "prop",
      description: "Linh kiện bán dẫn 3 chân thay thế bóng đèn chân không",
      transparentBackground: true,
      recommendedDimensions: { width: 1024, height: 1024 }
    },
    {
      id: "REQ_PROP_MICROPROCESSOR",
      name: "Vi Xử Lý Silicon Microprocessor (1970s)",
      type: "prop",
      description: "Chip silicon tích hợp hàng ngàn bóng bán dẫn trên một vi mạch",
      transparentBackground: true,
      recommendedDimensions: { width: 1024, height: 1024 }
    }
  ],
  scenes: [
    {
      id: "s001",
      startMs: 0,
      endMs: 5000,
      visualObjective: "Phòng thí nghiệm năm 1945 và máy tính ENIAC",
      narrationText: "Năm 1945, siêu máy tính ENIAC ra đời mở ra kỷ nguyên số.",
      background: { assetId: "bg_historical_computer_lab" },
      characters: [
        {
          characterId: "doc",
          outfitId: "outfit_scientist_labcoat",
          expressionId: "thinking",
          position: { x: 0.35, y: 0.79 },
          prop: { assetId: "REQ_PROP_ENIAC_1", attachedTo: "right_hand" }
        }
      ],
      visualBeats: [
        { startMs: 0, endMs: 5000, actionId: "idle_talk" }
      ]
    },
    {
      id: "s002",
      startMs: 5000,
      endMs: 10000,
      visualObjective: "Phát minh bóng bán dẫn transistor",
      narrationText: "Sự xuất hiện của transistor đã thu nhỏ kích thước máy tính đi hàng ngàn lần.",
      background: { assetId: "bg_lab_modern" },
      characters: [
        {
          characterId: "doc",
          outfitId: "outfit_scientist_labcoat",
          expressionId: "happy",
          position: { x: 0.5, y: 0.79 },
          prop: { assetId: "REQ_PROP_TRANSISTOR", attachedTo: "right_hand" }
        }
      ],
      visualBeats: [
        { startMs: 5000, endMs: 10000, actionId: "celebrate", vfxId: "vfx_sparkle" }
      ]
    },
    {
      id: "s003",
      startMs: 10000,
      endMs: 15000,
      visualObjective: "So sánh ENIAC với vi xử lý hiện đại",
      narrationText: "Từng chiếm trọn cả căn phòng, nay toàn bộ sức mạnh xử lý nằm gọn trên đầu ngón tay.",
      background: { assetId: "bg_historical_computer_lab" },
      characters: [
        {
          characterId: "doc",
          outfitId: "outfit_scientist_labcoat",
          expressionId: "surprised",
          position: { x: 0.4, y: 0.79 },
          prop: { assetId: "REQ_PROP_ENIAC_1", attachedTo: "left_hand" }
        }
      ],
      visualBeats: [
        { startMs: 10000, endMs: 15000, actionId: "idle_talk" }
      ]
    },
    {
      id: "s004",
      startMs: 15000,
      endMs: 20000,
      visualObjective: "Thời đại máy tính cá nhân và laptop",
      narrationText: "Máy tính cá nhân xuất hiện trên bàn làm việc của mọi gia đình và văn phòng.",
      background: { assetId: "bg_lab_modern" },
      characters: [
        {
          characterId: "jake",
          outfitId: "outfit_casual_hoodie",
          expressionId: "neutral",
          position: { x: 0.6, y: 0.79 },
          prop: { assetId: "prop_laptop", attachedTo: "right_hand" }
        }
      ],
      visualBeats: [
        { startMs: 15000, endMs: 20000, actionId: "idle_talk" }
      ]
    },
    {
      id: "s005",
      startMs: 20000,
      endMs: 25000,
      visualObjective: "Thư giãn và uống cà phê trong phòng nghiên cứu",
      narrationText: "Công nghệ tiếp tục phát triển không ngừng hướng tới trí tuệ nhân tạo và lượng tử.",
      background: { assetId: "bg_lab_modern" },
      characters: [
        {
          characterId: "doc",
          outfitId: "outfit_scientist_labcoat",
          expressionId: "happy",
          position: { x: 0.5, y: 0.79 },
          prop: { assetId: "coffee_mug", attachedTo: "right_hand" }
        }
      ],
      visualBeats: [
        { startMs: 20000, endMs: 25000, actionId: "drink_coffee" }
      ]
    }
  ]
};

fs.writeFileSync(path.join(DEMO_DIR, 'scene_plan.json'), JSON.stringify(SCENE_PLAN, null, 2), 'utf8');

// 2. Generate 3 real clean PNG image assets with sharp
async function generateSamplePngs() {
  const assetsDir = path.join(DEMO_DIR, 'assets');

  const eniacSvg = `<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <rect x="50" y="40" width="300" height="320" rx="16" fill="#334155" stroke="#1e293b" stroke-width="8"/>
    <rect x="70" y="60" width="260" height="70" rx="8" fill="#1e293b"/>
    <circle cx="100" cy="95" r="14" fill="#ef4444"/>
    <circle cx="140" cy="95" r="14" fill="#eab308"/>
    <circle cx="180" cy="95" r="14" fill="#22c55e"/>
    <circle cx="220" cy="95" r="14" fill="#38bdf8"/>
    <rect x="70" y="150" width="260" height="120" rx="8" fill="#0f172a"/>
    <line x1="80" y1="180" x2="320" y2="180" stroke="#475569" stroke-width="4"/>
    <line x1="80" y1="210" x2="320" y2="210" stroke="#475569" stroke-width="4"/>
    <line x1="80" y1="240" x2="320" y2="240" stroke="#475569" stroke-width="4"/>
    <rect x="70" y="290" width="260" height="50" rx="6" fill="#1e293b"/>
    <circle cx="110" cy="315" r="8" fill="#38bdf8"/>
    <circle cx="150" cy="315" r="8" fill="#38bdf8"/>
    <circle cx="190" cy="315" r="8" fill="#38bdf8"/>
  </svg>`;
  await sharp(Buffer.from(eniacSvg)).png().toFile(path.join(assetsDir, 'REQ_PROP_ENIAC_1.png'));

  const transistorSvg = `<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="200" cy="140" rx="80" ry="70" fill="#0f172a" stroke="#475569" stroke-width="6"/>
    <rect x="120" y="140" width="160" height="70" fill="#0f172a" stroke="#475569" stroke-width="6"/>
    <line x1="160" y1="210" x2="160" y2="350" stroke="#94a3b8" stroke-width="12" stroke-linecap="round"/>
    <line x1="200" y1="210" x2="200" y2="360" stroke="#94a3b8" stroke-width="12" stroke-linecap="round"/>
    <line x1="240" y1="210" x2="240" y2="350" stroke="#94a3b8" stroke-width="12" stroke-linecap="round"/>
    <text x="200" y="180" font-family="Arial" font-size="28" font-weight="bold" fill="#38bdf8" text-anchor="middle">2N2222</text>
  </svg>`;
  await sharp(Buffer.from(transistorSvg)).png().toFile(path.join(assetsDir, 'REQ_PROP_TRANSISTOR.png'));

  const cpuSvg = `<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <rect x="80" y="80" width="240" height="240" rx="20" fill="#0284c7" stroke="#0369a1" stroke-width="8"/>
    <rect x="120" y="120" width="160" height="160" rx="10" fill="#0f172a"/>
    <text x="200" y="195" font-family="Arial" font-size="34" font-weight="bold" fill="#e2e8f0" text-anchor="middle">CPU</text>
    <text x="200" y="235" font-family="Arial" font-size="18" fill="#38bdf8" text-anchor="middle">4004 MICRO</text>
    <line x1="120" y1="60" x2="120" y2="80" stroke="#eab308" stroke-width="10" stroke-linecap="round"/>
    <line x1="160" y1="60" x2="160" y2="80" stroke="#eab308" stroke-width="10" stroke-linecap="round"/>
    <line x1="200" y1="60" x2="200" y2="80" stroke="#eab308" stroke-width="10" stroke-linecap="round"/>
    <line x1="240" y1="60" x2="240" y2="80" stroke="#eab308" stroke-width="10" stroke-linecap="round"/>
    <line x1="280" y1="60" x2="280" y2="80" stroke="#eab308" stroke-width="10" stroke-linecap="round"/>
  </svg>`;
  await sharp(Buffer.from(cpuSvg)).png().toFile(path.join(assetsDir, 'REQ_PROP_MICROPROCESSOR.png'));
}

async function runDemoWorkflow() {
  await generateSamplePngs();
  console.log('✔ Đã sinh 3 file PNG tài nguyên thực tế với Sharp');

  const manager = new SmartAssetManager(DEMO_DIR, SCENE_PLAN);
  const scanResult = manager.scanAndResolve();
  console.log(`✔ Quét Scene Plan: tìm thấy ${scanResult.scan.requirements.length} yêu cầu thô.`);

  manager.bindingRegistry.bind('REQ_PROP_ENIAC_1', 'REQ_PROP_ENIAC_1.png', {
    imagePath: '/assets/REQ_PROP_ENIAC_1.png',
    anchor: { x: 0.5, y: 0.98 },
    status: 'READY'
  });
  manager.bindingRegistry.bind('REQ_PROP_TRANSISTOR', 'REQ_PROP_TRANSISTOR.png', {
    imagePath: '/assets/REQ_PROP_TRANSISTOR.png',
    anchor: { x: 0.5, y: 0.85 },
    status: 'READY'
  });
  manager.bindingRegistry.bind('REQ_PROP_MICROPROCESSOR', 'REQ_PROP_MICROPROCESSOR.png', {
    imagePath: '/assets/REQ_PROP_MICROPROCESSOR.png',
    anchor: { x: 0.5, y: 0.85 },
    status: 'READY'
  });
  manager.bindingRegistry.bind('coffee_mug', 'prop_coffee_cup', {
    status: 'READY'
  });

  // Patch Scene 5
  const patchedPlan = applyScenePatch(SCENE_PLAN, {
    targetSceneId: 's005',
    scene: {
      id: 's005',
      visualBeats: [
        { startMs: 20000, endMs: 25000, actionId: 'idle_talk' }
      ]
    }
  });

  manager.scenePlan = patchedPlan;
  const postPatchScan = manager.scanAndResolve();
  console.log(`✔ Sau Scene Patch cho s005: Project Status = ${postPatchScan.readiness.projectStatus}`);

  // Write config.json
  const cfg = {
    title: "Sự Tiến Hóa Của Máy Tính — Smart Asset Manager V5",
    aspect: "16:9",
    resolution: "720p",
    fps: 24,
    style: "dusk",
    character: "white_cartoon",
    duration: 25.0,
    captions: true,
    fadeIn: 0.3,
    fadeOut: 0.5
  };
  fs.writeFileSync(path.join(DEMO_DIR, 'config.json'), JSON.stringify(cfg, null, 2), 'utf8');

  // Write cast.js
  const castCode = `export const cast = {
  doc: { name: 'Doc', skin: 'white_cartoon' },
  jake: { name: 'Jake', skin: 'white_cartoon' }
};
`;
  fs.writeFileSync(path.join(DEMO_DIR, 'scenes/cast.js'), castCode, 'utf8');

  // Write story/shots.json
  const shotsJson = {
    title: "Sự Tiến Hóa Của Máy Tính (1945 - Hiện Đại)",
    duration: 25.0,
    shots: [
      { id: "s001", start: 0.0, end: 5.0, line: "Năm 1945, siêu máy tính ENIAC ra đời mở ra kỷ nguyên số." },
      { id: "s002", start: 5.0, end: 10.0, line: "Sự xuất hiện của transistor đã thu nhỏ kích thước máy tính đi hàng ngàn lần." },
      { id: "s003", start: 10.0, end: 15.0, line: "Từng chiếm trọn cả căn phòng, nay toàn bộ sức mạnh xử lý nằm gọn trên đầu ngón tay." },
      { id: "s004", start: 15.0, end: 20.0, line: "Máy tính cá nhân xuất hiện trên bàn làm việc của mọi gia đình và văn phòng." },
      { id: "s005", start: 20.0, end: 25.0, line: "Công nghệ tiếp tục phát triển không ngừng hướng tới trí tuệ nhân tạo và lượng tử." }
    ]
  };
  fs.writeFileSync(path.join(DEMO_DIR, 'story/shots.json'), JSON.stringify(shotsJson, null, 2), 'utf8');

  // Write 01_computer_evolution.js registering all 5 shots
  const sceneCode = `import { registerShot } from '/engine/core.js';

function drawEvolutionScene(ctx, t, shotId, title, sub, propName) {
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1280, 720);

  // Ground line
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 560, 1280, 160);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 560);
  ctx.lineTo(1280, 560);
  ctx.stroke();

  // Header Title
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('THANH HAI 2D STUDIO V5 — SỰ TIẾN HÓA CỦA MÁY TÍNH', 60, 80);

  // Subtitle banner
  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(60, 110, 1160, 90, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(title, 80, 150);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px sans-serif';
  ctx.fillText(sub, 80, 180);

  // Character
  const cx = 360 + Math.sin(t * 3) * 15;
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(cx, 440, 55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DOC', cx, 448);

  // Prop representation
  ctx.fillStyle = '#10b981';
  ctx.fillRect(720, 360, 180, 180);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BOUND ASSET:', 810, 430);
  ctx.fillStyle = '#fef08a';
  ctx.fillText(propName, 810, 470);

  // Footer metadata
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '14px monospace';
  ctx.fillText('Cảnh: ' + shotId + ' | Time: ' + t.toFixed(2) + 's | Smart Asset Manager V5', 60, 690);

  ctx.restore();
}

registerShot('s001', { draw(ctx, t) { drawEvolutionScene(ctx, t, 's001', 'Cảnh 1: Năm 1945 — Siêu máy tính ENIAC ra đời', 'Nhân vật: Doc (Labcoat) | Đạo cụ đã bind: REQ_PROP_ENIAC_1.png', 'ENIAC Mainframe'); } });
registerShot('s002', { draw(ctx, t) { drawEvolutionScene(ctx, t, 's002', 'Cảnh 2: 1950s — Phát minh transistor bán dẫn', 'Thu nhỏ kích thước máy tính hàng ngàn lần | Đạo cụ đã bind: REQ_PROP_TRANSISTOR.png', 'Transistor 2N2222'); } });
registerShot('s003', { draw(ctx, t) { drawEvolutionScene(ctx, t, 's003', 'Cảnh 3: So sánh kích thước ENIAC và vi xử lý', 'Cùng một đạo cụ ENIAC dùng lại trong 2 cảnh khác nhau', 'ENIAC (Reused)'); } });
registerShot('s004', { draw(ctx, t) { drawEvolutionScene(ctx, t, 's004', 'Cảnh 4: Kỷ nguyên PC và Laptop cá nhân', 'Nhân vật: Jake (Hoodie) | Đạo cụ thư viện: prop_laptop', 'Laptop Modern'); } });
registerShot('s005', { draw(ctx, t) { drawEvolutionScene(ctx, t, 's005', 'Cảnh 5: Phòng lab hiện đại & Cà phê sáng tạo', 'Hành động drink_coffee được patch thành idle_talk | Đạo cụ semantic: coffee_mug', 'Coffee Cup (Semantic)'); } });
`;
  fs.writeFileSync(path.join(DEMO_DIR, 'scenes/shots/01_computer_evolution.js'), sceneCode, 'utf8');

  console.log('✔ Đã khởi tạo hoàn chỉnh dự án demo tại:', DEMO_DIR);
}

runDemoWorkflow().catch(err => {
  console.error('Lỗi build demo:', err);
  process.exit(1);
});
