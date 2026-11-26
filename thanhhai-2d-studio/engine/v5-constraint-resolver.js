// engine/v5-constraint-resolver.js — Constraint-Based Layout Resolver & Collision Engine (V5 Phase 3)
// Resolves relative placement constraints, detects circular dependencies,
// analyzes bounding box collisions and performs safe automatic layout adjustments.

import { doBoxesIntersect, getIntersectionArea, clampToSafeArea } from './v5-coordinate-system.js';

export const CONSTRAINT_TYPES = {
  LEFT_OF: 'LEFT_OF',
  RIGHT_OF: 'RIGHT_OF',
  ABOVE: 'ABOVE',
  BELOW: 'BELOW',
  CENTERED_ON: 'CENTERED_ON',
  ALIGNED_BOTTOM: 'ALIGNED_BOTTOM',
  ALIGNED_TOP: 'ALIGNED_TOP',
  ON_SURFACE: 'ON_SURFACE',
  INSIDE_ZONE: 'INSIDE_ZONE',
  ATTACHED_TO: 'ATTACHED_TO',
  KEEP_DISTANCE: 'KEEP_DISTANCE',
  SAME_SCALE: 'SAME_SCALE',
  KEEP_VISIBLE: 'KEEP_VISIBLE',
  AVOID_OVERLAP: 'AVOID_OVERLAP'
};

/**
 * Detects circular dependencies in a list of constraints
 */
export function detectConstraintCycles(constraints = []) {
  const adj = new Map();

  for (const c of constraints) {
    const from = c.subjectId || c.instanceId;
    const to = c.targetId || c.target;
    if (!from || !to) continue;

    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push(to);
  }

  const visited = new Set();
  const recStack = new Set();

  function dfs(node, path) {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor, path);
        if (cycle) return cycle;
      } else if (recStack.has(neighbor)) {
        path.push(neighbor);
        return [...path];
      }
    }

    recStack.delete(node);
    path.pop();
    return null;
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      const cycle = dfs(node, []);
      if (cycle) return cycle;
    }
  }

  return null;
}

/**
 * Resolves relative constraints between nodes in a scene graph
 */
export function resolveSceneConstraints(sceneGraph, constraints = []) {
  const issues = [];

  // Check circular constraints first
  const cycle = detectConstraintCycles(constraints);
  if (cycle) {
    throw new Error(`Circular constraint dependency detected: ${cycle.join(' -> ')}`);
  }

  // Sort constraints topologically or apply in iterative passes
  const maxPasses = 3;
  for (let pass = 0; pass < maxPasses; pass++) {
    for (const c of constraints) {
      const subjectId = c.subjectId || c.instanceId;
      const targetId = c.targetId || c.target;

      const subject = sceneGraph.getNode(subjectId);
      const target = sceneGraph.getNode(targetId);

      if (!subject) {
        issues.push({ code: 'MISSING_CONSTRAINT_SUBJECT', message: `Subject "${subjectId}" không tồn tại.` });
        continue;
      }
      if (!target && c.type !== CONSTRAINT_TYPES.INSIDE_ZONE) {
        issues.push({ code: 'MISSING_CONSTRAINT_TARGET', message: `Target "${targetId}" không tồn tại.` });
        continue;
      }

      if (subject.locked) continue; // Respect user/AI locks

      const gap = c.gap ?? 0.04;
      const targetBox = target ? sceneGraph.getWorldBoundingBox(targetId) : null;
      const subjectBox = sceneGraph.getWorldBoundingBox(subjectId);

      switch (c.type) {
        case CONSTRAINT_TYPES.LEFT_OF:
          if (targetBox && subjectBox) {
            subject.position.x = targetBox.left - gap - (subjectBox.width / 2);
            if (c.alignment === 'GROUND' && targetBox) {
              subject.position.y = target.position.y;
            }
          }
          break;

        case CONSTRAINT_TYPES.RIGHT_OF:
          if (targetBox && subjectBox) {
            subject.position.x = targetBox.right + gap + (subjectBox.width / 2);
            if (c.alignment === 'GROUND' && targetBox) {
              subject.position.y = target.position.y;
            }
          }
          break;

        case CONSTRAINT_TYPES.ABOVE:
          if (targetBox && subjectBox) {
            subject.position.y = targetBox.top - gap - (subjectBox.height / 2);
          }
          break;

        case CONSTRAINT_TYPES.BELOW:
          if (targetBox && subjectBox) {
            subject.position.y = targetBox.bottom + gap + (subjectBox.height / 2);
          }
          break;

        case CONSTRAINT_TYPES.CENTERED_ON:
          if (targetBox) {
            subject.position.x = targetBox.centerX;
            subject.position.y = targetBox.centerY;
          }
          break;

        case CONSTRAINT_TYPES.ALIGNED_BOTTOM:
          if (targetBox && subjectBox) {
            subject.position.y = targetBox.bottom;
          }
          break;

        case CONSTRAINT_TYPES.SAME_SCALE:
          if (target) {
            subject.scale.x = target.scale.x;
            subject.scale.y = target.scale.y;
          }
          break;

        case CONSTRAINT_TYPES.INSIDE_ZONE:
          if (c.zoneRect) {
            const z = c.zoneRect;
            if (subject.position.x < z.left) subject.position.x = z.left + 0.05;
            if (subject.position.x > z.right) subject.position.x = z.right - 0.05;
            if (subject.position.y < z.top) subject.position.y = z.top + 0.05;
            if (subject.position.y > z.bottom) subject.position.y = z.bottom - 0.05;
          }
          break;

        case CONSTRAINT_TYPES.KEEP_DISTANCE:
          if (target) {
            const minDist = c.minDistance || 0.20;
            const dx = subject.position.x - target.position.x;
            const dy = subject.position.y - target.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist && dist > 0.0001) {
              const pushFactor = (minDist - dist) / dist;
              subject.position.x += dx * pushFactor * 0.5;
              subject.position.y += dy * pushFactor * 0.5;
            }
          }
          break;
      }
    }
  }

  return { success: issues.length === 0, issues };
}

/**
 * Checks for invalid collisions and overlaps in the scene graph
 */
export function checkCollisionsAndOverlaps(sceneGraph, allowedOverlapRelations = []) {
  const warnings = [];
  const nodes = sceneGraph.getSortedRenderList();

  const allowedSet = new Set(allowedOverlapRelations.map(r => `${r.source}_${r.target}`));

  for (let i = 0; i < nodes.length; i++) {
    const nodeA = nodes[i];
    const boxA = sceneGraph.getWorldBoundingBox(nodeA.instanceId);
    if (!boxA) continue;

    // 1. Check out of bounds / safe area
    if (boxA.left < -0.05 || boxA.right > 1.05 || boxA.top < -0.05 || boxA.bottom > 1.05) {
      warnings.push({
        type: 'OUT_OF_BOUNDS',
        nodeId: nodeA.instanceId,
        message: `Đối tượng "${nodeA.name}" vượt ra ngoài khung hình.`
      });
    }

    // 2. Pairwise overlap test
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeB = nodes[j];
      const boxB = sceneGraph.getWorldBoundingBox(nodeB.instanceId);
      if (!boxB) continue;

      // Allow parent-child attachments
      if (nodeA.parentId === nodeB.instanceId || nodeB.parentId === nodeA.instanceId) continue;

      // Allow registered safe relationships
      if (allowedSet.has(`${nodeA.instanceId}_${nodeB.instanceId}`) || allowedSet.has(`${nodeB.instanceId}_${nodeA.instanceId}`)) {
        continue;
      }

      if (doBoxesIntersect(boxA, boxB, 0.01)) {
        const area = getIntersectionArea(boxA, boxB);
        const minArea = Math.min(boxA.width * boxA.height, boxB.width * boxB.height);
        const overlapRatio = minArea > 0 ? area / minArea : 0;

        // Disallowed: character heavily overlapping another character
        if (nodeA.type === 'character' && nodeB.type === 'character' && overlapRatio > 0.25) {
          warnings.push({
            type: 'CHARACTER_COLLISION',
            nodeA: nodeA.instanceId,
            nodeB: nodeB.instanceId,
            overlapRatio,
            message: `Nhân vật "${nodeA.name}" bị đè lên "${nodeB.name}" (${Math.round(overlapRatio * 100)}%).`
          });
        }

        // Disallowed: prop obscuring character face
        if ((nodeA.type === 'character' && nodeB.type === 'prop') || (nodeB.type === 'character' && nodeA.type === 'prop')) {
          const charNode = nodeA.type === 'character' ? nodeA : nodeB;
          const propNode = nodeA.type === 'character' ? nodeB : nodeA;
          const charBox = nodeA.type === 'character' ? boxA : boxB;
          const propBox = nodeA.type === 'character' ? boxB : boxA;

          const faceRegion = {
            left: charBox.left,
            right: charBox.right,
            top: charBox.top,
            bottom: charBox.top + (charBox.height * 0.30)
          };

          if (doBoxesIntersect(propBox, faceRegion, 0.01) && propNode.parentId !== charNode.instanceId) {
            warnings.push({
              type: 'FACE_OCCLUSION',
              charId: charNode.instanceId,
              propId: propNode.instanceId,
              message: `Đạo cụ "${propNode.name}" che mất mặt nhân vật "${charNode.name}".`
            });
          }
        }

        // Disallowed: text covering character
        if ((nodeA.type === 'text' && nodeB.type === 'character') || (nodeB.type === 'text' && nodeA.type === 'character')) {
          const charNode = nodeA.type === 'character' ? nodeA : nodeB;
          const textNode = nodeA.type === 'character' ? nodeB : nodeA;
          warnings.push({
            type: 'TEXT_OVER_CHARACTER',
            textId: textNode.instanceId,
            charId: charNode.instanceId,
            message: `Chữ "${textNode.name}" đè lên nhân vật "${charNode.name}".`
          });
        }
      }
    }
  }

  return warnings;
}

/**
 * Performs safe automatic layout corrections (nudge, minor rescale, safe-area clamp)
 */
export function applyAutomaticLayoutCorrections(sceneGraph, warnings = []) {
  const corrected = [];

  for (const w of warnings) {
    if (w.type === 'CHARACTER_COLLISION') {
      const nodeA = sceneGraph.getNode(w.nodeA);
      const nodeB = sceneGraph.getNode(w.nodeB);
      if (nodeA && !nodeA.locked && nodeB) {
        // Shift nodeA away from nodeB
        const direction = nodeA.position.x < nodeB.position.x ? -1 : 1;
        nodeA.position.x += direction * 0.08;
        corrected.push({ nodeId: nodeA.instanceId, action: 'SHIFT_HORIZONTAL', deltaX: direction * 0.08 });
      }
    } else if (w.type === 'OUT_OF_BOUNDS') {
      const node = sceneGraph.getNode(w.nodeId);
      if (node && !node.locked) {
        const box = sceneGraph.getWorldBoundingBox(node.instanceId);
        const { shiftX, shiftY } = clampToSafeArea(box, 'ACTION');
        node.position.x += shiftX;
        node.position.y += shiftY;
        corrected.push({ nodeId: node.instanceId, action: 'CLAMP_SAFE_AREA', shiftX, shiftY });
      }
    } else if (w.type === 'FACE_OCCLUSION') {
      const propNode = sceneGraph.getNode(w.propId);
      if (propNode && !propNode.locked) {
        // Lower prop or shift aside
        propNode.position.y += 0.08;
        corrected.push({ nodeId: propNode.instanceId, action: 'NUDGE_DOWN', deltaY: 0.08 });
      }
    }
  }

  return corrected;
}

