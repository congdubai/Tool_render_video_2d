// engine/v5-composition-engine.js — Intelligent Composition & Visual Hierarchy Engine (V5 Phase 3)
// Governs scene composition, background placement zones, ground contact calculation,
// facing direction orientation, and visual hierarchy weighting.

import { ANCHORS } from './v5-coordinate-system.js';
import { selectBestLayoutTemplate } from './v5-layout-templates.js';

export const BACKGROUND_ZONES = {
  FLOOR_LEFT: { id: 'floor_left', left: 0.10, top: 0.60, right: 0.40, bottom: 0.90, groundY: 0.80 },
  FLOOR_CENTER: { id: 'floor_center', left: 0.35, top: 0.60, right: 0.65, bottom: 0.90, groundY: 0.80 },
  FLOOR_RIGHT: { id: 'floor_right', left: 0.60, top: 0.60, right: 0.90, bottom: 0.90, groundY: 0.80 },
  TABLE_SURFACE: { id: 'table_surface', left: 0.45, top: 0.55, right: 0.85, bottom: 0.75, groundY: 0.68 },
  DOORWAY: { id: 'doorway', left: 0.15, top: 0.20, right: 0.35, bottom: 0.80, groundY: 0.80 },
  WINDOW_AREA: { id: 'window_area', left: 0.65, top: 0.15, right: 0.85, bottom: 0.55, groundY: 0.55 },
  FOREGROUND_LEFT: { id: 'foreground_left', left: 0.05, top: 0.70, right: 0.30, bottom: 0.95, groundY: 0.88 },
  BACKGROUND_RIGHT: { id: 'background_right', left: 0.70, top: 0.40, right: 0.95, bottom: 0.75, groundY: 0.70 }
};

export const VISUAL_ROLES = {
  PRIMARY_SUBJECT: { weight: 1.0, scaleMultiplier: 1.15, defaultZIndex: 12 },
  SECONDARY_SUBJECT: { weight: 0.8, scaleMultiplier: 1.0, defaultZIndex: 10 },
  SUPPORTING: { weight: 0.6, scaleMultiplier: 0.88, defaultZIndex: 8 },
  DECORATIVE: { weight: 0.4, scaleMultiplier: 0.75, defaultZIndex: 6 }
};

export const FACING_DIRECTIONS = {
  FRONT: 0,
  RIGHT: 1,
  LEFT: -1,
  BACK: 2,
  THREE_QUARTER_RIGHT: 1.5,
  THREE_QUARTER_LEFT: -1.5
};

/**
 * Checks if a character sprite can be safely flipped horizontally
 */
export function canFlipHorizontally(characterData = {}) {
  if (characterData.allowFlip === false) return false;
  if (characterData.hasAsymmetricText) return false;
  if (characterData.fixedOrientation) return false;
  return true;
}

/**
 * Calculates ground contact position for a character or object
 */
export function calculateGroundContactY(background = {}, pose = 'stand') {
  const defaultGroundY = 0.80; // 80% from top in normalized coords
  let groundY = defaultGroundY;

  if (typeof background.groundY === 'number') {
    groundY = background.groundY <= 1.0 ? background.groundY : background.groundY / 720;
  }

  switch (pose) {
    case 'sit':
      return groundY - 0.06; // sitting lower
    case 'lie':
      return groundY - 0.02;
    case 'float':
    case 'fly':
      return groundY - 0.20; // floating above ground
    default:
      return groundY;
  }
}

/**
 * Composes a full scene layout by picking template, assigning zones, and calculating positions
 */
export function computeSceneComposition(sceneDescriptor = {}, projectContext = {}) {
  const template = selectBestLayoutTemplate(sceneDescriptor);
  const layoutResult = template.applyLayout({
    characters: sceneDescriptor.characters,
    props: sceneDescriptor.props,
    visualObjective: sceneDescriptor.visualObjective,
    labels: sceneDescriptor.labels
  });

  const backgroundMeta = sceneDescriptor.background || {};
  const groundY = calculateGroundContactY(backgroundMeta);

  // 1. Process character placements
  const composedCharacters = (sceneDescriptor.characters || []).map((c, idx) => {
    const templateChar = layoutResult.characters?.[idx] || { position: { x: 0.5, y: groundY }, scale: 1.0, facing: 1 };
    
    // Explicit position in sceneDescriptor takes precedence if given as valid number
    const posX = typeof c.position?.x === 'number' ? (c.position.x <= 1.0 ? c.position.x : c.position.x / 1280) : templateChar.position.x;
    const posY = typeof c.position?.y === 'number' ? (c.position.y <= 1.0 ? c.position.y : c.position.y / 720) : templateChar.position.y;

    let facing = c.facing ?? templateChar.facing ?? FACING_DIRECTIONS.RIGHT;
    
    // Dialogue auto-facing: if 2 characters, ensure they face each other
    if (sceneDescriptor.characters.length === 2 && c.facing === undefined) {
      facing = idx === 0 ? FACING_DIRECTIONS.RIGHT : FACING_DIRECTIONS.LEFT;
    }

    const visualRole = idx === 0 ? VISUAL_ROLES.PRIMARY_SUBJECT : VISUAL_ROLES.SECONDARY_SUBJECT;
    const effectiveScale = (c.scale ?? templateChar.scale ?? 1.0) * (idx === 0 ? visualRole.scaleMultiplier : 1.0);

    return {
      instanceId: c.instanceId || c.characterId || `char_${idx + 1}`,
      characterId: c.characterId || 'doc',
      role: c.role || (idx === 0 ? 'main' : 'supporting'),
      position: { x: posX, y: posY },
      scale: effectiveScale,
      facing,
      anchor: ANCHORS.BOTTOM_CENTER,
      outfitId: c.outfitId || null,
      expressionId: c.expressionId || 'neutral',
      zIndex: templateChar.zIndex || visualRole.defaultZIndex,
      locked: c.locked ?? false
    };
  });

  // 2. Process prop placements
  const composedProps = (sceneDescriptor.props || []).map((p, idx) => {
    const templateProp = layoutResult.props?.[idx] || { position: { x: 0.70, y: groundY }, scale: 1.0 };
    
    const posX = typeof p.position?.x === 'number' ? (p.position.x <= 1.0 ? p.position.x : p.position.x / 1280) : templateProp.position.x;
    const posY = typeof p.position?.y === 'number' ? (p.position.y <= 1.0 ? p.position.y : p.position.y / 720) : templateProp.position.y;

    return {
      instanceId: p.instanceId || `prop_${idx + 1}`,
      assetId: p.assetId || p.id,
      position: { x: posX, y: posY },
      scale: p.scale ?? templateProp.scale ?? 1.0,
      rotation: p.rotation ?? 0.0,
      attachedTo: p.attachedTo || p.placement?.target || null,
      anchorPreset: p.anchorPreset || p.placement?.anchor || 'center',
      zIndex: p.zIndex || 9,
      locked: p.locked ?? false
    };
  });

  return {
    templateId: template.id,
    templateName: template.name,
    cameraPreset: sceneDescriptor.camera?.preset || template.defaultCameraPreset,
    groundY,
    characters: composedCharacters,
    props: composedProps,
    textGraphics: layoutResult.textGraphics || sceneDescriptor.textGraphics || []
  };
}

