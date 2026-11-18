import React from "react";
import { Composition } from "remotion";
import { Video } from "./Video";
import type { ScriptData, TimelineData, ScenesData, VideoCompositionProps } from "./types";

import defaultScript from "./data/script.json";
import defaultTimeline from "./data/timeline.json";
import defaultScenes from "./data/scenes.json";

export const Root: React.FC = () => {
  const scriptData = defaultScript as ScriptData;
  const timelineData = defaultTimeline as TimelineData;
  const scenesData = defaultScenes as ScenesData;

  const fps = scriptData.meta?.fps || 30;
  const width = scriptData.meta?.width || 1280;
  const height = scriptData.meta?.height || 720;
  const totalSeconds = timelineData.totalSeconds || 10;
  const durationInFrames = Math.max(1, Math.round(totalSeconds * fps));

  return (
    <>
      <Composition<any, VideoCompositionProps>
        id="Video2D"
        component={Video}
        durationInFrames={durationInFrames}
        fps={fps}
        width={width}
        height={height}
        defaultProps={{
          scriptData,
          timelineData,
          scenesData
        }}
        calculateMetadata={({ props }) => {
          const customFps = props.scriptData?.meta?.fps || fps;
          const customTotalSec = props.timelineData?.totalSeconds || totalSeconds;
          return {
            durationInFrames: Math.max(1, Math.round(customTotalSec * customFps)),
            fps: customFps,
            width: props.scriptData?.meta?.width || width,
            height: props.scriptData?.meta?.height || height
          };
        }}
      />
    </>
  );
};
