import { ChibiPose } from '../characters/CharacterTypes';

export interface TalkParams {
  frame: number;
  fps?: number;
  intensity?: number;
  blinkInterval?: number;
}

export function computeTalkPose({
  frame,
  fps = 30,
  intensity = 1.0,
  blinkInterval = 110,
}: TalkParams): ChibiPose {
  // Khẩu hình mở đóng theo nhịp nói tự nhiên
  const speechWave = (Math.sin(frame * 0.72) + Math.cos(frame * 1.34) + 1.2) / 3.0;
  const mouthOpen = Math.max(0, Math.min(1, speechWave * intensity));

  // Đầu gật nhẹ theo âm tiết
  const headNod = Math.sin(frame * 0.36) * (2.8 * intensity);

  // Tay gần khẽ cử động diễn đạt
  const handGesture = Math.sin(frame * 0.28) * (8 * intensity);

  const cycleFrame = frame % blinkInterval;
  const isBlinking = cycleFrame >= 75 && cycleFrame <= 78;

  return {
    bobY: Math.sin(frame * 0.18) * 0.8,
    torsoLean: 0.5,
    headAngle: headNod,
    headBlink: isBlinking,
    mouthOpen,
    farArmAngle: -4,
    farArmForearmAngle: 0,
    nearArmAngle: 8 + handGesture,
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
