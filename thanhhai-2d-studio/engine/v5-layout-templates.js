// engine/v5-layout-templates.js — Reusable Composition Layout Templates Library (V5 Phase 3)
// Implements Templates A through L for automated rule-based scene composition.

import { ANCHORS } from './v5-coordinate-system.js';

export const TEMPLATE_IDS = {
  SINGLE_CHARACTER: 'template_single_character',
  CHARACTER_OBJECT: 'template_character_object',
  TWO_CHARACTER_DIALOGUE: 'template_two_character_dialogue',
  GROUP_INTERACTION: 'template_group_interaction',
  BEFORE_AND_AFTER: 'template_before_and_after',
  HISTORICAL_TIMELINE: 'template_historical_timeline',
  OBJECT_EXPLANATION: 'template_object_explanation',
  ENVIRONMENT_SHOT: 'template_environment_shot',
  COMEDY_ACTION: 'template_comedy_action',
  DIAGRAM_EXPLANATION: 'template_diagram_explanation',
  RULE_OF_THIRDS: 'template_rule_of_thirds',
  SYMMETRICAL_SHOWCASE: 'template_symmetrical_showcase'
};

export const LAYOUT_TEMPLATES = {
  [TEMPLATE_IDS.SINGLE_CHARACTER]: {
    id: TEMPLATE_IDS.SINGLE_CHARACTER,
    name: 'Template A — Single Character',
    supportedSceneTypes: ['CHARACTER_ACTING', 'SCIENTIST_THINKING', 'DEFAULT'],
    defaultCameraPreset: 'medium_shot',
    slots: {
      character: { x: 0.50, y: 0.80, anchor: ANCHORS.BOTTOM_CENTER, scale: 1.05, facing: 1 },
      callout: { x: 0.75, y: 0.35, anchor: ANCHORS.CENTER, scale: 0.8 }
    },
    applyLayout: (ctx) => {
      const charCount = ctx.characters?.length || 0;
      const posX = charCount === 1 && ctx.props?.length > 0 ? 0.38 : 0.50;
      return {
        characters: [{ slot: 'main', position: { x: posX, y: 0.80 }, scale: 1.05, facing: 1 }],
        props: ctx.props?.map((p, idx) => ({
          slot: `prop_${idx}`,
          position: { x: 0.72 + (idx * 0.1), y: 0.75 },
          scale: 0.9
        })) || []
      };
    }
  },

  [TEMPLATE_IDS.CHARACTER_OBJECT]: {
    id: TEMPLATE_IDS.CHARACTER_OBJECT,
    name: 'Template B — Character & Object',
    supportedSceneTypes: ['OBJECT_EXPLANATION', 'CHARACTER_ACTING', 'SCIENTIST_THINKING'],
    defaultCameraPreset: 'medium_shot',
    slots: {
      character: { x: 0.28, y: 0.80, anchor: ANCHORS.BOTTOM_CENTER, scale: 1.0, facing: 1 },
      object: { x: 0.70, y: 0.75, anchor: ANCHORS.BOTTOM_CENTER, scale: 1.15 }
    },
    applyLayout: (ctx) => {
      return {
        characters: [{ slot: 'presenter', position: { x: 0.28, y: 0.80 }, scale: 1.0, facing: 1 }],
        props: ctx.props?.map((p, idx) => ({
          slot: `object_${idx}`,
          position: { x: 0.68 + (idx * 0.12), y: 0.75 },
          scale: 1.15
        })) || []
      };
    }
  },

  [TEMPLATE_IDS.TWO_CHARACTER_DIALOGUE]: {
    id: TEMPLATE_IDS.TWO_CHARACTER_DIALOGUE,
    name: 'Template C — Two Character Dialogue',
    supportedSceneTypes: ['CHARACTER_DIALOGUE', 'HISTORICAL_REENACTMENT'],
    defaultCameraPreset: 'two_shot',
    slots: {
      charLeft: { x: 0.30, y: 0.80, anchor: ANCHORS.BOTTOM_CENTER, scale: 1.0, facing: 1 },
      charRight: { x: 0.70, y: 0.80, anchor: ANCHORS.BOTTOM_CENTER, scale: 1.0, facing: -1 }
    },
    applyLayout: (ctx) => {
      return {
        characters: [
          { slot: 'speaker_left', position: { x: 0.30, y: 0.80 }, scale: 1.0, facing: 1 },
          { slot: 'speaker_right', position: { x: 0.70, y: 0.80 }, scale: 1.0, facing: -1 }
        ],
        props: []
      };
    }
  },

  [TEMPLATE_IDS.GROUP_INTERACTION]: {
    id: TEMPLATE_IDS.GROUP_INTERACTION,
    name: 'Template D — Group Interaction',
    supportedSceneTypes: ['CHARACTER_DIALOGUE', 'HISTORICAL_REENACTMENT', 'CROWD'],
    defaultCameraPreset: 'group_shot',
    slots: {
      leader: { x: 0.50, y: 0.82, anchor: ANCHORS.BOTTOM_CENTER, scale: 1.05, facing: 1, zIndex: 12 },
      memberLeft: { x: 0.25, y: 0.78, anchor: ANCHORS.BOTTOM_CENTER, scale: 0.95, facing: 1, zIndex: 10 },
      memberRight: { x: 0.75, y: 0.78, anchor: ANCHORS.BOTTOM_CENTER, scale: 0.95, facing: -1, zIndex: 10 }
    },
    applyLayout: (ctx) => {
      const positions = [
        { x: 0.50, y: 0.82, scale: 1.05, facing: 1, zIndex: 12 },
        { x: 0.25, y: 0.78, scale: 0.95, facing: 1, zIndex: 10 },
        { x: 0.75, y: 0.78, scale: 0.95, facing: -1, zIndex: 10 },
        { x: 0.15, y: 0.76, scale: 0.90, facing: 1, zIndex: 8 },
        { x: 0.85, y: 0.76, scale: 0.90, facing: -1, zIndex: 8 }
      ];
      return {
        characters: (ctx.characters || []).map((c, i) => ({
          slot: `group_${i}`,
          ...(positions[i] || { x: 0.50 + ((i % 2 === 0 ? 1 : -1) * 0.15 * Math.ceil(i / 2)), y: 0.78, scale: 0.9, facing: 1, zIndex: 10 })
        })),
        props: []
      };
    }
  },

  [TEMPLATE_IDS.BEFORE_AND_AFTER]: {
    id: TEMPLATE_IDS.BEFORE_AND_AFTER,
    name: 'Template E — Before & After Comparison',
    supportedSceneTypes: ['VISUAL_COMPARISON'],
    defaultCameraPreset: 'wide_shot',
    slots: {
      leftItem: { x: 0.28, y: 0.65, anchor: ANCHORS.CENTER, scale: 1.0 },
      rightItem: { x: 0.72, y: 0.65, anchor: ANCHORS.CENTER, scale: 1.0 },
      vsBadge: { x: 0.50, y: 0.50, anchor: ANCHORS.CENTER, scale: 0.8 }
    },
    applyLayout: (ctx) => {
      return {
        props: [
          { slot: 'before', position: { x: 0.28, y: 0.65 }, scale: 1.0 },
          { slot: 'after', position: { x: 0.72, y: 0.65 }, scale: 1.0 }
        ],
        textGraphics: [
          { type: 'comparison_badge', text: 'VS', position: { x: 0.50, y: 0.50 } },
          { type: 'label', text: ctx.labels?.[0] || 'Trước kia', position: { x: 0.28, y: 0.30 } },
          { type: 'label', text: ctx.labels?.[1] || 'Hiện nay', position: { x: 0.72, y: 0.30 } }
        ]
      };
    }
  },

  [TEMPLATE_IDS.HISTORICAL_TIMELINE]: {
    id: TEMPLATE_IDS.HISTORICAL_TIMELINE,
    name: 'Template F — Historical Timeline',
    supportedSceneTypes: ['TIMELINE_EXPLANATION'],
    defaultCameraPreset: 'wide_shot',
    slots: {
      timelineLine: { x: 0.50, y: 0.60, anchor: ANCHORS.CENTER }
    },
    applyLayout: (ctx) => {
      const count = Math.max(2, ctx.items?.length || ctx.props?.length || 4);
      const step = 0.80 / (count - 1);
      const props = [];
      const textGraphics = [];

      for (let i = 0; i < count; i++) {
        const x = 0.10 + (i * step);
        props.push({
          slot: `timeline_item_${i}`,
          position: { x, y: 0.58 },
          scale: 0.85
        });
        textGraphics.push({
          type: 'timeline_node',
          text: ctx.dates?.[i] || `${1940 + i * 20}`,
          position: { x, y: 0.78 }
        });
      }

      return { props, textGraphics };
    }
  },

  [TEMPLATE_IDS.OBJECT_EXPLANATION]: {
    id: TEMPLATE_IDS.OBJECT_EXPLANATION,
    name: 'Template G — Object Explanation',
    supportedSceneTypes: ['OBJECT_EXPLANATION'],
    defaultCameraPreset: 'object_close_up',
    slots: {
      centerObject: { x: 0.50, y: 0.60, anchor: ANCHORS.CENTER, scale: 1.35 },
      labelTop: { x: 0.50, y: 0.22, anchor: ANCHORS.CENTER }
    },
    applyLayout: (ctx) => {
      return {
        props: [{ slot: 'featured_object', position: { x: 0.50, y: 0.60 }, scale: 1.35 }],
        characters: ctx.characters?.length > 0 ? [{ slot: 'narrator', position: { x: 0.18, y: 0.85 }, scale: 0.75, facing: 1 }] : [],
        textGraphics: [{ type: 'highlight_box', position: { x: 0.50, y: 0.22 }, text: ctx.objectLabel || 'Chi Tiết Linh Kiện' }]
      };
    }
  },

  [TEMPLATE_IDS.ENVIRONMENT_SHOT]: {
    id: TEMPLATE_IDS.ENVIRONMENT_SHOT,
    name: 'Template H — Environment Shot',
    supportedSceneTypes: ['ENVIRONMENT_SHOT'],
    defaultCameraPreset: 'establishing_shot',
    slots: {
      background: { x: 0.50, y: 0.50, scale: 1.0 }
    },
    applyLayout: (ctx) => {
      return {
        characters: ctx.characters?.length > 0 ? [{ slot: 'wanderer', position: { x: 0.50, y: 0.85 }, scale: 0.60, facing: 1 }] : [],
        props: []
      };
    }
  },

  [TEMPLATE_IDS.COMEDY_ACTION]: {
    id: TEMPLATE_IDS.COMEDY_ACTION,
    name: 'Template I — Comedy Action',
    supportedSceneTypes: ['COMEDY_ACTION'],
    defaultCameraPreset: 'full_shot',
    slots: {
      actionCenter: { x: 0.50, y: 0.75, anchor: ANCHORS.BOTTOM_CENTER, scale: 1.0 }
    },
    applyLayout: (ctx) => {
      return {
        characters: [
          { slot: 'actor_left', position: { x: 0.40, y: 0.75 }, scale: 1.0, facing: 1 },
          { slot: 'actor_right', position: { x: 0.60, y: 0.75 }, scale: 1.0, facing: -1 }
        ],
        vfx: [{ type: 'fight_cloud', position: { x: 0.50, y: 0.68 } }]
      };
    }
  },

  [TEMPLATE_IDS.DIAGRAM_EXPLANATION]: {
    id: TEMPLATE_IDS.DIAGRAM_EXPLANATION,
    name: 'Template J — Diagram Explanation',
    supportedSceneTypes: ['DIAGRAM_EXPLANATION'],
    defaultCameraPreset: 'diagram_shot',
    slots: {
      diagramCenter: { x: 0.50, y: 0.50, anchor: ANCHORS.CENTER }
    },
    applyLayout: (ctx) => {
      return {
        diagramNodes: [
          { id: 'node_1', position: { x: 0.25, y: 0.50 }, text: 'Đầu vào (Input)' },
          { id: 'node_2', position: { x: 0.50, y: 0.50 }, text: 'Xử lý (CPU)' },
          { id: 'node_3', position: { x: 0.75, y: 0.50 }, text: 'Đầu ra (Output)' }
        ],
        arrows: [
          { from: { x: 0.33, y: 0.50 }, to: { x: 0.42, y: 0.50 } },
          { from: { x: 0.58, y: 0.50 }, to: { x: 0.67, y: 0.50 } }
        ]
      };
    }
  },

  [TEMPLATE_IDS.RULE_OF_THIRDS]: {
    id: TEMPLATE_IDS.RULE_OF_THIRDS,
    name: 'Template K — Rule of Thirds',
    supportedSceneTypes: ['CHARACTER_ACTING', 'OBJECT_EXPLANATION'],
    defaultCameraPreset: 'medium_shot',
    slots: {
      thirdLeft: { x: 0.33, y: 0.80, anchor: ANCHORS.BOTTOM_CENTER, scale: 1.05 },
      thirdRight: { x: 0.67, y: 0.80, anchor: ANCHORS.BOTTOM_CENTER, scale: 1.05 }
    },
    applyLayout: (ctx) => {
      return {
        characters: [{ slot: 'subject', position: { x: 0.33, y: 0.80 }, scale: 1.05, facing: 1 }],
        props: [{ slot: 'interest', position: { x: 0.67, y: 0.65 }, scale: 1.1 }]
      };
    }
  },

  [TEMPLATE_IDS.SYMMETRICAL_SHOWCASE]: {
    id: TEMPLATE_IDS.SYMMETRICAL_SHOWCASE,
    name: 'Template L — Symmetrical Showcase',
    supportedSceneTypes: ['SYMBOLIC_ANIMATION', 'OBJECT_EXPLANATION'],
    defaultCameraPreset: 'close_up',
    slots: {
      center: { x: 0.50, y: 0.55, anchor: ANCHORS.CENTER, scale: 1.25 }
    },
    applyLayout: (ctx) => {
      return {
        props: [{ slot: 'center_prop', position: { x: 0.50, y: 0.55 }, scale: 1.25 }]
      };
    }
  }
};

/**
 * Chooses the best layout template for a given scene context
 */
export function selectBestLayoutTemplate(scene = {}) {
  const sceneType = (scene.sceneType || scene.type || '').toUpperCase();
  const charCount = (scene.characters || []).length;
  const propCount = (scene.props || []).length;

  if (sceneType === 'VISUAL_COMPARISON' || scene.visualObjective?.toLowerCase().includes('so sánh')) {
    return LAYOUT_TEMPLATES[TEMPLATE_IDS.BEFORE_AND_AFTER];
  }
  if (sceneType === 'TIMELINE_EXPLANATION' || scene.visualObjective?.toLowerCase().includes('tiến hóa') || scene.visualObjective?.toLowerCase().includes('lịch sử')) {
    return LAYOUT_TEMPLATES[TEMPLATE_IDS.HISTORICAL_TIMELINE];
  }
  if (sceneType === 'DIAGRAM_EXPLANATION' || sceneType === 'PROCESS') {
    return LAYOUT_TEMPLATES[TEMPLATE_IDS.DIAGRAM_EXPLANATION];
  }
  if (sceneType === 'COMEDY_ACTION' || (scene.visualBeats || []).some(b => b.actionId?.includes('fight') || b.actionId?.includes('chase'))) {
    return LAYOUT_TEMPLATES[TEMPLATE_IDS.COMEDY_ACTION];
  }
  if (sceneType === 'ENVIRONMENT_SHOT' || (charCount === 0 && propCount === 0)) {
    return LAYOUT_TEMPLATES[TEMPLATE_IDS.ENVIRONMENT_SHOT];
  }
  if (sceneType === 'CHARACTER_DIALOGUE' || charCount >= 2) {
    if (charCount > 2) return LAYOUT_TEMPLATES[TEMPLATE_IDS.GROUP_INTERACTION];
    return LAYOUT_TEMPLATES[TEMPLATE_IDS.TWO_CHARACTER_DIALOGUE];
  }
  if (sceneType === 'OBJECT_EXPLANATION' || (propCount > 0 && charCount <= 1)) {
    return charCount === 1 ? LAYOUT_TEMPLATES[TEMPLATE_IDS.CHARACTER_OBJECT] : LAYOUT_TEMPLATES[TEMPLATE_IDS.OBJECT_EXPLANATION];
  }

  // Default single character
  return LAYOUT_TEMPLATES[TEMPLATE_IDS.SINGLE_CHARACTER];
}
