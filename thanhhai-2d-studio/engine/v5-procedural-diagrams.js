// engine/v5-procedural-diagrams.js — Procedural Diagram & Educational Graphics Generator (V5.1)
// Generates parametric vector diagrams for educational cartoon videos:
// Historical timelines, principle flowcharts, structural callouts, before-and-after comparisons.

import { getStyleTheme } from './v5-style-engine.js';
import { renderToSvg, renderToPngFile } from './v5-vector-engine.js';

export function generateProceduralDiagram(diagramType = 'historical_timeline', options = {}) {
  const normType = String(diagramType || 'historical_timeline').toLowerCase();
  const width = options.width || 1280;
  const height = options.height || 720;
  const styleProfile = options.styleProfile || 'minimal_educational';
  const theme = getStyleTheme(styleProfile);
  const strokeColor = theme.outlineColor;
  const strokeWidth = theme.outlineWidth;
  const palette = { ...theme.palette, ...(options.palette || {}) };

  const builder = DIAGRAM_BUILDERS[normType] || DIAGRAM_BUILDERS.historical_timeline;
  const result = builder({ width, height, palette, strokeColor, strokeWidth, options });

  const vectorSpec = {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    styleProfile,
    templateId: normType,
    elements: result.elements
  };

  return {
    id: `diag_${normType}`,
    type: 'diagram',
    name: result.name || 'Sơ đồ minh họa giáo dục',
    width,
    height,
    layers: result.layers || [{ id: 'main', name: 'Sơ đồ', elements: result.elements }],
    vectorSpec,
    getSvg: () => renderToSvg(vectorSpec),
    renderPng: (outPath) => renderToPngFile(vectorSpec, outPath, { width, height })
  };
}

const DIAGRAM_BUILDERS = {
  // 1. HISTORICAL TIMELINE
  historical_timeline: ({ width, height, palette, strokeColor, strokeWidth, options }) => {
    const milestones = options.milestones || [
      { year: '1946', title: 'ENIAC (Đèn chân không)' },
      { year: '1958', title: 'Transistor (Bán dẫn)' },
      { year: '1971', title: 'Microprocessor (Vi xử lý)' },
      { year: 'Hiện tại', title: 'Smartphone & Quantum AI' }
    ];

    const elements = [];
    const centerY = height * 0.52;
    const startX = width * 0.12;
    const endX = width * 0.88;

    // Header Title
    elements.push({
      type: 'text',
      x: width * 0.5,
      y: height * 0.18,
      text: options.title || 'DÒNG THỜI GIAN TIẾN HÓA MÁY TÍNH',
      fontSize: 28,
      fontFamily: 'sans-serif',
      fontWeight: 'bold',
      fill: palette.primary,
      textAnchor: 'middle'
    });

    // Horizontal baseline
    elements.push({
      type: 'line',
      x1: startX,
      y1: centerY,
      x2: endX,
      y2: centerY,
      stroke: palette.primary,
      strokeWidth: strokeWidth + 2
    });

    // Milestones
    const count = milestones.length;
    const step = (endX - startX) / (count - 1);

    milestones.forEach((m, idx) => {
      const cx = startX + idx * step;
      const isTop = idx % 2 === 0;
      const nodeY = isTop ? centerY - 90 : centerY + 90;

      // Vertical connector
      elements.push({
        type: 'line',
        x1: cx,
        y1: centerY,
        x2: cx,
        y2: nodeY + (isTop ? 30 : -30),
        stroke: strokeColor,
        strokeWidth: 3,
        strokeDasharray: '6 4'
      });

      // Milestone circle
      elements.push({
        type: 'circle',
        cx,
        cy: centerY,
        r: 16,
        fill: palette.accent,
        stroke: strokeColor,
        strokeWidth: 4
      });

      // Milestone box
      elements.push({
        type: 'rounded_rect',
        x: cx - 110,
        y: isTop ? nodeY - 35 : nodeY - 15,
        width: 220,
        height: 60,
        rx: 10,
        fill: '#0f172a',
        stroke: strokeColor,
        strokeWidth: 3
      });

      // Year badge
      elements.push({
        type: 'text',
        x: cx,
        y: isTop ? nodeY - 12 : nodeY + 8,
        text: m.year,
        fontSize: 16,
        fontWeight: 'bold',
        fill: palette.accent,
        textAnchor: 'middle'
      });

      // Title
      elements.push({
        type: 'text',
        x: cx,
        y: isTop ? nodeY + 12 : nodeY + 30,
        text: m.title,
        fontSize: 12,
        fill: '#f8fafc',
        textAnchor: 'middle'
      });
    });

    return {
      name: 'Dòng thời gian lịch sử',
      elements
    };
  },

  // 2. PRINCIPLE FLOWCHART (Input -> Process -> Output)
  principle_diagram: ({ width, height, palette, strokeColor, strokeWidth, options }) => {
    const elements = [
      { type: 'text', x: width * 0.5, y: 70, text: options.title || 'SƠ ĐỒ NGUYÊN LÝ HOẠT ĐỘNG', fontSize: 26, fontWeight: 'bold', fill: palette.primary, textAnchor: 'middle' },
      // Step 1: Input Box
      { type: 'rounded_rect', x: width * 0.1, y: height * 0.35, width: width * 0.22, height: 160, rx: 12, fill: '#1e293b', stroke: strokeColor, strokeWidth },
      { type: 'text', x: width * 0.21, y: height * 0.44, text: 'DỮ LIỆU ĐẦU VÀO', fontSize: 18, fontWeight: 'bold', fill: '#38bdf8', textAnchor: 'middle' },
      { type: 'text', x: width * 0.21, y: height * 0.49, text: '(Input / Sensors)', fontSize: 13, fill: '#94a3b8', textAnchor: 'middle' },
      // Arrow 1
      { type: 'line', x1: width * 0.33, y1: height * 0.46, x2: width * 0.41, y2: height * 0.46, stroke: palette.accent, strokeWidth: 6 },
      // Step 2: Processing Unit
      { type: 'rounded_rect', x: width * 0.42, y: height * 0.3, width: width * 0.26, height: 200, rx: 16, fill: '#0f172a', stroke: '#f59e0b', strokeWidth: 5 },
      { type: 'text', x: width * 0.55, y: height * 0.43, text: 'BỘ XỬ LÝ TRUNG TÂM', fontSize: 20, fontWeight: 'bold', fill: '#facc15', textAnchor: 'middle' },
      { type: 'text', x: width * 0.55, y: height * 0.48, text: '(CPU / Logic Core)', fontSize: 14, fill: '#cbd5e1', textAnchor: 'middle' },
      // Arrow 2
      { type: 'line', x1: width * 0.69, y1: height * 0.46, x2: width * 0.77, y2: height * 0.46, stroke: palette.accent, strokeWidth: 6 },
      // Step 3: Output Result
      { type: 'rounded_rect', x: width * 0.78, y: height * 0.35, width: width * 0.22, height: 160, rx: 12, fill: '#1e293b', stroke: strokeColor, strokeWidth },
      { type: 'text', x: width * 0.89, y: height * 0.44, text: 'KẾT QUẢ HIỂN THỊ', fontSize: 18, fontWeight: 'bold', fill: '#22c55e', textAnchor: 'middle' },
      { type: 'text', x: width * 0.89, y: height * 0.49, text: '(Output / Display)', fontSize: 13, fill: '#94a3b8', textAnchor: 'middle' }
    ];

    return {
      name: 'Sơ đồ nguyên lý hoạt động',
      elements
    };
  },

  // 3. COMPARISON CHART (Before vs After)
  comparison_chart: ({ width, height, palette, strokeColor, strokeWidth, options }) => {
    const elements = [
      { type: 'text', x: width * 0.5, y: 70, text: options.title || 'SO SÁNH TRƯỚC VÀ SAU', fontSize: 26, fontWeight: 'bold', fill: palette.primary, textAnchor: 'middle' },
      // Left Panel: Before
      { type: 'rounded_rect', x: width * 0.08, y: height * 0.2, width: width * 0.4, height: height * 0.68, rx: 14, fill: '#18181b', stroke: '#ef4444', strokeWidth: 4 },
      { type: 'text', x: width * 0.28, y: height * 0.28, text: 'THỜI KỲ CŨ (BEFORE)', fontSize: 22, fontWeight: 'bold', fill: '#f87171', textAnchor: 'middle' },
      // Right Panel: After
      { type: 'rounded_rect', x: width * 0.52, y: height * 0.2, width: width * 0.4, height: height * 0.68, rx: 14, fill: '#18181b', stroke: '#22c55e', strokeWidth: 4 },
      { type: 'text', x: width * 0.72, y: height * 0.28, text: 'THỜI KỲ MỚI (AFTER)', fontSize: 22, fontWeight: 'bold', fill: '#4ade80', textAnchor: 'middle' }
    ];

    return {
      name: 'Biểu đồ so sánh Trước & Sau',
      elements
    };
  }
};

