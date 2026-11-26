// engine/v5-scene-graph.js — Hierarchical 2D Scene Graph Engine (V5 Phase 3)
// Supports multi-tier node types, parent-child transform inheritance, world bounding boxes,
// cycle detection, z-index sorting, and serialization into standard V4 scene structures.

import { ANCHORS, calculateBoundingBox } from './v5-coordinate-system.js';

export const NODE_TYPES = {
  SCENE_ROOT: 'scene_root',
  BACKGROUND: 'background',
  FOREGROUND: 'foreground',
  ENVIRONMENT_LAYER: 'environment_layer',
  CHARACTER: 'character',
  CHARACTER_PART: 'character_part',
  OUTFIT: 'outfit',
  ACCESSORY: 'accessory',
  PROP: 'prop',
  ILLUSTRATION: 'illustration',
  DIAGRAM: 'diagram',
  TEXT: 'text',
  GRAPHIC: 'graphic',
  VFX: 'vfx',
  WEATHER: 'weather',
  CAMERA: 'camera',
  GROUP: 'group'
};

export const LAYER_GROUPS = {
  BACKGROUND: 0,
  BACKGROUND_ENV: 1,
  REAR_VFX: 2,
  MIDGROUND_OBJECTS: 3,
  CHARACTERS: 4,
  ATTACHED_PROPS: 5,
  FRONT_ENV: 6,
  FOREGROUND: 7,
  FRONT_VFX: 8,
  TEXT_GRAPHICS: 9,
  OVERLAY: 10
};

export class SceneGraphNode {
  constructor(options = {}) {
    this.instanceId = options.instanceId || `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.assetId = options.assetId || null;
    this.type = options.type || NODE_TYPES.GROUP;
    this.name = options.name || this.instanceId;
    this.parentId = options.parentId || null;
    this.children = Array.isArray(options.children) ? [...options.children] : [];

    // Local Transforms
    this.position = {
      x: typeof options.position?.x === 'number' ? options.position.x : (options.x ?? 0.5),
      y: typeof options.position?.y === 'number' ? options.position.y : (options.y ?? 0.5)
    };
    this.rotation = options.rotation ?? 0.0;
    this.scale = {
      x: typeof options.scale?.x === 'number' ? options.scale.x : (typeof options.scale === 'number' ? options.scale : (options.scaleX ?? 1.0)),
      y: typeof options.scale?.y === 'number' ? options.scale.y : (typeof options.scale === 'number' ? options.scale : (options.scaleY ?? 1.0))
    };
    this.size = {
      width: options.size?.width ?? (options.width ?? 0.2),
      height: options.size?.height ?? (options.height ?? 0.3)
    };
    this.anchor = options.anchor || ANCHORS.BOTTOM_CENTER;
    this.pivot = options.pivot || { x: 0.5, y: 0.5 };

    // Rendering & Layers
    this.opacity = Math.max(0.0, Math.min(1.0, options.opacity ?? 1.0));
    this.visibility = options.visibility ?? true;
    this.layerGroup = options.layerGroup ?? (options.type === NODE_TYPES.BACKGROUND ? LAYER_GROUPS.BACKGROUND : LAYER_GROUPS.CHARACTERS);
    this.zIndex = options.zIndex ?? 10;
    this.coordinateSpace = options.coordinateSpace || 'normalized'; // 'normalized' | 'pixel'

    // Metadata & Constraints
    this.metadata = options.metadata ? { ...options.metadata } : {};
    this.dependencies = Array.isArray(options.dependencies) ? [...options.dependencies] : [];
    this.timelineRef = options.timelineRef || { startSec: 0.0, endSec: 5.0 };
    this.locked = options.locked ?? false;
  }

  toJSON() {
    return {
      instanceId: this.instanceId,
      assetId: this.assetId,
      type: this.type,
      name: this.name,
      parentId: this.parentId,
      children: [...this.children],
      position: { ...this.position },
      rotation: this.rotation,
      scale: { ...this.scale },
      size: { ...this.size },
      anchor: { ...this.anchor },
      pivot: { ...this.pivot },
      opacity: this.opacity,
      visibility: this.visibility,
      layerGroup: this.layerGroup,
      zIndex: this.zIndex,
      coordinateSpace: this.coordinateSpace,
      metadata: { ...this.metadata },
      dependencies: [...this.dependencies],
      timelineRef: { ...this.timelineRef },
      locked: this.locked
    };
  }
}

export class SceneGraph {
  constructor(options = {}) {
    this.sceneId = options.sceneId || `scene_${Date.now()}`;
    this.rootId = 'root';
    this.nodes = new Map();

    // Create default root node
    const rootNode = new SceneGraphNode({
      instanceId: this.rootId,
      type: NODE_TYPES.SCENE_ROOT,
      name: 'Scene Root',
      position: { x: 0.0, y: 0.0 },
      size: { width: 1.0, height: 1.0 },
      anchor: ANCHORS.TOP_LEFT
    });
    this.nodes.set(this.rootId, rootNode);
  }

  addNode(nodeOptions) {
    const node = nodeOptions instanceof SceneGraphNode ? nodeOptions : new SceneGraphNode(nodeOptions);

    if (this.nodes.has(node.instanceId)) {
      throw new Error(`SceneGraph: Node with instanceId "${node.instanceId}" already exists.`);
    }

    const parentId = node.parentId || this.rootId;
    if (!this.nodes.has(parentId)) {
      throw new Error(`SceneGraph: Parent node "${parentId}" does not exist in graph.`);
    }

    node.parentId = parentId;
    this.nodes.set(node.instanceId, node);

    const parent = this.nodes.get(parentId);
    if (!parent.children.includes(node.instanceId)) {
      parent.children.push(node.instanceId);
    }

    // Verify no circular dependency introduced
    const cycle = this.detectCycles();
    if (cycle) {
      this.removeNode(node.instanceId);
      throw new Error(`SceneGraph: Circular dependency detected involving nodes: ${cycle.join(' -> ')}`);
    }

    return node;
  }

  removeNode(instanceId) {
    if (instanceId === this.rootId) {
      throw new Error('SceneGraph: Cannot remove root node.');
    }
    const node = this.nodes.get(instanceId);
    if (!node) return false;

    // Recursively remove children
    for (const childId of [...node.children]) {
      this.removeNode(childId);
    }

    // Remove from parent's children array
    if (node.parentId && this.nodes.has(node.parentId)) {
      const parent = this.nodes.get(node.parentId);
      parent.children = parent.children.filter(id => id !== instanceId);
    }

    this.nodes.delete(instanceId);
    return true;
  }

  getNode(instanceId) {
    return this.nodes.get(instanceId) || null;
  }

  hasNode(instanceId) {
    return this.nodes.has(instanceId);
  }

  getChildren(instanceId) {
    const node = this.getNode(instanceId);
    if (!node) return [];
    return node.children.map(id => this.getNode(id)).filter(Boolean);
  }

  getParent(instanceId) {
    const node = this.getNode(instanceId);
    if (!node || !node.parentId) return null;
    return this.getNode(node.parentId);
  }

  reparentNode(instanceId, newParentId) {
    if (instanceId === this.rootId) {
      throw new Error('SceneGraph: Cannot reparent root node.');
    }
    const node = this.getNode(instanceId);
    if (!node) throw new Error(`SceneGraph: Node "${instanceId}" not found.`);

    if (!this.nodes.has(newParentId)) {
      throw new Error(`SceneGraph: Target parent "${newParentId}" not found.`);
    }

    // Detach from current parent
    if (node.parentId && this.nodes.has(node.parentId)) {
      const oldParent = this.nodes.get(node.parentId);
      oldParent.children = oldParent.children.filter(id => id !== instanceId);
    }

    node.parentId = newParentId;
    const newParent = this.nodes.get(newParentId);
    if (!newParent.children.includes(instanceId)) {
      newParent.children.push(instanceId);
    }

    const cycle = this.detectCycles();
    if (cycle) {
      throw new Error(`SceneGraph: Reparenting creates circular dependency: ${cycle.join(' -> ')}`);
    }
    return true;
  }

  /**
   * Computes accumulated world transform for a node (handling parent position, scale, rotation)
   */
  getWorldTransform(instanceId) {
    const node = this.getNode(instanceId);
    if (!node) return null;

    if (instanceId === this.rootId || !node.parentId || node.parentId === this.rootId) {
      return {
        x: node.position.x,
        y: node.position.y,
        scaleX: node.scale.x,
        scaleY: node.scale.y,
        rotation: node.rotation,
        opacity: node.opacity
      };
    }

    const parentTransform = this.getWorldTransform(node.parentId);
    if (!parentTransform) {
      return {
        x: node.position.x,
        y: node.position.y,
        scaleX: node.scale.x,
        scaleY: node.scale.y,
        rotation: node.rotation,
        opacity: node.opacity
      };
    }

    // Scale child relative to parent
    const scaleX = parentTransform.scaleX * node.scale.x;
    const scaleY = parentTransform.scaleY * node.scale.y;
    const rotation = parentTransform.rotation + node.rotation;
    const opacity = parentTransform.opacity * node.opacity;

    // Offset child position by parent position and parent scale
    const x = parentTransform.x + (node.position.x * parentTransform.scaleX);
    const y = parentTransform.y + (node.position.y * parentTransform.scaleY);

    return { x, y, scaleX, scaleY, rotation, opacity };
  }

  /**
   * Computes world bounding box in normalized coordinates [0..1]
   */
  getWorldBoundingBox(instanceId) {
    const node = this.getNode(instanceId);
    if (!node) return null;

    const transform = this.getWorldTransform(instanceId);
    return calculateBoundingBox({
      position: { x: transform.x, y: transform.y },
      size: node.size,
      anchor: node.anchor,
      scaleX: transform.scaleX,
      scaleY: transform.scaleY
    });
  }

  /**
   * Computes aggregate bounding box for an entire group or character hierarchy
   */
  getGroupBoundingBox(groupId) {
    const groupNode = this.getNode(groupId);
    if (!groupNode) return null;

    const descendantBoxes = [];
    this.traverseDFS(node => {
      if (node.instanceId !== this.rootId && node.type !== NODE_TYPES.GROUP && node.type !== NODE_TYPES.SCENE_ROOT) {
        const box = this.getWorldBoundingBox(node.instanceId);
        if (box) descendantBoxes.push(box);
      }
    }, groupId);

    if (descendantBoxes.length === 0) {
      return this.getWorldBoundingBox(groupId);
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of descendantBoxes) {
      if (b.left < minX) minX = b.left;
      if (b.top < minY) minY = b.top;
      if (b.right > maxX) maxX = b.right;
      if (b.bottom > maxY) maxY = b.bottom;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    return {
      left: minX,
      top: minY,
      right: maxX,
      bottom: maxY,
      width,
      height,
      centerX: minX + width / 2,
      centerY: minY + height / 2
    };
  }

  /**
   * Detects cycles in parent-child hierarchy using Depth-First Search with recursion stack
   */
  detectCycles() {
    const visited = new Set();
    const recStack = new Set();
    let cyclePath = null;

    const dfs = (currId, path) => {
      visited.add(currId);
      recStack.add(currId);
      path.push(currId);

      const node = this.nodes.get(currId);
      if (node) {
        for (const childId of node.children) {
          if (!visited.has(childId)) {
            if (dfs(childId, path)) return true;
          } else if (recStack.has(childId)) {
            path.push(childId);
            cyclePath = [...path];
            return true;
          }
        }
      }

      recStack.delete(currId);
      path.pop();
      return false;
    };

    for (const id of this.nodes.keys()) {
      if (!visited.has(id)) {
        if (dfs(id, [])) return cyclePath;
      }
    }
    return null;
  }

  traverseDFS(visitor, startId = this.rootId) {
    const visited = new Set();
    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = this.nodes.get(id);
      if (!node) return;
      visitor(node);
      for (const childId of node.children) {
        visit(childId);
      }
    };
    visit(startId);
  }

  getNodesByType(type) {
    const results = [];
    for (const node of this.nodes.values()) {
      if (node.type === type) results.push(node);
    }
    return results;
  }

  /**
   * Returns flattened list of all renderable visible nodes sorted by LayerGroup and Z-Index
   */
  getSortedRenderList() {
    const renderables = [];
    for (const node of this.nodes.values()) {
      if (node.instanceId === this.rootId || !node.visibility) continue;
      renderables.push(node);
    }

    renderables.sort((a, b) => {
      if (a.layerGroup !== b.layerGroup) {
        return a.layerGroup - b.layerGroup;
      }
      return a.zIndex - b.zIndex;
    });

    return renderables;
  }

  clone() {
    const graph = new SceneGraph({ sceneId: this.sceneId });
    graph.nodes.clear();
    for (const [id, node] of this.nodes.entries()) {
      graph.nodes.set(id, new SceneGraphNode(node.toJSON()));
    }
    return graph;
  }

  toJSON() {
    const nodesArray = [];
    for (const node of this.nodes.values()) {
      nodesArray.push(node.toJSON());
    }
    return {
      sceneId: this.sceneId,
      rootId: this.rootId,
      nodes: nodesArray
    };
  }

  static fromJSON(data = {}) {
    const graph = new SceneGraph({ sceneId: data.sceneId });
    graph.nodes.clear();
    if (Array.isArray(data.nodes)) {
      for (const n of data.nodes) {
        graph.nodes.set(n.instanceId, new SceneGraphNode(n));
      }
    }
    return graph;
  }
}
