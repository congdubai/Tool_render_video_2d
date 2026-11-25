// engine/action-engine-v4.js — Composite Action Engine & Universal Motion Library (V4)
// Multi-track action coordination engine coordinating skeletal motion, expressions,
// sprite animation, VFX, props, camera shake, visibility, layer order, and timeline events.

import { clamp, lerp, seg, circle, ring, alpha, shade, mix, rr, poly, ease } from './core.js';
import {
  solve2BoneIK,
  drawWhiteCartoonFigure,
  drawWhiteCartoonHead,
  WHITE_CARTOON_PRESETS
} from './white-cartoon-rig2d.js';
import {
  solveWalkCycle,
  solveRunCycle,
  solveSneakWalkCycle,
  solveFallBackwardAction,
  solveScaredReactionAction,
  solveSitDownTransition,
  solveReliefSigh
} from './action-engine.js';
import {
  drawUniversalVfx,
  normalizeVfxSpec,
  drawVfxFightSmoke,
  drawVfxImpactFlash,
  drawVfxSpeedLines,
  drawVfxDustCloud,
  drawVfxDizzyStars
} from './vfx-engine-v4.js';
import {
  drawHandAttachedProp,
  drawSceneProp,
  solvePropTimelineState,
  normalizePropSpec
} from './prop-v4.js';
import { normalizeExpressionName } from './expression-v4.js';

// Re-export V3 kinematic solvers for seamless backwards compatibility
export {
  solveWalkCycle,
  solveRunCycle,
  solveSneakWalkCycle,
  solveFallBackwardAction,
  solveScaredReactionAction,
  solveSitDownTransition,
  solveReliefSigh
};

/**
 * BUILT-IN COMPOSITE ACTION TEMPLATES (8 CORE PRESETS)
 */
export const COMPOSITE_ACTION_TEMPLATES = {
  // 1. COMPOSITE FIGHT CLOUD (Comic Brawl with Real Character Head Pop-outs)
  composite_fight_cloud: {
    id: 'composite_fight_cloud',
    name: 'Đám Khói Đánh Nhau Hoạt Hình (Fight Cloud)',
    category: 'comic_fight',
    description: 'Hành động 2 nhân vật lao vào nhau ẩu đả, bọc kín trong đám khói hoạt hình quay tít, thò đầu (giữ nguyên đầu nhân vật), vung nắm đấm/chân và kết thúc văng ra choáng váng sao bay quanh đầu.',
    duration: 4.5,
    roles: [
      { id: 'fighter_a', label: 'Võ sĩ A (Fighter A)', requiredRigType: 'any', defaultPos: [-180, 0], defaultFacing: 1 },
      { id: 'fighter_b', label: 'Võ sĩ B (Fighter B)', requiredRigType: 'any', defaultPos: [180, 0], defaultFacing: -1 }
    ],
    parameters: {
      smokeScale: 1.25,
      shakeIntensity: 0.8,
      popOutRate: 1.0,
      knockbackDistance: 170
    },
    phases: [
      { name: 'preparation', start: 0.0, end: 0.15 },
      { name: 'rush', start: 0.15, end: 0.25 },
      { name: 'collision', start: 0.25, end: 0.30 },
      { name: 'smoke_brawl', start: 0.30, end: 0.80 },
      { name: 'dissipation', start: 0.80, end: 0.90 },
      { name: 'aftermath', start: 0.90, end: 1.00 }
    ],
    // Multi-track timeline events
    tracks: {
      fighter_a: [
        // Preparation: Angry stance facing right
        { type: 'pose', start: 0.0, end: 0.15, value: 'angry_stand' },
        { type: 'expression', start: 0.0, end: 0.25, value: 'furious' },
        { type: 'position', start: 0.0, end: 0.15, from: [-180, 0], to: [-180, 0] },
        // Rush: Run towards center
        { type: 'pose', start: 0.15, end: 0.25, value: 'run' },
        { type: 'position', start: 0.15, end: 0.25, from: [-180, 0], to: [-35, 0], ease: 'easeIn' },
        // Collision
        { type: 'position', start: 0.25, end: 0.30, from: [-35, 0], to: [-15, 0] },
        // Smoke Brawl: Body hidden inside fight smoke
        { type: 'visibility', start: 0.30, end: 0.80, hideBody: true, hideHead: false, visible: true },
        { type: 'position', start: 0.30, end: 0.80, from: [-15, 0], to: [0, 0] },
        // Dissipation: Knockback to the left
        { type: 'visibility', start: 0.80, end: 1.00, hideBody: false, hideHead: false, visible: true },
        { type: 'position', start: 0.80, end: 0.90, from: [0, 0], to: [-170, 0], ease: 'easeOut' },
        { type: 'pose', start: 0.80, end: 0.90, value: 'fall_backward' },
        // Aftermath: Dizzy slumped
        { type: 'position', start: 0.90, end: 1.00, from: [-170, 0], to: [-170, 0] },
        { type: 'pose', start: 0.90, end: 1.00, value: 'dizzy_sit' },
        { type: 'expression', start: 0.80, end: 1.00, value: 'dizzy' },
        { type: 'vfx', start: 0.85, end: 1.00, vfxType: 'vfx_dizzy_stars', attachment: 'head', layer: 'front' }
      ],
      fighter_b: [
        // Preparation: Angry stance facing left
        { type: 'pose', start: 0.0, end: 0.15, value: 'angry_stand' },
        { type: 'expression', start: 0.0, end: 0.25, value: 'angry' },
        { type: 'position', start: 0.0, end: 0.15, from: [180, 0], to: [180, 0] },
        // Rush: Run towards center
        { type: 'pose', start: 0.15, end: 0.25, value: 'run' },
        { type: 'position', start: 0.15, end: 0.25, from: [180, 0], to: [35, 0], ease: 'easeIn' },
        // Collision
        { type: 'position', start: 0.25, end: 0.30, from: [35, 0], to: [15, 0] },
        // Smoke Brawl: Body hidden inside fight smoke
        { type: 'visibility', start: 0.30, end: 0.80, hideBody: true, hideHead: false, visible: true },
        { type: 'position', start: 0.30, end: 0.80, from: [15, 0], to: [0, 0] },
        // Dissipation: Knockback to the right
        { type: 'visibility', start: 0.80, end: 1.00, hideBody: false, hideHead: false, visible: true },
        { type: 'position', start: 0.80, end: 0.90, from: [0, 0], to: [170, 0], ease: 'easeOut' },
        { type: 'pose', start: 0.80, end: 0.90, value: 'fall_backward' },
        // Aftermath: Dizzy slumped
        { type: 'position', start: 0.90, end: 1.00, from: [170, 0], to: [170, 0] },
        { type: 'pose', start: 0.90, end: 1.00, value: 'dizzy_sit' },
        { type: 'expression', start: 0.80, end: 1.00, value: 'dizzy' },
        { type: 'vfx', start: 0.85, end: 1.00, vfxType: 'vfx_dizzy_stars', attachment: 'head', layer: 'front' }
      ]
    },
    // Comic brawl pop-outs (Real Head + Comic Limbs)
    popouts: [
      {
        id: 'pop_head_a1',
        start: 0.36, end: 0.45,
        role: 'fighter_a',
        type: 'head',
        offset: [-68, -125],
        rotation: -0.22,
        scale: 1.05,
        expression: 'shocked',
        burstText: 'POW!'
      },
      {
        id: 'pop_fist_b',
        start: 0.46, end: 0.53,
        role: 'fighter_b',
        type: 'fist',
        offset: [75, -75],
        rotation: 0.4,
        scale: 1.2,
        burstText: 'BAM!'
      },
      {
        id: 'pop_head_b1',
        start: 0.55, end: 0.64,
        role: 'fighter_b',
        type: 'head',
        offset: [62, -118],
        rotation: 0.25,
        scale: 1.05,
        expression: 'furious',
        burstText: 'WHAM!'
      },
      {
        id: 'pop_foot_a',
        start: 0.66, end: 0.74,
        role: 'fighter_a',
        type: 'foot',
        offset: [-72, -35],
        rotation: -0.5,
        scale: 1.15,
        burstText: 'KICK!'
      }
    ],
    // Global tracks (Camera, Scene VFX, Audio Cues)
    globalTracks: {
      camera: [
        { start: 0.25, end: 0.32, shake: 18, zoom: 1.05 },
        { start: 0.32, end: 0.80, shake: 8, zoom: 1.02 },
        { start: 0.80, end: 0.88, shake: 12, zoom: 1.0 }
      ],
      vfx: [
        { start: 0.25, end: 0.34, vfxType: 'vfx_impact_flash', x: 0, y: -45, scale: 1.4 },
        { start: 0.30, end: 0.84, vfxType: 'vfx_fight_smoke', x: 0, y: -45, scale: 1.3, maskCharacters: true },
        { start: 0.80, end: 0.90, vfxType: 'vfx_dust_cloud', x: 0, y: 0, scale: 1.1 }
      ],
      audio: [
        { time: 0.16, sound: 'whoosh_dash' },
        { time: 0.25, sound: 'punch_impact_heavy' },
        { time: 0.38, sound: 'comic_pow' },
        { time: 0.48, sound: 'comic_bam' },
        { time: 0.58, sound: 'comic_wham' },
        { time: 0.80, sound: 'body_slam' },
        { time: 0.90, sound: 'dizzy_birds' }
      ]
    }
  },

  // 2. COMPOSITE CHASE (Cartoon Chase with Speed Lines & Dust)
  composite_chase: {
    id: 'composite_chase',
    name: 'Cuộc Đuổi Bắt Hoạt Hình (Cartoon Chase)',
    category: 'chase',
    description: 'Nhân vật A hoảng hốt tháo chạy phía trước với vệt tốc độ, nhân vật B hùng hổ đuổi sát phía sau; có đoạn ngoái nhìn thót tim và bứt tốc.',
    duration: 3.5,
    roles: [
      { id: 'runner', label: 'Người chạy (Runner)', requiredRigType: 'any', defaultPos: [60, 0], defaultFacing: 1 },
      { id: 'chaser', label: 'Người đuổi (Chaser)', requiredRigType: 'any', defaultPos: [-140, 0], defaultFacing: 1 }
    ],
    parameters: {
      speed: 2.2,
      chaseDistance: 200,
      panSpeed: 1.0
    },
    phases: [
      { name: 'start_sprint', start: 0.0, end: 0.3 },
      { name: 'look_back', start: 0.3, end: 0.6 },
      { name: 'lunge_pursuit', start: 0.6, end: 1.0 }
    ],
    tracks: {
      runner: [
        { type: 'pose', start: 0.0, end: 0.3, value: 'run', options: { speed: 2.4 } },
        { type: 'pose', start: 0.3, end: 0.6, value: 'run', options: { speed: 2.0, lookBack: true } },
        { type: 'pose', start: 0.6, end: 1.0, value: 'run', options: { speed: 2.8 } },
        { type: 'expression', start: 0.0, end: 0.3, value: 'worried' },
        { type: 'expression', start: 0.3, end: 0.6, value: 'shocked' },
        { type: 'expression', start: 0.6, end: 1.0, value: 'terrified' },
        { type: 'position', start: 0.0, end: 1.0, from: [-20, 0], to: [120, 0], ease: 'linear' },
        { type: 'vfx', start: 0.2, end: 1.0, vfxType: 'vfx_sweat', attachment: 'head', layer: 'front' }
      ],
      chaser: [
        { type: 'pose', start: 0.0, end: 0.6, value: 'run', options: { speed: 2.2 } },
        { type: 'pose', start: 0.6, end: 1.0, value: 'run', options: { speed: 2.7, lunge: true } },
        { type: 'expression', start: 0.0, end: 1.0, value: 'furious' },
        { type: 'position', start: 0.0, end: 1.0, from: [-220, 0], to: [-80, 0], ease: 'linear' },
        { type: 'vfx', start: 0.4, end: 1.0, vfxType: 'vfx_anger_smoke', attachment: 'head', layer: 'front' }
      ]
    },
    globalTracks: {
      camera: [
        { start: 0.0, end: 1.0, shake: 3.5, zoom: 1.0 }
      ],
      vfx: [
        { start: 0.0, end: 1.0, vfxType: 'vfx_speed_lines', x: 0, y: -60, scale: 1.2 },
        { start: 0.0, end: 1.0, vfxType: 'vfx_dust_puff', x: -80, y: 10, scale: 1.0 }
      ],
      audio: [
        { time: 0.0, sound: 'cartoon_scramble_feet' },
        { time: 1.2, sound: 'whoosh_fast' }
      ]
    }
  },

  // 3. COMPOSITE POWER UP (Power Surge with Golden Aura & Nova Blast)
  composite_power_up: {
    id: 'composite_power_up',
    name: 'Bùng Nổ Sức Mạnh (Power Up Surge)',
    category: 'energy',
    description: 'Nhân vật khom người tụ khí, mặt đất rung chuyển, hào quang vàng bùng phát kèm tia sét cuộn trào, rồi bộc phát sóng xung kích cực đại.',
    duration: 3.2,
    roles: [
      { id: 'actor', label: 'Nhân vật chính (Actor)', requiredRigType: 'any', defaultPos: [0, 0], defaultFacing: 1 }
    ],
    parameters: {
      auraColor: '#f59e0b',
      pulseIntensity: 1.3,
      shakeMax: 15
    },
    phases: [
      { name: 'gather_energy', start: 0.0, end: 0.25 },
      { name: 'aura_surge', start: 0.25, end: 0.75 },
      { name: 'nova_burst', start: 0.75, end: 1.00 }
    ],
    tracks: {
      actor: [
        // 1. Crouch anticipation
        { type: 'pose', start: 0.0, end: 0.25, value: 'crouch_gather' },
        { type: 'expression', start: 0.0, end: 0.25, value: 'worried' },
        { type: 'scale', start: 0.0, end: 0.25, from: [1, 1], to: [1.08, 0.92] },
        // 2. Stand & Roar Surge
        { type: 'pose', start: 0.25, end: 0.75, value: 'power_stance' },
        { type: 'expression', start: 0.25, end: 0.75, value: 'furious' },
        { type: 'scale', start: 0.25, end: 0.75, from: [1.08, 0.92], to: [1.0, 1.05] },
        { type: 'vfx', start: 0.25, end: 0.95, vfxType: 'vfx_golden_aura', attachment: 'character', layer: 'behind' },
        { type: 'vfx', start: 0.35, end: 0.85, vfxType: 'vfx_lightning_energy', attachment: 'character', layer: 'front' },
        // 3. Nova Burst & Settle
        { type: 'pose', start: 0.75, end: 1.00, value: 'empowered_idle' },
        { type: 'expression', start: 0.75, end: 1.00, value: 'happy' },
        { type: 'scale', start: 0.75, end: 1.00, from: [1.0, 1.05], to: [1.0, 1.0] }
      ]
    },
    globalTracks: {
      camera: [
        { start: 0.0, end: 0.25, shake: 2, zoom: 1.0 },
        { start: 0.25, end: 0.75, shake: 14, zoom: 1.1 },
        { start: 0.75, end: 1.00, shake: 5, zoom: 1.05 }
      ],
      vfx: [
        { start: 0.20, end: 0.75, vfxType: 'vfx_ground_dust', x: 0, y: 15, scale: 1.3 },
        { start: 0.75, end: 0.95, vfxType: 'vfx_shockwave', x: 0, y: -40, scale: 1.6 }
      ],
      audio: [
        { time: 0.1, sound: 'hum_energy_buildup' },
        { time: 0.26, sound: 'shout_power_surge' },
        { time: 0.75, sound: 'energy_nova_blast' }
      ]
    }
  },

  // 4. COMPOSITE FUNNY FALL (Comedic Slip & Fall with Bounce & Dizzy Stars)
  composite_funny_fall: {
    id: 'composite_funny_fall',
    name: 'Ngã Trượt Vỏ Chuối Hài Hước (Funny Fall)',
    category: 'physical_comedy',
    description: 'Nhân vật đang bước đi vui vẻ thì trượt chân, hai chân bắn lên trời, lơ lửng một nhịp rồi rơi đập mông xuống sàn nảy tưng và choáng váng.',
    duration: 3.2,
    roles: [
      { id: 'actor', label: 'Nhân vật (Actor)', requiredRigType: 'any', defaultPos: [0, 0], defaultFacing: 1 }
    ],
    parameters: {
      slipVelocity: 1.2,
      bounceDamping: 0.7
    },
    phases: [
      { name: 'walk', start: 0.0, end: 0.20 },
      { name: 'slip_hangtime', start: 0.20, end: 0.45 },
      { name: 'impact_slam', start: 0.45, end: 0.65 },
      { name: 'dizzy_settle', start: 0.65, end: 1.00 }
    ],
    tracks: {
      actor: [
        // Walking
        { type: 'pose', start: 0.0, end: 0.20, value: 'walk' },
        { type: 'expression', start: 0.0, end: 0.20, value: 'happy' },
        { type: 'position', start: 0.0, end: 0.20, from: [-60, 0], to: [-20, 0] },
        // Slip & Hangtime
        { type: 'pose', start: 0.20, end: 0.45, value: 'fall_backward' },
        { type: 'expression', start: 0.20, end: 0.45, value: 'shocked' },
        { type: 'position', start: 0.20, end: 0.45, from: [-20, 0], to: [10, -25], ease: 'arc' },
        { type: 'rotation', start: 0.20, end: 0.45, from: 0, to: -1.2 },
        // Floor Impact Slam
        { type: 'pose', start: 0.45, end: 0.65, value: 'fall_backward' },
        { type: 'expression', start: 0.45, end: 0.65, value: 'shocked' },
        { type: 'position', start: 0.45, end: 0.65, from: [10, -25], to: [15, 0], ease: 'bounce' },
        { type: 'rotation', start: 0.45, end: 0.65, from: -1.2, to: -1.5 },
        // Settle & Dizzy
        { type: 'pose', start: 0.65, end: 1.00, value: 'dizzy_sit' },
        { type: 'expression', start: 0.65, end: 1.00, value: 'dizzy' },
        { type: 'position', start: 0.65, end: 1.00, from: [15, 0], to: [15, 0] },
        { type: 'rotation', start: 0.65, end: 1.00, from: -1.5, to: 0, ease: 'easeOut' },
        { type: 'vfx', start: 0.65, end: 1.00, vfxType: 'vfx_dizzy_stars', attachment: 'head', layer: 'front' }
      ]
    },
    globalTracks: {
      camera: [
        { start: 0.45, end: 0.58, shake: 12, zoom: 1.0 }
      ],
      vfx: [
        { start: 0.45, end: 0.65, vfxType: 'vfx_dust_cloud', x: 15, y: 5, scale: 1.2 },
        { start: 0.45, end: 0.55, vfxType: 'vfx_impact_flash', x: 15, y: -10, scale: 1.1 }
      ],
      audio: [
        { time: 0.20, sound: 'slide_whistle_up' },
        { time: 0.45, sound: 'comic_body_thud' },
        { time: 0.68, sound: 'dizzy_tweet' }
      ]
    }
  },

  // 5. COMPOSITE SHOCK REACTION (Jump, Shock Lines, Sweat, Shiver)
  composite_shock_reaction: {
    id: 'composite_shock_reaction',
    name: 'Giật Bắn Mình Kinh Ngạc (Shock Reaction)',
    category: 'reaction',
    description: 'Nhân vật đang đứng yên thì giật bắn mình vọt lên cao 70px, dựng đứng người, mắt trợn tròn, tia sốc và mồ hôi bắn tung tóe, rơi xuống run rẩy.',
    duration: 2.6,
    roles: [
      { id: 'actor', label: 'Nhân vật (Actor)', requiredRigType: 'any', defaultPos: [0, 0], defaultFacing: 1 }
    ],
    parameters: {
      jumpHeight: 65,
      shiverSpeed: 45
    },
    phases: [
      { name: 'idle_calm', start: 0.0, end: 0.15 },
      { name: 'startle_jump', start: 0.15, end: 0.45 },
      { name: 'freeze_shiver', start: 0.45, end: 0.70 },
      { name: 'recover_sigh', start: 0.70, end: 1.00 }
    ],
    tracks: {
      actor: [
        // 1. Calm
        { type: 'pose', start: 0.0, end: 0.15, value: 'idle' },
        { type: 'expression', start: 0.0, end: 0.15, value: 'neutral' },
        { type: 'position', start: 0.0, end: 0.15, from: [0, 0], to: [0, 0] },
        // 2. Sudden Startle Jump
        { type: 'pose', start: 0.15, end: 0.45, value: 'scared_jump' },
        { type: 'expression', start: 0.15, end: 0.70, value: 'shocked' },
        { type: 'position', start: 0.15, end: 0.35, from: [0, 0], to: [0, -65], ease: 'easeOut' },
        { type: 'position', start: 0.35, end: 0.50, from: [0, -65], to: [0, 0], ease: 'bounce' },
        { type: 'vfx', start: 0.15, end: 0.50, vfxType: 'vfx_shock_lines', attachment: 'head', layer: 'front' },
        { type: 'vfx', start: 0.20, end: 0.65, vfxType: 'vfx_sweat', attachment: 'head', layer: 'front' },
        // 3. Shiver & Kneel
        { type: 'pose', start: 0.50, end: 0.70, value: 'shiver_crouch' },
        { type: 'pose', start: 0.70, end: 1.00, value: 'relief_sigh' },
        { type: 'expression', start: 0.70, end: 1.00, value: 'tired' }
      ]
    },
    globalTracks: {
      camera: [
        { start: 0.15, end: 0.30, shake: 6, zoom: 1.04 }
      ],
      vfx: [
        { start: 0.15, end: 0.28, vfxType: 'vfx_exclamation_mark', x: 0, y: -140, scale: 1.2 }
      ],
      audio: [
        { time: 0.15, sound: 'comic_gasp_screech' },
        { time: 0.48, sound: 'light_thump' },
        { time: 0.75, sound: 'sigh_relief' }
      ]
    }
  },

  // 6. COMPOSITE CARTOON ARGUMENT (Alternating Angry Dialogue & Steam)
  composite_cartoon_argument: {
    id: 'composite_cartoon_argument',
    name: 'Khẩu Chiến Hoạt Hình (Cartoon Argument)',
    category: 'dialogue',
    description: 'Hai nhân vật tranh cãi nảy lửa: A chỉ tay quát mắng nhả khói tức giận, B khoanh tay lườm nguýt; sau đó B phản công gay gắt, hai bên cụng trán nổ tia lửa rồi giận dỗi quay lưng.',
    duration: 4.2,
    roles: [
      { id: 'debater_a', label: 'Người tranh luận A (Debater A)', requiredRigType: 'any', defaultPos: [-70, 0], defaultFacing: 1 },
      { id: 'debater_b', label: 'Người tranh luận B (Debater B)', requiredRigType: 'any', defaultPos: [70, 0], defaultFacing: -1 }
    ],
    parameters: {
      steamFrequency: 2.0,
      argumentTension: 1.2
    },
    phases: [
      { name: 'turn_a_attacks', start: 0.0, end: 0.35 },
      { name: 'turn_b_counter', start: 0.35, end: 0.70 },
      { name: 'clash_faceoff', start: 0.70, end: 0.88 },
      { name: 'pout_turnaway', start: 0.88, end: 1.00 }
    ],
    tracks: {
      debater_a: [
        // A points and shouts
        { type: 'pose', start: 0.0, end: 0.35, value: 'point_shout' },
        { type: 'expression', start: 0.0, end: 0.35, value: 'furious' },
        { type: 'position', start: 0.0, end: 0.35, from: [-70, 0], to: [-50, 0], ease: 'easeOut' },
        { type: 'vfx', start: 0.1, end: 0.35, vfxType: 'vfx_steam_puff', attachment: 'head', layer: 'front' },
        // A recoils defensively
        { type: 'pose', start: 0.35, end: 0.70, value: 'recoil_defense' },
        { type: 'expression', start: 0.35, end: 0.70, value: 'shocked' },
        { type: 'position', start: 0.35, end: 0.70, from: [-50, 0], to: [-65, 0] },
        // Clash forehead to forehead
        { type: 'pose', start: 0.70, end: 0.88, value: 'forehead_clash' },
        { type: 'expression', start: 0.70, end: 0.88, value: 'angry' },
        { type: 'position', start: 0.70, end: 0.88, from: [-65, 0], to: [-20, 0] },
        // Turn away pouting
        { type: 'pose', start: 0.88, end: 1.00, value: 'arms_crossed_pout' },
        { type: 'expression', start: 0.88, end: 1.00, value: 'angry' },
        { type: 'facing', start: 0.88, end: 1.00, value: -1 },
        { type: 'position', start: 0.88, end: 1.00, from: [-20, 0], to: [-60, 0] }
      ],
      debater_b: [
        // B scowls with crossed arms
        { type: 'pose', start: 0.0, end: 0.35, value: 'arms_crossed' },
        { type: 'expression', start: 0.0, end: 0.35, value: 'angry' },
        { type: 'position', start: 0.0, end: 0.35, from: [70, 0], to: [70, 0] },
        // B steps forward counter-shouting
        { type: 'pose', start: 0.35, end: 0.70, value: 'point_shout' },
        { type: 'expression', start: 0.35, end: 0.70, value: 'furious' },
        { type: 'position', start: 0.35, end: 0.70, from: [70, 0], to: [45, 0], ease: 'easeOut' },
        { type: 'vfx', start: 0.4, end: 0.70, vfxType: 'vfx_anger_mark', attachment: 'head', layer: 'front' },
        // Clash forehead to forehead
        { type: 'pose', start: 0.70, end: 0.88, value: 'forehead_clash' },
        { type: 'expression', start: 0.70, end: 0.88, value: 'furious' },
        { type: 'position', start: 0.70, end: 0.88, from: [45, 0], to: [20, 0] },
        // Turn away pouting
        { type: 'pose', start: 0.88, end: 1.00, value: 'arms_crossed_pout' },
        { type: 'expression', start: 0.88, end: 1.00, value: 'angry' },
        { type: 'facing', start: 0.88, end: 1.00, value: 1 },
        { type: 'position', start: 0.88, end: 1.00, from: [20, 0], to: [60, 0] }
      ]
    },
    globalTracks: {
      camera: [
        { start: 0.70, end: 0.88, shake: 4, zoom: 1.08 }
      ],
      vfx: [
        { start: 0.72, end: 0.86, vfxType: 'vfx_lightning_energy', x: 0, y: -90, scale: 0.8 }
      ],
      audio: [
        { time: 0.05, sound: 'angry_jabber_1' },
        { time: 0.38, sound: 'angry_jabber_2' },
        { time: 0.72, sound: 'sparks_zap' },
        { time: 0.89, sound: 'huff_pout' }
      ]
    }
  },

  // 7. COMPOSITE OBJECT INTERACTION (Pick Up, Hold, Give, Receive, Put Down)
  composite_object_interaction: {
    id: 'composite_object_interaction',
    name: 'Tương Tác Chuyển Giao Đạo Cụ (Object Interaction)',
    category: 'interaction',
    description: 'Nhân vật A cầm đạo cụ bước tới trao cho nhân vật B, nhân vật B nhận lấy đạo cụ an toàn và đặt xuống bàn mà không bị nhân đôi hay mất mát đồ vật.',
    duration: 3.6,
    roles: [
      { id: 'giver', label: 'Người trao (Giver)', requiredRigType: 'any', defaultPos: [-70, 0], defaultFacing: 1 },
      { id: 'receiver', label: 'Người nhận (Receiver)', requiredRigType: 'any', defaultPos: [70, 0], defaultFacing: -1 }
    ],
    parameters: {
      propId: 'prop_coffee_cup',
      handoffTime: 0.52
    },
    phases: [
      { name: 'approach_hold', start: 0.0, end: 0.35 },
      { name: 'extend_arm', start: 0.35, end: 0.52 },
      { name: 'prop_handoff', start: 0.52, end: 0.75 },
      { name: 'receive_settle', start: 0.75, end: 1.00 }
    ],
    tracks: {
      giver: [
        { type: 'pose', start: 0.0, end: 0.35, value: 'walk_hold_prop' },
        { type: 'position', start: 0.0, end: 0.35, from: [-110, 0], to: [-60, 0] },
        { type: 'pose', start: 0.35, end: 0.52, value: 'reach_give_prop' },
        { type: 'prop', start: 0.0, end: 0.52, hand: 'R', state: 'held' },
        // After handoff, giver retracts hands and smiles
        { type: 'pose', start: 0.52, end: 1.00, value: 'idle_happy' },
        { type: 'expression', start: 0.52, end: 1.00, value: 'happy' }
      ],
      receiver: [
        { type: 'pose', start: 0.0, end: 0.35, value: 'idle_waiting' },
        { type: 'expression', start: 0.0, end: 0.35, value: 'neutral' },
        { type: 'pose', start: 0.35, end: 0.52, value: 'reach_receive_prop' },
        // Receiver gets the prop at handoff time
        { type: 'prop', start: 0.52, end: 0.85, hand: 'L', state: 'held' },
        { type: 'pose', start: 0.52, end: 0.85, value: 'inspect_prop' },
        { type: 'expression', start: 0.52, end: 1.00, value: 'happy' },
        // Receiver places prop down
        { type: 'prop', start: 0.85, end: 1.00, state: 'dropped', dropPosition: [40, 0] },
        { type: 'pose', start: 0.85, end: 1.00, value: 'idle_happy' }
      ]
    },
    globalTracks: {
      camera: [
        { start: 0.48, end: 0.60, shake: 0.5, zoom: 1.05 }
      ],
      vfx: [
        { start: 0.52, end: 0.68, vfxType: 'vfx_magic_sparkles', x: 5, y: -45, scale: 0.9 }
      ],
      audio: [
        { time: 0.0, sound: 'footsteps' },
        { time: 0.52, sound: 'prop_handoff_ding' },
        { time: 0.85, sound: 'prop_table_click' }
      ]
    }
  },

  // 8. COMPOSITE STORYTELLING (Thinking -> Idea -> Explaining -> Celebration / Fail)
  composite_storytelling: {
    id: 'composite_storytelling',
    name: 'Kể Chuyện & Nảy Ra Ý Tưởng (Storytelling & Eureka)',
    category: 'storytelling',
    description: 'Nhân vật trầm ngâm suy nghĩ với dấu hỏi xoay quanh, đột nhiên nảy ra sáng kiến với bóng đèn bật sáng, hào hứng diễn giải sinh động rồi ăn mừng rạng rỡ.',
    duration: 4.0,
    roles: [
      { id: 'actor', label: 'Người kể chuyện (Actor)', requiredRigType: 'any', defaultPos: [0, 0], defaultFacing: 1 }
    ],
    parameters: {
      eurekaSound: 'ding_bright',
      gestureIntensity: 1.1
    },
    phases: [
      { name: 'ponder_question', start: 0.0, end: 0.28 },
      { name: 'eureka_idea', start: 0.28, end: 0.50 },
      { name: 'animated_explain', start: 0.50, end: 0.80 },
      { name: 'celebrate_success', start: 0.80, end: 1.00 }
    ],
    tracks: {
      actor: [
        // 1. Pondering
        { type: 'pose', start: 0.0, end: 0.28, value: 'ponder_chin' },
        { type: 'expression', start: 0.0, end: 0.28, value: 'thinking' },
        { type: 'vfx', start: 0.05, end: 0.28, vfxType: 'vfx_question_mark', attachment: 'head', layer: 'front' },
        // 2. Eureka Lightbulb Moment
        { type: 'pose', start: 0.28, end: 0.50, value: 'point_upward' },
        { type: 'expression', start: 0.28, end: 0.50, value: 'shocked' },
        { type: 'vfx', start: 0.28, end: 0.55, vfxType: 'vfx_idea_bulb', attachment: 'head', layer: 'front' },
        // 3. Explaining & Gesturing
        { type: 'pose', start: 0.50, end: 0.80, value: 'gesture_talk' },
        { type: 'expression', start: 0.50, end: 0.80, value: 'talking' },
        // 4. Celebration
        { type: 'pose', start: 0.80, end: 1.00, value: 'celebrate_arms_up' },
        { type: 'expression', start: 0.80, end: 1.00, value: 'laughing' },
        { type: 'vfx', start: 0.82, end: 1.00, vfxType: 'vfx_magic_sparkles', attachment: 'head', layer: 'front' }
      ]
    },
    globalTracks: {
      camera: [
        { start: 0.28, end: 0.42, shake: 1.5, zoom: 1.06 },
        { start: 0.80, end: 0.95, shake: 2.0, zoom: 1.02 }
      ],
      vfx: [],
      audio: [
        { time: 0.0, sound: 'thoughtful_hum' },
        { time: 0.28, sound: 'ding_eureka' },
        { time: 0.82, sound: 'cheer_fanfare' }
      ]
    }
  }
};

/**
 * Registry Storage for Custom & Builtin Composite Action Templates
 */
const customActionRegistry = new Map();

export function getCompositeActionTemplate(id) {
  if (!id) return null;
  return customActionRegistry.get(id) || COMPOSITE_ACTION_TEMPLATES[id] || null;
}

export function listCompositeActionTemplates() {
  const builtins = Object.values(COMPOSITE_ACTION_TEMPLATES);
  const customs = Array.from(customActionRegistry.values());
  return [...builtins, ...customs];
}

export function registerCompositeActionTemplate(template) {
  if (!template || !template.id) {
    throw new Error('Template phải có thuộc tính id duy nhất.');
  }
  if (!template.roles || !Array.isArray(template.roles) || template.roles.length === 0) {
    throw new Error('Template phải chứa ít nhất 1 role hợp lệ.');
  }
  if (typeof template.duration !== 'number' || template.duration <= 0) {
    throw new Error('Template phải có thời lượng (duration) lớn hơn 0 giây.');
  }
  customActionRegistry.set(template.id, { ...template, isCustom: true });
  return template;
}

/**
 * Dependency Loop Detection for Nested Composite Actions
 * Detects direct and circular dependencies (A -> B -> C -> A)
 */
export function checkActionDependencyLoop(template, allTemplates = {}) {
  const visited = new Set();
  const recursionStack = new Set();
  const templateMap = { ...COMPOSITE_ACTION_TEMPLATES, ...Object.fromEntries(customActionRegistry), ...allTemplates };

  function dfs(currId, path = []) {
    if (recursionStack.has(currId)) {
      return { hasLoop: true, cycle: [...path, currId] };
    }
    if (visited.has(currId)) return { hasLoop: false };

    visited.add(currId);
    recursionStack.add(currId);
    const tmpl = templateMap[currId];

    if (tmpl && tmpl.subActions && Array.isArray(tmpl.subActions)) {
      for (const sub of tmpl.subActions) {
        const subId = typeof sub === 'string' ? sub : sub.id;
        const res = dfs(subId, [...path, currId]);
        if (res.hasLoop) return res;
      }
    }

    recursionStack.delete(currId);
    return { hasLoop: false };
  }

  const startId = typeof template === 'string' ? template : template.id;
  return dfs(startId, []);
}

/**
 * MULTI-TRACK INTERPOLATION HELPERS
 */
function interpolateTrackValue(track, p, defaultVal) {
  if (!track || track.length === 0) return defaultVal;

  for (const item of track) {
    if (p >= item.start && p <= item.end) {
      const segLen = Math.max(0.0001, item.end - item.start);
      const segP = clamp((p - item.start) / segLen, 0, 1);
      const easeFn = item.ease === 'easeIn' ? ease.in :
                     item.ease === 'easeOut' ? ease.out :
                     item.ease === 'easeInOut' ? ease.inOut :
                     item.ease === 'bounce' ? (k => Math.abs(Math.sin(k * Math.PI * 2.5)) * (1 - k)) :
                     (k => k);

      const k = easeFn(segP);

      if (item.type === 'position') {
        const fx = item.from ? item.from[0] : 0;
        const fy = item.from ? item.from[1] : 0;
        const tx = item.to ? item.to[0] : 0;
        const ty = item.to ? item.to[1] : 0;
        if (item.ease === 'arc') {
          const arcHeight = -35;
          const curX = lerp(fx, tx, k);
          const curY = lerp(fy, ty, k) + Math.sin(segP * Math.PI) * arcHeight;
          return [curX, curY];
        }
        return [lerp(fx, tx, k), lerp(fy, ty, k)];
      }

      if (item.type === 'rotation') {
        return lerp(item.from ?? 0, item.to ?? 0, k);
      }

      if (item.type === 'scale') {
        const fx = item.from ? item.from[0] : 1;
        const fy = item.from ? item.from[1] : 1;
        const tx = item.to ? item.to[0] : 1;
        const ty = item.to ? item.to[1] : 1;
        return [lerp(fx, tx, k), lerp(fy, ty, k)];
      }

      if (item.type === 'opacity') {
        return lerp(item.from ?? 1, item.to ?? 1, k);
      }

      if (item.value !== undefined) {
        return item.value;
      }
      return item;
    }
  }

  // If before first segment
  if (p < track[0].start) {
    if (track[0].from !== undefined) return track[0].from;
    if (track[0].value !== undefined) return track[0].value;
  }
  // If after last segment
  const last = track[track.length - 1];
  if (p > last.end) {
    if (last.to !== undefined) return last.to;
    if (last.value !== undefined) return last.value;
  }

  return defaultVal;
}

/**
 * SOLVE COMPOSITE ACTION TIMELINE
 * Evaluates all roles, multi-track parameters, popouts, and global tracks at time t.
 *
 * @param {string|object} templateOrId Composite action template object or ID
 * @param {object} roleBindings Map of roleId -> character config/ID (e.g. { fighter_a: 'alex', fighter_b: 'jake' })
 * @param {number} t Current scene time in seconds
 * @param {number} [startTime=0] Action start time
 * @param {number} [duration] Action duration (defaults to template duration)
 * @param {object} [params] Dynamic parameter overrides
 * @returns {object} Evaluated action state
 */
export function solveCompositeAction(templateOrId, roleBindings = {}, t = 0, startTime = 0, duration = null, params = {}) {
  const tmpl = typeof templateOrId === 'string' ? getCompositeActionTemplate(templateOrId) : templateOrId;
  if (!tmpl) {
    throw new Error(`Composite action "${templateOrId}" không tồn tại trong thư viện.`);
  }

  const actDuration = duration || tmpl.duration || 4.0;
  const elapsed = t - startTime;
  const p = clamp(elapsed / Math.max(0.001, actDuration), 0, 1);
  const activeParams = { ...(tmpl.parameters || {}), ...params };

  // 1. Evaluate Actor States
  const actors = {};
  const activeRoles = tmpl.roles || [{ id: 'actor', defaultPos: [0, 0], defaultFacing: 1 }];

  for (const r of activeRoles) {
    const roleId = r.id;
    const boundChar = roleBindings[roleId] || roleBindings[roleId.replace(/_[ab]/, '')] || roleBindings.character || roleBindings.actor || 'character_A';
    const roleTracks = tmpl.tracks ? (tmpl.tracks[roleId] || []) : [];

    // Filter tracks by type
    const posTracks = roleTracks.filter(k => k.type === 'position');
    const rotTracks = roleTracks.filter(k => k.type === 'rotation');
    const scaleTracks = roleTracks.filter(k => k.type === 'scale');
    const opacityTracks = roleTracks.filter(k => k.type === 'opacity');
    const poseTracks = roleTracks.filter(k => k.type === 'pose');
    const exprTracks = roleTracks.filter(k => k.type === 'expression');
    const visTracks = roleTracks.filter(k => k.type === 'visibility');
    const facingTracks = roleTracks.filter(k => k.type === 'facing');
    const propTracks = roleTracks.filter(k => k.type === 'prop');
    const vfxTracks = roleTracks.filter(k => k.type === 'vfx');

    const defaultPos = r.defaultPos || [0, 0];
    const pos = interpolateTrackValue(posTracks, p, defaultPos);
    const rotation = interpolateTrackValue(rotTracks, p, 0);
    const scale = interpolateTrackValue(scaleTracks, p, [1, 1]);
    const opacity = interpolateTrackValue(opacityTracks, p, 1);
    const facing = interpolateTrackValue(facingTracks, p, r.defaultFacing ?? 1);

    // Active Pose
    let activePose = 'stand';
    let poseOptions = {};
    for (const pt of poseTracks) {
      if (p >= pt.start && p <= pt.end) {
        activePose = pt.value || pt.pose || 'stand';
        poseOptions = pt.options || {};
        break;
      }
    }

    // Active Expression
    let activeExpr = 'neutral';
    for (const et of exprTracks) {
      if (p >= et.start && p <= et.end) {
        activeExpr = normalizeExpressionName(et.value || et.asset || 'neutral');
        break;
      }
    }

    // Visibility & Masking
    let visible = true;
    let hideBody = false;
    let hideHead = false;
    let hideLimbs = false;

    for (const vt of visTracks) {
      if (p >= vt.start && p <= vt.end) {
        if (vt.value !== undefined) visible = vt.value;
        if (vt.hideBody !== undefined) hideBody = vt.hideBody;
        if (vt.hideHead !== undefined) hideHead = vt.hideHead;
        if (vt.hideLimbs !== undefined) hideLimbs = vt.hideLimbs;
      }
    }

    // Prop state for role
    let activeProp = null;
    for (const pr of propTracks) {
      if (p >= pr.start && p <= pr.end) {
        activeProp = {
          id: pr.propId || activeParams.propId || 'prop_coffee_cup',
          hand: pr.hand || 'R',
          state: pr.state || 'held',
          dropPosition: pr.dropPosition || [pos[0], pos[1]]
        };
        break;
      }
    }

    // Role-bound VFX
    const roleVfx = [];
    for (const vt of vfxTracks) {
      if (p >= vt.start && p <= vt.end) {
        roleVfx.push({
          type: vt.vfxType || vt.asset,
          attachment: vt.attachment || 'head',
          layer: vt.layer || 'front',
          scale: vt.scale || 1.0,
          startTime: startTime + vt.start * actDuration,
          endTime: startTime + vt.end * actDuration
        });
      }
    }

    actors[roleId] = {
      roleId,
      character: boundChar,
      x: pos[0],
      y: pos[1],
      rotation,
      scaleX: scale[0],
      scaleY: scale[1],
      facing,
      opacity,
      visible,
      hideBody,
      hideHead,
      hideLimbs,
      pose: activePose,
      poseOptions,
      expression: activeExpr,
      prop: activeProp,
      vfx: roleVfx
    };
  }

  // 2. Evaluate Pop-outs (for Fight Smoke brawls or comic surprise bursts)
  const activePopouts = [];
  if (tmpl.popouts && Array.isArray(tmpl.popouts)) {
    for (const pop of tmpl.popouts) {
      if (p >= pop.start && p <= pop.end) {
        const popLen = Math.max(0.001, pop.end - pop.start);
        const popProgress = (p - pop.start) / popLen;
        // Natural popping animation: spring out and pull back
        const spring = Math.sin(popProgress * Math.PI);
        const actor = actors[pop.role] || Object.values(actors)[0];

        activePopouts.push({
          id: pop.id,
          role: pop.role,
          character: actor?.character || 'character_A',
          type: pop.type || 'head',
          x: (pop.offset ? pop.offset[0] : 0) * (spring * 0.2 + 0.8),
          y: (pop.offset ? pop.offset[1] : -90) - spring * 12,
          rotation: (pop.rotation || 0) + Math.sin(t * 15) * 0.05,
          scale: (pop.scale || 1.0) * (0.8 + spring * 0.2),
          expression: pop.expression || 'shocked',
          burstText: pop.burstText || null,
          progress: popProgress
        });
      }
    }
  }

  // 3. Evaluate Global Tracks (Camera Shake, Scene VFX, Audio Events)
  const camera = { shakeAmp: 0, z: 1.0, offsetX: 0, offsetY: 0 };
  const globalVfx = [];
  const audioEvents = [];

  if (tmpl.globalTracks) {
    // Camera track
    if (tmpl.globalTracks.camera) {
      for (const cam of tmpl.globalTracks.camera) {
        if (p >= cam.start && p <= cam.end) {
          const segLen = Math.max(0.001, cam.end - cam.start);
          const segP = (p - cam.start) / segLen;
          const env = Math.sin(segP * Math.PI);
          const baseShake = (cam.shake || 0) * (activeParams.shakeIntensity ?? 1.0);
          camera.shakeAmp = Math.max(camera.shakeAmp, baseShake * (0.4 + 0.6 * env));
          camera.z = lerp(camera.z, cam.zoom || 1.0, 0.5);
        }
      }
    }

    // Scene VFX track
    if (tmpl.globalTracks.vfx) {
      for (const vf of tmpl.globalTracks.vfx) {
        if (p >= vf.start && p <= vf.end) {
          globalVfx.push({
            type: vf.vfxType || vf.asset,
            x: vf.x || 0,
            y: vf.y || 0,
            scale: (vf.scale || 1.0) * (vf.vfxType === 'vfx_fight_smoke' ? (activeParams.smokeScale || 1.2) : 1.0),
            maskCharacters: vf.maskCharacters ?? false,
            startTime: startTime + vf.start * actDuration,
            endTime: startTime + vf.end * actDuration,
            params: activeParams
          });
        }
      }
    }

    // Audio cue events
    if (tmpl.globalTracks.audio) {
      for (const aud of tmpl.globalTracks.audio) {
        if (Math.abs(p - aud.time) < 0.02) {
          audioEvents.push(aud.sound);
        }
      }
    }
  }

  return {
    templateId: tmpl.id,
    templateName: tmpl.name,
    category: tmpl.category,
    progress: p,
    elapsed,
    duration: actDuration,
    isFinished: p >= 1.0,
    actors,
    popouts: activePopouts,
    globalVfx,
    camera,
    audioEvents
  };
}

/**
 * Solve Kinematic Rig Pose for White Cartoon Character from Composite Action Pose
 */
export function solveCompositeActorPose(actor, t = 0) {
  const poseName = actor.pose || 'stand';
  const opt = actor.poseOptions || {};

  switch (poseName) {
    case 'walk':
      return solveWalkCycle(t, { speed: opt.speed || 1.0 });

    case 'run':
      return solveRunCycle(t, { speed: opt.speed || 1.3 });

    case 'sneak':
      return solveSneakWalkCycle(t, { speed: opt.speed || 0.6 });

    case 'fall_backward':
      return solveFallBackwardAction(actor.progress || 0.5);

    case 'scared_jump':
      return solveScaredReactionAction(t, 0.5);

    case 'dizzy_sit':
    case 'sit':
      return solveSitDownTransition(1.0);

    case 'relief_sigh':
      return solveReliefSigh(t, 1.2);

    case 'angry_stand': {
      // Tense forward lean, raised clenched fists, slight anger tremble
      const tremble = Math.sin(t * 35) * 1.5;
      return {
        isWhiteCartoon: true,
        hip: [0, -44],
        sh: [4, -82],
        head: [8, -126],
        eF: [22 + tremble, -88], hF: [28 + tremble, -108],
        eB: [-18 - tremble, -88], hB: [-24 - tremble, -108],
        kF: [10, -22], fF: [12, 0],
        kB: [-8, -22], fB: [-10, 0]
      };
    }

    case 'crouch_gather': {
      // Squatting down gathering energy
      return {
        isWhiteCartoon: true,
        hip: [0, -28],
        sh: [0, -60],
        head: [0, -96],
        eF: [18, -48], hF: [24, -34],
        eB: [-18, -48], hB: [-24, -34],
        kF: [24, -14], fF: [14, 0],
        kB: [-24, -14], fB: [-14, 0]
      };
    }

    case 'power_stance': {
      // Flared arms, chest puffed upward, feet wide apart
      const pulse = Math.sin(t * 22) * 2;
      return {
        isWhiteCartoon: true,
        hip: [0, -42],
        sh: [0, -84 + pulse],
        head: [0, -132 + pulse],
        eF: [38, -80], hF: [48, -104],
        eB: [-38, -80], hB: [-48, -104],
        kF: [22, -22], fF: [28, 0],
        kB: [-22, -22], fB: [-28, 0]
      };
    }

    case 'point_shout': {
      // Aggressive forward lean, one arm pointing finger out
      return {
        isWhiteCartoon: true,
        hip: [6, -44],
        sh: [18, -82],
        head: [26, -124],
        eF: [38, -88], hF: [58, -88], // Pointing hand
        eB: [-16, -72], hB: [-18, -50],
        kF: [14, -22], fF: [16, 0],
        kB: [-10, -22], fB: [-10, 0]
      };
    }

    case 'recoil_defense': {
      // Leaning backwards with hands up defensively
      return {
        isWhiteCartoon: true,
        hip: [-12, -44],
        sh: [-24, -82],
        head: [-32, -126],
        eF: [12, -100], hF: [16, -120],
        eB: [-8, -100], hB: [-4, -120],
        kF: [8, -22], fF: [12, 0],
        kB: [-16, -22], fB: [-16, 0]
      };
    }

    case 'forehead_clash': {
      // Leaning far forward, head touching opponent
      return {
        isWhiteCartoon: true,
        hip: [10, -44],
        sh: [26, -80],
        head: [36, -122],
        eF: [30, -70], hF: [36, -92],
        eB: [-8, -65], hB: [-12, -45],
        kF: [18, -22], fF: [22, 0],
        kB: [-12, -22], fB: [-14, 0]
      };
    }

    case 'arms_crossed':
    case 'arms_crossed_pout': {
      return {
        isWhiteCartoon: true,
        hip: [0, -44],
        sh: [0, -82],
        head: [0, -126],
        eF: [12, -72], hF: [-10, -74],
        eB: [-12, -72], hB: [10, -74],
        kF: [6, -22], fF: [6, 0],
        kB: [-6, -22], fB: [-6, 0]
      };
    }

    case 'ponder_chin': {
      // Hand on chin, thoughtful stance
      return {
        isWhiteCartoon: true,
        hip: [0, -44],
        sh: [2, -82],
        head: [4, -126],
        eF: [18, -95], hF: [8, -118], // Hand on chin
        eB: [-14, -68], hB: [-16, -46],
        kF: [6, -22], fF: [6, 0],
        kB: [-6, -22], fB: [-6, 0]
      };
    }

    case 'point_upward': {
      // Eureka index finger pointing straight up
      return {
        isWhiteCartoon: true,
        hip: [0, -44],
        sh: [0, -82],
        head: [2, -126],
        eF: [22, -110], hF: [22, -150], // Pointing straight up
        eB: [-16, -65], hB: [-18, -45],
        kF: [4, -22], fF: [4, 0],
        kB: [-4, -22], fB: [-4, 0]
      };
    }

    case 'celebrate_arms_up': {
      // Both arms triumphantly raised in the air
      return {
        isWhiteCartoon: true,
        hip: [0, -44],
        sh: [0, -82],
        head: [0, -126],
        eF: [28, -115], hF: [36, -152],
        eB: [-28, -115], hB: [-36, -152],
        kF: [8, -22], fF: [10, 0],
        kB: [-8, -22], fB: [-10, 0]
      };
    }

    default: // Standard standing idle
      return {
        isWhiteCartoon: true,
        hip: [0, -44],
        sh: [0, -82],
        head: [0, -126],
        eF: [16, -60], hF: [18, -42],
        eB: [-16, -60], hB: [-18, -42],
        kF: [4, -22], fF: [4, 0],
        kB: [-4, -22], fB: [-4, 0]
      };
  }
}

/**
 * RENDER COMPOSITE ACTION TO CANVAS
 * High-performance composite action renderer coordinating actors, Fight Smoke masking,
 * head pop-outs retaining real character identity, limbs, VFX, props, and camera.
 */
export function drawCompositeAction(g, compositeState, t = 0, camera = { z: 1, x: 0, y: 0 }, assetResolver = {}) {
  if (!compositeState || !compositeState.actors) return;

  const { actors, popouts, globalVfx } = compositeState;

  g.save();

  // 1. Draw Behind-Actors Global VFX
  for (const vfx of globalVfx) {
    if (vfx.type === 'vfx_fight_smoke') continue; // Fight smoke drawn at character level
    g.save();
    drawUniversalVfx(g, vfx, t, { currentLayer: 'behind' });
    g.restore();
  }

  // 2. Draw Participating Actors in Z-Order
  const actorList = Object.values(actors);
  for (const act of actorList) {
    if (!act.visible) continue;

    g.save();
    g.translate(act.x, act.y);
    g.scale(act.scaleX * (act.facing ?? 1), act.scaleY);
    g.rotate(act.rotation || 0);

    // Resolve character definition (Mode A White Cartoon or Custom Outfit)
    let charDef = WHITE_CARTOON_PRESETS.character_A;
    if (typeof act.character === 'string') {
      charDef = WHITE_CARTOON_PRESETS[act.character] || WHITE_CARTOON_PRESETS.character_A;
    } else if (act.character && typeof act.character === 'object') {
      charDef = { ...WHITE_CARTOON_PRESETS.character_A, ...act.character };
    }

    // Kinematic Pose
    const pose = solveCompositeActorPose(act, t);

    // Render Character (Respecting hideBody and hideHead for Fight Smoke brawl)
    drawWhiteCartoonFigure(g, {
      x: 0,
      y: 0,
      s: 1.0,
      ink: '#20202A',
      facing: 1,
      dir: act.facing < 0 ? 'side_left' : 'side_right',
      pose,
      outfit: charDef,
      expr: act.expression || 'neutral',
      bodyVisible: !act.hideBody,
      headVisible: !act.hideHead,
      vfx: act.vfx,
      prop: act.prop ? {
        id: act.prop.id,
        hand: act.prop.hand,
        state: act.prop.state,
        dropPosition: act.prop.dropPosition
      } : null
    }, t);

    g.restore();
  }

  // 3. Draw Fight Smoke Mass (if active)
  for (const vfx of globalVfx) {
    if (vfx.type === 'vfx_fight_smoke') {
      g.save();
      drawVfxFightSmoke(g, vfx.x, vfx.y, t, {
        scale: vfx.scale || 1.3,
        showLimbs: true,
        maskCharacters: true
      });
      g.restore();
    }
  }

  // 4. Draw Comic Pop-Outs (Preserving Real Character Appearance & Heads!)
  if (popouts && popouts.length > 0) {
    for (const pop of popouts) {
      g.save();
      g.translate(pop.x, pop.y);
      g.scale(pop.scale, pop.scale);
      g.rotate(pop.rotation);

      if (pop.type === 'head') {
        // Resolve real character definition for the popped out head
        let charDef = WHITE_CARTOON_PRESETS.character_A;
        if (typeof pop.character === 'string') {
          charDef = WHITE_CARTOON_PRESETS[pop.character] || WHITE_CARTOON_PRESETS.character_A;
        } else if (pop.character && typeof pop.character === 'object') {
          charDef = { ...WHITE_CARTOON_PRESETS.character_A, ...pop.character };
        }

        // Draw Real Character Head (retains Alex's hoodie, Jake's yellow cap, Doc's glasses, skin color, etc.)
        const HR = 32;
        drawWhiteCartoonHead(g, 0, 0, HR, { expr: pop.expression || 'shocked' }, 'front', charDef, '#20202A', t);

        // Action Comic Burst lines and Comic Text
        if (pop.burstText) {
          g.save();
          g.translate(28, -25);
          drawComicActionBurst(g, pop.burstText, t);
          g.restore();
        }
      } else if (pop.type === 'fist') {
        // Comic Punching Glove / Fist
        drawComicFist(g, 0, 0, pop.rotation);
        if (pop.burstText) {
          g.save();
          g.translate(22, -20);
          drawComicActionBurst(g, pop.burstText, t);
          g.restore();
        }
      } else if (pop.type === 'foot') {
        // Comic Kicking Sneaker
        drawComicFoot(g, 0, 0, pop.rotation);
        if (pop.burstText) {
          g.save();
          g.translate(20, -22);
          drawComicActionBurst(g, pop.burstText, t);
          g.restore();
        }
      }

      g.restore();
    }
  }

  // 5. Draw Front-Actors Global VFX
  for (const vfx of globalVfx) {
    if (vfx.type === 'vfx_fight_smoke') continue;
    g.save();
    drawUniversalVfx(g, vfx, t, { currentLayer: 'front' });
    g.restore();
  }

  g.restore();
}

/**
 * Helper to Draw Comic Action Bursts ("POW!", "BAM!", "WHAM!")
 */
function drawComicActionBurst(g, text, t = 0) {
  g.save();
  const starPoints = 10;
  const rOuter = 26;
  const rInner = 14;

  g.fillStyle = '#facc15';
  g.strokeStyle = '#20202A';
  g.lineWidth = 2.4;
  g.beginPath();
  for (let i = 0; i < starPoints * 2; i++) {
    const a = (i * Math.PI) / starPoints;
    const r = i % 2 === 0 ? rOuter : rInner;
    if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.stroke();

  // Burst Text
  g.fillStyle = '#dc2626';
  g.font = '900 13px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 0, 1);
  g.restore();
}

/**
 * Helper to Draw Cartoon Fist
 */
function drawComicFist(g, x, y, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);

  // Speed lines behind fist
  g.strokeStyle = '#94a3b8';
  g.lineWidth = 2.0;
  [-12, 0, 12].forEach(off => {
    g.beginPath();
    g.moveTo(-30, off);
    g.lineTo(-12, off);
    g.stroke();
  });

  // Clenched cartoon fist
  g.fillStyle = '#FFFDF8';
  g.strokeStyle = '#20202A';
  g.lineWidth = 3.2;

  // Main fist knuckles
  g.beginPath();
  g.arc(0, 0, 15, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Thumb
  g.beginPath();
  g.ellipse(-4, 6, 8, 5, 0.4, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Knuckle lines
  g.beginPath();
  g.moveTo(4, -8);
  g.lineTo(4, 8);
  g.stroke();

  g.restore();
}

/**
 * Helper to Draw Cartoon Foot
 */
function drawComicFoot(g, x, y, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);

  // Cartoon sneaker
  g.fillStyle = '#1e293b';
  g.strokeStyle = '#20202A';
  g.lineWidth = 3.2;

  // Sole
  g.beginPath();
  g.ellipse(0, 4, 18, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // White toe cap
  g.fillStyle = '#FFFDF8';
  g.beginPath();
  g.arc(10, 2, 7, -Math.PI / 2, Math.PI / 2);
  g.fill();
  g.stroke();

  g.restore();
}

/**
 * Compatibility and Fallback System for Composite Actions
 */
export function getCompositeActionCompatibility(template, roleCharacters = {}) {
  const tmpl = typeof template === 'string' ? getCompositeActionTemplate(template) : template;
  if (!tmpl) {
    return { compatible: false, reason: 'Template không tồn tại.' };
  }

  const reports = [];
  let isFullyCompatible = true;

  for (const r of (tmpl.roles || [])) {
    const char = roleCharacters[r.id] || roleCharacters.actor || 'character_A';
    const rigType = char.characterEngine || char.type || 'white_cartoon';

    if (r.requiredRigType && r.requiredRigType !== 'any' && r.requiredRigType !== rigType) {
      isFullyCompatible = false;
      reports.push({
        roleId: r.id,
        rigType,
        required: r.requiredRigType,
        fallbackMode: rigType === 'imported_layered' ? 'bone_fk' : 'affine_transform'
      });
    }
  }

  return {
    compatible: isFullyCompatible,
    roleReports: reports,
    fallbackAvailable: true
  };
}
