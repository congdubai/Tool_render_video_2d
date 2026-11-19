import { ActionType, PoseJoints } from "../types";
import { POSES, blendPose, walkPose, breathePose, wavingPose } from "./CharacterRig";

export interface AnimationOptions {
  fps?: number;
  durationInFrames?: number;
  startFrame?: number;
  speed?: number;
  intensity?: number;
  direction?: 1 | -1;
  blendDuration?: number; // frames to blend into the action
  stride?: number;
  lift?: number;
  bob?: number;
}

/**
 * Computes the exact skeletal pose for a character given an action and the current frame.
 * Fully deterministic and frame-based for Remotion rendering.
 */
export function computeCharacterPose(
  action: ActionType = "idle",
  frame: number = 0,
  options: AnimationOptions = {}
): PoseJoints {
  const {
    fps = 30,
    startFrame = 0,
    durationInFrames = Infinity,
    speed = 1,
    intensity = 1,
    blendDuration = 8,
    stride = 26,
    lift = 12,
    bob = 3.5
  } = options;

  const localFrame = Math.max(0, frame - startFrame);

  // Smooth entry blending (0 to 1)
  const blendT = blendDuration > 0
    ? Math.min(1, localFrame / blendDuration)
    : 1;

  switch (action) {
    case "walk": {
      // 1 full step cycle every ~24 frames at normal speed
      const cycleFrames = Math.max(8, Math.round(24 / Math.max(0.1, speed)));
      const phase = (localFrame / cycleFrames) * 2 * Math.PI;
      const walk = walkPose(phase, {
        stride: stride * intensity,
        lift: lift * intensity,
        bob: bob * intensity,
        run: false
      });
      return blendDuration > 0 ? blendPose(POSES.stand, walk, blendT) : walk;
    }

    case "run": {
      // Fast run cycle every ~14 frames
      const cycleFrames = Math.max(6, Math.round(14 / Math.max(0.1, speed)));
      const phase = (localFrame / cycleFrames) * 2 * Math.PI;
      const run = walkPose(phase, {
        stride: (stride + 20) * intensity,
        lift: (lift + 16) * intensity,
        bob: (bob + 4) * intensity,
        run: true
      });
      return blendDuration > 0 ? blendPose(POSES.stand, run, blendT) : run;
    }

    case "wave": {
      const base = blendPose(POSES.stand, POSES.wave, blendT);
      return wavingPose(base, localFrame, 0.35 * speed, 18 * intensity);
    }

    case "talk": {
      // Oscillate naturally between talk and explain poses
      const talkCycle = (Math.sin(localFrame * 0.15 * speed) + 1) / 2;
      const gestured = blendPose(POSES.talk, POSES.explain, talkCycle);
      const breathing = breathePose(gestured, localFrame, 0.08, 2.5 * intensity);
      return blendDuration > 0 ? blendPose(POSES.stand, breathing, blendT) : breathing;
    }

    case "point": {
      const target = POSES.point;
      const blended = blendPose(POSES.stand, target, blendT);
      return breathePose(blended, localFrame, 0.06, 1.5 * intensity);
    }

    case "pointUp": {
      const target = POSES.pointUp;
      const blended = blendPose(POSES.stand, target, blendT);
      return breathePose(blended, localFrame, 0.06, 1.5 * intensity);
    }

    case "think": {
      const target = POSES.think;
      const blended = blendPose(POSES.stand, target, blendT);
      return breathePose(blended, localFrame, 0.07, 2 * intensity);
    }

    case "surprise": {
      // Small recoil jump on start
      const recoil = Math.max(0, Math.sin(Math.min(Math.PI, localFrame * 0.3))) * 12 * intensity;
      const target = POSES.handsOnHead;
      const base = blendPose(POSES.stand, target, blendT);
      return {
        ...base,
        head: [base.head[0], base.head[1] - recoil],
        sh: [base.sh[0], base.sh[1] - recoil],
        hip: [base.hip[0], base.hip[1] - recoil * 0.8]
      };
    }

    case "happy":
    case "cheer": {
      // Joyful cheer bounce
      const bounce = Math.abs(Math.sin(localFrame * 0.25 * speed)) * 8 * intensity;
      const base = blendPose(POSES.stand, POSES.cheer, blendT);
      return {
        ...base,
        head: [base.head[0], base.head[1] - bounce],
        sh: [base.sh[0], base.sh[1] - bounce],
        hF: [base.hF[0] + Math.sin(localFrame * 0.3) * 6, base.hF[1] - bounce],
        hB: [base.hB[0] - Math.sin(localFrame * 0.3) * 6, base.hB[1] - bounce]
      };
    }

    case "sad": {
      const target = POSES.sad;
      const blended = blendPose(POSES.stand, target, blendT);
      return breathePose(blended, localFrame, 0.05, 1.8 * intensity);
    }

    case "angry": {
      const target = POSES.ready;
      const blended = blendPose(POSES.stand, target, blendT);
      // Tense breathing
      return breathePose(blended, localFrame, 0.12, 1.5 * intensity);
    }

    case "sit": {
      const target = POSES.sit;
      return blendDuration > 0 ? blendPose(POSES.stand, target, blendT) : target;
    }

    case "standUp": {
      // Progress from sit to stand over blendDuration
      return blendPose(POSES.sit, POSES.stand, blendT);
    }

    case "holdObject": {
      const target = POSES.holdFront;
      const blended = blendPose(POSES.stand, target, blendT);
      return breathePose(blended, localFrame, 0.07, 2 * intensity);
    }

    case "crossArms": {
      const target = POSES.crossArms;
      const blended = blendPose(POSES.stand, target, blendT);
      return breathePose(blended, localFrame, 0.06, 2 * intensity);
    }

    case "idle":
    default: {
      return breathePose(POSES.stand, localFrame, 0.08 * speed, 3 * intensity);
    }
  }
}
