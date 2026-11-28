// engine/v5-smart-asset-manager.js — Smart Asset Manager & Resolution Facade (V5 Phase 2)
// Central coordination module connecting scanning, deduplication, resolution,
// bulk import, bindings, readiness calculations, and Scene Builder contract.

import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

export { scanScenePlanRequirements } from './v5-requirement-scanner.js';
export { AssetDependencyGraph } from './v5-dependency-graph.js';
export { resolveAssetRequirement, batchResolveRequirements } from './v5-asset-resolver.js';
export { deduplicateAssetRequirements, isDistinctVariant } from './v5-asset-deduplicator.js';
export { buildAssetGenerationPrompt, exportPromptsMarkdown, exportFilenameMappingCsv, isVisualAssetRequirement } from './v5-asset-prompt-manager.js';
export { validateImageFile, ANCHOR_PRESETS } from './v5-image-validator.js';
export { matchFilenameToRequirement, processImportedFiles, importZipArchive } from './v5-bulk-importer.js';
export { AssetBindingRegistry } from './v5-asset-binding-registry.js';
export { calculateProjectReadiness, buildSceneBuilderContract } from './v5-readiness-engine.js';

import { scanScenePlanRequirements } from './v5-requirement-scanner.js';
import { AssetDependencyGraph } from './v5-dependency-graph.js';
import { batchResolveRequirements } from './v5-asset-resolver.js';
import { deduplicateAssetRequirements } from './v5-asset-deduplicator.js';
import { exportPromptsMarkdown, exportFilenameMappingCsv, buildAssetGenerationPrompt, isVisualAssetRequirement } from './v5-asset-prompt-manager.js';
import { AssetBindingRegistry } from './v5-asset-binding-registry.js';
import { calculateProjectReadiness } from './v5-readiness-engine.js';
import { getStyleProfile, buildCharacterContinuityProfile } from './v5-style-profiles.js';

export class SmartAssetManager {
  constructor(projectDir, scenePlan = {}) {
    const resolvedProjectDir = (projectDir && !path.isAbsolute(projectDir) && !projectDir.includes(path.sep) && !projectDir.includes('/'))
      ? path.resolve(process.cwd(), 'imported_projects', projectDir)
      : projectDir;
    this.projectDir = resolvedProjectDir;
    this.scenePlan = scenePlan;
    this.dependencyGraph = new AssetDependencyGraph();
    this.bindingRegistry = new AssetBindingRegistry(resolvedProjectDir, this.dependencyGraph);
    this.unassignedAssets = [];
    this.contentHashes = new Map();

    if (resolvedProjectDir) {
      this.bindingRegistry.load(resolvedProjectDir);
    }
  }

  scanAndResolve(options = {}) {
    // 0. Reset dependency graph for clean evaluation of the active scene plan
    this.dependencyGraph = new AssetDependencyGraph();
    this.bindingRegistry.dependencyGraph = this.dependencyGraph;

    // 1. Scan direct and indirect requirements
    const scan = scanScenePlanRequirements(this.scenePlan, options);
    
    // 2. Deduplicate requirements
    const dedup = deduplicateAssetRequirements(scan.requirements);

    // 3. Populate dependency graph
    this.dependencyGraph.populate({
      requirements: dedup.canonicalRequirements,
      sceneRequirements: scan.sceneRequirements
    });

    // 4. Batch resolve against V4 library & existing bindings
    const existingBindings = this.bindingRegistry.getAllBindings();
    const resolution = batchResolveRequirements(dedup.canonicalRequirements, existingBindings, options);

    // 5. Update graph with resolution statuses
    const resMap = new Map();
    for (const res of resolution.results) {
      resMap.set(res.requirementId, res);
      this.dependencyGraph.setRequirementStatus(res.requirementId, res.status);
      if (res.status === 'READY' && res.resolvedAssetId) {
        if (!this.bindingRegistry.getBinding(res.requirementId)) {
          this.bindingRegistry.bind(res.requirementId, res.resolvedAssetId, {
            resolutionMethod: res.resolutionMethod,
            status: 'READY',
            autoSave: false
          });
        }
      }
    }

    // Merge status and reasons into canonicalRequirements so frontend and all consumers get rich resolution status!
    for (const req of dedup.canonicalRequirements) {
      const res = resMap.get(req.id);
      if (res) {
        req.status = res.status;
        req.resolvedAssetId = res.resolvedAssetId;
        req.resolutionMethod = res.resolutionMethod;
        req.reasons = res.reasons || [];
        req.matchScore = res.matchScore;
        req.confidence = res.confidence;
      } else {
        const b = this.bindingRegistry.getBinding(req.id);
        req.status = b ? b.status : (this.dependencyGraph.getRequirementStatus(req.id) || 'MISSING');
        req.resolvedAssetId = b ? b.resolvedAssetId : null;
      }
    }

    // Auto-link Mode A characters (Doc & Jake) with their built-in rigs and anchors
    this.autoLinkModeACharacters(dedup.canonicalRequirements);

    // 6. Compute readiness
    const readiness = calculateProjectReadiness(this.scenePlan, this.dependencyGraph, this.bindingRegistry);

    return {
      scan,
      dedup,
      resolution,
      readiness,
      dependencyGraph: this.dependencyGraph.toJSON(),
      bindings: this.bindingRegistry.getAllBindings()
    };
  }

  autoLinkModeACharacters(canonicalReqs = []) {
    const knownChars = ['chibi_doc', 'chibi_max', 'chibi_jake', 'chibi_luna', 'doc', 'jake', 'max', 'luna'];
    for (const req of canonicalReqs) {
      if (req.type === 'character') {
        const binding = this.bindingRegistry.getBinding(req.id);
        const resolvedId = binding?.resolvedAssetId || req.resolvedAssetId || req.targetAssetId || '';
        const lowerRes = resolvedId.toLowerCase();
        let matchedChar = knownChars.find(c => lowerRes === c || lowerRes.includes(c)) ||
                          (lowerRes.includes('scientist') ? 'chibi_doc' : null);
        if (matchedChar === 'doc') matchedChar = 'chibi_doc';
        if (matchedChar) {
          const isChibi = matchedChar.startsWith('chibi');
          // 1. Auto-link character rig (matching either charId or character requirement ID)
          const charKey = req.id.replace(/^REQ_CHAR_/, '').toLowerCase();
          const rigReqs = canonicalReqs.filter(r => r.type === 'character_rig' && 
            (r.id.toLowerCase().includes(matchedChar) || 
             r.id.toLowerCase().includes(charKey) || 
             r.targetAssetId === matchedChar || 
             r.targetAssetId === req.targetAssetId));

          for (const rigReq of rigReqs) {
            rigReq.status = 'READY';
            rigReq.resolvedAssetId = matchedChar;
            rigReq.resolutionMethod = isChibi ? 'CHIBI_RIG' : 'BUILTIN_RIG';
            rigReq.reasons = [`Rig nhân vật ${isChibi ? 'Chibi' : 'Mode A'} "${matchedChar}" đã tích hợp sẵn`];
            this.dependencyGraph.setRequirementStatus(rigReq.id, 'READY');
            if (!this.bindingRegistry.getBinding(rigReq.id)) {
              this.bindingRegistry.bind(rigReq.id, matchedChar, {
                resolutionMethod: isChibi ? 'CHIBI_RIG' : 'BUILTIN_RIG',
                status: 'READY',
                autoSave: false
              });
            }
          }

          // 2. Auto-link hand anchors
          const anchorReqs = canonicalReqs.filter(r => r.type === 'anchor_point' && 
            (r.id.toLowerCase().includes(matchedChar) || 
             r.id.toLowerCase().includes(charKey) ||
             (r.targetAssetId || '').toLowerCase().includes(matchedChar) ||
             (r.targetAssetId || '').toLowerCase().includes(charKey)));

          for (const aReq of anchorReqs) {
            aReq.status = 'READY';
            aReq.resolvedAssetId = aReq.targetAssetId || `${matchedChar}:hand`;
            aReq.resolutionMethod = 'BUILTIN_RIG_ANCHOR';
            aReq.reasons = [`Điểm neo trên hệ thống xương "${matchedChar}" đã tích hợp sẵn`];
            this.dependencyGraph.setRequirementStatus(aReq.id, 'READY');
            if (!this.bindingRegistry.getBinding(aReq.id)) {
              this.bindingRegistry.bind(aReq.id, aReq.targetAssetId || `${matchedChar}:hand`, {
                resolutionMethod: 'BUILTIN_RIG_ANCHOR',
                status: 'READY',
                autoSave: false
              });
            }
          }
        }
      }
    }
  }

  exportGenerationPackageZip(targetZipPath, options = {}) {
    const scan = scanScenePlanRequirements(this.scenePlan, options);
    const dedup = deduplicateAssetRequirements(scan.requirements);
    const missingOnly = dedup.canonicalRequirements.filter(r => {
      const b = this.bindingRegistry.getBinding(r.id);
      return !b || b.status !== 'READY';
    });

    const targetList = (options.includeAll ? dedup.canonicalRequirements : (missingOnly.length > 0 ? missingOnly : dedup.canonicalRequirements))
      .filter(isVisualAssetRequirement);

    const zip = new AdmZip();

    // 1. asset_requirements.json
    zip.addFile('asset_requirements.json', Buffer.from(JSON.stringify(targetList, null, 2), 'utf8'));

    // 2. generation_prompts.md
    const md = exportPromptsMarkdown(targetList, options);
    zip.addFile('generation_prompts.md', Buffer.from(md, 'utf8'));

    // 3. filename_mapping.csv
    const csv = exportFilenameMappingCsv(targetList, options);
    zip.addFile('filename_mapping.csv', Buffer.from(csv, 'utf8'));

    // 4. style_profile.json
    const style = getStyleProfile(this.scenePlan.style?.profileId || 'educational_cartoon');
    zip.addFile('style_profile.json', Buffer.from(JSON.stringify(style, null, 2), 'utf8'));

    // 5. character_continuity.json
    const continuity = buildCharacterContinuityProfile(options.protagonist || 'doc');
    zip.addFile('character_continuity.json', Buffer.from(JSON.stringify(continuity, null, 2), 'utf8'));

    // 6. README.txt
    const readme = `THANH HAI 2D STUDIO V5 — GÓI CHUẨN BỊ TÀI NGUYÊN (ASSET GENERATION PACKAGE)\n`
      + `=================================================================================\n`
      + `Tổng số tài nguyên cần sinh: ${targetList.length}\n`
      + `Hướng dẫn:\n`
      + `1. Đọc file generation_prompts.md để lấy prompt sinh ảnh cho từng tài nguyên.\n`
      + `2. Dùng Midjourney, ChatGPT, Google Flow hoặc Stable Diffusion để sinh ảnh.\n`
      + `3. Đặt tên file theo đúng filename_mapping.csv (ví dụ: REQ_PROP_001.png).\n`
      + `4. Import ảnh hàng loạt vào Tab 4 — AI Auto Director của Thanh Hai 2D Studio.\n`;
    zip.addFile('README.txt', Buffer.from(readme, 'utf8'));

    fs.mkdirSync(path.dirname(targetZipPath), { recursive: true });
    zip.writeZip(targetZipPath);

    return {
      zipPath: targetZipPath,
      exportedCount: targetList.length,
      fileSize: fs.statSync(targetZipPath).size
    };
  }
}

export function resolveAssetRequirements(scenePlan = {}, options = {}) {
  const projectDir = options.projectDir || options.projectId || (scenePlan?.project?.id ? path.resolve(process.cwd(), 'imported_projects', scenePlan.project.id) : null);
  const manager = new SmartAssetManager(projectDir, scenePlan);

  // If bindings dictionary passed in options, bind them into registry
  if (options.bindings && typeof options.bindings === 'object') {
    for (const [reqId, bVal] of Object.entries(options.bindings)) {
      const assetId = typeof bVal === 'object' ? (bVal.resolvedAssetId || bVal.assetId || bVal.id) : bVal;
      if (assetId) {
        manager.bindingRegistry.bind(reqId, assetId, typeof bVal === 'object' ? bVal : {});
      }
    }
  }

  const result = manager.scanAndResolve(options);
  const canonicalMap = new Map((result?.dedup?.canonicalRequirements || []).map(c => [c.id, c]));
  const finalBindings = result?.bindings || {};

  // Single Source of Truth: always read authoritative post-auto-link status from canonicalRequirements & finalBindings
  const resolutions = (result?.dedup?.canonicalRequirements || []).map(canon => {
    const rawRes = (result?.resolution?.results || []).find(r => r.requirementId === canon.id) || {};
    const bound = finalBindings[canon.id];
    const effectiveStatus = bound?.status || canon.status || rawRes.status || 'MISSING';
    const effectiveAssetId = bound?.resolvedAssetId || canon.resolvedAssetId || rawRes.resolvedAssetId || null;
    const isReady = effectiveStatus === 'READY' || (Boolean(effectiveAssetId) && effectiveStatus !== 'MISSING');
    return {
      ...rawRes,
      id: canon.id,
      requirementId: canon.id,
      name: canon.name || rawRes.name || canon.id,
      category: canon.category || rawRes.category || 'unknown',
      type: canon.type || rawRes.type || canon.category || 'unknown',
      resolvedAssetId: effectiveAssetId,
      sceneUsages: canon.requiredByScenes || canon.sceneUsages || rawRes.sceneUsages || [],
      scenes: canon.requiredByScenes || canon.sceneUsages || rawRes.sceneUsages || [],
      isResolved: isReady,
      status: isReady ? 'READY' : effectiveStatus,
      reasons: canon.reasons || rawRes.reasons || (rawRes.reason ? [rawRes.reason] : ['Chưa được gán tài nguyên phù hợp']),
      reason: ((canon.reasons || rawRes.reasons || []).length > 0)
        ? (canon.reasons || rawRes.reasons).join('; ')
        : (rawRes.reason || 'Chưa được gán tài nguyên phù hợp')
    };
  });

  const missing = resolutions.filter(r => !r.isResolved);
  return {
    success: missing.length === 0,
    missingAssets: missing,
    resolutions,
    bindings: result?.bindings || {},
    dedup: result?.dedup,
    readiness: result?.readiness
  };
}


