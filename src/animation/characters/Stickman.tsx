import React from "react";
import { LimbPoint, PoseJoints, ActionType, ExpressionType, OutfitConfig } from "../types";
import { POSES, createSeamlessPath, breathePose, wavingPose } from "./CharacterRig";
import { CharacterFace } from "./CharacterExpressions";

export interface StickmanProps {
  x?: number;
  y?: number;
  scale?: number;
  facing?: 1 | -1;
  pose?: PoseJoints;
  action?: ActionType;
  actionProgress?: number;
  frame?: number;
  fps?: number;
  emotion?: ExpressionType;
  outfit?: OutfitConfig;
  prop?: "flag" | "sword" | "shield" | "scroll" | "torch" | "book" | "phone" | "none";
  isTalking?: boolean;
  opacity?: number;
  headFill?: string;
  inkColor?: string;
  shadow?: boolean;
}

function shadeColor(col: string, percent: number): string {
  if (!col || !col.startsWith("#")) return col;
  const num = parseInt(col.slice(1), 16);
  if (isNaN(num)) return col;
  let r = (num >> 16) + Math.round(255 * percent);
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * percent);
  let b = (num & 0x0000ff) + Math.round(255 * percent);
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export const Stickman: React.FC<StickmanProps> = ({
  x = 0,
  y = 0,
  scale = 1,
  facing = 1,
  pose: customPose,
  action = "idle",
  actionProgress = 0,
  frame = 0,
  fps = 30,
  emotion = "neutral",
  outfit = {},
  prop = "none",
  isTalking = false,
  opacity = 1,
  headFill = "#ffffff",
  inkColor = "#29262b",
  shadow = true
}) => {
  // Resolve base pose
  let p: PoseJoints = customPose || POSES.stand;
  if (!customPose && POSES[action]) {
    p = POSES[action];
  }

  // Apply natural breathing if idle or talk
  if (action === "idle" || action === "talk" || (!customPose && !POSES[action])) {
    p = breathePose(p, frame, 0.08, 3);
  } else if (action === "wave") {
    p = wavingPose(p, frame, 0.35, 18);
  }

  const farInk = shadeColor(inkColor, 0.25);
  const topColor = outfit.color || "#d64a33";
  const darkTopColor = shadeColor(topColor, -0.25);
  const legsColor = outfit.legs || inkColor;
  const farLegsColor = outfit.legs ? shadeColor(outfit.legs, -0.3) : farInk;

  const isLongSleeve = ["hoodie", "suit", "trench", "labcoat", "tunic"].includes(outfit.top || "");
  const isShortSleeve = ["tshirt"].includes(outfit.top || "");
  const hasSleeve = isLongSleeve || isShortSleeve;

  const sleeveFarColor = shadeColor(topColor, -0.3);
  const sleeveNearColor = topColor;

  // Midpoint helpers for sleeves
  const farElbowMid: LimbPoint = [
    p.eB[0] + (p.hB[0] - p.eB[0]) * 0.7,
    p.eB[1] + (p.hB[1] - p.eB[1]) * 0.7
  ];
  const nearElbowMid: LimbPoint = [
    p.eF[0] + (p.hF[0] - p.eF[0]) * 0.72,
    p.eF[1] + (p.hF[1] - p.eF[1]) * 0.72
  ];

  const shortArmMidFar: LimbPoint = [
    p.sh[0] + (p.eB[0] - p.sh[0]) * 0.75,
    p.sh[1] + (p.eB[1] - p.sh[1]) * 0.75
  ];
  const shortArmMidNear: LimbPoint = [
    p.sh[0] + (p.eF[0] - p.sh[0]) * 0.75,
    p.sh[1] + (p.eF[1] - p.sh[1]) * 0.75
  ];

  // Head radius
  const HR = 26;

  // Shadow bobbing factor
  const shadowScale = 1 - Math.abs(p.hip[1] - (-100)) * 0.015;

  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale * facing}, ${scale})`}
      opacity={opacity}
      style={{ willChange: "transform" }}
    >
      {/* 0. GROUND SHADOW */}
      {shadow && (
        <ellipse
          cx={0}
          cy={4}
          rx={38 * Math.max(0.6, shadowScale)}
          ry={7 * Math.max(0.6, shadowScale)}
          fill="rgba(18, 14, 26, 0.22)"
        />
      )}

      {/* 1. FAR LEG */}
      <path
        d={createSeamlessPath([p.hip, p.kB, p.fB, [p.fB[0] + 12, p.fB[1]]])}
        fill="none"
        stroke={farLegsColor}
        strokeWidth={11.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 2. FAR ARM */}
      <path
        d={createSeamlessPath([p.sh, p.eB, p.hB])}
        fill="none"
        stroke={farInk}
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Far Sleeve */}
      {hasSleeve && (
        <path
          d={createSeamlessPath(
            isLongSleeve
              ? [p.sh, p.eB, farElbowMid]
              : [p.sh, shortArmMidFar]
          )}
          fill="none"
          stroke={sleeveFarColor}
          strokeWidth={15.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Far Glove */}
      {outfit.gloves && (
        <circle
          cx={p.hB[0]}
          cy={p.hB[1]}
          r={8.5}
          fill={shadeColor(outfit.gloves, -0.2)}
        />
      )}

      {/* Hair or hood behind head */}
      {outfit.top === "hoodie" && outfit.head !== "hood" && (
        <ellipse
          cx={p.sh[0] - 9}
          cy={p.sh[1] - 6}
          rx={15}
          ry={11}
          transform={`rotate(-18, ${p.sh[0] - 9}, ${p.sh[1] - 6})`}
          fill={darkTopColor}
        />
      )}

      {/* 3. TORSO BODY & SPINE */}
      <path
        d={createSeamlessPath([p.sh, p.hip])}
        fill="none"
        stroke={inkColor}
        strokeWidth={15}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 4. TORSO CLOTHING */}
      {outfit.top && outfit.top !== "none" && (
        <g>
          {/* Main torso body shape */}
          <path
            d={`M ${p.sh[0] - 15} ${p.sh[1] - 1}
                Q ${p.sh[0]} ${p.sh[1] - 10} ${p.sh[0] + 15} ${p.sh[1] - 1}
                L ${p.hip[0] + 14} ${p.hip[1] + (outfit.top === "tshirt" ? 4 : 12)}
                L ${p.hip[0] - 14} ${p.hip[1] + (outfit.top === "tshirt" ? 4 : 12)}
                Z`}
            fill={topColor}
          />

          {/* Hoodie details */}
          {outfit.top === "hoodie" && (
            <g>
              <rect
                x={p.hip[0] - 14}
                y={p.hip[1] + 5}
                width={28}
                height={7}
                rx={2}
                fill={darkTopColor}
              />
              <line
                x1={p.sh[0] + 5}
                y1={p.sh[1] + 2}
                x2={p.sh[0] + 6}
                y2={p.sh[1] + 20}
                stroke={shadeColor(topColor, 0.4)}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </g>
          )}

          {/* Suit / Tie details */}
          {outfit.top === "suit" && (
            <polygon
              points={`
                ${p.sh[0] - 1},${p.sh[1] - 3}
                ${p.sh[0] + 4},${p.sh[1] - 3}
                ${p.sh[0] + 5},${p.sh[1] + 38}
                ${p.sh[0] + 1},${p.sh[1] + 44}
              `}
              fill={outfit.color2 || "#c0392b"}
            />
          )}

          {/* Dress skirt */}
          {outfit.top === "dress" && (
            <polygon
              points={`
                ${p.hip[0] - 14},${p.hip[1] - 6}
                ${p.hip[0] + 14},${p.hip[1] - 6}
                ${p.hip[0] + 32},${p.hip[1] + 48}
                ${p.hip[0] - 32},${p.hip[1] + 48}
              `}
              fill={topColor}
            />
          )}

          {/* Trench / Labcoat tail */}
          {(outfit.top === "trench" || outfit.top === "labcoat") && (
            <polygon
              points={`
                ${p.sh[0] - 4},${p.sh[1] + 36}
                ${p.hip[0] + 24},${p.hip[1] + 44}
                ${p.hip[0] - 22},${p.hip[1] + 44}
              `}
              fill={topColor}
            />
          )}
        </g>
      )}

      {/* 5. NEAR LEG */}
      <path
        d={createSeamlessPath([p.hip, p.kF, p.fF, [p.fF[0] + 13, p.fF[1]]])}
        fill="none"
        stroke={legsColor}
        strokeWidth={12.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 6. NEAR ARM & SHOULDER BRIDGE */}
      {/* Shoulder bridge cap prevents gap between sleeve and torso */}
      {hasSleeve && (
        <circle
          cx={p.sh[0]}
          cy={p.sh[1] + 5}
          r={10}
          fill={sleeveNearColor}
        />
      )}

      <path
        d={createSeamlessPath([p.sh, p.eF, p.hF])}
        fill="none"
        stroke={inkColor}
        strokeWidth={11}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Near Sleeve */}
      {hasSleeve && (
        <path
          d={createSeamlessPath(
            isLongSleeve
              ? [p.sh, p.eF, nearElbowMid]
              : [p.sh, shortArmMidNear]
          )}
          fill="none"
          stroke={sleeveNearColor}
          strokeWidth={16.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Near Glove */}
      {outfit.gloves && (
        <circle
          cx={p.hF[0]}
          cy={p.hF[1]}
          r={9}
          fill={outfit.gloves}
        />
      )}

      {/* 7. HEAD (Stickman Rig V2 round white head) */}
      <circle
        cx={p.head[0]}
        cy={p.head[1]}
        r={HR}
        fill={headFill}
        stroke={inkColor}
        strokeWidth={2.4}
      />

      {/* Headwear / Hair */}
      {outfit.head === "hood" && (
        <g>
          <circle
            cx={p.head[0] - 5}
            cy={p.head[1] + 2}
            r={HR * 1.2}
            fill="none"
            stroke={outfit.headColor || outfit.color || "#d64a33"}
            strokeWidth={5.5}
          />
        </g>
      )}

      {outfit.head === "crown" && (
        <polygon
          points={`
            ${p.head[0] - 18},${p.head[1] - 24}
            ${p.head[0] - 12},${p.head[1] - 38}
            ${p.head[0] - 4},${p.head[1] - 28}
            ${p.head[0] + 4},${p.head[1] - 40}
            ${p.head[0] + 12},${p.head[1] - 28}
            ${p.head[0] + 18},${p.head[1] - 38}
            ${p.head[0] + 18},${p.head[1] - 24}
          `}
          fill="#ffd447"
          stroke="#9e7c00"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      )}

      {outfit.head === "helmet" && (
        <path
          d={`M ${p.head[0] - 28} ${p.head[1] - 5}
              Q ${p.head[0]} ${p.head[1] - 38} ${p.head[0] + 28} ${p.head[1] - 5}
              L ${p.head[0] + 24} ${p.head[1] + 12}
              L ${p.head[0] - 24} ${p.head[1] + 12}
              Z`}
          fill="#7d8799"
          stroke="#414957"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      )}

      {/* 8. FACIAL EXPRESSIONS & BLINK */}
      <CharacterFace
        headX={p.head[0]}
        headY={p.head[1]}
        radius={HR}
        expr={emotion}
        frame={frame}
        isTalking={isTalking}
        outfit={outfit}
        facing={facing}
      />

      {/* 9. PROPS */}
      {prop && prop !== "none" && (
        <g>
          {prop === "sword" && (
            <g transform={`translate(${p.hF[0]}, ${p.hF[1]}) rotate(-35)`}>
              {/* Blade */}
              <polygon
                points="-3,-10 -2,-68 0,-76 2,-68 3,-10"
                fill="#e6ecf5"
                stroke="#637085"
                strokeWidth={1.5}
              />
              {/* Guard */}
              <rect x={-14} y={-10} width={28} height={5} rx={2} fill="#d99b26" stroke="#875c08" strokeWidth={1} />
              {/* Hilt */}
              <rect x={-3} y={-5} width={6} height={16} rx={1} fill="#543719" />
              {/* Pommel */}
              <circle cx={0} cy={13} r={4.5} fill="#d99b26" stroke="#875c08" strokeWidth={1} />
            </g>
          )}

          {prop === "shield" && (
            <g transform={`translate(${p.hB[0] - 8}, ${p.hB[1] - 18})`}>
              <path
                d="M -16 -24 L 16 -24 Q 18 10 0 30 Q -18 10 -16 -24 Z"
                fill="#395c94"
                stroke="#d1a63b"
                strokeWidth={3}
              />
              <path
                d="M -10 -20 L 10 -20 Q 12 8 0 24 Q -12 8 -10 -20 Z"
                fill="#c73c38"
              />
              <polygon points="0,-12 4,-2 12,0 4,2 0,12 -4,2 -12,0 -4,-2" fill="#ffd54f" />
            </g>
          )}

          {prop === "flag" && (
            <g transform={`translate(${p.hF[0]}, ${p.hF[1]})`}>
              {/* Pole */}
              <line x1={0} y1={25} x2={0} y2={-90} stroke="#8a6d45" strokeWidth={4} strokeLinecap="round" />
              <circle cx={0} cy={-90} r={4} fill="#ffd700" />
              {/* Waving flag cloth */}
              <path
                d={`M 0 -85
                    Q 24 ${-88 + Math.sin(frame * 0.2) * 5} 46 -85
                    L 46 -50
                    Q 24 ${-53 - Math.sin(frame * 0.2) * 5} 0 -50
                    Z`}
                fill="#c92a2a"
                stroke="#8a1414"
                strokeWidth={1.5}
              />
              <polygon
                points={`23,${-67 + Math.sin(frame * 0.2) * 2} 26,${-62 + Math.sin(frame * 0.2) * 2} 32,${-62 + Math.sin(frame * 0.2) * 2} 27,${-58 + Math.sin(frame * 0.2) * 2} 29,${-53 + Math.sin(frame * 0.2) * 2} 23,${-56 + Math.sin(frame * 0.2) * 2} 17,${-53 + Math.sin(frame * 0.2) * 2} 19,${-58 + Math.sin(frame * 0.2) * 2} 14,${-62 + Math.sin(frame * 0.2) * 2} 20,${-62 + Math.sin(frame * 0.2) * 2}`}
                fill="#ffd700"
              />
            </g>
          )}

          {prop === "torch" && (
            <g transform={`translate(${p.hF[0]}, ${p.hF[1]})`}>
              <line x1={0} y1={12} x2={2} y2={-28} stroke="#543719" strokeWidth={6} strokeLinecap="round" />
              <rect x={-4} y={-32} width={12} height={8} rx={2} fill="#755a40" />
              {/* Animated flame */}
              <path
                d={`M 2 -32
                    Q ${-4 + Math.sin(frame * 0.5) * 4} -48 2 ${-54 + Math.cos(frame * 0.4) * 4}
                    Q ${8 + Math.cos(frame * 0.5) * 4} -48 2 -32 Z`}
                fill="#ff9800"
              />
              <path
                d={`M 2 -32
                    Q ${0 + Math.sin(frame * 0.6) * 2} -42 2 ${-47 + Math.cos(frame * 0.5) * 2}
                    Q ${4 + Math.cos(frame * 0.6) * 2} -42 2 -32 Z`}
                fill="#ffeb3b"
              />
            </g>
          )}

          {prop === "scroll" && (
            <g transform={`translate(${p.hF[0]}, ${p.hF[1] - 12}) rotate(-10)`}>
              <rect x={-8} y={-16} width={26} height={32} rx={2} fill="#faebd7" stroke="#b09b7f" strokeWidth={1.5} />
              <line x1={-3} y1={-10} x2={13} y2={-10} stroke="#9e896f" strokeWidth={1.5} strokeLinecap="round" />
              <line x1={-3} y1={-4} x2={13} y2={-4} stroke="#9e896f" strokeWidth={1.5} strokeLinecap="round" />
              <line x1={-3} y1={2} x2={13} y2={2} stroke="#9e896f" strokeWidth={1.5} strokeLinecap="round" />
              <line x1={-3} y1={8} x2={8} y2={8} stroke="#9e896f" strokeWidth={1.5} strokeLinecap="round" />
            </g>
          )}

          {prop === "book" && (
            <g transform={`translate(${p.hF[0]}, ${p.hF[1] - 8}) rotate(15)`}>
              <rect x={-10} y={-14} width={24} height={28} rx={2} fill="#802b28" stroke="#421412" strokeWidth={1.5} />
              <rect x={-7} y={-12} width={18} height={24} rx={1} fill="#f4ebd9" />
              <line x1={-4} y1={-6} x2={8} y2={-6} stroke="#b3a58d" strokeWidth={1.5} />
              <line x1={-4} y1={-1} x2={8} y2={-1} stroke="#b3a58d" strokeWidth={1.5} />
              <line x1={-4} y1={4} x2={5} y2={4} stroke="#b3a58d" strokeWidth={1.5} />
            </g>
          )}

          {prop === "phone" && (
            <g transform={`translate(${p.hF[0]}, ${p.hF[1] - 16})`}>
              <rect x={-4} y={-12} width={12} height={24} rx={2.5} fill="#1a1820" stroke="#484454" strokeWidth={1} />
              <rect x={-2} y={-9} width={8} height={18} rx={1} fill="#72b5f2" />
            </g>
          )}
        </g>
      )}
    </g>
  );
};
