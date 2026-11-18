import React from "react";
import { interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneItem } from "../types";
import { Character } from "./Character";

interface SceneViewProps {
  scene: SceneItem;
  fadeSeconds?: number;
  isFirstScene?: boolean;
}

export const SceneView: React.FC<SceneViewProps> = ({
  scene,
  fadeSeconds = 0.3,
  isFirstScene = false
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Cảnh này hoạt động từ scene.start đến (scene.end + fadeSeconds) để giữ hình dưới lúc cảnh sau mờ dần đè lên
  const activeStart = scene.start;
  const activeEnd = scene.end + fadeSeconds;

  if (currentTime < activeStart || currentTime > activeEnd) {
    return null;
  }

  const duration = Math.max(0.01, scene.end - scene.start);
  const elapsed = Math.max(0, currentTime - scene.start);
  const progress = Math.min(1, elapsed / duration);

  // 1. Chuyển động Camera (Zoom & Pan)
  const zoomConfig = scene.camera?.zoom || [1, 1.08];
  const panConfig = scene.camera?.pan || [0, 0];

  const currentZoom = interpolate(progress, [0, 1], [zoomConfig[0], zoomConfig[1]], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  const currentPanX = interpolate(progress, [0, 1], [0, panConfig[0] * 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  const currentPanY = interpolate(progress, [0, 1], [0, panConfig[1] * 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  // 2. Độ trong suốt Cross-fade
  // Cảnh mới mờ dần hiện lên (opacity từ 0 -> 1 trong fadeSeconds)
  let opacity = 1;
  if (!isFirstScene && fadeSeconds > 0) {
    opacity = interpolate(elapsed, [0, fadeSeconds], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    });
  }

  // Nếu ảnh là dạng Base64 Data URL hoặc link HTTP thì dùng trực tiếp, ngược lại dùng staticFile
  const bgSrc = scene.bg && (scene.bg.startsWith("data:") || scene.bg.startsWith("http"))
    ? scene.bg
    : staticFile(scene.bg);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        opacity,
        overflow: "hidden"
      }}
    >
      {/* Lớp nền ảnh Zoom & Pan */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transform: `scale(${currentZoom}) translate(${currentPanX}px, ${currentPanY}px)`,
          transformOrigin: "center center",
          willChange: "transform"
        }}
      >
        <img
          src={bgSrc}
          alt={scene.id}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block"
          }}
        />
      </div>

      {/* Lớp nhân vật và foreground */}
      <Character
        character={scene.character}
        foreground={scene.foreground}
        sceneStart={scene.start}
      />
    </div>
  );
};
