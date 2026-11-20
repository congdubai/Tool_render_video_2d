import { ChibiPose } from '../characters/CharacterTypes';

export interface RunParams {
  frame: number;
  fps?: number;
  speed?: number;       // 1.0 = chuẩn (chu kỳ 18 frames)
  intensity?: number;
  weight?: number;      // 0.0 - 1.0
  blinkInterval?: number;
}

export function computeRunPose({
  frame,
  fps = 30,
  speed = 1.0,
  intensity = 1.0,
  weight = 1.0,
  blinkInterval = 90,
}: RunParams): ChibiPose {
  const w = Math.max(0, Math.min(1, weight));
  // Chu kỳ chạy nhanh hơn đi bộ (khoảng 18 frames)
  const cycleFrames = 18 / Math.max(0.2, speed);
  const phase = (frame * Math.PI * 2) / cycleFrames;
  const stride = Math.sin(phase);

  // Sải chân rộng hơn
  const swing = w * stride * (42 * intensity);

  // Chân nhấc cao hơn
  const liftFar = w * Math.pow(Math.max(0, stride), 1.5) * (20 * intensity);
  const liftNear = w * Math.pow(Math.max(0, -stride), 1.5) * (20 * intensity);

  const farFootAngle = swing * 0.35;
  const nearFootAngle = -swing * 0.35;

  // Nhún sâu hơn khi chạy
  const bobY = w * (1 - Math.cos(phase * 2)) * (3.5 * intensity);

  // Thân chúi về phía trước nhiều hơn
  const torsoLean = w * (9 * intensity);

  // Vung tay mạnh mẽ và dứt khoát
  const farCycle = Math.sin(phase);
  const forwardFar = w * (0.5 + 0.5 * farCycle);
  const farArmAngle = -10 - (28 * intensity) * forwardFar;

  const nearArmAngle = swing * 0.75;

  const cycleFrame = frame % blinkInterval;
  const isBlinking = cycleFrame >= 60 && cycleFrame <= 63;

  return {
    bobY,
    torsoLean,
    headAngle: -torsoLean * 0.5,
    headBlink: isBlinking,
    mouthOpen: 0.1, // Hơi hé miệng thở khi chạy
    farArmAngle,
    farArmForearmAngle: 0,
    nearArmAngle,
    nearArmForearmAngle: 0,
    farLegAngle: -swing,
    farFootLift: liftFar,
    farFootAngle,
    nearLegAngle: swing,
    nearFootLift: liftNear,
    nearFootAngle,
    showBackpack: true,
  };
}
