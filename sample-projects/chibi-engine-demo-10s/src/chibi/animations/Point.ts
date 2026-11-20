import { ChibiPose } from '../characters/CharacterTypes';

export interface PointParams {
  frame: number;
  fps?: number;
  intensity?: number;
  weight?: number;      // 0.0 - 1.0
  blinkInterval?: number;
}

export function computePointPose({
  frame,
  fps = 30,
  intensity = 1.0,
  weight = 1.0,
  blinkInterval = 110,
}: PointParams): ChibiPose {
  const w = Math.max(0, Math.min(1, weight));

  // Tay gần giơ thẳng về phía trước chỉ hướng (khoảng -72°)
  const restingAngle = 6;
  const targetAngle = -72;
  const nearArmAngle = restingAngle + (targetAngle - restingAngle) * w;

  // Thân hơi rướn nhẹ về trước
  const torsoLean = 2.5 * w;
  const headAngle = -1.5 * w;

  const cycleFrame = frame % blinkInterval;
  const isBlinking = cycleFrame >= 75 && cycleFrame <= 78;

  return {
    bobY: 0,
    torsoLean,
    headAngle,
    headBlink: isBlinking,
    mouthOpen: 0,
    farArmAngle: -4,
    farArmForearmAngle: 0,
    nearArmAngle,
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
