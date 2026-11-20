import { ChibiAction, ChibiAnimationConfig, ChibiPose } from './CharacterTypes';
import { computeIdlePose } from '../animations/Idle';
import { computeWalkPose } from '../animations/Walk';
import { computeRunPose } from '../animations/Run';
import { computeTalkPose } from '../animations/Talk';
import { computeWavePose } from '../animations/Wave';
import { computePointPose } from '../animations/Point';
import { defaultIdlePose } from '../presets/defaultCharacter';

/**
 * Trộn 2 tư thế mượt mà với trọng số t (0.0 đến 1.0)
 */
export function blendPoses(poseA: ChibiPose, poseB: ChibiPose, t: number): ChibiPose {
  const clampT = Math.max(0, Math.min(1, t));
  const lerp = (a: number, b: number) => a + (b - a) * clampT;

  return {
    bobY: lerp(poseA.bobY, poseB.bobY),
    torsoLean: lerp(poseA.torsoLean, poseB.torsoLean),
    headAngle: lerp(poseA.headAngle, poseB.headAngle),
    headBlink: clampT > 0.5 ? poseB.headBlink : poseA.headBlink,
    mouthOpen: lerp(poseA.mouthOpen, poseB.mouthOpen),
    farArmAngle: lerp(poseA.farArmAngle, poseB.farArmAngle),
    farArmForearmAngle: lerp(poseA.farArmForearmAngle || 0, poseB.farArmForearmAngle || 0),
    nearArmAngle: lerp(poseA.nearArmAngle, poseB.nearArmAngle),
    nearArmForearmAngle: lerp(poseA.nearArmForearmAngle || 0, poseB.nearArmForearmAngle || 0),
    farLegAngle: lerp(poseA.farLegAngle, poseB.farLegAngle),
    farFootLift: lerp(poseA.farFootLift, poseB.farFootLift),
    farFootAngle: lerp(poseA.farFootAngle, poseB.farFootAngle),
    nearLegAngle: lerp(poseA.nearLegAngle, poseB.nearLegAngle),
    nearFootLift: lerp(poseA.nearFootLift, poseB.nearFootLift),
    nearFootAngle: lerp(poseA.nearFootAngle, poseB.nearFootAngle),
    facing: clampT > 0.5 ? poseB.facing : poseA.facing,
    showBackpack: clampT > 0.5 ? poseB.showBackpack : poseA.showBackpack,
  };
}

export interface SolvePoseOptions extends Partial<ChibiAnimationConfig> {
  frame: number;
  fps?: number;
  poseOverride?: Partial<ChibiPose>;
}

/**
 * Tính toán tư thế Chibi dựa trên frame và action cấu hình
 */
export function solveChibiPose(options: SolvePoseOptions): ChibiPose {
  const {
    frame,
    fps = 30,
    action = 'idle',
    speed = 1.0,
    intensity = 1.0,
    facing = 'right',
    showBackpack = true,
    poseOverride,
  } = options;

  let basePose: ChibiPose;

  switch (action) {
    case 'walk':
      basePose = computeWalkPose({ frame, fps, speed, intensity });
      break;
    case 'run':
      basePose = computeRunPose({ frame, fps, speed, intensity });
      break;
    case 'talk':
      basePose = computeTalkPose({ frame, fps, intensity });
      break;
    case 'wave':
      basePose = computeWavePose({ frame, fps, intensity });
      break;
    case 'point':
      basePose = computePointPose({ frame, fps, intensity });
      break;
    case 'idle':
    default:
      basePose = computeIdlePose({ frame, fps, intensity });
      break;
  }

  const finalPose: ChibiPose = {
    ...basePose,
    facing,
    showBackpack,
    ...(poseOverride || {}),
  };

  return finalPose;
}
