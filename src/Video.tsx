import React from "react";
import {
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import type { VideoCompositionProps } from "./types";
import { SceneView } from "./components/SceneView";
import { Subtitles } from "./components/Subtitles";
import { Vignette } from "./components/Vignette";

export const Video: React.FC<VideoCompositionProps> = ({
  scriptData,
  timelineData,
  scenesData
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const fadeSeconds = scriptData.meta?.fadeSeconds ?? 0.3;
  const musicPath = scriptData.meta?.music;
  const baseMusicVolume = scriptData.meta?.musicVolume ?? 0.08;

  // 1. Kiểm tra xem thời điểm hiện tại có đang phát giọng đọc không (để ducking nhạc nền)
  const isVoiceActive = (timelineData.lines || []).some((line) => {
    const vEnd = line.voiceEnd || line.end;
    return currentTime >= line.start && currentTime <= vEnd;
  });

  // Khi có giọng đọc thì giảm volume nhạc nền xuống còn 30% để không lấn át lời đọc
  const currentMusicVolume = isVoiceActive ? baseMusicVolume * 0.3 : baseMusicVolume;

  const scenes = scenesData.scenes || [];
  const lines = timelineData.lines || [];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#000000",
        overflow: "hidden"
      }}
    >
      {/* 2. Các cảnh hình (Scenes) */}
      {scenes.map((scene, index) => (
        <SceneView
          key={scene.id || index}
          scene={scene}
          fadeSeconds={fadeSeconds}
          isFirstScene={index === 0}
        />
      ))}

      {/* 3. Lớp viền tối Vignette nhẹ ở góc */}
      <Vignette />

      {/* 4. Lớp phụ đề Subtitles toàn video */}
      <Subtitles timelineData={timelineData} scriptData={scriptData} />

      {/* 5. Âm thanh giọng đọc từng dòng */}
      {lines.map((line) => {
        if (!line.audio) return null;
        const fromFrame = Math.round(line.start * fps);
        const durationFrames = Math.max(1, Math.round((line.end - line.start) * fps));

        return (
          <Sequence
            key={line.id}
            from={fromFrame}
            durationInFrames={durationFrames}
          >
            <Audio src={staticFile(line.audio)} volume={1.0} />
          </Sequence>
        );
      })}

      {/* 6. Nhạc nền (nếu có) */}
      {musicPath && (
        <Audio
          src={staticFile(musicPath)}
          volume={currentMusicVolume}
          loop
        />
      )}
    </div>
  );
};
