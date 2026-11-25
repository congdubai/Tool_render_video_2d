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
export { buildAssetGenerationPrompt, exportPromptsMarkdown, exportFilenameMappingCsv } from './v5-asset-prompt-manager.js';
export { validateImageFile, ANCHOR_PRESETS } from './v5-image-validator.js';
export { matchFilenameToRequirement, processImportedFiles, importZipArchive } from './v5-bulk-importer.js';
export { AssetBindingRegistry } from './v5-asset-binding-registry.js';
export { calculateProjectReadiness, buildSceneBuilderContract } from './v5-readiness-engine.js';

import { scanScenePlanRequirements } from './v5-requirement-scanner.js';
import { AssetDependencyGraph } from './v5-dependency-graph.js';
import { batchResolveRequirements } from './v5-asset-resolver.js';
import { deduplicateAssetRequirements } from './v5-asset-deduplicator.js';
import { exportPromptsMarkdown, exportFilenameMappingCsv, buildAssetGenerationPrompt } from './v5-asset-prompt-manager.js';
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
    for (const res of resolution.results) {
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

  exportGenerationPackageZip(targetZipPath, options = {}) {
    const scan = scanScenePlanRequirements(this.scenePlan, options);
    const dedup = deduplicateAssetRequirements(scan.requirements);
    const missingOnly = dedup.canonicalRequirements.filter(r => {
      const b = this.bindingRegistry.getBinding(r.id);
      return !b || b.status !== 'READY';
    });

    const targetList = options.includeAll ? dedup.canonicalRequirements : (missingOnly.length > 0 ? missingOnly : dedup.canonicalRequirements);

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
