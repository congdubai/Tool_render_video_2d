// engine/v5-layer-camera-builder.js — 11-Layer Composition & Camera Framing (V5 Phase 3)
// Enforces 11-layer compositing order and calculates camera framing for 10 presets and target bounding boxes.

import { LAYER_GROUPS } from './v5-scene-graph.js';
import { SAFE_AREAS } from './v5-coordinate-system.js';

export const CAMERA_PRESETS = {
  ESTABLISHING_SHOT: { id: 'establishing_shot', name: 'Establishing Shot', zoom: 0.85, x: 0, y: 0 },
  WIDE_SHOT: { id: 'wide_shot', name: 'Wide Shot', zoom: 1.0, x: 0, y: 0 },
  FULL_SHOT: { id: 'full_shot', name: 'Full Shot', zoom: 1.05, x: 0, y: -20 },
  MEDIUM_SHOT: { id: 'medium_shot', name: 'Medium Shot', zoom: 1.15, x: 0, y: -40 },
  CLOSE_UP: { id: 'close_up', name: 'Close-up', zoom: 1.35, x: 0, y: -80 },
  EXTREME_CLOSE_UP: { id: 'extreme_close_up', name: 'Extreme Close-up', zoom: 1.65, x: 0, y: -120 },
  TWO_SHOT: { id: 'two_shot', name: 'Two Shot', zoom: 1.10, x: 0, y: -30 },
  GROUP_SHOT: { id: 'group_shot', name: 'Group Shot', zoom: 1.0, x: 0, y: -20 },
  OBJECT_CLOSE_UP: { id: 'object_close_up', name: 'Object Close-up', zoom: 1.40, x: 0, y: -50 },
  DIAGRAM_SHOT: { id: 'diagram_shot', name: 'Diagram Shot', zoom: 1.0, x: 0, y: 0 }
};

/**
 * Assigns proper Layer Group and Z-Index to a node based on its type and relationship
 */
export function assignLayerAndZIndex(node, options = {}) {
  const type = node.type;

  switch (type) {
    case 'background':
      node.layerGroup = LAYER_GROUPS.BACKGROUND;
      node.zIndex = 0;
      break;

    case 'environment_layer':
      node.layerGroup = options.isForeground ? LAYER_GROUPS.FRONT_ENV : LAYER_GROUPS.BACKGROUND_ENV;
      node.zIndex = options.isForeground ? 20 : 2;
      break;

    case 'character':
      node.layerGroup = LAYER_GROUPS.CHARACTERS;
      node.zIndex = options.zIndex || 10;
      break;

    case 'prop':
      if (node.parentId && node.parentId !== 'root') {
        // Attached prop (e.g. handheld) sits in front of hand
        node.layerGroup = LAYER_GROUPS.ATTACHED_PROPS;
        node.zIndex = 15;
      } else {
        // Free-standing prop on floor or desk
        node.layerGroup = options.inFrontOfCharacter ? LAYER_GROUPS.FRONT_ENV : LAYER_GROUPS.MIDGROUND_OBJECTS;
        node.zIndex = options.inFrontOfCharacter ? 18 : 8;
      }
      break;

    case 'vfx':
      node.layerGroup = options.isRear ? LAYER_GROUPS.REAR_VFX : LAYER_GROUPS.FRONT_VFX;
      node.zIndex = options.isRear ? 4 : 22;
      break;

    case 'text':
    case 'graphic':
    case 'diagram':
      node.layerGroup = LAYER_GROUPS.TEXT_GRAPHICS;
      node.zIndex = 30;
      break;

    case 'foreground':
      node.layerGroup = LAYER_GROUPS.FOREGROUND;
      node.zIndex = 24;
      break;

    default:
      node.layerGroup = LAYER_GROUPS.MIDGROUND_OBJECTS;
      node.zIndex = 5;
  }
}

/**
 * Calculates camera framing based on subject bounding boxes, desired headroom, and target presets
 */
export function calculateCameraFraming(targets = [], options = {}) {
  const presetKey = (options.preset || 'medium_shot').toUpperCase();
  const basePreset = CAMERA_PRESETS[presetKey] || CAMERA_PRESETS.MEDIUM_SHOT;

  if (targets.length === 0) {
    return {
      preset: basePreset.id,
      zoom: basePreset.zoom,
      x: basePreset.x,
      y: basePreset.y,
      rotation: 0,
      shake: 0,
      followTarget: null
    };
  }

  // Calculate union bounding box of all targets in normalized space [0..1]
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const box of targets) {
    if (box.left < minX) minX = box.left;
    if (box.top < minY) minY = box.top;
    if (box.right > maxX) maxX = box.right;
    if (box.bottom > maxY) maxY = box.bottom;
  }

  const unionWidth = Math.max(0.01, maxX - minX);
  const unionHeight = Math.max(0.01, maxY - minY);
  const centerX = minX + unionWidth / 2;
  const centerY = minY + unionHeight / 2;

  // Fit into safe area
  const safeWidth = SAFE_AREAS.ACTION.right - SAFE_AREAS.ACTION.left;
  const safeHeight = SAFE_AREAS.ACTION.bottom - SAFE_AREAS.ACTION.top;

  const zoomFactorX = safeWidth / unionWidth;
  const zoomFactorY = safeHeight / unionHeight;
  let optimalZoom = Math.min(zoomFactorX, zoomFactorY);

  // Blend with preset zoom to avoid extreme zoom-in or zoom-out
  optimalZoom = Math.max(0.85, Math.min(2.0, (optimalZoom * 0.4) + (basePreset.zoom * 0.6)));

  // Center camera on targets (converted from normalized offset [0..1] to pixel offset at 1920x1080)
  const offsetX = Math.round((centerX - 0.5) * 1920);
  const offsetY = Math.round((centerY - 0.5) * 1080);

  return {
    preset: basePreset.id,
    zoom: Math.round(optimalZoom * 100) / 100,
    x: offsetX,
    y: offsetY,
    rotation: 0,
    shake: options.shake || 0,
    followTarget: options.followTarget || null
  };
}

