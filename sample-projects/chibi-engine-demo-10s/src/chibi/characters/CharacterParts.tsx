import React from 'react';
import { ChibiColors } from './CharacterTypes';

interface PartProps {
  colors: Required<ChibiColors>;
}

export const ChibiShadow: React.FC<{ opacity?: number; scale?: number }> = ({ opacity = 0.18, scale = 1 }) => (
  <ellipse cx="-4" cy="4" rx={74 * scale} ry={12 * scale} fill="#171715" opacity={opacity} />
);

export const ChibiFarLeg: React.FC<PartProps & { angle: number; lift: number; footAngle: number }> = ({
  colors,
  angle,
  lift,
  footAngle,
}) => (
  <g transform={`translate(-17 -87) rotate(${angle})`}>
    <path d="M-20 -4 L16 -4 L24 53 L-10 59 L-23 22Z" fill={colors.pantsFar} stroke={colors.ink} strokeWidth="7" />
    <g transform={`translate(7 ${61 - lift}) rotate(${footAngle}) scale(0.78 0.78)`}>
      <path
        d="M-17 -5 L18 -7 L43 12 Q48 22 32 25 L-23 25 Q-32 23 -31 15Z"
        fill={colors.bootsFar}
        stroke={colors.ink}
        strokeWidth="7"
      />
    </g>
  </g>
);

export const ChibiFarArm: React.FC<PartProps & { angle: number }> = ({ colors, angle }) => (
  <g transform={`translate(-54 -176) rotate(${angle})`}>
    <path
      d="M-5 -2 Q3 -7 9 0 Q15 11 13 28 L9 68 Q5 74 -3 72 L-10 67 Q-12 52 -12 32 L-13 12 Q-12 2 -5 -2Z"
      fill={colors.sleeveFar}
      stroke={colors.ink}
      strokeWidth="6"
    />
    <path
      d="M-4 69 Q3 68 9 66 L10 83 Q7 90 0 90 Q-8 89 -9 82 L-9 71Z"
      fill={colors.skin}
      stroke={colors.ink}
      strokeWidth="4"
    />
  </g>
);

export const ChibiBackpack: React.FC<PartProps> = ({ colors }) => (
  <g id="chibi-backpack">
    <path
      d="M-54 -183 Q-88 -186 -90 -158 L-89 -107 Q-71 -96 -53 -113Z"
      fill={colors.backpack}
      stroke={colors.ink}
      strokeWidth="8"
    />
    <path d="M-72 -166 Q-80 -141 -73 -119" fill="none" stroke={colors.backpackStripe} strokeWidth="8" />
  </g>
);

export const ChibiNearLeg: React.FC<PartProps & { angle: number; lift: number; footAngle: number }> = ({
  colors,
  angle,
  lift,
  footAngle,
}) => (
  <g transform={`translate(17 -87) rotate(${angle})`}>
    <path d="M-18 -4 L20 -4 L24 54 L-13 60 L-23 24Z" fill={colors.pantsNear} stroke={colors.ink} strokeWidth="7" />
    <g transform={`translate(7 ${62 - lift}) rotate(${footAngle}) scale(0.78 0.78)`}>
      <path
        d="M-17 -5 L18 -7 L45 12 Q49 22 33 25 L-24 25 Q-33 23 -32 15Z"
        fill={colors.boots}
        stroke={colors.ink}
        strokeWidth="7"
      />
    </g>
  </g>
);

export const ChibiTorso: React.FC<PartProps & { showBackpack?: boolean }> = ({ colors, showBackpack = true }) => (
  <g id="chibi-torso-body">
    {/* Thân áo chính */}
    <path d="M-48 -189 Q-11 -207 35 -187 L50 -91 Q-2 -73 -48 -92Z" fill={colors.jacket} stroke={colors.ink} strokeWidth="9" />
    {/* Đường may áo */}
    <path d="M-30 -185 Q-22 -144 -27 -98" stroke={colors.jacketSeam} strokeWidth="7" fill="none" />
    <path d="M-22 -152 L41 -140 M-20 -113 L43 -111" stroke={colors.jacketSeam} strokeWidth="7" fill="none" />
    {/* Túi áo ngực */}
    <path d="M7 -146 L34 -141 L34 -108 L7 -109Z" fill={colors.pocket} stroke={colors.ink} strokeWidth="5" />
    {/* Dây đeo balo ôm vai theo phối cảnh 3/4 */}
    {showBackpack && (
      <>
        <path d="M-37 -183 Q-20 -172 -19 -149 L-18 -115" fill="none" stroke={colors.ink} strokeWidth="13" />
        <path d="M-37 -183 Q-20 -172 -19 -149 L-18 -115" fill="none" stroke={colors.backpackStrap} strokeWidth="7" />
      </>
    )}
  </g>
);

export const ChibiNearArm: React.FC<PartProps & { angle: number }> = ({ colors, angle }) => (
  <g transform={`translate(34 -180) rotate(${angle})`}>
    <path d="M-12 -5 L18 -4 L18 51 L-8 56 L-21 14Z" fill={colors.sleeveNear} stroke={colors.ink} strokeWidth="7" />
    <path d="M-8 52 L17 50 L18 67 Q7 80 -8 70Z" fill={colors.skin} stroke={colors.ink} strokeWidth="6" />
  </g>
);

export const ChibiHead: React.FC<
  PartProps & { angle: number; blink: boolean; mouthOpen: number }
> = ({ colors, angle, blink, mouthOpen }) => (
  <g transform={`translate(1 -201) rotate(${angle})`}>
    {/* Khối đầu tròn Chibi 3/4 */}
    <path
      d="M-58 -99 Q-79 -56 -56 -16 Q-27 24 27 11 Q79 -2 83 -52 Q82 -99 38 -112 Q-13 -131 -58 -99Z"
      fill={colors.skin}
      stroke={colors.ink}
      strokeWidth="9"
    />
    {/* Mắt Chibi dạng Oval đen */}
    {blink ? (
      <g stroke={colors.ink} strokeWidth="6">
        <path d="M19 -54 L35 -54 M54 -53 L69 -53" />
      </g>
    ) : (
      <g fill={colors.ink}>
        <ellipse cx="28" cy="-53" rx="7" ry="17" />
        <ellipse cx="62" cy="-51" rx="7" ry="17" />
      </g>
    )}
    {/* Miệng: biểu cảm bình thường hoặc cử động khi nói */}
    {mouthOpen > 0.25 ? (
      <path
        d={`M62 -16 Q73 ${-16 + mouthOpen * 14} 82 -15 Q73 -21 62 -16Z`}
        fill={colors.ink}
        stroke={colors.ink}
        strokeWidth="3"
      />
    ) : (
      <path d="M65 -14 Q74 -9 80 -15" stroke={colors.ink} strokeWidth="4" fill="none" />
    )}
    {/* Tóc / Mũ bảo hộ */}
    <path
      d="M-66 -81 Q-69 -159 -3 -163 Q64 -166 77 -91 L75 -72 Q5 -85 -68 -71Z"
      fill={colors.hair}
      stroke={colors.ink}
      strokeWidth="9"
    />
    <path
      d="M-87 -76 Q-15 -101 91 -76 Q91 -58 53 -53 L-69 -58 Q-87 -61 -87 -76Z"
      fill={colors.hair}
      stroke={colors.ink}
      strokeWidth="8"
    />
    <path d="M-40 -141 Q-1 -159 36 -138" fill="none" stroke={colors.hairHighlight} strokeWidth="5" opacity="0.5" />
  </g>
);
