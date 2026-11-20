import React from "react";
import { Sequence, useCurrentFrame, interpolate, Audio } from "remotion";
import { StoryboardProject, StoryboardScene } from "../types";
import { CastleScene } from "../environments/CastleScene";
import { CameraController } from "../camera/CameraController";
import { Stickman } from "../characters/Stickman";
import { computeCharacterPose } from "../characters/CharacterAnimations";

interface SceneRendererProps {
  scene: StoryboardScene;
  fps: number;
  width: number;
  height: number;
}

const SingleSceneView: React.FC<SceneRendererProps> = ({ scene, fps, width, height }) => {
  const localFrame = useCurrentFrame();
  const dur = scene.durationInFrames;

  // Resolve camera animation
  const cam = scene.camera || { type: "static" };
  let zoomStart = cam.scaleStart ?? 1;
  let zoomEnd = cam.scaleEnd ?? 1;
  let panXStart = cam.panXStart ?? 0;
  let panXEnd = cam.panXEnd ?? 0;
  let panYStart = cam.panYStart ?? 0;
  let panYEnd = cam.panYEnd ?? 0;

  if (cam.type === "zoomIn") {
    zoomStart = cam.scaleStart ?? 1.0;
    zoomEnd = cam.scaleEnd ?? 1.15;
  } else if (cam.type === "zoomOut") {
    zoomStart = cam.scaleStart ?? 1.15;
    zoomEnd = cam.scaleEnd ?? 1.0;
  } else if (cam.type === "panRight") {
    panXStart = cam.panXStart ?? 0;
    panXEnd = cam.panXEnd ?? -60;
  } else if (cam.type === "panLeft") {
    panXStart = cam.panXStart ?? 0;
    panXEnd = cam.panXEnd ?? 60;
  } else if (cam.type === "dramatic") {
    zoomStart = 1.05;
    zoomEnd = 1.22;
    panYStart = 0;
    panYEnd = -25;
  }

  // Scene transition opacity
  let opacity = 1;
  if (scene.transition === "fade") {
    const fadeIn = interpolate(localFrame, [0, Math.min(15, dur * 0.2)], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    });
    const fadeOut = interpolate(localFrame, [Math.max(0, dur - 15), dur], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    });
    opacity = Math.min(fadeIn, fadeOut);
  }

  const mood = scene.environment?.mood || "day";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        opacity
      }}
    >
      <CameraController
        panX={[panXStart, panXEnd]}
        panY={[panYStart, panYEnd]}
        zoom={[zoomStart, zoomEnd]}
        durationInFrames={dur}
        shake={cam.type === "dramatic" ? 1.5 : 0.5}
        width={width}
        height={height}
      >
        <CastleScene mood={mood} frame={localFrame} width={width} height={height}>
          {/* Render Characters inside Castle SVG stage */}
          {scene.characters.map((char, index) => {
            const pose = computeCharacterPose(char.action || "idle", localFrame, {
              fps,
              speed: 1,
              intensity: 1
            });

            return (
              <Stickman
                key={char.id || `char_${index}`}
                x={char.x}
                y={char.y}
                scale={char.scale || 1}
                facing={char.facing ?? 1}
                pose={pose}
                action={char.action}
                emotion={char.emotion || "neutral"}
                outfit={char.outfit}
                prop={char.prop || "none"}
                isTalking={char.isTalking ?? false}
                frame={localFrame}
                fps={fps}
                opacity={char.opacity ?? 1}
              />
            );
          })}
        </CastleScene>
      </CameraController>

      {/* Subtitles Overlay */}
      {(scene.subtitle || scene.dialogue) && (
        <div
          style={{
            position: "absolute",
            bottom: "8%",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(14, 18, 28, 0.78)",
            color: "#ffffff",
            padding: "10px 28px",
            borderRadius: "24px",
            fontSize: "26px",
            fontFamily: "Arial, sans-serif",
            fontWeight: 600,
            letterSpacing: "0.5px",
            textAlign: "center",
            maxWidth: "80%",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.15)",
            textShadow: "0 2px 4px rgba(0,0,0,0.8)"
          }}
        >
          {scene.subtitle || scene.dialogue}
        </div>
      )}

      {/* Optional Scene Voice Audio */}
      {scene.voiceAudioSrc && <Audio src={scene.voiceAudioSrc} />}
    </div>
  );
};

export const SceneTimeline: React.FC<{ project: StoryboardProject }> = ({ project }) => {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0d0e14",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {project.scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
        >
          <SingleSceneView
            scene={scene}
            fps={project.fps}
            width={project.width}
            height={project.height}
          />
        </Sequence>
      ))}
    </div>
  );
};

