import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  compileSceneAnimations,
  compileProjectAnimations,
  validateSceneAnimation,
} from '../thanhhai-2d-studio/engine/v5-animation-director.js';
import {
  compileCharacterActingTracks,
  evaluateActingFrame,
} from '../thanhhai-2d-studio/engine/v5-character-acting-engine.js';

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name}\n  ${err?.stack || err}`);
  }
}

await check('3D-1: Custom Animation JSON interpolates semantic bones declaratively (zero eval)', () => {
  const tr = compileCharacterActingTracks({
    characterId: 'chibi_doc',
    actions: [
      {
        type: 'custom_animation',
        start: 0,
        end: 2,
        keyframes: [
          { time: 0, bones: { right_upper_arm: 0, head: 0 } },
          { time: 2, bones: { right_upper_arm: 120, head: -15 }, easing: 'easeInOut' },
        ],
      },
    ],
  }, 2);
  const fMid = evaluateActingFrame(tr, 1.0);
  const fEnd = evaluateActingFrame(tr, 2.0);
  assert.ok(fMid.jointAngles.upper_arm_R > 40 && fMid.jointAngles.upper_arm_R < 80);
  assert.ok(Math.abs(fEnd.jointAngles.upper_arm_R - 120) < 5);
});

await check('3D-2: Animation Director preserves cross-scene continuity (pose, view, expression, position)', () => {
  const scenes = [
    {
      id: 's1',
      duration: 4,
      characters: [
        {
          characterId: 'chibi_max',
          position: [0.2, 0.78],
          view: 'side_r',
          actions: [
            { type: 'walk', start: 0, end: 3, to: [0.6, 0.78] },
            { type: 'turn_head', start: 3, end: 4, targetView: 'front' },
            { type: 'expression', value: 'happy', start: 3, end: 4 },
          ],
        },
      ],
    },
    {
      id: 's2',
      duration: 4,
      characters: [{ characterId: 'chibi_max' }],
    },
  ];
  const res = compileProjectAnimations(scenes, { scenes });
  assert.equal(res.compiledCount, 2);
  const s2Acting = res.scenes.s2.characterTracks.chibi_max.actingTrack;
  assert.equal(s2Acting.baseView, 'front');
  assert.equal(s2Acting.baseExpression, 'happy');
  assert.ok(Math.abs(s2Acting.baseX - 0.6 * 1280) < 2);
});

await check('3D-3: Incremental rebuild respects lockedSceneIds', () => {
  const scenes = [
    { id: 's1', duration: 3, characters: [{ characterId: 'chibi_doc', action: 'walk' }] },
    { id: 's2', duration: 3, characters: [{ characterId: 'chibi_doc', action: 'wave' }] },
  ];
  const first = compileProjectAnimations(scenes, { scenes });
  const sentinel = { ...first.scenes.s1, customSentinel: true };
  const second = compileProjectAnimations(scenes, { scenes }, {
    lockedSceneIds: ['s1'],
    previousTracks: { s1: sentinel },
  });
  assert.equal(second.scenes.s1.customSentinel, true, 'Locked scene must be preserved');
});

await check('3D-4: Animation validation emits ERROR, WARNING, INFO accurately', () => {
  const trBadBone = compileCharacterActingTracks({
    characterId: 'chibi_doc',
    actions: [
      { type: 'custom_animation', keyframes: [{ time: 0, bones: { fake_tail_bone: 45 } }] },
      { type: 'nonexistent_action_xyz', start: 0, end: 1 },
    ],
  }, 2);
  const trWalk = compileCharacterActingTracks({
    characterId: 'png_hero',
    actions: [{ type: 'walk', start: 0, end: 2 }],
  }, 2);
  const issuesA = validateSceneAnimation({ groundY: 500 }, { chibi_doc: { actingTrack: trBadBone } }, 'procedural_rig');
  assert.ok(issuesA.some(i => i.level === 'ERROR' && i.code === 'UNKNOWN_BONE'));
  assert.ok(issuesA.some(i => i.level === 'WARNING' && i.code === 'UNSUPPORTED_ACTION'));
  assert.ok(issuesA.some(i => i.level === 'WARNING' && i.code === 'FLOOR_PENETRATION'));

  const issuesPng = validateSceneAnimation({ groundY: 620 }, { png_hero: { actingTrack: trWalk } }, 'single_png');
  assert.ok(issuesPng.some(i => i.level === 'INFO' && i.code === 'SINGLE_PNG_FALLBACK'));
});

await check('3D-5: Animation Inspector UI & controller exist inside Tab 4 Wizard Step 3', () => {
  const html = fs.readFileSync('app/ui/index.html', 'utf8');
  const appJs = fs.readFileSync('app/ui/app.js', 'utf8');
  assert.ok(html.includes('v5AnimationInspectorDetails') && html.includes('v5AnimSeekSlider') && html.includes('v5AnimDebugSkeleton'));
  assert.ok(appJs.includes('onAnimInspectorSeek') && appJs.includes('refreshAnimationInspectorUi'));
});

console.log(`\nPhase 3D Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
