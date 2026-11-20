import { ChibiColors, ChibiPose } from '../characters/CharacterTypes';

/**
 * Bảng màu chuẩn từ Chibi V9 - Quân phục / Adventure Style
 */
export const defaultChibiColors: Required<ChibiColors> = {
  ink: '#191918',
  skin: '#f8eac1',
  hair: '#343536',
  hairHighlight: '#666869',
  jacket: '#6e7a64',
  jacketSeam: '#414a3d',
  pocket: '#8c8b68',
  sleeveNear: '#778370',
  sleeveFar: '#596751',
  pantsNear: '#74816b',
  pantsFar: '#596450',
  boots: '#222222',
  bootsFar: '#252525',
  backpack: '#56624b',
  backpackStripe: '#9ca17d',
  backpackStrap: '#465341',
};

/**
 * Bảng màu biến thể: Scout / Casual Explorer
 */
export const explorerChibiColors: Required<ChibiColors> = {
  ink: '#1e1c1b',
  skin: '#fae8c8',
  hair: '#4a3728',
  hairHighlight: '#7c624b',
  jacket: '#3b6e8c',
  jacketSeam: '#254b61',
  pocket: '#d9a74a',
  sleeveNear: '#477ea0',
  sleeveFar: '#2e5b75',
  pantsNear: '#4b5563',
  pantsFar: '#374151',
  boots: '#1f2937',
  bootsFar: '#111827',
  backpack: '#b45309',
  backpackStripe: '#fde68a',
  backpackStrap: '#78350f',
};

/**
 * Tư thế đứng nghỉ (Idle) mặc định
 */
export const defaultIdlePose: ChibiPose = {
  bobY: 0,
  torsoLean: 0,
  headAngle: 0,
  headBlink: false,
  mouthOpen: 0,
  farArmAngle: -4,
  farArmForearmAngle: 0,
  nearArmAngle: 6,
  nearArmForearmAngle: 0,
  farLegAngle: 0,
  farFootLift: 0,
  farFootAngle: 0,
  nearLegAngle: 0,
  nearFootLift: 0,
  nearFootAngle: 0,
  facing: 'right',
  showBackpack: true,
};
