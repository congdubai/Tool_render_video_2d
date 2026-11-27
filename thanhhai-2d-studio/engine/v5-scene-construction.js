// engine/v5-scene-construction.js — Scene Graph Construction & Object Assembly (V5 Phase 3)
// Instantiates characters, outfits, props, attachments, groups, VFX and background into the Scene Graph.

import { SceneGraph, NODE_TYPES } from './v5-scene-graph.js';
import { assignLayerAndZIndex } from './v5-layer-camera-builder.js';
import { ANCHORS } from './v5-coordinate-system.js';
import { checkCharacterOutfitCompatibility } from './compatibility-engine-v4.js';

/**
 * Resolves an asset ID against the binding registry with robust multi-key resolution:
 * exact key, REQ_<TYPE>_<ID>, lowercase, and scenePlan characterBindings.
 */
export function lookupResolvedBinding(resolvedBindings = {}, rawId = '', type = '', context = {}) {
  if (!rawId) return { resolvedAssetId: rawId, binding: null };
  const cleanId = String(rawId).trim();
  const lowerId = cleanId.toLowerCase();

  // 1. Direct key match in resolvedBindings
  if (resolvedBindings[cleanId]) {
    return {
      resolvedAssetId: resolvedBindings[cleanId].resolvedAssetId || cleanId,
      binding: resolvedBindings[cleanId]
    };
  }

  // 2. Case-insensitive key match
  for (const [k, v] of Object.entries(resolvedBindings)) {
    if (k.toLowerCase() === lowerId && v) {
      return {
        resolvedAssetId: v.resolvedAssetId || cleanId,
        binding: v
      };
    }
  }

  // 3. Try typed prefix match (e.g. REQ_BG_background_laboratory, REQ_CHAR_SCIENTIST_01)
  const prefixes = type ? [`REQ_${type.toUpperCase()}_`, 'REQ_'] : ['REQ_BG_', 'REQ_CHAR_', 'REQ_PROP_', 'REQ_RIG_', 'REQ_'];
  for (const prefix of prefixes) {
    const candidateKey = (prefix + lowerId).toLowerCase();
    for (const [k, v] of Object.entries(resolvedBindings)) {
      if (!v) continue;
      const kLow = k.toLowerCase();
      if (kLow === candidateKey || kLow.endsWith('_' + lowerId) || lowerId.endsWith('_' + kLow.replace(/^req_[a-z]+_/, ''))) {
        return {
          resolvedAssetId: v.resolvedAssetId || cleanId,
          binding: v
        };
      }
    }
  }

  // 4. Match by targetAssetId or requirementId inside the binding record
  for (const [k, v] of Object.entries(resolvedBindings)) {
    if (!v) continue;
    const target = String(v.targetAssetId || v.requirementId || '').toLowerCase();
    if (target === lowerId || target.includes(lowerId) || lowerId.includes(target)) {
      return {
        resolvedAssetId: v.resolvedAssetId || cleanId,
        binding: v
      };
    }
  }

  // 5. If type is character, inspect characterBindings in context or scenePlan
  const charBindings = context.characterBindings || context.scenePlan?.characterBindings || [];
  if (Array.isArray(charBindings)) {
    const cb = charBindings.find(b => (b.id && b.id.toLowerCase() === lowerId) || (b.bindingId && b.bindingId.toLowerCase() === lowerId));
    if (cb && (cb.characterId || cb.assetId)) {
      return {
        resolvedAssetId: cb.characterId || cb.assetId,
        binding: cb
      };
    }
  }

  // 6. Semantic mapping for scientist / doc -> canonical Tab 3 chibi_doc
  if (type === 'char' || type === 'character') {
    if (lowerId === 'doc' || lowerId === 'chibi_doc' || lowerId.includes('scientist') || lowerId.includes('bac_si') || lowerId.includes('giao_su')) {
      return {
        resolvedAssetId: 'chibi_doc',
        binding: null
      };
    }
    if (lowerId === 'max' || lowerId === 'chibi_max') return { resolvedAssetId: 'chibi_max', binding: null };
    if (lowerId === 'jake' || lowerId === 'chibi_jake') return { resolvedAssetId: 'chibi_jake', binding: null };
    if (lowerId === 'luna' || lowerId === 'chibi_luna') return { resolvedAssetId: 'chibi_luna', binding: null };
  }

  // 7. Default fallback to raw ID
  return {
    resolvedAssetId: cleanId,
    binding: null
  };
}

/**
 * Builds a complete SceneGraph from a composed scene descriptor and resolved assets
 */
export function constructSceneGraph(composedScene, resolvedBindings = {}, options = {}) {
  const sceneId = composedScene.id || composedScene.sceneId || `scene_${Date.now()}`;
  const graph = new SceneGraph({ sceneId });

  // 1. Background Node
  const rawBgId = composedScene.background?.assetId || composedScene.background?.id || 'bg_lab_modern';
  const bgLookup = lookupResolvedBinding(resolvedBindings, rawBgId, 'bg', options);
  const bgResolved = bgLookup.resolvedAssetId || rawBgId;
  const bgNode = graph.addNode({
    instanceId: 'bg_main',
    assetId: bgResolved,
    type: NODE_TYPES.BACKGROUND,
    name: 'Background Layer',
    position: { x: 0.5, y: 0.5 },
    size: { width: 1.0, height: 1.0 },
    anchor: ANCHORS.CENTER,
    zIndex: 0
  });
  assignLayerAndZIndex(bgNode);

  // 2. Character Nodes & Outfits
  const charNodeMap = new Map();
  for (const c of (composedScene.characters || [])) {
    const rawCharId = c.characterId || c.id || c.bindingId || 'doc';
    const charLookup = lookupResolvedBinding(resolvedBindings, rawCharId, 'char', options);
    const charAssetId = charLookup.resolvedAssetId || rawCharId || 'doc';

    const rawOutfitId = c.outfitId;
    const outfitLookup = rawOutfitId ? lookupResolvedBinding(resolvedBindings, rawOutfitId, 'outfit', options) : null;
    const outfitAssetId = outfitLookup ? outfitLookup.resolvedAssetId : (c.outfitId || 'outfit_scientist_labcoat');

    // Verify outfit compatibility via V4 Outfit Engine
    const outfitComp = checkCharacterOutfitCompatibility(charAssetId, outfitAssetId);

    const charNode = graph.addNode({
      instanceId: c.instanceId,
      assetId: charAssetId,
      type: NODE_TYPES.CHARACTER,
      name: `Character (${c.role || charAssetId})`,
      position: { x: c.position.x, y: c.position.y },
      scale: c.scale ?? 1.0,
      size: { width: 0.22, height: 0.42 },
      anchor: ANCHORS.BOTTOM_CENTER,
      zIndex: c.zIndex || 10,
      metadata: {
        role: c.role || 'main',
        facing: typeof c.facing === 'number' ? c.facing : (c.facing === 'left' ? -1 : 1),
        outfitId: outfitAssetId,
        outfitCompatible: outfitComp.compatible,
        expressionId: c.expressionId || 'neutral',
        locked: c.locked ?? false
      }
    });
    assignLayerAndZIndex(charNode);
    charNodeMap.set(c.instanceId, charNode);

    // If outfit is an attached child node
    if (outfitAssetId) {
      const outfitNode = graph.addNode({
        instanceId: `${c.instanceId}_outfit`,
        assetId: outfitAssetId,
        type: NODE_TYPES.OUTFIT,
        parentId: c.instanceId,
        name: `Outfit (${outfitAssetId})`,
        position: { x: 0, y: 0 },
        scale: 1.0,
        size: { width: 0.22, height: 0.42 },
        anchor: ANCHORS.BOTTOM_CENTER,
        zIndex: charNode.zIndex + 1
      });
      assignLayerAndZIndex(outfitNode);
    }
  }

  // 3. Prop Nodes & Handheld Attachments
  for (const p of (composedScene.props || [])) {
    const rawAssetId = p.assetId || p.id;
    const propLookup = lookupResolvedBinding(resolvedBindings, rawAssetId, 'prop', options);
    const resolvedAssetId = propLookup.resolvedAssetId || rawAssetId;
    const propAnchorPreset = propLookup.binding?.anchor || resolvedBindings[rawAssetId]?.anchor || p.anchorPreset || 'center';

    let parentId = 'root';
    let localPos = { x: p.position.x, y: p.position.y };

    // Check if attached to character hand / head
    if (p.attachedTo && charNodeMap.has(p.attachedTo)) {
      parentId = p.attachedTo;
      if (p.anchorPreset === 'hand_grip' || p.placement?.anchor === 'right_hand') {
        localPos = { x: 0.08, y: -0.18 };
      } else if (p.placement?.anchor === 'left_hand') {
        localPos = { x: -0.08, y: -0.18 };
      } else if (p.placement?.anchor === 'head') {
        localPos = { x: 0.0, y: -0.38 };
      } else {
        localPos = { x: 0.06, y: -0.15 };
      }
    }

    const propNode = graph.addNode({
      instanceId: p.instanceId,
      assetId: resolvedAssetId,
      type: NODE_TYPES.PROP,
      parentId,
      name: `Prop (${resolvedAssetId})`,
      position: localPos,
      scale: p.scale ?? 1.0,
      rotation: p.rotation ?? 0.0,
      size: p.size || { width: 0.12, height: 0.12 },
      anchor: ANCHORS.CENTER,
      zIndex: p.zIndex || (parentId !== 'root' ? 15 : 8),
      metadata: {
        attachedTo: p.attachedTo || null,
        anchorPreset: propAnchorPreset,
        locked: p.locked ?? false
      }
    });
    assignLayerAndZIndex(propNode, { inFrontOfCharacter: parentId !== 'root' });
  }

  // 4. Text & Graphics Nodes
  for (const tg of (composedScene.textGraphics || [])) {
    const tgNode = graph.addNode({
      instanceId: tg.id || `text_${Math.random().toString(36).substr(2, 4)}`,
      type: NODE_TYPES.TEXT,
      name: tg.title || tg.text || 'Text Label',
      position: { x: tg.position?.x ?? 0.5, y: tg.position?.y ?? 0.2 },
      size: tg.size || { width: 0.4, height: 0.1 },
      anchor: ANCHORS.CENTER,
      zIndex: 30,
      metadata: { ...tg }
    });
    assignLayerAndZIndex(tgNode);
  }

  // 5. VFX Nodes
  for (const vf of (composedScene.vfx || [])) {
    const vfNode = graph.addNode({
      instanceId: vf.id || `vfx_${Math.random().toString(36).substr(2, 4)}`,
      assetId: vf.type || vf.assetId,
      type: NODE_TYPES.VFX,
      name: `VFX (${vf.type || 'effect'})`,
      position: { x: vf.position?.x ?? 0.5, y: vf.position?.y ?? 0.5 },
      scale: vf.scale ?? 1.0,
      size: { width: 0.2, height: 0.2 },
      anchor: ANCHORS.CENTER,
      zIndex: 22,
      metadata: { ...vf }
    });
    assignLayerAndZIndex(vfNode);
  }

  return graph;
}
