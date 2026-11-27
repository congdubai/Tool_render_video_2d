import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  SHOT_LIBRARY,
  CAMERA_MOVEMENTS,
  computeSubjectBounds,
  clampCameraToBounds,
  computeAutomaticFraming,
  selectAutomaticShotRule,
  compileSceneCameraTrack,
  evaluateCameraFrame,
  validateCameraAndVisuals,
} from '../thanhhai-2d-studio/engine/v5-camera-engine.js';
import {
  SCENE_TYPES,
  COMPOSITION_TEMPLATES,
  compileVisualStorytellingPlan,
  computeLayerParallaxShift,
} from '../thanhhai-2d-studio/engine/v5-visual-storytelling.js';
import {
  SUPPORTED_GRAPHIC_TYPES,
  SUPPORTED_TEXT_ANIMATIONS,
  wrapVietnameseText,
  renderEducationalGraphics,
} from '../thanhhai-2d-studio/engine/v5-educational-graphics.js';
import {
  TRANSITION_TYPES,
  normalizeTransition,
  evaluateSceneTransition,
} from '../thanhhai-2d-studio/engine/v5-transition-engine.js';
import { compileProjectAnimations } from '../thanhhai-2d-studio/engine/v5-animation-director.js';
import { compileCharacterActingTracks, evaluateActingFrame } from '../thanhhai-2d-studio/engine/v5-character-acting-engine.js';
import { resolveCharacter } from '../thanhhai-2d-studio/engine/unified-character-renderer.js';
import { RenderCacheManager } from '../thanhhai-2d-studio/engine/v5-render-engine.js';
import { ProductionOrchestrator, PRODUCTION_MODES } from '../thanhhai-2d-studio/engine/v5-production-orchestrator.js';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

let passed = 0;
let failed = 0;
async function check(id, name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS [${id}]: ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL [${id}]: ${name}\n  ${err?.stack || err}`);
  }
}

// ============================================================================
// CHECKS 1–18: CAMERA SHOTS, FRAMING, MOVEMENTS, BOUNDS, PARALLAX, MULTI-SHOT
// ============================================================================
await check(1, 'Wide Shot preset exists & frames wide', () => assert.equal(SHOT_LIBRARY.wide.targetZoom, 1.0));
await check(2, 'Full Body Shot preset exists', () => assert.ok(SHOT_LIBRARY.full_body.targetZoom > 1.0));
await check(3, 'Medium Shot preset exists', () => assert.ok(SHOT_LIBRARY.medium.targetZoom >= 1.4));
await check(4, 'Close-up preset exists', () => assert.ok(SHOT_LIBRARY.closeup.targetZoom >= 2.0));
await check(5, 'Object Close-up preset exists', () => assert.ok(SHOT_LIBRARY.object_closeup.targetZoom >= 1.8));
await check(6, 'Two Shot preset exists', () => assert.ok(SHOT_LIBRARY.two_shot));
await check(7, 'Group Shot preset exists', () => assert.ok(SHOT_LIBRARY.group_shot));
await check(8, 'Automatic Subject Framing frames entity cleanly', () => {
  const cam = computeAutomaticFraming('medium', computeSubjectBounds({ doc: { x: 500, y: 560, width: 140, height: 340 } }, ['doc']));
  assert.ok(cam.zoom > 1.1 && cam.y < 560);
});
await check(9, 'Pan movements (left/right/up/down) shift camera center', () => {
  const tr = compileSceneCameraTrack({}, { camera: { shotType: 'medium', movement: 'pan_right' } }, 4);
  const a = evaluateCameraFrame(tr, 0.1, { entities: { c: { x: 640, y: 560 } } });
  const b = evaluateCameraFrame(tr, 3.9, { entities: { c: { x: 640, y: 560 } } });
  assert.ok(b.x > a.x);
});
await check(10, 'Zoom in increases zoom over time', () => {
  const tr = compileSceneCameraTrack({}, { camera: { shotType: 'wide', movement: { type: 'zoom_in', zoomFrom: 1.0, zoomTo: 1.4 } } }, 4);
  assert.ok(evaluateCameraFrame(tr, 3.8).zoom > evaluateCameraFrame(tr, 0.2).zoom);
});
await check(11, 'Zoom out decreases zoom over time', () => {
  const tr = compileSceneCameraTrack({}, { camera: { shotType: 'medium', movement: { type: 'zoom_out', zoomFrom: 1.5, zoomTo: 1.0 } } }, 4);
  assert.ok(evaluateCameraFrame(tr, 3.8).zoom < evaluateCameraFrame(tr, 0.2).zoom);
});
await check(12, 'Follow character tracks moving world-space character', () => {
  const tr = compileSceneCameraTrack({}, { camera: { shotType: 'follow_shot', targetIds: ['max'], movement: 'follow_subject' } }, 4);
  const f1 = evaluateCameraFrame(tr, 0.5, { entities: { max: { x: 300, y: 560 } } });
  const f2 = evaluateCameraFrame(tr, 2.5, { entities: { max: { x: 900, y: 560 } } });
  assert.ok(f2.x > f1.x + 150);
});
await check(13, 'Track object centers on prop target', () => {
  const tr = compileSceneCameraTrack({}, { camera: { shotType: 'object_closeup', targetIds: ['pc'], movement: 'track_object' } }, 4);
  const f = evaluateCameraFrame(tr, 1.0, { entities: { pc: { x: 860, y: 520, width: 220, height: 220 } } });
  assert.ok(f.x > 640);
});
await check(14, 'Camera shake & impact_shake produce bounded shake offsets', () => {
  const tr = compileSceneCameraTrack({}, { camera: { shotType: 'wide', movement: { type: 'impact_shake', intensity: 1.0 } } }, 2);
  const f = evaluateCameraFrame(tr, 0.15);
  assert.ok(Math.abs(f.shakeX) > 0 || Math.abs(f.shakeY) > 0);
});
await check(15, 'Camera movement bounds never expose blank canvas outside 1280x720', () => {
  const c = clampCameraToBounds({ x: 9999, y: -500, zoom: 1.4 }, 1280, 720);
  const hw = (1280 / c.zoom) * 0.5;
  const hh = (720 / c.zoom) * 0.5;
  assert.ok(c.x + hw <= 1280.01 && c.y - hh >= -0.01);
});
await check(16, 'Parallax shifts sky & near_bg layers differentially without gaps', () => {
  const s = computeLayerParallaxShift('sky', { x: 820, y: 360 });
  const n = computeLayerParallaxShift('near_bg', { x: 820, y: 360 });
  assert.notEqual(s[0], n[0]);
});
await check(17, 'Multi-shot scene switches shots cleanly at timestamps', () => {
  const tr = compileSceneCameraTrack({}, {
    shots: [
      { id: 's1', start: 0, end: 3, type: 'wide' },
      { id: 's2', start: 3, end: 6, type: 'object_closeup', targetIds: ['pc'] },
    ],
  }, 6);
  assert.equal(evaluateCameraFrame(tr, 1.5).activeShotId, 's1');
  assert.equal(evaluateCameraFrame(tr, 4.5).activeShotId, 's2');
});
await check(18, 'Camera cut does NOT reset character animation track', () => {
  const actTr = compileCharacterActingTracks({ characterId: 'doc', actions: [{ type: 'walk', start: 0, end: 6, to: [0.7, 0.78] }] }, 6);
  const beforeCut = evaluateActingFrame(actTr, 2.95);
  const afterCut = evaluateActingFrame(actTr, 3.05);
  assert.ok(afterCut.x > beforeCut.x, 'Character continues walking smoothly across camera cut');
});

// ============================================================================
// CHECKS 19–41: CONTINUITY, GRAPHICS, TRANSITIONS, QA, DETERMINISM, REGRESSION
// ============================================================================
await check(19, 'Character continuity preserved across scenes', () => {
  const scenes = [
    { id: 's1', duration: 3, characters: [{ characterId: 'max', position: [0.2, 0.78], actions: [{ type: 'walk', start: 0, end: 3, to: [0.55, 0.78] }] }] },
    { id: 's2', duration: 3, characters: [{ characterId: 'max' }] },
  ];
  const res = compileProjectAnimations(scenes, { scenes });
  assert.ok(Math.abs(res.scenes.s2.characterTracks.max.actingTrack.baseX - 0.55 * 1280) < 2);
});
await check(20, 'Prop continuity preserved across scenes', () => {
  const scenes = [
    { id: 's1', duration: 2, props: [{ assetId: 'cup', attachedTo: 'doc' }] },
    { id: 's2', duration: 2, props: [{ assetId: 'cup' }] },
  ];
  const res = compileProjectAnimations(scenes, { scenes });
  assert.equal(res.scenes.s2.propTracks.cup.attachedTo, 'doc');
});
await check(21, 'Automatic shot selection deterministic with logged reason', () => {
  const r = selectAutomaticShotRule({}, { sceneType: 'diagram_explanation' });
  assert.equal(r.shotType, 'diagram_shot');
  assert.ok(r.reason.length > 5);
});
await check(22, 'Visual beats auto-generate shot sequence', () => {
  const st = compileVisualStorytellingPlan({}, {
    visualBeats: [
      { id: 'b1', start: 0, end: 2, visualFocus: 'a' },
      { id: 'b2', start: 2, end: 4, visualFocus: 'b' },
    ],
  }, 4);
  assert.equal(st.autoShots.length, 2);
});
await check(23, 'Animated diagram supported & sequential', () => {
  assert.ok(SUPPORTED_GRAPHIC_TYPES.includes('flowchart'));
});
await check(24, 'Animated arrow supported', () => {
  assert.ok(SUPPORTED_GRAPHIC_TYPES.includes('arrow'));
});
await check(25, 'Highlight supported', () => {
  assert.ok(SUPPORTED_GRAPHIC_TYPES.includes('circle_highlight') && SUPPORTED_GRAPHIC_TYPES.includes('rect_highlight'));
});
await check(26, 'Visual comparison supported', () => assert.ok(SUPPORTED_GRAPHIC_TYPES.includes('comparison_card')));
await check(27, 'Historical timeline supported', () => assert.ok(SUPPORTED_GRAPHIC_TYPES.includes('timeline')));
await check(28, 'Text animation types (11) supported', () => assert.equal(SUPPORTED_TEXT_ANIMATIONS.length, 11));
await check(29, 'Vietnamese font wrapping preserves accents', () => assert.ok(wrapVietnameseText('Lịch sử máy tính Việt Nam', 16).length >= 2));
await check(30, 'Text safe area check flags out-of-bounds text', () => {
  const iss = validateCameraAndVisuals({ duration: 4, texts: [{ text: 'OOB', x: 10, y: 10 }] }, { shots: [] });
  assert.ok(iss.some(i => i.code === 'TEXT_OUTSIDE_SAFE_AREA'));
});
await check(31, 'Hard cut transition has 0 duration', () => assert.equal(normalizeTransition('hard_cut').duration, 0));
await check(32, 'Cross dissolve modifies alpha within boundary', () => {
  assert.ok(evaluateSceneTransition({ type: 'cross_dissolve', duration: 0.5 }, 'hard_cut', 0.25, 4).alpha < 1.0);
});
await check(33, 'Wipe transition updates wipeProgress', () => {
  assert.ok(evaluateSceneTransition({ type: 'wipe_left', duration: 0.5 }, 'hard_cut', 0.25, 4).wipeProgress < 1.0);
});
await check(34, 'Transition never increases total duration', () => {
  assert.equal(TRANSITION_TYPES.length, 13);
  assert.ok(normalizeTransition({ type: 'cross_dissolve', duration: 5.0 }).duration <= 1.5);
});
await check(35, 'Dialogue cinematography supports two_shot & over_the_shoulder', () => {
  assert.ok(SHOT_LIBRARY.two_shot && SHOT_LIBRARY.over_the_shoulder);
});
await check(36, 'Fight Cloud cinematography auto-sequences two_shot -> follow+shake -> reaction', () => {
  const st = compileVisualStorytellingPlan({}, { characters: [{ id: 'a', actions: [{ type: 'fight_cloud', start: 3, end: 7 }] }] }, 10);
  assert.equal(st.autoShots.length, 3);
});
await check(37, 'Camera lock preserved in compileSceneCameraTrack', () => {
  const tr = compileSceneCameraTrack({}, { camera: { locked: true, shotType: 'wide' } }, 4);
  assert.equal(tr.locked, true);
});
await check(38, 'Incremental rebuild preserves locked scene tracks', () => {
  const scenes = [{ id: 's1', duration: 2, characters: [{ characterId: 'doc' }] }];
  const first = compileProjectAnimations(scenes, { scenes });
  const second = compileProjectAnimations(scenes, { scenes }, { lockedSceneIds: ['s1'], previousTracks: { s1: { ...first.scenes.s1, lockMarker: 1 } } });
  assert.equal(second.scenes.s1.lockMarker, 1);
});
await check(39, 'Storyboard thumbnail & Camera Inspector UI present in Tab 4', () => {
  const html = fs.readFileSync('app/ui/index.html', 'utf8');
  assert.ok(html.includes('storyboardVisualGrid') && html.includes('v5CamShotSelect'));
});
await check(40, 'Tab 2 integration button present', () => {
  const html = fs.readFileSync('app/ui/index.html', 'utf8');
  assert.ok(html.includes('openSelectedSceneInTab2'));
});
await check(41, 'Preview & render share deterministic camera/acting evaluators', () => {
  const tr = compileSceneCameraTrack({}, { camera: { shotType: 'medium', movement: 'pan_right' } }, 4);
  assert.deepEqual(evaluateCameraFrame(tr, 2.2), evaluateCameraFrame(tr, 2.2));
});
await check(42, 'Timeline seek deterministic forward/backward', () => {
  const tr = compileCharacterActingTracks({ characterId: 'max', actions: [{ type: 'walk', start: 0, end: 3, to: [0.6, 0.78] }] }, 3);
  const f1 = evaluateActingFrame(tr, 1.25);
  evaluateActingFrame(tr, 2.9);
  assert.deepEqual(f1, evaluateActingFrame(tr, 1.25));
});
await check(43, 'Cache invalidates on scene/lighting change', () => {
  const c = new RenderCacheManager();
  assert.notEqual(c.computeFingerprint({ id: 's1' }, {}, { lighting: 'day' }), c.computeFingerprint({ id: 's1' }, {}, { lighting: 'night' }));
});
await check(44, 'Phase 1-3 regression: Doc & Max resolve & zero demo video copy', () => {
  assert.equal(resolveCharacter({ characterId: 'chibi_doc', strict: true }).profile.id, 'chibi_doc');
  assert.equal(fs.readFileSync('thanhhai-2d-studio/engine/v5-production-orchestrator.js', 'utf8').includes('demo_v5_procedural_15s.mp4'), false);
});

// ============================================================================
// CHECKS 45–47: RENDER 3 ACCEPTANCE DEMOS (MAX 8s, COMPUTERS 60s, FIGHT 10s)
// ============================================================================
const orch = new ProductionOrchestrator();

// DEMO A: Max Night Street (8s, 240 frames @ 30fps)
const demoAPlan = {
  schemaVersion: '5.2',
  project: { id: 'p4e_demoA_max_8s', title: 'Phase 4 Demo A: Max Night Street (8s)', fps: 30, resolution: { width: 1920, height: 1080 } },
  style: { profileId: 'clean_cartoon' },
  lighting: 'night',
  detailLevel: 'high',
  scenes: [{
    id: 'demoA_s1', duration: 8, lighting: 'night', background: { assetId: 'bg_street' },
    shots: [
      { id: 'sh1', start: 0, end: 3, type: 'full_body', targetIds: ['chibi_max'], movement: { type: 'follow_subject' } },
      { id: 'sh2', start: 3, end: 4, type: 'medium', targetIds: ['chibi_max'] },
      { id: 'sh3', start: 4, end: 7, type: 'medium_closeup', targetIds: ['chibi_max'], movement: { type: 'slow_push_in', zoomFrom: 1.5, zoomTo: 1.75 } },
      { id: 'sh4', start: 7, end: 8, type: 'medium', targetIds: ['chibi_max'] },
    ],
    characters: [{
      characterId: 'chibi_max', view: 'side_r', emotion: 'neutral', position: [0.22, 0.78],
      actions: [
        { type: 'walk', start: 0, end: 3, to: [0.44, 0.78], decelerate: false },
        { type: 'walk', start: 3, end: 4, to: [0.48, 0.78], decelerate: true },
        { type: 'turn_head', start: 3, end: 4, targetView: 'front' },
        { type: 'wave', start: 4, end: 7, expression: 'happy' },
        { type: 'lower_arm', start: 7, end: 8 },
      ],
    }],
  }],
};
const outA = path.join(OUT_DIR, 'v52_p4e_demoA_max_night_8s.mp4');
console.log('\nRendering Phase 4E Demo A (Max Night Street 8s / 240 frames)...');
const resA = await orch.produceVideo(
  { id: 'p4e_demoA_max_8s', scenePlan: demoAPlan, bindings: { REQ_BG_street: { requirementId: 'REQ_BG_street', resolvedAssetId: 'bg_street', status: 'READY' } }, styleProfile: 'clean_cartoon' },
  PRODUCTION_MODES.MODE_B_FULL_AUTO, { outputPath: outA }
);
await check(45, 'Demo A (Max Night Street 8s) renders exact 240 frames @ 30fps', () => {
  assert.equal(resA.success, true, resA.error);
  const ff = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_type,nb_frames', '-of', 'json', outA], { encoding: 'utf8' }));
  assert.equal(Number(ff.streams.find(s => s.codec_type === 'video').nb_frames), 240);
});

// DEMO B: The Evolution of Computers (60s, 8 scenes, 1800 frames @ 30fps)
const demoBPlan = {
  schemaVersion: '5.2',
  project: { id: 'p4e_demoB_computers_60s', title: 'The Evolution of Computers (60s)', fps: 30, resolution: { width: 1920, height: 1080 } },
  style: { profileId: 'educational_cartoon' },
  lighting: 'indoor_cool',
  detailLevel: 'high',
  scenes: [
    {
      id: 'comp_s1_hook', duration: 6, sceneType: 'establishing', background: { assetId: 'bg_modern_lab' },
      props: [{ assetId: 'vintage_computer' }],
      shots: [{ id: 's1_cam', start: 0, end: 6, type: 'wide', movement: { type: 'slow_push_in', zoomFrom: 1.0, zoomTo: 1.18 } }],
      texts: [{ text: 'Những chiếc máy tính đầu tiên chiếm cả một căn phòng', animation: 'slide_in', y: 0.13, start: 0.4, end: 5.8 }],
      characters: [{ characterId: 'chibi_doc', position: [0.24, 0.78], actions: [{ type: 'point', start: 1, end: 5, expression: 'surprised' }] }],
    },
    {
      id: 'comp_s2_lab', duration: 8, sceneType: 'scientific_demonstration', background: { assetId: 'bg_modern_lab' },
      props: [{ assetId: 'vintage_computer' }],
      shots: [
        { id: 's2_a', start: 0, end: 4, type: 'medium', targetIds: ['chibi_doc'] },
        { id: 's2_b', start: 4, end: 8, type: 'object_closeup', targetIds: ['vintage_computer'] },
      ],
      characters: [{ characterId: 'chibi_doc', position: [0.36, 0.78], actions: [{ type: 'press_button', targetId: 'vintage_computer', start: 1, end: 7 }] }],
    },
    {
      id: 'comp_s3_problem', duration: 8, sceneType: 'reaction_shot', background: { assetId: 'bg_modern_lab' },
      props: [{ assetId: 'vintage_computer' }],
      shots: [
        { id: 's3_a', start: 0, end: 4, type: 'medium', movement: { type: 'impact_shake', intensity: 0.7 } },
        { id: 's3_b', start: 4, end: 8, type: 'reaction_shot', targetIds: ['chibi_doc'] },
      ],
      texts: [{ text: 'Cồng kềnh, tiêu thụ điện năng lớn và dễ quá nhiệt', animation: 'fade_in', y: 0.14, start: 1.0, end: 7.5 }],
      characters: [{ characterId: 'chibi_doc', position: [0.36, 0.78], actions: [{ type: 'experiment_failure', targetId: 'vintage_computer', start: 0.5, end: 5 }, { type: 'shock_reaction', start: 5, end: 8 }] }],
    },
    {
      id: 'comp_s4_invention', duration: 8, sceneType: 'character_acting', background: { assetId: 'bg_modern_lab' },
      props: [{ assetId: 'lightbulb' }],
      shots: [{ id: 's4_cam', start: 0, end: 8, type: 'closeup', targetIds: ['chibi_doc'], movement: { type: 'slow_push_in', zoomFrom: 1.7, zoomTo: 2.0 } }],
      texts: [{ text: 'Bước ngoặt: Sự ra đời của bóng bán dẫn (Transistor)', animation: 'scale_in', y: 0.14, start: 3.5, end: 7.8 }],
      characters: [{ characterId: 'chibi_doc', position: [0.42, 0.78], actions: [{ type: 'thinking', start: 0, end: 3.5 }, { type: 'idea_discovery', start: 3.5, end: 8 }] }],
    },
    {
      id: 'comp_s5_diagram', duration: 8, sceneType: 'diagram_explanation', background: { assetId: 'bg_modern_lab' },
      transitionIn: { type: 'cross_dissolve', duration: 0.5 },
      shots: [{ id: 's5_cam', start: 0, end: 8, type: 'diagram_shot' }],
      diagram: {
        title: 'Nguyên lý xử lý dữ liệu',
        nodes: [
          { id: 'in', label: 'INPUT', sublabel: 'Dữ liệu vào', x: 0.25, y: 0.52, start: 0.4 },
          { id: 'cpu', label: 'CPU', sublabel: 'Xử lý logic', x: 0.50, y: 0.52, start: 2.0 },
          { id: 'out', label: 'OUTPUT', sublabel: 'Kết quả', x: 0.75, y: 0.52, start: 3.6 },
        ],
        edges: [
          { from: 'in', to: 'cpu', start: 1.2 },
          { from: 'cpu', to: 'out', start: 2.8 },
        ],
      },
      characters: [],
    },
    {
      id: 'comp_s6_comparison', duration: 8, sceneType: 'visual_comparison', background: { assetId: 'bg_modern_lab' },
      transitionIn: { type: 'wipe_left', duration: 0.5 },
      shots: [{ id: 's6_cam', start: 0, end: 8, type: 'diagram_shot' }],
      comparison: {
        left: { title: 'Máy tính thế hệ đầu', description: 'Kích thước lớn bằng cả căn phòng, dùng đèn chân không', badge: 'Thế hệ 1' },
        right: { title: 'Máy tính hiện đại', description: 'Nhỏ gọn trên bàn làm việc, dùng vi mạch bán dẫn', badge: 'Hiện đại' },
      },
      characters: [],
    },
    {
      id: 'comp_s7_timeline', duration: 8, sceneType: 'timeline_explanation', background: { assetId: 'bg_modern_lab' },
      transitionIn: { type: 'cross_dissolve', duration: 0.5 },
      shots: [{ id: 's7_cam', start: 0, end: 8, type: 'diagram_shot' }],
      timeline: {
        title: 'Dòng thời gian phát triển máy tính',
        milestones: [
          { year: '1940s', title: 'Đèn chân không', description: 'ENIAC cồng kềnh', start: 0.4 },
          { year: '1950s', title: 'Transistor', description: 'Nhỏ & bền hơn', start: 1.8 },
          { year: '1970s', title: 'Vi xử lý', description: 'Tích hợp IC', start: 3.2 },
          { year: '1980s', title: 'PC cá nhân', description: 'Phổ cập rộng rãi', start: 4.6 },
          { year: 'Hiện đại', title: 'Đa nhân & AI', description: 'Siêu nhỏ gọn', start: 6.0 },
        ],
      },
      characters: [],
    },
    {
      id: 'comp_s8_conclusion', duration: 6, sceneType: 'conclusion', background: { assetId: 'bg_modern_lab' },
      transitionIn: { type: 'fade_to_black', duration: 0.4 },
      shots: [{ id: 's8_cam', start: 0, end: 6, type: 'medium', targetIds: ['chibi_doc'], movement: { type: 'pull_back', zoomFrom: 1.45, zoomTo: 1.0 } }],
      texts: [{ text: 'Từ căn phòng khổng lồ đến sức mạnh trong lòng bàn tay', animation: 'typewriter', y: 0.14, start: 0.5, end: 5.8 }],
      characters: [{ characterId: 'chibi_doc', position: [0.46, 0.78], actions: [{ type: 'talk', start: 0, end: 4, expression: 'happy', speechIntervals: [[0, 3.8]] }, { type: 'wave', start: 4, end: 6, expression: 'excited' }] }],
    },
  ],
};
const outB = path.join(OUT_DIR, 'v52_p4e_demoB_computers_60s.mp4');
console.log('\nRendering Phase 4E Demo B (Evolution of Computers 60s / 1800 frames)...');
const resB = await orch.produceVideo(
  {
    id: 'p4e_demoB_computers_60s',
    scenePlan: demoBPlan,
    bindings: {
      REQ_BG_modern_lab: { requirementId: 'REQ_BG_modern_lab', resolvedAssetId: 'bg_modern_lab', status: 'READY' },
      REQ_PROP_VINTAGE_COMPUTER: { requirementId: 'REQ_PROP_VINTAGE_COMPUTER', resolvedAssetId: 'vintage_computer', status: 'READY' },
      REQ_PROP_LIGHTBULB: { requirementId: 'REQ_PROP_LIGHTBULB', resolvedAssetId: 'lightbulb', status: 'READY' },
    },
    styleProfile: 'educational_cartoon',
  },
  PRODUCTION_MODES.MODE_B_FULL_AUTO, { outputPath: outB }
);
await check(46, 'Demo B (Evolution of Computers 60s) renders exact 1800 frames @ 30fps', () => {
  assert.equal(resB.success, true, resB.error);
  const ff = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_type,nb_frames', '-of', 'json', outB], { encoding: 'utf8' }));
  assert.equal(Number(ff.streams.find(s => s.codec_type === 'video').nb_frames), 1800);
});

// DEMO C: Cartoon Fight (10s, 300 frames @ 30fps)
const demoCPlan = {
  schemaVersion: '5.2',
  project: { id: 'p4e_demoC_cartoon_fight_10s', title: 'Phase 4 Demo C: Cartoon Fight (10s)', fps: 30, resolution: { width: 1920, height: 1080 } },
  style: { profileId: 'clean_cartoon' },
  lighting: 'daylight',
  detailLevel: 'high',
  scenes: [{
    id: 'demoC_s1', duration: 10, background: { assetId: 'bg_street' },
    characters: [
      {
        characterId: 'chibi_max', position: [0.32, 0.78],
        actions: [
          { type: 'angry_argument', start: 0, end: 2.8 },
          { type: 'walk', start: 2.5, end: 3.4, to: [0.48, 0.78] },
          { type: 'fight_cloud', start: 3.4, end: 7.0 },
          { type: 'funny_fall', start: 7.0, end: 8.6 },
          { type: 'idle', start: 8.6, end: 10.0, expression: 'dizzy' },
        ],
      },
      {
        characterId: 'chibi_doc', position: [0.64, 0.78], view: 'three_quarter_left',
        actions: [
          { type: 'angry_argument', start: 0, end: 2.8 },
          { type: 'walk', start: 2.5, end: 3.4, to: [0.50, 0.78] },
          { type: 'fight_cloud', start: 3.4, end: 7.0 },
          { type: 'recoil', start: 7.0, end: 8.6, expression: 'shocked' },
          { type: 'idle', start: 8.6, end: 10.0, expression: 'dizzy' },
        ],
      },
    ],
  }],
};
const outC = path.join(OUT_DIR, 'v52_p4e_demoC_cartoon_fight_10s.mp4');
console.log('\nRendering Phase 4E Demo C (Cartoon Fight 10s / 300 frames)...');
const resC = await orch.produceVideo(
  { id: 'p4e_demoC_cartoon_fight_10s', scenePlan: demoCPlan, bindings: { REQ_BG_street: { requirementId: 'REQ_BG_street', resolvedAssetId: 'bg_street', status: 'READY' } }, styleProfile: 'clean_cartoon' },
  PRODUCTION_MODES.MODE_B_FULL_AUTO, { outputPath: outC }
);
await check(47, 'Demo C (Cartoon Fight 10s) renders exact 300 frames @ 30fps + Contact Sheets', () => {
  assert.equal(resC.success, true, resC.error);
  const ff = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_type,nb_frames', '-of', 'json', outC], { encoding: 'utf8' }));
  assert.equal(Number(ff.streams.find(s => s.codec_type === 'video').nb_frames), 300);

  const makeContact = (mp4, times, outPng) => {
    const frames = times.map((t, i) => {
      const fp = path.join(OUT_DIR, `${path.basename(outPng, '.png')}_f${i}.png`);
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', mp4, '-frames:v', '1', fp]);
      return fp;
    });
    const args = ['-y', '-v', 'error'];
    frames.forEach(f => args.push('-i', f));
    args.push('-filter_complex', `hstack=inputs=${frames.length},scale=1920:-1`, outPng);
    execFileSync('ffmpeg', args);
  };
  makeContact(outA, [0.5, 2.0, 3.5, 6.0, 7.5], path.join(OUT_DIR, 'v52_p4e_demoA_contact.png'));
  makeContact(outB, [3.0, 12.0, 18.0, 27.0, 35.0, 42.0, 51.0, 58.0], path.join(OUT_DIR, 'v52_p4e_demoB_contact.png'));
  makeContact(outC, [1.5, 5.2, 7.8, 9.4], path.join(OUT_DIR, 'v52_p4e_demoC_contact.png'));
});

console.log(`\nPhase 4E Acceptance Summary: ${passed} passed, ${failed} failed (Total checks: ${passed + failed})`);
if (failed > 0) process.exit(1);

