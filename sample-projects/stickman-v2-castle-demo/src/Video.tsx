import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import {
  Stickman,
  CastleScene,
  CameraController,
  computeCharacterPose
} from "@animation";

export const Video: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Hero X position: walks in from x=240 to x=460 during frames 0-80, then stays at 460
  const heroX = interpolate(frame, [0, 80], [240, 460], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  // Hero action: walk (0-80), stop & wave (80-180), proud idle (180-300)
  let heroAction: "walk" | "wave" | "idle" = "walk";
  let heroEmotion: "neutral" | "smile" | "happy" = "neutral";
  let heroTalking = false;

  if (frame >= 80 && frame < 180) {
    heroAction = "wave";
    heroEmotion = "smile";
    heroTalking = frame >= 100 && frame < 170;
  } else if (frame >= 180) {
    heroAction = "idle";
    heroEmotion = "happy";
    heroTalking = false;
  }

  // Guard action: idle (0-90), surprise (90-170), talk & cheer (170-300)
  let guardAction: "idle" | "surprise" | "talk" = "idle";
  let guardEmotion: "neutral" | "surprised" | "happy" = "neutral";
  let guardTalking = false;

  if (frame >= 90 && frame < 170) {
    guardAction = "surprise";
    guardEmotion = "surprised";
  } else if (frame >= 170) {
    guardAction = "talk";
    guardEmotion = "happy";
    guardTalking = frame >= 180 && frame < 290;
  }

  // Calculate skeletal poses via frame-based mathematics
  const heroPose = computeCharacterPose(heroAction, frame, {
    fps,
    startFrame: heroAction === "wave" ? 80 : heroAction === "idle" ? 180 : 0,
    blendDuration: 10,
    speed: 1,
    intensity: 1
  });

  const guardPose = computeCharacterPose(guardAction, frame, {
    fps,
    startFrame: guardAction === "surprise" ? 90 : guardAction === "talk" ? 170 : 0,
    blendDuration: 8,
    speed: 1,
    intensity: 1
  });

  // Subtitles based on timeline
  let subtitleText = "Hiệp sĩ trở về cổng hoàng thành sau chuyến viễn chinh xa xôi...";
  if (frame >= 90 && frame < 180) {
    subtitleText = "Hiệp sĩ: \"Xin chào hộ vệ thành! Ta đã mang tin thắng trận trở về!\"";
  } else if (frame >= 180) {
    subtitleText = "Hộ vệ: \"Thật vinh quang! Kính mời tướng quân tiến vào yết kiến Đức Vua!\"";
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        backgroundColor: "#111827",
        overflow: "hidden"
      }}
    >
      <CameraController
        panX={[0, -25]}
        panY={[0, -10]}
        zoom={[1.0, 1.1]}
        shake={0.4}
        durationInFrames={300}
        width={width}
        height={height}
      >
        <CastleScene mood="golden" frame={frame} width={width} height={height}>
          {/* Character 1: Hero Knight (Blue Tunic, Sword, White Head, Black Limbs) */}
          <Stickman
            x={heroX}
            y={625}
            scale={1.05}
            facing={1}
            pose={heroPose}
            action={heroAction}
            emotion={heroEmotion}
            outfit={{
              top: "tunic",
              color: "#255aa2",
              head: "none"
            }}
            prop={frame > 170 ? "sword" : "none"}
            isTalking={heroTalking}
            frame={frame}
            fps={fps}
          />

          {/* Character 2: Castle Guard (Red Tunic, Helmet, Shield, White Head, Black Limbs) */}
          <Stickman
            x={830}
            y={630}
            scale={1.05}
            facing={-1}
            pose={guardPose}
            action={guardAction}
            emotion={guardEmotion}
            outfit={{
              top: "tunic",
              color: "#b94638",
              head: "helmet"
            }}
            prop="shield"
            isTalking={guardTalking}
            frame={frame}
            fps={fps}
          />
        </CastleScene>
      </CameraController>

      {/* Cinematic Subtitle Box */}
      <div
        style={{
          position: "absolute",
          bottom: "48px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(18, 14, 24, 0.82)",
          backdropFilter: "blur(8px)",
          color: "#fffaf1",
          padding: "12px 32px",
          borderRadius: "28px",
          fontSize: "24px",
          fontFamily: "Arial, sans-serif",
          fontWeight: 600,
          letterSpacing: "0.4px",
          textAlign: "center",
          maxWidth: "85%",
          boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.18)",
          textShadow: "0 2px 6px rgba(0,0,0,0.85)"
        }}
      >
        {subtitleText}
      </div>
    </div>
  );
};
