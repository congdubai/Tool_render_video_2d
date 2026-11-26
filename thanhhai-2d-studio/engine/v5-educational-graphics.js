// engine/v5-educational-graphics.js — Educational Graphics & Vietnamese Text Layout (V5 Phase 3)
// Generates diagrams, arrows, comparison cards, timeline nodes, and wraps/fits UTF-8 Vietnamese text.

export const GRAPHIC_TYPES = {
  TITLE_CARD: 'title_card',
  LABEL: 'label',
  CALLOUT: 'callout',
  ARROW: 'arrow',
  LINE: 'line',
  HIGHLIGHT_BOX: 'highlight_box',
  COMPARISON_CARD: 'comparison_card',
  TIMELINE_NODE: 'timeline_node',
  PROCESS_DIAGRAM: 'process_diagram'
};

export const DEFAULT_FONT_FAMILY = "'Be Vietnam Pro', 'Segoe UI', Arial, sans-serif";

/**
 * Wraps text into lines based on maximum character count or estimated width
 */
export function wrapVietnameseText(text = '', maxCharsPerLine = 35) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Creates a formatted text graphic object ready for rendering
 */
export function createTextGraphic(options = {}) {
  const text = options.text || options.title || '';
  const lines = wrapVietnameseText(text, options.maxCharsPerLine || 32);

  return {
    id: options.id || `text_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    type: options.type || GRAPHIC_TYPES.LABEL,
    text,
    lines,
    position: {
      x: options.position?.x ?? 0.5,
      y: options.position?.y ?? 0.2
    },
    size: {
      width: options.size?.width ?? 0.4,
      height: options.size?.height ?? (lines.length * 0.05 + 0.04)
    },
    style: {
      fontFamily: options.fontFamily || DEFAULT_FONT_FAMILY,
      fontSize: options.fontSize || (options.type === GRAPHIC_TYPES.TITLE_CARD ? 32 : 22),
      fontWeight: options.fontWeight || '700',
      fillColor: options.fillColor || '#FFFFFF',
      strokeColor: options.strokeColor || '#0f172a',
      strokeWidth: options.strokeWidth || 4,
      backgroundColor: options.backgroundColor || (options.type === GRAPHIC_TYPES.CALLOUT ? 'rgba(15, 23, 42, 0.85)' : null),
      borderRadius: options.borderRadius || 8,
      textAlign: options.textAlign || 'center'
    },
    visible: options.visible ?? true,
    zIndex: options.zIndex ?? 30
  };
}

/**
 * Creates an arrow graphic connecting two points
 */
export function createArrowGraphic(options = {}) {
  return {
    id: options.id || `arrow_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    type: GRAPHIC_TYPES.ARROW,
    from: { x: options.from?.x ?? 0.3, y: options.from?.y ?? 0.5 },
    to: { x: options.to?.x ?? 0.7, y: options.to?.y ?? 0.5 },
    color: options.color || '#38bdf8',
    width: options.width || 4,
    headSize: options.headSize || 12,
    curved: options.curved ?? false,
    label: options.label || null,
    zIndex: options.zIndex ?? 28
  };
}

/**
 * Creates a comparison card graphic
 */
export function createComparisonCard(options = {}) {
  return {
    id: options.id || `comp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    type: GRAPHIC_TYPES.COMPARISON_CARD,
    title: options.title || 'So sánh',
    position: { x: options.position?.x ?? 0.5, y: options.position?.y ?? 0.5 },
    size: { width: options.width ?? 0.35, height: options.height ?? 0.45 },
    headerColor: options.headerColor || '#38bdf8',
    backgroundColor: options.backgroundColor || 'rgba(30, 41, 59, 0.90)',
    items: Array.isArray(options.items) ? options.items : []
  };
}

/**
 * Creates timeline nodes and connecting horizontal line
 */
export function createTimelineGraphics(milestones = []) {
  const count = milestones.length;
  if (count === 0) return { line: null, nodes: [] };

  const startX = 0.12;
  const endX = 0.88;
  const step = count > 1 ? (endX - startX) / (count - 1) : 0;
  const lineY = 0.65;

  const line = {
    id: 'timeline_axis_line',
    type: GRAPHIC_TYPES.LINE,
    from: { x: startX, y: lineY },
    to: { x: endX, y: lineY },
    color: '#0284c7',
    width: 6,
    zIndex: 25
  };

  const nodes = milestones.map((m, idx) => {
    const x = count > 1 ? startX + (idx * step) : 0.5;
    return {
      id: `timeline_node_${idx}`,
      type: GRAPHIC_TYPES.TIMELINE_NODE,
      position: { x, y: lineY },
      year: m.year || m.date || `${1940 + idx * 20}`,
      title: m.title || `Giai đoạn ${idx + 1}`,
      description: m.description || '',
      color: idx === 0 ? '#38bdf8' : (idx === count - 1 ? '#4ade80' : '#f59e0b'),
      zIndex: 26
    };
  });

  return { line, nodes };
}

