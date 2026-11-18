import React from "react";
import { useCurrentFrame } from "remotion";

export interface ParallaxBackgroundProps {
  panX?: number;
  panY?: number;
  theme?: "city" | "nature" | "gradient";
}

export const ParallaxBackground: React.FC<ParallaxBackgroundProps> = ({
  panX = 0,
  panY = 0,
  theme = "city"
}) => {
  const frame = useCurrentFrame();

  // Tốc độ di chuyển Parallax:
  // Lớp xa trôi 20%, lớp giữa trôi 50%, lớp cận trôi 100%
  const farOffset = panX * 0.2 + frame * 0.4;
  const midOffset = panX * 0.5 + frame * 1.0;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "linear-gradient(180deg, #091e3a 0%, #173b6c 50%, #2b5876 100%)"
      }}
    >
      {/* 1. Lớp xa (Bầu trời đêm & Ngôi sao lấp lánh) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "140%",
          height: "60%",
          transform: `translateX(${-farOffset % 400}px)`
        }}
      >
        {/* Mặt trăng to phát sáng */}
        <div
          style={{
            position: "absolute",
            top: 70,
            right: 320,
            width: 130,
            height: 130,
            borderRadius: "50%",
            backgroundColor: "#fef08a",
            boxShadow: "0 0 50px rgba(254, 240, 138, 0.6)"
          }}
        />
        {/* Những đám mây trôi xa */}
        <div
          style={{
            position: "absolute",
            top: 130,
            left: 200,
            width: 280,
            height: 60,
            backgroundColor: "rgba(255, 255, 255, 0.15)",
            borderRadius: 30,
            filter: "blur(5px)"
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 190,
            left: 900,
            width: 380,
            height: 70,
            backgroundColor: "rgba(255, 255, 255, 0.12)",
            borderRadius: 35,
            filter: "blur(6px)"
          }}
        />
      </div>

      {/* 2. Lớp giữa (Skyline dãy nhà chọc trời trôi trung bình) */}
      <div
        style={{
          position: "absolute",
          bottom: 180,
          left: 0,
          width: "200%",
          height: 380,
          display: "flex",
          alignItems: "flex-end",
          transform: `translateX(${-midOffset % 600}px)`,
          gap: 15
        }}
      >
        {[
          { w: 100, h: 260, color: "#1e293b" },
          { w: 140, h: 320, color: "#0f172a" },
          { w: 80, h: 220, color: "#334155" },
          { w: 160, h: 350, color: "#1e293b" },
          { w: 110, h: 280, color: "#0f172a" },
          { w: 130, h: 310, color: "#334155" },
          { w: 150, h: 340, color: "#1e293b" },
          { w: 90, h: 250, color: "#0f172a" },
          { w: 140, h: 300, color: "#334155" },
          { w: 120, h: 330, color: "#1e293b" },
          { w: 160, h: 360, color: "#0f172a" }
        ].map((building, i) => (
          <div
            key={i}
            style={{
              width: building.w,
              height: building.h,
              backgroundColor: building.color,
              borderTop: "3px solid rgba(56, 189, 248, 0.3)",
              boxShadow: "0 -4px 15px rgba(0, 0, 0, 0.4)",
              position: "relative",
              flexShrink: 0
            }}
          >
            {/* Các ô cửa sổ sáng đèn */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                padding: 12
              }}
            >
              {Array.from({ length: 12 }).map((_, wIdx) => (
                <div
                  key={wIdx}
                  style={{
                    height: 10,
                    backgroundColor: (wIdx + i) % 3 === 0 ? "#fef08a" : "rgba(255,255,255,0.08)",
                    borderRadius: 2
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 3. Lớp cận cảnh (Mặt đường & Vỉa hè đi bộ) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 200,
          backgroundColor: "#0b1329",
          borderTop: "6px solid #38bdf8",
          boxShadow: "0 -10px 30px rgba(56, 189, 248, 0.25)"
        }}
      >
        {/* Vạch kẻ đường công nghệ neon */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 0,
            width: "200%",
            height: 8,
            backgroundImage: "repeating-linear-gradient(90deg, #38bdf8 0, #38bdf8 80px, transparent 80px, transparent 150px)",
            transform: `translateX(${-((panX + frame * 4) % 150)}px)`
          }}
        />
        {/* Lan can vỉa hè */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 50,
            right: 50,
            display: "flex",
            justifyContent: "space-between",
            opacity: 0.5
          }}
        >
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} style={{ width: 12, height: 45, backgroundColor: "#64748b", borderRadius: 4 }} />
          ))}
        </div>
      </div>
    </div>
  );
};

