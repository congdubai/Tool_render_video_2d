export type ChibiFacing = 'right' | 'left';

export type ChibiAction = 'idle' | 'walk' | 'run' | 'talk' | 'wave' | 'point' | 'custom';

export interface ChibiColors {
  ink?: string;               // Viền đen đậm nét Chibi V9 (default: #191918)
  skin?: string;              // Màu da mặt & bàn tay (default: #f8eac1)
  hair?: string;              // Màu tóc / mũ (default: #343536)
  hairHighlight?: string;     // Highlight tóc (default: #666869)
  jacket?: string;            // Màu áo chính thân trước (default: #6e7a64)
  jacketSeam?: string;        // Màu đường may áo (default: #414a3d)
  pocket?: string;            // Màu túi áo (default: #8c8b68)
  sleeveNear?: string;        // Màu tay áo gần (default: #778370)
  sleeveFar?: string;         // Màu tay áo xa (default: #596751)
  pantsNear?: string;         // Màu quần chân gần (default: #74816b)
  pantsFar?: string;          // Màu quần chân xa (default: #596450)
  boots?: string;             // Màu ủng / giày (default: #222222)
  bootsFar?: string;          // Màu ủng chân xa (default: #252525)
  backpack?: string;          // Màu balo phía sau lưng (default: #56624b)
  backpackStripe?: string;    // Màu viền balo (default: #9ca17d)
  backpackStrap?: string;     // Màu dây đeo vai (default: #465341)
}

export interface ChibiPose {
  bobY: number;               // Độ nhún thân trên trục Y
  torsoLean: number;          // Góc nghiêng thân (độ)
  headAngle: number;          // Góc nghiêng đầu (độ)
  headBlink: boolean;         // Trạng thái chớp mắt (true: mắt nhắm)
  mouthOpen: number;          // Độ mở khẩu hình miệng (0: khép, 1: mở to)
  
  farArmAngle: number;        // Góc xoay tay phía xa
  farArmForearmAngle?: number;// Góc xoay cẳng tay xa
  
  nearArmAngle: number;       // Góc xoay tay gần camera
  nearArmForearmAngle?: number;// Góc xoay cẳng tay gần
  
  farLegAngle: number;        // Góc xoay hông chân xa
  farFootLift: number;        // Nâng gót/chân xa
  farFootAngle: number;       // Góc xoay cổ chân xa
  
  nearLegAngle: number;       // Góc xoay hông chân gần
  nearFootLift: number;       // Nâng gót/chân gần
  nearFootAngle: number;      // Góc xoay cổ chân gần
  
  facing?: ChibiFacing;       // Hướng nhìn 3/4 ('right' | 'left')
  showBackpack?: boolean;     // Hiển thị balo (mặc định: true)
}

export interface ChibiAnimationConfig {
  action: ChibiAction;
  startFrame?: number;
  duration?: number;
  speed?: number;             // Hệ số tốc độ (1.0 là chuẩn)
  direction?: 1 | -1;         // 1: sang phải, -1: sang trái
  intensity?: number;         // Cường độ chuyển động (0.0 - 1.5)
  facing?: ChibiFacing;
  showBackpack?: boolean;
}

export interface ChibiCharacterProps {
  frame: number;
  fps?: number;
  x?: number;
  y?: number;
  scale?: number;
  facing?: ChibiFacing;
  action?: ChibiAction;
  animationConfig?: Partial<ChibiAnimationConfig>;
  poseOverride?: Partial<ChibiPose>;
  colors?: Partial<ChibiColors>;
  showBackpack?: boolean;
  showShadow?: boolean;
  className?: string;
  id?: string;
}
