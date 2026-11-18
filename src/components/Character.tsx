import React from "react";
import { spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CharacterConfig, ForegroundConfig } from "../types";

interface CharacterProps {
  character: CharacterConfig | null | undefined;
  foreground?: ForegroundConfig | null | undefined;
  sceneStart: number;
}

export const Character: React.FC<CharacterProps> = ({ character, foreground, sceneStart }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;
  const sceneTime = Math.max(0, currentTime - sceneStart);

  if (!character || !character.image) {
    return null;
  }

  const enterAt = character.enterAt || 0;
  if (sceneTime < enterAt) {
    return null; // Chưa tới thời điểm xuất hiện
  }

  // 1. Hiệu ứng nảy lên (spring có overshoot nhẹ)
  const enterFrame = Math.max(0, (sceneTime - enterAt) * fps);
  const enterProgress = spring({
    frame: enterFrame,
    fps,
    config: {
      damping: 12,
      stiffness: 100,
      mass: 0.8
    }
  });

  // 2. Hiệu ứng nhấp nhô nhẹ (bobbing chu kỳ ~1.2s)
  const isBobbing = character.bob !== false;
  const bobCycleSeconds = 1.2;
  const bobOffsetPx = isBobbing
    ? Math.sin((sceneTime * 2 * Math.PI) / bobCycleSeconds) * 5
    : 0;

  // 3. Tọa độ và kích thước
  const posX = character.x !== undefined ? character.x : 0.5;
  const baseY = character.baseY !== undefined ? character.baseY : 0.8;
  const charHeightRatio = character.height !== undefined ? character.height : 0.5;
  const isFlipped = !!character.flip;

  // Độ dịch Y khi nảy: bắt đầu từ tụt xuống 80px rồi nảy lên vị trí gốc
  const jumpY = (1 - enterProgress) * 80 + bobOffsetPx;
  const scale = Math.max(0, enterProgress);

  const charSrc = character.image && (character.image.startsWith("data:") || character.image.startsWith("http"))
    ? character.image
    : staticFile(character.image);

  return (
    <>
      {/* 4. Bóng đổ mềm hình elip dưới chân */}
      <div
        style={{
          position: "absolute",
          left: `${posX * 100}%`,
          top: `${baseY * 100}%`,
          width: `${charHeightRatio * 55}%`,
          height: "24px",
          transform: `translate(-50%, -50%) scale(${scale * (1 - bobOffsetPx * 0.02)})`,
          opacity: 0.45 * scale,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 70%)",
          pointerEvents: "none",
          zIndex: 10
        }}
      />

      {/* 5. Ảnh nhân vật */}
      <div
        style={{
          position: "absolute",
          left: `${posX * 100}%`,
          top: `${baseY * 100}%`,
          height: `${charHeightRatio * 100}%`,
          transform: `translate(-50%, -100%) translateY(${jumpY}px) scale(${scale}) scaleX(${isFlipped ? -1 : 1})`,
          transformOrigin: "bottom center",
          zIndex: 20,
          pointerEvents: "none"
        }}
      >
        <img
          src={charSrc}
          alt="Character"
          style={{
            height: "100%",
            width: "auto",
            display: "block",
            objectFit: "contain"
          }}
        />
      </div>

      {/* 6. Lớp tiền cảnh (foreground) vẽ đè lên nhân vật */}
      {foreground && foreground.image && (
        <div
          style={{
            position: "absolute",
            left: `${(foreground.x !== undefined ? foreground.x : 0.5) * 100}%`,
            top: `${(foreground.baseY !== undefined ? foreground.baseY : 0.8) * 100}%`,
            height: `${(foreground.height !== undefined ? foreground.height : 0.5) * 100}%`,
            transform: "translate(-50%, -100%)",
            transformOrigin: "bottom center",
            zIndex: 30,
            pointerEvents: "none"
          }}
        >
          <img
            src={
              foreground.image.startsWith("data:") || foreground.image.startsWith("http")
                ? foreground.image
                : staticFile(foreground.image)
            }
            alt="Foreground"
            style={{
              height: "100%",
              width: "auto",
              display: "block",
              objectFit: "contain"
            }}
          />
        </div>
      )}
    </>
  );
};
