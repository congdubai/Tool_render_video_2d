// engine/v5-scene-compiler-contracts.js — Input/Output Contracts & Status Enums (V5 Phase 3)
// Enforces formal input/output contracts, validation report structures, and
// animation-ready scene metadata for Phase 4.

export const SCENE_BUILD_STATUS = {
  PENDING: 'PENDING',
  BLOCKED_BY_ASSETS: 'BLOCKED_BY_ASSETS',
  BLOCKED_BY_CAPABILITY: 'BLOCKED_BY_CAPABILITY',
  BUILDING: 'BUILDING',
  BUILT: 'BUILT',
  BUILT_WITH_WARNINGS: 'BUILT_WITH_WARNINGS',
  FAILED: 'FAILED',
  APPROVED: 'APPROVED',
  LOCKED: 'LOCKED',
  STALE: 'STALE'
};

export const PROJECT_BUILD_STATUS = {
  NOT_READY: 'NOT_READY',
  PARTIALLY_BUILT: 'PARTIALLY_BUILT',
  SCENES_BUILT: 'SCENES_BUILT',
  SCENES_BUILT_WITH_WARNINGS: 'SCENES_BUILT_WITH_WARNINGS',
  BUILD_FAILED: 'BUILD_FAILED'
};

export const SEVERITY = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

export function createEmptyValidationReport() {
  return {
    isValid: true,
    hasWarnings: false,
    errors: [],
    warnings: [],
    info: [],
    checkedAt: new Date().toISOString()
  };
}

export function addValidationIssue(report, severity, code, message, context = {}) {
  const issue = {
    severity,
    code,
    message,
    context,
    timestamp: new Date().toISOString()
  };

  if (severity === SEVERITY.ERROR) {
    report.isValid = false;
    report.errors.push(issue);
  } else if (severity === SEVERITY.WARNING) {
    report.hasWarnings = true;
    report.warnings.push(issue);
  } else {
    report.info.push(issue);
  }
}

/**
 * Validates the compiler input contract before executing scene building
 */
export function validateCompilerInputContract(input = {}) {
  const report = createEmptyValidationReport();

  if (!input.scene && !input.sceneDescriptor) {
    addValidationIssue(report, SEVERITY.ERROR, 'MISSING_SCENE_DESCRIPTOR', 'Compiler input thiếu đối tượng mô tả scene.');
  }

  const scene = input.scene || input.sceneDescriptor || {};
  if (!scene.id) {
    addValidationIssue(report, SEVERITY.ERROR, 'MISSING_SCENE_ID', 'Scene descriptor phải có trường "id".');
  }

  if (typeof scene.startMs !== 'number' && typeof scene.startSec !== 'number' && typeof scene.duration !== 'number') {
    addValidationIssue(report, SEVERITY.WARNING, 'MISSING_TIMING', 'Scene descriptor thiếu thông tin timing, sử dụng mặc định 5.0s.');
  }

  return report;
}

/**
 * Creates the Animation-Ready Scene Contract for Phase 4 handoff
 */
export function createAnimationReadyContract(options = {}) {
  return {
    contractVersion: '5.3.0',
    sceneId: options.sceneId,
    durationSec: options.durationSec || 5.0,
    sceneGraph: options.sceneGraphData || null,
    characterInstances: options.characterInstances || [],
    rigReferences: options.rigReferences || {},
    propInstances: options.propInstances || [],
    attachmentAnchors: options.attachmentAnchors || {},
    objectTransforms: options.objectTransforms || {},
    initialPoses: options.initialPoses || {},
    actionReferences: options.actionReferences || [],
    expressionReferences: options.expressionReferences || [],
    vfxInstances: options.vfxInstances || [],
    cameraTargets: options.cameraTargets || [],
    movementBounds: options.movementBounds || {},
    timelineSlots: options.timelineSlots || {},
    continuityState: options.continuityState || {},
    generatedAt: new Date().toISOString()
  };
}

