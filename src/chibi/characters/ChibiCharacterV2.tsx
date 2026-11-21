/**
 * src/chibi/characters/ChibiCharacterV2.tsx
 * Character Renderer V2 (SVG / React / Remotion)
 * 5-Layer Cut-out Animation, relative facial coordinates, modular clothing, hand grip
 * Thanh Hai 2D Studio Ink Cartoon Aesthetic with anatomical proportions
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
  const skel: ChibiSkeletonV2 = getChibiSkeleton(pose, facing);

  const is3QLeft = facing === 'three_quarter_left';
  const is3QRight = facing === 'three_quarter_right';
  const isSideLeft = facing === 'side_left';
  const isSideRight = facing === 'side_right';
  const isSide = isSideLeft || isSideRight;
  const isLeft = is3QLeft || isSideLeft;
  const isFront = facing === 'front';
  const flipX = isLeft ? -1 : 1;

  const ink = '#191918';
  const skin = char.skinColor || '#ffdfc4';
  const hairCol = char.hair?.color || '#343536';
  const hairHi = char.hair?.highlight || '#5a5b5c';
  const outfit = char.outfit || DEFAULT_CHIBI_IDENTITY.outfit;
  const topCol = outfit.topColor || '#d64a33';
  const topCol2 = outfit.topColor2 || '#b83822';
  const pantsCol = outfit.pantsColor || '#2e384d';
  const shoeCol = outfit.shoeColor || '#1e1e24';
  const headScale = char.proportions?.headScale || 1.0;
  const r = 36 * headScale;

  // 1. Shadow under feet
  const renderShadow = () => (
    <ellipse cx="0" cy="2" rx={(isFront ? 34 : 30) * scale} ry={6 * scale} fill="rgba(0,0,0,0.22)" />
  );

  // 2. Neck
  const renderNeck = () => {
    const [, headY] = skel.head;
    const [, shY] = skel.sh;
    const neckX = isFront ? 0 : 1;
    const neckW = isFront ? 8 : 7;

    return (
      <g id="chibi-neck">
        <path
          d={`M ${neckX - neckW} ${headY + 28} L ${neckX + neckW} ${headY + 28} L ${neckX + neckW + 2} ${shY + 2} L ${neckX - neckW - 2} ${shY + 2} Z`}
          fill={skin}
          stroke={ink}
          strokeWidth="3"
        />
        <ellipse cx={neckX} cy={headY + 31} rx={neckW} ry="3" fill="rgba(0,0,0,0.12)" />
      </g>
    );
  };

  // 3. Head & Facial Features
  const renderHead = () => {
    const [hx, hy] = skel.head;
    const eyeY = 2; // Positioned slightly lower for cute anime/chibi ratio
    const eyeX = isFront ? [-14, 14] : isSide ? [16] : [-5, 18];

    return (
      <g id="chibi-head-group" transform={`translate(${hx} ${hy})`}>
        {/* Layer 1: Back Hair */}
        {renderBackHair(r)}

        {/* Layer 2: Head Skull Contour with Cheeks & Tapered Chin */}
        {isFront ? (
          <>
            <path
              d="M 0 -36 C 23 -36, 37 -22, 37 -4 C 37 12, 38 19, 31 29 C 24 37, 10 38, 0 38 C -10 38, -24 37, -31 29 C -38 19, -37 12, -37 -4 C -37 -22, -23 -36, 0 -36 Z"
              fill={skin}
              stroke={ink}
              strokeWidth="4"
            />
            {/* Ears */}
            <g stroke={ink} strokeWidth="3">
              <path d="M -37 -4 Q -45 2 -36 10" fill={skin} />
              <path d="M 37 -4 Q 45 2 36 10" fill={skin} />
            </g>
          </>
        ) : isSide ? (
          <>
            <path
              d="M 2 -36 C 22 -36, 34 -22, 34 -8 C 34 -2, 36 2, 37 4 C 35 10, 34 16, 28 28 C 22 36, 8 38, -2 36 C -18 32, -32 18, -32 -4 C -32 -22, -18 -36, 2 -36 Z"
              fill={skin}
              stroke={ink}
              strokeWidth="4"
            />
            <path d="M -18 -4 Q -26 2 -18 10" fill={skin} stroke={ink} strokeWidth="3" />
          </>
        ) : (
          <>
            <path
              d="M -2 -36 C 21 -36, 35 -22, 36 -6 C 37 10, 38 18, 33 28 C 26 37, 14 38, 4 38 C -8 38, -22 36, -30 26 C -36 16, -35 8, -34 -4 C -34 -22, -21 -36, -2 -36 Z"
              fill={skin}
              stroke={ink}
              strokeWidth="4"
            />
            <path d="M -34 -4 Q -42 2 -33 10" fill={skin} stroke={ink} strokeWidth="3" />
          </>
        )}

        {/* Layer 3: Face Features */}
        {/* Subtle, cute blush */}
        {char.face?.blush && !blink && (
          <g>
            {isFront ? (
              <>
                <ellipse cx="-16" cy={eyeY + 12} rx="6" ry="3" fill="#fca5a5" opacity="0.4" />
                <ellipse cx="16" cy={eyeY + 12} rx="6" ry="3" fill="#fca5a5" opacity="0.4" />
              </>
            ) : isSide ? (
              <ellipse cx="18" cy={eyeY + 12} rx="6" ry="3" fill="#fca5a5" opacity="0.4" />
            ) : (
              <>
                <ellipse cx="-5" cy={eyeY + 12} rx="5" ry="3" fill="#fca5a5" opacity="0.4" />
                <ellipse cx="19" cy={eyeY + 12} rx="6" ry="3" fill="#fca5a5" opacity="0.4" />
              </>
            )}
          </g>
        )}

        {/* Eyes (Crisp ink cartoon, single specular highlight) */}
        {blink || expr === 'sad' ? (
          <g stroke={ink} strokeWidth="3.5" strokeLinecap="round" fill="none">
            {eyeX.map((ex, i) => (
              <path key={i} d={`M ${ex - 5} ${eyeY + 2} Q ${ex} ${eyeY + 5} ${ex + 5} ${eyeY + 2}`} />
            ))}
          </g>
        ) : expr === 'happy' || expr === 'laughing' ? (
          <g stroke={ink} strokeWidth="3.8" strokeLinecap="round" fill="none">
            {eyeX.map((ex, i) => (
              <path key={i} d={`M ${ex - 6} ${eyeY + 3} Q ${ex} ${eyeY - 4} ${ex + 6} ${eyeY + 3}`} />
            ))}
          </g>
        ) : (
          eyeX.map((ex, i) => {
            const rx = !isFront && i === 0 ? 4.6 : 5.4;
            const ry = 7.2;
            const lookDx = (look[0] || 0) * 1.5;
            const lookDy = (look[1] || 0) * 1.5;

            return (
              <g key={i}>
                <ellipse cx={ex + lookDx} cy={eyeY + lookDy} rx={rx} ry={ry} fill={ink} />
                <circle cx={ex + lookDx + 1.8} cy={eyeY + lookDy - 2.2} r="2.2" fill="#ffffff" />
              </g>
            );
          })
        )}

        {/* Eyebrows */}
        {renderEyebrows(eyeX, eyeY)}

        {/* Nose */}
        {!isFront && (
          <path
            d={`M ${isSide ? 25 : 10} 5 Q ${isSide ? 27 : 12} 7 ${isSide ? 25 : 10} 9`}
            stroke={ink}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* Mouth */}
        {renderMouth(eyeY)}

        {/* Layer 4: Front Hair & Bangs */}
        {renderFrontHair(r)}

        {/* Glasses / Accessories */}
        {outfit.accessories?.includes('glasses') && (
          <g stroke={ink} strokeWidth="2.5" fill="none">
            {eyeX.map((ex, i) => (
              <circle key={i} cx={ex} cy={eyeY} r="9" />
            ))}
            {eyeX.length > 1 && (
              <line x1={eyeX[0] + 9} y1={eyeY} x2={eyeX[1] - 9} y2={eyeY} />
            )}
          </g>
        )}

        {/* Headwear */}
        {renderHeadwear(r)}
      </g>
    );
  };

  const renderEyebrows = (eyeX: number[], eyeY: number) => {
    let dy = 0;
    if (expr === 'worried') dy = -2;
    if (expr === 'angry') dy = 3;
    if (expr === 'surprised' || expr === 'confused') dy = -3.5;

    return (
      <g stroke={ink} strokeWidth="2.8" strokeLinecap="round" fill="none">
        {eyeX.map((ex, i) => (
          <path
            key={i}
            d={`M ${ex - 6} ${eyeY - 10 + dy} Q ${ex} ${eyeY - 12 + dy} ${ex + 6} ${eyeY - 10 - dy}`}
          />
        ))}
      </g>
    );
  };

  const renderMouth = (eyeY: number) => {
    const mx = isFront ? 0 : isSide ? 14 : 7;
    const my = eyeY + 18;

    if (talk > 0.1 || expr === 'laughing') {
      const openH = 3 + talk * 7 + (expr === 'laughing' ? 4 : 0);
      return (
        <g>
          <ellipse cx={mx} cy={my} rx="5.5" ry={openH} fill={ink} />
          <path d={`M ${mx - 4} ${my} Q ${mx} ${my + openH - 1} ${mx + 4} ${my}`} fill="#f87171" />
        </g>
      );
    }

    if (expr === 'sad') {
      return (
        <path
          d={`M ${mx - 5} ${my + 2} Q ${mx} ${my - 2} ${mx + 5} ${my + 2}`}
          stroke={ink}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      );
    }

    return (
      <path
        d={`M ${mx - 5} ${my - 1} Q ${mx} ${my + 4} ${mx + 5} ${my - 1}`}
        stroke={ink}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    );
  };

  const renderBackHair = (r: number) => {
    const style = char.hair?.style || 'short';
    if (style === 'ponytail') {
      if (isFront) {
        return (
          <g>
            <path
              d="M 12 -28 Q 38 -36 34 8 Q 28 4 18 -10"
              stroke={hairCol}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="16" cy="-24" r="5" fill="#f43f5e" />
          </g>
        );
      }
      return (
        <g>
          <path
            d={`M ${-r * 0.4} ${-r * 0.3} Q ${-r * 1.5} ${-r * 0.2} ${-r * 1.2} ${r * 0.8}`}
            stroke={hairCol}
            strokeWidth="20"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx={-r * 0.4} cy={-r * 0.3} r="5.5" fill="#f43f5e" />
        </g>
      );
    }
    if (style === 'bun') {
      return (
        <circle cx={-r * 0.65} cy={-r * 0.7} r="17" fill={hairCol} stroke={ink} strokeWidth="4" />
      );
    }
    return null;
  };

  const renderFrontHair = (r: number) => {
    const style = char.hair?.style || 'short';
    if (style === 'spiky') {
      if (isFront) {
        return (
          <path
            d="M -39 -2 C -40 -26, -24 -42, 0 -42 C 24 -42, 40 -26, 39 -2 L 34 16 L 31 -2 L 24 -6 L 18 4 L 12 -8 L 4 4 L -4 -6 L -12 4 L -18 -8 L -24 -4 L -31 -2 L -34 16 Z"
            fill={hairCol}
            stroke={ink}
            strokeWidth="3.8"
          />
        );
      }
      return (
        <path
          d="M -36 -4 C -37 -28, -20 -42, 4 -42 C 28 -42, 40 -26, 38 -4 L 33 16 L 28 -2 L 20 -8 L 12 4 L 2 -8 L -6 4 L -14 -8 L -24 -2 L -32 15 Z"
          fill={hairCol}
          stroke={ink}
          strokeWidth="3.8"
        />
      );
    }

    if (style === 'ponytail' || style === 'long') {
      if (isFront) {
        return (
          <g>
            <path
              d="M -39 -2 C -40 -24, -26 -40, 0 -40 C 26 -40, 40 -24, 39 -2 C 38 8, 36 22, 33 26 C 32 18, 31 4, 28 -4 C 22 -6, 16 0, 8 -6 C 2 -10, -2 -10, -8 -6 C -16 0, -22 -6, -28 -4 C -31 4, -32 18, -33 26 C -36 22, -38 8, -39 -2 Z"
              fill={hairCol}
              stroke={ink}
              strokeWidth="3.8"
            />
            <path
              d="M -22 -32 Q 0 -36 22 -32"
              stroke={hairHi}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              opacity="0.6"
            />
          </g>
        );
      }
      return (
        <path
          d="M -36 -4 C -37 -26, -22 -40, 2 -40 C 26 -40, 39 -24, 38 -4 C 37 8, 35 22, 32 26 C 30 16, 29 2, 24 -4 C 18 -6, 12 0, 4 -6 C -6 0, -18 -6, -26 -4 C -28 4, -30 18, -32 25 Z"
          fill={hairCol}
          stroke={ink}
          strokeWidth="3.8"
        />
      );
    }

    // Default short / neat bangs (Max / Jake)
    if (isFront) {
      return (
        <g>
          <path
            d="M -39 -2 C -40 -24, -26 -40, 0 -40 C 26 -40, 40 -24, 39 -2 C 38 6, 36 14, 34 16 C 33 11, 33 2, 31 -4 L 26 -2 L 18 -10 L 10 2 L 3 -6 L -4 2 L -12 -8 L -20 -1 L -26 -7 C -31 0, -32 9, -34 16 C -36 12, -38 4, -39 -2 Z"
            fill={hairCol}
            stroke={ink}
            strokeWidth="3.8"
          />
          <path
            d="M -22 -32 Q 0 -36 22 -32"
            stroke={hairHi}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
        </g>
      );
    } else if (isSide) {
      return (
        <g>
          <path
            d="M -34 -4 C -34 -26, -18 -40, 4 -40 C 24 -40, 36 -26, 36 -6 C 34 2, 32 10, 24 6 C 22 -2, 16 -6, 12 -2 L 4 -12 L -6 -2 C -14 -6, -20 4, -22 14 C -26 10, -32 4, -34 -4 Z"
            fill={hairCol}
            stroke={ink}
            strokeWidth="3.8"
          />
          <path
            d="M -16 -32 Q 4 -36 20 -32"
            stroke={hairHi}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
        </g>
      );
    }

    // 3/4 view
    return (
      <g>
        <path
          d="M -36 -4 C -37 -26, -22 -40, 2 -40 C 26 -40, 39 -24, 38 -4 C 37 8, 35 15, 33 16 C 31 10, 30 2, 26 -4 L 20 -2 L 12 -10 L 4 2 L -3 -8 L -12 2 L -20 -8 C -26 -1, -29 8, -32 15 C -34 10, -36 2, -36 -4 Z"
          fill={hairCol}
          stroke={ink}
          strokeWidth="3.8"
        />
        <path
          d="M -18 -32 Q 2 -36 22 -32"
          stroke={hairHi}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
      </g>
    );
  };

  const renderHeadwear = (r: number) => {
    const hw = outfit.headwear || 'none';
    const hwCol = outfit.headwearColor || '#f2c21a';

    if (hw === 'cap' || hw === 'capBack') {
      const isBack = hw === 'capBack';
      const dir = isBack ? -1 : 1;
      return (
        <g>
          <ellipse cx="0" cy={-r * 0.35} rx={r * 1.05} ry={r * 0.8} fill={hwCol} stroke={ink} strokeWidth="4" />
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

  // 4. Torso & Outfits
  const renderTorso = () => {
    const [, sy] = skel.sh;
    const [, hy] = skel.hip;
    const torsoBotY = outfit.type === 'labcoat' ? hy + 12 : hy;

    return (
      <g id="chibi-torso-group">
        {isFront ? (
          <>
            <path
              d={`M -23 ${sy} Q 0 ${sy - 6} 23 ${sy} L 19 ${torsoBotY} Q 0 ${torsoBotY + 3} -19 ${torsoBotY} Z`}
              fill={topCol}
              stroke={ink}
              strokeWidth="4"
            />
            <path d={`M -11 ${sy - 1} Q 0 ${sy + 6} 11 ${sy - 1}`} stroke={ink} strokeWidth="3.5" fill="none" />

            {outfit.type === 'hoodie' && (
              <g>
                <path
                  d={`M -12 ${hy - 14} L 12 ${hy - 14} L 14 ${hy - 2} L -14 ${hy - 2} Z`}
                  fill={topCol2}
                  stroke={ink}
                  strokeWidth="2.5"
                />
                <line x1="-4" y1={sy + 3} x2="-4" y2={sy + 16} stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
                <line x1="4" y1={sy + 3} x2="4" y2={sy + 16} stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
              </g>
            )}

            {outfit.type === 'labcoat' && (
              <g>
                <line x1="0" y1={sy + 6} x2="0" y2={torsoBotY} stroke={ink} strokeWidth="2.5" />
                <polygon points={`-9,${sy + 6} 0,${sy + 16} 0,${sy + 6}`} fill="#e2e8f0" stroke={ink} strokeWidth="2" />
                <polygon points={`9,${sy + 6} 0,${sy + 16} 0,${sy + 6}`} fill="#e2e8f0" stroke={ink} strokeWidth="2" />
                <rect x="-14" y={sy + 18} width="7" height="9" rx="1" fill="#f8fafc" stroke={ink} strokeWidth="1.8" />
                <line x1="-10" y1={sy + 15} x2="-10" y2={sy + 20} stroke="#2563eb" strokeWidth="2" />
                <polygon points={`-2,${sy + 10} 2,${sy + 10} 3,${sy + 22} 0,${sy + 25} -3,${sy + 22}`} fill="#dc2626" />
              </g>
            )}

            {outfit.type === 'suit' && (
              <g>
                <line x1="0" y1={sy + 16} x2="0" y2={hy} stroke={ink} strokeWidth="2.5" />
                <polygon points={`-10,${sy + 4} 0,${sy + 18} -6,${sy + 18}`} fill="#1e293b" stroke={ink} strokeWidth="2" />
                <polygon points={`10,${sy + 4} 0,${sy + 18} 6,${sy + 18}`} fill="#1e293b" stroke={ink} strokeWidth="2" />
                <polygon points={`-3,${sy + 6} 3,${sy + 6} 4,${sy + 20} 0,${sy + 23} -4,${sy + 20}`} fill={topCol2} />
              </g>
            )}
          </>
        ) : isSide ? (
          <>
            <path
              d={`M -13 ${sy} Q 2 ${sy - 5} 15 ${sy} L 13 ${torsoBotY} Q 0 ${torsoBotY + 3} -11 ${torsoBotY} Z`}
              fill={topCol}
              stroke={ink}
              strokeWidth="4"
            />
            <path d={`M -6 ${sy - 1} Q 2 ${sy + 5} 10 ${sy - 1}`} stroke={ink} strokeWidth="3.5" fill="none" />
          </>
        ) : (
          <>
            <path
              d={`M -18 ${sy} Q 2 ${sy - 6} 20 ${sy} L 17 ${torsoBotY} Q 0 ${torsoBotY + 3} -16 ${torsoBotY} Z`}
              fill={topCol}
              stroke={ink}
              strokeWidth="4"
            />
            <path d={`M -9 ${sy - 1} Q 1 ${sy + 6} 11 ${sy - 1}`} stroke={ink} strokeWidth="3.5" fill="none" />

            {outfit.type === 'hoodie' && (
              <g>
                <path
                  d={`M -10 ${hy - 14} L 12 ${hy - 14} L 14 ${hy - 2} L -11 ${hy - 2} Z`}
                  fill={topCol2}
                  stroke={ink}
                  strokeWidth="2.5"
                />
                <line x1="-1" y1={sy + 3} x2="-1" y2={sy + 16} stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
                <line x1="6" y1={sy + 3} x2="6" y2={sy + 16} stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
              </g>
            )}

            {outfit.type === 'labcoat' && (
              <g>
                <line x1="2" y1={sy + 6} x2="3" y2={torsoBotY} stroke={ink} strokeWidth="2.5" />
                <polygon points={`-6,${sy + 6} 2,${sy + 16} 2,${sy + 6}`} fill="#e2e8f0" stroke={ink} strokeWidth="2" />
                <polygon points={`10,${sy + 6} 2,${sy + 16} 2,${sy + 6}`} fill="#e2e8f0" stroke={ink} strokeWidth="2" />
                <rect x="-12" y={sy + 18} width="7" height="9" rx="1" fill="#f8fafc" stroke={ink} strokeWidth="1.8" />
                <line x1="-9" y1={sy + 15} x2="-9" y2={sy + 20} stroke="#2563eb" strokeWidth="2" />
                <polygon points={`0,${sy + 10} 4,${sy + 10} 5,${sy + 22} 2,${sy + 25} -1,${sy + 22}`} fill="#dc2626" />
              </g>
            )}
          </>
        )}
      </g>
    );
  };

  // 5. Lower Body & Shoes (Modular Anatomical System)
  const renderShoe = (
    x: number,
    y: number,
    st: 'sneakers' | 'casual' | 'boots',
    sc: string,
    isLeftFoot: boolean,
    footAngle: number = 0,
    isGrounded: boolean = true
  ) => {
    // When grounded (on floor y=0), keep sole strictly flat against ground y=0, no tilt!
    const rot = isGrounded ? 0 : footAngle;

    if (st === 'boots') {
      const bootW = isFront ? 22 : 24;
      const xOff = isFront ? (isLeftFoot ? -9 : -12) : -11;
      return (
        <g transform={`translate(${x} ${y}) rotate(${rot})`}>
          {/* 1. Lug sole (flat at y=0) */}
          <path d={`M ${xOff} -4 L ${xOff + bootW} -4 L ${xOff + bootW} 0 L ${xOff} 0 Z`} fill="#0f172a" stroke={ink} strokeWidth="2" />
          <line x1={xOff + 5} y1="-2" x2={xOff + 5} y2="0" stroke="#334155" strokeWidth="1.8" />
          <line x1={xOff + 11} y1="-2" x2={xOff + 11} y2="0" stroke="#334155" strokeWidth="1.8" />
          <line x1={xOff + 17} y1="-2" x2={xOff + 17} y2="0" stroke="#334155" strokeWidth="1.8" />
          {/* 2. Boot body & shaft */}
          <path d={`M ${xOff + 2} -14 L ${xOff + 18} -14 L ${xOff + 19} -7 Q ${xOff + bootW} -6 ${xOff + bootW} -4 L ${xOff} -4 Z`} fill={sc} stroke={ink} strokeWidth="2.5" />
          {/* 3. Cuff rim */}
          <rect x={xOff + 1} y="-16" width="18" height="3" rx="1" fill="#334155" stroke={ink} strokeWidth="1.8" />
        </g>
      );
    }

    if (st === 'casual') {
      const shoeW = isFront ? 21 : 23;
      const xOff = isFront ? (isLeftFoot ? -9 : -12) : -10;
      return (
        <g transform={`translate(${x} ${y}) rotate(${rot})`}>
          {/* 1. Slim dark sole */}
          <path d={`M ${xOff} -2.2 L ${xOff + shoeW} -2.2 L ${xOff + shoeW} 0 L ${xOff} 0 Z`} fill="#0f172a" stroke={ink} strokeWidth="1.8" />
          {/* 2. Sleek shoe upper */}
          <path d={`M ${xOff + 1} -7 Q ${xOff + 8} -8 ${xOff + 15} -7 Q ${xOff + shoeW} -6 ${xOff + shoeW} -2.2 L ${xOff} -2.2 Z`} fill={sc} stroke={ink} strokeWidth="2.2" />
          {/* 3. Low-cut collar scoop */}
          <path d={`M ${xOff + 4} -7 Q ${xOff + 9} -5 ${xOff + 14} -7`} stroke={ink} strokeWidth="1.8" fill="none" />
          {/* 4. Subtle leather shine */}
          <path d={`M ${xOff + 13} -5.5 Q ${xOff + 17} -4.5 ${xOff + 18} -3.5`} stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.45} />
        </g>
      );
    }

    // Default: Sneakers
    const shoeW = isFront ? 23 : 25;
    const xOff = isFront ? (isLeftFoot ? -9 : -13) : -11;
    return (
      <g transform={`translate(${x} ${y}) rotate(${rot})`}>
        {/* 1. Thick white rubber sole */}
        <path d={`M ${xOff} -3.5 L ${xOff + shoeW} -3.5 L ${xOff + shoeW} 0 L ${xOff} 0 Z`} fill="#ffffff" stroke={ink} strokeWidth="2" />
        <line x1={xOff + 1} y1="-1.6" x2={xOff + shoeW - 1} y2="-1.6" stroke={ink} strokeWidth="1" opacity={0.3} />
        {/* 2. Sneaker body */}
        <path d={`M ${xOff + 1} -8 Q ${xOff + 8} -9 ${xOff + 16} -8 Q ${xOff + shoeW} -7 ${xOff + shoeW} -3.5 L ${xOff} -3.5 Z`} fill={sc} stroke={ink} strokeWidth="2.4" />
        {/* 3. White rubber toe bumper */}
        <path d={`M ${xOff + shoeW - 6} -3.5 Q ${xOff + shoeW - 4} -6 ${xOff + shoeW} -4 Q ${xOff + shoeW} -3.5 ${xOff + shoeW} -3.5 Z`} fill="#ffffff" stroke={ink} strokeWidth="1.8" />
        {/* 4. Collar opening where ankle enters */}
        <ellipse cx={xOff + 8} cy="-8" rx="6" ry="2" fill="#334155" stroke={ink} strokeWidth="1.8" />
        {/* 5. White sneaker laces */}
        <line x1={xOff + 10} y1="-7" x2={xOff + 15} y2="-5.5" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        <line x1={xOff + 11} y1="-5.2" x2={xOff + 16} y2="-3.8" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    );
  };

  const renderLowerBody = () => {
    const bType = outfit.bottomType || (outfit.type === 'dress' ? 'skirt' : 'pants');
    const sType = outfit.shoeType || (outfit.type === 'suit' ? 'casual' : outfit.type === 'explorer' ? 'boots' : 'sneakers');
    const [, hy] = skel.hip;

    const isFarLegGrounded = skel.fFar[1] === 0;
    const isNearLegGrounded = skel.fNear[1] === 0;
    const farFootAngle = skel.fFar[1] < 0 ? -12 : (isFront ? -6 : 0);
    const nearFootAngle = skel.fNear[1] < 0 ? -12 : (isFront ? 6 : 0);

    return (
      <g id="chibi-lower-body-group">
        {/* 1. Far Leg (Bone: hipFar -> kFar -> fFar) */}
        {bType === 'pants' ? (
          <g id="chibi-far-leg-pants">
            <line x1={skel.hipFar[0]} y1={skel.hipFar[1]} x2={skel.kFar[0]} y2={skel.kFar[1]} stroke={pantsCol} strokeWidth="14" strokeLinecap="round" />
            <line x1={skel.kFar[0]} y1={skel.kFar[1]} x2={skel.fFar[0]} y2={skel.fFar[1] - 3} stroke={pantsCol} strokeWidth="12" strokeLinecap="round" />
            <circle cx={skel.kFar[0]} cy={skel.kFar[1]} r="6.5" fill={pantsCol} />
            <line x1={skel.fFar[0] - 6} y1={skel.fFar[1] - 5} x2={skel.fFar[0] + 6} y2={skel.fFar[1] - 5} stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ) : (
          <g id="chibi-far-leg-bare">
            <line x1={skel.hipFar[0]} y1={skel.hipFar[1]} x2={skel.kFar[0]} y2={skel.kFar[1]} stroke={skin} strokeWidth="12" strokeLinecap="round" />
            <line x1={skel.kFar[0]} y1={skel.kFar[1]} x2={skel.fFar[0]} y2={skel.fFar[1] - 3} stroke={skin} strokeWidth="10.5" strokeLinecap="round" />
            <circle cx={skel.kFar[0]} cy={skel.kFar[1]} r="5.5" fill={skin} />
            <ellipse cx={skel.kFar[0]} cy={skel.kFar[1]} rx="3" ry="1.5" fill="#fca5a5" opacity={0.5} />
          </g>
        )}

        {/* 2. Far Shoe */}
        {renderShoe(skel.fFar[0], skel.fFar[1], sType, shoeCol, false, farFootAngle, isFarLegGrounded)}

        {/* 3. Near Leg (Bone: hipNear -> kNear -> fNear) */}
        {bType === 'pants' ? (
          <g id="chibi-near-leg-pants">
            <line x1={skel.hipNear[0]} y1={skel.hipNear[1]} x2={skel.kNear[0]} y2={skel.kNear[1]} stroke={pantsCol} strokeWidth="14" strokeLinecap="round" />
            <line x1={skel.kNear[0]} y1={skel.kNear[1]} x2={skel.fNear[0]} y2={skel.fNear[1] - 3} stroke={pantsCol} strokeWidth="12" strokeLinecap="round" />
            <circle cx={skel.kNear[0]} cy={skel.kNear[1]} r="6.5" fill={pantsCol} />
            <line x1={skel.fNear[0] - 6} y1={skel.fNear[1] - 5} x2={skel.fNear[0] + 6} y2={skel.fNear[1] - 5} stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ) : (
          <g id="chibi-near-leg-bare">
            <line x1={skel.hipNear[0]} y1={skel.hipNear[1]} x2={skel.kNear[0]} y2={skel.kNear[1]} stroke={skin} strokeWidth="12" strokeLinecap="round" />
            <line x1={skel.kNear[0]} y1={skel.kNear[1]} x2={skel.fNear[0]} y2={skel.fNear[1] - 3} stroke={skin} strokeWidth="10.5" strokeLinecap="round" />
            <circle cx={skel.kNear[0]} cy={skel.kNear[1]} r="5.5" fill={skin} />
            <ellipse cx={skel.kNear[0]} cy={skel.kNear[1]} rx="3" ry="1.5" fill="#fca5a5" opacity={0.5} />
          </g>
        )}

        {/* 4. Near Shoe */}
        {renderShoe(skel.fNear[0], skel.fNear[1], sType, shoeCol, true, nearFootAngle, isNearLegGrounded)}

        {/* 5. Pelvis & Garment (Drawn OVER upper legs so legs naturally emerge from inside/below!) */}
        {bType === 'skirt' || bType === 'dress' ? (
          isFront ? (
            <g id="chibi-skirt-front">
              <path d={`M -18 ${hy} L 18 ${hy} L 25 ${hy + 20} Q 0 ${hy + 24} -25 ${hy + 20} Z`} fill={pantsCol} stroke={ink} strokeWidth="3.5" />
              <path d={`M -7 ${hy + 4} L -9 ${hy + 21}`} stroke={ink} strokeWidth="2" strokeLinecap="round" opacity={0.4} />
              <path d={`M 7 ${hy + 4} L 9 ${hy + 21}`} stroke={ink} strokeWidth="2" strokeLinecap="round" opacity={0.4} />
            </g>
          ) : isSide ? (
            <path d={`M -13 ${hy} L 13 ${hy} L 17 ${hy + 20} Q 0 ${hy + 24} -15 ${hy + 20} Z`} fill={pantsCol} stroke={ink} strokeWidth="3.5" />
          ) : (
            <g id="chibi-skirt-3q">
              <path d={`M -17 ${hy} L 18 ${hy} L 24 ${hy + 20} Q 2 ${hy + 24} -22 ${hy + 20} Z`} fill={pantsCol} stroke={ink} strokeWidth="3.5" />
              <path d={`M 4 ${hy + 4} L 5 ${hy + 21}`} stroke={ink} strokeWidth="2" strokeLinecap="round" opacity={0.4} />
            </g>
          )
        ) : bType === 'shorts' ? (
          isFront ? (
            <g id="chibi-shorts-front">
              <polygon points={`-19,${hy - 4} 19,${hy - 4} 20,${hy + 14} -20,${hy + 14}`} fill={pantsCol} stroke={ink} strokeWidth="3.5" />
              <polygon points={`-5,${hy + 14} 0,${hy + 8} 5,${hy + 14}`} fill={skin} stroke={ink} strokeWidth="2.5" />
              <line x1="-20" y1={hy + 13} x2="-5" y2={hy + 13} stroke={ink} strokeWidth="2" />
              <line x1="5" y1={hy + 13} x2="20" y2={hy + 13} stroke={ink} strokeWidth="2" />
            </g>
          ) : (
            <polygon points={`-16,${hy - 4} 17,${hy - 4} 18,${hy + 14} -15,${hy + 14}`} fill={pantsCol} stroke={ink} strokeWidth="3.5" />
          )
        ) : (
          // Long pants waistband & crotch
          isFront ? (
            <g id="chibi-pants-waist-front">
              <polygon points={`-19,${hy - 4} 19,${hy - 4} 20,${hy + 8} -20,${hy + 8}`} fill={pantsCol} stroke={ink} strokeWidth="3.5" />
              <path d={`M 0 ${hy - 2} L 0 ${hy + 6} Q 0 ${hy + 9} 2 ${hy + 10}`} stroke={ink} strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <line x1="-18" y1={hy - 3} x2="18" y2={hy - 3} stroke={ink} strokeWidth="2" opacity={0.5} />
            </g>
          ) : isSide ? (
            <polygon points={`-12,${hy - 4} 12,${hy - 4} 13,${hy + 8} -11,${hy + 8}`} fill={pantsCol} stroke={ink} strokeWidth="3.5" />
          ) : (
            <g id="chibi-pants-waist-3q">
              <polygon points={`-16,${hy - 4} 18,${hy - 4} 19,${hy + 8} -15,${hy + 8}`} fill={pantsCol} stroke={ink} strokeWidth="3.5" />
              <path d={`M 2 ${hy - 2} L 2 ${hy + 6}`} stroke={ink} strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </g>
          )
        )}
      </g>
    );
  };

  // 6. Arms
  const renderArm = (
    p1: [number, number],
    p2: [number, number],
    p3: [number, number],
    isFar: boolean = false
  ) => {
    return (
      <g>
        {/* Upper segment */}
        <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={topCol} strokeWidth="12" strokeLinecap="round" />
        {/* Lower segment */}
        <line x1={p2[0]} y1={p2[1]} x2={p3[0]} y2={p3[1]} stroke={topCol} strokeWidth="10.5" strokeLinecap="round" />

        {/* Elbow Joint circle */}
        <circle cx={p2[0]} cy={p2[1]} r={5.5} fill={topCol} />

        {/* Hand */}
        <g transform={`translate(${p3[0]} ${p3[1]})`}>
          <circle cx="0" cy="0" r="6" fill={skin} stroke={ink} strokeWidth="2.5" />
          {pose === 'point' && !isFar && (
            <g>
              <line x1="2" y1="-2" x2="10" y2="-2" stroke={skin} strokeWidth="4" strokeLinecap="round" />
              <line x1="2" y1="-2" x2="10" y2="-2" stroke={ink} strokeWidth="2" strokeLinecap="round" />
            </g>
          )}
          {pose === 'wave' && !isFar && (
            <g>
              <circle cx="2" cy="-3" r="3" fill={skin} />
              <line x1="0" y1="-5" x2="2" y2="-8" stroke={ink} strokeWidth="2" strokeLinecap="round" />
              <line x1="3" y1="-4" x2="6" y2="-6" stroke={ink} strokeWidth="2" strokeLinecap="round" />
            </g>
          )}
        </g>
      </g>
    );
  };

  // 7. Props
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

      {/* 2. Far Arm */}
      {renderArm(skel.shFar, skel.eFar, skel.hFar, true)}

      {/* 3. Lower Body (Far leg, Far shoe, Near leg, Near shoe, Pelvis / Garment) */}
      {renderLowerBody()}

      {/* 4. Neck */}
      {renderNeck()}

      {/* 5. Torso & Outfits */}
      {renderTorso()}

      {/* 6. Head & Facial Features */}
      {renderHead()}

      {/* 7. Near Arm (Top layer for natural gestures and waving) */}
      {renderArm(skel.shNear, skel.eNear, skel.hNear, false)}

      {/* 8. Prop with Hand Grip */}
      {renderProp()}
    </g>
  );
};
