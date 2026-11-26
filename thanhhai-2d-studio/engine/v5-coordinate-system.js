// engine/v5-coordinate-system.js — Coordinate System & Resolution Independence (V5 Phase 3)
// Provides normalized (0..1) <-> pixel coordinates transformation, safe area bounds,
// anchor geometry, bounding box calculations, and resolution scaling (720p, 1080p, 4K).

export const RESOLUTIONS = {
  HD_720P: { width: 1280, height: 720, name: '720p' },
  FHD_1080P: { width: 1920, height: 1080, name: '1080p' },
  UHD_4K: { width: 3840, height: 2160, name: '4K' }
};

export const DEFAULT_RESOLUTION = RESOLUTIONS.FHD_1080P;

export const SAFE_AREAS = {
  ACTION: { left: 0.05, top: 0.05, right: 0.95, bottom: 0.95 },
  TITLE: { left: 0.10, top: 0.10, right: 0.90, bottom: 0.90 }
};

export const ANCHORS = {
  TOP_LEFT: { x: 0.0, y: 0.0 },
  TOP_CENTER: { x: 0.5, y: 0.0 },
  TOP_RIGHT: { x: 1.0, y: 0.0 },
  CENTER_LEFT: { x: 0.0, y: 0.5 },
  CENTER: { x: 0.5, y: 0.5 },
  CENTER_RIGHT: { x: 1.0, y: 0.5 },
  BOTTOM_LEFT: { x: 0.0, y: 1.0 },
  BOTTOM_CENTER: { x: 0.5, y: 1.0 },
  BOTTOM_RIGHT: { x: 1.0, y: 1.0 },
  GROUND_CONTACT: { x: 0.5, y: 1.0 },
  FOOT_ANCHOR: { x: 0.5, y: 1.0 },
  HAND_GRIP: { x: 0.5, y: 0.5 },
  HEAD_ANCHOR: { x: 0.5, y: 0.15 }
};

/**
 * Converts normalized coordinates [0..1] to pixel coordinates for a given resolution
 */
export function normalizedToPixel(normPoint, res = DEFAULT_RESOLUTION) {
  const nx = typeof normPoint.x === 'number' ? normPoint.x : normPoint[0];
  const ny = typeof normPoint.y === 'number' ? normPoint.y : normPoint[1];
  return {
    x: Math.round(nx * res.width),
    y: Math.round(ny * res.height)
  };
}

/**
 * Converts pixel coordinates to normalized coordinates [0..1]
 */
export function pixelToNormalized(pixelPoint, res = DEFAULT_RESOLUTION) {
  const px = typeof pixelPoint.x === 'number' ? pixelPoint.x : pixelPoint[0];
  const py = typeof pixelPoint.y === 'number' ? pixelPoint.y : pixelPoint[1];
  return {
    x: res.width > 0 ? px / res.width : 0,
    y: res.height > 0 ? py / res.height : 0
  };
}

/**
 * Calculates a bounding box in normalized coordinates given position, size, anchor, and scale
 */
export function calculateBoundingBox(options = {}) {
  const pos = options.position || { x: 0.5, y: 0.5 };
  const size = options.size || { width: 0.2, height: 0.3 };
  const anchor = options.anchor || ANCHORS.BOTTOM_CENTER;
  const scale = options.scale ?? 1.0;
  const scaleX = (options.scaleX ?? scale);
  const scaleY = (options.scaleY ?? scale);

  const effectiveWidth = Math.abs(size.width * scaleX);
  const effectiveHeight = Math.abs(size.height * scaleY);

  const posX = typeof pos.x === 'number' ? pos.x : pos[0];
  const posY = typeof pos.y === 'number' ? pos.y : pos[1];

  const left = posX - (anchor.x * effectiveWidth);
  const top = posY - (anchor.y * effectiveHeight);

  return {
    left,
    top,
    right: left + effectiveWidth,
    bottom: top + effectiveHeight,
    width: effectiveWidth,
    height: effectiveHeight,
    centerX: left + effectiveWidth / 2,
    centerY: top + effectiveHeight / 2
  };
}

/**
 * Checks whether two normalized bounding boxes intersect
 */
export function doBoxesIntersect(boxA, boxB, margin = 0.0) {
  if (!boxA || !boxB) return false;
  return !(
    boxA.right - margin <= boxB.left + margin ||
    boxA.left + margin >= boxB.right - margin ||
    boxA.bottom - margin <= boxB.top + margin ||
    boxA.top + margin >= boxB.bottom - margin
  );
}

/**
 * Calculates intersection area between two normalized bounding boxes
 */
export function getIntersectionArea(boxA, boxB) {
  if (!doBoxesIntersect(boxA, boxB)) return 0;
  const overlapWidth = Math.max(0, Math.min(boxA.right, boxB.right) - Math.max(boxA.left, boxB.left));
  const overlapHeight = Math.max(0, Math.min(boxA.bottom, boxB.bottom) - Math.max(boxA.top, boxB.top));
  return overlapWidth * overlapHeight;
}

/**
 * Checks if a box is completely within a safe area
 */
export function isInsideSafeArea(box, safeAreaType = 'ACTION') {
  const sa = SAFE_AREAS[safeAreaType] || SAFE_AREAS.ACTION;
  return (
    box.left >= sa.left - 0.001 &&
    box.right <= sa.right + 0.001 &&
    box.top >= sa.top - 0.001 &&
    box.bottom <= sa.bottom + 0.001
  );
}

/**
 * Clamps a normalized bounding box position into safe area
 */
export function clampToSafeArea(box, safeAreaType = 'ACTION') {
  const sa = SAFE_AREAS[safeAreaType] || SAFE_AREAS.ACTION;
  let shiftX = 0;
  let shiftY = 0;

  if (box.left < sa.left) shiftX = sa.left - box.left;
  else if (box.right > sa.right) shiftX = sa.right - box.right;

  if (box.top < sa.top) shiftY = sa.top - box.top;
  else if (box.bottom > sa.bottom) shiftY = sa.bottom - box.bottom;

  return { shiftX, shiftY };
}

/**
 * Converts bounding box from normalized to target pixel resolution
 */
export function boxNormalizedToPixel(normBox, res = DEFAULT_RESOLUTION) {
  return {
    left: Math.round(normBox.left * res.width),
    top: Math.round(normBox.top * res.height),
    right: Math.round(normBox.right * res.width),
    bottom: Math.round(normBox.bottom * res.height),
    width: Math.round(normBox.width * res.width),
    height: Math.round(normBox.height * res.height),
    centerX: Math.round(normBox.centerX * res.width),
    centerY: Math.round(normBox.centerY * res.height)
  };
}

/**
 * Scales an entire scene composition proportionately between two resolutions (e.g. 1080p -> 4K)
 */
export function getResolutionScaleRatio(sourceRes = DEFAULT_RESOLUTION, targetRes = RESOLUTIONS.UHD_4K) {
  return {
    scaleX: targetRes.width / sourceRes.width,
    scaleY: targetRes.height / sourceRes.height,
    uniformScale: targetRes.width / sourceRes.width
  };
}
