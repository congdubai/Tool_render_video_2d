// engine/v5-requirement-scanner.js — Asset Requirement Scanner (V5 Phase 2)
// Deeply analyzes a declarative Scene Plan JSON to discover all direct and indirect
// asset and capability requirements across all scenes and tracks.

import { CAPABILITY_REGISTRY } from './v5-capability-registry.js';

export function scanScenePlanRequirements(scenePlan = {}, projectContext = {}) {
  const scenes = Array.isArray(scenePlan.scenes) ? scenePlan.scenes : [];
  const declaredRequirements = Array.isArray(scenePlan.assetRequirements) ? scenePlan.assetRequirements : [];
  
  // Maps requirementId -> requirement descriptor
  const requirementMap = new Map();
  // Maps sceneId -> array of requirement references
  const sceneRequirementMap = new Map();
  // List of discovered capabilities
  const capabilityRequests = [];

  // 1. Ingest explicitly declared requirements in the Scene Plan
  for (const req of declaredRequirements) {
    if (!req.id) continue;
    requirementMap.set(req.id, {
      id: req.id,
      name: req.name || req.id,
      type: req.type || 'prop',
      category: req.type || 'prop',
      description: req.description || '',
      generationPrompt: req.generationPrompt || '',
      negativePrompt: req.negativePrompt || '',
      transparentBackground: req.transparentBackground ?? (req.type === 'prop' || req.type === 'character' || req.type === 'illustration'),
      recommendedDimensions: req.recommendedDimensions || (req.type === 'background' ? { width: 1920, height: 1080 } : { width: 1024, height: 1024 }),
      aspectRatio: req.aspectRatio || (req.type === 'background' ? '16:9' : '1:1'),
      styleProfileId: req.styleProfileId || scenePlan.style?.profileId || 'educational_cartoon',
      requiredByScenes: new Set(),
      isDeclared: true,
      variants: req.variants || [],
      dependencies: []
    });
  }

  // 2. Scan every scene for direct and indirect dependencies
  for (const scene of scenes) {
    const sId = scene.id;
    if (!sceneRequirementMap.has(sId)) {
      sceneRequirementMap.set(sId, []);
    }
    const sceneReqs = sceneRequirementMap.get(sId);

    // --- A. BACKGROUND ---
    if (scene.background) {
      const bgId = scene.background.assetId || scene.background.id || scene.backgroundId;
      if (bgId) {
        const reqId = bgId.startsWith('REQ_') ? bgId : `REQ_BG_${bgId.replace(/^bg_/, '')}`;
        registerRequirement(requirementMap, reqId, {
          id: reqId,
          name: scene.background.name || `Background: ${bgId}`,
          type: 'background',
          category: 'background',
          targetAssetId: bgId,
          description: scene.background.description || `Background for scene ${sId}`,
          transparentBackground: false,
          aspectRatio: '16:9',
          recommendedDimensions: { width: 1920, height: 1080 },
          requiredByScene: sId
        });
        sceneReqs.push({ reqId, type: 'background', direct: true });
      }
    }

    // --- B. CHARACTERS & RELATED DEPENDENCIES ---
    const characters = Array.isArray(scene.characters) ? scene.characters : [];
    for (const char of characters) {
      const charId = char.characterId || char.id || 'doc';
      const charReqId = `REQ_CHAR_${charId.toUpperCase()}`;
      
      // Direct Character Requirement
      registerRequirement(requirementMap, charReqId, {
        id: charReqId,
        name: `Nhân vật ${charId}`,
        type: 'character',
        category: 'character',
        targetAssetId: charId,
        description: `Nhân vật tham gia diễn xuất trong cảnh ${sId}`,
        transparentBackground: true,
        aspectRatio: '1:1',
        requiredByScene: sId
      });
      sceneReqs.push({ reqId: charReqId, type: 'character', direct: true });

      // Indirect Character Rig Requirement
      const rigReqId = `REQ_RIG_${charId.toUpperCase()}`;
      registerRequirement(requirementMap, rigReqId, {
        id: rigReqId,
        name: `Character Rig: ${charId}`,
        type: 'character_rig',
        category: 'character_rig',
        targetAssetId: charId,
        description: `Hệ thống xương / rig cho nhân vật ${charId}`,
        requiredByScene: sId,
        dependencies: [charReqId]
      });
      sceneReqs.push({ reqId: rigReqId, type: 'character_rig', direct: false });

      // Character Outfit Requirement
      if (char.outfitId) {
        const outfitReqId = `REQ_OUTFIT_${char.outfitId.toUpperCase().replace(/^OUTFIT_/, '')}`;
        registerRequirement(requirementMap, outfitReqId, {
          id: outfitReqId,
          name: `Trang phục ${char.outfitId}`,
          type: 'outfit',
          category: 'outfit',
          targetAssetId: char.outfitId,
          description: `Trang phục cho nhân vật ${charId} trong cảnh ${sId}`,
          transparentBackground: true,
          requiredByScene: sId,
          dependencies: [charReqId]
        });
        sceneReqs.push({ reqId: outfitReqId, type: 'outfit', direct: true });
      }

      // Character Expression Requirement
      if (char.expressionId) {
        const exprReqId = `REQ_EXPR_${char.expressionId.toUpperCase()}`;
        registerRequirement(requirementMap, exprReqId, {
          id: exprReqId,
          name: `Biểu cảm ${char.expressionId}`,
          type: 'expression',
          category: 'expression',
          targetAssetId: char.expressionId,
          description: `Biểu cảm nét mặt cho ${charId} trong cảnh ${sId}`,
          transparentBackground: true,
          requiredByScene: sId,
          dependencies: [charReqId]
        });
        sceneReqs.push({ reqId: exprReqId, type: 'expression', direct: true });
      }

      // Attached Prop Requirement & Hand Anchor Indirect Dependency
      if (char.prop) {
        const propAssetId = typeof char.prop === 'string' ? char.prop : char.prop.assetId;
        const attachedTo = (typeof char.prop === 'object' && char.prop.attachedTo) || 'right_hand';
        if (propAssetId) {
          const propReqId = propAssetId.startsWith('REQ_') ? propAssetId : `REQ_PROP_${propAssetId.toUpperCase().replace(/^PROP_/, '')}`;
          registerRequirement(requirementMap, propReqId, {
            id: propReqId,
            name: `Đạo cụ ${propAssetId}`,
            type: 'prop',
            category: 'prop',
            targetAssetId: propAssetId,
            description: `Đạo cụ cầm tay gắn vào ${attachedTo} của ${charId}`,
            transparentBackground: true,
            requiredByScene: sId,
            dependencies: [charReqId, rigReqId]
          });
          sceneReqs.push({ reqId: propReqId, type: 'prop', direct: true });

          // Anchor Capability Dependency
          const anchorReqId = `REQ_ANCHOR_${charId.toUpperCase()}_${attachedTo.toUpperCase()}`;
          registerRequirement(requirementMap, anchorReqId, {
            id: anchorReqId,
            name: `Điểm neo ${attachedTo} của ${charId}`,
            type: 'anchor_point',
            category: 'anchor_point',
            targetAssetId: `${charId}:${attachedTo}`,
            description: `Hand anchor point required to attach prop to ${charId}`,
            requiredByScene: sId,
            dependencies: [rigReqId, propReqId]
          });
          sceneReqs.push({ reqId: anchorReqId, type: 'anchor_point', direct: false });
        }
      }
    }

    // --- B2. STANDALONE SCENE PROPS ---
    const sceneProps = Array.isArray(scene.props) ? scene.props : [];
    for (const p of sceneProps) {
      const propAssetId = typeof p === 'string' ? p : (p.assetId || p.id);
      if (propAssetId) {
        const propReqId = propAssetId.startsWith('REQ_') ? propAssetId : `REQ_PROP_${propAssetId.toUpperCase().replace(/^PROP_/, '')}`;
        registerRequirement(requirementMap, propReqId, {
          id: propReqId,
          name: p.name || `Đạo cụ ${propAssetId}`,
          type: 'prop',
          category: 'prop',
          targetAssetId: propAssetId,
          description: p.description || `Đạo cụ / thiết bị trong cảnh ${sId}`,
          transparentBackground: true,
          requiredByScene: sId,
          dependencies: []
        });
        sceneReqs.push({ reqId: propReqId, type: 'prop', direct: true });
      }
    }

    // --- C. VISUAL BEATS, ACTIONS, VFX, WEATHER ---
    const visualBeats = Array.isArray(scene.visualBeats) ? scene.visualBeats : [];
    for (const beat of visualBeats) {
      // Action or Composite Action
      if (beat.actionId) {
        const isComposite = beat.actionId.startsWith('composite_');
        const actionReqId = `REQ_ACT_${beat.actionId.toUpperCase()}`;
        registerRequirement(requirementMap, actionReqId, {
          id: actionReqId,
          name: `Hành động ${beat.actionId}`,
          type: isComposite ? 'composite_action' : 'action',
          category: isComposite ? 'composite_action' : 'action',
          targetAssetId: beat.actionId,
          description: `Hành động hoạt họa trong visual beat (${beat.startMs ?? 0}ms - ${beat.endMs ?? 0}ms)`,
          requiredByScene: sId
        });
        sceneReqs.push({ reqId: actionReqId, type: isComposite ? 'composite_action' : 'action', direct: true });

        // Indirect dependencies for Composite Actions (e.g. fight cloud)
        if (beat.actionId === 'composite_fight_cloud' || beat.actionId === 'fight_cloud') {
          const vfxSmokeReq = `REQ_VFX_SMOKE_DUST`;
          registerRequirement(requirementMap, vfxSmokeReq, {
            id: vfxSmokeReq,
            name: 'Hiệu ứng khói cuộn Fight Cloud',
            type: 'vfx',
            category: 'vfx',
            targetAssetId: 'vfx_smoke_cloud',
            description: 'VFX phụ trợ cho composite action fight cloud',
            requiredByScene: sId
          });
          sceneReqs.push({ reqId: vfxSmokeReq, type: 'vfx', direct: false });
        }
      }

      // VFX
      if (beat.vfxId) {
        const vfxReqId = `REQ_VFX_${beat.vfxId.toUpperCase().replace(/^VFX_/, '')}`;
        registerRequirement(requirementMap, vfxReqId, {
          id: vfxReqId,
          name: `Hiệu ứng VFX ${beat.vfxId}`,
          type: 'vfx',
          category: 'vfx',
          targetAssetId: beat.vfxId,
          description: `VFX diễn xuất ${beat.vfxId} trong cảnh ${sId}`,
          requiredByScene: sId
        });
        sceneReqs.push({ reqId: vfxReqId, type: 'vfx', direct: true });
      }

      // Weather
      if (beat.weatherId) {
        const weatherReqId = `REQ_WEATHER_${beat.weatherId.toUpperCase().replace(/^WEATHER_/, '')}`;
        registerRequirement(requirementMap, weatherReqId, {
          id: weatherReqId,
          name: `Thời tiết ${beat.weatherId}`,
          type: 'weather',
          category: 'weather',
          targetAssetId: beat.weatherId,
          description: `Hiệu ứng môi trường thời tiết ${beat.weatherId}`,
          requiredByScene: sId
        });
        sceneReqs.push({ reqId: weatherReqId, type: 'weather', direct: true });
      }
    }

    // Root-level scene.actions
    const sceneActions = Array.isArray(scene.actions) ? scene.actions : [];
    for (const act of sceneActions) {
      const actionId = act.actionId || act.id;
      if (actionId) {
        const isComposite = actionId.startsWith('composite_') || actionId === 'shock_reaction' || actionId === 'fight_cloud';
        const actionReqId = `REQ_ACT_${actionId.toUpperCase()}`;
        registerRequirement(requirementMap, actionReqId, {
          id: actionReqId,
          name: `Hành động ${actionId}`,
          type: isComposite ? 'composite_action' : 'action',
          category: isComposite ? 'composite_action' : 'action',
          targetAssetId: actionId,
          description: `Hành động diễn xuất (${act.startMs ?? 0}ms - ${act.endMs ?? 0}ms)`,
          requiredByScene: sId
        });
        sceneReqs.push({ reqId: actionReqId, type: isComposite ? 'composite_action' : 'action', direct: true });
      }
    }

    // Root-level scene.expressions
    const sceneExpressions = Array.isArray(scene.expressions) ? scene.expressions : [];
    for (const expr of sceneExpressions) {
      const exprId = expr.expressionId || expr.id;
      if (exprId) {
        const exprReqId = `REQ_EXPR_${exprId.toUpperCase()}`;
        registerRequirement(requirementMap, exprReqId, {
          id: exprReqId,
          name: `Biểu cảm ${exprId}`,
          type: 'expression',
          category: 'expression',
          targetAssetId: exprId,
          description: `Biểu cảm nét mặt trong cảnh ${sId}`,
          transparentBackground: true,
          requiredByScene: sId
        });
        sceneReqs.push({ reqId: exprReqId, type: 'expression', direct: true });
      }
    }

    // Root-level scene.vfx
    const sceneVfx = Array.isArray(scene.vfx) ? scene.vfx : [];
    for (const v of sceneVfx) {
      const vfxId = v.assetId || v.vfxId || v.type || v.id;
      if (vfxId) {
        const vfxReqId = `REQ_VFX_${vfxId.toUpperCase().replace(/^VFX_/, '')}`;
        registerRequirement(requirementMap, vfxReqId, {
          id: vfxReqId,
          name: `Hiệu ứng VFX ${vfxId}`,
          type: 'vfx',
          category: 'vfx',
          targetAssetId: vfxId,
          description: `Hiệu ứng VFX ${vfxId} trong cảnh ${sId}`,
          requiredByScene: sId
        });
        sceneReqs.push({ reqId: vfxReqId, type: 'vfx', direct: true });
      }
    }

    // --- D. TEXT GRAPHICS & ILLUSTRATIONS ---
    const textGraphics = Array.isArray(scene.textGraphics) ? scene.textGraphics : [];
    for (const tg of textGraphics) {
      if (tg.type === 'diagram' || tg.type === 'illustration') {
        const illusReqId = `REQ_ILLUS_${(tg.id || tg.title || 'diagram').toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`;
        registerRequirement(requirementMap, illusReqId, {
          id: illusReqId,
          name: tg.title || `Minh họa sơ đồ ${tg.type}`,
          type: 'illustration',
          category: 'illustration',
          targetAssetId: tg.id || illusReqId,
          description: `Sơ đồ / hình minh họa giáo khoa trong cảnh ${sId}`,
          transparentBackground: true,
          aspectRatio: '16:9',
          requiredByScene: sId
        });
        sceneReqs.push({ reqId: illusReqId, type: 'illustration', direct: true });
      }
    }

    // --- E. CAMERA & TRANSITION CAPABILITIES ---
    if (scene.camera?.preset) {
      capabilityRequests.push({
        sceneId: sId,
        type: 'camera_preset',
        capabilityId: scene.camera.preset
      });
    }
    if (scene.transition?.type && scene.transition.type !== 'cut') {
      capabilityRequests.push({
        sceneId: sId,
        type: 'transition',
        capabilityId: scene.transition.type
      });
    }
  }

  // Format result
  const allRequirements = Array.from(requirementMap.values()).map(req => ({
    ...req,
    requiredByScenes: Array.from(req.requiredByScenes)
  }));

  return {
    requirements: allRequirements,
    requirementCount: allRequirements.length,
    sceneRequirements: Object.fromEntries(
      Array.from(sceneRequirementMap.entries()).map(([k, v]) => [k, v])
    ),
    capabilityRequests,
    scannedSceneCount: scenes.length
  };
}

function registerRequirement(map, reqId, data) {
  if (map.has(reqId)) {
    const existing = map.get(reqId);
    if (data.requiredByScene) {
      existing.requiredByScenes.add(data.requiredByScene);
    }
    if (data.dependencies && data.dependencies.length > 0) {
      existing.dependencies = Array.from(new Set([...(existing.dependencies || []), ...data.dependencies]));
    }
    return existing;
  }

  const record = {
    ...data,
    requiredByScenes: new Set(data.requiredByScene ? [data.requiredByScene] : []),
    dependencies: data.dependencies || []
  };
  delete record.requiredByScene;
  map.set(reqId, record);
  return record;
}

