import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { ChibiCharacter } from './chibi/characters/ChibiCharacter';
import { computeWalkPose } from './chibi/animations/Walk';
import { computeIdlePose } from './chibi/animations/Idle';
import { computeWavePose } from './chibi/animations/Wave';
import { blendPoses } from './chibi/characters/CharacterRig';

export const Video: React.FC = () => {
  const f = useCurrentFrame();

  // 1. Phân đoạn Timeline:
  // 0 - 4s (0-120): Đi bộ sang phải từ x=280 đến x=960
  // 4 - 5s (120-150): Giảm tốc và dừng lại tại x=960
  // 5 - 7s (150-210): Đứng yên (Idle), chớp mắt
  // 7 - 9s (210-270): Giơ tay vẫy chào (Wave)
  // 9 - 10s (270-300): Trở lại trạng thái nghỉ

  // Nội suy vị trí di chuyển X trên mặt đất
  const x = interpolate(f, [0, 140], [280, 960], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  // Trọng số đi bộ: Bắt đầu từ 0-15f, giảm tốc từ 120-148f
  const walkIn = interpolate(f, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const walkOut = interpolate(f, [120, 148], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const walkWeight = walkIn * walkOut;

  // Trọng số vẫy tay (Wave): Nâng tay 210-224f, vẫy đến 258f, hạ tay 258-272f
  const waveIn = interpolate(f, [210, 224], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const waveOut = interpolate(f, [258, 272], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const waveWeight = waveIn * waveOut;

  // Tính toán Pose kết hợp
  let pose;
  if (walkWeight > 0.01) {
    const walkPose = computeWalkPose({ frame: f, weight: walkWeight, speed: 1.0 });
    const idlePose = computeIdlePose({ frame: f });
    pose = blendPoses(idlePose, walkPose, walkWeight);
  } else if (waveWeight > 0.01) {
    const wavePose = computeWavePose({ frame: f, weight: waveWeight, intensity: 1.1 });
    const idlePose = computeIdlePose({ frame: f });
    pose = blendPoses(idlePose, wavePose, waveWeight);
  } else {
    pose = computeIdlePose({ frame: f });
  }

  // Phụ đề mô tả trạng thái hiện tại
  let subtitle = '';
  let badgeColor = '#38bdf8';
  if (f < 120) {
    subtitle = '0–4s: Đi bộ sang phải • Hai tay vung ngược pha, balo ôm sát lưng';
    badgeColor = '#38bdf8';
  } else if (f < 150) {
    subtitle = '4–5s: Giảm tốc và dừng lại tự nhiên • Giữ thăng bằng tiếp đất';
    badgeColor = '#f59e0b';
  } else if (f < 210) {
    subtitle = '5–7s: Đứng yên (Idle) • Nhịp thở nhẹ & chớp mắt tự nhiên';
    badgeColor = '#10b981';
  } else if (f < 270) {
    subtitle = '7–9s: Giơ tay vẫy chào (Wave) • Tay gần giơ cao, đầu nghiêng thân thiện';
    badgeColor = '#a855f7';
  } else {
    subtitle = '9–10s: Hạ tay & trở lại trạng thái nghỉ thư thái';
    badgeColor = '#64748b';
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#e2e8f0' }}>
      <svg viewBox="0 0 1920 1080" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        {/* Background Bầu trời & Mây */}
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bfdbfe" />
            <stop offset="100%" stopColor="#eff6ff" />
          </linearGradient>
          <linearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
        </defs>

        <rect width="1920" height="1080" fill="url(#skyGrad)" />

        {/* Dãy đồi xa */}
        <path d="M0 680 Q450 560 900 640 T1920 620 L1920 1080 L0 1080Z" fill="#93c5fd" opacity="0.3" />
        <path d="M0 710 Q520 610 1100 680 T1920 660 L1920 1080 L0 1080Z" fill="#86efac" opacity="0.45" />

        {/* Mặt đất & vỉa hè / sàn di chuyển */}
        <rect y="740" width="1920" height="340" fill="url(#roadGrad)" />
        <path d="M0 740 H1920" stroke="#334155" strokeWidth="10" />

        {/* Vạch kẻ đường / gạch vỉa hè */}
        <g stroke="#cbd5e1" strokeWidth="6" opacity="0.75" strokeDasharray="60 40">
          <line x1="0" y1="880" x2="1920" y2="880" />
        </g>

        {/* Hàng rào trang trí phong cách tối giản */}
        <g stroke="#94a3b8" strokeWidth="8" opacity="0.5">
          <line x1="0" y1="710" x2="1920" y2="710" />
          {Array.from({ length: 16 }).map((_, i) => (
            <line key={i} x1={i * 130 + 30} y1="670" x2={i * 130 + 30} y2="740" />
          ))}
        </g>

        {/* Nhân vật Chibi V9 được điều khiển bởi Chibi Character Engine */}
        <ChibiCharacter
          frame={f}
          x={x}
          y={900}
          scale={1.3}
          facing="right"
          poseOverride={pose}
          showBackpack={true}
          showShadow={true}
        />

        {/* Tiêu đề & Thông tin Demo */}
        <rect x="50" y="40" width="820" height="70" rx="14" fill="#0f172a" opacity="0.88" />
        <text x="75" y="86" fontSize="26" fill="#38bdf8" fontFamily="Arial, sans-serif" fontWeight="bold">
          CHIBI 2D CUT-OUT ENGINE • DEMO 10S
        </text>
        <text x="590" y="86" fontSize="18" fill="#94a3b8" fontFamily="monospace">
          [1920×1080 • 30 FPS]
        </text>

        {/* Bảng phụ đề trạng thái động ở đáy màn hình */}
        <rect x="160" y="960" width="1600" height="84" rx="16" fill="#0f172a" opacity="0.92" />
        <circle cx="210" cy="1002" r="10" fill={badgeColor} />
        <text
          x="960"
          y="1013"
          fill="#ffffff"
          fontSize="30"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontWeight="bold"
        >
          {subtitle}
        </text>
      </svg>
    </div>
  );
};

