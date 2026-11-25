// scenes/shots/01_prop_drop.js — Phase 2 Demo: Real Prop Hand-tracking & Emotional Reaction Drop
import { E, V, registerShot, mood, layer, ease, prog, clamp, lerp } from '/engine/core.js';
import { drawWhiteCartoonFigure } from '/engine/white-cartoon-rig2d.js';
import { POSES, breathe } from '/engine/rig2d.js';
import * as FX from '/engine/fx2d.js';
import { cafe, cafeTable } from '../sets/cafe.js';
import { MAX, JAKE } from '../cast.js';

registerShot('s001', {
  draw(g, t) {
    const cam = { z: 1.15, x: 0, y: -20 };
    const { GY, M } = cafe(g, t, cam, { mood: 'golden' });
    const s = 1.65;
    const maxPosX = E.W / 2 - 180;
    const jakePosX = E.W / 2 + 190;
    const rim = { color: M.rim, dir: [0, -1], w: 4 };

    layer(g, cam, 1, (g) => {
      // 1. Cafe Table in the center
      const tb = cafeTable(g, E.W / 2, GY);

      // 2. Max: Holding cup from 0.0s to 2.5s, then dropping cup onto table!
      // Hand pose holds cup near chest / mouth level
      const handWave = Math.sin(t * 3.5) * 4;
      const maxSitPose = {
        ...POSES.sit,
        eF: [22, -135 + handWave],
        hF: [30, -155 + handWave]
      };

      // Emotional reaction keyframes:
      // 0s - 2.3s: happy (vui vẻ thưởng thức)
      // 2.3s - 2.8s: surprised (giật mình vì cốc trượt tay)
      // 2.8s - 6.0s: shocked / scared (hoảng hốt khi cốc rơi xuống bàn)
      let maxExpr = 'happy';
      if (t >= 2.8) {
        maxExpr = 'shocked';
      } else if (t >= 2.3) {
        maxExpr = 'surprised';
      }

      // Prop configuration with hand attachment & drop kinematics
      const coffeeProp = {
        id: 'coffee_cup',
        type: 'coffee_cup',
        hand: 'F',
        scale: 1.1,
        rotation: t >= 2.5 ? Math.min(25, (t - 2.5) * 45) : 0, // Slight tilt when falling
        dropTime: 2.5,
        sceneX: E.W / 2 - 60,
        sceneY: tb.top - 16
      };

      // Render Max (White Cartoon Figure with Seamless Limbs & Universal Expression V4)
      drawWhiteCartoonFigure(g, {
        x: maxPosX,
        y: GY,
        s,
        facing: 1,
        outfit: MAX,
        pose: maxSitPose,
        expr: maxExpr,
        prop: coffeeProp,
        rim,
        shadow: false,
        sit: true,
        t
      });

      // 3. Jake: Friend reacting to the dropped cup
      let jakeExpr = 'neutral';
      if (t >= 2.6) {
        jakeExpr = 'surprised';
      }

      drawWhiteCartoonFigure(g, {
        x: jakePosX,
        y: GY,
        s,
        facing: -1,
        outfit: JAKE,
        pose: breathe(POSES.sit, t, 1, 2),
        expr: jakeExpr,
        rim,
        shadow: false,
        blink: (t % 3.0) > 2.85,
        sit: true,
        t
      });
    });

    // Atmospheric warm dust & subtle lighting streak
    FX.dust(g, t, { count: 35, color: '#ffe2bd', a: 0.3 });
    FX.lensStreak(g, E.W / 2, E.H * 0.32, E.W * 1.1, '#ffe0b0', 0.15);
  }
});
