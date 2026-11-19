import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export interface CameraMove {
  panX?: [number, number] | number;
  panY?: [number, number] | number;
  zoom?: [number, number] | number;
  shake?: number;
  durationInFrames?: number;
}

export interface CameraControllerProps extends CameraMove {
  width?: number;
  height?: number;
  children: React.ReactNode;
}

export const CameraController: React.FC<CameraControllerProps> = ({
  panX = 0,
  panY = 0,
  zoom = 1,
  shake = 0,
  durationInFrames = 300,
  width = 1920,
  height = 1080,
  children
}) => {
  const frame = useCurrentFrame();

  // Interpolate panX
  const currentPanX = Array.isArray(panX)
    ? interpolate(frame, [0, durationInFrames], [panX[0], panX[1]], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp"
      })
    : panX;

  // Interpolate panY
  const currentPanY = Array.isArray(panY)
    ? interpolate(frame, [0, durationInFrames], [panY[0], panY[1]], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp"
      })
    : panY;

  // Interpolate zoom
  const currentZoom = Array.isArray(zoom)
    ? interpolate(frame, [0, durationInFrames], [zoom[0], zoom[1]], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp"
      })
    : zoom;

  // Subtle organic handheld camera movement
  const shakeX = shake > 0 ? Math.sin(frame * 0.08) * shake + Math.cos(frame * 0.17) * (shake * 0.5) : 0;
  const shakeY = shake > 0 ? Math.cos(frame * 0.07) * shake + Math.sin(frame * 0.19) * (shake * 0.5) : 0;

  const totalPanX = currentPanX + shakeX;
  const totalPanY = currentPanY + shakeY;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative"
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transformOrigin: "center center",
          transform: `scale(${currentZoom}) translate(${totalPanX}px, ${totalPanY}px)`,
          willChange: "transform"
        }}
      >
        {children}
      </div>
    </div>
  );
};
