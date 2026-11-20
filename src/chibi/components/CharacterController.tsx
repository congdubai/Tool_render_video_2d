import React from 'react';
import { useCurrentFrame } from 'remotion';
import { ChibiCharacter } from '../characters/ChibiCharacter';
import { ChibiCharacterProps } from '../characters/CharacterTypes';
import { resolveTimelineSegment, TimelineSegment } from './AnimationTimeline';

export interface CharacterControllerProps extends Partial<ChibiCharacterProps> {
  timeline?: TimelineSegment[];
}

export const CharacterController: React.FC<CharacterControllerProps> = ({
  timeline,
  frame: propFrame,
  fps = 30,
  x = 960,
  y = 900,
  scale = 1.25,
  facing = 'right',
  action = 'idle',
  colors,
  showBackpack = true,
  showShadow = true,
  className,
  id,
}) => {
  // Nếu không truyền frame thì dùng useCurrentFrame() của Remotion
  const remotionFrame = useCurrentFrame();
  const currentFrame = propFrame ?? remotionFrame;

  if (timeline && timeline.length > 0) {
    const resolved = resolveTimelineSegment(currentFrame, timeline, x, y);
    return (
      <ChibiCharacter
        id={id}
        className={className}
        frame={currentFrame}
        fps={fps}
        x={resolved.x}
        y={resolved.y}
        scale={scale}
        facing={resolved.facing}
        action={resolved.currentAction}
        animationConfig={{
          speed: resolved.speed,
          intensity: resolved.intensity,
        }}
        colors={colors}
        showBackpack={showBackpack}
        showShadow={showShadow}
      />
    );
  }

  return (
    <ChibiCharacter
      id={id}
      className={className}
      frame={currentFrame}
      fps={fps}
      x={x}
      y={y}
      scale={scale}
      facing={facing}
      action={action}
      colors={colors}
      showBackpack={showBackpack}
      showShadow={showShadow}
    />
  );
};

