import React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  staticFile
} from "remotion";
import { Character } from "./components/Character";
import { ParallaxBackground } from "./components/ParallaxBackground";

export const VideoDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ==========================================
  // PHÂN ĐOẠN 1: 0s - 2s (Frames 0 - 60) - INTRO & SPRING BOUNCE
  // ==========================================
  const introSpring = spring({
    frame,
    fps,
    config: { damping: 11, stiffness: 100, mass: 0.8 }
  });
  const introCharY = interpolate(introSpring, [0, 1], [1100, 580]);

  // ==========================================
  // PHÂN ĐOẠN 2: 2s - 4s (Frames 60 - 120) - WALK CYCLE
  // ==========================================
  const isWalking = frame >= 60 && frame < 120;
  const walkProgress = interpolate(frame, [60, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const walkCharX = interpolate(walkProgress, [0, 1], [300, 850]);

  // ==========================================
  // PHÂN ĐOẠN 3: 4s - 6s (Frames 120 - 180) - SURPRISE & POP-UP
  // ==========================================
  const isSurprise = frame >= 120 && frame < 180;
  const popSpring = spring({
    frame: frame - 120,
    fps,
    config: { damping: 9, stiffness: 140 }
  });

  // ==========================================
  // PHÂN ĐOẠN 4: 6s - 8s (Frames 180 - 240) - CAMERA ZOOM & PARALLAX
  // ==========================================
  const zoomProgress = interpolate(frame, [180, 220], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const cameraScale = interpolate(zoomProgress, [0, 1], [1, 1.4]);
  const cameraPanX = interpolate(zoomProgress, [0, 1], [0, -220]);
  const cameraPanY = interpolate(zoomProgress, [0, 1], [0, -120]);

  // ==========================================
  // PHÂN ĐOẠN 5: 8s - 10s (Frames 240 - 300) - SCENE TRANSITION & OUTRO
  // ==========================================
  const isOutro = frame >= 240;
  const transitionProgress = interpolate(frame, [240, 260], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  // Xác định vị trí và hành động của nhân vật theo timeline
  let charX = 300;
  let charY = 580;
  let charAction: "idle" | "walk" | "surprise" | "wave" | "bounce" = "idle";
  let charEmotion: "happy" | "surprised" | "neutral" = "neutral";

  if (frame < 60) {
    charX = 300;
    charY = introCharY;
    charAction = "bounce";
    charEmotion = "happy";
  } else if (frame < 120) {
    charX = walkCharX;
    charY = 580;
    charAction = "walk";
    charEmotion = "neutral";
  } else if (frame < 180) {
    charX = 850;
    charY = 580;
    charAction = "surprise";
    charEmotion = "surprised";
  } else if (frame < 240) {
    charX = 850;
    charY = 580;
    charAction = "idle";
    charEmotion = "happy";
  } else {
    charX = 960;
    charY = 580;
    charAction = "wave";
    charEmotion = "happy";
  }

  // Tiêu đề phụ đề giải thích từng phân cảnh phía dưới màn hình
  let currentSubtitle = "0s - 2s: Nhân vật xuất hiện bằng Spring Animation nảy nhẹ";
  if (frame >= 60 && frame < 120) {
    currentSubtitle = "2s - 4s: Chuyển động đi bộ (Walk Cycle) nhịp nhàng chân tay & bóng chân";
  } else if (frame >= 120 && frame < 180) {
    currentSubtitle = "4s - 6s: Đổi biểu cảm ngạc nhiên và tương tác biểu tượng Pop-Up";
  } else if (frame >= 180 && frame < 240) {
    currentSubtitle = "6s - 8s: Camera Zoom-in cận cảnh & Parallax đa tầng tạo chiều sâu 3D";
  } else if (frame >= 240) {
    currentSubtitle = "8s - 10s: Chuyển cảnh mượt mà sang bối cảnh mới và vẫy tay kết thúc";
  }

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#030712",
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      }}
    >
      {/* 1. KHUNG NHÌN CAMERA TOÀN BỘ CẢNH */}
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          transformOrigin: "center center",
          transform: `scale(${cameraScale}) translate(${cameraPanX}px, ${cameraPanY}px)`
        }}
      >
        {/* Parallax Background */}
        <ParallaxBackground panX={frame * 2.5} />

        {/* Bối cảnh chuyển đổi ở cảnh Outro (8s - 10s) */}
        {frame >= 240 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
              opacity: transitionProgress,
              zIndex: 1
            }}
          />
        )}

        {/* Nhân vật chính hoạt hình 2D */}
        <div style={{ position: "relative", zIndex: 10 }}>
          <Character
            x={charX}
            y={charY}
            scale={1.2}
            action={charAction}
            emotion={charEmotion}
          />
        </div>

        {/* Bong bóng Pop-up ngạc nhiên (ở phân cảnh 4s - 6s) */}
        {isSurprise && (
          <div
            style={{
              position: "absolute",
              left: 1080,
              top: 460,
              transform: `scale(${popSpring})`,
              transformOrigin: "bottom left",
              backgroundColor: "#fef08a",
              color: "#854d0e",
              padding: "16px 24px",
              borderRadius: "20px 20px 20px 4px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
              fontWeight: 800,
              fontSize: 28,
              display: "flex",
              alignItems: "center",
              gap: 12,
              zIndex: 15
            }}
          >
            <span style={{ fontSize: 36 }}>💡</span>
            <span>AI ENGINE SẴN SÀNG!</span>
          </div>
        )}
      </div>

      {/* 2. OVERLAY HUD TIÊU ĐỀ TRÊN CÙNG */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 50,
          display: "flex",
          alignItems: "center",
          gap: 16,
          zIndex: 50
        }}
      >
        <div
          style={{
            padding: "8px 18px",
            backgroundColor: "#0284c7",
            borderRadius: 8,
            color: "#ffffff",
            fontWeight: 800,
            fontSize: 20,
            boxShadow: "0 0 15px rgba(2, 132, 199, 0.6)",
            letterSpacing: 1
          }}
        >
          REMOTION 2D ENGINE
        </div>
        <div
          style={{
            color: "#ffffff",
            fontSize: 22,
            fontWeight: 700,
            textShadow: "0 2px 8px rgba(0,0,0,0.8)"
          }}
        >
          AI Code-to-Video Demo (10 Giây)
        </div>
      </div>

      {/* Hiển thị số Frame và Timecode góc phải */}
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 50,
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(56, 189, 248, 0.4)",
          padding: "8px 20px",
          borderRadius: 8,
          color: "#38bdf8",
          fontSize: 18,
          fontFamily: "monospace",
          fontWeight: 700,
          zIndex: 50
        }}
      >
        Frame: {frame} / 300 ({(frame / fps).toFixed(2)}s)
      </div>

      {/* 3. PHỤ ĐỀ TRỰC QUAN DƯỚI CÙNG (KARAOKE / BANNER) */}
      <div
        style={{
          position: "absolute",
          bottom: 35,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          border: "2px solid #38bdf8",
          boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
          padding: "14px 36px",
          borderRadius: 30,
          color: "#ffffff",
          fontSize: 24,
          fontWeight: 700,
          textAlign: "center",
          maxWidth: "85%",
          zIndex: 50
        }}
      >
        {currentSubtitle}
      </div>

      {/* Nhạc nền / Audio nếu có trong public */}
      {/* <Audio src={staticFile("voice.mp3")} volume={0.8} /> */}
    </div>
  );
};

