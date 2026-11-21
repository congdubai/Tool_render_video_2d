/**
 * src/chibi/characters/ChibiCharacterV2.tsx
 * Character Renderer V2 (SVG / React / Remotion)
 * 5-Layer Cut-out Animation, relative facial coordinates, modular clothing, hand grip
 */

import React from 'react';
import {
  CharacterIdentityV2,
  ChibiCharacterV2Props,
  ChibiFacingV2,
  ChibiExpressionV2,
  ChibiSkeletonV2,
} from './CharacterV2Types';
import { getChibiSkeleton } from './CharacterRigV2';

export const DEFAULT_CHIBI_IDENTITY: CharacterIdentityV2 = {
  id: 'chibi_default',
  name: 'Chibi',
  skinColor: '#ffdfc4',
  hair: {
    style: 'short',
    color: '#343536',
    highlight: '#5a5b5c',
  },
  face: {
    eyeStyle: 'oval',
    eyeColor: '#111116',
    browStyle: 'soft',
    mouthStyle: 'smile',
    blush: true,
  },
  proportions: {
    headScale: 1.0,
    torsoLength: 36,
    armLength: 34,
    legLength: 46,
  },
  outfit: {
    type: 'hoodie',
    topColor: '#d64a33',
    topColor2: '#b83822',
    pantsColor: '#2e384d',
    shoeColor: '#1e1e24',
    headwear: 'none',
  },
  defaultExpression: 'neutral',
  defaultFacing: 'three_quarter_right',
};

export const ChibiCharacterV2: React.FC<ChibiCharacterV2Props> = ({
  character = DEFAULT_CHIBI_IDENTITY,
  x = 0,
  y = 0,
  scale = 1.0,
  facing: propFacing,
  pose,
  expression: propExpression,
  talk = 0,
  blink = false,
  look = [0, 0],
  prop,
  rimLight = true,
  showShadow = true,
  className,
  id,
}) => {
  const char: CharacterIdentityV2 =
    typeof character === 'object' && character !== null
      ? { ...DEFAULT_CHIBI_IDENTITY, ...character }
      : DEFAULT_CHIBI_IDENTITY;

  const facing: ChibiFacingV2 = propFacing || char.defaultFacing || 'three_quarter_right';
  const expr: ChibiExpressionV2 = propExpression || char.defaultExpression || 'neutral';
  const skel: ChibiSkeletonV2 = getChibiSkeleton(pose);

  const isLeft = facing === 'three_quarter_left' || facing === 'side_left';
  const isFront = facing === 'front';
  const flipX = isLeft ? -1 : 1;

  const ink = '#191918';
  const skin = char.skinColor || '#ffdfc4';
  const hairCol = char.hair?.color || '#343536';
  const hairHi = char.hair?.highlight || '#5a5b5c';
  const outfit = char.outfit || DEFAULT_CHIBI_IDENTITY.outfit;

  // 1. Shadow under feet
  const renderShadow = () => (
    <ellipse cx="0" cy="2" rx={28 * scale} ry={6 * scale} fill="rgba(0,0,0,0.24)" />
  );

  // 2. Head & Relative Face Features
  const renderHead = () => {
    const [hx, hy] = skel.head;
    const r = 36 * (char.proportions?.headScale || 1.0);

    // Eye offsets relative to head center based on perspective
    const eyeX = isFront ? [-13, 13] : [-5, 17];
    const eyeY = -6;
    const eyeRx = 5.2;
    const eyeRy = 7.8;

    return (
      <g id="chibi-head-group" transform={`translate(${hx} ${hy})`}>
        {/* Layer 1: Back Hair */}
        {renderBackHair(r)}

        {/* Layer 2: Head Skull base */}
        <circle cx="0" cy="0" r={r} fill={skin} stroke={ink} strokeWidth="4.5" />

        {/* Ears */}
        {isFront ? (
          <>
            <circle cx={-r - 1} cy="-2" r="7" fill={skin} stroke={ink} strokeWidth="3" />
            <circle cx={r + 1} cy="-2" r="7" fill={skin} stroke={ink} strokeWidth="3" />
          </>
        ) : (
          <circle cx={-r * 0.7} cy="-2" r="7.5" fill={skin} stroke={ink} strokeWidth="3.5" />
        )}

        {/* Layer 3: Face Features (Eyes, Brows, Nose, Mouth, Blush) */}
        {/* Blush */}
        {char.face?.blush && !blink && (
          <>
            <ellipse cx={eyeX[0]} cy={eyeY + 12} rx="6.5" ry="3.5" fill="#fca5a5" opacity="0.65" />
            <ellipse cx={eyeX[1]} cy={eyeY + 12} rx="6.5" ry="3.5" fill="#fca5a5" opacity="0.65" />
          </>
        )}

        {/* Eyes */}
        {blink || expr === 'sad' ? (
          <g stroke={ink} strokeWidth="4" strokeLinecap="round">
            <path d={`M ${eyeX[0] - 5} ${eyeY} Q ${eyeX[0]} ${eyeY + 3} ${eyeX[0] + 5} ${eyeY}`} />
            <path d={`M ${eyeX[1] - 5} ${eyeY} Q ${eyeX[1]} ${eyeY + 3} ${eyeX[1] + 5} ${eyeY}`} />
          </g>
        ) : expr === 'happy' || expr === 'laughing' ? (
          <g stroke={ink} strokeWidth="4.2" strokeLinecap="round" fill="none">
            <path d={`M ${eyeX[0] - 6} ${eyeY + 2} Q ${eyeX[0]} ${eyeY - 6} ${eyeX[0] + 6} ${eyeY + 2}`} />
            <path d={`M ${eyeX[1] - 6} ${eyeY + 2} Q ${eyeX[1]} ${eyeY - 6} ${eyeX[1] + 6} ${eyeY + 2}`} />
          </g>
        ) : (
          eyeX.map((ex, i) => {
            const rx = !isFront && i === 0 ? eyeRx * 0.88 : eyeRx;
            const lookDx = (look[0] || 0) * 2;
            const lookDy = (look[1] || 0) * 2;

            return (
              <g key={i}>
                {/* Oval Black Eye */}
                <ellipse cx={ex + lookDx} cy={eyeY + lookDy} rx={rx} ry={eyeRy} fill={ink} />
                {/* Primary Specular Highlight */}
                <circle cx={ex + lookDx + 1.8} cy={eyeY + lookDy - 2.5} r="2.4" fill="#ffffff" />
                {/* Secondary Specular Highlight */}
                <circle cx={ex + lookDx - 1.6} cy={eyeY + lookDy + 3.0} r="1.3" fill="#ffffff" />
              </g>
            );
          })
        )}

        {/* Eyebrows */}
        {renderEyebrows(eyeX, eyeY, r)}

        {/* Nose */}
        {!isFront && (
          <path d="M 10 0 Q 13 2 11 4" stroke={ink} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        )}

        {/* Mouth */}
        {renderMouth(eyeY, r)}

        {/* Layer 4: Front Hair & Bangs */}
        {renderFrontHair(r)}

        {/* Glasses / Accessories */}
        {outfit.accessories?.includes('glasses') && (
          <g stroke={ink} strokeWidth="3" fill="none">
            <circle cx={eyeX[0]} cy={eyeY} r="9.5" />
            <circle cx={eyeX[1]} cy={eyeY} r="9.5" />
            <line x1={eyeX[0] + 9.5} y1={eyeY} x2={eyeX[1] - 9.5} y2={eyeY} />
          </g>
        )}

        {/* Headwear */}
        {renderHeadwear(r)}
      </g>
    );
  };

  const renderEyebrows = (eyeX: number[], eyeY: number, r: number) => {
    const browY = eyeY - 11;
    let dy1 = 0, dy2 = 0;
    if (expr === 'worried') { dy1 = -2; dy2 = 2; }
    if (expr === 'angry') { dy1 = 3; dy2 = -3; }
    if (expr === 'surprised' || expr === 'confused') { dy1 = -4; dy2 = -4; }

    return (
      <g stroke={ink} strokeWidth="3" strokeLinecap="round">
        <line x1={eyeX[0] - 6} y1={browY + dy1} x2={eyeX[0] + 6} y2={browY - dy1} />
        <line x1={eyeX[1] - 6} y1={browY + dy2} x2={eyeX[1] + 6} y2={browY - dy2} />
      </g>
    );
  };

  const renderMouth = (eyeY: number, r: number) => {
    const mx = isFront ? 0 : 9;
    const my = eyeY + 18;

    if (talk > 0.1 || expr === 'laughing') {
      const openH = 3 + talk * 8 + (expr === 'laughing' ? 4 : 0);
      return (
        <ellipse cx={mx} cy={my} rx="6.5" ry={openH} fill={ink} stroke={ink} strokeWidth="2" />
      );
    }

    if (expr === 'sad') {
      return (
        <path d={`M ${mx - 6} ${my + 2} Q ${mx} ${my - 3} ${mx + 6} ${my + 2}`} stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
      );
    }

    return (
      <path d={`M ${mx - 6} ${my - 1} Q ${mx} ${my + 5} ${mx + 6} ${my - 1}`} stroke={ink} strokeWidth="3.2" strokeLinecap="round" fill="none" />
    );
  };

  const renderBackHair = (r: number) => {
    const style = char.hair?.style || 'short';
    if (style === 'bun') {
      return <circle cx={-r * 0.65} cy={-r * 0.7} r="16" fill={hairCol} stroke={ink} strokeWidth="4" />;
    }
    if (style === 'ponytail') {
      return (
        <path d={`M ${-r * 0.5} ${-r * 0.3} Q ${-r * 1.5} ${-r * 0.2} ${-r * 1.2} ${r * 0.8}`} stroke={hairCol} strokeWidth="18" strokeLinecap="round" fill="none" />
      );
    }
    return null;
  };

  const renderFrontHair = (r: number) => {
    const style = char.hair?.style || 'short';
    switch (style) {
      case 'spiky':
        return (
          <path
            d={`M ${-r * 0.95} ${-r * 0.2} Q ${-r * 0.9} ${-r * 1.1} 0 ${-r * 1.15} Q ${r * 0.9} ${-r * 1.1} ${r * 0.95} ${-r * 0.2} L ${r * 0.7} ${-r * 0.5} L ${r * 0.3} ${-r * 0.75} L 0 ${-r * 0.6} L ${-r * 0.4} ${-r * 0.75} Z`}
            fill={hairCol}
            stroke={ink}
            strokeWidth="4"
          />
        );
      case 'bun':
      case 'short':
      case 'side_part':
      default:
        return (
          <g>
            <path
              d={`M ${-r * 0.96} ${-r * 0.15} Q ${-r * 0.9} ${-r * 1.12} 0 ${-r * 1.16} Q ${r * 0.9} ${-r * 1.12} ${r * 0.96} ${-r * 0.15} Q ${r * 0.5} ${-r * 0.65} 0 ${-r * 0.55} Q ${-r * 0.5} ${-r * 0.65} ${-r * 0.96} ${-r * 0.15} Z`}
              fill={hairCol}
              stroke={ink}
              strokeWidth="4"
            />
            {/* Specular Hair Highlight */}
            <path
              d={`M ${-r * 0.45} ${-r * 0.9} Q 0 ${-r * 1.02} ${r * 0.45} ${-r * 0.9}`}
              stroke={hairHi}
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              opacity="0.6"
            />
          </g>
        );
    }
  };

  const renderHeadwear = (r: number) => {
    const hw = outfit.headwear || 'none';
    const hwCol = outfit.headwearColor || '#f2c21a';

    if (hw === 'cap' || hw === 'capBack') {
      const isBack = hw === 'capBack';
      const dir = isBack ? -1 : 1;
      return (
        <g>
          {/* Cap dome */}
          <ellipse cx="0" cy={-r * 0.35} rx={r * 1.05} ry={r * 0.8} fill={hwCol} stroke={ink} strokeWidth="4" />
          {/* Cap Brim */}
          <path
            d={`M ${dir * r * 0.2} ${-r * 0.35} Q ${dir * r * 1.6} ${-r * 0.28} ${dir * r * 1.55} ${-r * 0.12}`}
            stroke={ink}
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      );
    }
    return null;
  };

  // 3. Torso & Clothing
  const renderTorso = () => {
    const [sx, sy] = skel.sh;
    const [hx, hy] = skel.hip;
    const topCol = outfit.topColor || '#d64a33';
    const pantsCol = outfit.pantsColor || '#2e384d';

    return (
      <g id="chibi-torso-group">
        {/* Pelvis / Pants base */}
        <polygon
          points={`${hx - 16},${hy - 8} ${hx + 16},${hy - 8} ${hx + 18},${hy + 8} ${hx - 18},${hy + 8}`}
          fill={pantsCol}
          stroke={ink}
          strokeWidth="4"
        />

        {/* Torso Jacket / Shirt */}
        <path
          d={`M ${sx - 15} ${sy} Q ${sx} ${sy - 6} ${sx + 15} ${sy} L ${hx + 17} ${hy} L ${hx - 17} ${hy} Z`}
          fill={topCol}
          stroke={ink}
          strokeWidth="4.5"
        />

        {/* Details based on outfit type */}
        {outfit.type === 'hoodie' && (
          <g>
            {/* Kangaroo pocket */}
            <rect x={hx - 10} y={hy - 14} width="20" height="11" rx="3" fill={outfit.topColor2 || '#b83822'} stroke={ink} strokeWidth="2.5" />
            {/* Drawstrings */}
            <line x1={sx + 3} y1={sy + 2} x2={sx + 3} y2={sy + 18} stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
            <line x1={sx + 9} y1={sy + 2} x2={sx + 9} y2={sy + 16} stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        )}

        {outfit.type === 'labcoat' && (
          <g stroke={ink} strokeWidth="2.5" fill="none">
            <line x1={sx + 2} y1={sy} x2={hx + 2} y2={hy + 6} />
            <rect x={sx - 10} y={sy + 8} width="8" height="10" rx="1" fill="#f3f4f6" stroke={ink} strokeWidth="2" />
            <line x1={sx - 7} y1={sy + 4} x2={sx - 7} y2={sy + 9} stroke="#2563eb" strokeWidth="2" />
          </g>
        )}

        {outfit.type === 'suit' && (
          <polygon points={`${sx + 1},${sy} ${sx + 5},${sy} ${sx + 6},${hy - 4} ${sx + 3},${hy} ${sx},${hy - 4}`} fill={outfit.topColor2 || '#c0392b'} stroke={ink} strokeWidth="2" />
        )}
      </g>
    );
  };

  // 4. Limbs (Arms and Legs with connected segments)
  const renderLimb = (
    p1: [number, number],
    p2: [number, number],
    p3: [number, number],
    color: string,
    shoeOrHandColor: string,
    isLeg: boolean = false
  ) => {
    return (
      <g>
        {/* Upper segment */}
        <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={color} strokeWidth={isLeg ? '14' : '11'} strokeLinecap="round" />
        <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={ink} strokeWidth={isLeg ? '15.5' : '12.5'} strokeLinecap="round" opacity="0.15" />

        {/* Lower segment */}
        <line x1={p2[0]} y1={p2[1]} x2={p3[0]} y2={p3[1]} stroke={color} strokeWidth={isLeg ? '13' : '10'} strokeLinecap="round" />

        {/* Joint circles */}
        <circle cx={p1[0]} cy={p1[1]} r={isLeg ? 7 : 5.5} fill={color} />
        <circle cx={p2[0]} cy={p2[1]} r={isLeg ? 6.5 : 5} fill={color} />

        {/* Shoe or Hand */}
        {isLeg ? (
          <ellipse cx={p3[0] + (flipX * 4)} cy={p3[1]} rx="9" ry="5.5" fill={shoeOrHandColor} stroke={ink} strokeWidth="3" />
        ) : (
          <circle cx={p3[0]} cy={p3[1]} r="5.5" fill={shoeOrHandColor} stroke={ink} strokeWidth="2.5" />
        )}
      </g>
    );
  };

  // 5. Hand Grip for Props
  const renderProp = () => {
    if (!prop) return null;
    const propType = typeof prop === 'string' ? prop : prop.type;
    const [hx, hy] = skel.hNear;

    switch (propType) {
      case 'phone':
        return (
          <g transform={`translate(${hx} ${hy})`}>
            <rect x="-4" y="-18" width="10" height="18" rx="2.5" fill="#1e293b" stroke={ink} strokeWidth="2.5" />
            <rect x="-2" y="-16" width="6" height="13" rx="1" fill="#38bdf8" />
          </g>
        );
      case 'cup':
        return (
          <g transform={`translate(${hx} ${hy})`}>
            <polygon points="-4,-14 6,-14 4,2 -2,2" fill="#f8fafc" stroke={ink} strokeWidth="2.5" />
            <path d="M 6 -10 Q 11 -7 6 -3" stroke={ink} strokeWidth="2" fill="none" />
          </g>
        );
      case 'pointer':
        return (
          <line x1={hx} y1={hy} x2={hx + 45} y2={hy - 35} stroke="#d4d4d8" strokeWidth="3" strokeLinecap="round" />
        );
      default:
        return null;
    }
  };

  return (
    <g
      id={id}
      className={className}
      transform={`translate(${x} ${y}) scale(${scale * flipX} ${scale})`}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 1. Shadow */}
      {showShadow && renderShadow()}

      {/* 2. Far Leg */}
      {renderLimb(skel.hipFar, skel.kFar, skel.fFar, outfit.pantsColor, outfit.shoeColor, true)}

      {/* 3. Far Arm */}
      {renderLimb(skel.shFar, skel.eFar, skel.hFar, outfit.topColor, skin, false)}

      {/* 4. Torso & Clothing */}
      {renderTorso()}

      {/* 5. Near Leg */}
      {renderLimb(skel.hipNear, skel.kNear, skel.fNear, outfit.pantsColor, outfit.shoeColor, true)}

      {/* 6. Near Arm */}
      {renderLimb(skel.shNear, skel.eNear, skel.hNear, outfit.topColor, skin, false)}

      {/* 7. Head & Face */}
      {renderHead()}

      {/* 8. Prop with Hand Grip */}
      {renderProp()}
    </g>
  );
};

