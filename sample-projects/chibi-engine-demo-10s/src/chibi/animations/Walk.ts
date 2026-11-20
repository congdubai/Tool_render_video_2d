import { ChibiPose } from '../characters/CharacterTypes';

export interface WalkParams {
  frame: number;
  fps?: number;
  speed?: number;       // 1.0 = chuẩn (chu kỳ 27 frames ~ 0.9s)
  intensity?: number;   // Biên độ vung
  weight?: number;      // 0.0 (đứng yên) đến 1.0 (đi bộ hoàn toàn), dùng để hãm phanh/tăng tốc mượt mà
  blinkInterval?: number;
}

export function computeWalkPose({
  frame,
  fps = 30,
  speed = 1.0,
  intensity = 1.0,
  weight = 1.0,
  blinkInterval = 110,
}: WalkParams): ChibiPose {
  const w = Math.max(0, Math.min(1, weight));
  // Chu kỳ bước: 27 frames ở tốc độ 1.0 (ở 30fps)
  const cycleFrames = 27 / Math.max(0.2, speed);
  const phase = (frame * Math.PI * 2) / cycleFrames;
  const stride = Math.sin(phase);

  // Biên độ vung chân
  const swing = w * stride * (29 * intensity);

  // Nhấc chân có quán tính (lũy thừa 1.6 như bản Chibi V9)
  const liftFar = w * Math.pow(Math.max(0, stride), 1.6) * (11 * intensity);
  const liftNear = w * Math.pow(Math.max(0, -stride), 1.6) * (11 * intensity);

  // Cuộn cổ chân giữ bàn chân tiếp đất tự nhiên, tránh trượt
  const farFootAngle = swing * 0.25;
  const nearFootAngle = -swing * 0.25;

  // Thân nhún nhẹ (bob 2 lần mỗi chu kỳ bước, không nảy cao)
  const bobY = w * (1 - Math.cos(phase * 2)) * (1.5 * intensity);

  // Thân nghiêng nhẹ về trước khi di chuyển
  const torsoLean = w * (4 * intensity);

  // VUNG TAY NGƯỢC PHA (OPPOSITE ARM SWING)
  // Tay xa (nằm sau balo): vung về phía trước khi chân gần bước về trước
  const farCycle = Math.sin(phase);
  const forwardFar = w * (0.5 + 0.5 * farCycle);
  const farArmAngle = -3 - (16 * intensity) * forwardFar;

  // Tay gần: vung ngược lại với biên độ nhẹ nhàng phía trước thân
  const nearArmAngle = swing * 0.46;

  // Chớp mắt tự nhiên
  const cycleFrame = frame % blinkInterval;
  const isBlinking = cycleFrame >= 79 && cycleFrame <= 82;

  return {
    bobY,
    torsoLean,
    headAngle: -torsoLean * 0.4,
    headBlink: isBlinking,
    mouthOpen: 0,
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
