// engine/v5-procedural-generator.js — Central Procedural Asset Generator Facade (V5.1)
// Connects Universal Vector Engine, Background Generator, Prop Generator, Diagram Generator,
// and Style Engine to generate production-ready 2D graphics by code with zero local AI models or paid APIs.

import fs from 'node:fs';
import path from 'node:path';
import { generateProceduralBackground, BACKGROUND_CATEGORIES } from './v5-procedural-backgrounds.js';
import { generateProceduralProp, PROP_CATALOG } from './v5-procedural-props.js';
import { generateProceduralDiagram } from './v5-procedural-diagrams.js';
import { renderToSvg, renderToPngFile, validateVectorSpec } from './v5-vector-engine.js';
import { saveAsset } from '../../lib/asset-registry.mjs';

export { BACKGROUND_CATEGORIES } from './v5-procedural-backgrounds.js';
export { PROP_CATALOG } from './v5-procedural-props.js';
export { generateProceduralBackground } from './v5-procedural-backgrounds.js';
export { generateProceduralProp } from './v5-procedural-props.js';
export { generateProceduralDiagram } from './v5-procedural-diagrams.js';

/**
 * Checks whether an asset requirement can be generated procedurally by code
 */
export function canGenerateProcedurally(requirement = {}) {
  const type = String(requirement.type || requirement.category || '').toLowerCase();
  
  // Non-image capabilities CANNOT be procedurally drawn
  if (['character_rig', 'action', 'composite_action', 'camera'].includes(type)) {
    return false;
  }

  // If requirement explicitly provides custom vector drawing JSON, it is 100% supported
  if (requirement.vectorDrawingSpec && typeof requirement.vectorDrawingSpec === 'object') {
    return true;
  }

  // All backgrounds, props, diagrams, illustrations have parametric templates
  if (['background', 'prop', 'illustration', 'diagram', 'environment'].includes(type)) {
    return true;
  }

  return false;
}

/**
 * Generates a procedural 2D asset based on requirement description, template, or vector JSON.
 */
export function generateProceduralAsset(requirement = {}, options = {}) {
  const reqId = requirement.id || 'REQ_ASSET';
  const targetId = (requirement.targetAssetId || reqId).toLowerCase();
  const templateCandidate = String(options.template || requirement.proceduralTemplateId || targetId).toLowerCase();
  const isKnownBg = ['modern_lab', 'lab_modern', 'vintage_lab', 'office', 'classroom', 'city_street', 'street', 'park', 'city', 'forest', 'cafe', 'living_room', 'bedroom', 'hospital', 'factory', 'warehouse', 'store', 'mountain', 'beach', 'desert', 'countryside', 'construction', 'ancient_village', 'vintage_computer_room', 'physics_lab', 'chemistry_lab', 'research_center', 'space_station', 'inside_machine'].includes(templateCandidate) || targetId.includes('bg_') || targetId.includes('background') || targetId.includes('lab') || targetId.includes('room');
  const isKnownDiag = ['historical_timeline', 'principle_diagram', 'comparison_chart'].includes(templateCandidate) || targetId.includes('diagram') || targetId.includes('chart');

  let type = String(requirement.type || requirement.category || options.type || '').toLowerCase();
  if (!type || type === 'prop' || type === 'unknown') {
    if (isKnownBg) type = 'background';
    else if (isKnownDiag) type = 'diagram';
    else type = 'prop';
  }

  const styleProfile = options.styleProfile || requirement.styleProfileId || 'white_cartoon';
  const seed = options.seed || requirement.seed || 101;

  // 1. Explicit Custom Vector Drawing Specification (External AI JSON)
  if (requirement.vectorDrawingSpec && typeof requirement.vectorDrawingSpec === 'object') {
    const spec = requirement.vectorDrawingSpec;
    const validation = validateVectorSpec(spec);
    if (!validation.valid) {
      throw new Error(`Vector Drawing Specification invalid: ${validation.errors.join('; ')}`);
    }

    const width = spec.width || 1024;
    const height = spec.height || 1024;
    const safeId = `proc_${reqId.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

    return {
      id: safeId,
      templateId: 'custom_vector_spec',
      type: type || 'prop',
      name: requirement.name || spec.name || 'Custom Vector Asset',
      width,
      height,
      gripPoint: requirement.gripPoint || { x: 0.5, y: 0.85 },
      groundContact: requirement.groundContact || { x: 0.5, y: 0.98 },
      pivot: requirement.pivot || { x: 0.5, y: 0.5 },
      layers: [
        { id: 'custom_layer', name: 'Custom Vector Spec', elements: spec.elements || [] }
      ],
      vectorSpec: spec,
      getSvg: () => renderToSvg(spec),
      renderPng: (outPath) => renderToPngFile(spec, outPath, { width, height })
    };
  }

  // 2. Backgrounds
  if (type === 'background') {
    let template = options.template || requirement.proceduralTemplateId;
    if (!template) {
      if (targetId.includes('vintage') || targetId.includes('history') || targetId.includes('eniac')) {
        template = targetId.includes('computer') ? 'vintage_computer_room' : 'vintage_lab';
      } else if (targetId.includes('cafe')) {
        template = 'cafe';
      } else if (targetId.includes('street') || targetId.includes('night') || targetId.includes('city')) {
        template = 'street';
      } else if (targetId.includes('lab')) {
        template = 'lab_modern';
      } else {
        template = 'lab_modern';
      }
    }

    // Map UI aliases
    if (template === 'modern_lab') template = 'lab_modern';
    if (template === 'city_street') template = 'street';

    const bg = generateProceduralBackground(template, {
      ...options,
      styleProfile,
      seed,
      lighting,
      timeOfDay: lighting,
      detailLevel: options.detailLevel || requirement.detailLevel || 'medium'
    });
    bg.id = `proc_${reqId.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    bg.renderPng = (outPath) => renderToPngFile(bg.vectorSpec, outPath, { width: bg.width, height: bg.height });
    return bg;
  }

  // 3. Diagrams & Educational Graphics
  if (type === 'diagram' || type === 'illustration') {
    let diagType = options.template || requirement.proceduralTemplateId;
    if (!diagType) {
      if (targetId.includes('principle') || targetId.includes('flow')) diagType = 'principle_diagram';
      else if (targetId.includes('compare') || targetId.includes('comparison')) diagType = 'comparison_chart';
      else diagType = 'historical_timeline';
    }

    const diag = generateProceduralDiagram(diagType, {
      ...options,
      styleProfile,
      seed,
      title: requirement.name || 'Sơ đồ minh họa'
    });
    diag.id = `proc_${reqId.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    return diag;
  }

  // 4. Props & Objects
  let propTemplate = options.template || requirement.proceduralTemplateId;
  if (!propTemplate) {
    if (targetId.includes('eniac') || targetId.includes('vintage_computer') || targetId.includes('mainframe')) {
      propTemplate = 'vintage_computer';
    } else if (targetId.includes('transistor')) {
      propTemplate = 'transistor';
    } else if (targetId.includes('microchip') || targetId.includes('cpu') || targetId.includes('chip')) {
      propTemplate = 'microchip';
    } else if (targetId.includes('laptop')) {
      propTemplate = 'laptop';
    } else if (targetId.includes('bulb') || targetId.includes('idea') || targetId.includes('light')) {
      propTemplate = 'lightbulb';
    } else if (targetId.includes('coffee') || targetId.includes('cup') || targetId.includes('mug')) {
      propTemplate = 'coffee_cup';
    } else if (targetId.includes('lab') || targetId.includes('flask')) {
      propTemplate = 'lab_equipment';
    } else if (requirement.proceduralTemplateId) {
      propTemplate = requirement.proceduralTemplateId;
    }
  }

  const prop = generateProceduralProp(propTemplate, {
    ...options,
    styleProfile,
    seed,
    lighting: options.lighting || options.timeOfDay || requirement.lighting || 'daylight',
    detailLevel: options.detailLevel || requirement.detailLevel || 'medium',
    width: options.width || 512,
    height: options.height || 512
  });
  prop.id = `proc_${reqId.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
  prop.renderPng = (outPath) => renderToPngFile(prop.vectorSpec, outPath, { width: prop.width, height: prop.height });
  return prop;
}

/**
 * Saves a procedural asset to disk (SVG + PNG with alpha + JSON metadata)
 * and registers it into the universal asset library.
 */
export async function saveProceduralAsset(generatedAsset, targetDir, options = {}) {
  const safeId = path.basename(generatedAsset.id || 'proc_asset').replace(/[^a-zA-Z0-9_-]/g, '');
  const outDir = targetDir || path.resolve(process.cwd(), 'public', 'assets', generatedAsset.type || 'prop');
  fs.mkdirSync(outDir, { recursive: true });

  const svgPath = path.join(outDir, `${safeId}.svg`);
  const pngPath = path.join(outDir, `${safeId}.png`);
  const metaPath = path.join(outDir, `${safeId}.json`);

  // 1. Write SVG
  const svgContent = generatedAsset.getSvg ? generatedAsset.getSvg() : renderToSvg(generatedAsset.vectorSpec);
  fs.writeFileSync(svgPath, svgContent, 'utf-8');

  // 2. Render and Write PNG
  await renderToPngFile(generatedAsset.vectorSpec, pngPath, {
    width: generatedAsset.width,
    height: generatedAsset.height
  });

  // 3. Metadata record (V5.2 full procedural persistence)
  const meta = {
    id: safeId,
    name: generatedAsset.name,
    type: generatedAsset.type,
    category: generatedAsset.type,
    description: `Procedural 2D asset generated by code (Template: ${generatedAsset.templateId || 'vector'})`,
    procedural: true,
    assetVersion: options.assetVersion || '5.2.0',
    templateId: generatedAsset.templateId,
    styleProfile: generatedAsset.styleProfile || generatedAsset.vectorSpec?.styleProfile || options.styleProfile || 'educational_cartoon',
    lighting: generatedAsset.lighting || generatedAsset.vectorSpec?.lighting || options.lighting || 'daylight',
    detailLevel: generatedAsset.detailLevel || generatedAsset.vectorSpec?.detailLevel || options.detailLevel || 'medium',
    seed: generatedAsset.seed ?? generatedAsset.vectorSpec?.seed ?? options.seed ?? 101,
    parameters: options,
    dimensions: { width: generatedAsset.width, height: generatedAsset.height },
    gripPoint: generatedAsset.gripPoint || { x: 0.5, y: 0.85 },
    groundContact: generatedAsset.groundContact || { x: 0.5, y: 0.98 },
    pivot: generatedAsset.pivot || { x: 0.5, y: 0.5 },
    layers: (generatedAsset.layers || []).map(l => ({ id: l.id, name: l.name, zIndex: l.zIndex, animatableProperties: l.animatableProperties })),
    vectorSpec: generatedAsset.vectorSpec,
    preview: {
      imagePath: `/assets/${generatedAsset.type}/${safeId}.png`,
      svgPath: `/assets/${generatedAsset.type}/${safeId}.svg`
    },
    imagePath: `/assets/${generatedAsset.type}/${safeId}.png`,
    svgPath: `/assets/${generatedAsset.type}/${safeId}.svg`,
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  // 4. Save into global Asset Registry
  try {
    saveAsset(meta);
  } catch (err) {
    // Already logged or minor schema warning
  }

  return {
    success: true,
    assetId: safeId,
    meta,
    svgPath,
    pngPath,
    metaPath
  };
}

/**
 * Automates CODE GEN ALL: sequentially draws and binds all missing requirements by code.
 */
export async function generateAndBindAllMissing(scenePlan = {}, smartAssetManager, options = {}) {
  if (!smartAssetManager) {
    throw new Error('smartAssetManager instance is required for generateAndBindAllMissing.');
  }

  const result = smartAssetManager.scanAndResolve(options);
  const canonicalReqs = result.dedup.canonicalRequirements || [];
  const generatedAssets = [];
  const failedRequirements = [];

  for (const req of canonicalReqs) {
    // Only process missing or unassigned requirements
    if (req.status === 'READY') continue;
    if (!canGenerateProcedurally(req)) {
      // Non-visual or capability requirements are handled by Rig / Action engines
      continue;
    }

    try {
      const asset = generateProceduralAsset(req, options);
      const saveRes = await saveProceduralAsset(asset, null, options);
      
      // Bind into active project
      smartAssetManager.bindingRegistry.bind(req.id, saveRes.assetId, {
        resolutionMethod: 'PROCEDURAL_CODE_GEN',
        status: 'READY',
        anchor: asset.gripPoint,
        autoSave: false
      });

      smartAssetManager.dependencyGraph.setRequirementStatus(req.id, 'READY');
      generatedAssets.push({
        requirementId: req.id,
        assetId: saveRes.assetId,
        name: asset.name,
        type: asset.type,
        pngPath: saveRes.pngPath
      });
    } catch (err) {
      failedRequirements.push({
        id: req.id,
        reason: err.message
      });
    }
  }

  // Auto-link Mode A characters after generation
  smartAssetManager.autoLinkModeACharacters(canonicalReqs);

  // Recalculate readiness
  const finalScan = smartAssetManager.scanAndResolve(options);

  return {
    success: true,
    totalScanned: canonicalReqs.length,
    totalGenerated: generatedAssets.length,
    generatedCount: generatedAssets.length,
    totalFailed: failedRequirements.length,
    generatedAssets,
    failedRequirements,
    readiness: finalScan.readiness,
    bindings: smartAssetManager.bindingRegistry.getAllBindings()
  };
}
