// engine/v5-scene-director-api.js — Internal V5 AI Scene Director API Services (V4 -> V5 Bridge)
// Provides clean programmatic query and manipulation endpoints for AI Scene Planning.

import { BACKGROUND_CATALOG } from './background-engine-v4.js';
import { OUTFIT_LIBRARY } from './outfit-engine-v4.js';
import { COMPOSITE_ACTION_TEMPLATES } from './action-engine-v4.js';
import { WHITE_CARTOON_PRESETS } from './white-cartoon-rig2d.js';
import { listAssets, getAsset } from '../../lib/asset-registry.mjs';
import { createDefaultScene } from './scene-model-v4.js';
import { checkCharacterOutfitCompatibility } from './compatibility-engine-v4.js';

export const v5SceneDirectorApi = {
  // 1. List Available Characters
  listCharacters() {
    return Object.keys(WHITE_CARTOON_PRESETS).map(k => ({
      id: k,
      name: WHITE_CARTOON_PRESETS[k].name,
      skin: WHITE_CARTOON_PRESETS[k].skin,
      hairColor: WHITE_CARTOON_PRESETS[k].hairColor,
      bodyProfile: WHITE_CARTOON_PRESETS[k].bodyProfile || 'white_cartoon'
    }));
  },

  // 2. Search Asset Registry
  searchAssets(query = '', type = null) {
    return listAssets({ query, type });
  },

  // 3. List Backgrounds
  listBackgrounds(category = null) {
    const list = Object.values(BACKGROUND_CATALOG);
    if (category) return list.filter(b => b.category === category);
    return list;
  },

  // 4. List Compatible Outfits for Character
  listCompatibleOutfits(characterId) {
    const char = WHITE_CARTOON_PRESETS[characterId] || WHITE_CARTOON_PRESETS.doc;
    const compatible = [];

    for (const [id, spec] of Object.entries(OUTFIT_LIBRARY)) {
      const res = checkCharacterOutfitCompatibility(char, spec);
      if (res.status === 'COMPATIBLE' || res.status === 'PARTIALLY_COMPATIBLE') {
        compatible.push({
          id,
          name: spec.name,
          category: spec.category,
          status: res.status
        });
      }
    }
    return compatible;
  },

  // 5. List Compatible Actions
  listCompatibleActions() {
    return Object.values(COMPOSITE_ACTION_TEMPLATES).map(a => ({
      id: a.id,
      name: a.name,
      category: a.category,
      duration: a.duration,
      roles: a.roles
    }));
  },

  // 6. Validate Scene Plan JSON (Schema compliance check)
  validateScenePlan(scenePlan = {}) {
    const errors = [];
    if (!scenePlan.sceneId) errors.push('Thiếu Scene ID');
    if (!scenePlan.duration || scenePlan.duration <= 0) errors.push('Thời lượng Scene Plan phải > 0');

    return {
      valid: errors.length === 0,
      errors
    };
  },

  // 7. Create Concrete Scene Object from Scene Plan JSON
  createSceneFromPlan(scenePlan = {}) {
    const validation = this.validateScenePlan(scenePlan);
    if (!validation.valid) {
      throw new Error(`Scene Plan không hợp lệ: ${validation.errors.join('; ')}`);
    }

    const scene = createDefaultScene(scenePlan.sceneId, {
      name: scenePlan.visualObjective || `Scene ${scenePlan.sceneId}`,
      duration: scenePlan.duration,
      background: { id: scenePlan.background || 'bg_lab_modern' },
      camera: { preset: scenePlan.camera?.preset || 'medium_shot' },
      characters: Array.isArray(scenePlan.characters) ? scenePlan.characters.map(c => ({
        characterId: c.characterId || 'doc',
        role: c.role || 'presenter',
        outfitId: c.outfitId || 'outfit_scientist_labcoat',
        position: c.position || [640, 580]
      })) : [{ characterId: 'doc', outfitId: 'outfit_scientist_labcoat', position: [640, 580] }]
    });

    return scene;
  }
};

