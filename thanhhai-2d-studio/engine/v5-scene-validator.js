// engine/v5-scene-validator.js — Scene Composition & Integrity Validator (V5 Phase 3)
// Performs comprehensive validation of compiled scenes against bounds, assets, attachments and timeline.

import { createEmptyValidationReport, addValidationIssue, SEVERITY } from './v5-scene-compiler-contracts.js';
import { checkCollisionsAndOverlaps } from './v5-constraint-resolver.js';
import { checkCharacterOutfitCompatibility } from './compatibility-engine-v4.js';

/**
 * Validates a compiled scene and its scene graph
 */
export function validateCompiledScene(compiledScene, sceneGraph, projectContext = {}) {
  const report = createEmptyValidationReport();
  const bindings = projectContext.resolvedBindings || {};

  // 1. Check Scene Timing
  if (!compiledScene.duration || compiledScene.duration <= 0) {
    addValidationIssue(report, SEVERITY.ERROR, 'INVALID_DURATION', 'Thời lượng cảnh phải lớn hơn 0.');
  }

  // 2. Check Scene Graph Cycles
  if (sceneGraph) {
    const cycle = sceneGraph.detectCycles();
    if (cycle) {
      addValidationIssue(report, SEVERITY.ERROR, 'CIRCULAR_DEPENDENCY', `Scene Graph chứa chu trình vòng: ${cycle.join(' -> ')}`);
    }

    // 3. Check Collisions and Overlaps
    const collisionWarnings = checkCollisionsAndOverlaps(sceneGraph);
    for (const cw of collisionWarnings) {
      addValidationIssue(report, SEVERITY.WARNING, cw.type, cw.message, cw);
    }
  }

  // 4. Check Background Asset
  const bgId = compiledScene.background?.assetId || compiledScene.background?.id;
  if (!bgId) {
    addValidationIssue(report, SEVERITY.WARNING, 'MISSING_BACKGROUND', 'Cảnh chưa được gán hình nền.');
  }

  // 5. Check Character Assets & Rigs
  for (const c of (compiledScene.characters || [])) {
    const charId = c.characterId || c.instanceId || c.id || c.bindingId;
    if (!charId) {
      addValidationIssue(report, SEVERITY.ERROR, 'INVALID_CHARACTER_ID', 'Nhân vật thiếu ID định danh.');
    }

    if (c.outfitId) {
      const comp = checkCharacterOutfitCompatibility(charId, c.outfitId);
      if (comp.status === 'INCOMPATIBLE') {
        addValidationIssue(report, SEVERITY.WARNING, 'INCOMPATIBLE_OUTFIT', `Trang phục "${c.outfitId}" có thể không tương thích với nhân vật "${charId}".`);
      }
    }
  }

  // 6. Check Prop Attachments
  for (const p of (compiledScene.props || [])) {
    if (p.attachedTo) {
      const targetChar = (compiledScene.characters || []).find(c => (c.characterId || c.instanceId || c.id) === p.attachedTo);
      if (!targetChar) {
        addValidationIssue(report, SEVERITY.WARNING, 'ORPHAN_ATTACHMENT', `Đạo cụ "${p.id || p.assetId || p.instanceId}" gắn vào nhân vật "${p.attachedTo}" nhưng nhân vật không có trong cảnh.`);
      }
    }
  }

  // 7. Check Text Graphics
  for (const tg of (compiledScene.textGraphics || [])) {
    if (!tg.text && !tg.title) {
      addValidationIssue(report, SEVERITY.INFO, 'EMPTY_TEXT_GRAPHIC', 'Phần tử đồ họa chữ không có nội dung văn bản.');
    }
  }

  return report;
}
