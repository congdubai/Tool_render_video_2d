import React from "react";
import { ExpressionType, OutfitConfig } from "../types";

export interface ExpressionDefinition {
  eyes: "dot" | "happy" | "ring" | "wide" | "closed" | "wink";
  brows: "raised" | "worried" | "angry" | "confused" | null;
  mouth: "smallSmile" | "smile" | "grin" | "o" | "oBig" | "flat" | "smallFlat" | "wavy" | "frown" | "smirk" | "open";
  sweat?: boolean;
  tears?: boolean;
  look?: [number, number];
}

export const EXPR: Record<ExpressionType, ExpressionDefinition> = {
  neutral: { eyes: "dot", brows: null, mouth: "smallSmile" },
  happy: { eyes: "happy", brows: null, mouth: "grin" },
  joy: { eyes: "happy", brows: "raised", mouth: "grin" },
  smile: { eyes: "dot", brows: null, mouth: "smile" },
  surprised: { eyes: "ring", brows: "raised", mouth: "o" },
  shocked: { eyes: "wide", brows: "raised", mouth: "oBig" },
  scared: { eyes: "ring", brows: "worried", mouth: "wavy" },
  worried: { eyes: "dot", brows: "worried", mouth: "wavy" },
  nervous: { eyes: "dot", brows: "worried", mouth: "flat", sweat: true },
  angry: { eyes: "dot", brows: "angry", mouth: "flat" },
  determined: { eyes: "dot", brows: "angry", mouth: "smallFlat" },
  sad: { eyes: "dot", brows: "worried", mouth: "frown" },
  cry: { eyes: "closed", brows: "worried", mouth: "frown", tears: true },
  smirk: { eyes: "dot", brows: null, mouth: "smirk" },
  sleepy: { eyes: "closed", brows: null, mouth: "flat" },
  thinking: { eyes: "dot", brows: "raised", mouth: "smallFlat", look: [0.5, -0.6] },
  confused: { eyes: "dot", brows: "confused", mouth: "wavy" },
  awe: { eyes: "wide", brows: "raised", mouth: "o" }
};

interface FaceProps {
  headX: number;
  headY: number;
  radius: number;
  expr?: ExpressionType;
  frame: number;
  isTalking?: boolean;
  outfit?: OutfitConfig;
  facing?: number;
}

export const CharacterFace: React.FC<FaceProps> = ({
  headX,
  headY,
  radius: r,
  expr = "neutral",
  frame,
  isTalking = false,
  outfit,
  facing = 1
}) => {
  const def = EXPR[expr] || EXPR.neutral;
  const col = "#29262b"; // Clean ink color for stickman features

  // Automatic natural blinking cycle: blinks every ~75 frames for 3 frames
  const isBlinking = frame % 75 < 3 || def.eyes === "closed";

  // Facial feature anchor
  const fx = headX + r * 0.32;
  const fy = headY - r * 0.08;
  const look = def.look || [0, 0];

  const eyeXPositions = [fx - r * 0.28, fx + r * 0.30];
  const eyeY = fy - r * 0.08;

  // Mouth talking oscillation
  const talkMouthOpen = isTalking ? Math.abs(Math.sin(frame * 0.75)) > 0.35 : false;

  return (
    <g>
      {/* 1. EYES */}
      {eyeXPositions.map((x, i) => {
        const lx = x + look[0] * 3;
        const ly = eyeY + look[1] * 2.5;

        if (isBlinking) {
          return (
            <line
              key={i}
              x1={x - r * 0.12}
              y1={eyeY}
              x2={x + r * 0.12}
              y2={eyeY}
              stroke={col}
              strokeWidth={r * 0.09}
              strokeLinecap="round"
            />
          );
        }

        switch (def.eyes) {
          case "happy":
            return (
              <path
                key={i}
                d={`M ${x - r * 0.14} ${eyeY + 2} Q ${x} ${eyeY - r * 0.14} ${x + r * 0.14} ${eyeY + 2}`}
                fill="none"
                stroke={col}
                strokeWidth={r * 0.09}
                strokeLinecap="round"
              />
            );

          case "ring":
            return (
              <circle
                key={i}
                cx={x}
                cy={eyeY}
                r={r * 0.16}
                fill="#ffffff"
                stroke={col}
                strokeWidth={r * 0.08}
              />
            );

          case "wide":
            return (
              <g key={i}>
                <ellipse
                  cx={x}
                  cy={eyeY}
                  rx={r * 0.18}
                  ry={r * 0.22}
                  fill="#ffffff"
                  stroke={col}
                  strokeWidth={r * 0.08}
                />
                <circle cx={lx} cy={ly} r={r * 0.09} fill={col} />
                <circle cx={lx + 1.5} cy={ly - 1.5} r={r * 0.035} fill="#ffffff" />
              </g>
            );

          case "dot":
          default:
            return (
              <circle
                key={i}
                cx={lx}
                cy={ly}
                r={r * 0.095}
                fill={col}
              />
            );
        }
      })}

      {/* 2. EYEBROWS */}
      {def.brows && eyeXPositions.map((x, i) => {
        const by = eyeY - r * 0.20;
        let p1y = by;
        let p2y = by;

        if (def.brows === "raised") {
          p1y = by - 3;
          p2y = by - 3;
        } else if (def.brows === "angry") {
          // Tilt inwards down
          p1y = i === 0 ? by - 2 : by + 3;
          p2y = i === 0 ? by + 3 : by - 2;
        } else if (def.brows === "worried") {
          // Tilt inwards up
          p1y = i === 0 ? by + 3 : by - 3;
          p2y = i === 0 ? by - 3 : by + 3;
        } else if (def.brows === "confused") {
          p1y = i === 0 ? by - 4 : by + 2;
          p2y = i === 0 ? by - 2 : by + 3;
        }

        return (
          <line
            key={`brow-${i}`}
            x1={x - r * 0.14}
            y1={p1y}
            x2={x + r * 0.14}
            y2={p2y}
            stroke={col}
            strokeWidth={r * 0.08}
            strokeLinecap="round"
          />
        );
      })}

      {/* 3. MOUTH */}
      {(() => {
        const my = fy + r * 0.24;
        const mx = fx;

        if (talkMouthOpen) {
          return (
            <ellipse
              cx={mx}
              cy={my}
              rx={r * 0.16}
              ry={r * 0.18}
              fill="#be123c"
              stroke={col}
              strokeWidth={r * 0.07}
            />
          );
        }

        switch (def.mouth) {
          case "grin":
            return (
              <path
                d={`M ${mx - r * 0.25} ${my - 2} Q ${mx} ${my + r * 0.25} ${mx + r * 0.25} ${my - 2} Z`}
                fill="#ffffff"
                stroke={col}
                strokeWidth={r * 0.07}
                strokeLinejoin="round"
              />
            );

          case "smile":
            return (
              <path
                d={`M ${mx - r * 0.24} ${my - 2} Q ${mx} ${my + r * 0.18} ${mx + r * 0.24} ${my - 2}`}
                fill="none"
                stroke={col}
                strokeWidth={r * 0.08}
                strokeLinecap="round"
              />
            );

          case "smallSmile":
            return (
              <path
                d={`M ${mx - r * 0.16} ${my} Q ${mx} ${my + r * 0.12} ${mx + r * 0.16} ${my}`}
                fill="none"
                stroke={col}
                strokeWidth={r * 0.08}
                strokeLinecap="round"
              />
            );

          case "o":
            return (
              <circle
                cx={mx}
                cy={my}
                r={r * 0.12}
                fill="#be123c"
                stroke={col}
                strokeWidth={r * 0.07}
              />
            );

          case "oBig":
            return (
              <ellipse
                cx={mx}
                cy={my + 2}
                rx={r * 0.16}
                ry={r * 0.22}
                fill="#be123c"
                stroke={col}
                strokeWidth={r * 0.07}
              />
            );

          case "frown":
            return (
              <path
                d={`M ${mx - r * 0.22} ${my + 4} Q ${mx} ${my - r * 0.14} ${mx + r * 0.22} ${my + 4}`}
                fill="none"
                stroke={col}
                strokeWidth={r * 0.08}
                strokeLinecap="round"
              />
            );

          case "wavy":
            return (
              <path
                d={`M ${mx - r * 0.20} ${my} Q ${mx - r * 0.08} ${my - 4} ${mx} ${my} Q ${mx + r * 0.08} ${my + 4} ${mx + r * 0.20} ${my}`}
                fill="none"
                stroke={col}
                strokeWidth={r * 0.08}
                strokeLinecap="round"
              />
            );

          case "smirk":
            return (
              <path
                d={`M ${mx - r * 0.18} ${my + 2} Q ${mx} ${my + 4} ${mx + r * 0.20} ${my - 5}`}
                fill="none"
                stroke={col}
                strokeWidth={r * 0.08}
                strokeLinecap="round"
              />
            );

          case "open":
            return (
              <path
                d={`M ${mx - r * 0.20} ${my - 3} L ${mx + r * 0.20} ${my - 3} Q ${mx} ${my + r * 0.24} ${mx - r * 0.20} ${my - 3} Z`}
                fill="#be123c"
                stroke={col}
                strokeWidth={r * 0.07}
              />
            );

          case "smallFlat":
            return (
              <line
                x1={mx - r * 0.12}
                y1={my}
                x2={mx + r * 0.12}
                y2={my}
                stroke={col}
                strokeWidth={r * 0.08}
                strokeLinecap="round"
              />
            );

          case "flat":
          default:
            return (
              <line
                x1={mx - r * 0.18}
                y1={my}
                x2={mx + r * 0.18}
                y2={my}
                stroke={col}
                strokeWidth={r * 0.08}
                strokeLinecap="round"
              />
            );
        }
      })()}

      {/* 4. BLUSH CHEEKS */}
      {(expr === "happy" || expr === "joy" || expr === "smile") && (
        <>
          <ellipse
            cx={eyeXPositions[0] - 2}
            cy={fy + r * 0.10}
            rx={r * 0.12}
            ry={r * 0.06}
            fill="rgba(244, 63, 94, 0.35)"
          />
          <ellipse
            cx={eyeXPositions[1] + 2}
            cy={fy + r * 0.10}
            rx={r * 0.12}
            ry={r * 0.06}
            fill="rgba(244, 63, 94, 0.35)"
          />
        </>
      )}

      {/* 5. SWEAT DROP */}
      {def.sweat && (
        <path
          d={`M ${headX - r * 0.55} ${headY - r * 0.35} Q ${headX - r * 0.45} ${headY - r * 0.15} ${headX - r * 0.55} ${headY} Q ${headX - r * 0.65} ${headY - r * 0.15} ${headX - r * 0.55} ${headY - r * 0.35} Z`}
          fill="#38bdf8"
          stroke="#0284c7"
          strokeWidth={1.5}
        />
      )}

      {/* 6. TEARS */}
      {def.tears && (
        <>
          <circle cx={eyeXPositions[0] - 2} cy={eyeY + 8} r={3} fill="#60a5fa" />
          <circle cx={eyeXPositions[1] + 2} cy={eyeY + 8} r={3} fill="#60a5fa" />
        </>
      )}

      {/* 7. GLASSES / SUNGLASSES */}
      {outfit?.face === "glasses" && (
        <g stroke="#334155" strokeWidth={2.4} fill="none">
          <circle cx={eyeXPositions[0]} cy={eyeY} r={r * 0.22} />
          <circle cx={eyeXPositions[1]} cy={eyeY} r={r * 0.22} />
          <line x1={eyeXPositions[0] + r * 0.22} y1={eyeY} x2={eyeXPositions[1] - r * 0.22} y2={eyeY} />
        </g>
      )}

      {outfit?.face === "sunglasses" && (
        <g fill="#0f172a" stroke="#1e293b" strokeWidth={2}>
          <rect
            x={eyeXPositions[0] - r * 0.22}
            y={eyeY - r * 0.18}
            width={r * 0.44}
            height={r * 0.36}
            rx={4}
          />
          <rect
            x={eyeXPositions[1] - r * 0.22}
            y={eyeY - r * 0.18}
            width={r * 0.44}
            height={r * 0.36}
            rx={4}
          />
          <line
            x1={eyeXPositions[0] + r * 0.22}
            y1={eyeY - 2}
            x2={eyeXPositions[1] - r * 0.22}
            y2={eyeY - 2}
            stroke="#0f172a"
            strokeWidth={3}
          />
        </g>
      )}
    </g>
  );
};
