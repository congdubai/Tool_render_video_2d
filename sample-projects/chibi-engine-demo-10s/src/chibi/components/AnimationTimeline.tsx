import { ChibiAction, ChibiFacing } from '../characters/CharacterTypes';

export interface TimelineSegment {
  startFrame: number;
  endFrame: number;
  action: ChibiAction;
  startX?: number;
  endX?: number;
  startY?: number;
  endY?: number;
  facing?: ChibiFacing;
  speed?: number;
  intensity?: number;
  blendDuration?: number; // số frame chuyển trạng thái mượt mà (ease in/out)
}

/**
 * Hàm nội suy vị trí và trọng số hành động theo timeline
 */
export function resolveTimelineSegment(
  frame: number,
  segments: TimelineSegment[],
  defaultX = 960,
  defaultY = 900
): {
  currentAction: ChibiAction;
  weight: number;
  x: number;
  y: number;
  facing: ChibiFacing;
  speed: number;
  intensity: number;
} {
  if (!segments || segments.length === 0) {
    return {
      currentAction: 'idle',
      weight: 1.0,
      x: defaultX,
      y: defaultY,
      facing: 'right',
      speed: 1.0,
      intensity: 1.0,
    };
  }

  // Tìm segment tương ứng với frame hiện tại
  const segIndex = segments.findIndex((s) => frame >= s.startFrame && frame <= s.endFrame);

  if (segIndex === -1) {
    // Nếu trước segment đầu tiên
    if (frame < segments[0].startFrame) {
      const first = segments[0];
      return {
        currentAction: 'idle',
        weight: 1.0,
        x: first.startX ?? defaultX,
        y: first.startY ?? defaultY,
        facing: first.facing ?? 'right',
        speed: 1.0,
        intensity: 1.0,
      };
    }
    // Nếu sau segment cuối cùng
    const last = segments[segments.length - 1];
    return {
      currentAction: 'idle',
      weight: 1.0,
      x: last.endX ?? last.startX ?? defaultX,
      y: last.endY ?? last.startY ?? defaultY,
      facing: last.facing ?? 'right',
      speed: 1.0,
      intensity: 1.0,
    };
  }

  const seg = segments[segIndex];
  const segDuration = Math.max(1, seg.endFrame - seg.startFrame);
  const progress = Math.max(0, Math.min(1, (frame - seg.startFrame) / segDuration));

  // Easing mượt mà (smoothstep / cubic)
  const smoothProgress = progress * progress * (3 - 2 * progress);

  const startX = seg.startX ?? defaultX;
  const endX = seg.endX ?? startX;
  const startY = seg.startY ?? defaultY;
  const endY = seg.endY ?? startY;

  const currentX = startX + (endX - startX) * smoothProgress;
  const currentY = startY + (endY - startY) * smoothProgress;

  return {
    currentAction: seg.action,
    weight: 1.0,
    x: currentX,
    y: currentY,
    facing: seg.facing ?? 'right',
    speed: seg.speed ?? 1.0,
    intensity: seg.intensity ?? 1.0,
  };
}
