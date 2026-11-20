import React from 'react';
import { ChibiCharacterProps, ChibiColors, ChibiPose } from './CharacterTypes';
import {
  ChibiShadow,
  ChibiFarLeg,
  ChibiFarArm,
  ChibiBackpack,
  ChibiNearLeg,
  ChibiTorso,
  ChibiNearArm,
  ChibiHead,
} from './CharacterParts';
import { solveChibiPose } from './CharacterRig';
import { defaultChibiColors } from '../presets/defaultCharacter';

export const ChibiCharacter: React.FC<ChibiCharacterProps> = ({
  frame,
  fps = 30,
  x = 0,
  y = 0,
  scale = 1,
  facing = 'right',
  action = 'idle',
  animationConfig,
  poseOverride,
  colors: customColors,
  showBackpack = true,
  showShadow = true,
  className,
  id,
}) => {
  // Hòa trộn màu sắc với bảng màu mặc định của Chibi V9
  const colors: Required<ChibiColors> = {
    ...defaultChibiColors,
    ...(customColors || {}),
  };

  // Tính toán pose của nhân vật theo frame hiện tại
  const pose: ChibiPose = solveChibiPose({
    frame,
    fps,
    action,
    facing,
    showBackpack,
    ...(animationConfig || {}),
    poseOverride,
  });

  const flipX = (pose.facing || facing) === 'left' ? -1 : 1;

  return (
    <g
      id={id}
      className={className}
      transform={`translate(${x} ${y - pose.bobY}) scale(${scale * flipX} ${scale})`}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 1. Bóng đổ dưới chân */}
      {showShadow && <ChibiShadow />}

      {/* 2. Chân phía xa (Far Leg) */}
      <ChibiFarLeg
        colors={colors}
        angle={pose.farLegAngle}
        lift={pose.farFootLift}
        footAngle={pose.farFootAngle}
      />

      {/* 3. Tay phía xa (Far Arm) - Đặt phía sau balo và thân áo */}
      <g transform={`rotate(${pose.torsoLean} -5 -162)`}>
        <ChibiFarArm colors={colors} angle={pose.farArmAngle} />
      </g>

      {/* 4. Balo (Backpack) - Ôm sát lưng phía sau */}
      {pose.showBackpack && <ChibiBackpack colors={colors} />}

      {/* 5. Chân phía gần camera (Near Leg) */}
      <ChibiNearLeg
        colors={colors}
        angle={pose.nearLegAngle}
        lift={pose.nearFootLift}
        footAngle={pose.nearFootAngle}
      />

      {/* 6. Thân người (Torso) - Hướng góc 3/4 */}
      <g transform={`rotate(${pose.torsoLean} -5 -162)`}>
        {/* Thân áo & dây đeo vai balo */}
        <ChibiTorso colors={colors} showBackpack={pose.showBackpack} />

        {/* 7. Tay phía gần camera (Near Arm) - Hiển thị phía trước thân áo */}
        <ChibiNearArm colors={colors} angle={pose.nearArmAngle} />

        {/* 8. Đầu Chibi (Head + Eyes + Mouth + Hair/Helmet) */}
        <ChibiHead
          colors={colors}
          angle={pose.headAngle}
          blink={pose.headBlink}
          mouthOpen={pose.mouthOpen}
        />
      </g>
    </g>
  );
};
