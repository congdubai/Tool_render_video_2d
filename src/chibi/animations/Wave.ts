import { ChibiPose } from '../characters/CharacterTypes';

export interface WaveParams {
  frame: number;
  fps?: number;
  intensity?: number;
  weight?: number;      // 0.0 (hạ tay) đến 1.0 (giơ tay vẫy hoàn toàn)
  blinkInterval?: number;
}

export function computeWavePose({
  frame,
  fps = 30,
  intensity = 1.0,
  weight = 1.0,
  blinkInterval = 110,
}: WaveParams): ChibiPose {
  const w = Math.max(0, Math.min(1, weight));

  // Nhịp vẫy tay: chu kỳ ~14 frames
  const waveCycle = (frame * Math.PI * 2) / 14;
  const waveWiggle = Math.sin(waveCycle) * (16 * intensity);

  // Góc tay gần giơ lên chào (từ +6° trạng thái nghỉ lên khoảng -105° + dao động)
  const restingAngle = 6;
  const targetAngle = -105 + waveWiggle;
  const nearArmAngle = restingAngle + (targetAngle - restingAngle) * w;

  // Đầu hơi nghiêng thân thiện khi vẫy chào
  const headTilt = -5 * w;

  const cycleFrame = frame % blinkInterval;
  const isBlinking = cycleFrame >= 70 && cycleFrame <= 73;

  return {
    bobY: Math.sin(frame * 0.1) * 0.6,
    torsoLean: -1 * w,
    headAngle: headTilt,
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

