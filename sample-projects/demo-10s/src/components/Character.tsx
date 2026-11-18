import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface CharacterProps {
  x?: number;
  y?: number;
  scale?: number;
  flipX?: boolean;
  action?: "idle" | "walk" | "surprise" | "wave" | "bounce";
  emotion?: "happy" | "surprised" | "neutral";
  showShadow?: boolean;
  color?: string;
  subLabel?: string;
}

export const Character: React.FC<CharacterProps> = ({
  x = 0,
  y = 0,
  scale = 1,
  flipX = false,
  action = "idle",
  emotion = "neutral",
  showShadow = true,
  color = "#38bdf8",
  subLabel
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. Squash & Stretch khi Bounce / Xuất hiện
  const bounceSpring = spring({
    frame,
    fps,
    config: { damping: 10, mass: 0.6, stiffness: 120 }
  });

  // 2. Chuyển động chu kỳ đi bộ (Walk Cycle)
  const walkSpeed = 0.25;
  const isWalking = action === "walk";
  const legAngle = isWalking ? Math.sin(frame * walkSpeed) * 28 : 0;
  const armAngle = isWalking ? -Math.sin(frame * walkSpeed) * 32 : 0;
  const bodyBob = isWalking ? Math.abs(Math.sin(frame * walkSpeed * 2)) * 12 : Math.sin(frame * 0.08) * 4;

  // 3. Biểu cảm ngạc nhiên (Surprise)
  const isSurprise = action === "surprise" || emotion === "surprised";
  const surpriseScale = isSurprise
    ? 1 + spring({ frame: frame % 60, fps, config: { damping: 8, stiffness: 150 } }) * 0.12
    : 1;

  // 4. Vẫy tay (Wave)
  const isWaving = action === "wave";
  const waveAngle = isWaving ? Math.sin(frame * 0.4) * 35 - 30 : 0;

  // 5. Mắt chớp (Eye Blinking)
  const blinkCycle = Math.sin(frame * 0.15);
  const eyeHeight = blinkCycle > 0.92 ? 2 : 12;

  // 6. Dynamic Shadow
  const shadowScale = isWalking ? 1 - (bodyBob / 40) : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y - bodyBob,
        transform: `scale(${scale * surpriseScale}) ${flipX ? "scaleX(-1)" : ""}`,
        transformOrigin: "bottom center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}
    >
      {/* Dynamic Shadow dưới chân */}
      {showShadow && (
        <div
          style={{
            position: "absolute",
            bottom: -15,
            width: 140 * shadowScale,
            height: 24 * shadowScale,
            borderRadius: "50%",
            backgroundColor: "rgba(0, 0, 0, 0.35)",
            filter: "blur(4px)",
            transformOrigin: "center center",
            zIndex: 1
          }}
        />
      )}

      {/* SVG Toàn thân nhân vật 2D Animation */}
      <svg
        width="220"
        height="320"
        viewBox="0 0 220 320"
        style={{ overflow: "visible", zIndex: 2 }}
      >
        {/* Chân trái */}
        <g
          style={{
            transformOrigin: "90px 220px",
            transform: `rotate(${-legAngle}deg)`,
            transition: "transform 0.05s linear"
          }}
        >
          <rect x="80" y="220" width="20" height="75" rx="10" fill="#1e293b" />
          <ellipse cx="85" cy="295" rx="16" ry="10" fill="#0f172a" />
        </g>

        {/* Chân phải */}
        <g
          style={{
            transformOrigin: "130px 220px",
            transform: `rotate(${legAngle}deg)`,
            transition: "transform 0.05s linear"
          }}
        >
          <rect x="120" y="220" width="20" height="75" rx="10" fill="#334155" />
          <ellipse cx="135" cy="295" rx="16" ry="10" fill="#0f172a" />
        </g>

        {/* Tay trái */}
        <g
          style={{
            transformOrigin: "60px 145px",
            transform: `rotate(${-armAngle}deg)`,
            transition: "transform 0.05s linear"
          }}
        >
          <rect x="50" y="140" width="18" height="65" rx="9" fill="#0284c7" />
          <circle cx="59" cy="210" r="11" fill="#fcd34d" />
        </g>

        {/* Thân người (Torso) */}
        <rect
          x="65"
          y="130"
          width="90"
          height="100"
          rx="24"
          fill={color}
          stroke="#0369a1"
          strokeWidth="4"
        />

        {/* Cà vạt / Huy hiệu hoạt hình */}
        <polygon points="105,140 115,140 118,180 110,195 102,180" fill="#ef4444" />

        {/* Tay phải (có vẫy tay hoặc chỉ tay) */}
        <g
          style={{
            transformOrigin: "160px 145px",
            transform: isWaving
              ? `rotate(${waveAngle}deg)`
              : isSurprise
              ? `rotate(-50deg)`
              : `rotate(${armAngle}deg)`,
            transition: "transform 0.05s linear"
          }}
        >
          <rect x="152" y="140" width="18" height="65" rx="9" fill="#0284c7" />
          <circle cx="161" cy="210" r="11" fill="#fcd34d" />
        </g>

        {/* Đầu nhân vật (Head) */}
        <g
          style={{
            transformOrigin: "110px 110px",
            transform: isSurprise ? "rotate(-5deg) scale(1.05)" : "rotate(0deg)"
          }}
        >
          {/* Khuôn mặt */}
          <circle cx="110" cy="80" r="48" fill="#fcd34d" stroke="#f59e0b" strokeWidth="4" />

          {/* Mái tóc */}
          <path
            d="M 62 80 C 62 40, 158 40, 158 80 C 158 55, 120 48, 110 50 C 95 48, 62 55, 62 80 Z"
            fill="#475569"
          />

          {/* Mắt trái */}
          <ellipse
            cx="92"
            cy="76"
            rx={isSurprise ? 8 : 6}
            ry={isSurprise ? 12 : eyeHeight}
            fill="#0f172a"
          />
          <circle cx="94" cy="74" r="2.5" fill="#ffffff" />

          {/* Mắt phải */}
          <ellipse
            cx="128"
            cy="76"
            rx={isSurprise ? 8 : 6}
            ry={isSurprise ? 12 : eyeHeight}
            fill="#0f172a"
          />
          <circle cx="130" cy="74" r="2.5" fill="#ffffff" />

          {/* Lông mày (biểu cảm) */}
          {isSurprise ? (
            <>
              <line x1="84" y1="56" x2="100" y2="52" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
              <line x1="120" y1="52" x2="136" y2="56" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
            </>
          ) : (
            <>
              <line x1="84" y1="62" x2="100" y2="62" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
              <line x1="120" y1="62" x2="136" y2="62" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
            </>
          )}

          {/* Miệng (Mouth) */}
          {isSurprise ? (
            <ellipse cx="110" cy="104" rx="10" ry="14" fill="#be123c" />
          ) : (
            <path
              d="M 98 100 Q 110 114 122 100"
              fill="transparent"
              stroke="#be123c"
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}

          {/* Má hồng (Blush) */}
          <circle cx="78" cy="92" r="7" fill="rgba(244, 63, 94, 0.4)" />
          <circle cx="142" cy="92" r="7" fill="rgba(244, 63, 94, 0.4)" />
        </g>
      </svg>

      {/* Nhãn mô tả phụ (nếu có) */}
      {subLabel && (
        <div
          style={{
            marginTop: 10,
            padding: "4px 14px",
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            color: "#38bdf8",
            fontSize: 18,
            fontWeight: 700,
            borderRadius: 8,
            border: "1px solid rgba(56, 189, 248, 0.4)",
            letterSpacing: 1
          }}
        >
          {subLabel}
        </div>
      )}
    </div>
  );
};

