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
    this.projectDir = projectDir;
    this.scenePlan = scenePlan;
    this.dependencyGraph = new AssetDependencyGraph();
    this.bindingRegistry = new AssetBindingRegistry(projectDir, this.dependencyGraph);
    this.unassignedAssets = [];
    this.contentHashes = new Map();

    if (projectDir) {
      this.bindingRegistry.load(projectDir);
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
    const knownChars = ['doc', 'jake'];
    for (const req of canonicalReqs) {
      if (req.type === 'character') {
        const binding = this.bindingRegistry.getBinding(req.id);
        const resolvedId = binding?.resolvedAssetId || req.resolvedAssetId || req.targetAssetId || '';
        const matchedChar = knownChars.find(c => resolvedId.toLowerCase().includes(c));
        if (matchedChar) {
          // 1. Auto-link character rig
          const rigReq = canonicalReqs.find(r => r.type === 'character_rig' && (r.id.toLowerCase().includes(matchedChar) || r.targetAssetId === matchedChar));
          if (rigReq) {
            rigReq.status = 'READY';
            rigReq.resolvedAssetId = matchedChar;
            rigReq.resolutionMethod = 'BUILTIN_RIG';
            rigReq.reasons = [`Rig nhân vật tích hợp Mode A "${matchedChar}" đã tích hợp sẵn`];
            this.dependencyGraph.setRequirementStatus(rigReq.id, 'READY');
            if (!this.bindingRegistry.getBinding(rigReq.id)) {
              this.bindingRegistry.bind(rigReq.id, matchedChar, {
                resolutionMethod: 'BUILTIN_RIG',
                status: 'READY',
                autoSave: false
              });
            }
          }
          // 2. Auto-link hand anchors
          const anchorReqs = canonicalReqs.filter(r => r.type === 'anchor_point' && (r.id.toLowerCase().includes(matchedChar) || (r.targetAssetId || '').toLowerCase().includes(matchedChar)));
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
  const manager = new SmartAssetManager(null, scenePlan);
  const result = manager.scanAndResolve(options);
  const resolutions = result?.resolution?.results || [];
  const missing = resolutions.filter(r => r.status === 'missing' || !r.isResolved);
  return {
    success: missing.length === 0,
    missingAssets: missing,
    resolutions
  };
}


