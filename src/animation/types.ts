/**
 * Type definitions for Stickman Rig V2 Animation System
 */

export type LimbPoint = [number, number];

export interface PoseJoints {
  head: LimbPoint;
  sh: LimbPoint;     // Shoulder / neck base
  hip: LimbPoint;    // Hip center
  eF: LimbPoint;     // Near elbow
  hF: LimbPoint;     // Near hand
  eB: LimbPoint;     // Far elbow
  hB: LimbPoint;     // Far hand
  kF: LimbPoint;     // Near knee
  fF: LimbPoint;     // Near foot
  kB: LimbPoint;     // Far knee
  fB: LimbPoint;     // Far foot
}

export type ActionType =
  | "idle"
  | "blink"
  | "talk"
  | "walk"
  | "run"
  | "point"
  | "pointUp"
  | "wave"
  | "think"
  | "surprise"
  | "happy"
  | "sad"
  | "angry"
  | "sit"
  | "standUp"
  | "holdObject"
  | "cheer"
  | "crossArms";

export type ExpressionType =
  | "neutral"
  | "happy"
  | "joy"
  | "smile"
  | "surprised"
  | "shocked"
  | "scared"
  | "worried"
  | "nervous"
  | "angry"
  | "determined"
  | "sad"
  | "cry"
  | "smirk"
  | "sleepy"
  | "thinking"
  | "confused"
  | "awe";

export interface OutfitConfig {
  top?: "tunic" | "hoodie" | "suit" | "tshirt" | "dress" | "trench" | "labcoat" | "none";
  color?: string;
  color2?: string;
  legs?: string;
  gloves?: string;
  head?: "hood" | "ponytail" | "bun" | "helmet" | "crown" | "none";
  headColor?: string;
  face?: "glasses" | "sunglasses" | "none";
  kid?: boolean;
}

export interface CharacterConfig {
  id?: string;
  name?: string;
  x: number;
  y: number;
  scale?: number;
  facing?: 1 | -1;          // 1 = facing right, -1 = facing left
  action?: ActionType;
  actionProgress?: number;  // 0 to 1 progress within custom action
  emotion?: ExpressionType;
  outfit?: OutfitConfig;
  prop?: "flag" | "sword" | "shield" | "scroll" | "torch" | "book" | "none";
  isTalking?: boolean;
  opacity?: number;
}

export type EnvironmentMood = "day" | "golden" | "dusk" | "night";

export interface CastleEnvironmentProps {
  mood?: EnvironmentMood;
  showSun?: boolean;
  showMountains?: boolean;
  showWall?: boolean;
  showGate?: boolean;
  showFlag?: boolean;
  flagColor?: string;
  flagEmblemColor?: string;
  torchFlicker?: boolean;
  children?: React.ReactNode;
}

export interface CameraKeyframe {
  frame: number;
  scale: number;
  panX: number;
  panY: number;
}

export interface StoryboardScene {
  id: string;
  title?: string;
  startFrame: number;
  durationInFrames: number;
  dialogue?: string;
  subtitle?: string;
  voiceAudioSrc?: string;
  environment?: {
    type: "castle" | "void";
    mood?: EnvironmentMood;
  };
  camera?: {
    type: "static" | "panLeft" | "panRight" | "zoomIn" | "zoomOut" | "dramatic";
    scaleStart?: number;
    scaleEnd?: number;
    panXStart?: number;
    panXEnd?: number;
    panYStart?: number;
    panYEnd?: number;
  };
  characters: CharacterConfig[];
  transition?: "none" | "fade" | "slide" | "wipe";
}

export interface StoryboardProject {
  title: string;
  description?: string;
  fps: number;
  width: number;
  height: number;
  characterStyle: "stickman-v2";
  scenes: StoryboardScene[];
}

