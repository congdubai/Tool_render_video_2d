import assert from 'node:assert/strict';
import {
  SUPPORTED_GRAPHIC_TYPES,
  SUPPORTED_TEXT_ANIMATIONS,
  wrapVietnameseText,
  renderEducationalGraphics,
} from '../thanhhai-2d-studio/engine/v5-educational-graphics.js';

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name}\n  ${err?.stack || err}`);
  }
}

function makeMockCtx() {
  const calls = [];
  return {
    calls,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    translate: () => {},
    scale: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    roundRect: () => {},
    closePath: () => {},
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    fillText: (txt) => calls.push(['fillText', txt]),
    measureText: (txt) => ({ width: String(txt || '').length * 10 }),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    lineCap: 'butt',
  };
}

await check('4C-1: All 17 Educational Graphic types & 11 Text Animation types registered', () => {
  assert.equal(SUPPORTED_GRAPHIC_TYPES.length, 17);
  assert.equal(SUPPORTED_TEXT_ANIMATIONS.length, 11);
});

await check('4C-2: Vietnamese text wrapping preserves diacritics cleanly', () => {
  const lines = wrapVietnameseText('Máy tính điện tử đầu tiên có kích thước chiếm cả một căn phòng lớn', 28);
  assert.ok(lines.length >= 2);
  assert.ok(lines.join(' ').includes('điện tử'));
});

await check('4C-3: Diagram steps reveal sequentially over time (not all at t=0)', () => {
  const ctxEarly = makeMockCtx();
  const ctxLate = makeMockCtx();
  const scene = {
    diagram: {
      title: 'Quy trình xử lý dữ liệu',
      nodes: [
        { id: 'in', label: 'Input', x: 0.25, y: 0.5, start: 0 },
        { id: 'cpu', label: 'CPU', x: 0.5, y: 0.5, start: 1.5 },
        { id: 'out', label: 'Output', x: 0.75, y: 0.5, start: 3.0 },
      ],
      edges: [{ from: 'in', to: 'cpu', start: 0.8 }],
    },
  };
  renderEducationalGraphics(ctxEarly, scene, 0.4);
  renderEducationalGraphics(ctxLate, scene, 3.5);
  const earlyTexts = ctxEarly.calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  const lateTexts = ctxLate.calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  assert.ok(earlyTexts.includes('Input') && !earlyTexts.includes('Output'));
  assert.ok(lateTexts.includes('Input') && lateTexts.includes('CPU') && lateTexts.includes('Output'));
});

await check('4C-4: Visual Comparison, Historical Timeline & Attention Guidance render cleanly', () => {
  const ctx = makeMockCtx();
  renderEducationalGraphics(ctx, {
    comparison: { left: { title: 'ENIAC', description: 'Chiếm cả phòng' }, right: { title: 'Laptop', description: 'Nhỏ gọn' } },
    timeline: { title: 'Lịch sử', milestones: [{ year: '1940s', title: 'Đèn chân không', start: 0 }, { year: '1950s', title: 'Transistor', start: 1 }] },
    graphics: [{ type: 'arrow', from: { x: 0.2, y: 0.3 }, to: { x: 0.6, y: 0.3 }, start: 0, end: 5 }, { type: 'circle_highlight', x: 0.6, y: 0.3, start: 0, end: 5 }],
    texts: [{ text: 'Bước ngoặt công nghệ', animation: 'typewriter', start: 0, end: 5 }],
  }, 2.0);
  const rendered = ctx.calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  assert.ok(rendered.includes('ENIAC') && rendered.includes('Laptop') && rendered.includes('1940s') && rendered.includes('1950s'));
});

console.log(`\nPhase 4C Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
