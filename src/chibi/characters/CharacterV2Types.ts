/**
 * src/chibi/characters/CharacterV2Types.ts
 * Type definitions for Chibi Character System V2
 */

export type ChibiFacingV2 =
  | 'front'
  | 'three_quarter_left'
  | 'three_quarter_right'
  | 'side_left'
  | 'side_right'
  | 'back';

export type ChibiExpressionV2 =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'confused'
  | 'thinking'
  | 'laughing'
  | 'worried';

export type ChibiPoseNameV2 =
  | 'idle'
  | 'stand'
  | 'walk'
  | 'run'
  | 'sit'
  | 'sit_chair'
  | 'stand_up'
  | 'wave'
  | 'point'
  | 'talk'
  | 'phone'
  | 'cup'
  | 'hold_object'
  | 'look_around';

export interface ChibiHairConfig {
  style: 'short' | 'bun' | 'curly' | 'spiky' | 'side_part' | 'long' | 'bob' | 'ponytail';
  color: string;
  highlight?: string;
}

export interface ChibiFaceConfig {
  eyeStyle?: 'oval' | 'round' | 'sparkle' | 'dot';
  eyeColor?: string;
  browStyle?: 'soft' | 'sharp' | 'worried';
  mouthStyle?: 'smile' | 'grin' | 'neutral' | 'flat';
  blush?: boolean;
  freckles?: boolean;
}

export interface ChibiProportions {
  headScale: number;    // default 1.0 (relative head size, radius ~36)
  torsoLength: number;  // default 36 (distance from neck to pelvis)
  armLength: number;    // default 34 (upper arm ~18 + forearm ~16)
  legLength: number;    // default 46 (thigh ~24 + calf ~22)
}

export interface ChibiOutfitConfig {
  id?: string;
  type: 'casual' | 'hoodie' | 'tshirt' | 'suit' | 'labcoat' | 'explorer' | 'dress';
  topColor: string;
  topColor2?: string;
  pantsColor: string;
  shoeColor: string;
  headwear?: 'none' | 'cap' | 'capBack' | 'beanie' | 'fedora' | 'headband';
  headwearColor?: string;
  accessories?: string[]; // e.g. ['glasses', 'sunglasses', 'backpack', 'pen']
}

export interface CharacterIdentityV2 {
  id: string;
  name: string;
  gender?: 'boy' | 'girl' | 'neutral';
  skinColor: string;
  hair: ChibiHairConfig;
  face: ChibiFaceConfig;
  proportions: ChibiProportions;
  outfit: ChibiOutfitConfig;
  defaultExpression?: ChibiExpressionV2;
  defaultFacing?: ChibiFacingV2;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChibiJoint {
  x: number;
  y: number;
  angle?: number;
}

export interface ChibiSkeletonV2 {
  // Center spine chain
  hip: [number, number];       // Pelvis root
  sh: [number, number];        // Shoulder / Neck base
  head: [number, number];      // Head center anchor

  // Near Arm (closer to camera)
  shNear: [number, number];    // Near shoulder joint
  eNear: [number, number];     // Near elbow joint
  hNear: [number, number];     // Near hand/wrist joint

  // Far Arm (behind torso)
  shFar: [number, number];     // Far shoulder joint
  eFar: [number, number];      // Far elbow joint
  hFar: [number, number];      // Far hand/wrist joint

  // Near Leg (closer to camera)
  hipNear: [number, number];   // Near hip joint
  kNear: [number, number];     // Near knee joint
  fNear: [number, number];     // Near ankle/foot joint

  // Far Leg (behind pelvis)
  hipFar: [number, number];    // Far hip joint
  kFar: [number, number];      // Far knee joint
  fFar: [number, number];      // Far ankle/foot joint
}

export interface ChibiCharacterV2Props {
  character?: CharacterIdentityV2 | string; // ID or full object
  x?: number;
  y?: number;
  scale?: number;
  facing?: ChibiFacingV2;
  pose?: ChibiPoseNameV2 | Partial<ChibiSkeletonV2>;
  expression?: ChibiExpressionV2;
  talk?: number;          // mouth openness 0.0 to 1.0
  blink?: boolean;
  look?: [number, number]; // [-1..1, -1..1] gaze direction
  prop?: string | { type: string; hand?: 'near' | 'far' };
  rimLight?: boolean | string;
  showShadow?: boolean;
  className?: string;
  id?: string;
}

