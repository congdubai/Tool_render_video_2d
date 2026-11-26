// engine/v5-scene-construction.js — Scene Graph Construction & Object Assembly (V5 Phase 3)
// Instantiates characters, outfits, props, attachments, groups, VFX and background into the Scene Graph.

import { SceneGraph, NODE_TYPES } from './v5-scene-graph.js';
import { assignLayerAndZIndex } from './v5-layer-camera-builder.js';
import { ANCHORS } from './v5-coordinate-system.js';
import { checkCharacterOutfitCompatibility } from './compatibility-engine-v4.js';

/**
 * Builds a complete SceneGraph from a composed scene descriptor and resolved assets
 */
export function constructSceneGraph(composedScene, resolvedBindings = {}, options = {}) {
  const sceneId = composedScene.id || composedScene.sceneId || `scene_${Date.now()}`;
  const graph = new SceneGraph({ sceneId });

  // 1. Background Node
  const bgAssetId = composedScene.background?.assetId || composedScene.background?.id || 'bg_lab_modern';
  const bgResolved = resolvedBindings[bgAssetId]?.resolvedAssetId || bgAssetId;
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
    const charAssetId = resolvedBindings[c.characterId]?.resolvedAssetId || c.characterId || 'doc';
    const outfitAssetId = resolvedBindings[c.outfitId]?.resolvedAssetId || c.outfitId || 'outfit_scientist_labcoat';

    // Verify outfit compatibility via V4 Outfit Engine
    const outfitComp = checkCharacterOutfitCompatibility(charAssetId, outfitAssetId);

    const charNode = graph.addNode({
      instanceId: c.instanceId,
      assetId: charAssetId,
      type: NODE_TYPES.CHARACTER,
      name: `Character (${c.role || 'Doc'})`,
      position: { x: c.position.x, y: c.position.y },
      scale: c.scale ?? 1.0,
      size: { width: 0.22, height: 0.42 },
      anchor: ANCHORS.BOTTOM_CENTER,
      zIndex: c.zIndex || 10,
      metadata: {
        role: c.role || 'main',
        facing: c.facing ?? 1,
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
    const resolvedAssetId = resolvedBindings[rawAssetId]?.resolvedAssetId || rawAssetId;
    const propAnchorPreset = resolvedBindings[rawAssetId]?.anchor || p.anchorPreset || 'center';

    let parentId = 'root';
    let localPos = { x: p.position.x, y: p.position.y };

    // Check if attached to character hand / head
    if (p.attachedTo && charNodeMap.has(p.attachedTo)) {
      parentId = p.attachedTo;
      // Position relative to character anchor (e.g. hand offset)
      if (p.anchorPreset === 'hand_grip' || p.placement?.anchor === 'right_hand') {
        localPos = { x: 0.08, y: -0.18 }; // Right hand offset
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
