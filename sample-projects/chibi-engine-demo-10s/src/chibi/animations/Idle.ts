import { ChibiPose } from '../characters/CharacterTypes';

export interface IdleParams {
  frame: number;
  fps?: number;
  intensity?: number;
  blinkInterval?: number;
}

export function computeIdlePose({
  frame,
  fps = 30,
  intensity = 1.0,
  blinkInterval = 110,
}: IdleParams): ChibiPose {
  // Thở nhẹ: chu kỳ ~2 giây (60 frames)
  const breathPhase = (frame * Math.PI * 2) / (fps * 2);
  const breathBob = Math.sin(breathPhase) * (1.2 * intensity);

  // Chớp mắt tự nhiên 3-4 frames trong mỗi chu kỳ
  const cycleFrame = frame % blinkInterval;
  const isBlinking = cycleFrame >= 78 && cycleFrame <= 81;

  // Đầu hơi lắc lư rất khẽ theo nhịp thở
  const headMicroTilt = Math.sin(breathPhase) * (0.8 * intensity);

  return {
    bobY: breathBob,
    torsoLean: 0,
    headAngle: headMicroTilt,
    headBlink: isBlinking,
    mouthOpen: 0,
    farArmAngle: -4,
    farArmForearmAngle: 0,
    nearArmAngle: 6 + breathBob * 0.5,
    nearArmForearmAngle: 0,
    farLegAngle: 0,
    farFootLift: 0,
    farFootAngle: 0,
    nearLegAngle: 0,
    nearFootLift: 0,
    nearFootAngle: 0,
    showBackpack: true,
  };
}
