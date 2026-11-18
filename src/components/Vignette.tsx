import React from "react";

/**
 * Lớp viền tối nhẹ ở 4 góc mép video (Vignette)
 * Dùng radial-gradient CSS thuần túy, tuyệt đối không dùng filter CSS nặng để tiết kiệm CPU/GPU
 */
export const Vignette: React.FC = () => {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        background:
          "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.45) 100%)"
      }}
    />
  );
};

